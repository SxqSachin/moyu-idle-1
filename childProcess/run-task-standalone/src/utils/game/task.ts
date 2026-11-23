import { allGameAction } from "~/shared/data/allGameActions"
import type { GameAction, GameActionReward } from "~/shared/types/gameAction"
import type { GameTask } from "~/shared/types/gameTask"
import { clone, ObjectKeysTyped, randomIntegerInFullCloseRange, randomNumberInFullColseRange, safeJsonParse } from "~/shared/utils"
import { decreaseItemCount, getInventoryInfoPreferCache, increaseItemCount } from "./characterInventory"
import { ModifyItemCountType, type BuildingRewardInfo, type ItemCountInfo, type ModifyItemCountOption, type UsedResourceInfo } from "~/shared/types/gameInventory"
import type { CharacterEquipmentInfo, CharacterStatusImprove, CharacterStatusInfo, PlayerState } from "~/shared/types/characterInfo"
import { getCharacterStatusInfo, increaseCharacterStatusExp } from "./characterStatus"
import { applyBuildingReward, getBuildingInfo } from "./building"
import { buildingRequirementCheck, resourceRequirementCheck, statusRequirementCheck } from "~/shared/utils/game/requirementCheck"
import { getActionResourceRequirement, getAllActionResourceRequirement } from "./character"
import allTalentCat from "~/shared/data/allTalentCat"
import { EXTRA_ACTION_REWARD_PERCENT_PER_LUCK } from "~/shared/data/constant"
import type { Tavern } from "~/generated/prisma"
import { getUserEquipment } from "./equipment"
import { allGameResource } from "~/shared/data/allGameResources"
import { isActionInclude, isStatusEqual } from "~/shared/utils/game/game"
import { allGlobalActionEffectState } from "~/shared/data/allBattleState"
import { iteratorWorkEquipment } from "~/shared/utils/game/equipment"
import type { LearnedSkillFlatItem } from "~/shared/types/skillTree"
import { allWorkSkillTreeNodesMap } from "~/shared/data/skillTrees"
import {enqueueToHarvestBox} from "./harvestBox" 
import type { BaseVillageBuildingInfo, CatVillageMonumentExtraData } from "~/shared/types/village/building"
import { allVillageBuilding } from "~/shared/data/allVillageBuilding"
import type { Kitty, KittyTraitRow } from "~/shared/types/kitty"
import allKittyTraits from "~/shared/data/kittyTraits"
import { modifyKittyMood } from "./kittyMood"
import type { BattleState } from "~/shared/types/BattleState"

export const checkTaskRequirement = async (characterUuid: string, {actionId}: GameTask): Promise<boolean> => {
    const action: GameAction = allGameAction[actionId]

    if (!action?.requirement) {
        return true
    }

    const actionRequirement = action.requirement

    // 并行获取所需数据
    const [
        characterActionResourceRequirement,
        inventoryInfo,
        characterStatusInfo,
        buildingInfo
    ] = await Promise.all([
        getAllActionResourceRequirement(characterUuid),
        getInventoryInfoPreferCache(characterUuid),
        getCharacterStatusInfo(characterUuid),
        getBuildingInfo(characterUuid)
    ]);

    const resourceRequirementCheckPass = resourceRequirementCheck(
        actionId,
        characterActionResourceRequirement,
        inventoryInfo,
    );

    const statusCheckPass = statusRequirementCheck(
        actionRequirement,
        characterStatusInfo
    );

    const buildingCheckPass = buildingRequirementCheck(
        actionRequirement,
        buildingInfo
    );

    return resourceRequirementCheckPass && statusCheckPass && buildingCheckPass;
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
        actionName: `${isKitty ? '猫咪助手' : '' } 执行 ${action.name} 消耗资源`,
        showModifyInfo: true,
        reason: `任务资源消耗 - ${action.name}`,
        type: ModifyItemCountType.ActionUse,
        sendModifyEvent: true,
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

export const extraReturnTaskUsedResource = async (characterUuid: string, {actionId}: GameTask, desc: string, percent: number = 1): Promise<ItemCountInfo | null> =>
{
    const action: GameAction = allGameAction[actionId]

    if (!action.requirement?.resource) {
        return null
    }

    let usedResourceInfo: ItemCountInfo = {}

    const actionRequirement = await getActionResourceRequirement(characterUuid, actionId)

    for(const require of actionRequirement) {
        if (require.resourceId === "__satiety") {
            continue
        }

        const count = Math.ceil(require.final * percent)

        if (!count) {
          continue;
        }

        usedResourceInfo[require.resourceId] = {
            count
        }
    }

    if (!ObjectKeysTyped(usedResourceInfo).length) {
      return null
    }

    await enqueueToHarvestBox(characterUuid, usedResourceInfo, {
      title: desc,
      source: "ActionDeductReturn",
      extra: {},
    });

    return usedResourceInfo
}

export const giveTaskReward = async (
  characterUuid: string,
  { actionId }: GameTask,
  opt: {
    experts: Tavern[];
    status: CharacterStatusInfo;
    modifyInfo?: ModifyItemCountOption;
    playerState?: PlayerState
    workEquipment?: CharacterEquipmentInfo,
    skillNodes?: LearnedSkillFlatItem[],
    villageBuildingInfo?: BaseVillageBuildingInfo[],

    kitty?: Kitty,
    kittyTraits?: KittyTraitRow[]
  }
): Promise<{
  resourceReward: ItemCountInfo | null;
  buildingReward: BuildingRewardInfo | null;
} | null> => {

  let { experts, status, modifyInfo, playerState, workEquipment, skillNodes, villageBuildingInfo, kitty, kittyTraits } = opt;

  if (!skillNodes) {
    skillNodes = []
  }

  const action: GameAction = clone(allGameAction[actionId]);

  if (!action) {
    return null;
  }

  const isDismentleAction = action?.id?.startsWith('dismantle_')

  let resourceRewardInfo: ItemCountInfo | null = null;
  let buildingRewardInfo: BuildingRewardInfo | null = null;

  let rawReward: Readonly<GameActionReward[]> = clone(action.rewards ?? []);
  let actualReward: Readonly<GameActionReward[]> = clone(action.rewards ?? []);
  let extraReward: Readonly<GameActionReward[]> = [];

  if (workEquipment) {
    iteratorWorkEquipment(workEquipment, ({ equipmentId, equipmentTrigger }) => {
      // 检查装备是否有有覆盖效果
      const overrideReward = equipmentTrigger?.overrideRewardOnActionFinish?.({ equipmentId, actionId }) ?? null
      if (overrideReward) {
        actualReward = overrideReward
      }

      // 检查额外奖励
      const extra = equipmentTrigger?.extraRewardOnActionFinish?.({ equipmentId, actionId }) ?? null
      if (extra) {
        extraReward = [...extraReward, ...extra]
      }
    })
  }

  actualReward = clone([...actualReward, ...extraReward])

  for (const expert of experts) {
    if (expert.state != "WORKING") continue;

    let expertInfo = allTalentCat.find(
      (cat) => cat.id === (expert.type as any)
    );

    if (!expertInfo) continue;

    expertInfo = clone(expertInfo);

    let expertActions = Object.keys(expertInfo?.actionOverride ?? {});

    if (clone(expertActions).includes(actionId)) {
      expertActions.forEach((pActionId) => {
        if (actionId == pActionId) {
          actualReward = clone([
            ...(actualReward ?? []),
            ...(expertInfo.actionOverride?.[actionId].rewards ?? []),
          ]);
        }
      });
    }
  }

  let playerStatus = status;
  let luck = playerStatus?.luck?.final ?? 1;


  for (const reward of actualReward) {
    let extraPercentFromLuck = (luck - 1) * EXTRA_ACTION_REWARD_PERCENT_PER_LUCK;

    if (reward.ignoreLuckFactor) {
      extraPercentFromLuck = 0;
    }

    // 资源奖励
    if (reward.id) {
      let count = 0;
      if (reward.percent) {
        let basePercent = reward.percent;
        let finalPercent = basePercent + basePercent * extraPercentFromLuck;

        const perc = randomNumberInFullColseRange(0, 1);

        if (perc > finalPercent) {
          continue;
        }
      }

      if (reward.range) {
        count = randomIntegerInFullCloseRange(reward.range);
      } else {
        count = (reward.count as number) ?? 0;
      }

      if (!count) {
        continue;
      }

      if (!resourceRewardInfo) {
        resourceRewardInfo = {};
      }

      const id = reward.id;
      if (!resourceRewardInfo[id]) {
        resourceRewardInfo[id] = { count: 0 };
      }
      resourceRewardInfo[id].count += count;
    }

    // 建筑奖励
    if (reward.buildingId) {
      if (!buildingRewardInfo) {
        buildingRewardInfo = {};
      }
      buildingRewardInfo[reward.buildingId] = {
        levelIncrease: 1,
      };
    }
  }

  if (!resourceRewardInfo && !buildingRewardInfo) {
    return null;
  }

  if (resourceRewardInfo) {
    await increaseItemCount(characterUuid, resourceRewardInfo, modifyInfo);

    if (!isDismentleAction) {
      for(const ade of playerState?.global?.actionEffect ?? []) {
        const state = allGlobalActionEffectState[ade.stateId] as BattleState;

        if (!state || !state.onCalcTaskDoneExtraRewardPercent) {
          continue;
        }

        let thisExtraRewardInfo = state.onCalcTaskDoneExtraRewardPercent({
          actionId,
        })

        if (!thisExtraRewardInfo) {
          continue;
        }

        if (randomNumberInFullColseRange(0, 1) < thisExtraRewardInfo.percent) {
          await increaseItemCount(characterUuid, resourceRewardInfo, {
            actionName: thisExtraRewardInfo.desc,
            type: ModifyItemCountType.ActionGain,
            showModifyInfo: true,
            sendModifyEvent: true,
          });
        }
      }
    }

    if (skillNodes.length && !isDismentleAction) {
      for(const {nodeId, level} of skillNodes) {
        const node = allWorkSkillTreeNodesMap[nodeId]
        if (typeof node?.businessEffects?.actionExtraRewardEffect != 'function') {
          continue;
        }

        const extraRewardEffects = node.businessEffects.actionExtraRewardEffect(level)

        for(const effect of extraRewardEffects) {
          const passActionCheck = [effect.actionId].some(effectActionId => isActionInclude(effectActionId, actionId))

          if (!passActionCheck) {
            continue;
          }

          if (randomNumberInFullColseRange(0, 1) < effect.modifyPercent) {
            await enqueueToHarvestBox(characterUuid, resourceRewardInfo, {
              title: effect.desc,
              source: "ActionExtraReward",
              extra: {},
            });
          }
        }
      }
    }

    if (villageBuildingInfo?.length && !isDismentleAction) {
      let catVillageMonument = villageBuildingInfo.find(building => building.type === 'catVillageMonument') 

      if (catVillageMonument && catVillageMonument.level > 0) {
        let effect = allVillageBuilding.catVillageMonument.effect(catVillageMonument.level);

        const extraData = safeJsonParse<CatVillageMonumentExtraData>(catVillageMonument.extra, {});

        if (extraData.consecrateUntil && new Date(extraData.consecrateUntil) > new Date()) {
            if (randomNumberInFullColseRange(0, 1) < effect.extraOutputPercent) {
              await enqueueToHarvestBox(characterUuid, resourceRewardInfo, {
                title: "猫猫镇纪念碑-祈福期间额外产出",
                source: "ActionExtraReward",
                extra: {},
              });
            }
        }
      }
    }

    if (!isDismentleAction && kitty && kittyTraits?.length) {
      for (const traitRow of kittyTraits) {
        const traitInfo = allKittyTraits[traitRow.traitId];
        if (!traitInfo || typeof traitInfo.actionExtraReward !== "function")
          continue;

        const traitExtraRewards =
          traitInfo.actionExtraReward({
            kittyUuid: kitty.uuid,
            owner: kitty.owner,
            kittyName: kitty.name,
            actionId,
            traitLevel: traitRow.level,
            oriReward: rawReward,
            requestIncreaseMood: async (kittyUuid: string, val: number, reason: string) => {
              await modifyKittyMood(kittyUuid, val, reason);
            },
            requestDecreaseMood: async (kittyUuid: string, val: number, reason: string) => {
              await modifyKittyMood(kittyUuid, -val, reason);
            },
          }) ?? [];

        for (const reward of traitExtraRewards) {
          if (!reward.percent) continue;

          if (randomNumberInFullColseRange(0, 1) < reward.percent) {
            await enqueueToHarvestBox(characterUuid, resourceRewardInfo, {
              title: "猫咪助手“" + kitty.name + "”-" + traitInfo.name,
              source: "ActionExtraReward",
              extra: {},
            });
          }
        }
      }
    }
  }

  if (buildingRewardInfo) {
    await applyBuildingReward(characterUuid, buildingRewardInfo);
  }

  return {
    resourceReward: resourceRewardInfo,
    buildingReward: buildingRewardInfo,
  };
};

export const giveTaskStatusImprove = async (characterUuid: string, {actionId}: GameTask, experts: Tavern[], characterStatusInfo: CharacterStatusInfo, characterWorkEquipment: CharacterEquipmentInfo | null, skillNodes: LearnedSkillFlatItem[] | null, percent: number = 1): Promise<{
    oriCharacterStatusInfo: CharacterStatusInfo
    latestCharacterStatusInfo: CharacterStatusInfo
} | null> => {
    const actionClone: GameAction = clone(allGameAction[actionId])

    let extraExpReward: Readonly<CharacterStatusImprove[]> = [];

    if (characterWorkEquipment) {
      iteratorWorkEquipment(
        characterWorkEquipment,
        ({ equipmentId, equipmentTrigger }) => {
          const thisExtraExpReward =
            equipmentTrigger?.extraExpRewardOnActionFinish?.({
              equipmentId,
              actionId,
            }) ?? [];
          if (thisExtraExpReward.length) {
            extraExpReward = [...thisExtraExpReward, ...extraExpReward];
          }
        }
      );
    }

    actionClone.characterImprove = clone([...(actionClone.characterImprove ?? []), ...extraExpReward]);

    for(const expert of experts) {
        if (expert.state != 'WORKING') continue

        let expertInfo = allTalentCat.find(cat => cat.id === expert.type as any)

        if (!expertInfo) continue

        expertInfo = clone(expertInfo)

        let expertActions = Object.keys(expertInfo?.actionOverride ?? {})

        if (clone(expertActions).includes(actionId)) {
            expertActions.forEach(pActionId => {
                if (actionId == pActionId) {

                    // action.rewards = clone([...(action.rewards ?? []), ...(expertInfo.actionOverride?.[actionId].rewards ?? [])])

                    actionClone.characterImprove = clone([...(actionClone.characterImprove ?? []), ...(expertInfo.actionOverride?.[actionId].characterImprove ?? [])])
                }
            })
        }
    }

    let improveInfo = clone(actionClone.characterImprove ?? []) ?? []

    // 把每个improveInfo的百分比都乘以percent
    improveInfo = improveInfo.map(info => {
        let base = info.increaseExp;

        let extra = 0;

        if (percent > 1) {
            extra = base * (percent - 1);
        } else {
            extra = -base * (1 - percent)
        }

        if (characterWorkEquipment) {
            for (const part of ObjectKeysTyped(characterWorkEquipment)) {
                let equipmentId = characterWorkEquipment[part]

                if (!equipmentId) {
                    continue;
                }

                let equipment = allGameResource[equipmentId]

                if (!equipment) {
                    continue;
                }

                if (part.startsWith('decorate')) {
                    if (!equipment.equipPart?.startsWith('decorate')) {
                        continue;
                    }
                } else {
                    if (part != equipment.equipPart) {
                        continue;
                    }
                }

                for (const effect of (equipment.onEquip ?? [])) {
                    for (const expEffect of (effect.workActionExtEffect ?? [])) {

                        if (!isActionInclude(expEffect.action, actionId)) {
                            continue;
                        }

                        if (isStatusEqual(expEffect.action, info.status)) {
                            if ('increasePercent' in expEffect && expEffect.increasePercent) {
                                extra += +(base * expEffect.increasePercent).toFixed(2);
                            }
                        }
                    }
                }
            }
        }

        if (skillNodes?.length) {
          for(const {nodeId, level} of skillNodes) {
            const node = allWorkSkillTreeNodesMap[nodeId]
            if (typeof node?.businessEffects?.actionExpRewardEffect != 'function') {
              continue;
            }

            const effects = node.businessEffects.actionExpRewardEffect(level)

            for(const effect of effects) {
              const passActionCheck = [effect.actionId].some(effectActionId => isActionInclude(effectActionId, actionId))

              if (!passActionCheck) {
                continue;
              }

              extra += +(
                base * effect.modifyPercent
              ).toFixed(2);
            }
          }
        }

        info.increaseExp = base + extra;

        if (info.increaseExp < 0) {
            info.increaseExp = 0;
        }

        return info
    })

    if (!improveInfo.length) {
        return null
    }

    const oriCharacterStatusInfo = characterStatusInfo
    const latestCharacterStatusInfo = await increaseCharacterStatusExp(characterUuid, improveInfo)

    return {
      oriCharacterStatusInfo,
      latestCharacterStatusInfo,
    };
}