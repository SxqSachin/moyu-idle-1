import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import * as friendService from "~/shared/types/friend";
import { prisma } from "~/server/utils/game/db";
import { sanitizeInput } from "~/shared/utils";
import { generateAndSendCode, verifyAndConsumeCode, incrementVerifyAttempt, clearVerifyAttempts, getVerifyAttemptCount } from '~/server/utils/code';
import { redisClient } from '~/server/utils';
import aliyunEmail from '~/server/utils/aliyunEmail';

// 发送好友请求
export async function checkBanned(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<void>
) {
    const fromUserUuid = data.user.uuid;

    let user = await prisma.user.findUnique({
        where: { uuid: fromUserUuid }
    });

    if (user?.is_banned) {
        emitEventToUser(fromUserUuid, "banned", { message: user.ban_reason });
    }
}

export async function bindEmail(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ email: string }>
) {
    let { email } = data.data;
    const userUuid = data.user.uuid;

    email = sanitizeInput(email);
    
    // 检查邮件格式
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emitEventToUser(userUuid, "user:bindEmail:fail", { message: "邮箱格式不正确" });
        return;
    }

    try {
        return prisma.$transaction(async (tx) => {
            // 检查用户是否存在
            const user = await tx.user.findUnique({
                where: { uuid: userUuid }
            });

            if (!user) {
                emitEventToUser(userUuid, "user:bindEmail:fail", { message: "邮箱绑定失败" });
                return;
            }

            if (!user.is_visitor) {
                emitEventToUser(userUuid, "user:bindEmail:fail", { message: "邮箱绑定失败" });
                return;
            }

            // 检查邮箱是否已被绑定
            let emailUsed = await tx.user.findFirst({
                where: { email }
            });
            if (emailUsed) {
                emitEventToUser(userUuid, "user:bindEmail:fail", { message: "邮箱绑定失败" });
                return;
            }

            // 更新用户邮箱
            await tx.user.update({
                where: { uuid: userUuid },
                data: {
                    email,
                    is_visitor: false, // 绑定邮箱后，设置为正式账号
                    first_reset_password: true // 需要用户重置密码

                }
            });

            emitEventToUser(userUuid, "user:bindEmail:success", { message: "邮箱绑定成功" });
        })

    } catch (e: any) {
        emitEventToUser(userUuid, "user:bindEmail:fail", { message: e.message });
    }
}

// 发送邮箱验证码（用于注册/重置/验证）
export async function sendVerifyEmailCode(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{email: string}>
) {
    const userUuid = data.user.uuid;

    const user = await prisma.user.findUnique({ where: { uuid: userUuid } });
    // 允许已验证的账号进行换绑
    if (user?.accountType != "MAIN") {
        emitEventToUser(userUuid, "user:sendVerifyEmailCode:fail", { message: "此账号类别无需邮箱验证" });
        return;
    }

    const emailRaw = data.data.email || '';
    const email = sanitizeInput(emailRaw.toLowerCase().trim());
    // 基础格式校验（只做一次，失败统一报错避免枚举）
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emitEventToUser(userUuid, "user:sendVerifyEmailCode:fail", { message: "邮箱不可用或已被占用" });
        return;
    }
    // 每邮箱限流（防止多账号撞库枚举）
    try {
        const emailLimitKey = `email:verify:limit:hour:${email}`;
        const cnt = await redisClient.incr(emailLimitKey);
        if (cnt === 1) await redisClient.expire(emailLimitKey, 3600);
        // 超过上限（3/h）统一报错不泄露具体原因
        if (cnt > 3) {
            emitEventToUser(userUuid, "user:sendVerifyEmailCode:fail", { message: "邮箱不可用或已被占用" });
            return;
        }
    } catch {}
    // 已验证邮箱唯一性检查
    const emailUsed = await prisma.user.findFirst({ where: { email_verified: true, email } });
    if (emailUsed) {
        emitEventToUser(userUuid, "user:sendVerifyEmailCode:fail", { message: "邮箱不可用或已被占用" });
        return;
    }
    // 如果与当前邮箱相同且已验证则无需发送
    if (user?.email_verified && user.email?.toLowerCase() === email) {
        emitEventToUser(userUuid, "user:sendVerifyEmailCode:fail", { message: "邮箱不可用或已被占用" });
        return;
    }
    // 设置待验证邮箱（10分钟过期，与验证码生命周期一致）并记录本次 code 绑定的邮箱
    try {
        await redisClient.set(`user:pendingEmail:verify:${userUuid}`, email, { EX: 600 });
        // 记录本次验证码发放时的邮箱，防止后续修改 pendingEmail 盗用旧验证码
        await redisClient.set(`user:pendingEmailIssued:verify:${userUuid}`, email, { EX: 600 });
    } catch (e) {
        emitEventToUser(userUuid, "user:sendVerifyEmailCode:fail", { message: "内部错误，请稍后重试" });
        return;
    }

    try {
        // extract IP from socket handshake to apply IP-based rate limits in generateAndStoreCode
        const xff = (socket.handshake.headers['x-forwarded-for'] as string | undefined)?.split(',').shift()?.trim();
        const ip = xff || socket.handshake.address || '';

        const res = await generateAndSendCode(user.uuid, email, {
            actionPurpose: "verify",
            userName: data.user.name,
        }, {
            templateId: '417547',
        }, aliyunEmail, { ip });


        if (!res.success) {
            emitEventToUser(userUuid, "user:sendVerifyEmailCode:fail", { message: (res as any).reason || 'send_failed' });
            return;
        }

        emitEventToUser(userUuid, "user:sendVerifyEmailCode:success", { message: "验证码已发送" });
    } catch (e: any) {
        emitEventToUser(userUuid, "user:sendVerifyEmailCode:fail", { message: e.message || '发送失败' });
    }
}

// 校验邮箱验证码并完成绑定/验证
export async function verifyEmailVerifyCode (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ code: string; }>
) {
    const userUuid = data.user.uuid;
    let { code, } = data.data;

    code = sanitizeInput(code);
    const purpose = 'verify';

    if (!userUuid || !code) {
        emitEventToUser(userUuid, "user:verifyEmailVerifyCode:fail", { message: "参数错误" });
        return;
    }

    // code should be numeric and reasonable length
    if (!/^[0-9]{4,8}$/.test(code)) {
        emitEventToUser(userUuid, "user:verifyEmailVerifyCode:fail", { message: "验证码格式不正确" });
        return;
    }

    try {
        // 先检查尝试次数是否已达上限（在验证前阻断，即使验证码正确也不允许）
        const attemptsNow = await getVerifyAttemptCount(userUuid, purpose);
        const ATTEMPT_LIMIT = 5;
        if (attemptsNow >= ATTEMPT_LIMIT) {
            emitEventToUser(userUuid, "user:verifyEmailVerifyCode:fail", { message: '尝试次数过多，请稍后再试' });
            return;
        }

        const v = await verifyAndConsumeCode(userUuid, code, purpose);
        if (!v.ok) {
            const attempts = await incrementVerifyAttempt(userUuid, purpose);
            let msg = '验证码错误或已过期';
            if (attempts >= ATTEMPT_LIMIT) msg = '尝试次数过多，请稍后再试';
            emitEventToUser(userUuid, "user:verifyEmailVerifyCode:fail", { message: msg });
            return;
        }

        // success -> 清理尝试计数
        await clearVerifyAttempts(userUuid, purpose);

        // 获取待绑定邮箱
        let pendingEmail: string | null = null;
        let issuedEmail: string | null = null;
        try {
            pendingEmail = await redisClient.get(`user:pendingEmail:verify:${userUuid}`);
            issuedEmail = await redisClient.get(`user:pendingEmailIssued:verify:${userUuid}`);
        } catch {}

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({ where: { uuid: userUuid } });
            if (!user) {
                emitEventToUser(userUuid, "user:verifyEmailVerifyCode:fail", { message: "用户不存在" });
                return;
            }
            // 如果存在待绑定邮箱，且不同于当前已验证邮箱，则执行换绑
            if (pendingEmail && pendingEmail === issuedEmail && pendingEmail !== user.email) {
                // 再次唯一性检查避免竞争条件
                const taken = await tx.user.findFirst({ where: { email_verified: true, email: pendingEmail } });
                if (taken) {
                    emitEventToUser(userUuid, "user:verifyEmailVerifyCode:fail", { message: "该邮箱已被占用" });
                    return;
                }
                await tx.user.update({ where: { uuid: userUuid }, data: { email: pendingEmail, email_verified: true, email_verified_at: new Date() } });
            } else if (!user.email_verified) {
                // 没有待绑定邮箱，仅标记已验证（初次验证但邮箱已在表中）
                await tx.user.update({ where: { uuid: userUuid }, data: { email_verified: true, email_verified_at: new Date() } });
            } else {
                // 已验证且缺失匹配的待绑定邮箱（可能过期或被篡改）
                emitEventToUser(userUuid, "user:verifyEmailVerifyCode:fail", { message: "未找到待验证邮箱或已过期" });
                return;
            }
            emitEventToUser(userUuid, "user:verifyEmailVerifyCode:success", { message: "邮箱验证成功" });
        });
        // 清理待绑定邮箱与发放记录
        try { await redisClient.del(`user:pendingEmail:verify:${userUuid}`); } catch {}
        try { await redisClient.del(`user:pendingEmailIssued:verify:${userUuid}`); } catch {}
    } catch (e: any) {
        emitEventToUser(userUuid, "user:verifyEmailVerifyCode:fail", { message: e.message || '验证失败' });
    }
}