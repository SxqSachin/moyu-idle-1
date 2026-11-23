import type { allBattleAreas } from "../data/allBattleInfo";
import type { AllBattleStateId, BattleStateInBattle } from "./BattleState";
import type { AllBaseCharacterStatusType, CharacterStatusImprove } from "./characterInfo";
import type { Enemy, ItemDrop } from "./emeny";
import type { AllGameActionID, GameActionReward } from "./gameAction";
import type { ItemCountInfo } from "./gameInventory";
import type { AllGameResourceID } from "./gameResource";
import type { AllBattleSkillId, DamageType, GameBattleSkillEffectCallback, GameBattleSkillEffectCheckCallback } from "./skill";
import type { BaseBattleUnit, BaseUnitStatusInfo } from "./unit";
import type { WorldBossConfigInBattleInfo } from "./worldBoss";

export enum AllBattlePhase {
  SELF_TURN_START = "selfTurnStart",
  BATTLE_START = "battleStart",
}

export enum MpLossReason {
    FROM_ENEMY_LOSS = "FROM_ENEMY_LOSS", // 施法
    CAST_SKILL = "cast_skill", // 施法
    EQUIPMENT = "equipment", // 未知原因
    UNKNOWN = "unknown", // 未知原因
    SkillNode = "skill_node" // 未知原因
}

export enum MpRestoreReason {
  TURN_START_RESTORE = "turn_start_restore",
  USE_ITEM_RESTORE = "use_item_restore",
  EQUIPMENT_EFFECT = "equipment_effect",
  SKILL_EFFECT = "skill_effect",
  STATE_EFFECT = "state_effect",
}

export enum HpRestoreReason {
  TURN_START_RESTORE = "turn_start_restore",
  USE_ITEM_RESTORE = "use_item_restore",
  EQUIPMENT_EFFECT = "equipment_effect",
  EQUIPMENT_LIFE_STEAL = "equipment_life_steal",
  SKILL_EFFECT = "skill_effect",
  STATE_EFFECT = "state_effect",
}

export type HealTriggerBy = {
  type: 'equipment' | 'skill' | 'item'
  id: string
}

/**
 * 普通敌人池配置
 */
export interface EnemyPoolEntry {
  id: string;      // 敌人ID
  weight: number;  // 出现权重
  maxCountPerWave?: number;
}

/**
 * 特殊战斗配置（如boss战）
 */
export interface SpecialBattle {
  every: number;         // 每N次触发
  maxBossNum?: number;  // 可选，最大BOSS数量
  enemies: EnemyPoolEntry[];     // 特殊战斗敌人ID列表
  description?: string;  // 可选描述
}

export interface BattleAreaExpeditionInfo {
  normalBattleDuration: number;
  specialBattleDuration: number
  travelDuration: number;

  dropRateMultiplier: number;
}

export interface BattleArea {
  id: string;
  name: string;
  description: string;
  enemyPool: EnemyPoolEntry[];      // 敌人池，带权重
  minLevel?: number;
  maxLevel?: number;

  minEnemies: number,
  maxEnemies: number,

  specialBattles?: SpecialBattle[]; // 特殊战斗配置

  specialDescription?: string; // 特殊战斗描述
  onEachTurnStart?: (battleInfo: BattleInfo) => void; // 每回合开始时触发的函数
  onEachBattleStart?: (obj: {
    battleInfo: BattleInfo
    callbacks: BattleCallback
  }) => void; // 每场战斗开始时触发的函数

  expeditionRewardInfo?: ItemDrop[]
  expeditionRequireResource?: ItemCountInfo

  denseFogModeRequireResource?: ItemCountInfo

  requireResourceToEnter?: ItemCountInfo
}

export type AllBattleAreaID = keyof typeof allBattleAreas;

export type BattlePassTurnReason = 'NORMAL' | 'DEAD' | 'EXPECTION'

export interface BattleInfo {
  uuid: string; // 战斗唯一ID
  members: BaseBattleUnit[]; // 所有参战单位

  area: keyof typeof allBattleAreas

  groups: Record<string, string[]>; // 所有参战单位的分组（如玩家组、敌人组等）

  playerGroupId: string

  battleStatus: BattleStatus; // 战斗状态

  // 世界Boss相关（如本场为世界Boss战）
  worldBossId?: string;
  worldBossConfig?: WorldBossConfigInBattleInfo

  currentTurnIndex: number; // 当前行动单位在members中的索引
  turnOrder: string[]; // 行动顺序（单位id数组，按行动顺序排列）

  thisBattleTmpOnceExtraTurnIndexList?: number[]; // 本场战斗中的额外回合

  extraTurnOnBattleBegin: string[]; // 战斗开始时额外获得行动的单位ID列表
  extraTurnIndex: number; // 当前额外行动的单位在 turnOrder 中的索引

  passedTurn: number;

  isDenseFogMode?: boolean; // 迷雾战斗
  isDenseFogMode_Encounter?: boolean; // 迷雾战斗 玩家幻象

  currentTurnUnitUuid?: string; // 当前回合是谁

  roomUuid: string
}

export type BattleActionTargetType = 'none' | "self" | "single_random_ally" | "all_ally" | "single_random_enemy" | "single_enemy" | "multi_random_enemy" | "all_enemy" | "all";
export type BaseBattleAction = {
  type: "attack" | "skill" | "item" | "state" | "none"; // 行动类型

  damage?: {[target: string]: {
    damage: number; // 即将造成的伤害
    damageType: DamageType; // 伤害类型
  }}; // 即将造成的伤害
  heal?: {[target: string]: number}; // 即将造成的治疗量

  // stateId?: string; // 施加的状态ID
  castSkillId?: string;
  // triggerEquipmentId?: string; // 触发的装备ID
}
export type FullBattleAction = {
  targetUnitUuidList: string[]; // 目标单位，在 members 中的索引列表
  sourceUnitUuid: string; // 发起行动的单位在 members 中的索引
} & BaseBattleAction

export enum BattleStatus {
  BATTLING = "BATTLING",
  PLAYER_WIN = "PLAYER_WIN",
  PLAYER_LOSE = "PLAYER_LOSE",
  ESCAPED = "ESCAPED"
}

export type BattleCallback = {
  castSkillCallback: SimpleCastSkillActionCallback
  dealDamageCallback: SimpleBattleTargetDamageActionCallback
  lossMpCallback: SimpleBattleTargetActionCallback
  restoreMpCallback: SimpleBattleTargetActionCallback
  healCallback: SimpleBattleHpRestoreCallback
  addStateCallback: SimpleBattleTargetAddStateActionCallback
  floatTextCallback: SimpleFloatTextActionCallback
  drawLineCallback: SimpleSourceTargetActionCallback
  increaseItemCallback: SimpleIncreaseItemActionCallback
}

export type EquipmentCalcMaxHpParam = {
    equipmentId: string,
    status: BaseUnitStatusInfo,
    baseStatus: BaseUnitStatusInfo,
}

export type EquipmentCastSkillTriggerParam = {
    equipmentId: string,
    self: BaseBattleUnit,

    battleInfo: BattleInfo,
    thisRoundInfo?: FullBattleAction,

    skillId: AllBattleSkillId

    callbacks: BattleCallback
}

export type EquipmentAfterEachOtherUnitTurnTriggerParam = {
    equipmentId: string,
    self: BaseBattleUnit,

    currentTurnUnit?: BaseBattleUnit

    battleInfo: BattleInfo,
    thisRoundInfo?: FullBattleAction,

    callbacks: BattleCallback
}

export type EquipmentBeforeOtherUnitCastSkillTriggerParam = {
    equipmentId: string,
    self: BaseBattleUnit,

    skillId: AllBattleSkillId

    source: BaseBattleUnit

    currentTurnUnit?: BaseBattleUnit

    battleInfo: BattleInfo,

    callbacks: BattleCallback
}

export type EquipmentAfterOtherUnitCastSkillTriggerParam = {
    equipmentId: string,
    self: BaseBattleUnit,

    skillId: AllBattleSkillId

    source: BaseBattleUnit

    currentTurnUnit?: BaseBattleUnit

    battleInfo: BattleInfo,
    thisRoundInfo?: FullBattleAction,

    callbacks: BattleCallback
}

export type EquipmentAfterOtherUnitLossMpTriggerParam = {
    equipmentId: string,
    self: BaseBattleUnit,

    target: BaseBattleUnit
    value: number

    currentTurnUnit?: BaseBattleUnit

    battleInfo: BattleInfo,

    callbacks: BattleCallback
}

export type EquipmentTriggerParam = {
    equipmentId: string,
    self: BaseBattleUnit,

    currentTurnUnit?: BaseBattleUnit

    target?: BaseBattleUnit, // 目标单位

    damageSource?: BaseBattleUnit,
    allies: BaseBattleUnit[],
    enemies: BaseBattleUnit[],
    allAllies: BaseBattleUnit[],
    allEnemies: BaseBattleUnit[],
    battleInfo: BattleInfo,
    thisRoundInfo?: FullBattleAction,

    callbacks: BattleCallback
    castSkillCallback?: SimpleCastSkillActionCallback
    dealDamageCallback?: SimpleBattleTargetDamageActionCallback
    lossMpCallback?: SimpleBattleTargetActionCallback
    restoreMpCallback?: SimpleBattleTargetActionCallback
    healCallback?: SimpleBattleHpRestoreCallback
    addStateCallback?: SimpleBattleTargetAddStateActionCallback
    floatTextCallback?: SimpleFloatTextActionCallback
}

export type EquipmentIgnoreDefenceCalcParam = {
  self: BaseBattleUnit,
  equipmentId: string,
  source: BaseBattleUnit,
  target: BaseBattleUnit,
  oriDefenceIgnore: number,
  latestDefenceIgnore: number,
  damageType: DamageType, // 伤害类型

  battleInfo: BattleInfo,

  allTargets: BaseBattleUnit[]

  causeBy: {
    skillId?: AllBattleSkillId;
    state?: AllBattleStateId;
  };

  dealDamageCallback?: SimpleBattleTargetDamageActionCallback
  lossMpCallback?: SimpleBattleTargetActionCallback
  restoreMpCallback?: SimpleBattleTargetActionCallback
  healCallback?: SimpleBattleTargetActionCallback
  addStateCallback?: SimpleBattleTargetAddStateActionCallback
}

export type EquipmentDamageSourceIgnoreDefencePercentParam = {
  equipmentId: string,

  self: BaseBattleUnit;
  damageSource: BaseBattleUnit;
  source: BaseBattleUnit;
  target: BaseBattleUnit;
  allTargets: BaseBattleUnit[];

  oriDamage: number;

  oriDefenceIgnorePercent: number; // 原始无视防御百分比

  battleInfo: BattleInfo;
  callbacks: BattleCallback;
  damageType: DamageType; // 伤害类型
  causeBy?: {
    skillId?: AllBattleSkillId;
    state?: AllBattleStateId;
  };
};

export type EquipmentBeforeDamageParam = {
  self: BaseBattleUnit,
  equipmentId: string,
  source: BaseBattleUnit,
  target: BaseBattleUnit,
  oriDamage: number,
  reducedDamage: number,
  damageType: DamageType, // 伤害类型

  battleInfo: BattleInfo,

  allTargets: BaseBattleUnit[]

  causeBy: {
    skillId?: AllBattleSkillId;
    state?: AllBattleStateId;
  };

  callbacks: BattleCallback | null | undefined
  dealDamageCallback?: SimpleBattleTargetDamageActionCallback
  lossMpCallback?: SimpleBattleTargetActionCallback
  restoreMpCallback?: SimpleBattleTargetActionCallback
  healCallback?: SimpleBattleTargetActionCallback
  addStateCallback?: SimpleBattleTargetAddStateActionCallback
}

export type EquipmentNeedModifyOriginDamageParam = {
  self: BaseBattleUnit,
  equipmentId: string,
  source: BaseBattleUnit,
  target: BaseBattleUnit,
  oriDamage: number,
  totalExtraDamageBeforeCalcDefence: number,
  damageType: DamageType, // 伤害类型

  battleInfo: BattleInfo,

  allTargets: BaseBattleUnit[]

  causeBy: {
    type: DealDamageCauseByType,
    skillId?: AllBattleSkillId;
    state?: AllBattleStateId;
  };

  callbacks: BattleCallback | null
  dealDamageCallback?: SimpleBattleTargetDamageActionCallback
  lossMpCallback?: SimpleBattleTargetActionCallback
  restoreMpCallback?: SimpleBattleTargetActionCallback
  healCallback?: SimpleBattleTargetActionCallback
  addStateCallback?: SimpleBattleTargetAddStateActionCallback
}

export type EquipmentBeforeDecideDamageTypeParam = {
  self: BaseBattleUnit,
  equipmentId: string,
  source: BaseBattleUnit,
  target: BaseBattleUnit,

  oriDamageType: DamageType
  latestDamageType: DamageType

  battleInfo: BattleInfo,

  allTargets: BaseBattleUnit[]

  causeBy: {
    skillId?: AllBattleSkillId;
    state?: AllBattleStateId;
  };

  dealDamageCallback?: SimpleBattleTargetDamageActionCallback
  lossMpCallback?: SimpleBattleTargetActionCallback
  restoreMpCallback?: SimpleBattleTargetActionCallback
  healCallback?: SimpleBattleTargetActionCallback
  addStateCallback?: SimpleBattleTargetAddStateActionCallback
}

export type EquipmentAfterDamageParam = {
  self: BaseBattleUnit,
  damageSource: BaseBattleUnit, // 造成伤害的来源
  equipmentId: string,
  source: BaseBattleUnit,
  target: BaseBattleUnit,
  oriDamage: number,
  reducedDamage: number,
  damageType: DamageType, // 伤害类型

  hpBeforeTakeDamage: number,

  battleInfo: BattleInfo,

  allTargets: BaseBattleUnit[],

  causeBy: {
    type: DealDamageCauseByType,
    skillId?: AllBattleSkillId;
    state?: AllBattleStateId;
    equipmentId?: AllGameResourceID
  };

  dealDamageCallback?: SimpleBattleTargetDamageActionCallback
  lossMpCallback?: SimpleBattleTargetActionCallback
  restoreMpCallback?: SimpleBattleTargetActionCallback
  healCallback?: SimpleBattleTargetActionCallback
  addStateCallback?: SimpleBattleTargetAddStateActionCallback

  floatTextCallback?: SimpleFloatTextActionCallback

  callbacks: BattleCallback
}

export type EquipmentHealActionParam = {
  self: BaseBattleUnit,
  equipmentId: string,
  source: BaseBattleUnit,
  target: BaseBattleUnit,

  oriHealValue: number,
  actualHealValue: number,

  reason: HpRestoreReason,
  triggerBy?: HealTriggerBy

  battleInfo: BattleInfo,

  callbacks: BattleCallback
}

export type EquipmentStateParam = {
    equipmentId: string,
    self: BaseBattleUnit,
    applier?: BaseBattleUnit,
    target: BaseBattleUnit,

    battleInfo: BattleInfo,

    stateId: AllBattleStateId,
    duration: number,

    addStateCallback?: SimpleBattleTargetAddStateActionCallback
    restoreMpCallback?: SimpleBattleTargetActionCallback

    callbacks?: BattleCallback | null
}

export type EquipmentGetStatusParam = {
    equipmentId: string,
    self: BaseBattleUnit,

    battleInfo: BattleInfo,
    callbacks: BattleCallback

    oriGetStatusKey: AllBaseCharacterStatusType,
    currentGetStatusKey: AllBaseCharacterStatusType,

    statusValue: number,
    onlyBaseStatus: boolean
}

export type EquipmentGetRandomPercent = {
    equipmentId: string,
    self: BaseBattleUnit,

    battleInfo: BattleInfo,
    callbacks: BattleCallback

    oriPercent: number,
}

export type EquipmentRandomPercentPassCheck = {
    equipmentId: string,
    self: BaseBattleUnit,

    battleInfo: BattleInfo,
    callbacks: BattleCallback

    finalGetPercent: number;

    passNeedPercent: number;
}

export type EquipmentModifyStateMaxStack = {
    equipmentId: string,
    self: BaseBattleUnit,

    targetStateId: AllBattleStateId

    battleInfo: BattleInfo,
    // callbacks: BattleCallback

    oriMaxStack: number;
}

export type EquipmentBeforeLossMpParam = {
  self: BaseBattleUnit,
  equipmentId: string,
  source: BaseBattleUnit,
  target: BaseBattleUnit,
  oriLoss: number,
  mpLoss: number,

  reason: MpLossReason

  preCheck: boolean

  lossMpCallback?: SimpleBattleTargetActionCallback
  restoreMpCallback?: SimpleBattleTargetActionCallback
  healCallback?: SimpleBattleTargetActionCallback
}

export type EquipmentSkillOverrideConditionCallbackParam = {
  self: BaseBattleUnit,
  equipmentId: string,
}

export enum BattleRoundStage {
  BATTLE_START = "BATTLE_START", // 战斗开始
  TURN_START = "TURN_START", // 回合开始

  AFTER_EACH_OTHER_UNIT_ACTION = "AFTER_EACH_OTHER_UNIT_ACTION", // 回合开始

  TURN_END = "TURN_END", // 回合结束
  AFTER_SIMPLE_ATTACK = "AFTER_SIMPLE_ATTACK", // 简单攻击后
  // AFTER_TAKE_DAMAGE = "AFTER_TAKE_DAMAGE", // 简单攻击后
  // AFTER_DEAL_DAMAGE = "AFTER_DEAL_DAMAGE", // 简单攻击后
  AFTER_CAST_SKILL = "AFTER_CAST_SKILL", // 简单攻击后

  // BEFORE_TAKE_DAMAGE = "BEFORE_TAKE_DAMAGE", // 受到伤害前
  // BEFORE_DEAL_DAMAGE = "BEFORE_DEAL_DAMAGE", // 造成伤害前
}

export type WorkEquipmentTriggerInfo = {
  extraRewardOnActionFinish?: (param: {equipmentId: string, actionId: AllGameActionID}) => Readonly<GameActionReward[]> | null
  overrideRewardOnActionFinish?: (param: {equipmentId: string, actionId: AllGameActionID}) => Readonly<GameActionReward[]> | null

  extraExpRewardOnActionFinish?: (param: {equipmentId: string, actionId: AllGameActionID}) => Readonly<CharacterStatusImprove[]> | null
}


export type BeforeCastSkillHookResult = {
  cancelCast?: boolean
  cancelReason?: string
}

export type EquipmentTriggerInfo = {
    extraHpRegenWhenTurnStart?: (param: {
      self: BaseBattleUnit;
      battleInfo: BattleInfo;
      equipmentId: AllGameResourceID
    }) => number; // 回合开始时额外的
    extraEnemyCount?: (param: {
      self: BaseBattleUnit;
      battleInfo: BattleInfo;
      equipmentId: AllGameResourceID
    }) => number;
    extraMpRegenWhenTurnStart?: (param: {
      self: BaseBattleUnit;
      battleInfo: BattleInfo;
      equipmentId: AllGameResourceID
    }) => number; // 回合开始时额外的

    onAfterSimpleAttack?: (param: EquipmentTriggerParam) => void | Promise<void>
    onBattleStart?: (param: EquipmentTriggerParam) => void | Promise<void>
    onTurnStart?: (param: EquipmentTriggerParam) => void | Promise<void>

    afterEachOtherUnitAction?: (param: EquipmentAfterEachOtherUnitTurnTriggerParam) => void | Promise<void>

    afterEachOtherUnitAction_selfDead?: (param: EquipmentAfterEachOtherUnitTurnTriggerParam) => void | Promise<void>

    beforeOtherUnitCastSkill?: (param: EquipmentBeforeOtherUnitCastSkillTriggerParam) => BeforeCastSkillHookResult | Promise<BeforeCastSkillHookResult>

    afterOtherUnitCastSkill?: (param: EquipmentAfterOtherUnitCastSkillTriggerParam) => void | Promise<void>

    afterOtherUnitLossMp?: (param: EquipmentAfterOtherUnitLossMpTriggerParam) => void | Promise<void>

    onTurnEnd?: (param: EquipmentTriggerParam) => void
    afterTakeDamage?: (param: EquipmentAfterDamageParam) => void | Promise<void>
    afterDealDamage?: (param: EquipmentAfterDamageParam) => void | Promise<void>
    afterCastSkill?: (param: EquipmentCastSkillTriggerParam) => void | Promise<void>

    afterHealUnit?: (param: EquipmentHealActionParam) => void | Promise<void>
    afterTakeHeal?: (param: EquipmentHealActionParam) => void | Promise<void>

    onAddState?: (param: EquipmentTriggerParam) => void

    // 伤害来源计算伤害
    onNeedModifyOriginDamage?: (param: EquipmentNeedModifyOriginDamageParam) => number | Promise<number>

    beforeTakeDamage?: (param: EquipmentBeforeDamageParam) => number | Promise<number>

    beforeOtherUnitTakeDamage?: (param: EquipmentBeforeDamageParam) => number | Promise<number>

    // 计算防御前的伤害计算
    beforeDamageSourceCalcDamage?: (param: EquipmentBeforeDamageParam) => number

    beforeDamageSourceCalcDefenceIgnore?: (param: EquipmentIgnoreDefenceCalcParam) => number

    onDamageSourceNeedModifyDefenceIgnorePercent?: (param: EquipmentDamageSourceIgnoreDefencePercentParam) => number

    beforeDecideDamageType?: (param: EquipmentBeforeDecideDamageTypeParam) => DamageType

    beforeGetState?: (param: EquipmentStateParam) => { duration: number, } | undefined

    afterGetState?: (param: EquipmentStateParam) => Promise<void> | void

    beforeApplyStateToUnit?: (param: EquipmentStateParam) => { duration: number, } 
    afterApplyStateToUnit?: (param: EquipmentStateParam) => Promise<void> | void

    beforeLossMp?: (param: EquipmentBeforeLossMpParam) => number

    onCalcMaxHpModify?: (param: EquipmentCalcMaxHpParam) => number

    onGetStatus?: (param: EquipmentGetStatusParam) => {
      modifyToStatusKey?: AllBaseCharacterStatusType
    }
    onGetStatusModify?: (param: EquipmentGetStatusParam) => number

    onGetRandomPercentModify?: (param: EquipmentGetRandomPercent) => number

    onRandomPercentPassCheckSuccess?: (param: EquipmentRandomPercentPassCheck) => Promise<void> | void
    onRandomPercentPassCheckFailed?: (param: EquipmentRandomPercentPassCheck) => Promise<void> | void

    onModifyStateMaxStack?: (param: EquipmentModifyStateMaxStack) => { extra: number } | undefined

    onBattleStart_selfDead?: (param: EquipmentTriggerParam) => Promise<void> | void

    calcBattleWinRewardExtraDropRate?: (param: {
      self: BaseBattleUnit;
      battleInfo: BattleInfo;
      callbacks: BattleCallback;
      enemy: Enemy
      equipmentId: AllGameResourceID
      drop: ItemDrop
    }) => number; // 战斗胜利奖励掉落率

    calcBattleWinRewardExtraExpPercent?: (param: {
      self: BaseBattleUnit;
      battleInfo: BattleInfo;
      equipmentId: AllGameResourceID
    }) => number; // 战斗胜利奖励经验加成百分比

    skillOverride?: {
      [skillId in AllBattleSkillId]?: {
        condition?: (param: EquipmentSkillOverrideConditionCallbackParam) => boolean
        effect?: GameBattleSkillEffectCallback
        preCheck?: GameBattleSkillEffectCheckCallback
        hideSkillCastText?: boolean
      }
    }
}

export type BattleItemTriggerParam = {
    itemId: string,
    self: BaseBattleUnit,
    battleInfo: BattleInfo,
    callbacks: BattleCallback
}
export type BattleItemTriggerInfo = {
    onUse?: (param: BattleItemTriggerParam) => void | Promise<void>
}

export type SimpleSourceTargetActionCallback = (obj: {
  source: BaseBattleUnit,
  target: BaseBattleUnit,
  color: string,
}) => void

export type SimpleBattleTargetActionCallback = (obj: {
  source: BaseBattleUnit,
  target: BaseBattleUnit,
  value: number
}) => void

export type SimpleBattleHpRestoreCallback = (obj: {
  source: BaseBattleUnit,
  target: BaseBattleUnit,
  value: number,
  reason: HpRestoreReason
}) => void
export type SimpleBattleMpRestoreCallback = (obj: {
  source: BaseBattleUnit,
  target: BaseBattleUnit,
  value: number,
  reason: MpRestoreReason
}) => void

export type SimpleBattleTargetAddStateActionCallback = (obj: {
  source: BaseBattleUnit,
  target: BaseBattleUnit,
  value: number,
  stateId: AllBattleStateId
}) => void

export type DealDamageTargetDetail = {
  unit: BaseBattleUnit;
  causeBy: {
    skillId?: AllBattleSkillId;
    state?: AllBattleStateId;
  };
  damageType: DamageType;
  shieldDamage?: number; // 如果有护盾伤害
  value: number;
  fDamage: number; // 最终伤害
  remainingHp: number;
};
export type SimpleBattleTargetDamageActionCallback = (obj: {
  source: BaseBattleUnit,
  target: DealDamageTargetDetail[]

  hideAnimEffect_Line?: boolean
}) => void

export type SimpleCastSkillActionCallback = (obj: {
  source: BaseBattleUnit,
  skillId: AllBattleSkillId,
}) => void

export type SimpleFloatTextActionCallback = (obj: {
  unit: BaseBattleUnit,
  text: string,

  hidePopover?: boolean
}) => void

export type SimpleIncreaseItemActionCallback = (obj: {
  unit: BaseBattleUnit,
  resource: ItemCountInfo
}) => void

export enum DealDamageCauseByType {
  Attack = "attack",
  Skill = "skill",
  State = "state",
  Equipment = "equipment",
  Item = "item",
  Other = "other"
}
export type DealDamageOption = {
  ignoreDefence?: boolean
  ignoreDefenceValue?: number
  ignoreDefencePercent?: number

  battleInfo: BattleInfo,

  damageType: DamageType,

  ignoreDealDamageCallback?: boolean

  callbacks?: BattleCallback
  dealDamageCallback?: SimpleBattleTargetDamageActionCallback

  allTargets?: BaseBattleUnit[]

  maxDamage?: (target: BaseBattleUnit) => number

  causeBy?: {
    type: DealDamageCauseByType,
    skillId?: AllBattleSkillId;
    state?: AllBattleStateId;
    equipmentId?: AllGameResourceID
  }

  ignoreTrigger?: boolean

  hideAnimEffect_Line?: boolean

  triggerWhiteList?: {
    equipment?: string[]
  }
}
export type CastSkillExtraParam = {
  hideSkillCastText?: boolean
  damageParam?: {
    extraDamage?: number
  } & Partial<Pick<DealDamageOption, 'ignoreDefence' | 'ignoreDefencePercent' | 'damageType' | 'ignoreTrigger'>>

  // 指定的单位
  specificTarget?: BaseBattleUnit[]

  ignoreAfterSimpleAttackTrigger?: boolean
  ignoreAfterCastSkillTrigger?: boolean

  ignoreControl?: boolean
  ignoreMpCost?: boolean
  ignoreColddown?: boolean

  ignoreCastColddown?: boolean

  damageModifyPercent?: number
}