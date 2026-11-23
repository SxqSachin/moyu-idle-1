import { GameUserUniqueFlag } from "~/shared/types/gameEffect";
import { prisma } from "./db";
import { safeJsonParse } from "~/shared/utils";
import { Prisma, PrismaClient } from "~/generated/prisma";
import { DefaultArgs } from "@prisma/client/runtime/library";
import { PrismaTx } from "~/shared/types/socket/db";

/**
 * Redis 缓存 key 生成
 */
function getFlagCacheKey(userUuid: string, flagType: string, flagKey: string) {
  return `uniqueFlag:${userUuid}:${flagType}:${flagKey}`;
}
function getAllFlagCacheKey(userUuid: string) {
  return `uniqueFlagAll:${userUuid}`;
}

/**
 * 设置玩家唯一标记（拥有/取消拥有），并更新缓存和全部缓存
 */
export async function setUserUniqueFlag(userUuid: string, flagType: string, flagKey: string, owned: boolean, tx?: Omit<PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">): Promise<void> {
  if (!tx) {
    tx = prisma
  }

  await prisma.userUniqueFlag.upsert({
    where: { user_flag_unique: { userUuid, flagType, flagKey } },
    update: { owned },
    create: { userUuid, flagType, flagKey, owned }
  });
  const cacheKey = getFlagCacheKey(userUuid, flagType, flagKey);
  await redisClient.set(cacheKey, owned ? "1" : "0", {
    expiration: {
      type: "EX",
      value: 3600
    }
  });
  // 重建全部缓存
  await rebuildAllUserUniqueFlagCache(userUuid);
}


/**
 * 查询玩家所有 uniqueFlag（带缓存，返回所有拥有的标记列表）
 */
export async function getAllUserUniqueFlags(userUuid: string, tx?: PrismaTx): Promise<GameUserUniqueFlag[]> {
  if (!tx) {
    tx = prisma;
  }

  const cacheKey = getAllFlagCacheKey(userUuid);
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    try {
      let res = safeJsonParse(cached, []) as any[];

      return res.map(f => ({
        type: f.flagType as 'item' | 'title' | 'skin',
        key: f.flagKey
      }));
    } catch {
      // ignore parse error
    }
  }
  const flags = await tx.userUniqueFlag.findMany({
    where: { userUuid, owned: true },
    select: { flagType: true, flagKey: true }
  });
  await redisClient.set(cacheKey, JSON.stringify(flags), {
    expiration: {
      type: "EX",
      value: 3600
    }
  });
  return flags.map(f => ({
    type: f.flagType as 'item' | 'title' | 'skin',
    key: f.flagKey
  }));
}

/**
 * 重建玩家所有 uniqueFlag 的全部缓存
 */
async function rebuildAllUserUniqueFlagCache(userUuid: string) {
  const cacheKey = getAllFlagCacheKey(userUuid);
  const flags = await prisma.userUniqueFlag.findMany({
    where: { userUuid, owned: true },
    select: { flagType: true, flagKey: true }
  });
  await redisClient.set(cacheKey, JSON.stringify(flags), {
    expiration: {
      type: "EX",
      value: 3600
    }
  });
}