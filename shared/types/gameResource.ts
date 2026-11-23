import { allGameResource, type allGameResourceIDWithInternal, type allGameResourceWithInternal } from "../data/allGameResources"
import type { CharacterEquipmentPart, CharacterEquipmentType } from "./characterInfo"
import type { ActionRequirement, CharacterStatusRequirement } from "./gameAction";
import type { AllResourceAlchemyTagId } from "./gameAlchemy";
import type { GameBattleActionEffect, GameEffectAction, GameUserUniqueFlag, GameUserUniqueFlagCheck } from "./gameEffect"

export type AllGameResourceIDWithInternal = typeof allGameResourceIDWithInternal[number];
export type AllGameResourceID = Exclude<AllGameResourceIDWithInternal, `__${string}`>

export enum GameResourceCategory {
  Chest = "Chest", // 宝箱
  Material = "Material", // 基础材料
  Food = "Food", // 食物
  FishBait = "FishBait", // 鱼饵
  Tool = "Tool", // 工具
  Equipment = "Equipment", // 装备
  SkillBook = "SkillBook", // 装备
  SimpleBook = "SimpleBook", // 书
  Plantable = "Plantable", // 可种植
  Medicine = "Medicine", // 药品
  Currency = "Currency", // 货币
  Quest = "Quest", // 任务物品
  KittyFurniture = "KittyFurniture",
  Magic = "Magic", // 魔法/能量
  Building = "Building", // 建筑材料
  Consumable = "Consumable", // 消耗品
  Special = "Special", // 特殊物品
  Pact = "Pact", // 契约
  EnemySpoil = "EnemySpoil", // 凋落物
  Other = "Other", // 其他
  Experience = "Experience", // 经验
  SponsorPointItem = "SponsorPointItem", // 赞助商店
  Custom = "Custom", // 自定义扩展
}

export type GameResource = {
  id: AllGameResourceID;
  name: string;
  description: string;

  icon: string;
  extraTextOnIcon?: string;

  category?: (GameResourceCategory | "all")[];
  alchemyTag?: (AllResourceAlchemyTagId)[];

  userBuyCost?: GameResourceShopBuyInfo[];
  userSellCost?: GameResourceShopSellInfo[];

  userBuyCostSponsorPoint?: number 
  maxBuyCount?: number
  uniqueFlagCheckWhenBuy?: GameUserUniqueFlagCheck[] 
  addUniqueFlagAfterBuy?: GameUserUniqueFlag[]

  isInternal?: boolean;

  beforeUseUniqueFlagCheck?: GameUserUniqueFlagCheck[] 
  onUse?: GameEffectAction[];
  removeAfterUse?: boolean;

  onEquip?: GameEffectAction[];
  equipPart?: CharacterEquipmentPart;
  equipmentType?: (CharacterEquipmentType)[];
  equipStatusRequirement?: CharacterStatusRequirement[]
  conflictWithOtherResources?: AllGameResourceID[]


  hideInShop?: boolean;
  hideInMarket?: boolean;

  inBattleCooldown?: number;
  inBattleEffect?: GameBattleActionEffect[];


  shopType?: string
  maxUseEachTime?: number

  sponsorDiyItem?: boolean
  sponsorShopKind?: string
};

// let a: GameResource = allGameResource.gold as GameResource;
// a.onUse = [
//   {
//     name: "融会贯通",
//     statusEffect: [
//       {
//         status: "strength",
//         increase: 10,
//       }
//     ]
//   }
// ]


export type GameResourceShopBuyInfo = {
    cost?: AllGameResourceID 
    count: number
}
export type GameResourceShopSellInfo = {
    cost?: AllGameResourceID 
    count: number | "1/2" | "1/3" | "2/3"
}

export type GameResourceTradeEvent = {
    id: AllGameResourceID
    count: number
}

export type GameResourceEnhanceInfo = {
    id: AllGameResourceID

    enhanceRequireResource: {resourceId: AllGameResourceID, count: number}[]

    enhanceSuccessTo: AllGameResourceID
    enhanceFailToWithProtected: AllGameResourceID
    enhanceFailToWithUnprotected: AllGameResourceID

    enhanceProtecteResourceIds: AllGameResourceID[]

    enhanceBasePercent: number

    rewardEnhanceExp: number
}