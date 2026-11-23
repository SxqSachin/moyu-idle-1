/**
 * 用户任务 ZSET 调度辅助，与子进程调度器协作。
 */
import { redisClient } from '@/server/utils/index'

const DUE_ZSET = 'USER_TASK_DUE_ZSET'
// 用于唤醒子进程调度器，避免其在空闲时频繁短睡轮询
const WAKE_LIST = 'USER_TASK_WAKE'

export async function scheduleUserImmediate(userUuid: string) {
	try {
		await redisClient.ZADD(DUE_ZSET, { score: Date.now(), value: userUuid })
		// 推送一次唤醒信号：让阻塞等待的调度器被立即唤醒
		await redisClient.LPUSH(WAKE_LIST, userUuid as any)
	} catch {}
}

export async function scheduleUserEarliest(userUuid: string, when: number) {
	try {
		const score = await redisClient.ZSCORE(DUE_ZSET, userUuid as any)
		if (score == null || score > when) {
			await redisClient.ZADD(DUE_ZSET, { score: when, value: userUuid })
			// 若被提前到更早的时间点，也推送一次唤醒信号（便于缩短等待）
			await redisClient.LPUSH(WAKE_LIST, userUuid as any)
		}
	} catch {}
}

export async function unscheduleUser(userUuid: string) {
	try { await redisClient.ZREM(DUE_ZSET, userUuid) } catch {}
}

export const __SCHEDULE_ZSET__ = DUE_ZSET
