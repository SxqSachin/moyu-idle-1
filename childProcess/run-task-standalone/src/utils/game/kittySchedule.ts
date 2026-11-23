/** ChildProcess 侧小猫任务调度辅助，与 runKittyTaskProcessZSet 协作 */
import { redisClient } from '../redis.js'

export const KITTY_DUE_ZSET = 'KITTY_TASK_DUE_ZSET'

export async function scheduleKittyImmediate(kittyUuid: string) {
  try { await redisClient.ZADD(KITTY_DUE_ZSET, { score: Date.now(), value: kittyUuid }) } catch {}
}

export async function scheduleKittyEarliest(kittyUuid: string, when: number) {
  try {
    const score = await redisClient.ZSCORE(KITTY_DUE_ZSET, kittyUuid as any)
    if (score == null || score > when) {
      await redisClient.ZADD(KITTY_DUE_ZSET, { score: when, value: kittyUuid })
    }
  } catch {}
}

export async function unscheduleKitty(kittyUuid: string) {
  try { await redisClient.ZREM(KITTY_DUE_ZSET, kittyUuid) } catch {}
}
