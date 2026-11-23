import type { AllGameBuildingID, BuildActionID } from "../types/building";
import type {
  AllGameActionDurationDetail,
  AllGameActionID,
  AllGameActionResourceRequirementDetail,
  GameAction,
  GameMainActionInfo,
} from "../types/gameAction";
import { allGameBuilding } from "./allGameBuilding";
import enhanceInfoJson from "@/assets/resource/enhanceInfo.json"

import allGameActionMainTypeJson from '~/assets/resource/allGameActionsMainType.json'
import { clone, ObjectKeys } from "../utils";

const buildingActionId = (Object.keys(allGameBuilding) as AllGameBuildingID[]).map(
  (buildingId) => ("build_" + buildingId) as BuildActionID
)

import allAction from '~/assets/resource/allGameActions.json';
import allActionId from '~/assets/resource/allGameActionIdList.json';
import type { AllGameResourceID } from "../types/gameResource";
const allActionIdList = [
  ...allActionId,
  ...buildingActionId
] as const

const allBuildingAction = (() => {
    const allBuildingId = Object.keys(allGameBuilding) as AllGameBuildingID[];
    const res = {} as {[key in BuildActionID]: GameAction};
    for (const buildingId of allBuildingId) {
      const buildingInfo = allGameBuilding[buildingId];
      const key = ("build_" + buildingId) as BuildActionID;
      res[key] = {
        id: key,
        name: "建造" + buildingInfo.name,
        icon: buildingInfo.icon,
        description: "",
        baseDuration: buildingInfo.buildDuration,
        requirement: buildingInfo.buildRequirement,
        rewards: [
          {
            buildingId,
          },
        ],
      };
    }

    return res;
})()


export const dismantleBlacklist = new Set<string>([
  'gold','wood','coal','iron','glassBottles','paper'
]);
// allDismantlableResource 仅包含“实际生成了分解配方”的物品，
// 防止出现“可分解列表里有项，但最终没有任何产出”的情况。
// 这里在 allDismantleAction 生成完成后再推导，保证一致性。
// 占位移除：allDismantlableResource 在 allDismantleAction 生成后定义
export const allDismantleAction = (() => {
  const res: { [key: string]: GameAction } = {};
  const baseDismantleMap: { [itemId: string]: GameAction } = {};

  // 1. 基础分解配方，key = dismantle_{rewardId}
  Object.values(allAction).forEach((pAction) => {

    if (pAction.ignoreDismantle) { // 忽略分解
      return;
    }

    let action = clone(pAction) as GameAction;
    const requirementResources = (action.requirement?.resource || []).filter((r: any) => r.id !== "__satiety");
    if (requirementResources.length === 0) return;
    if (!action.rewards || action.rewards.length !== 1) return;

    const reward = action.rewards[0];
    const rewardId = reward.id;
    if (!rewardId) return;
    if (dismantleBlacklist.has(rewardId)) return; // 黑名单过滤

    // 构造反转后的 requirement 和 rewards
    const dismantleRequirement = {
      resource: [
        {
          id: rewardId,
          count: reward.count ?? (reward.range ? reward.range.min : 1)
        }
      ]
    };

  // 返还规则（逐项判断）：对每种原材料返还 60%
  // - 返还数量 = floor(原消耗量 * 0.6)，最少 1
  // - 去除金币奖励
    const dismantleRewards = requirementResources
      .filter((r) => r.id !== "gold")
      .filter((r) => r.count > 1)
      .map((r: any) => ({
        id: r.id,
        percent: 1,
        count: Math.max(1, Math.floor((r.count ?? 1) * 0.6))
      }));

    // 如果没有产出，直接跳过
    if (dismantleRewards.length === 0) return;

    const dismantleId = `dismantle_${rewardId}`;
    const dismantleAction: GameAction = {
      ...action,
      id: dismantleId,
      // avoid reading allGameResource during module init to prevent circular init issues
      name: `分解物品`,
      requirement: dismantleRequirement,
      rewards: dismantleRewards,
      description: `分解物品，返还部分原材料`,
      baseDuration: Math.floor((action.baseDuration ?? 1000) * 0.6), // 分解动作的duration是原动作的60%
    };

    delete dismantleAction.characterImprove

    res[dismantleId] = dismantleAction;
    baseDismantleMap[rewardId] = dismantleAction;
  });

  // 2. 强化物品分解配方，key = dismantle_{强化物品id}
  const allEnhanceIds = new Set<string>();
  ObjectKeys<keyof typeof enhanceInfoJson>(enhanceInfoJson).forEach((enhanceId) => {
    allEnhanceIds.add(enhanceId);
    const info = enhanceInfoJson[enhanceId];
    if (info.enhanceSuccessTo) {
      allEnhanceIds.add(info.enhanceSuccessTo);
    }
  });

  allEnhanceIds.forEach((pEnhanceId) => {
    const enhanceId = pEnhanceId as keyof typeof enhanceInfoJson;
    if (dismantleBlacklist.has(enhanceId)) return; // 黑名单过滤
    // 找到基础物品（如 axe+1 的基础物品是 axe）
    let baseId = enhanceId;
    const match = enhanceId.split('+')[0] as keyof typeof enhanceInfoJson;
    if (match) baseId = match;

    const baseDismantle = baseDismantleMap[baseId];
    if (!!baseDismantle && baseDismantle.rewards && baseDismantle.rewards.length > 0) {
      const newId = `dismantle_${enhanceId}`;
      let resources = baseDismantle?.requirement?.resource;
      if (!resources || !Array.isArray(resources)) return;

      const newRequirement = {
        resource: resources.map((r: any) => ({
          ...r,
          id: enhanceId
        }))
      };

  // 奖励沿用基础规则：对每种原材料返还60%，并去除金币（基础分解已按规则生成）
      const newRewards = baseDismantle.rewards
        .filter((r: any) => r.id !== "gold");

      // 如果没有产出，直接跳过
      if (newRewards.length === 0) return;

      // avoid reading allGameResource during module init; use id as fallback name
      res[newId] = {
        ...baseDismantle,
        id: newId,
        name: `分解物品`,
        requirement: newRequirement,
        rewards: newRewards,
        description: `分解${enhanceId}`,
        baseDuration: Math.floor((baseDismantle.baseDuration ?? 1000)), // 直接继承基础分解动作的duration（已经是60%）
      };

      delete res[newId].characterImprove
    }
  });

  return res;
})();

// 基于已生成的 allDismantleAction 推导可分解物品列表，
// 确保只有“确实会有产出”的分解动作对应的物品会出现在列表里。
export const allDismantlableResource = (() => {
  return Object.keys(allDismantleAction)
    .map((k) => k.replace(/^dismantle_/, "")) as AllGameResourceID[];
})();

// @ts-ignore
export const allGameAction = {
  ...allAction,
  ...allBuildingAction,
  ...allDismantleAction,
 } as {
  [K in typeof allActionIdList[number]]: GameAction;
};

// remove all hidden action
Object.keys(allGameAction).forEach((key) => {
  if (allGameAction[key].hidden) {
    delete allGameAction[key];
  }
});

export const allGameActionId = Object.keys(allGameAction) as (keyof typeof allGameAction)[];

export function getMainTypeByActionId(actionId: string): keyof typeof allGameActionMainType | undefined {
  for (const mainType of Object.keys(allGameActionMainType) as (keyof typeof allGameActionMainType)[]) {
    if (allGameActionMainType[mainType].actions.includes(actionId as any)) {
      return mainType;
    }
  }
  return undefined;
}

const allGameActionMainTypeList = [
  "collecting",
  "farmingAnimal",
  "fishing",
  "cooking",
  "mining",
  "forging",
  "sewing",
  "mysterious",
  "exercise",
  "level1Manufacture",
  "specialManufacture",
  "explore",
] as const;
export const allGameActionMainType: {
  [key in (typeof allGameActionMainTypeList)[number]]: GameMainActionInfo;
} = {
  collecting: {
    id: "collecting",
    name: "采集",
    icon: "game-icons:plants-and-animals",
    color: "#333",
    actions: allGameActionMainTypeJson.collection as AllGameActionID[]
  },
  fishing: {
    id: "fishing",
    icon: "game-icons:boat-fishing",
    color: "#333",
    name: "钓鱼",
    actions: allGameActionMainTypeJson.fishing as AllGameActionID[],
  },
  farmingAnimal: {
    id: "farmingAnimal",
    icon: "game-icons:cow",
    color: "#333",
    name: "养殖",
    actions: allGameActionMainTypeJson.farmingAnimal as AllGameActionID[],
  },
  mining: {
    id: "mining",
    name: "挖掘",
    icon: "game-icons:mining",
    color: "#333",
    actions: allGameActionMainTypeJson.mining as AllGameActionID[],
  },
  cooking: {
    id: "cooking",
    name: "烹饪",
    icon: "game-icons:cooking-pot",
    color: "#333",
    actions: allGameActionMainTypeJson.cooking as AllGameActionID[],
  },
  level1Manufacture: {
    id: "level1Manufacture",
    icon: "game-icons:hammer-nails",
    color: "#333",
    name: "制造",
    actions: allGameActionMainTypeJson.level1Manufacture as AllGameActionID[],
  },
  forging: {
    id: "forging",
    icon: "game-icons:blacksmith",
    color: "#333",
    name: "锻造",
    actions: allGameActionMainTypeJson.forging as AllGameActionID[],
  },
  sewing: {
    id: "sewing",
    icon: "game-icons:sewing-machine",
    color: "#333",
    name: "缝制",
    actions: allGameActionMainTypeJson.sewing as AllGameActionID[],
  },
  specialManufacture: {
    id: "specialManufacture",
    icon: "game-icons:triple-lock",
    color: "#333",
    name: "特殊制造",
    actions: allGameActionMainTypeJson.specialManufacture as AllGameActionID[],
  },
  mysterious: {
    id: "mysterious",
    icon: "game-icons:paw-print",
    color: "#333",
    name: "炼金",
    actions: allGameActionMainTypeJson.mysterious as AllGameActionID[],
  },
  explore: {
    id: "explore",
    icon: "material-symbols:explore-outline-rounded",
    color: "#333",
    name: "探索",
    actions: allGameActionMainTypeJson.explore as AllGameActionID[],
  },
  exercise: {
    id: "exercise",
    icon: "material-symbols:exercise-outline",
    color: "#333",
    name: "提升自我",
    actions: allGameActionMainTypeJson.exercise as AllGameActionID[],
  },
} as const;

export const defaultAllGameActionDurationDetail = (() => {
  let durationInfo: AllGameActionDurationDetail =
    {} as AllGameActionDurationDetail;
  Object.values(allGameAction).forEach((action) => {
    durationInfo[action.id] = {
      base: action.baseDuration,
      final: Math.max(1000, action.baseDuration),
      fromEquipmentModify: 0,
    };
  });

  return Object.freeze(durationInfo);
})();

export const defaultAllGameActionResourceRequirementDetail = (() => {
  let resourceRequirementInfo: AllGameActionResourceRequirementDetail =
    {} as AllGameActionResourceRequirementDetail;
  Object.values(allGameAction).forEach((action) => {
    resourceRequirementInfo[action.id] = action.requirement?.resource
      ? action.requirement.resource.map((r) => {
          return {
            resourceId: r.id,
            fromEquipmentModify: 0,
            base: r.count ?? 0,
            final: r.count ?? 0,
          };
        })
      : [];
  });

  return Object.freeze(resourceRequirementInfo);
})();
