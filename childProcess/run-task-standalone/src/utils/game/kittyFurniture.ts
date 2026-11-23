import { allKittyFurniture, type AllKittyFurnitureID } from "~/shared/data/allKittyFurniture";
import { type UserKittyFurnitureInstance } from "~/shared/types/kittyFurniture";
import { prisma } from "../prisma";
import { redisClient } from "../redis"
import { convertReseourceRequirementToItemModify } from "~/shared/utils/game/requirementCheck";
import { checkResourceRequirementInDB, decreaseItemCount } from "./characterInventory";
import { ModifyItemCountType, type ItemCountInfo } from "~/shared/types/gameInventory";

const REDIS_USER_FURNITURE_KEY = (userUuid: string) => `furniture:user:${userUuid}`;
const REDIS_FURNITURE_BY_TYPE_KEY = (userUuid: string, furnitureId: string) => `furniture:user:${userUuid}:type:${furnitureId}`;
const REDIS_FURNITURE_BY_UUID_KEY = (furnitureUuid: string) => `furniture:uuid:${furnitureUuid}`;
const REDIS_ACTIVE_FURNITURE_KEY = (furnitureId: string) => `furniture:active:${furnitureId}`;

const CACHE_EXPIRE_TIME = 600; // 10分钟

/**
 * 获取用户的所有家具（带Redis缓存）
 */
export async function getUserAllFurniture(userUuid: string): Promise<UserKittyFurnitureInstance[]> {
  // 先查redis
  const cacheKey = REDIS_USER_FURNITURE_KEY(userUuid);
  const cache = await redisClient.get(cacheKey);
  if (cache) {
    try {
      return JSON.parse(cache);
    } catch {
      // ignore parse error, fallback to db
    }
  }

  const furniture = await prisma.userKittyFurniture.findMany({
    where: { user_uuid: userUuid },
    orderBy: { installed_at: 'desc' }
  });

  const result = furniture.map(f => ({
    id: f.id,
    uuid: f.uuid,
    userUuid: f.user_uuid,
    furnitureId: f.furniture_id,
    level: f.level,
    durability: f.durability,
    isActive: f.is_active,
    installedAt: f.installed_at,
    updatedAt: f.updated_at,
    config: f.config ? JSON.parse(f.config) : null
  }));

  // 写入redis缓存
  await redisClient.set(cacheKey, JSON.stringify(result), {
    expiration: {
      type: "EX",
      value: CACHE_EXPIRE_TIME,
    }
  });

  return result;
}

/**
 * 获取用户指定类型的家具（带Redis缓存）
 */
export async function getUserFurnitureByType(userUuid: string, furnitureId: AllKittyFurnitureID): Promise<UserKittyFurnitureInstance | null> {
  // 先查redis
  const cacheKey = REDIS_FURNITURE_BY_TYPE_KEY(userUuid, furnitureId);
  const cache = await redisClient.get(cacheKey);
  if (cache) {
    try {
      const parsed = JSON.parse(cache);
      return parsed === null ? null : parsed;
    } catch {
      // ignore parse error, fallback to db
    }
  }

  const furniture = await prisma.userKittyFurniture.findUnique({
    where: {
      user_furniture_id: {
        user_uuid: userUuid,
        furniture_id: furnitureId
      }
    }
  });

  const result = furniture ? {
    id: furniture.id,
    uuid: furniture.uuid,
    userUuid: furniture.user_uuid,
    furnitureId: furniture.furniture_id,
    level: furniture.level,
    durability: furniture.durability,
    isActive: furniture.is_active,
    installedAt: furniture.installed_at,
    updatedAt: furniture.updated_at,
    config: furniture.config ? JSON.parse(furniture.config) : null
  } : null;

  // 写入redis缓存
  await redisClient.set(cacheKey, JSON.stringify(result), {
    expiration: {
      type: "EX",
      value: CACHE_EXPIRE_TIME,
    }
  });

  return result;
}

/**
 * 获取激活的指定类型家具（带Redis缓存）
 */
export async function getActiveFurnitureByType(furnitureId: AllKittyFurnitureID): Promise<UserKittyFurnitureInstance[]> {
  // 先查redis
  const cacheKey = REDIS_ACTIVE_FURNITURE_KEY(furnitureId);
  const cache = await redisClient.get(cacheKey);
  if (cache) {
    try {
      return JSON.parse(cache);
    } catch {
      // ignore parse error, fallback to db
    }
  }

  const furniture = await prisma.userKittyFurniture.findMany({
    where: {
      furniture_id: furnitureId,
      is_active: true,
      durability: { gt: 0 }
    }
  });

  const result = furniture.map(f => ({
    id: f.id,
    uuid: f.uuid,
    userUuid: f.user_uuid,
    furnitureId: f.furniture_id,
    level: f.level,
    durability: f.durability,
    isActive: f.is_active,
    installedAt: f.installed_at,
    updatedAt: f.updated_at,
    config: f.config ? JSON.parse(f.config) : null
  }));

  // 写入redis缓存，激活家具缓存时间稍短
  await redisClient.set(cacheKey, JSON.stringify(result), {
    expiration: {
      type: "EX",
      value: 300, // 5分钟
    }
  });

  return result;
}

/**
 * 更新家具耐久度（在定时任务中调用）
 */
export async function decreaseFurnitureDurability(
  userUuid: string, 
  furnitureId: AllKittyFurnitureID, 
  amount: number
): Promise<void> {
  const activeFurniture = await prisma.userKittyFurniture.findUnique({
    where: {
      is_active: true,
      durability: { gt: 0 },
      user_furniture_id: {
        user_uuid: userUuid,
        furniture_id: furnitureId
      }
    }
  });

  if (!activeFurniture) return;

  const durabilityLoss = amount ?? (Math.random() * 0.2 + 0.1);
  const newDurability = Math.max(0, activeFurniture.durability - durabilityLoss);
    
  await prisma.userKittyFurniture.update({
    where: { uuid: activeFurniture.uuid },
    data: {
      durability: +newDurability.toFixed(2),
      is_active: newDurability > 0 ? activeFurniture.is_active : false, // 耐久度为0时自动停用
      updated_at: new Date()
    }
  });

  // 清除相关缓存
  await invalidateUserFurnitureCache(userUuid, furnitureId);
}

/**
 * 清除用户家具相关缓存
 */
async function invalidateUserFurnitureCache(userUuid: string, furnitureId?: string): Promise<void> {
  const cacheKeys = [
    REDIS_USER_FURNITURE_KEY(userUuid)
  ];

  if (furnitureId) {
    cacheKeys.push(REDIS_FURNITURE_BY_TYPE_KEY(userUuid, furnitureId));
    cacheKeys.push(REDIS_ACTIVE_FURNITURE_KEY(furnitureId));
  } else {
    // 清除所有类型缓存
    const furnitureTypes = Object.keys(allKittyFurniture);
    furnitureTypes.forEach(type => {
      cacheKeys.push(REDIS_FURNITURE_BY_TYPE_KEY(userUuid, type));
      cacheKeys.push(REDIS_ACTIVE_FURNITURE_KEY(type));
    });
  }

  await Promise.all(cacheKeys.map(key => redisClient.del(key)));
}

export async function canRepairFurniture(userUuid: string, furnitureId: AllKittyFurnitureID): Promise<boolean> {
  const config = allKittyFurniture[furnitureId];
  if (!config) {
    throw new Error("家具配置不存在");
  }

  const furniture = await getUserFurnitureByType(userUuid, furnitureId);

  if (!furniture) {
    throw new Error("家具不存在");
  }

  if (furniture.durability >= 100) {
    throw new Error("家具状态良好，无需修理");
  }

  if (!config.repairRequirement?.length) {
    throw new Error("该家具无法修理");
  }

  
  let passCheck = await checkResourceRequirementInDB(userUuid, config.repairRequirement[0].resource ?? []);

  if (!passCheck) {
    throw new Error("修理材料不足");
  }

  return true;
}

/**
 * 修理家具
 */
export async function repairFurniture(userUuid: string, furnitureId: AllKittyFurnitureID, reason?: string): Promise<ItemCountInfo> {
  const canRepair = await canRepairFurniture(userUuid, furnitureId);

  if (!canRepair) {
    throw new Error("修理条件不满足");
  }

  const config = allKittyFurniture[furnitureId];
  if (!config) {
    throw new Error("家具配置不存在");
  }

  try {
    let repairCost = convertReseourceRequirementToItemModify(config.repairRequirement[0].resource ?? []);
    await decreaseItemCount(userUuid, repairCost, {
        actionName: `${reason ?? '修理家具'}: ${config.name}`,
        showModifyInfo: true,
        type: ModifyItemCountType.Kitty
    });

    // 修理家具（恢复到100%耐久度）
    await prisma.userKittyFurniture.update({
      where: { 
        user_furniture_id: {
            user_uuid: userUuid,
            furniture_id: furnitureId
        }
      },
      data: {
        durability: 100,
        is_active: true,
        updated_at: new Date()
      }
    });

    // 清除相关缓存
    await invalidateUserFurnitureCache(userUuid, furnitureId);
    await redisClient.del(REDIS_FURNITURE_BY_UUID_KEY(furnitureId));

    return repairCost;
  } catch (error) {
    if (error instanceof Error && error.message.includes('物品数量不足')) {
      throw error;
    }
    throw new Error("修理失败，请重试");
  }
}