import type { BaseDescriptableObject, MinMax } from "../types";
import {
  GameResourceCategory,
  type AllGameResourceIDWithInternal,
  type GameResource,
} from "../types/gameResource";
import enhanceInfoJson from "@/assets/resource/enhanceInfo.json"

export const allGameResourceCategoryInfo: {
  [key in GameResourceCategory]: BaseDescriptableObject & {
    hiddenInShop?: boolean;
  };
} = {
  [GameResourceCategory.Currency]: {
    name: "货币",
    description: "用于交易的通用货币",
    icon: "💰",
  },
  [GameResourceCategory.Equipment]: {
    name: "装备",
    description: "提升能力的穿戴物品",
    icon: "🛡️",
  },
  [GameResourceCategory.Chest]: {
    name: "宝箱",
    description: "可开启的宝箱",
    icon: "🎁",
    hiddenInShop: true,
  },
  [GameResourceCategory.Material]: {
    name: "材料",
    description: "基础建造和合成所需的原材料",
    icon: "🪵",
  },
  [GameResourceCategory.Food]: {
    name: "食物",
    description: "可食用资源，恢复体力或生命",
    icon: "🍖",
  },
  [GameResourceCategory.Tool]: {
    name: "工具",
    description: "用于采集、建造等的工具",
    icon: "🪓",
  },
  [GameResourceCategory.EnemySpoil]: {
    name: "掉落物",
    description: "战斗获得的战利品",
    icon: "🎊",
  },
  [GameResourceCategory.SkillBook]: {
    name: "技能书",
    description: "学习新技能",
    icon: "📖",
  },
  [GameResourceCategory.SimpleBook]: {
    name: "书籍",
    description: "书中自有黄金屋",
    icon: "📖",
  },
  [GameResourceCategory.Medicine]: {
    name: "药品",
    description: "用于治疗和恢复的物品",
    icon: "💊",
  },
  [GameResourceCategory.Quest]: {
    name: "任务物品",
    description: "任务相关的特殊物品",
    icon: "📜",
  },
  [GameResourceCategory.KittyFurniture]: {
    name: "猫舍家具",
    description: "让你的猫舍更舒适",
    icon: "🪑",
  },
  [GameResourceCategory.Magic]: {
    name: "魔法",
    description: "具有魔法属性的资源",
    icon: "✨",
  },
  [GameResourceCategory.FishBait]: {
    name: "鱼饵",
    description: "用于钓鱼的诱饵",
    icon: "🎣",
  },
  [GameResourceCategory.Building]: {
    name: "建筑材料",
    description: "用于建造的专用材料",
    icon: "🏗️",
  },
  [GameResourceCategory.Consumable]: {
    name: "消耗品",
    description: "一次性使用的物品",
    icon: "🧃",
  },
  [GameResourceCategory.Special]: {
    name: "特殊物品",
    description: "具有特殊用途或稀有属性的物品",
    icon: "🔮",
  },
  [GameResourceCategory.Pact]: {
    name: "契约",
    description: "用于战斗房间的特殊媒介",
    icon: "📜",
  },
  [GameResourceCategory.Plantable]: {
    name: "可种植",
    description: "可种植以获取资源的物品",
    icon: "🌱",
  },
  [GameResourceCategory.Other]: {
    name: "其他",
    description: "未分类的物品",
    icon: "❓",
  },
  [GameResourceCategory.Experience]: {
    name: "经验",
    description: "从实践中获得的经验",
    icon: "📖",
  },
  [GameResourceCategory.SponsorPointItem]: {
    name: "赞助积分道具",
    description: "",
    icon: "💎",
  },
  [GameResourceCategory.Custom]: {
    name: "自定义",
    description: "自定义扩展分类",
    icon: "🛠️",
    hiddenInShop: true,
  },
};

const internalResourceIdList = ["__satiety", "__cat"] as const;
const baseResourceIdList = [
  "gold",
  "catPawCoin",
  "wood",
  "stone",
  "coal",
  "iron",
  "steel",
  "bamboo",
  "fish",
  "mushroom",
  "berry",
  "chickenEgg",
  "milk",
  "salmon",
  "tuna",
  "honey",
  "herb",
  "wool",
  "axe",
] as const;
export const allDecoratorIdList = ["collectRing", "collectRing2"] as const;

// 其余所有资源（不含 internal），即 allGameResourceWithInternal 里除 internalResourceIdList 的所有 id
const allOtherResource = [
  "catPawStamp",
  "rareCatfish",
  "mysticalKoi",
  "treasureMap",
  "catPawFossil",
  "catStatue",
  "mysteriousBell",
  "ancientCatBowl",
  "catScroll",
  "catAntiqueShard",
  "catHairball",
  "luckyCatCharm",
  "catnipGem",
  "ancientFishBone",
  "whiskerFeather",
  "moonlightBell",
  "shell",
  "mysticalEssence",
  "catPotion",
  "magicScroll",
  "catRelic",
  "blessedBell",

  // 食物
  "simpleSalad",
  "wildFruitMix",
  "fishSoup",
  "berryPie",
  "mushroomStew",
  "catMint",
  "catSnack",
  "luxuryCatFood",
  "sashimiPlatter",

  // 宝箱类
  "catGiftBag",
  "luckyCatBox",
  "mysteryCan",
  "catnipSurprise",
  "meowEnergyBall",
  "dreamFeatherBag",

  // 装备
  "woodSword",
  "ironSword",
  "steelSword",
  "catFurCoat",
  "catFurHat",
  "catFurGloves",
  "catFurPants",
  "collectingBracelet",
  "fishingHat",
  "miningBelt",
  "farmingGloves",
  "heavyMinerGloves",
  "agileGatherBoots",
  "focusedFishingCap",
  "woodFishingRod",

  "chefHat",

  // 测试资源
  "testResource",
] as const;

const allEquipmentIdList = [
  "goblinDaggerPlus",
  "wolfPeltArmor",
  "skeletonShieldPlus",
  "trollClubPlus",
  "scorpionStingerSpear",
  "guardianCoreAmulet",
  "dragonScaleArmor",
] as const;

const allNormalEquipmentIdList = [
  "woolCoat",
  "woolHat",
  "woolGloves",
  "woolPants",

  "ironCoat",
  "ironHat",
  "ironGloves",
  "ironPants",
] as const;

const SkillBookIdList = clone(allGameBattleSkillIds).map(skill => skill + 'SkillBook');
const skillBookResource = (() => {
  let res = {} as {[K in typeof SkillBookIdList[number]]: GameResource;}

  ObjectKeys<AllBattleSkillId>(allGameBattleSkills).forEach(skillId => {
    const skill = allGameBattleSkills[skillId] as GameBattleSkill
    const key = skillId + "SkillBook"


    const bookResource: GameResource = {
      id: key,
      name: skill.name + "技能书",
      description: "学习 " + skill.name,
      icon: "📖",
      category: [GameResourceCategory.SkillBook],
      onUse: [
        {
          "name": "学习技能",
          "learnBattleSkillEffect": [
            {
              "skillId": skillId,
              "expReward": 50
            }
          ]
        }
      ],
      "removeAfterUse": true
    }

    const skillTire = skill.tire
    if (skillTire) {
      const skillBookLevel = `lv${skillTire}SkillBook` as const
      bookResource.alchemyTag = [skillBookLevel]
    }

    // @ts-expect-error
    if (allResource[key] && allResource[key].userBuyCost) {
      // @ts-expect-error
      bookResource.userBuyCost = allResource[key].userBuyCost
    }

    // @ts-expect-error
    if (allResource[key] && allResource[key].hideInMarket) {
      // @ts-expect-error
      bookResource.hideInMarket = allResource[key].hideInMarket
    }

    res[key] = bookResource
  })

  return res
})()

export const allGameResourceIDWithInternal = [
  ...internalResourceIdList,
  ...baseResourceIdList,
  ...SkillBookIdList,
  ...allDecoratorIdList,
  ...allOtherResource,
  ...allEquipmentIdList,
  ...allNormalEquipmentIdList,
] as const;

import allResource from '~/assets/resource/allGameResource.json';
// @ts-expect-error
export const allGameResourceWithInternal = {
  ...allResource,
  ...skillBookResource,
} as 
{
  [K: AllGameResourceIDWithInternal]: GameResource
};

export const allGameResource = Object.fromEntries(
  Object.entries(allGameResourceWithInternal).filter(
    ([_, resource]) => !resource.isInternal
  )
) as Omit<typeof allGameResourceWithInternal, "__satiety">;

import type {
  AllGameActionMainType,
} from "../types/gameAction";
import { allGameBattleSkillIds, allGameBattleSkills } from "./allGameBattleSkill";
import { clone, ObjectKeys } from "../utils";
import type { AllBattleSkillId, GameBattleSkill } from "../types/skill";

/**
 * 任务奖励池，difficult: 1~5，包含基础物品、金币和稀有物品
 * 每个奖励对象增加 percent 字段，表示概率（0~1），总和不必为1，可用于权重抽取
 */
export type QuestRewardPollItem = {
  resourceId: AllGameResourceIDWithInternal;
  range: MinMax;
  percent: number;
};

const tmpLevel1Rewords = [
  { resourceId: "gold", range: { min: 5000, max: 8000 }, percent: 1 },
  { resourceId: "catPawStamp", range: { min: 8, max: 12 }, percent: 1 },
  { resourceId: "wood", range: { min: 50, max: 60 }, percent: 0.8 },
  { resourceId: "stone", range: { min: 50, max: 60 }, percent: 0.8 },
  { resourceId: "bamboo", range: { min: 50, max: 60 }, percent: 0.7 },
  { resourceId: "berry", range: { min: 50, max: 60 }, percent: 0.5 },
  { resourceId: "herb", range: { min: 50, max: 60 }, percent: 0.3 },
  { resourceId: "shell", range: { min: 50, max: 60 }, percent: 0.2 },
]
const tmpLevel2Rewords = [
  { resourceId: "gold", range: { min: 15000, max: 22000 }, percent: 1 },
  { resourceId: "catPawStamp", range: { min: 15, max: 20 }, percent: 1 },
  { resourceId: "wood", range: { min: 80, max: 90 }, percent: 0.8 },
  { resourceId: "stone", range: { min: 80, max: 90 }, percent: 0.8 },
  { resourceId: "bamboo", range: { min: 80, max: 90 }, percent: 0.7 },
  { resourceId: "berry", range: { min: 80, max: 90 }, percent: 0.5 },
  { resourceId: "herb", range: { min: 80, max: 90 }, percent: 0.3 },
  { resourceId: "shell", range: { min: 80, max: 90 }, percent: 0.2 },
]
const tmpLevel3Rewords = [
  { resourceId: "gold", range: { min: 35000, max: 48720 }, percent: 1 },
  { resourceId: "catPawStamp", range: { min: 20, max: 25 }, percent: 1 },
  { resourceId: "wood", range: { min: 110, max: 120 }, percent: 0.8 },
  { resourceId: "stone", range: { min: 110, max: 120 }, percent: 0.8 },
  { resourceId: "bamboo", range: { min: 110, max: 120 }, percent: 0.7 },
  { resourceId: "berry", range: { min: 110, max: 120 }, percent: 0.5 },
  { resourceId: "herb", range: { min: 110, max: 120 }, percent: 0.3 },
  { resourceId: "shell", range: { min: 110, max: 120 }, percent: 0.2 },
]


export const questRewardPool: {
  [mainType in 'collecting' | 'fishing' | 'cooking' | 'exercise']?: {
    [difficulty: number]: QuestRewardPollItem[];
  };
} = {
  collecting: {
    1: tmpLevel1Rewords,
    2: tmpLevel2Rewords,
    3: tmpLevel3Rewords,
  },
  fishing: {
    1: tmpLevel1Rewords,
    2: tmpLevel2Rewords,
    3: tmpLevel3Rewords,
  },
  cooking: {
    1: tmpLevel1Rewords,
    2: tmpLevel2Rewords,
    3: tmpLevel3Rewords,
  },
  exercise: {
    1: tmpLevel1Rewords,
    2: tmpLevel2Rewords,
    3: tmpLevel3Rewords,
  },
} as const;


// =CONCATENATE("[{""name"":""提升攻击"",""statusEffect"":[{""status"":""attacking"",""increase"":",AB84,"}]},{""textDetail"":[{""title"":""",AC84,"防御穿透"",""description"":""""}]}]")

export const conflictEquipmentMap: {[key in AllGameResourceIDWithInternal]?: AllGameResourceIDWithInternal[]} = (() => {
  const tGetResourceActuralId = (equipmentId: string): string => {
    if (!equipmentId) return "";

    const idPart = equipmentId.split("+")[0];
    if (!idPart) {
      return "";
    }
    return idPart;
  }


  let res: {[key in AllGameResourceIDWithInternal]?: AllGameResourceIDWithInternal[]} = {}

  // 遍历所有资源，建立冲突映射
  Object.entries(allGameResourceWithInternal).forEach(([resourceId, resource]) => {
    const pResourceId = tGetResourceActuralId(resourceId) as AllGameResourceIDWithInternal
    
    // 收集需要处理的冲突列表
    const conflictLists: AllGameResourceIDWithInternal[][] = []
    
    // 当前资源的冲突列表
    if (resource.conflictWithOtherResources && resource.conflictWithOtherResources.length > 0) {
      conflictLists.push(resource.conflictWithOtherResources)
    }
    
    // 原始装备ID对应资源的冲突列表
    if (pResourceId !== resourceId && allGameResourceWithInternal[pResourceId]?.conflictWithOtherResources) {
      conflictLists.push(allGameResourceWithInternal[pResourceId].conflictWithOtherResources!)
    }
    
    // 处理所有冲突列表
    const allConflicts = conflictLists.flat()
    const uniqueConflicts = [...new Set(allConflicts)]
    
    if (uniqueConflicts.length > 0) {
      // 初始化当前资源的冲突列表
      if (!res[resourceId as AllGameResourceIDWithInternal]) {
        res[resourceId as AllGameResourceIDWithInternal] = []
      }

      // 为每个冲突的资源建立双向映射
      uniqueConflicts.forEach(conflictId => {
        // 添加到当前资源的冲突列表
        if (!res[resourceId as AllGameResourceIDWithInternal]!.includes(conflictId)) {
          res[resourceId as AllGameResourceIDWithInternal]!.push(conflictId)
        }

        // 为冲突的资源也添加当前资源（双向）
        if (!res[conflictId]) {
          res[conflictId] = []
        }
        if (!res[conflictId]!.includes(resourceId as AllGameResourceIDWithInternal)) {
          res[conflictId]!.push(resourceId as AllGameResourceIDWithInternal)
        }
      })
    }
  })

  return res;
})()