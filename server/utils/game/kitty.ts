import { type Kitty as KittyCat } from "~/shared/types/kitty";
import { prisma } from "./db";

import { v4 as uuidv4 } from "uuid";
import { Kitty } from "~/generated/prisma";
import { GameTask } from "~/shared/types/gameTask";
import { emitEventToUser } from "~/server/io";
import { AllGameResourceID, GameResourceCategory } from "~/shared/types/gameResource";
import { allGameResourceWithInternal } from "~/shared/data/allGameResources";
import { decreaseItemCount, getInventoryInfo } from "./characterInventory";
import { KITTY_BASE_QUEUE_LENGTH, KITTY_MAX_SATIETY } from "~/shared/data/constant";
import { scheduleKittyImmediate, unscheduleKitty } from "./kittySchedule";
import { getBuildingInfo } from "./building";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { modifyKittyMood, modifyKittyMaxMood } from "./kittyMood"

export const toKitty = (kitty: Kitty): KittyCat => {
    return {
        uuid: kitty.uuid,
        owner: kitty.owner,
        name: kitty.name,

        satiety: kitty.satiety,
        maxSatiety: kitty.max_satiety,

        mood: kitty.mood,
        maxMood: kitty.max_mood,

        actionId: kitty.action_id ?? "",
        
        isWorking: !!kitty.is_working,
        isInExpedition: !!kitty.isInExpedition, // 是否在探险中
    }
}

export const renameKitty = async (owner: string, kitty: string, name: string): Promise<KittyCat | null> => {
    let kittyInDB = await prisma.kitty.findFirst({
        where: {
            uuid: kitty,
            owner
        },
    });

    if (!kittyInDB) {
        throw new Error("无法重命名，请检查这只小猫咪是不是你所拥有的。");
    }

    // 检查同主人下是否有重名猫咪
    const exist = await prisma.kitty.findFirst({
        where: {
            owner,
            name,
        },
    });
    if (exist) {
        throw new Error("你已经有一只同名的小猫咪了，请换一个名字吧！");
    }

    kittyInDB = await prisma.kitty.update({
        where: {
            uuid: kitty
        },
        data: {
            name
        },
    });

    return toKitty(kittyInDB)
}

export const createKitty = async (owner: string, name: string): Promise<KittyCat> => {
    // 检查同主人下是否有重名猫咪
    const exist = await prisma.kitty.findFirst({
        where: {
            owner,
            name,
        },
    });
    if (exist) {
        throw new Error("你已经有一只同名的小猫咪了，请换一个名字吧！");
    }

    // 每个用户默认只能有1个小猫咪
    const existingKitties = await prisma.kitty.count({
        where: {
            owner
        },
    });

    let maxKittyCount = 0;

    let buildingInfo = await getBuildingInfo(owner);

    if ((buildingInfo.baseCattery?.level ?? 0) > 0) {
        maxKittyCount += 1
    }

    if ((buildingInfo.baseCattery2?.level ?? 0) > 0) {
        maxKittyCount += 1
    }

    // if ((buildingInfo.baseCattery3?.level ?? 0) > 0) {
    //     maxKittyCount += 1
    // }

    if (existingKitties >= maxKittyCount) {
        throw new Error("招募数量达到上限")
    }

    const uuid = uuidv4()
    let kittyInDB = await prisma.kitty.create({
        data: {
            uuid,
            owner,
            name,
            satiety: 10,
            max_satiety: 100, // 默认饱食度上限
            is_working: false
        },
    });

    return toKitty(kittyInDB)
}

export const getKitty = async (uuid: string): Promise<KittyCat | null> => {
    let kittyInDB = await prisma.kitty.findFirst({
        where: {
            uuid
        },
    });

    if (!kittyInDB) {
        return null
    }

    return toKitty(kittyInDB)
}

export const getAllKittyByOwner = async (owner: string): Promise<KittyCat[]> => {
    let kittyInDB = await prisma.kitty.findMany({
        where: {
            owner
        },
    });

    if (!kittyInDB) {
        kittyInDB = []
    }

    return kittyInDB.map(toKitty)
}

async function updateKittyWorkingStatus(kittyUuid: string) {
    const taskQueue = await getKittyTaskQueueInRedis(kittyUuid)
    const isWorking = taskQueue.length > 0
    await prisma.kitty.update({
        where: { uuid: kittyUuid },
        data: { is_working: isWorking }
    })
}

const KITTY_TASK_QUEUE_PREFIX = "KITTY_TASK_QUEUE_";
const ALL_KITTY_TASK_QUEUE_KEYS = "ALL_KITTY_TASK_QUEUE_KEYS";
const getKittyTaskKey = (key: string) => KITTY_TASK_QUEUE_PREFIX + key

// 新增：维护所有猫咪任务队列key的集合
async function addKittyTaskQueueKey(kittyUuid: string) {
    await redisClient.SADD(ALL_KITTY_TASK_QUEUE_KEYS, getKittyTaskKey(kittyUuid));
}
async function removeKittyTaskQueueKey(kittyUuid: string) {
    await redisClient.SREM(ALL_KITTY_TASK_QUEUE_KEYS, getKittyTaskKey(kittyUuid));
}


export async function getAllKittyTaskQueues(): Promise<{[uuid: string]: GameTask[]}> {
    const keys: string[] = await redisClient.SMEMBERS(ALL_KITTY_TASK_QUEUE_KEYS);
    const result: Record<string, GameTask[]> = {};

    if (!keys.length) return result;

    const pipeline = redisClient.multi();
    keys.forEach(key => pipeline.LRANGE(key, 0, 99999));
    const allQueues = await pipeline.exec();

    keys.forEach((key, idx) => {
        const userUuid = key.replace(KITTY_TASK_QUEUE_PREFIX, "");

        const redisResult = allQueues[idx];
        const list = Array.isArray(redisResult) ? redisResult : [];
        result[userUuid] = Array.isArray(list) ? list.map((str: string) => JSON.parse(str)) : [];
    });

    return result;
}
// export async function getAllKittyTaskQueues(): Promise<{[uuid: string]: GameTask[]}> {
//     const result: Record<string, GameTask[]> = {};
//     let cursor = '0';
//     const keys: string[] = [];

//     do {
//         // SCAN cursor MATCH pattern COUNT 100
//         const {cursor: nextCursor, keys: foundKeys} = await redisClient.SCAN(cursor,{
//             MATCH: `${KITTY_TASK_QUEUE_PREFIX}*`,
//             COUNT: 100
//         })

//         cursor = nextCursor;
//         if (Array.isArray(foundKeys)) {
//             keys.push(...foundKeys);
//         }
//     } while (cursor !== '0');


//     if (!keys.length) return result;

//     const pipeline = redisClient.multi();
//     keys.forEach(key => pipeline.LRANGE(key, 0, 99999));
//     const allQueues = await pipeline.exec();

//     keys.forEach((key, idx) => {
//         const userUuid = key.replace(KITTY_TASK_QUEUE_PREFIX, "");

//         const redisResult = allQueues[idx];
//         const list = Array.isArray(redisResult) ? redisResult : [];
//         result[userUuid] = Array.isArray(list) ? list.map((str: string) => JSON.parse(str)) : [];
//     });

//     return result;
// }

export async function addKittyTaskToQueueInRedis(kittyUuid: string, task: GameTask) {
    // 每个猫咪的待办队列中，最多只能包含三个任务
    const taskQueue = await getKittyTaskQueueInRedis(kittyUuid)
    if (taskQueue.length >= KITTY_BASE_QUEUE_LENGTH) {
        throw new Error("小猫咪的待办任务队列已满，请先完成一些任务再添加新的任务。")
    }

    // 检查饱食度
    const kitty = await getKitty(kittyUuid)
    if (!kitty) {
        throw new Error("小猫咪不存在，请检查小猫咪的UUID。")
    }

    if (kitty.satiety <= 0) {
        throw new Error("小猫咪的饱食度不足，无法添加任务。请先喂养小猫咪。")
    }

        const wasEmpty = (await redisClient.LLEN(getKittyTaskKey(kittyUuid))) === 0;
        await Promise.all([
            redisClient.RPUSH(getKittyTaskKey(kittyUuid), JSON.stringify(task)),
            addKittyTaskQueueKey(kittyUuid),
            prisma.kitty.update({
                where: { uuid: kittyUuid },
                data: { is_working: true },
            }),
        ]);
        if (wasEmpty) {
                await scheduleKittyImmediate(kittyUuid);
        }
}

export async function updateFirstKittyTaskInfo(kittyUuid: string, task: GameTask) {
    await redisClient.LSET(getKittyTaskKey(kittyUuid), 0, JSON.stringify(task))
    await scheduleKittyImmediate(kittyUuid)
}

export async function removeFirstKittyTask(kittyUuid: string): Promise<GameTask | null> {
    let res = await redisClient.LPOP(getKittyTaskKey(kittyUuid))
    // 如果队列为空，自动移除key
    const len = await redisClient.LLEN(getKittyTaskKey(kittyUuid));
    if (len === 0) {
        await removeKittyTaskQueueKey(kittyUuid);
        await unscheduleKitty(kittyUuid);
    }
    if (!res) {
        await updateKittyWorkingStatus(kittyUuid)
        return null
    }
    await updateKittyWorkingStatus(kittyUuid)
    if (len > 0) {
        await scheduleKittyImmediate(kittyUuid)
    }
    return JSON.parse(res)
}

export async function getFirstKittyTask(kittyUuid: string): Promise<GameTask | null> {
    let res = await redisClient.LINDEX(getKittyTaskKey(kittyUuid), 0)

    if (!res) {
        return null
    }

    return JSON.parse(res)
}

export async function removeKittyTaskByIndex(kittyUuid: string, index: number): Promise<GameTask | null> {
    const key = getKittyTaskKey(kittyUuid)
    let task = await redisClient.LRANGE(key, index, index)
    if (!task) {
        await updateKittyWorkingStatus(kittyUuid)
        return null
    }
    let targetTask = task[0]
    if (!targetTask) {
        await updateKittyWorkingStatus(kittyUuid)
        return null
    }
    await redisClient.LREM(key, 1, targetTask)
    // 如果队列为空，自动移除key
    const len = await redisClient.LLEN(key);
    if (len === 0) {
        await removeKittyTaskQueueKey(kittyUuid);
        await unscheduleKitty(kittyUuid)
    } else if (index === 0) {
        await scheduleKittyImmediate(kittyUuid)
    }
    await updateKittyWorkingStatus(kittyUuid)
    return JSON.parse(targetTask)
}

export async function getKittyTaskQueueInRedis(kittyUuid: string): Promise<GameTask[]> {
    const res = await redisClient.LRANGE(getKittyTaskKey(kittyUuid), 0, 9999)

    let taskList = res.map<GameTask>(str => JSON.parse(str))

    return taskList
}


export async function feedKitty(kittyUuid: string, resourceId: AllGameResourceID, count: number): Promise<KittyCat> {
    // 查询猫咪
    let kittyInDB = await prisma.kitty.findUnique({
        where: { uuid: kittyUuid }
    });
    if (!kittyInDB) throw new Error("Kitty not found");

    // 查询食物资源
    const food = allGameResourceWithInternal[resourceId];
    if (!food) throw new Error("Resource not found");
    // 判断是否为食物
    if (!food.category?.includes(GameResourceCategory.Food)) throw new Error("资源不是食物");

    // 检查库存
    const inventory = await getInventoryInfoPreferCache(kittyInDB.owner)
    const foodInventory = inventory[resourceId]?.count ?? 0
    if (foodInventory < count) {
        throw new Error("食物数量不足")
    }

    // 计算恢复量
    let restorePer = 0;
    if (food.onUse) {
        for (const action of food.onUse) {
            if (action.resourceEffect) {
                for (const eff of action.resourceEffect) {
                    if ((eff.resource === "__satiety") && typeof eff.increase === "number") {
                        restorePer += eff.increase
                    }
                    if ((eff.resource === "__satiety") && typeof eff.decrease === "number") {
                        restorePer -= eff.decrease
                    }
                }
            }
        }
    }
    if (!restorePer) restorePer = 1; // 默认+1

    const restore = restorePer * count;

    // 检查此食物是否可以提升最大饱食度
    let maxSatietyIncreasePer = 0;

    // 检查此食物是否可以提升心情
    let moodIncreasePer = 0;

    // 检查此食物是否可以提升心情
    let maxMoodIncreasePer = 0;

    if (food.onUse) {
        for (const action of food.onUse) {
            if (action.kittyStatusEffect) {
                for (const eff of action.kittyStatusEffect) {
                    if (eff.status === "maxSatiety" && typeof eff.increase === "number" && eff.increase > 0) {
                        maxSatietyIncreasePer += eff.increase;
                    }

                    if (eff.status === "mood" && typeof eff.increase === "number" && eff.increase > 0) {
                        moodIncreasePer += eff.increase;
                    }

                    if (eff.status === "maxMood" && typeof eff.increase === "number" && eff.increase > 0) {
                        maxMoodIncreasePer += eff.increase;
                    }
                }
            }
        }
    }

    const totalMaxSatietyIncrease = maxSatietyIncreasePer * count;
    const totalMoodIncrease = moodIncreasePer * count;
    const totalMaxMoodIncrease = maxMoodIncreasePer * count;


    let maxSatiety = kittyInDB.max_satiety;
    if (totalMaxSatietyIncrease > 0) {
        maxSatiety += totalMaxSatietyIncrease;
    }

    maxSatiety = Math.min(maxSatiety, KITTY_MAX_SATIETY)
    let newSatiety = Math.max(0, Math.min(kittyInDB.satiety + restore, maxSatiety));

    // 扣除库存
    await decreaseItemCount(kittyInDB.owner, { [resourceId]: { count } }, {
        actionName: `喂养小猫咪 ${kittyInDB.name} 使用 ${count} 个 ${food.name}`,
        showModifyInfo: true,
        type: ModifyItemCountType.Kitty
    })

    // 更新数据库
    await prisma.kitty.update({
      where: { uuid: kittyUuid },
      data: { 
        satiety: newSatiety,
        max_satiety: maxSatiety 
     },
    });

    if (totalMoodIncrease > 0) {
        await modifyKittyMood(kittyUuid, totalMoodIncrease, `喂养小猫咪 ${kittyInDB.name} 使用 ${count} 个 ${food.name}`, {
            allowExceedMaxMood: true,
        });
    }
    if (totalMaxMoodIncrease > 0) {
        await modifyKittyMaxMood(kittyUuid, totalMaxMoodIncrease, `喂养小猫咪 ${kittyInDB.name} 使用 ${count} 个 ${food.name}`);
    }

    await updateKittyWorkingStatus(kittyUuid)

    kittyInDB = await prisma.kitty.findUnique({ where: { uuid: kittyUuid } });

    return toKitty(kittyInDB!);
}

/**
 * 重新排序猫咪任务队列
 * @param kittyUuid 猫咪UUID
 * @param newOrder 新的排序索引数组，表示每个位置应该放置原队列中哪个索引的任务
 */
export const reorderKittyTaskQueue = async (kittyUuid: string, newOrder: number[]): Promise<void> => {
    const taskQueue = await getKittyTaskQueueInRedis(kittyUuid)
    
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

    // 使用 removeKittyTaskByIndex 从后往前删除所有等待任务
    // 从后往前删除可以避免索引变化的问题
    for (let i = waitingTasks.length; i >= 1; i--) {
        await removeKittyTaskByIndex(kittyUuid, i)
    }

    // 重新添加重排序后的等待任务
    for (const task of reorderedWaitingTasks) {
        await redisClient.RPUSH(getKittyTaskKey(kittyUuid), JSON.stringify(task))
    }

    // 更新工作状态
    await updateKittyWorkingStatus(kittyUuid)
}


export async function dispatchKittyTaskDoneToClient(kittyUuid: string, ownerUuid: string, task: GameTask) {
    emitEventToUser(ownerUuid, "kitty:taskQueue:done", {
        kittyUuid,
        task
    })
}

export async function dispatchLatestKittyTaskQueueToClient(kittyUuid: string, ownerUuid: string, taskQueue: GameTask[]) {
    emitEventToUser(ownerUuid, "kitty:taskQueue:updated", {
        kittyUuid,
        taskQueue
    })
}

export async function dispatchAllKittyInfo(ownerUuid: string) {
    const allKittyAboutUser = await getAllKittyByOwner(ownerUuid)

    emitEventToUser(ownerUuid, "kitty:get:success", allKittyAboutUser)
}

