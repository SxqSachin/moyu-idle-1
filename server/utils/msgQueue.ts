import { MsgQueuePayload } from '~/shared/types/msgQueue.js';
import { redisClient } from './index.js';
// 建议引入类型定义
// import type { MsgQueuePayload } from '../../shared/types/msgQueue';

const QUEUE_KEY = 'MSG_QUEUE';

/**
 * 推送消息到队列
 * @param {object} message - 消息对象，建议符合 MsgQueuePayload 类型
 */
export async function pushMessageToQueue(message: MsgQueuePayload) {
    try {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        await redisClient.rPush(QUEUE_KEY, msgStr);
    } catch (err) {
        console.error('[msgQueue] pushMessageToQueue error:', err);
        throw err;
    }
}

/**
 * 从队列阻塞读取消息
 * @param {number} timeout - 阻塞超时时间（秒），0为永久阻塞
 * @returns {Promise<MsgQueuePayload|null>}
 */
export async function popMessageFromQueue(count = 50) {
    const result = [];
    try {
        for (let i = 0; i < count; i++) {
            const str = await redisClient.lPop(QUEUE_KEY);
            if (!str) break;
            try {
                result.push(JSON.parse(str));
            } catch {
                result.push(str);
            }
        }
        return result;
    } catch (err) {
        console.error('[msgQueue] popMessageFromQueue error:', err);
        return result;
    }
}

const sub = redisClient.duplicate();
await sub.connect();
export async function blpopMessageFromQueue(timeout = 0): Promise<MsgQueuePayload | null> {
    try {
        // BLPOP 返回 [key, value] 或 null
        const res = await sub.blPop(QUEUE_KEY, timeout);
        if (!res || !res.element) return null;
        try {
            return JSON.parse(res.element);
        } catch {
            return null;
        }
    } catch (err) {
        console.error('[msgQueue] blpopMessageFromQueue error:', err);
        return null;
    }
}

/**
 * 队列长度
 */
export async function getQueueLength() {
    try {
        return await redisClient.lLen(QUEUE_KEY);
    } catch (err) {
        console.error('[msgQueue] getQueueLength error:', err);
        return 0;
    }
}

/**
 * 清空队列
 */
export async function clearQueue() {
    try {
        await redisClient.del(QUEUE_KEY);
    } catch (err) {
        console.error('[msgQueue] clearQueue error:', err);
    }
}