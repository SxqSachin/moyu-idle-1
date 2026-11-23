import { type Kitty as KittyCat, type KittyTraitRow } from "~/shared/types/kitty";
import { prisma } from "../prisma";

import type { Kitty } from "~/generated/prisma";
import type { GameTask } from "~/shared/types/gameTask";

import { redisClient } from "../redis";
import { GameResourceCategory, type AllGameResourceID } from "~/shared/types/gameResource";
import { allGameResourceWithInternal } from "~/shared/data/allGameResources";
import { decreaseItemCount, getInventoryInfoPreferCache } from "./characterInventory";
import { KITTY_MAX_SATIETY } from "~/shared/data/constant";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import type { AllGameActionID } from "~/shared/types/gameAction";
import type { KittyFurnitureExistInfo } from "~/shared/data/allKittyFurniture";
import { defaultAllGameActionDurationDetail } from "~/shared/data/allGameActions";
import allKittyTraits from "~/shared/data/kittyTraits";
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

export async function getAllKittyUuids(): Promise<string[]> {
    // 优化：使用 SSCAN 分页迭代，避免一次性取出超大集合导致阻塞
    const out: string[] = [];
    let lCursor = '0';
    const COUNT = 500;
    while (true) {
        const { cursor, members } = await redisClient.SSCAN(ALL_KITTY_TASK_QUEUE_KEYS, lCursor, { COUNT });
        if (Array.isArray(members) && members.length > 0) {
            out.push(...members);
        }
        lCursor = cursor;
        if (lCursor === '0') break;
    }
    return out.map(key => key.replace(KITTY_TASK_QUEUE_PREFIX, "")).sort();
}

export const getKitty = async (uuid: string): Promise<KittyCat | null> => {
    let kittyInDB = await prisma.kitty.findUnique({
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

export async function getKittyTask(kittyUuid: string): Promise<GameTask[]> {
    let key = getKittyTaskKey(kittyUuid)

    let taskList = await redisClient.LRANGE(key, 0, 9999)
    if (!taskList || !Array.isArray(taskList)) {
        taskList = [];
    }
    return taskList.map<GameTask>(str => JSON.parse(str));
}

export async function getAllKittyTaskQueues(): Promise<{[uuid: string]: GameTask[]}> {
    // 使用 SSCAN 获取所有队列 key，避免 SMEMBERS 阻塞
    const keys: string[] = [];
    {
        let lCursor = '0';
        const COUNT = 500;
        while (true) {
            const { cursor, members } = await redisClient.SSCAN(ALL_KITTY_TASK_QUEUE_KEYS, lCursor, { COUNT });
            if (Array.isArray(members) && members.length > 0) keys.push(...members);
            lCursor = cursor;
            if (lCursor === '0') break;
        }
    }
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

export async function updateFirstKittyTaskInfo(kittyUuid: string, task: GameTask) {
    await redisClient.LSET(getKittyTaskKey(kittyUuid), 0, JSON.stringify(task))
}

export async function removeFirstKittyTask(kittyUuid: string): Promise<GameTask | null> {
    let res = await redisClient.LPOP(getKittyTaskKey(kittyUuid))
    // 如果队列为空，自动移除key
    const len = await redisClient.LLEN(getKittyTaskKey(kittyUuid));
    if (len === 0) {
        await removeKittyTaskQueueKey(kittyUuid);
    }
    if (!res) {
        await updateKittyWorkingStatus(kittyUuid)
        return null
    }
    await updateKittyWorkingStatus(kittyUuid)
    return JSON.parse(res)
}

export async function getFirstKittyTask(kittyUuid: string): Promise<GameTask | null> {
    let res = await redisClient.LINDEX(getKittyTaskKey(kittyUuid), 0)

    if (!res) {
        return null
    }

    return JSON.parse(res)
}

export async function getFirstKittyTasks(kittyUuids: string[]): Promise<Map<string, GameTask | null>> {
    const result = new Map<string, GameTask | null>();
    if (!kittyUuids.length) return result;

    const keys = kittyUuids.map(getKittyTaskKey);
    const pipeline = redisClient.multi();
    keys.forEach((k) => pipeline.LINDEX(k, 0));
    const replies = await pipeline.exec();

    kittyUuids.forEach((u, idx) => {
        const r = replies[idx];
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

export async function removeKittyTaskByIndex(kittyUuid: string, index: number): Promise<GameTask | null> {
    const key = getKittyTaskKey(kittyUuid)
    let task = await redisClient.LRANGE(key, index, index)
    if (!task) {
        await updateKittyWorkingStatus(kittyUuid)
        return null
    }
    let targetTask = task[0]
    await redisClient.LREM(key, 1, targetTask)
    // 如果队列为空，自动移除key
    const len = await redisClient.LLEN(key);
    if (len === 0) {
        await removeKittyTaskQueueKey(kittyUuid);
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
            allowExceedMaxMood: true
        });
    }
    if (totalMaxMoodIncrease > 0) {
        await modifyKittyMaxMood(kittyUuid, totalMaxMoodIncrease, `喂养小猫咪 ${kittyInDB.name} 使用 ${count} 个 ${food.name}`);
    }

    await updateKittyWorkingStatus(kittyUuid)

    kittyInDB = await prisma.kitty.findUnique({ where: { uuid: kittyUuid } });

    return toKitty(kittyInDB!);
}

export async function removeKittyTaskQueueInRedis(kittyUuid: string): Promise<void> {
    await redisClient.DEL(getKittyTaskKey(kittyUuid));
    await removeKittyTaskQueueKey(kittyUuid);
    await updateKittyWorkingStatus(kittyUuid)
}

export const getKittyActionDuration = (kitty: KittyCat, actionId: AllGameActionID, furnitureInfo: KittyFurnitureExistInfo, traits: KittyTraitRow[]) => {
  let base = defaultAllGameActionDurationDetail[actionId].base;
  let modify = 0

  if (furnitureInfo.scratchingPost) {
    modify += base * 0.03
  }

  if (furnitureInfo.silkKittyNest) {
    modify += base * 0.02
  }

  if (furnitureInfo.cashmereToy) {
    modify += base * 0.02
  }

  let fromTraitsModify = 0;
  if (traits && traits.length) {
    for (const trait of traits) {
      const traitDef = allKittyTraits[trait.traitId];
      if (traitDef && traitDef.extraActionDurationDecrease) {
        const dec = traitDef.extraActionDurationDecrease({
          actionId,
          oriDuration: base,
          kittyUuid: "",
          kittyName: "",
          owner: "",
          traitLevel: trait.level,
          requestDecreaseMood: async () => {},
          requestIncreaseMood: async () => {},
        });
        fromTraitsModify += dec;
      }
    }
  }

  let fromMoodModify = 0;
  if (kitty.mood >= 90) {
    fromMoodModify += base * 0.02;
  }
  if (kitty.mood >= 140) {
    fromMoodModify += base * 0.03;
  }
  if (kitty.mood >= 180) {
    fromMoodModify += base * 0.03;
  }

  if (kitty.mood <= 10) {
    fromMoodModify -= base * 0.5;
  }

  return base - modify - fromTraitsModify - fromMoodModify;
};