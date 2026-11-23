import { allGameAction } from "~/shared/data/allGameActions"
import { GameAction } from "~/shared/types/gameAction"
import { GameTask } from "~/shared/types/gameTask"
import { randomIntegerInFullCloseRange, randomNumberInFullColseRange } from "~/shared/utils"
import { decreaseItemCount, getInventoryInfo, increaseItemCount } from "./characterInventory"
import { BuildingRewardInfo, ItemCountInfo, ModifyItemCountType, RewardInfo, UsedResourceInfo } from "~/shared/types/gameInventory"
import { CharacterStatusInfo } from "~/shared/types/characterInfo"
import { getCharacterStatusInfo, increaseCharacterStatusExp } from "./characterStatus"
import { applyBuildingReward, getBuildingInfo } from "./building"
import { buildingRequirementCheck, resourceRequirementCheck, statusRequirementCheck } from "~/shared/utils/game/requirementCheck"
import { getActionResourceRequirement, getAllActionResourceRequirement } from "./character"

export const checkTaskRequirement = async (characterUuid: string, {actionId, hasDeductFirstTaskResource}: GameTask): Promise<boolean> => {
    const action: GameAction = allGameAction[actionId]

    if (!action?.requirement) {
        return true
    }

    const actionRequirement = action.requirement

    const characterActionResourceRequirement = await getAllActionResourceRequirement(characterUuid)
    const resourceRequirementCheckPass = resourceRequirementCheck(
        actionId,
        characterActionResourceRequirement,
        await getInventoryInfoPreferCache(characterUuid),
    ) 

    const characterStatusInfo = await getCharacterStatusInfo(characterUuid);
    const statusCheckPass = statusRequirementCheck(
        actionRequirement,
        characterStatusInfo
    )

    const buildingInfo = await getBuildingInfo(characterUuid)
    const buildingCheckPass = buildingRequirementCheck(
        actionRequirement,
        buildingInfo
    )

    return resourceRequirementCheckPass && statusCheckPass && buildingCheckPass
}

export const useTaskResourceRequirement = async (characterUuid: string, {actionId}: GameTask, isKitty: boolean = false): Promise<UsedResourceInfo | null> => {
    const action: GameAction = allGameAction[actionId]

    if (!action.requirement?.resource?.length) {
        return null
    }

    const usedResource: UsedResourceInfo = {}

    const actionRequirement = await getActionResourceRequirement(characterUuid, actionId)

    for(const require of actionRequirement) {
        if (isKitty && require.resourceId === "__satiety") {
            // 猫咪任务不使用饱食度
            continue
        }
        usedResource[require.resourceId] = {
            count: require.final
        }
    }

    await decreaseItemCount(characterUuid, usedResource, {
        actionName: `执行 ${action.name} 消耗资源`,
        showModifyInfo: true,
        type: ModifyItemCountType.ActionUse
    })

    return usedResource
}

export const returnTaskUsedResource = async (characterUuid: string, {actionId}: GameTask, isKitty: boolean = false): Promise<ItemCountInfo | null> =>
{
    const action: GameAction = allGameAction[actionId]

    if (!action.requirement?.resource) {
        return null
    }

    let usedResourceInfo: ItemCountInfo = {}

    const actionRequirement = await getActionResourceRequirement(characterUuid, actionId)

    for(const require of actionRequirement) {
        // 猫咪任务不返还饱食度
        if (isKitty && require.resourceId === "__satiety") {
            continue
        }
        usedResourceInfo[require.resourceId] = {
            count: require.final
        }
    }

    await increaseItemCount(characterUuid, usedResourceInfo, {
        actionName: `${isKitty ? '猫咪助手' : ''} 终止 ${action.name} 返还资源`,
        showModifyInfo: true,
        reason: `任务资源返还 - ${action.name}`,
        type: ModifyItemCountType.ActionUse,
        sendModifyEvent: true,
    })

    return usedResourceInfo
}

export const giveTaskReward = async (characterUuid: string, {actionId}: GameTask): 
    Promise<
    ({
        resourceReward: ItemCountInfo | null,
        buildingReward: BuildingRewardInfo | null
    }) 
    | null
    > => {
    const action: GameAction = allGameAction[actionId]

    let resourceRewardInfo: ItemCountInfo | null = null
    let buildingRewardInfo: BuildingRewardInfo | null = null

    for(const reward of (action?.rewards ?? [])) {
        // 资源奖励
        if (reward.id) {
            let count = 0
            if (reward.percent) {
                const perc = randomNumberInFullColseRange(0, 1)
                if (perc > reward.percent) {
                    continue
                }
            }

            if (reward.range) {
                count = randomIntegerInFullCloseRange(reward.range)
            } else {
                count = reward.count as number ?? 0
            }

            if (!count) {
                continue
            }

            if (!resourceRewardInfo) {
                resourceRewardInfo = {}
            }

            resourceRewardInfo[reward.id] = {
                count
            }
        }

        // 建筑奖励
        if (reward.buildingId) {
            if (!buildingRewardInfo) {
                buildingRewardInfo = {}
            }
            buildingRewardInfo[reward.buildingId] = {
                levelIncrease: 1
            }
        }
    }

    if (!resourceRewardInfo && !buildingRewardInfo) {
        return null
    }

    if (resourceRewardInfo) {
        await increaseItemCount(characterUuid, resourceRewardInfo, {
            actionName: `通过动作“${action.name}”获得`,
            showModifyInfo: true,
            type: ModifyItemCountType.ActionGain
        })
    }

    if (buildingRewardInfo) {
        await applyBuildingReward(characterUuid, buildingRewardInfo)
    }

    return {
        resourceReward: resourceRewardInfo,
        buildingReward: buildingRewardInfo
    }
}

export const giveTaskStatusImprove = async (characterUuid: string, {actionId}: GameTask): Promise<{
    oriCharacterStatusInfo: CharacterStatusInfo
    latestCharacterStatusInfo: CharacterStatusInfo
} | null> => {
    const action: GameAction = allGameAction[actionId]

    let improveInfo = action.characterImprove ?? []

    if (!improveInfo.length) {
        return null
    }

    const oriCharacterStatusInfo = await getCharacterStatusInfo(characterUuid)
    const latestCharacterStatusInfo = await increaseCharacterStatusExp(characterUuid, improveInfo)

    return {
      oriCharacterStatusInfo,
      latestCharacterStatusInfo,
    };
}