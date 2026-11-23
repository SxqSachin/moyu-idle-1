import { prisma } from './db'

/**
 * 禁言用户
 * @param userUuid 用户 uuid
 * @param minutes 时长(分钟); 为空表示永久
 * @param nowInjection 可注入当前时间 (测试用)
 */
export async function muteUser(userUuid: string, minutes?: number, nowInjection?: Date) {
  const now = nowInjection || new Date()
  const muteUntil = typeof minutes === 'number' ? new Date(now.getTime() + minutes * 60000) : null
  // 直接使用 raw 以兼容老 client 生成前场景
  if ((prisma as any).$executeRawUnsafe) {
    if (muteUntil) {
      await (prisma as any).$executeRawUnsafe(`UPDATE User SET is_muted = 1, mute_until = ? WHERE uuid = ?`, muteUntil, userUuid)
    } else {
      await (prisma as any).$executeRawUnsafe(`UPDATE User SET is_muted = 1, mute_until = NULL WHERE uuid = ?`, userUuid)
    }
  } else {
    // 回退（生成新 Prisma Client 后可使用 prisma.user.update）
    // @ts-ignore
    await prisma.user.update({ where: { uuid: userUuid }, data: { is_muted: true, mute_until: muteUntil } })
  }
  return { userUuid, muteUntil }
}

/**
 * 解除禁言
 */
export async function unmuteUser(userUuid: string) {
  if ((prisma as any).$executeRawUnsafe) {
    await (prisma as any).$executeRawUnsafe(`UPDATE User SET is_muted = 0, mute_until = NULL WHERE uuid = ?`, userUuid)
  } else {
    // @ts-ignore
    await prisma.user.update({ where: { uuid: userUuid }, data: { is_muted: false, mute_until: null } })
  }
  return { userUuid }
}

/**
 * 检查是否被禁言（并返回剩余时间毫秒；null=永久；0=未禁言或已过期）
 */
export async function getMuteStatus(userUuid: string) {
  const user: any = await prisma.user.findUnique({ where: { uuid: userUuid }, select: { is_muted: true, mute_until: true } as any })
  if (!user) return { muted: false, remainingMs: 0 }
  if (!user.is_muted) return { muted: false, remainingMs: 0 }
  if (!user.mute_until) return { muted: true, remainingMs: null }
  const now = Date.now()
  const remain = new Date(user.mute_until).getTime() - now
  if (remain <= 0) return { muted: false, remainingMs: 0 }
  return { muted: true, remainingMs: remain }
}
