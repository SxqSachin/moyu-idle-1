import { defaultAllGameActionResourceRequirementDetail } from "~/shared/data/allGameActions";
import { allVillageBuilding } from "~/shared/data/allVillageBuilding";
import type { CharacterBuildingInfo } from "~/shared/types/building";
import type { CharacterStatusInfo } from "~/shared/types/characterInfo";
import type {
  ActionRequirement,
  AllGameActionID,
  AllGameActionResourceRequirementDetail,
  ResourceRequirement,
} from "~/shared/types/gameAction";
import type { CharacterInventory, ItemCountInfo } from "~/shared/types/gameInventory";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import { type CatVillageMonumentExtraData, type BaseVillageBuildingInfo } from "~/shared/types/village/building";
import { safeJsonParse } from "..";

export const resourceRequirementCheck = (
  actionId: AllGameActionID,
  characterActionResourceRequirement: AllGameActionResourceRequirementDetail,
  characterInventory: CharacterInventory
): boolean => {
    // 直接以 characterActionResourceRequirement[actionId] 为准，包含所有修正
    const actionReqArr =
      characterActionResourceRequirement[actionId] ??
      defaultAllGameActionResourceRequirementDetail[actionId];

    if (!actionReqArr.length) {
      return true;
    }

    for (const req of actionReqArr) {
      const inventoryCount = characterInventory[req.resourceId]?.count ?? 0;
      const requiredCount = req.final ?? 0;
      // 只校验消耗大于0的资源
      if (requiredCount > 0 && inventoryCount < requiredCount) {
        return false;
      }
    }

    return true;
}

export const simpleResourceRequirementCheck = (
  resourceRequirement: ResourceRequirement[],
  characterInventory: CharacterInventory
): boolean => {
    // 直接以 characterActionResourceRequirement[actionId] 为准，包含所有修正
    if (!resourceRequirement.length) {
      return true;
    }

    for (const req of resourceRequirement) {
      const inventoryCount = characterInventory[req.id]?.count ?? 0;
      const requiredCount = req.count ?? 0;
      // 只校验消耗大于0的资源
      if (requiredCount > 0 && inventoryCount < requiredCount) {
        return false;
      }
    }

    return true;
}

export const statusRequirementCheck = (
  actionRequirement: ActionRequirement | null | undefined,
  characterStatusInfo: CharacterStatusInfo
): boolean => {
  if (!actionRequirement?.characterStatus) {
    return true;
  }

  for (const requirement of actionRequirement.characterStatus) {
    if (requirement.status === 'workTotal') {
      let total = 0;
      for (const status of Object.values(characterStatusInfo)) {
        total += status.level;
      }
      if (total < requirement.min) {
        return false;
      }
    } else {
      if (characterStatusInfo[requirement.status].level < requirement.min) {
        return false;
      }
    }
  }

  return true;
};

export const buildingRequirementCheck = (
  actionRequirement: ActionRequirement | null | undefined,
  buildingInfo: CharacterBuildingInfo
): boolean => {
  if (!actionRequirement?.building) {
    return true;
  }

  for (const requirement of actionRequirement.building) {
    if (!buildingInfo[requirement.id]) {
      return false;
    }
    if ((buildingInfo[requirement.id]?.level ?? 0) < requirement.minLevel) {
      return false;
    }
  }

  return true;
};

export const requirementCheck = (
  actionId: AllGameActionID,
  actionRequirement: ActionRequirement | null | undefined,
  {
    characterActionResourceRequirement,
    characterInventory,
    characterStatusInfo,
    buildingInfo,
  }: {
    characterActionResourceRequirement: AllGameActionResourceRequirementDetail;
    characterInventory: CharacterInventory;
    characterStatusInfo: CharacterStatusInfo;
    buildingInfo: CharacterBuildingInfo;
  },
  opt?: {
    withoutResourceCheck?: boolean;
  }
) => {
  if (!actionRequirement) {
    return true;
  }

    const resourceRequirementCheckResult = resourceRequirementCheck(
        actionId,
        characterActionResourceRequirement,
        characterInventory
    );
    const statusCheckResult = statusRequirementCheck(
        actionRequirement,
        characterStatusInfo
    );
    const buildingCheckResult = buildingRequirementCheck(
        actionRequirement,
        buildingInfo
    );


  return (opt?.withoutResourceCheck ? true : resourceRequirementCheckResult) &&
         statusCheckResult &&
         buildingCheckResult;
};


export const convertReseourceRequirementToItemModifyReadonly = (
  resourceRequirement: readonly ResourceRequirement[],
): ItemCountInfo => {
  return convertReseourceRequirementToItemModify(resourceRequirement as ResourceRequirement[]);
}
export const convertReseourceRequirementToItemModify = (
  resourceRequirement: ResourceRequirement[],
): ItemCountInfo => {
  const itemModify: ItemCountInfo = {};

  for (const req of resourceRequirement) {
    const resourceId = req.id as AllGameResourceID;
    
    // 如果该资源已存在，则累加数量
    if (itemModify[resourceId]) {
      itemModify[resourceId].count += req.count;
    } else {
      // 如果不存在，则创建新的条目
      itemModify[resourceId] = { count: req.count };
    }
  }

  return itemModify;
}

export const convertItemCountInfoToResourceRequirement = (itemCountInfo: ItemCountInfo): ResourceRequirement[] => {
  const resourceRequirement: ResourceRequirement[] = [];
  for (const [id, info] of Object.entries(itemCountInfo)) {
    if (!info?.count) {
      continue;
    }
    resourceRequirement.push({ id, count: info.count });
  }
  return resourceRequirement;
};

export const calcExtraWrokExpRewardPercent = (villageBuildingInfo: BaseVillageBuildingInfo[]): number => {
  let extraExpPercent = 0;
  
  let catVillageMonument = villageBuildingInfo.find(building => building.type === 'catVillageMonument') 

  if (catVillageMonument && catVillageMonument.level > 0) {
    let effect = allVillageBuilding.catVillageMonument.effect(catVillageMonument.level);

    extraExpPercent += effect.expPercent;

    const extraData = safeJsonParse<CatVillageMonumentExtraData>(catVillageMonument.extra, {});

    if (extraData.consecrateUntil && new Date(extraData.consecrateUntil) > new Date()) {
      extraExpPercent += effect.donateExpPercent;
    }
  }

  return +extraExpPercent.toFixed(2)
}

export const convertItemCountInfoToDecrease = (itemCountInfo: ItemCountInfo): ItemCountInfo => {
  const result: ItemCountInfo = {};
  for (const [id, info] of Object.entries(itemCountInfo)) {
    if (!info) {
      continue;
    }
    result[id] = { count: -Math.abs(info.count) };
  }
  return result;
}