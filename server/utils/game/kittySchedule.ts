/**
 * 小猫任务 ZSET 调度辅助。
 * 与 runKittyTaskProcessZSet 子进程协同：ZSET 分值 = 下一次需要处理该 kitty 的时间戳 (ms)
 */
import { redisClient } from '@/server/utils/index'

const DUE_ZSET = 'KITTY_TASK_DUE_ZSET'

export async function scheduleKittyImmediate(kittyUuid: string) {
  try { await redisClient.ZADD(DUE_ZSET, { score: Date.now(), value: kittyUuid }) } catch {}
}

export async function scheduleKittyEarliest(kittyUuid: string, when: number) {
  try {
    const score = await redisClient.ZSCORE(DUE_ZSET, kittyUuid as any)
    if (score == null || score > when) {
      await redisClient.ZADD(DUE_ZSET, { score: when, value: kittyUuid })
    }
  } catch {}
}

export async function unscheduleKitty(kittyUuid: string) {
  try { await redisClient.ZREM(DUE_ZSET, kittyUuid) } catch {}
}

export const __KITTY_SCHEDULE_ZSET__ = DUE_ZSET
