import { PrismaClient } from "@/generated/prisma";

import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import { increaseItemCount } from "~/server/utils/game/characterInventory";
import { prisma } from "~/server/utils/game/db";
import { remoteCheckRecaptcha } from "~/server/utils/recaptcha";
import { NEW_ACCOUNT_INITIAL_INVENTORY } from "~/shared/data/constant";
import { REQUEST_SUCCESS_CODE, REQUEST_SUCCESS_MSG } from "~/shared/requestResult";
import {
  NAME_EXIST_CODE,
  NAME_EXIST_MSG,
  EMAIL_EXIST_CODE,
  EMAIL_EXIST_MSG,
  CAPTCHA_CHECK_FAILED_CODE,
  CAPTCHA_CHECK_FAILED_MSG,
  CREATE_USER_FAILED_CODE,
  CREATE_USER_FAILED_MSG,
} from "~/shared/requestResult/login";
import { clone, getReferrerUuidFromCode, sanitizeInput } from "~/shared/utils";
import { redisClient } from "~/server/utils";


let ipBlackList: string[] = [
  '61.156.194.104'
];

// 统一用秒表示窗口与封禁时长
const BAN_RULES = [
  {
    windowSec: 300,  // 5 分钟
    banSec: 60 * 60 * 2,    // 6 小时
    thresholds: { ip: 3, fp: 3, pwd: 3 },
  },
  {
    windowSec: 600,  // 10 分钟
    banSec: 60 * 60 * 6,    //  6 小时
    thresholds: { ip: 4, fp: 4, pwd: 4 },
  },
  {
    windowSec: 1200, // 20 分钟
    banSec: 60 * 60 * 12,    // 12 小时
    thresholds: { ip: 6, fp: 6, pwd: 4 },
  },
];

const hashPwd = (pwd: string) => createHash("sha256").update(pwd || "").digest("hex");

const isBanned = async (ip?: string | null, fp?: string | null) => {
  try {
    if (ip) {
      const hit = await redisClient.get(`register:ban:ip:${ip}`);
      if (hit) return true;
    }
    if (fp) {
      const hit = await redisClient.get(`register:ban:fp:${fp}`);
      if (hit) return true;
    }
  } catch (e) {
    console.warn("[register] ban check redis error", e);
  }
  return false;
};

const recordAndMaybeBan = async (ip: string | null, fp: string | null, pwd: string) => {
  try {
    const pwdHash = hashPwd(pwd);

    for (const rule of BAN_RULES) {
      const keys: Array<{ key: string; threshold: number; banTargets: Array<{ key: string; ttl: number }> }> = [];

      if (ip && rule.thresholds.ip) {
        keys.push({
          key: `register:mal:${rule.windowSec}:ip:${ip}`,
          threshold: rule.thresholds.ip,
          banTargets: [{ key: `register:ban:ip:${ip}`, ttl: rule.banSec }],
        });
      }
      if (fp && rule.thresholds.fp) {
        keys.push({
          key: `register:mal:${rule.windowSec}:fp:${fp}`,
          threshold: rule.thresholds.fp,
          banTargets: [{ key: `register:ban:fp:${fp}`, ttl: rule.banSec }],
        });
      }
      // 密码只用于检测，不直接封禁密码；若触发，封禁当前 ip/fp
      if (rule.thresholds.pwd) {
        keys.push({
          key: `register:mal:${rule.windowSec}:pwd:${pwdHash}`,
          threshold: rule.thresholds.pwd,
          banTargets: [
            ...(ip ? [{ key: `register:ban:ip:${ip}`, ttl: rule.banSec }] : []),
            ...(fp ? [{ key: `register:ban:fp:${fp}`, ttl: rule.banSec }] : []),
          ],
        });
      }

      for (const item of keys) {
        const cnt = await redisClient.incr(item.key);
        if (cnt === 1) {
          await redisClient.expire(item.key, rule.windowSec);
        }
        if (cnt >= item.threshold) {
          for (const ban of item.banTargets) {
            await redisClient.set(ban.key, "1", { EX: ban.ttl });
          }
          return true;
        }
      }
    }
  } catch (e) {
    console.warn("[register] recordAndMaybeBan redis error", e);
  }
  return false;
};

export default defineEventHandler(async (event) => {
  let { name, email, password, token, fp, referralCode } = await readBody(event);

  name = sanitizeInput(name); 
  email = sanitizeInput(email);

  // Name validation: 1..11 code points; allowed scripts: Han, Hiragana, Katakana, Latin letters, digits, emoji
  const countCodePoints = (s: string) => Array.from(s || '').length;
  const allowedNameRegex = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9\p{Extended_Pictographic}\s]+$/u;
  if (!name || countCodePoints(name) < 1 || countCodePoints(name) >= 12 || !allowedNameRegex.test(name)) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: "昵称不合法：长度需1-11，且仅限常见字符",
    };
  }

  if (await checkSensitiveWords(name)) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: "昵称包含敏感词",
    };
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!fp) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: CREATE_USER_FAILED_MSG,
    };
  }

  const ip = getRequestIP(event, {
    xForwardedFor: true
  })

  if (!isDevelopment && (ip && ipBlackList.includes(ip))) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: CREATE_USER_FAILED_MSG,
    };
  }

  if (await isBanned(ip, fp)) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: "注册过于频繁，请稍后再试",
    };
  }

  const ipKey = ip ? `register:ip:${ip}` : null;
  if (ipKey) {
    const count = await redisClient.incr(ipKey);
    if (count === 1) {
      await redisClient.expire(ipKey, 600); // 10分钟
    }
    if (count > 5) {
      // 使用第一条规则的封禁时长作为速率封禁兜底
      const banSec = BAN_RULES[0]?.banSec || 1800;
      await redisClient.set(`register:ban:ip:${ip}`, "1", { EX: banSec });
      return {
        code: CREATE_USER_FAILED_CODE,
        msg: "注册过于频繁，请稍后再试",
      };
    }
  }

  const abuseHit = await recordAndMaybeBan(ip || null, fp, password || "");
  if (abuseHit) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: "注册过于频繁，请稍后再试",
    };
  }

  // 在数据库中检查ip和指纹是否存在多个
  const existingUsers = await prisma.user.findMany({
    where: {
      last_online_ip: ip,
      last_online_fp: fp,
    },
  });

  if (!isDevelopment && existingUsers.length > 1) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: CREATE_USER_FAILED_MSG,
    };
  }

  if (!(await remoteCheckRecaptcha(token))) {
    return {
      code: CAPTCHA_CHECK_FAILED_CODE,
      msg: CAPTCHA_CHECK_FAILED_MSG,
    };
  }

  // 强制要求注册邮箱使用常见域名格式，例如以 .com 结尾
  try {
    const emailLower = (email || '').toString().trim().toLowerCase();
    const basicEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower);
    if (!basicEmail || !emailLower.endsWith('.com')) {
      return {
        code: CREATE_USER_FAILED_CODE,
        msg: '请使用常用邮箱格式进行注册',
      };
    }
  } catch (e) {
    return {
      code: CREATE_USER_FAILED_CODE,
      msg: '请使用常用邮箱格式进行注册',
    };
  }

  const nameExist = await prisma.user.findUnique({
    where: {
      name,
    },
  });

  if (!!nameExist) {
    return {
      code: NAME_EXIST_CODE,
      msg: NAME_EXIST_MSG,
    };
  }

  const emailExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!!emailExist) {
    return {
      code: EMAIL_EXIST_CODE,
      msg: EMAIL_EXIST_MSG,
    };
  }

  let referrerUuid: string | null = null;
  let referrerData: any = null;
  
  if (referralCode) {
    try {
      referrerUuid = getReferrerUuidFromCode(referralCode);

      if (referrerUuid) {
        // 验证推荐人是否存在
        referrerData = await prisma.user.findUnique({
          where: { uuid: referrerUuid },
          select: { 
            uuid: true, 
            name: true,
          }
        });
        
        if (!referrerData) {
          // 推荐人不存在，清空推荐关系
          referrerUuid = null;
        }
      }
    } catch (error) {
      console.error('推荐码无效');
      referrerUuid = null;
    }
  }


  const user = await prisma.user.create({
    data: {
      uuid: uuidv4(),
      email,
      pwd: password,
      name: name,
      create_date: new Date(),
      // 新用户标记与引导初始值
      is_new_user: true,
      has_seen_onboarding: false,
      referredBy: referrerUuid, // 设置推荐人
    },
  });

  if (referrerUuid && referrerData) {
    // 在事务中处理推荐相关操作
    // 记录推荐关系
    await prisma.userReferral.create({
      data: {
        uuid: uuidv4(),
        referrerUuid,
        referredUuid: user.uuid,
        referralCode,
        status: 'CONFIRMED',
        ipAddress: ip || '',
        fingerprint: fp,
        confirmedAt: new Date(),
      }
    });
  }

  const newAccountInitialInventory = clone(NEW_ACCOUNT_INITIAL_INVENTORY);

  // 2026-01-10 日前，额外添加 bell_of_2025
  if (Date.now() < new Date('2026-01-05').getTime()) {
    newAccountInitialInventory['bell_of_2025'] = {
      count: 1
    }
  }

  await increaseItemCount(user.uuid, newAccountInitialInventory)

  await updateCharacterStatusInfo(user.uuid)

  const userSessionData: any = {
    uuid: user.uuid,
    name: user.name,
    isVisitor: user.is_visitor,

    email: user.email,
  };
  if (user.is_visitor) {
    userSessionData.visitorPwd = user.pwd;
  }
  await setUserSession(event, {
    user: userSessionData,
  });

  return {
    code: REQUEST_SUCCESS_CODE,
    msg: REQUEST_SUCCESS_MSG,
  };
});
