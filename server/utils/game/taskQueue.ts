/**
 * 任务队列存储：Redis List (TASK_QUEUE_<uuid>) + 全局 Set (ALL_TASK_QUEUE_KEYS)
 * 调度：由 USER_TASK_DUE_ZSET (score=nextDueAt) + 子进程 runUserTaskProcessZSet 驱动。
 * 本文件在关键变更点调用 scheduleUserImmediate / unscheduleUser，以保证任务新增/删除后立即生效。
 * 启动迁移：若 ZSET 为空，调度进程会自动 bootstrap；也可手动运行 bootstrapUserTaskScheduler。
 */
import { GameTask } from "~/shared/types/gameTask";
import { redisClient } from "@/server/utils/index"
import { emitEventToUser } from "~/server/io";
import { returnTaskUsedResource } from "./task";
import { getBuildingInfo } from "./building";
import { AllGameBuildingID } from "~/shared/types/building";
import { MAX_QUEUE_LENGTH } from "~/shared/data/constant";
import { scheduleUserImmediate, unscheduleUser } from "./schedule";


// 用于维护所有队列key的集合
const ALL_TASK_QUEUE_KEYS = "ALL_TASK_QUEUE_KEYS";
async function addTaskQueueKey(userUuid: string) {
    await redisClient.SADD(ALL_TASK_QUEUE_KEYS, getKey(userUuid));
}
async function removeTaskQueueKey(userUuid: string) {
    await redisClient.SREM(ALL_TASK_QUEUE_KEYS, getKey(userUuid));
}

const TASK_QUEUE_PREFIX = "TASK_QUEUE_";
const getKey = (key: string) => TASK_QUEUE_PREFIX + key

export async function getAllTaskQueues(): Promise<{[uuid: string]: GameTask[]}> {
    const keys: string[] = await redisClient.SMEMBERS(ALL_TASK_QUEUE_KEYS);
    const result: Record<string, GameTask[]> = {};

    if (!keys.length) return result;

    const pipeline = redisClient.multi();
    keys.forEach(key => pipeline.LRANGE(key, 0, 9999));
    const allQueues = await pipeline.exec();

    keys.forEach((key, idx) => {
        const userUuid = key.replace(TASK_QUEUE_PREFIX, "");

        const redisResult = allQueues[idx];
        const list = Array.isArray(redisResult) ? redisResult : [];
        result[userUuid] = Array.isArray(list) ? list.map((str: string) => JSON.parse(str)) : [];
    });

    return result;
}

// export async function getAllTaskQueues(): Promise<{ [uuid: string]: GameTask[] }> {
//     const result: Record<string, GameTask[]> = {};
//     let cursor = '0';
//     const keys: string[] = [];

//     do {
//         // 使用SCAN替代KEYS，防止阻塞
//         const { cursor: nextCursor, keys: foundKeys } = await redisClient.SCAN(cursor, {
//             MATCH: `${TASK_QUEUE_PREFIX}*`,
//             COUNT: 100
//         })
//         cursor = nextCursor;
//         if (Array.isArray(foundKeys)) {
//             keys.push(...foundKeys);
//         }
//     } while (cursor !== '0');

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

export async function immediatelyStartTask(userUuid: string, task: GameTask) {

    delete task.hasDeductFirstTaskResource;

    // 查询现有长度，不能超过100
    const currentLength = await redisClient.LLEN(getKey(userUuid));
    if (currentLength >= MAX_QUEUE_LENGTH) {
        throw new Error("无法立即执行任务，任务队列长度已达上限");
    }

    // 退还当前最新任务
    // await returnTaskUsedResource(userUuid, task);
    const currentFirstTask = await getFirstTask(userUuid);
    if (currentFirstTask && currentFirstTask.hasDeductFirstTaskResource) {
        await returnTaskUsedResource(userUuid, currentFirstTask);

        delete currentFirstTask.hasDeductFirstTaskResource;
        delete currentFirstTask.lastSubtaskDoneTime;
        // delete currentFirstTask.pastTimeAboutLastSubtask;

        await updateFirstTaskInfo(userUuid, currentFirstTask);
    }

    await addTaskQueueKey(userUuid);
    await redisClient.LPUSH(getKey(userUuid), JSON.stringify(task))
    // 立即调度首任务（放到列表最前）
    await scheduleUserImmediate(userUuid)
}

export async function addTaskToQueueInRedis(userUuid: string, task: GameTask) {
    // 先检查是否存在数字
    // if (!task.repeatCount || typeof task.repeatCount !== 'number') {
    //     task.repeatCount = 0; // 默认值
    // }

    // // 解析数字，移除非数字内容，并补全为整数
    // if (typeof task.repeatCount === 'string') {
    //     task.repeatCount = parseInt((task.repeatCount as any).replace(/\D/g, ''), 10);
    // } 
    
    // if (typeof task.repeatCount !== 'number' || isNaN(task.repeatCount)) {
    //     task.repeatCount = 10; // 默认值
    // }

    // 确保repeatCount是整数
    if (!Number.isInteger(task.repeatCount)) {
        task.repeatCount = Math.floor(task.repeatCount);
    }

    if (task.repeatCount < 0) {
        task.repeatCount = 1; // 确保repeatCount不小于0
    }

    if (isNaN(task.repeatCount) || task.repeatCount < 0) {
        task.repeatCount = 1; // 如果不是数字或小于0，设置为默认值1
    }

    delete task.hasDeductFirstTaskResource;

    if (task.actionId.startsWith("build_")) {
        let buildingId = task.actionId.replace("build_", "") as AllGameBuildingID;

        let characterBuildingInfo = await getBuildingInfo(userUuid)
        if (characterBuildingInfo[buildingId]?.status == 'BUILDING' || characterBuildingInfo[buildingId]?.status == 'BUILT') {
            throw new Error("此建筑正在建造或已建造")
        }
    }

    // 查询现有长度，不能超过100
    const currentLength = await redisClient.LLEN(getKey(userUuid));
    if (currentLength >= MAX_QUEUE_LENGTH) {
        throw new Error("任务队列长度已达上限");
    }

    const wasEmpty = (await redisClient.LLEN(getKey(userUuid))) === 0
    await Promise.all([
        addTaskQueueKey(userUuid),
        redisClient.RPUSH(getKey(userUuid), JSON.stringify(task))
    ]);
    if (wasEmpty) {
        // 新建队列：需要立刻进入调度，首次执行负责扣资源
        await scheduleUserImmediate(userUuid)
    }
}

export async function updateFirstTaskInfo(userUuid: string, task: GameTask) {
    await redisClient.LSET(getKey(userUuid), 0, JSON.stringify(task))
}

export async function removeFirstTask(userUuid: string): Promise<GameTask | null> {
    const key = getKey(userUuid);
    let res = await redisClient.LPOP(key);

    const len = await redisClient.LLEN(key);
    if (len === 0) {
        await removeTaskQueueKey(userUuid);
        await unscheduleUser(userUuid) // 队列空：取消调度
    } else {
        // 删除首任务后还有后续任务：立刻调度以便马上扣资源或继续进度
        await scheduleUserImmediate(userUuid)
    }

    if (!res) {
        return null
    }

    return JSON.parse(res)
}

export async function getFirstTask(userUuid: string): Promise<GameTask | null> {
    let res = await redisClient.LINDEX(getKey(userUuid), 0)

    if (!res) {
        return null
    }

    return JSON.parse(res)
}

export async function removeTaskByIndex(userUuid: string, index: number): Promise<GameTask | null> {
    const key = getKey(userUuid)
    let task = await redisClient.LRANGE(key, index, index)

    if (!task) {
        return null
    }

    let targetTask = task[0]

    await redisClient.LREM(key, 1, targetTask)

    // 如果队列为空，自动移除key
    const len = await redisClient.LLEN(key);
    if (len === 0) {
        await removeTaskQueueKey(userUuid);
        await unscheduleUser(userUuid)
    } else if (index === 0) {
        // 删除的是首任务，新的首任务要立即调度
        await scheduleUserImmediate(userUuid)
    }

    return JSON.parse(targetTask)
}

export async function getTaskQueueInRedis(userUuid: string): Promise<GameTask[]> {
    const res = await redisClient.LRANGE(getKey(userUuid), 0, 9999)

    let taskList = res.map<GameTask>(str => JSON.parse(str))

    return taskList
}

/**
 * 重新排序任务队列
 * @param characterUuid 角色UUID
 * @param newOrder 新的排序索引数组，表示每个位置应该放置原队列中哪个索引的任务
 */
export const reorderTaskQueue = async (characterUuid: string, newOrder: number[]): Promise<void> => {
    const taskQueue = await getTaskQueueInRedis(characterUuid)
    
    if (taskQueue.length === 0) {
        throw new Error('队列为空，无法重排序')
    }

    if (taskQueue.length === 1) {
        // 只有一个执行中的任务，无需排序
        return
    }

    // 第一个任务是执行中的任务，不参与排序
    const executingTask = taskQueue[0]
    const waitingTasks = taskQueue.slice(1)
    
    // 验证新排序索引
    if (newOrder.length !== waitingTasks.length) {
        throw new Error('排序索引数量与等待任务数量不匹配')
    }

    // 根据新的索引顺序重排等待任务
    const reorderedWaitingTasks = newOrder.map(originalIndex => {
        const waitingTaskIndex = originalIndex - 1 // 转换为等待任务数组的索引
        if (waitingTaskIndex < 0 || waitingTaskIndex >= waitingTasks.length) {
            throw new Error(`无效的任务索引: ${originalIndex}`)
        }
        return waitingTasks[waitingTaskIndex]
    })

    // 使用 removeTaskByIndex 从后往前删除所有等待任务
    // 从后往前删除可以避免索引变化的问题
    for (let i = waitingTasks.length; i >= 1; i--) {
        await removeTaskByIndex(characterUuid, i)
    }

    // 重新添加重排序后的等待任务
    for (const task of reorderedWaitingTasks) {
        await addTaskToQueueInRedis(characterUuid, task)
    }
}