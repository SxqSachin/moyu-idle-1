import { PrismaClient } from '@/generated/prisma'
import { REQUEST_SUCCESS_CODE, REQUEST_SUCCESS_MSG } from '~/shared/requestResult'
import { CAPTCHA_CHECK_FAILED_CODE, CAPTCHA_CHECK_FAILED_MSG, EMAIL_PASSWORD_ERROR_CODE, EMAIL_PASSWORD_ERROR_MSG } from '~/shared/requestResult/login'
import { z } from 'zod'
import { remoteCheckRecaptcha } from '~/server/utils/recaptcha'
import { prisma } from '~/server/utils/game/db'
import { AccountPlayType, AccountType } from '~/shared/types/account'
import { generateAndSendCode, verifyAndConsumeCode } from '~/server/utils/code'
import sendAliyunTemplateEmail from '~/server/utils/aliyunEmail'
import { redisClient } from '~/server/utils'
import { safeJsonParse } from '~/shared/utils'
import { PlayerProfileInfo } from '~/shared/types/characterInfo'

const bodySchema = z.object({
    loginName: z.string(),
    password: z.string().min(6),
    token: z.string(),
    loginCode: z.string().optional(),
})

export default defineEventHandler(async (event) => {
    const { loginName, password, token, loginCode } = await readValidatedBody(event, bodySchema.parse)

    // 查询用户（邮箱或昵称）
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginName },
          { name: loginName },
        ]
      },
      take: 1,
    });
    if (!user) return { code: EMAIL_PASSWORD_ERROR_CODE, msg: EMAIL_PASSWORD_ERROR_MSG }

    // 账号限流（10分钟内超过10次拒绝）
    const userKey = `login:user:${loginName}`
    const userCount = await redisClient.incr(userKey)
    if (userCount === 1) await redisClient.expire(userKey, 600)
    if (userCount > 10) return { code: EMAIL_PASSWORD_ERROR_CODE, msg: "该账号登录过于频繁，请稍后再试" }

    // 密码与封禁校验
    if (user.pwd !== password) return { code: EMAIL_PASSWORD_ERROR_CODE, msg: EMAIL_PASSWORD_ERROR_MSG }
    if (user.is_banned) return { code: 403, msg: user.ban_reason || 'You are banned from this server.' }

    // 邮箱验证码策略：管理员必须验证；普通用户仅在IP变更时验证
    const currentIp = getRequestIP(event, { xForwardedFor: true }) || ''
    const lastIp = user.last_online_ip || ''
    const ipChanged = !!(currentIp && lastIp && currentIp !== lastIp)
    // 验证过邮箱的，才必须进行邮件验证
    let mustEmailVerify = (!!user.is_gm) || (ipChanged && user.email_verified)

    if (!user.is_gm) {
        const opt = safeJsonParse<PlayerProfileInfo['option']>(user.option, {});

        if (opt?.disableEmailVerificationOnLogin) {
            mustEmailVerify = false
        }
    }


    if (mustEmailVerify) {
        if (!user.email) {
            return { code: 401, msg: '该账号未绑定邮箱，无法完成登录验证', needEmailLoginVerify: true }
        }

        if (!loginCode) {
            const sendRes = await generateAndSendCode(
                user.uuid,
                user.email,
                { actionPurpose: 'login', userName: user.name || '' },
                { templateId: '417547' },
                sendAliyunTemplateEmail,
                { ip: currentIp }
            )
            if (!sendRes.success) {
                return { code: 401, msg: '验证码发送失败或频繁，请稍后再试', needEmailLoginVerify: true }
            }
            return { code: 401, msg: '验证码已发送至绑定邮箱，请完成验证', needEmailLoginVerify: true }
        }

        const v = await verifyAndConsumeCode(user.uuid, loginCode, 'login')
        if (!v.ok) return { code: 401, msg: '邮箱验证码错误或已过期', needEmailLoginVerify: true }
    }

    const userSessionData: any = {
        uuid: user.uuid,
        name: user.name,
        isVisitor: user.is_visitor,
        firstResetPassword: user.first_reset_password,
        accountType: user.accountType,
        isIronCat: user.accountPlayType === AccountPlayType.IRON,

        emailVerified: user.email_verified,
        email: user.email,
    }
    if (user.is_gm) {
        userSessionData.isGm = true
    }

    if (user.is_visitor) {
        userSessionData.visitorPwd = user.pwd
    }
    await setUserSession(event, {
        user: userSessionData,
    }, {
        maxAge: 60 * 60 * 24 * 14, // 30 days
    })

    await prisma.user.update({
        where: {
            uuid: user.uuid,
        },
        data: {
            last_login_date: new Date(),
            last_online_ip: currentIp || user.last_online_ip || '',
        },
    })

    return {
        code: REQUEST_SUCCESS_CODE,
        msg: REQUEST_SUCCESS_MSG
    }
})