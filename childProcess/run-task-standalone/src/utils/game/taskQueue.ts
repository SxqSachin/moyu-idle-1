import { type GameTask } from "~/shared/types/gameTask";
import { redisClient } from "../redis"
import { withUniqueLock } from "../index"


// 用于维护所有队列key的集合
const ALL_TASK_QUEUE_KEYS = "ALL_TASK_QUEUE_KEYS";
async function removeTaskQueueKey(userUuid: string) {
    await redisClient.SREM(ALL_TASK_QUEUE_KEYS, getKey(userUuid));
}

const TASK_QUEUE_PREFIX = "TASK_QUEUE_";
const getKey = (key: string) => TASK_QUEUE_PREFIX + key

export async function getAllTaskQueueKeys(): Promise<string[]> {
    // 优化：使用 SSCAN 分页迭代，避免一次性取出超大集合导致阻塞
    const out: string[] = [];
    let lCursor = '0';
    const COUNT = 500;
    while (true) {
        const { cursor, members } = await redisClient.SSCAN(ALL_TASK_QUEUE_KEYS, lCursor, { COUNT });
        if (Array.isArray(members) && members.length > 0) {
            out.push(...members);
        }
        lCursor = cursor;
        if (lCursor === '0') break;
    }
    return out.sort();
}

// Return keys without sorting. Useful for bootstrap where ordering isn't required
export async function getAllTaskQueueKeysUnsorted(): Promise<string[]> {
    const out: string[] = [];
    let lCursor = '0';
    const COUNT = 500;
    while (true) {
        const { cursor, members } = await redisClient.SSCAN(ALL_TASK_QUEUE_KEYS, lCursor, { COUNT });
        if (Array.isArray(members) && members.length > 0) {
            out.push(...members);
        }
        lCursor = cursor;
        if (lCursor === '0') break;
    }
    return out;
}

// export async function getAllTaskQueues(): Promise<{[uuid: string]: GameTask[]}> {
//     const keys: string[] = await redisClient.SMEMBERS(ALL_TASK_QUEUE_KEYS);
//     const result: Record<string, GameTask[]> = {};

//     if (!keys.length) return result;

//     const pipeline = redisClient.multi();
//     keys.forEach(key => pipeline.LRANGE(key, 0, 9999));
//     const allQueues = await pipeline.exec();

//     keys.forEach((key, idx) => {
//         const userUuid = key.replace(TASK_QUEUE_PREFIX, "");

//         const redisResult = allQueues[idx];
//         const list = Array.isArray(redisResult) ? redisResult : [];
//         result[userUuid] = Array.isArray(list) ? list.map((str: string) => JSON.parse(str)) : [];
//     });

//     return result;
// }

export async function updateFirstTaskInfo(userUuid: string, task: GameTask) {
    return await withUniqueLock(`userTask:${userUuid}`, async () => {
        await redisClient.LSET(getKey(userUuid), 0, JSON.stringify(task))
    });
}

export async function removeFirstTask(userUuid: string): Promise<GameTask | null> {
    return await withUniqueLock(`userTask:${userUuid}`, async () => {
      const key = getKey(userUuid);
      let res = await redisClient.LPOP(key);

      const len = await redisClient.LLEN(key);
      if (len === 0) {
        await removeTaskQueueKey(userUuid);
      }

      if (!res) {
        return null;
      }

      return JSON.parse(res);
    });
}

export async function getFirstTask(userUuid: string): Promise<GameTask | null> {
    let res = await redisClient.LINDEX(getKey(userUuid), 0)

    if (!res) {
        return null
    }

    return JSON.parse(res)
}

export async function getFirstTasks(userUuids: string[]): Promise<Map<string, GameTask | null>> {
    const result = new Map<string, GameTask | null>();
    if (!userUuids.length) return result;

    const keys = userUuids.map(getKey);
    const pipeline = redisClient.multi();
    keys.forEach((k) => pipeline.LINDEX(k, 0));
    const replies = await pipeline.exec();

    userUuids.forEach((u, idx) => {
        const r = replies[idx];
        // replies may be null or a string
        if (!r) result.set(u, null);
        else {
            try {
                result.set(u, JSON.parse(r as any));
            } catch (e) {
                result.set(u, null);
            }
        }
    });

    return result;
}

export async function getMultiUserTaskQueueInRedis(userUuids: string[]): Promise<Map<string, GameTask[]>> {
    const result = new Map<string, GameTask[]>();
    if (!userUuids.length) return result;

    const keys = userUuids.map(getKey);

    // 使用pipeline批量获取
    const pipeline = redisClient.multi();
    keys.forEach(key => pipeline.LRANGE(key, 0, 9999));
    const allQueues = await pipeline.exec();

    userUuids.forEach((userUuid, idx) => {
        const redisResult = allQueues[idx];
        const list = Array.isArray(redisResult) ? redisResult : [];
        result.set(userUuid, Array.isArray(list) ? list.map((str: string) => JSON.parse(str)) : []);
    });

    return result;
}

export async function getTaskQueueInRedis(userUuid: string): Promise<GameTask[]> {
    const res = await redisClient.LRANGE(getKey(userUuid), 0, 9999)

    let taskList = res.map<GameTask>(str => JSON.parse(str))

    return taskList
}

export async function removeUserTaskQueueInRedis(userUuid: string) {
    await redisClient.DEL(getKey(userUuid))
    await removeTaskQueueKey(userUuid)
}