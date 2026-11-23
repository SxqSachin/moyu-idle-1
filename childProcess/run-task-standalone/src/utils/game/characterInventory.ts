import type { CharacterInventory, CharacterInventoryItem, ItemCountInfo, ItemCountModifyInfo, ModifyItemCountOption, ModifyItemCountType, RewardInfo, UsedResourceInfo } from "~/shared/types/gameInventory"
import type { AllGameResourceID, AllGameResourceIDWithInternal } from "~/shared/types/gameResource"
import { prisma } from "../prisma"
import { redisClient } from "../redis"
import { clone, delay } from "~/shared/utils"
import { RESOURCE_MODIFY_INFO_LENGTH } from "~/shared/data/constant"
import { inventoryLogger } from "../logger"
import { Prisma, PrismaClient } from "~/generated/prisma"
import type { DefaultArgs } from "@prisma/client/runtime/library"
import type { ResourceRequirement } from "~/shared/types/gameAction"
import { addPlayerGoldStats, decreasePlayerGoldStats } from "./weeklyPlayerStats"
import type { PrismaTx } from "~/shared/types/socket/db"
import { emitEventToUser } from "./msgQueue"
import { convertItemCountInfoToDecrease } from "~/shared/utils/game/requirementCheck"
import { recordItemCollectBatch } from "./codex"
import { dbExecuteWithRetry } from "../dbUtils"

const REDIS_INVENTORY_KEY_PREFIX = "characterInventory:";

const getInventoryRedisKey = (characterUuid: string) => `${REDIS_INVENTORY_KEY_PREFIX}${characterUuid}`;

export const getInventoryInfo = async (characterUuid: string, tx?: PrismaTx): Promise<CharacterInventory> => {
    if (!tx) {
        tx = prisma;
    }

    const items = await tx.characterNewInventory.findMany({
        where: { character_uuid: characterUuid }
    });

    const result: CharacterInventory = {};
    for (const item of items) {
        result[item.item_id] = { count: Number(item.count) };
        // 可扩展 extra 字段
    }

    // Populate cache for future reads using Redis Hash. Cache is read-through only: writes will invalidate.
    // const redisKey = getInventoryRedisKey(characterUuid);
    // const start = Date.now();
    // try {
        // if (Object.keys(result).length) {
        //     const map: Record<string, string> = {};
        //     for (const [k, v] of Object.entries(result)) {
        //         map[k] = String(v?.count);
        //     }
        //     if (Object.keys(map).length) {
        //         await redisClient.hSet(redisKey, map);
        //         await redisClient.expire(redisKey, 60 * 10);
        //     }
        // }
    // } catch (e) {
        // console.warn(`[child/inventory] Redis unavailable when writing inventory cache for ${characterUuid}: ${e}`);
    // }
    // const duration = Date.now() - start;
    // console.log(`[child/inventory] rebuild inventory cache for ${characterUuid} in ${duration}ms`);

    return result;
}

export const getItemInfo = async (characterUuid: string, itemId: AllGameResourceID, tx?: PrismaTx): Promise<CharacterInventoryItem> => {
    if (!tx) {
        tx = prisma;
    }

    const item = await tx.characterNewInventory.findUnique({
        where: {
            character_uuid_item_id: {
                character_uuid: characterUuid,
                item_id: itemId,
            }
        }
    });
    return item ? { count: Number(item.count) } : { count: 0 };
}

export const getItemCount = async (characterUuid: string, itemId: AllGameResourceID, tx?: PrismaTx): Promise<number> => {
    return (await getItemInfo(characterUuid, itemId, tx)).count;
};

const REDIS_ITEM_MODIFY_INFO_KEY = "ITEM_MODIFY_INFO_"
const getItemModifyInfoKey = (userUuid: string) => {
    return REDIS_ITEM_MODIFY_INFO_KEY + userUuid
}

const getItemModifyInfoKeyByType = (userUuid: string, type: ModifyItemCountType) => {
    return REDIS_ITEM_MODIFY_INFO_KEY + type + "_" + userUuid
}

const addItemIncreaseInfoToRedis = async (
  userUuid: string,
  countInfo: ItemCountInfo,
  action: string,
  info: ModifyItemCountOption,
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

  let nInfo: ItemCountModifyInfo = {
    date: Date.now(),
    action: info?.actionName ?? action,
    modifyType: info.type,
    type: "increase",
    info: countInfo,
  }

  modifyInfo.push(nInfo);

  if (modifyInfo.length > RESOURCE_MODIFY_INFO_LENGTH) {
    modifyInfo = modifyInfo.slice(modifyInfo.length - RESOURCE_MODIFY_INFO_LENGTH);
  }

//   await redisClient.set(key, JSON.stringify(modifyInfo));

  if (info.type) {
    let typedKey = getItemModifyInfoKeyByType(userUuid, info.type);
    await redisClient.lPush(typedKey, JSON.stringify(nInfo));
    await redisClient.lTrim(typedKey, 0, 299);
  }
};

const addItemDecreaseInfoToRedis = async (
  userUuid: string,
  countInfo: ItemCountInfo,
  action: string,
  info: ModifyItemCountOption,
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
    if (!countInfo[key]) return;
    countInfo[key].count = -Math.abs(countInfo[key].count);
  });

  let nInfo: ItemCountModifyInfo = {
    date: Date.now(),
    action: info?.actionName ?? action,
    modifyType: info.type,
    type: "decrease",
    info: countInfo,
  }

  modifyInfo.push(nInfo);

  // 仅保留最近100条
  if (modifyInfo.length > RESOURCE_MODIFY_INFO_LENGTH) {
    modifyInfo = modifyInfo.slice(modifyInfo.length - RESOURCE_MODIFY_INFO_LENGTH);
  }

//   await redisClient.set(key, JSON.stringify(modifyInfo));

  if (info.type) {
    let typedKey = getItemModifyInfoKeyByType(userUuid, info.type);
    await redisClient.lPush(typedKey, JSON.stringify(nInfo));
    await redisClient.lTrim(typedKey, 0, 299);
  }
};

export const getItemModifyInfo = async (userUuid: string): Promise<ItemCountModifyInfo[]> => {
    const key = getItemModifyInfoKey(userUuid);
    const old = await redisClient.get(key);
    if (!old) {
        return []
    }
    return JSON.parse(old) as ItemCountModifyInfo[]
}

/**
 * Invalidate inventory cache for child-process use.
 * If `fields` provided, delete only those hash fields (HDEL). Otherwise delete whole key (DEL).
 */
export const invalidateInventoryCache = async (characterUuid: string, fields?: string[]) => {
    return;
    // const key = getInventoryRedisKey(characterUuid);
    // try {
    //     if (fields && fields.length) {
    //         await redisClient.hDel(key, fields);
    //     } else {
    //         await redisClient.del(key);
    //     }
    // } catch (e) {
    //     console.warn(`[child/inventory] Redis unavailable when invalidating inventory cache for ${characterUuid}: ${e}`);
    // }
}

export const getInventoryInfoPreferCache = async (characterUuid: string): Promise<CharacterInventory> => {
    return await getInventoryInfo(characterUuid);

    // const redisKey = getInventoryRedisKey(characterUuid);
    // try {
    //     const hash = await redisClient.hGetAll(redisKey);
    //     if (hash && Object.keys(hash).length) {
    //         const cached: CharacterInventory = {};
    //         for (const [k, v] of Object.entries(hash)) {
    //             cached[k] = { count: Number(v ?? 0) };
    //         }
    //         return cached;
    //     }
    // } catch (e) {
    //     // ignore redis errors and fall back to DB
    // }
    // return await getInventoryInfo(characterUuid);
}

export const getItemInfoPreferCache = async (characterUuid: string, itemId: AllGameResourceID): Promise<CharacterInventoryItem> => {
    return await getItemInfo(characterUuid, itemId);
    // const redisKey = getInventoryRedisKey(characterUuid);
    // try {
    //     const val = await redisClient.hGet(redisKey, itemId);
    //     if (val != null) return { count: Number(val) };
    // } catch (e) {
    //     // ignore redis errors
    // }
    // return await getItemInfo(characterUuid, itemId);
}

export const batchIncreaseItemCount = async (
  info: Record<string, ItemCountInfo>,
  opt?: ModifyItemCountOption,
  tx?: PrismaTx
) => {
  if (!Object.keys(info).length) return;

  const usedExternalTx = Boolean(tx);

  const run = async (pTx: PrismaTx) => {
    const values: Prisma.Sql[] = []
    for (const [userUuid, countInfo] of Object.entries(info)) {
      if (!countInfo || !Object.keys(countInfo).length) continue
      const allItemIdList = Object.keys(countInfo).sort() as AllGameResourceID[]
      allItemIdList.forEach((itemId) => {
        const count = countInfo[itemId]?.count ?? 0
        if (!count) return
        values.push(Prisma.sql`(${userUuid}, ${itemId}, ${count}, NOW(), ${userUuid})`)
      })
    }

    if (!values.length) return

    await dbExecuteWithRetry(
      async () => {
        const query = Prisma.sql`
            INSERT INTO CharacterNewInventory
              (character_uuid, item_id, \`count\`, updated_at, user_uuid)
            VALUES ${Prisma.join(values)}
            ON DUPLICATE KEY UPDATE
              \`count\` = \`count\` + VALUES(\`count\`),
              updated_at = NOW()
          `
        await pTx.$executeRaw(query)
      },
      `batchIncreaseItemCount-${values.length}`,
    )
  }

  if (!tx) {
    await run(prisma)
  } else {
    await run(tx)
  }

  // gold 统计 & 事件/日志 逐用户处理
  for (const [userUuid, countInfo] of Object.entries(info)) {
    if (!countInfo) continue
    for (const itemId of Object.keys(countInfo) as AllGameResourceID[]) {
      const count = countInfo[itemId]?.count ?? 0
      if (itemId === "gold" && count) {
        await addPlayerGoldStats({
          userUuid,
          goldAmount: BigInt(count),
        })
      }
    }

    if (opt?.showModifyInfo) {
      await addItemIncreaseInfoToRedis(
        userUuid,
        countInfo,
        opt?.actionName ?? "增加物品",
        opt,
      )
    }

    if (opt?.sendModifyEvent) {
      dispatchInventoryModify(userUuid, countInfo)
    }

    if (!usedExternalTx) {
      try {
        await invalidateInventoryCache(userUuid)
      } catch (e) {
        console.warn(
          `[child/inventory] Redis unavailable when invalidating inventory cache for ${userUuid}: ${e}`,
        )
      }
    }
  }
};

export const increaseItemCount = async (
  userUuid: string,
  countInfo: ItemCountInfo,
  opt?: ModifyItemCountOption,
  tx?: PrismaTx
) => {
  if (!Object.keys(countInfo).length) return;

  const usedExternalTx = Boolean(tx);

  const run = async (pTx: PrismaTx) => {
    const allItemIdList = Object.keys(countInfo).sort() as AllGameResourceID[];

    const values = allItemIdList.map((itemId) => {
      const count = countInfo[itemId]!.count;
      return Prisma.sql`(${userUuid}, ${itemId}, ${count}, NOW(), ${userUuid})`;
    });
    // 批量执行，带死锁重试
    await dbExecuteWithRetry(
      async () => {
        try {
          const query = Prisma.sql`
              INSERT INTO CharacterNewInventory
                (character_uuid, item_id, \`count\`, updated_at, user_uuid)
              VALUES ${Prisma.join(values)}
              ON DUPLICATE KEY UPDATE
                \`count\` = \`count\` + VALUES(\`count\`),
                updated_at = NOW()
            `;

          await pTx.$executeRaw(query);
        } catch (e) {
            console.error(`[increaseItemCount] Failed to increase item count for user ${userUuid}: ${e}`);
            throw e;
        }
      },
      `increaseItemCount-${userUuid}`,
    );
  };

  if (!tx) {
    await run(prisma);
  } else {
    await run(tx);
  }

  for (const itemId of Object.keys(countInfo) as AllGameResourceID[]) {
    const count = countInfo[itemId]!.count;
    if (itemId == "gold" && count) {
      await addPlayerGoldStats({
        userUuid: userUuid,
        goldAmount: BigInt(count),
      });
    }
  }

  if (opt?.showModifyInfo) {
    await addItemIncreaseInfoToRedis(
      userUuid,
      countInfo,
      opt?.actionName ?? "增加物品",
      opt,
    );
  }

  if (opt?.sendModifyEvent) {
    dispatchInventoryModify(userUuid, countInfo);
  }
  // Invalidate cache after successful DB writes when not inside external tx
  if (!usedExternalTx) {
    try {
      await invalidateInventoryCache(userUuid);
    } catch (e) {
      console.warn(
        `[child/inventory] Redis unavailable when invalidating inventory cache for ${userUuid}: ${e}`,
      );
    }
  }
};

export const decreaseItemCount = async (
  userUuid: string,
  countInfo: ItemCountInfo,
  opt?: ModifyItemCountOption,
  tx?: PrismaTx,
): Promise<ItemCountInfo> => {
  // 过滤掉数量为0或小于0的资源
  const filteredCountInfo: ItemCountInfo = {};
  for (const key of Object.keys(countInfo) as AllGameResourceID[]) {
    if (countInfo[key] && countInfo[key]!.count > 0) {
      filteredCountInfo[key] = countInfo[key]!;
    }
  }
  if (!Object.keys(filteredCountInfo).length) {
    return {};
  }

  const usedExternalTx = Boolean(tx);
  if (!tx) {
    tx = prisma;
  }

  const allItemIdList = Object.keys(filteredCountInfo) as AllGameResourceID[];

  let modifyInfo: ItemCountInfo = {};
  for(const itemId of allItemIdList) {
    let reducedCount = filteredCountInfo[itemId]!.count;
    modifyInfo[itemId] = { count: reducedCount };
  }

  const run = async (pTx: PrismaTx) => {
    const values = allItemIdList
      .filter((itemId) => (modifyInfo[itemId]?.count ?? 0) !== 0)
      .map((itemId) => {
        const delta = modifyInfo[itemId]!.count;
        return Prisma.sql`(${userUuid}, ${itemId}, ${delta}, NOW(), ${userUuid})`;
      });

    if (values.length === 0) return;

    await dbExecuteWithRetry(
      async () => {
        try {
          const query = Prisma.sql`
          INSERT INTO \`CharacterNewInventory\` (\`character_uuid\`, \`item_id\`, \`count\`, \`updated_at\`, \`user_uuid\`)
          VALUES ${Prisma.join(values)}
          ON DUPLICATE KEY UPDATE
            \`count\` = \`count\` - VALUES(\`count\`),
            \`updated_at\` = NOW()
        `;

          // 执行批量写入
          await pTx.$executeRaw(query);
        } catch (e) {
            console.error(`[decreaseItemCount] Failed to decrease item count for user ${userUuid}: ${e}`);
            throw e;
        }
      },
      `decreaseItemCount-${userUuid}`,
    );
  };

  if (!usedExternalTx) {
    await run(prisma);
  } else {
    await run(tx);
  }

  for (const itemId of allItemIdList) {
    let reducedCount = filteredCountInfo[itemId]!.count;

    if (itemId == "gold" && reducedCount) {
      await decreasePlayerGoldStats({
        userUuid: userUuid,
        goldAmount: BigInt(reducedCount),
      });
    }
  }

  // 检查数量并批量 update

  // 只查变动物品，合并到缓存
  // const redisKey = getInventoryRedisKey(userUuid);
  // let cache: CharacterInventory = {};
  // const cacheStr = await redisClient.get(redisKey);
  // if (cacheStr) {
  //     try { cache = JSON.parse(cacheStr); } catch {}
  // }
  // allItemIdList.forEach(itemId => {
  //     const prev = cache[itemId]?.count ?? 0;
  //     const old = itemMap.get(itemId);
  //     const newCount = old ? Number(old.count) - filteredCountInfo[itemId]!.count : 0;
  //     cache[itemId] = { count: Math.max(newCount, 0) };
  // });
  // await redisClient.set(redisKey, JSON.stringify(cache), { expiration: { type: 'EX', value: 3600 } });

  if (opt?.showModifyInfo) {
    await addItemDecreaseInfoToRedis(
      userUuid,
      filteredCountInfo,
      opt?.actionName ?? "减少物品",
      opt,
    );
  }

  if (opt?.sendModifyEvent) {
    dispatchInventoryModify(
      userUuid,
      convertItemCountInfoToDecrease(countInfo),
    );
  }

  // Invalidate cache after successful DB writes when not inside external tx
  if (!usedExternalTx) {
    try {
      await invalidateInventoryCache(userUuid);
    } catch (e) {
      console.warn(
        `[child/inventory] Redis unavailable when invalidating inventory cache for ${userUuid}: ${e}`,
      );
    }
  }

  return modifyInfo;
};

export async function checkResourceRequirementInDB(userUuid: string, resourceRequirement: ResourceRequirement[], tx?: PrismaTx): Promise<boolean> {
    if (!tx) {
        tx = prisma;
    }

    // 并行查询所有资源
    const itemCheckPromises = resourceRequirement.map(async (req) => {
        const itemInfo = await getItemInfo(userUuid, req.id as AllGameResourceID, tx);
        return {
            resourceId: req.id,
            required: req.count,
            available: itemInfo.count,
            sufficient: itemInfo.count >= req.count
        };
    });

    const checkResults = await Promise.all(itemCheckPromises);
    
    // 检查是否所有资源都满足要求
    return checkResults.every(result => result.sufficient);
}


export const dispatchInventoryModify = (userUuid: string, itemCountInfo: ItemCountInfo) => {
    emitEventToUser(userUuid, "inventoryModify", itemCountInfo);
}