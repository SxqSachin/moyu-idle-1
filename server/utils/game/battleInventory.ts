import { prisma } from "./db"
import type { UnitBattleInventoryInfo } from "~/shared/types/unit"
import type { AllGameResourceID } from "~/shared/types/gameResource"
import { decreaseItemCount, getItemInfo, increaseItemCount } from "./characterInventory"
import { ModifyItemCountType } from "~/shared/types/gameInventory"
import { safeJsonParse } from "~/shared/utils"
import { GameBattleLogic, GameFullBattleLogic } from "~/shared/types/skill"
import { allGameResource } from "~/shared/data/allGameResources"
import { AllBattlePhase } from "~/shared/types/battle"

// 获取角色的全部战斗背包物品（原始数据库对象数组）
export const getBattleInventory = async (characterUuid: string) => {
    return await prisma.characterBattleInventoryInfo.findMany({
        where: { characterUuid }
    })
}

// 获取角色的全部战斗背包物品，返回 UnitBattleInventoryInfo 格式
export const getBattleInventoryAsUnitInfo = async (characterUuid: string): Promise<UnitBattleInventoryInfo> => {
    const items = await getBattleInventory(characterUuid);

    const result: UnitBattleInventoryInfo = {}
    for (const item of items) {
        if (item.resourceId) {
            result[item.resourceId as AllGameResourceID] = {
                prepareCount: item.resourcePrepareCount ?? 0,
                remainingCount: item.resourceRemainingCount ?? 0,
                ai: safeJsonParse<GameBattleLogic[]>(item.ai, []) ?? [],
                cooldown: 0,
                order: item.order,
                useWhen: item.useWhen ? item.useWhen.split(',') as AllBattlePhase[] : [], 
            }
        }
    }
    return result
}

// 获取角色某个物品的战斗背包信息
export const getBattleInventoryItem = async (characterUuid: string, resourceId: string) => {
    return await prisma.characterBattleInventoryInfo.findFirst({
        where: { characterUuid, resourceId }
    })
}

// 增加或更新角色战斗背包物品（有则更新，无则创建）
export const upsertBattleInventoryItem = async (
    characterUuid: string,
    resourceId: string,
    resourcePrepareCount: number
) => {
    let inventoryInfo = await getItemInfo(characterUuid, resourceId)

    if (!inventoryInfo || inventoryInfo.count < resourcePrepareCount) {
        throw new Error(`库存数量不足，库存数量：${inventoryInfo?.count ?? 0}，需要：${resourcePrepareCount}`);
    }
    // 检查数字是否合法
    if (resourcePrepareCount <= 0) {
        throw new Error(`准备数量必须大于0`);
    }
    // 检查是否为整数
    if (!Number.isInteger(resourcePrepareCount)) {
        throw new Error(`准备数量必须为整数`);
    }
    // 检查是否超大
    if (resourcePrepareCount > 100000) {
        throw new Error(`准备数量不能超过100000`);
    }

    const resource = allGameResource[resourceId as AllGameResourceID];
    if (!resource.inBattleEffect) {
      throw new Error('该物品不具有战斗中使用效果');
    }

    return prisma.$transaction(async (tx) => {

      // 检查已经装备的数量
      const alreadyEquippedCount = await tx.characterBattleInventoryInfo.count({
        where: { 
          characterUuid
         },
      });

      if (alreadyEquippedCount >= 5) {
        throw new Error(`战斗物品袋已满，最多只能携带5件物品`);
      }

      const exist = await tx.characterBattleInventoryInfo.findFirst({
        where: { characterUuid, resourceId },
      });
      if (exist) {
        let remainingRequireCount = exist.resourcePrepareCount - exist.resourceRemainingCount;
        if (remainingRequireCount <= 0) {
          throw new Error(`已经准备完毕，无需补充`);
        }

        await decreaseItemCount(
          characterUuid,
          {
            [resourceId]: {
              count: remainingRequireCount,
            },
          },
          {
            actionName: "添加到战斗物品袋",
            showModifyInfo: true,
            type: ModifyItemCountType.Other,
          },
          tx
        );
        await invalidateInventoryCache(characterUuid);
        await tx.characterBattleInventoryInfo.update({
          where: { id: exist.id },
          data: { 
            resourceRemainingCount: exist.resourceRemainingCount + remainingRequireCount,
          },
        });
      } else {
        await decreaseItemCount(
          characterUuid,
          {
            [resourceId]: {
              count: resourcePrepareCount,
            },
          },
          {
            actionName: "添加到战斗物品袋",
            showModifyInfo: true,
            type: ModifyItemCountType.Other,
          },
          tx
        );
        await invalidateInventoryCache(characterUuid);

         await tx.characterBattleInventoryInfo.create({
          data: {
            userUuid: characterUuid,
            characterUuid,
            resourceId,
            resourcePrepareCount,
            resourceRemainingCount: resourcePrepareCount, // 初始数量等于准备数量
          },
        });
      }
    });
}

export const refillBattleInventoryItem = async (
  characterUuid: string,
  resourceId: string,
  count: number
) => {
  let inventoryInfo = await getItemInfo(characterUuid, resourceId);

  if (!inventoryInfo || inventoryInfo.count <= 0) {
    throw new Error(
      `库存数量为空`
    );
  }

  const resource = allGameResource[resourceId as AllGameResourceID];
  if (!resource.inBattleEffect) {
    throw new Error('该物品不具有战斗中使用效果');
  }

  return prisma.$transaction(async (tx) => {
    const exist = await tx.characterBattleInventoryInfo.findFirst({
      where: { characterUuid, resourceId },
    });

    if (!exist) {
      throw new Error(`战斗物品袋中没有此物品`);
    }

    // 检查数字是否合法
    if (count <= 0) {
        throw new Error(`数量必须大于0`);
    }
    // 检查是否为整数
    if (!Number.isInteger(count)) {
        throw new Error(`数量必须为整数`);
    }
    // 检查是否超大
    if (count > 100000) {
        throw new Error(`数量不能超过100000`);
    }

    let remainingRequireCount =
      exist.resourcePrepareCount - exist.resourceRemainingCount;
    if (remainingRequireCount <= 0) {
      throw new Error(`已经准备完毕，无需补充`);
    }

    let fillCount = Math.min(remainingRequireCount, count, inventoryInfo.count);

    await decreaseItemCount(
      characterUuid,
      {
        [resourceId]: {
          count: fillCount,
        },
      },
      {
        actionName: "补充到战斗物品袋",
        showModifyInfo: true,
        type: ModifyItemCountType.Other,
      },
      tx
    );
    await invalidateInventoryCache(characterUuid);
    await tx.characterBattleInventoryInfo.update({
      where: { id: exist.id },
      data: {
        resourceRemainingCount: exist.resourceRemainingCount + fillCount,
      },
    });
  });
};

export const removeFromBattleInventoryItem = async (
  characterUuid: string,
  resourceId: string
) => {
  return prisma.$transaction(async (tx) => {
    const exist = await tx.characterBattleInventoryInfo.findFirst({
      where: { characterUuid, resourceId },
    });
    if (!exist) {
      throw new Error(`战斗物品袋中没有物品 ${resourceId}`);
    }

    let remainingeCount = exist.resourceRemainingCount;
    if (remainingeCount <= 0) {
      await tx.characterBattleInventoryInfo.delete({
        where: { id: exist.id }
      })
      return
    }

    await increaseItemCount(
      characterUuid,
      {
        [resourceId]: {
          count: remainingeCount,
        },
      },
      {
        actionName: "从战斗物品袋取回",
        showModifyInfo: true,
        type: ModifyItemCountType.Other,
      },
      tx
    );
    await invalidateInventoryCache(characterUuid);

    await tx.characterBattleInventoryInfo.delete({
        where: { id: exist.id }
    })
  });
};

export const updateBattleInventoryItemLogic = async (
  characterUuid: string,
  resourceId: string,
  ai: GameFullBattleLogic,
  useWhen?: AllBattlePhase[]
) => {
  if (!resourceId || !ai || !Array.isArray(ai)) {
    throw new Error(`物品ID或使用逻辑无效`);
  }

  const resource = allGameResource[resourceId as AllGameResourceID];
  if (!resource.inBattleEffect) {
    throw new Error('该物品不具有战斗中使用效果');
  }

  // validate useWhen if provided
  let sanitizedUseWhen: AllBattlePhase[] | null = null;
  if (useWhen !== undefined) {
    if (!Array.isArray(useWhen)) throw new Error('useWhen must be an array');
    const allowed = new Set<AllBattlePhase>([AllBattlePhase.BATTLE_START, AllBattlePhase.SELF_TURN_START]);
    sanitizedUseWhen = useWhen.filter((v) => typeof v === 'string' && allowed.has(v)).slice(0, 10);
  }

  return prisma.$transaction(async (tx) => {
    const exist = await tx.characterBattleInventoryInfo.findFirst({
      where: { characterUuid, resourceId },
    });
    if (!exist) {
      throw new Error(`战斗物品袋中没有物品 ${resourceId}`);
    }

    await tx.characterBattleInventoryInfo.update({
      where: { id: exist.id },
      data: {
        ai: JSON.stringify(ai),
        useWhen: sanitizedUseWhen ? sanitizedUseWhen.join(',') : exist.useWhen,
      },
    });
  });
}

/**
 * 重新调整角色技能顺序
 * @param characterUuid 角色uuid
 * @param skillOrderList 技能id数组，按新顺序排列
 * @returns 更新后的所有技能信息
 */
export const reorderCharacterBattleInventory = async (
  characterUuid: string,
  orderList: string[]
) => {
  // 依次更新每个技能的 order 字段
  await Promise.all(
    orderList.map((itemId, idx) =>
      prisma.characterBattleInventoryInfo.updateMany({
        where: {
          userUuid: characterUuid,
          characterUuid: characterUuid,
          resourceId: itemId
        },
        data: {
          order: idx,
        },
      })
    )
  );
  // 返回最新顺序的技能
  const items = await prisma.characterBattleInventoryInfo.findMany({
    where: { characterUuid: characterUuid },
    orderBy: { order: "asc" },
  });
  const result: UnitBattleInventoryInfo = {}
  for (const item of items) {
    if (item.resourceId) {
      result[item.resourceId as AllGameResourceID] = {
        prepareCount: item.resourcePrepareCount ?? 0,
        remainingCount: item.resourceRemainingCount ?? 0,
        ai: safeJsonParse<GameBattleLogic[]>(item.ai, []) ?? [],
        cooldown: 0,
        order: item.order,
      };
    }
  }

  return result
};

/* updateBattleInventoryItemUseWhen removed; use updateBattleInventoryItemLogic for atomic updates */