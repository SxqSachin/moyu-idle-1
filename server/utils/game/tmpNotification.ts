import { prisma } from "./db";

/**
 * 获取某通知类型的待处理用户集合 key
 * @param notifyKey 通知类型或唯一标识
 */
function getPendingSetKey(notifyKey: string) {
    return `TMP_NOTIFY_${notifyKey}`;
}

/**
 * 将用户加入某通知类型的待处理集合（即未读）
 * @param notifyKey 通知类型或唯一标识
 * @param userUuid 用户ID
 */
export async function addUserToPendingNotification(notifyKey: string, userUuid: string) {
    const key = getPendingSetKey(notifyKey);
    await redisClient.sAdd(key, userUuid);
}

/**
 * 用户已读通知，从待处理集合移除
 * @param notifyKey 通知类型或唯一标识
 * @param userUuid 用户ID
 */
export async function markUserNotificationRead(notifyKey: string, userUuid: string) {
    const key = getPendingSetKey(notifyKey);
    await redisClient.sRem(key, userUuid);
}

/**
 * 为所有用户创建一个临时通知（即将所有用户加入待处理集合）
 * @param notifyKey 通知类型或唯一标识
 */
export async function createPendingNotificationForAllUsers(
    notifyKey: string,
) {
    // 获取所有用户uuid
    const allUsers = await prisma.user.findMany({
        select: { uuid: true }
    });
    const allUserUuids = allUsers.map(u => u.uuid).filter(Boolean);

    const key = getPendingSetKey(notifyKey);
    if (allUserUuids.length > 0) {
        await redisClient.sAdd(key, allUserUuids);
    }
}

/**
 * 判断用户是否未读某通知
 * @param notifyKey 通知类型或唯一标识
 * @param userUuid 用户ID
 * @returns 是否未读（true=未读，false=已读）
 */
export async function isUserNotificationUnread(notifyKey: string, userUuid: string): Promise<boolean> {
    const key = getPendingSetKey(notifyKey);
    const isMember = await redisClient.sIsMember(key, userUuid);
    return !!isMember;
}