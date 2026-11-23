import allTalentCat from "~/shared/data/allTalentCat";
import { memoryCache } from "../memoryCache";
import { prisma } from "../prisma";
import { redisClient } from "../redis";
import { v4 } from "uuid";
import { CATTY_EXPERT_MIN_HIRE_HOUR } from "~/shared/data/constant";
import { ModifyItemCountType, type ItemCountInfo } from "~/shared/types/gameInventory";
import { decreaseItemCount, getInventoryInfoPreferCache } from "./characterInventory";
import type { Tavern } from "~/generated/prisma";

import { publishGameBroadcast } from "./broadcastHub"
import { GameBroadcastKind, type UserTalentCatUpdateMessage } from "~/shared/types/broadcast";

const REDIS_TAVERN_KEY = (owner: string) => `tavern:experts:${owner}`;

/**
 * 招募猫咪专家
 * @param owner 用户uuid
 * @param catId 猫咪专家id
 * @param hours 招募小时数
 * @returns 招募记录
 */
export async function recruitTalentCat(
  owner: string,
  catId: string,
  hours: number,
) {
  const cat = allTalentCat.find(c => c.id === catId);
  if (!cat) throw new Error("猫咪专家不存在");

  if (hours < CATTY_EXPERT_MIN_HIRE_HOUR) {
    throw new Error(`招募时间不能少于${CATTY_EXPERT_MIN_HIRE_HOUR}小时`);
  }

  const hourlyWage = cat.hourlyWage;
  if (!hourlyWage) throw new Error("该专家没有设置时薪");

  const inventoryInfo = await getInventoryInfoPreferCache(owner);

  const totalItemModify: ItemCountInfo = {};
  for (const wage of hourlyWage) {
    if (wage.count * hours <= 0) {
      throw new Error(`时薪设置错误: ${wage.resourceId}`);
    } else {
      const paycount = wage.count * hours;
      if ((inventoryInfo[wage.resourceId]?.count ?? 0) < paycount) {
        throw new Error(`物品不足: ${wage.resourceId}，需要 ${paycount}，但只有 ${inventoryInfo[wage.resourceId]?.count ?? 0}`);
      }
      if (!totalItemModify[wage.resourceId]) {
        totalItemModify[wage.resourceId] = { count: 0 };
      }
      totalItemModify[wage.resourceId]!.count = paycount;
    }
  }

  await decreaseItemCount(owner, totalItemModify, {
    actionName: `招募 ${cat.name}`,
    showModifyInfo: true,
    type: ModifyItemCountType.Other
  });

  // 生成招募记录
  const now = new Date();
  const end = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const uuid = v4();
  const record = await prisma.tavern.create({
    data: {
      uuid,
      owner,
      start_date: now,
      end_date: end,
      type: catId,
      level: 1,
      state: "WORKING",
    },
  });

  // 写入redis缓存（更新缓存）
  await updateTalentCatCache(owner);

  await publishGameBroadcast<UserTalentCatUpdateMessage>({
    kind: GameBroadcastKind.USER_TALENT_CAT_UPDATED,
    userUuid: owner
  })

  return record;
}

/**
 * 查询用户当前招募的所有猫咪专家（带redis缓存）
 * @param owner 用户uuid
 */

export async function getMultiUserTalentCats(owners: string[]): Promise<Map<string, Tavern[]>> {
  const result = new Map<string, Tavern[]>();
  if (!owners.length) return result;

  // 1. 批量查 Redis
  const cacheKeys = owners.map(REDIS_TAVERN_KEY);
  let cacheResults: (string | null)[] = [];
  try {
    cacheResults = await redisClient.mGet(cacheKeys);
  } catch (error) {
    console.error('getMultiUserTalentCats: Redis mGet error:', error);
    // 如果Redis出错，直接查数据库
    cacheResults = new Array(owners.length).fill(null);
  }

  const missedOwners: string[] = [];
  owners.forEach((owner, idx) => {
    const cache = cacheResults[idx];
    if (cache) {
      try {
        result.set(owner, JSON.parse(cache));
      } catch {
        missedOwners.push(owner);
      }
    } else {
      missedOwners.push(owner);
    }
  });

  // 2. 批量查数据库
  if (missedOwners.length) {
    const now = new Date();
    const dbRecords = await prisma.tavern.findMany({
      where: {
        owner: { in: missedOwners },
        OR: [
          {
            state: "WORKING",
          },
          {
            state: "PAUSED",
          }
        ],
      },
    });
    // 按 owner 分组
    const group: Record<string, Tavern[]> = {};
    for (const rec of dbRecords) {
      if (!group[rec.owner]) group[rec.owner] = [];
      group[rec.owner].push(rec);
    }
    // 批量写入缓存
    await Promise.all(
      Object.entries(group).map(([owner, taverns]) =>
        redisClient.set(REDIS_TAVERN_KEY(owner), JSON.stringify(taverns), {
          expiration: { type: "EX", value: 3600 }
        })
      )
    );
    // 合并结果
    Object.entries(group).forEach(([owner, taverns]) => {
      result.set(owner, taverns);
    });
    // 没查到的也要返回空数组
    missedOwners.forEach(owner => {
      if (!group[owner]) result.set(owner, []);
    });
  }

  return result;
}

export async function getUserTalentCats(owner: string): Promise<Tavern[]> {
  // 先查redis
  const cacheKey = REDIS_TAVERN_KEY(owner);
  const cache = await redisClient.get(cacheKey);
  if (cache) {
    try {
      return JSON.parse(cache);
    } catch {
      // ignore parse error, fallback to db
    }
  }

  const now = new Date();
  const records = await prisma.tavern.findMany({
    where: {
      owner,
      OR: [
        {
          // end_date: { gt: now },
          state: 'WORKING'
        },
        {
          state: 'PAUSED'
        }
      ]
    },
    orderBy: {
      id: "desc"
    }
  });

  // 写入redis缓存，设置过期时间（比如60秒）
  await redisClient.set(cacheKey, JSON.stringify(records), {
    expiration: {
        type: "EX",
        value: 600, // 缓存60秒
    }
  })

  return records;
}
export async function getUserWorkingTalentCats(owner: string): Promise<Tavern[]> {
  // 短TTL缓存（60秒），避免高并发下重复读取
  const TAVERN_CATS_CACHE_TTL_MS = 60000;
  const cacheKey = `tavern:working:${owner}`;
  const cached = memoryCache.get<Tavern[]>(cacheKey);
  if (cached) return cached;
  const allTalentCats = await getUserTalentCats(owner);
  const working = allTalentCats.filter(cat => cat.state === "WORKING");
  memoryCache.set<Tavern[]>(cacheKey, working, TAVERN_CATS_CACHE_TTL_MS);
  return working;
}

/**
 * 更新redis缓存（用于写入后同步缓存）
 */
export async function updateTalentCatCache(owner: string) {
  const now = new Date();
  const records = await prisma.tavern.findMany({
    where: {
      owner,
      OR: [
        {
          // end_date: { gt: now },
          state: "WORKING",
        },
        {
          state: "PAUSED",
        }
      ],
    },
  });

  const cacheKey = REDIS_TAVERN_KEY(owner);
  await redisClient.set(cacheKey, JSON.stringify(records), {
    expiration: {
        type: "EX",
        value: 3600, // 缓存60秒
    }
  })
}