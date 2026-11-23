import allTalentCat from "~/shared/data/allTalentCat";
import type { TalentCat } from "~/shared/types/talentCat";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import { prisma } from "./db";
import { v4 } from "uuid";
import { CATTY_EXPERT_MIN_HIRE_HOUR } from "~/shared/data/constant";
import { ItemCountInfo, ModifyItemCountType } from "~/shared/types/gameInventory";
import { decreaseItemCount, getInventoryInfoPreferCache } from "./characterInventory";
import { Tavern } from "~/generated/prisma";
import { GameBroadcastKind, UserTalentCatUpdateMessage } from "~/shared/types/broadcast";

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

  // 检查是否存在已暂停或正在工作的猫咪专家
  const existingCats = await getUserTalentCats(owner);
  const existingCat = existingCats.find(c => c.type === catId && (c.state === "WORKING" || c.state === "PAUSED"));
  if (existingCat) {
    throw new Error("已经有正在工作的或暂停的猫咪专家，无法重复招募");
  }

  let hourlyWage = cat.hourlyWage;
  if (cat.dynamicHourlyWage) {
    const characterStatus = await getCharacterStatusInfo(owner);
    hourlyWage = cat.dynamicHourlyWage(characterStatus);
  }
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

  try {
    await decreaseItemCount(owner, totalItemModify, {
      actionName: `招募 ${cat.name}`,
      showModifyInfo: true,
      type: ModifyItemCountType.Other
    });
  } catch (e: any) {
    // 捕获库存不足等异常，返回友好提示
    throw new Error(e?.message || "扣除物品失败，请重试");
  }

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
  });

  return record;
}

/**
 * 续约猫咪专家
 * @param owner 用户uuid
 * @param catId 猫咪专家id
 * @param hours 续约小时数（额外增加的时间）
 * @returns 续约后的招募记录
 */
export async function renewTalentCat(
  owner: string,
  catId: string,
  hours: number,
) {
  const cat = allTalentCat.find(c => c.id === catId);
  if (!cat) throw new Error("猫咪专家不存在");

  if (hours < CATTY_EXPERT_MIN_HIRE_HOUR) {
    throw new Error(`续约时间不能少于${CATTY_EXPERT_MIN_HIRE_HOUR}小时`);
  }

  // 检查当前猫猫是否存在
  const existingCats = await getUserTalentCats(owner);
  const existingCat = existingCats.find(c => c.type === catId && c.state === "WORKING");
  if (!existingCat) {
    throw new Error("没有正在工作的猫咪专家，无法续约");
  }

  const pausedCat = existingCats.find(c => c.type === catId && c.state === "PAUSED");
  if (pausedCat) {
    throw new Error("存在暂停状态的猫咪专家，无法续约， 如有问题请联系管理员处理");
  }

  const characterStatus = await getCharacterStatusInfo(owner);
  let hourlyWage = cat.hourlyWage;
  if (cat.dynamicHourlyWage) {
    hourlyWage = cat.dynamicHourlyWage(characterStatus);
  }
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

  if (cat.dynamicMaxHireHour) {
    const maxHireHour = cat.dynamicMaxHireHour(characterStatus);
    if (maxHireHour > 0) {
      const currentRecord = existingCats.find(c => c.type === catId && (c.state === "WORKING" || c.state == "PAUSED" ));
      if (currentRecord) {
        const now = new Date();
        const remainingHours = (new Date(currentRecord.end_date).getTime() - now.getTime()) / (60 * 60 * 1000);
        if (remainingHours + hours > maxHireHour) {
          throw new Error(`续约失败，当前专家最多只能续约到${maxHireHour}小时（当前${(remainingHours + hours).toFixed(0)}）`);
        }
      }
    }
  }

  // 查找当前正在工作的专家记录
  const now = new Date();
  const record = await prisma.tavern.findFirst({
    where: {
      owner,
      type: catId,
      end_date: { gt: now },
      state: "WORKING",
    },
    orderBy: { end_date: "desc" },
  });

  if (!record) {
    throw new Error("没有可续约的专家记录");
  }

  try {
    await decreaseItemCount(owner, totalItemModify, {
      actionName: `续约 ${cat.name}`,
      showModifyInfo: true,
      type: ModifyItemCountType.Other
    });
  } catch (e: any) {
    // 捕获库存不足等异常，返回友好提示
    throw new Error(e?.message || "扣除物品失败，请重试");
  }

  // 更新 end_date
  const newEndDate = new Date(new Date(record.end_date).getTime() + hours * 60 * 60 * 1000);

  const updatedRecord = await prisma.tavern.update({
    where: { uuid: record.uuid },
    data: { end_date: newEndDate },
  });

  // 更新redis缓存
  await updateTalentCatCache(owner);

  await publishGameBroadcast<UserTalentCatUpdateMessage>({
    kind: GameBroadcastKind.USER_TALENT_CAT_UPDATED,
    userUuid: owner
  });

  return updatedRecord;
}
// ...existing code...


/**
 * 查询用户当前招募的所有猫咪专家（带redis缓存）
 * @param owner 用户uuid
 */
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
  let allTalentCats = await getUserTalentCats(owner);
  return allTalentCats.filter(cat => cat.state === "WORKING");
}

/**
 * 更新redis缓存（用于写入后同步缓存）
 */
async function updateTalentCatCache(owner: string) {
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
        value: 600, // 缓存60秒
    }
  })
}

export async function pauseTalentCat(
  owner: string,
  catId: string,
) {
  const cat = allTalentCat.find(c => c.id === catId);
  if (!cat) throw new Error("猫咪专家不存在");

  // 查找当前正在工作的专家记录
  const now = new Date();
  const record = await prisma.tavern.findFirst({
    where: {
      owner,
      type: catId,
      end_date: { gt: now },
      state: "WORKING",
    },
    orderBy: { end_date: "desc" },
  });

  if (!record) {
    throw new Error("没有正在工作的专家可以暂停");
  }

  if (record.state === "PAUSED") {
    throw new Error("专家已经暂停，无法重复暂停");
  }

  // 更新记录状态为暂停，并记录暂停时间
  const updatedRecord = await prisma.tavern.update({
    where: { uuid: record.uuid },
    data: { 
      state: "PAUSED",
      pause_date: now
    },
  });

  // 更新redis缓存
  await updateTalentCatCache(owner);

  await publishGameBroadcast<UserTalentCatUpdateMessage>({
    kind: GameBroadcastKind.USER_TALENT_CAT_UPDATED,
    userUuid: owner
  });

  return updatedRecord;
}

export async function resumeTalentCat(
  owner: string,
  catId: string,
) {
  const cat = allTalentCat.find(c => c.id === catId);
  if (!cat) throw new Error("猫咪专家不存在");

  // 查找当前暂停的专家记录
  const record = await prisma.tavern.findFirst({
    where: {
      owner,
      type: catId,
      state: "PAUSED",
    },
    orderBy: { pause_date: "desc" },
  });

  if (!record) {
    throw new Error("没有暂停的专家可以恢复");
  }

  if (!record.pause_date) {
    throw new Error("专家暂停时间记录异常");
  }

  const now = new Date();
  
  // 计算暂停时长（毫秒）
  const pauseDuration = now.getTime() - new Date(record.pause_date).getTime();
  
  // 在原有的end_date基础上补偿暂停时间
  const newEndDate = new Date(new Date(record.end_date).getTime() + pauseDuration);

  // 更新记录状态为工作中，清空暂停时间，延长结束时间
  const updatedRecord = await prisma.tavern.update({
    where: { uuid: record.uuid },
    data: { 
      state: "WORKING",
      pause_date: null,
      end_date: newEndDate
    },
  });

  // 更新redis缓存
  await updateTalentCatCache(owner);

  await publishGameBroadcast<UserTalentCatUpdateMessage>({
    kind: GameBroadcastKind.USER_TALENT_CAT_UPDATED,
    userUuid: owner
  })

  return updatedRecord;
}

export async function checkExpertExpired(userUuid: string) {
  const now = new Date();

  // 获取的时候过滤一遍已过期的数据
  const expired = await prisma.tavern.findMany({
    where: {
      owner: userUuid,
      end_date: { lte: now },
      state: "WORKING",
    },
    select: { uuid: true, owner: true },
  });

  if (expired.length > 0) {
    // 批量更新状态为 EXPIRED
    await prisma.tavern.updateMany({
      where: {
        uuid: { in: expired.map((e) => e.uuid) },
      },
      data: {
        state: "EXPIRED",
      },
    });

    await updateTalentCatCache(userUuid);

    await publishGameBroadcast<UserTalentCatUpdateMessage>({
      kind: GameBroadcastKind.USER_TALENT_CAT_UPDATED,
      userUuid: userUuid
    })
  }
}