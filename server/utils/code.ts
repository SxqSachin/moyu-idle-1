import crypto from 'crypto';
import { redisClient } from '~/server/utils';

// 常量配置（固定值）
// CODE_SECRET should be set in environment for production. Fallback to a placeholder to avoid runtime crash during development.
const CODE_SECRET = process.env.CODE_SECRET || 'change_me'; // please override in production
if (CODE_SECRET === 'change_me') {
  console.warn('WARNING: CODE_SECRET is using the default placeholder. Set CODE_SECRET in environment for production to avoid predictable HMACs.');
}
const DEFAULT_CODE_LENGTH = 6; // 验证码长度（位数）
const DEFAULT_TTL_SECONDS = 600; // 验证码有效期（秒），默认 10 分钟
const DEFAULT_EMAIL_LIMIT_PER_HOUR = 5; // 每个邮箱每小时最多发送次数
const DEFAULT_IP_LIMIT_PER_HOUR = 12; // 每个 IP 每小时最多发送次数
const DEFAULT_VERIFY_ATTEMPT_LIMIT = 5; // 校验失败尝试次数上限

// 生成固定长度的纯数字验证码
function genNumericCode(len = DEFAULT_CODE_LENGTH) {
  const max = 10 ** len;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(len, '0');
}

// 使用 HMAC 对验证码进行哈希，避免在 Redis 中存放明文
function codeHash(purpose: string, id: string, code: string) {
  return crypto.createHmac('sha256', CODE_SECRET).update(`${purpose}:${id}:${code}`).digest('hex');
}

function idKey(purpose: string, id: string) {
  return `user:code:${purpose}:${id}`;
}

function idLimitKey(purpose: string, id: string) {
  return `user:code:limit:hour:${purpose}:${id}`;
}

function ipLimitKey(purpose: string, ip: string) {
  return `ip:code:limit:hour:${purpose}:${ip}`;
}

function idAttemptsKey(purpose: string, id: string) {
  return `user:code:attempts:${purpose}:${id}`;
}

function cooldownKey(purpose: string, id: string) {
  return `user:code:cooldown:${purpose}:${id}`;
}

export type GenerateOptions = {
  length?: number;
  ttlSeconds?: number;
  ip?: string | null;
  fp?: string | null;
  purpose?: string; // register|reset|verify
};

// 生成并保存验证码（包含每用户每小时防爆破限制）
export async function generateAndStoreCode(userUuid: string, opts: GenerateOptions = {}) {
  const purpose = opts.purpose || 'verify';
  const len = opts.length || DEFAULT_CODE_LENGTH;
  const ttl = opts.ttlSeconds || DEFAULT_TTL_SECONDS;
  const ip = opts.ip || '';

  // 每用户（邮箱）每小时发送上限
  try {
    // 先检查短时冷却（60s）
    try {
      const cdKey = cooldownKey(purpose, userUuid);
      const cdVal = await redisClient.get(cdKey);
      if (cdVal) {
        const ttlLeft = await redisClient.ttl(cdKey);
        return { ok: false, reason: 'cooldown', retryAfterSeconds: ttlLeft > 0 ? ttlLeft : 60 };
      }
    } catch (e) {
      // ignore cooldown check errors and continue
      console.error('cooldown check error', e);
    }

    const emailLimitK = idLimitKey(purpose, userUuid);
    const cnt = await redisClient.incr(emailLimitK);
    if (cnt === 1) await redisClient.expire(emailLimitK, 3600);
    if (cnt > DEFAULT_EMAIL_LIMIT_PER_HOUR) {
      return { ok: false, reason: 'rate_limited' };
    }
    // 另外按 IP 限流
    if (ip) {
      const ipLimitK = ipLimitKey(purpose, ip);
      const ipcnt = await redisClient.incr(ipLimitK);
      if (ipcnt === 1) await redisClient.expire(ipLimitK, 3600);
      if (ipcnt > DEFAULT_IP_LIMIT_PER_HOUR) {
        return { ok: false, reason: 'ip_rate_limited' };
      }
    }
  } catch (e) {
    console.error('generateAndStoreCode 限流检查出错', e);
    // 即使限流检查失败，也尝试继续
  }

  const code = genNumericCode(len);
  const hash = codeHash(purpose, userUuid, code);
  const key = idKey(purpose, userUuid);

  try {
    // 将哈希值写入 Redis，并设置过期
    await redisClient.set(key, hash, { EX: ttl });
    // 同时设置短时冷却，防止短时间重复发送（60s）
    try {
      const cdKey = cooldownKey(purpose, userUuid);
      await redisClient.set(cdKey, '1', { EX: 60 });
    } catch (e) {
      console.error('set cooldown error', e);
    }

    return { ok: true, code, ttlSeconds: ttl };
  } catch (e) {
    console.error('generateAndStoreCode 存储错误', e);
    return { ok: false, reason: 'store_error' };
  }
}

// 使用 Lua 脚本实现原子比较并删除（返回 1 成功，0 未找到/已过期，-1 验证失败）
const VERIFY_LUA = `
local v = redis.call('GET', KEYS[1])
if not v then return 0 end
if v == ARGV[1] then redis.call('DEL', KEYS[1]); return 1 end
return -1
`;

export async function verifyAndConsumeCode(userUuid: string, providedCode: string, purpose = 'verify') {
  const key = idKey(purpose, userUuid);
  const hash = codeHash(purpose, userUuid, providedCode);

  try {
    // @ts-ignore use EVAL wrapper used elsewhere in repo
    const res: number = await redisClient.EVAL(VERIFY_LUA, { keys: [key], arguments: [hash] });
    if (res === 1) return { ok: true };
    if (res === 0) return { ok: false, reason: 'not_found_or_expired' };
    return { ok: false, reason: 'invalid_code' };
  } catch (e) {
    console.error('verifyAndConsumeCode eval error', e);
    // fallback: try manual get+compare+del but careful about race
    try {
      const stored = await redisClient.get(key);
      if (!stored) return { ok: false, reason: 'not_found_or_expired' };
      if (stored === hash) {
        await redisClient.del(key);
        return { ok: true };
      }
      return { ok: false, reason: 'invalid_code' };
    } catch (e2) {
      console.error('verifyAndConsumeCode fallback error', e2);
      return { ok: false, reason: 'internal_error' };
    }
  }
}

export async function incrementVerifyAttempt(userUuid: string, purpose = 'verify') {
  const key = idAttemptsKey(purpose, userUuid);
  try {
    const v = await redisClient.incr(key);
    if (v === 1) await redisClient.expire(key, DEFAULT_TTL_SECONDS * 6); // 将尝试计数保存更长一段时间
    return v;
  } catch (e) {
    console.error('incrementVerifyAttempt 出错', e);
    return 0;
  }
}

export async function clearVerifyAttempts(userUuid: string, purpose = 'verify') {
  const key = idAttemptsKey(purpose, userUuid);
  try { await redisClient.del(key); } catch (e) { /* ignore */ }
}

export async function getVerifyAttemptCount(userUuid: string, purpose = 'verify') {
  const key = idAttemptsKey(purpose, userUuid);
  try {
    const v = await redisClient.get(key);
    if (!v) return 0;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  } catch (e) {
    console.error('getVerifyAttemptCount 出错', e);
    return 0;
  }
}

export { DEFAULT_CODE_LENGTH as CODE_LENGTH, DEFAULT_TTL_SECONDS as CODE_TTL_SECONDS };

// providerFn: async ({ to, subject, templateName, templateVars }) => { ... }
export type EmailProviderArgs = {
  subject: string;
  toAddress: string;

  templateData?: {
    name?: string,
    code?: string,
    title?: string,
    expiry_minutes?: number | string,
    [key: string]: any,
    // Record<string, any>;
  }
  templateId?: string;
}

/**
 * 生成验证码并通过传入的 providerFn 发送邮件。
 * 这个方法不依赖任何 email 模块，providerFn 由调用方提供（可调用云 SDK）。
 * 返回 { ok, reason }。
 */
export async function generateAndSendCode<T>(
  userUuid: string,
  email: string,
  options: {
    actionPurpose: "register" | "reset" | "verify" | "login";

    userName: string;
  },
  args: {
    templateId: string,
  },
  providerFn: (args: EmailProviderArgs) => T,
  // optional meta such as ip/fp used for rate limiting
  meta?: { ip?: string | null }
) {
  const userName = options.userName || "";
  const res = await generateAndStoreCode(userUuid, {
    purpose: options.actionPurpose,
    ip: meta?.ip || null,
  });
  if (!res.ok) return {
    success: false,
    error: true,
    result: res
  };

  // 构建模板变量，调用 providerFn
  const ttlMinutes = Math.ceil((res.ttlSeconds || DEFAULT_TTL_SECONDS) / 60);
  const templateVars = {
    title: (() => {
        const purpose = options.actionPurpose;
        if (purpose === "reset") {
            return "密码重置";
        } else if (purpose === "register") {
            return "账号注册";
        } else if (purpose === "verify") {
            return "邮箱验证";
      } else if (purpose === "login") {
        return "登录环境验证";
        }
    })(),
    code: res.code,
    expiry_minutes: ttlMinutes,
    name: userName,
  };

  const emailProviderArgs: EmailProviderArgs = {
    toAddress: email,
    templateId: args.templateId,
    templateData: templateVars,
    subject: "猫猫放置🐱🐟 - " + templateVars.title,
  };

  try {
    const res = await providerFn(emailProviderArgs);
    return { success: true, error: null, result: res };
  } catch (e) {
    console.error("generateAndSendCode 发送邮件失败", e);
    return { success: false, error: e, result: res, };
  }
}
