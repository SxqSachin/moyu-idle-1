import type { allGameBattleSkills } from "../data/allGameBattleSkill"
import type { BattleActionTargetType, BattleCallback, BattleInfo, CastSkillExtraParam, FullBattleAction, SimpleBattleHpRestoreCallback, SimpleBattleTargetActionCallback, SimpleBattleTargetAddStateActionCallback, SimpleBattleTargetDamageActionCallback, SimpleFloatTextActionCallback } from "./battle"
import type { AllBattleStateId } from "./BattleState";
import type { CharacterStatusImprove } from "./characterInfo";
import type { AllGameEnemyID, AllUnitID } from "./emeny";
import type { AllGameResourceID } from "./gameResource";
import type { BaseBattleUnit, BattleSkillInfo, BattleSkillInfoItem } from "./unit"

export enum DamageType {
    Physical = "physical",
    Magical = "magical",
    True = "true",
    NoDamage = "no_damage", // 不造成伤害
}

export enum SkillType {
    Passive = "passive", // 召唤技能
    Summon = "summon", // 召唤技能
    Buff = "buff", // 增益技能
    Debuff = "debuff", // 减益技能
    Damage = "damage", // 伤害技能
    Heal = "heal", // 治疗技能
    Shield = "shield", // 治疗技能
    Revive = "revive", // 治疗技能
    MpRegen = "mpRegen", // 治疗技能
    Special = "special", // 特殊技能
}

export const skillTypeMap = {
  passive: { label: "被动技能", color: "#909399" },
  summon: { label: "召唤", color: "#67c23a" },
  buff: { label: "增益", color: "#409eff" },
  debuff: { label: "减益", color: "#e6a23c" },
  damage: { label: "伤害", color: "#f56c6c" },
  heal: { label: "治疗", color: "#67c23a" },
  shield: { label: "护盾", color: "#e7bf00" },
  revive: { label: "复活", color: "#a56cf5" },
  mpRegen: { label: "法力回复", color: "#406eff" },
  special: { label: "特殊", color: "#909399" },
} as const;

export const damageTypeMap = {
  physical: { label: "物理", color: "var(--el-color-danger)" },
  magical: { label: "魔法", color: "var(--el-color-primary)" },
  true: { label: "真实", color: "var(--el-color-warning)" },
  no_damage: { label: "无伤害", color: "var(--el-color-info)" },
} as const;


export enum GameBattleLogicTarget {
    Self = "self",
    SelfSummonedUnit = "selfSummonedUnit",
    Allies = "allies",
    Enemies = "enemies",
    EachAllies = "eachAllies",
    EachEnemies = "eachEnemies",
    All = "all",
    None = "none"
}
export enum GameBattleLogicDataType {
    TotalHp = "totalHp",
    LostHp = "lostHp",
    LostMp = "lostMp",
    Hp = "hp",
    Mp = "mp",
    Count = "count",
    BuffCount = "buffCount",
    DebuffCount = "debuffCount",
    PassedTurn = "passedTurn",

   FurryStaticElectricityStack = "FurryStaticElectricityStack",
   FurryStaticElectricityOverloadStack = "FurryStaticElectricityOverloadStack",
}
export enum GameBattleLogicValueCompareAction {
    LargeThan = ">",
    LargeEqualThan = ">=",
    SmallThan = "<",
    SmallEqualThan = "<=",
    EqualThan = "="
}

export enum GameBattleLogicStateCompareAction {
    SomeoneHasState = "someoneHasState",
    AllHasState = "AllHasState",
    SomeoneNotHasState = "someoneNotHasState",
    AllNotHasState = "allNotHasState",
}
export type GameBattleLogicValueConditionValue = number | `${number}%`;

export enum GameBattleLogicSpecialAction {
    EnemyHasBoss = "enemyHasBoss",
    EnemyNotHasBoss = "enemyNotHasBoss",
    // 未来可扩展更多特殊判断
}

export enum GameBattleLogicCooldownCompareAction {
    AllInCooldown = "allInCooldown",         // 所有指定技能均在冷却
    AllNotInCooldown = "allNotInCooldown",   // 所有指定技能均不在冷却
    SomeoneInCooldown = "someoneInCooldown", // 至少一个指定技能在冷却
    SomeoneNotInCooldown = "someoneNotInCooldown", // 至少一个指定技能不在冷却
    InCooldown = "inCooldown",               // 某个技能在冷却
    NotInCooldown = "notInCooldown",         // 某个技能不在冷却
}

export enum GameBattleLogicUnitExistStateCompareAction {
    Exist = "exist",
    NotExist = "notExist"
}

export type GameBattleLogic =
  | {
      target: GameBattleLogicTarget;
      compareType: "value";
      dataType: GameBattleLogicDataType;
      valueCompareAction: GameBattleLogicValueCompareAction;
      valueConditionValue: GameBattleLogicValueConditionValue;
      // 禁止状态字段
      stateCompareAction?: never;
      stateCompareStateId?: never;
    }
  | {
      target: GameBattleLogicTarget;
      compareType: "unitExistState";
      // 禁止数值字段
      unitExistCompareAction?: GameBattleLogicUnitExistStateCompareAction;
      unitId?: AllUnitID;
    }
  | {
      target: GameBattleLogicTarget;
      compareType: "state";
      // 禁止数值字段
      dataType?: never;
      valueCompareAction?: never;
      valueConditionValue?: never;
      stateCompareAction: GameBattleLogicStateCompareAction;
      stateCompareStateId: AllBattleStateId;
    }
  | {
      target: GameBattleLogicTarget;
      compareType: "stateStack";
      // 禁止数值字段
      stateCompareStateId: AllBattleStateId;
      valueCompareAction: GameBattleLogicValueCompareAction;
      valueConditionValue: number;
    }
  | {
      target: GameBattleLogicTarget;
      compareType: "cooldown";
      cooldownCompareAction: GameBattleLogicCooldownCompareAction;
      cooldownSkillIds: AllBattleSkillId[]; // 需要判断的技能id列表
      // 禁止其它字段
      dataType?: never;
      valueCompareAction?: never;
      valueConditionValue?: never;
      stateCompareAction?: never;
      stateCompareStateId?: never;
      specialAction?: never;
    }
  | {
      target: GameBattleLogicTarget;
      compareType: "itemCooldown";
      // 禁止数值字段
      cooldownCompareAction: GameBattleLogicCooldownCompareAction;
      cooldownItemIds: AllGameResourceID[]; // 需要判断的技能id列表
      // 禁止其它字段
      dataType?: never;
      valueCompareAction?: never;
      valueConditionValue?: never;
      stateCompareAction?: never;
      stateCompareStateId?: never;
      specialAction?: never;
    }
  | {
      target: GameBattleLogicTarget;
      compareType: "special";
      specialAction: GameBattleLogicSpecialAction;
      // 禁止其它字段
      dataType?: never;
      valueCompareAction?: never;
      valueConditionValue?: never;
      stateCompareAction?: never;
      stateCompareStateId?: never;
    };


export type GameFullBattleLogic = GameBattleLogic[] | GameBattleLogic[][];

export type GameCharacterBattleSkillInfo = {
    skillId: AllBattleSkillId;
    level: number;
    exp: number;

    enabled: boolean;

    order: number;

    logic: GameBattleLogic[]

    extra: Record<string, any>

    available?: boolean
}

export type GameBattleSkillEffectCallback = (obj: { 
    self: BaseBattleUnit,
    allies: BaseBattleUnit[],
    enemies: BaseBattleUnit[],
    allAllies: BaseBattleUnit[],
    allEnemies: BaseBattleUnit[],
    battleInfo: BattleInfo,
    thisSkill?: BattleSkillInfoItem,
    callbacks: BattleCallback,

    skillExtraParam?: CastSkillExtraParam

    dealDamageCallback?: SimpleBattleTargetDamageActionCallback
    healCallback?: SimpleBattleHpRestoreCallback
    lossMpCallback?: SimpleBattleTargetActionCallback
    restoreMpCallback?: SimpleBattleTargetActionCallback
    addStateCallback?: SimpleBattleTargetAddStateActionCallback
    floatTextCallback?: SimpleFloatTextActionCallback
    statusModifyCallback?: (obj: {
        [key: string]: CharacterStatusImprove[]
    }) => void
}) => FullBattleAction | undefined | Promise<FullBattleAction | undefined>
export type GameBattleSkillEffectCheckCallback = (obj: { 
    self: BaseBattleUnit,
    allies: BaseBattleUnit[],
    enemies: BaseBattleUnit[],
    allAllies: BaseBattleUnit[],
    allEnemies: BaseBattleUnit[],
    battleInfo: BattleInfo
}) => boolean
export type GameBattleSkill = {
    id: string
    name: string
    target: BattleActionTargetType

    tire?: 1 | 2 | 3 | 4

    passive?: boolean // 是否为被动技能

    damageType: DamageType | DamageType[] // 技能伤害类型
    skillType: SkillType[] // 技能类型

    hideSkillCastFloatText?: boolean

    targetCount: number

    effectStr: string // 技能效果描述

    colddown: number
    mpCost: number

    preCheck?: GameBattleSkillEffectCheckCallback
    effect: GameBattleSkillEffectCallback
}

export type AllBattleSkillId = keyof typeof allGameBattleSkills

export type ChefFlavorKey = 'sour' | 'sweet' | 'bitter' | 'spicy' | 'salty'
export type ChefTargetKey = 'ally' | 'enemy'

export interface ChefFlavorAllocation { key: ChefFlavorKey; count: number }
export interface ChefTargetAllocation { key: ChefTargetKey; count: number }
export interface ChefSkillCombinationInfo {
  flavors: ChefFlavorAllocation[]
  targets: ChefTargetAllocation[]
}

export const CHEF_SKILL_FLAVOR_KEY_NAME_MAP: Record<ChefFlavorKey, string> = {
    sour: "酸",
    sweet: "甜",
    bitter: "苦",
    spicy: "辣",
    salty: "咸",
};
export const CHEF_SKILL_TARGET_KEY_NAME_MAP: Record<ChefTargetKey, string> = {
    ally: "友方",
    enemy: "敌方",
};