import { prisma } from "../prisma"
import type { UnitBattleInventoryInfo } from "~/shared/types/unit"
import type { AllGameResourceID } from "~/shared/types/gameResource"
import { ModifyItemCountType } from "~/shared/types/gameInventory"
import { safeJsonParse } from "~/shared/utils"
import { decreaseItemCount, getItemInfo } from "./characterInventory"
import type { GameBattleLogic } from "~/shared/types/skill"
import type { AllBattlePhase } from "~/shared/types/battle"

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

export const useBattleInventoryItem = async (
    characterUuid: string,
    resourceId: AllGameResourceID,
    count: number
): Promise<boolean> => {
    const item = await getBattleInventoryItem(characterUuid, resourceId);
    if (!item) {
        // throw new Error(`Item ${resourceId} not found in battle inventory for character ${characterUuid}`);
        return false;
    }

    // 检查剩余数量是否足够
    if (item.resourceRemainingCount < count) {
        // throw new Error(`Not enough items: ${item.resourceRemainingCount} available, ${count} requested`);
        return false;
    }

    await prisma.characterBattleInventoryInfo.update({
        where: { id: item.id },
        data: {
            resourceRemainingCount: item.resourceRemainingCount - count,
        }
    })

    return true;
}