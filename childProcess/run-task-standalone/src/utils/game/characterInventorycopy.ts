import type { CharacterInventory, CharacterInventoryItem, ItemCountInfo, ItemCountModifyInfo, RewardInfo, UsedResourceInfo } from "~/shared/types/gameInventory"
import type { AllGameResourceID, AllGameResourceIDWithInternal } from "~/shared/types/gameResource"
import { prisma } from "../prisma"
import { redisClient } from "../redis"
import { clone } from "~/shared/utils"
import { RESOURCE_MODIFY_INFO_LENGTH } from "~/shared/data/constant"
import { inventoryLogger } from "../logger"

const REDIS_INVENTORY_KEY_PREFIX = "characterInventory:";

const getInventoryRedisKey = (characterUuid: string) => `${REDIS_INVENTORY_KEY_PREFIX}${characterUuid}`;

export const getInventoryInfo = async (characterUuid: string): Promise<CharacterInventory> => {
    const redisKey = getInventoryRedisKey(characterUuid);
    // 优先从 Redis 读取
    // const cache = await redisClient.get(redisKey);
    // if (cache) {
    //     try {
    //         return JSON.parse(cache);
    //     } catch (e) {
    //         console.error("[inventory] Redis cache parse error:", e);
    //     }
    // }

    const characterInventory = await prisma.characterInventory.findFirst({
        where: {
            character_uuid: characterUuid
        }
    })

    if (!characterInventory) {
        return {}
    }

    const result = JSON.parse(characterInventory.inventory) as CharacterInventory;
    // 查库后写入一份到 Redis
    await redisClient.set(redisKey, JSON.stringify(result), {
        expiration: {
            type: 'EX',
            value: 3600 // 缓存1小时
        }
    });

    return result;
}

export const getItemInfo = async (characterUuid: string, itemId: AllGameResourceID): Promise<CharacterInventoryItem> => {
    const inventory = await getInventoryInfo(characterUuid)
    return inventory[itemId] ?? {count : 0}
}

export const setItemInfo = async (userUuid: string, itemId: AllGameResourceID, itemInfo: CharacterInventoryItem) => {
    const redisKey = getInventoryRedisKey(userUuid);
    const characterInventory = await prisma.characterInventory.findFirst({
        where: {
            character_uuid: userUuid
        }
    })

    if (!characterInventory) {
        const newInventory = {
            [itemId]: itemInfo
        }
        await prisma.characterInventory.create({
            data: {
                user_uuid: userUuid,
                character_uuid: userUuid,
                inventory: JSON.stringify(newInventory)
            }
        })
        // 写入 Redis 缓存
        await redisClient.set(redisKey, JSON.stringify(newInventory), {
            expiration: {
                type: 'EX',
                value: 3600
            }
        });
        return
    }

    // @ts-ignore
    const inventoryInfo = JSON.parse(characterInventory.inventory) as CharacterInventory
    inventoryInfo[itemId] = itemInfo

    await prisma.characterInventory.update({
        where: {
            character_uuid: userUuid
        },
        data: {
            inventory: JSON.stringify(inventoryInfo)
        }
    })
    // 写入 Redis 缓存
    await redisClient.set(redisKey, JSON.stringify(inventoryInfo), {
        expiration: {
            type: 'EX',
            value: 3600
        }
    });
}

const REDIS_ITEM_MODIFY_INFO_KEY = "ITEM_MODIFY_INFO_"
const getItemModifyInfoKey = (userUuid: string) => {
    return REDIS_ITEM_MODIFY_INFO_KEY + userUuid
}

const addItemIncreaseInfoToRedis = async (
  userUuid: string,
  countInfo: ItemCountInfo,
  action: string
) => {
  countInfo = clone(countInfo)
  if (!Object.keys(countInfo).length) {
    return
  }

  const key = getItemModifyInfoKey(userUuid);
  const old = await redisClient.get(key);

  let modifyInfo: ItemCountModifyInfo[] = [];

  if (old) {
    modifyInfo = JSON.parse(old) as ItemCountModifyInfo[];
  }

  modifyInfo.push({
    date: Date.now(),
    action: action,
    type: "increase",
    info: countInfo,
  });

  if (modifyInfo.length > RESOURCE_MODIFY_INFO_LENGTH) {
    modifyInfo = modifyInfo.slice(modifyInfo.length - RESOURCE_MODIFY_INFO_LENGTH);
  }

  await redisClient.set(key, JSON.stringify(modifyInfo));
};

const addItemDecreaseInfoToRedis = async (
  userUuid: string,
  countInfo: ItemCountInfo,
  action: string
) => {
  countInfo = clone(countInfo)
  if (!Object.keys(countInfo).length) {
    return
  }

  const key = getItemModifyInfoKey(userUuid);
  const old = await redisClient.get(key);

  let modifyInfo: ItemCountModifyInfo[] = [];

  if (old) {
    modifyInfo = JSON.parse(old) as ItemCountModifyInfo[];
  }

  (Object.keys(countInfo) as AllGameResourceIDWithInternal[]).forEach((key) => {
    if (!countInfo[key]) {
      return;
    }
    countInfo[key].count = -Math.abs(countInfo[key].count);
  });

  modifyInfo.push({
    date: Date.now(),
    action: action,
    type: "decrease",
    info: countInfo,
  });

  // 仅保留最近100条
  if (modifyInfo.length > RESOURCE_MODIFY_INFO_LENGTH) {
    modifyInfo = modifyInfo.slice(modifyInfo.length - RESOURCE_MODIFY_INFO_LENGTH);
  }

  await redisClient.set(key, JSON.stringify(modifyInfo));
};

export const getItemModifyInfo = async (userUuid: string): Promise<ItemCountModifyInfo[]> => {
    const key = getItemModifyInfoKey(userUuid);
    const old = await redisClient.get(key);
    if (!old) {
        return []
    }
    return JSON.parse(old) as ItemCountModifyInfo[]
}

const INVENTORY_LOCK_PREFIX = "characterInventory:lock:";
const INVENTORY_LOCK_EXPIRE = 5; // 锁超时时间，单位秒

const getInventoryLockKey = (userUuid: string) => `${INVENTORY_LOCK_PREFIX}${userUuid}`;

async function acquireInventoryLock(userUuid: string, reason: string): Promise<string | null> {
    const lockKey = getInventoryLockKey(userUuid);
    // 使用一个随机值作为锁的value，便于后续安全释放
    const lockValue = `${reason}-${Date.now()}-${Math.random()}`;
    const result = await redisClient.SET(lockKey, lockValue, {
        condition: "NX", // 仅在键不存在时设置
        EX: INVENTORY_LOCK_EXPIRE,
    });
    if (result === "OK") {
        return lockValue;
    }
    return null;
}

// 释放分布式锁
async function releaseInventoryLock(userUuid: string, lockValue: string) {
    const lockKey = getInventoryLockKey(userUuid);
    // 只删除自己加的锁，防止误删
    const currentValue = await redisClient.get(lockKey);
    if (currentValue === lockValue) {
        await redisClient.del(lockKey);
    }
}

async function withInventoryLock<T>(userUuid: string, reason: string, fn: () => Promise<T>, opt?: ModifyItemCountOption): Promise<T> {
    const MAX_RETRY = 20;
    let retry = 0;
    let lockValue: string | null = null;
    while (retry < MAX_RETRY) {
        lockValue = await acquireInventoryLock(userUuid, reason);
        if (lockValue) break;
        await new Promise(res => setTimeout(res, 100 + Math.random() * 200)); // 随机等待
        retry++;
    }
    if (!lockValue) {
      let msg = "操作过于频繁，请稍后重试: " + userUuid + '-' + reason + " - " + (opt?.actionName ?? "未知操作")
      console.log(Date.now() + ":ERROR : " + `获取分布式锁失败，用户 ${userUuid} 的操作过于频繁`);
      let err = new Error(msg);
      throw err
    }
    try {
        return await fn();
    } finally {
        await releaseInventoryLock(userUuid, lockValue);
    }
}



export type ModifyItemCountOption = {
    actionName: string,
    reason?: string,
    showModifyInfo?: boolean
}
export const increaseItemCount = async (userUuid: string, countInfo: ItemCountInfo, opt?: ModifyItemCountOption) => {
    if (!Object.keys(countInfo).length) {
        return
    }

    const redisKey = getInventoryRedisKey(userUuid);

    // await withInventoryLock(userUuid, opt?.reason ?? 'undefined event', async () => {
    //   await prisma.$transaction(async (tx) => {
        const tx = prisma
        const characterInventory = await tx.characterInventory.findFirst({
          where: {
            character_uuid: userUuid,
          },
        });

        const allItemIdList = Object.keys(countInfo) as AllGameResourceID[];

        if (!characterInventory) {
          let inventoryInfo: CharacterInventory = {};
          for (const id of allItemIdList) {
            inventoryInfo[id] = {
              count: countInfo[id]!.count,
            };
          }

          await tx.characterInventory.create({
            data: {
              user_uuid: userUuid,
              character_uuid: userUuid,
              inventory: JSON.stringify(inventoryInfo),
            },
          });
          // 写入 Redis 缓存
          await redisClient.set(redisKey, JSON.stringify(inventoryInfo), {
            expiration: {
              type: "EX",
              value: 3600,
            },
          });
          if (opt?.showModifyInfo) {
            await addItemIncreaseInfoToRedis(
              userUuid,
              countInfo,
              opt?.actionName ?? "增加物品"
            );
          }
          return;
        }

        const inventoryInfo = JSON.parse(
          characterInventory.inventory
        ) as CharacterInventory;

        for (const id of allItemIdList) {
          if (!inventoryInfo[id]) {
            inventoryInfo[id] = {
              count: 0,
            };
          }
          inventoryInfo[id].count += countInfo[id]!.count;
        }

        await tx.characterInventory.update({
          where: {
            character_uuid: userUuid,
          },
          data: {
            user_uuid: userUuid,
            character_uuid: userUuid,
            inventory: JSON.stringify(inventoryInfo),
          },
        });
        // 写入 Redis 缓存
        await redisClient.set(redisKey, JSON.stringify(inventoryInfo), {
          expiration: {
            type: "EX",
            value: 3600,
          },
        });

        if (opt?.showModifyInfo) {
          await addItemIncreaseInfoToRedis(
            userUuid,
            countInfo,
            opt?.actionName ?? "增加物品"
          );
        }
    //   });
    // }, opt);
}

export const decreaseItemCount = async (userUuid: string, countInfo: ItemCountInfo, opt?: ModifyItemCountOption): Promise<ItemCountInfo> => {
    const redisKey = getInventoryRedisKey(userUuid);

    // return withInventoryLock(userUuid, opt?.reason ?? 'undefined event', async () => {
    //   return await prisma.$transaction(async (tx) => {
        const tx = prisma
        const characterInventory = await tx.characterInventory.findFirst({
          where: {
            character_uuid: userUuid,
          },
        });

        let res: ItemCountInfo = {};

        if (!characterInventory) {
          return res;
        }

        const inventoryInfo = JSON.parse(
          characterInventory.inventory
        ) as CharacterInventory;

        const allItemIdList = Object.keys(countInfo) as AllGameResourceID[];

        for (const id of allItemIdList) {
          if (!inventoryInfo[id]?.count) {
            continue;
          }

          if (!countInfo[id]?.count) {
            continue;
          }

          let oriInventoryCount = inventoryInfo[id].count;
          let modifyCount = countInfo[id].count;
          let actModifyCount =
            modifyCount <= oriInventoryCount ? modifyCount : oriInventoryCount;

          if (!actModifyCount) {
            continue;
          }

          let newCount = oriInventoryCount - actModifyCount;

          inventoryInfo[id].count = newCount;

          res[id] = {
            count: actModifyCount,
          };
        }

        await tx.characterInventory.update({
          where: {
            character_uuid: userUuid,
          },
          data: {
            inventory: JSON.stringify(inventoryInfo),
          },
        });
        // 写入 Redis 缓存
        await redisClient.set(redisKey, JSON.stringify(inventoryInfo), {
          expiration: {
            type: "EX",
            value: 3600,
          },
        });

        if (opt?.showModifyInfo) {
          await addItemDecreaseInfoToRedis(
            userUuid,
            res,
            opt?.actionName ?? "减少物品"
          );
        }

        return res;
    //   });
    // }, opt);
}

export const setItemCount = async (userUuid: string, itemId: AllGameResourceIDWithInternal, count: number) => {
    if (count <= 0) {
        return
    }

    const redisKey = getInventoryRedisKey(userUuid);
    const characterInventory = await prisma.characterInventory.findFirst({
        where: {
            character_uuid: userUuid
        }
    })

    if (!characterInventory) {
        const newInventory = {
            [itemId]: {
                count
            }
        }
        await prisma.characterInventory.create({
            data: {
                user_uuid: userUuid,
                character_uuid: userUuid,
                inventory: JSON.stringify(newInventory)
            }
        })
        // 写入 Redis 缓存
        await redisClient.set(redisKey, JSON.stringify(newInventory), {
            expiration: {
                type: 'EX',
                value: 3600
            }
        });
        return
    }

    const inventoryInfo = JSON.parse(characterInventory.inventory) as CharacterInventory
    if (!inventoryInfo[itemId]) {
        inventoryInfo[itemId] = {
            count
        }
    } else {
        inventoryInfo[itemId].count = Math.max(count, 0)
    }

    await prisma.characterInventory.update({
        where: {
            character_uuid: userUuid
        },
        data: {
            user_uuid: userUuid,
            character_uuid: userUuid,
            inventory: JSON.stringify(inventoryInfo)
        }
    })
    // 写入 Redis 缓存
    await redisClient.set(redisKey, JSON.stringify(inventoryInfo), {
        expiration: {
            type: 'EX',
            value: 3600
        }
    });
}