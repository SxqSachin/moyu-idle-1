import { prisma } from '~/server/utils/game/db';
import { verifyAndConsumeCode, incrementVerifyAttempt, clearVerifyAttempts, getVerifyAttemptCount } from '~/server/utils/code';
import { redisClient } from '~/server/utils';
import { sanitizeInput } from '~/shared/utils';
import crypto from 'crypto';

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { email?: string; code?: string };
  // IP-based rate limit: each IP max 5 requests per 30 minutes for this endpoint
  try {
    const xff = getRequestHeader(event, 'x-forwarded-for')?.split(',').shift()?.trim();
    const ip = xff || event.node?.req?.socket?.remoteAddress || 'unknown';
    const ipKey = `ip:reset:verify:${ip}`;
    const ipCount = await redisClient.incr(ipKey);
    if (ipCount === 1) {
      await redisClient.expire(ipKey, 30 * 60);
    }
    if (ipCount > 5) {
      return { ok: false, message: '请求过于频繁，请稍后再试' };
    }
  } catch (e) {
    console.warn('ip rate limit check failed', e);
  }
  const email = sanitizeInput(body.email || '');
  const code = sanitizeInput(body.code || '');
  if (!email || !code) return { ok: false, message: '参数错误' };
  // basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: '邮箱格式不正确' };
  // code should be numeric and reasonable length to avoid heavy crypto work
  if (!/^[0-9]{4,8}$/.test(code)) return { ok: false, message: '验证码格式不正确' };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Do not reveal whether the user exists. Return generic invalid-code response.
    return { ok: false, message: '验证码错误或已过期' };
  }

  const purpose = 'reset';
  try {
    // check attempts first to avoid validating even correct codes after too many failures
    const attemptsNow = await getVerifyAttemptCount(user.uuid, purpose);
    const ATTEMPT_LIMIT = 5;
    if (attemptsNow >= ATTEMPT_LIMIT) {
      return { ok: false, message: '尝试次数过多，请稍后再试' };
    }
    const v = await verifyAndConsumeCode(user.uuid, code, purpose);
    if (!v.ok) {
      const attempts = await incrementVerifyAttempt(user.uuid, purpose);
      let msg = '验证码错误或已过期';
      if (attempts >= 5) msg = '尝试次数过多，请稍后再试';
      return { ok: false, message: msg };
    }

    // success -> 清理尝试计数
    await clearVerifyAttempts(user.uuid, purpose);

    // 生成一次性加密密钥，供客户端在本页面加密新密码，短期有效
    const encKey = crypto.randomBytes(32).toString('hex');
    const key = `user:reset:enc_key:${user.uuid}`;
    await redisClient.set(key, encKey, { EX: 300 }); // 5 minutes

    return { ok: true, encKey };
  } catch (e: any) {
    return { ok: false, message: e?.message || '验证失败' };
  }
});
