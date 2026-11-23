import { prisma } from '~/server/utils/game/db';
import { generateAndSendCode } from '~/server/utils/code';
import aliyunEmail from '~/server/utils/aliyunEmail';
import { sanitizeInput } from '~/shared/utils';
import { redisClient } from '~/server/utils';
import crypto from 'crypto';

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { email?: string };
  // IP-based rate limit: each IP max 5 requests per 30 minutes for this endpoint
  try {
    const xff = getRequestHeader(event, 'x-forwarded-for')?.split(',').shift()?.trim();
    const ip = xff || event.node?.req?.socket?.remoteAddress || 'unknown';
    const ipKey = `ip:reset:request:${ip}`;
    const ipCount = await redisClient.incr(ipKey);
    if (ipCount === 1) {
      await redisClient.expire(ipKey, 30 * 60);
    }
    if (ipCount > 5) {
      return { ok: false, message: '请求过于频繁，请稍后再试' };
    }
  } catch (e) {
    // if rate limit check fails for any reason, continue processing (do not block legitimate requests)
    console.warn('ip rate limit check failed', e);
  }
  const email = sanitizeInput(body.email || '');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: '邮箱格式不正确' };
  }

  // 找到用户（如果没有，不暴露是否存在，返回成功以防止枚举）
  const user = await prisma.user.findUnique({ where: { email } });

  // Server-side per-email short cooldown to prevent abuse even for non-existent emails.
  try {
    const emailHash = crypto.createHash('sha256').update(email).digest('hex');
    const cooldownKey = `email:reset:cooldown:${emailHash}`;
    const cd = await redisClient.get(cooldownKey);
    if (cd) {
      // Return generic success to caller to avoid revealing state
      return { ok: true };
    }

    // If user exists, generate and send code; if not, don't call provider but still set cooldown.
    if (user) {
      try {
        const res = await generateAndSendCode(user.uuid, email, { actionPurpose: 'reset', userName: user.name }, { templateId: '417547' }, aliyunEmail);
        // Regardless of provider result, set cooldown to avoid retry floods (but keep response generic)
        await redisClient.set(cooldownKey, '1', { EX: 60 });
        if (!res.success) {
          // don't expose provider errors; return generic failure
          return { ok: false, message: '发送失败' };
        }
        return { ok: true };
      } catch (e: any) {
        // set cooldown to avoid abuse even if send failed
        await redisClient.set(cooldownKey, '1', { EX: 60 });
        return { ok: false, message: '发送失败' };
      }
    } else {
      // user not found: set per-email cooldown and return generic success
      await redisClient.set(cooldownKey, '1', { EX: 60 });
      return { ok: true };
    }
  } catch (e: any) {
    console.error('request-password-reset error', e);
    // don't leak details
    return { ok: false, message: '发送失败' };
  }
});
