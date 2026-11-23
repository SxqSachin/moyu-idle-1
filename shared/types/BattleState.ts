import type { allBattleState, allGlobalActionEffectState, allGlobalOtherEffectState, allGlobalStatusEffectState } from "../data/allBattleState"
import type { BattleCallback, BattleInfo, DealDamageCauseByType, FullBattleAction, HealTriggerBy, HpRestoreReason, MpLossReason, SimpleBattleTargetActionCallback, SimpleBattleTargetAddStateActionCallback, SimpleBattleTargetDamageActionCallback, SimpleFloatTextActionCallback } from "./battle"
import type { CharacterStatusImprove, CharacterStatusLevelImprove, CharacterStatusLevelModify } from "./characterInfo";
import type { Enemy, ItemDrop } from "./emeny";
import type { AllGameActionID } from "./gameAction";
import type { AllGameResourceID } from "./gameResource";
import type { AllBattleSkillId, DamageType } from "./skill"
import type { BaseBattleUnit } from "./unit"

export enum StateEffectTriggerWhen {
    TURN_START = "turn_start", // 回合开始时触发
    TURN_END = "turn_end", // 回合结束时触发
    ON_ATTACH = "attach", // 回合结束时触发
    AFTER_TAKE_DAMAGE= "after_take_damage", // 回合结束时触发
    BEFOREA_CALC_DAMAGE = "before_calc_damage", // 回合结束时触发
    MANUAL = "manual", // 手动触发
}

export type BattleState = {
  id: string;
  name: string;
  description: string;

  duration: number;
  permanent?: boolean;

  isPactState?: boolean; // 是否为契约状态

  isBuff?: boolean;
  isDebuff?: boolean;

  unremovable?: boolean;

  consumeTurn: boolean; // 是否占用回合

  // 禁止释放技能
  forbidCastSkill?: boolean;
  // 禁止复活
  forbidRevive?: boolean;

  // 无视取消技能释放的状态
  forbidCancelSkillCast?: boolean;

  StateEffectTriggerWhen: StateEffectTriggerWhen;

  keepOnDeath?: boolean; // 是否在死亡后保留状态

  ignoreStandaloneTurn?: boolean;

  stackable?: boolean;
  maxStack?: number;

  onGlobalStatusEffectAttach?: (param: {
    value: number
  }) => CharacterStatusLevelModify[];

  onGlobalActionDurationEffectAttach?: (param?: {
  }) => {
    actionId: AllGameActionID
    modifyPercent: number
  }[]
  onCalcTaskDoneExtraRewardPercent?: (param: {
    actionId: AllGameActionID
  }) => {
    percent: number,
    desc: string,
  } | false

  afterEachOtherUnitAction?: (param: {
    self: BaseBattleUnit;
    currentTurnUnit: BaseBattleUnit;
    battleInfo: BattleInfo;
    thisState: BattleStateInBattle;
    callbacks: BattleCallback;
  }) => void | Promise<void>;

  extraHpRegenWhenTurnStart?: (param: {
    self: BaseBattleUnit;
    allies: BaseBattleUnit[];
    enemies: BaseBattleUnit[];
    battleInfo: BattleInfo;
    thisState: BattleStateInBattle;
  }) => number; // 回合开始时额外的
  extraMpRegenWhenTurnStart?: (param: {
    self: BaseBattleUnit;
    allies: BaseBattleUnit[];
    enemies: BaseBattleUnit[];
    battleInfo: BattleInfo;
    thisState: BattleStateInBattle;
  }) => number; // 回合开始时额外的

  onBattleStart?: (param: {
    self: BaseBattleUnit;
    source?: BaseBattleUnit;
    target?: BaseBattleUnit;
    enemies?: BaseBattleUnit[];
    battleInfo: BattleInfo;
    thisState?: BattleStateInBattle;
    callbacks: BattleCallback
  }) => void | Promise<void>;

  effect?: (obj: {
    self: BaseBattleUnit;
    allies: BaseBattleUnit[];
    enemies: BaseBattleUnit[];
    battleInfo: BattleInfo;
    thisState?: BattleStateInBattle;
    callbacks: BattleCallback;
    dealDamageCallback?: SimpleBattleTargetDamageActionCallback;
    takeDamageCallback?: SimpleBattleTargetActionCallback;
    healCallback?: SimpleBattleTargetActionCallback;
    lossMpCallback?: SimpleBattleTargetActionCallback;
    restoreMpCallback?: SimpleBattleTargetActionCallback;
    addStateCallback?: SimpleBattleTargetAddStateActionCallback;
  }) => FullBattleAction | undefined | void | Promise<FullBattleAction | undefined | void>

  onAttach?: (obj: {
    source: BaseBattleUnit;
    target?: BaseBattleUnit;
    thisState?: BattleStateInBattle;
    battleInfo: BattleInfo;

    extraAttachStack?: number;

    callbacks?: BattleCallback | null;
    dealDamageCallback?: SimpleBattleTargetDamageActionCallback;
    takeDamageCallback?: SimpleBattleTargetActionCallback;
    healCallback?: SimpleBattleTargetActionCallback;
    lossMpCallback?: SimpleBattleTargetActionCallback;
    restoreMpCallback?: SimpleBattleTargetActionCallback;
    floatTextCallback?: SimpleFloatTextActionCallback;
  }) => FullBattleAction | void | undefined | Promise<FullBattleAction | void | undefined>;
  onDetach?: (obj: {
    self: BaseBattleUnit;
    source?: BaseBattleUnit;
    target?: BaseBattleUnit;
    enemies?: BaseBattleUnit[];
    battleInfo?: BattleInfo;
    thisState?: BattleStateInBattle;
    callbacks?: BattleCallback | null;
  }) => void;

  onReduceStack?: (obj: {
    self: BaseBattleUnit;
    source?: BaseBattleUnit;
    target?: BaseBattleUnit;
    enemies?: BaseBattleUnit[];
    battleInfo?: BattleInfo;
    thisState?: BattleStateInBattle;
    callbacks?: BattleCallback | null;
    reduceCount: number; // 减少的层数
  }) => void;

  onBeforeLossMp?: (obj: {
    state: BattleStateInBattle;
    self: BaseBattleUnit;
    damageSource: BaseBattleUnit;
    target: BaseBattleUnit;
    oriLoss: number;
    mpLoss: number;
    reason: MpLossReason;
    preCheck: boolean;
  }) => number;

  onNeedModifyOriginDamage?: (obj: {
    state: BattleStateInBattle;
    self: BaseBattleUnit;
    damageSource: BaseBattleUnit;
    target: BaseBattleUnit;
    allTargets: BaseBattleUnit[];
    oriDamage: number;
    battleInfo: BattleInfo;
    totalExtraDamageBeforeCalcDefence: number;
    callbacks: BattleCallback;
    damageType: DamageType; // 伤害类型
    causeBy?: {
      skillId?: AllBattleSkillId;
      state?: AllBattleStateId;
    };
  }) => number;

  onDamageSourceNeedModifyDefenceIgnorePercent?: (param: {
    state: BattleStateInBattle;

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
  }) => number;

  onBeforeDamageSourceCalcDamage?: (obj: {
    state: BattleStateInBattle;
    self: BaseBattleUnit;
    damageSource: BaseBattleUnit;
    target: BaseBattleUnit;
    allTargets: BaseBattleUnit[];
    oriDamage: number;
    reducedDamage: number;
    damageType: DamageType; // 伤害类型
    battleInfo: BattleInfo;
    callbacks: BattleCallback;
    causeBy?: {
      skillId?: AllBattleSkillId;
      state?: AllBattleStateId;
    };
  }) => number;

  onBeforeTakeDamage?: (obj: {
    state: BattleStateInBattle;
    self: BaseBattleUnit;
    damageSource: BaseBattleUnit;
    target: BaseBattleUnit;
    allTargets: BaseBattleUnit[];
    battleInfo: BattleInfo;
    callbacks: BattleCallback;
    oriDamage: number;
    reducedDamage: number;
    damageType: DamageType; // 伤害类型
  }) => number | Promise<number>;

  afterTakeDamage?: (obj: {
    state: BattleStateInBattle;
    self: BaseBattleUnit;
    damageSource: BaseBattleUnit;
    target: BaseBattleUnit;
    allTargets: BaseBattleUnit[];
    hpBeforeTakeDamage: number;
    oriDamage: number;
    reducedDamage: number;
    damageType: DamageType; // 伤害类型
    battleInfo?: BattleInfo | null;
    callbacks?: BattleCallback | null;

    causeBy: {
      type: DealDamageCauseByType;
      skillId?: AllBattleSkillId;
      state?: AllBattleStateId;
      equipmentId?: AllGameResourceID;
    };
  }) => void | Promise<void>;
  afterDealDamage?: (obj: {
    state: BattleStateInBattle;
    self: BaseBattleUnit;
    damageSource: BaseBattleUnit;
    target: BaseBattleUnit;
    allTargets: BaseBattleUnit[];
    oriDamage: number;
    reducedDamage: number;
    battleInfo: BattleInfo;
    callbacks: BattleCallback;
    damageType: DamageType; // 伤害类型

    causeBy: {
      type: DealDamageCauseByType;
      skillId?: AllBattleSkillId;
      state?: AllBattleStateId;
      equipmentId?: AllGameResourceID;
    };
  }) => void | Promise<void>;

  afterCastSkill?: (obj: {
    thisState: BattleStateInBattle;

    skillId: AllBattleSkillId;

    self: BaseBattleUnit;
    battleInfo: BattleInfo;
    callbacks: BattleCallback;
    thisRoundInfo?: FullBattleAction;
  }) => void | Promise<void>;

  afterOtherUnitCastSkill?: (param: {
    thisState: BattleStateInBattle;
    skillId: AllBattleSkillId

    self: BaseBattleUnit,
    source: BaseBattleUnit

    currentTurnUnit?: BaseBattleUnit

    battleInfo: BattleInfo,
    callbacks: BattleCallback
  }) => void | Promise<void>

  afterOtherUnitLossMp?: (param: {
    thisState: BattleStateInBattle;

    value: number;

    self: BaseBattleUnit,
    target: BaseBattleUnit

    currentTurnUnit?: BaseBattleUnit

    battleInfo: BattleInfo,
    callbacks: BattleCallback
  }) => void | Promise<void>

  onBeforeTakeHeal?: (obj: {
    state: BattleStateInBattle;

    self: BaseBattleUnit;
    source: BaseBattleUnit;
    target: BaseBattleUnit;
    battleInfo: BattleInfo;
    callbacks: BattleCallback;

    oriHeal: number;

    finalHeal: number;
  }) => number | Promise<number>;

  afterTakeHeal?: (param: {
    thisState: BattleStateInBattle;

    self: BaseBattleUnit,
    source: BaseBattleUnit,
    target: BaseBattleUnit,

    oriHealValue: number,
    actualHealValue: number,

    reason: HpRestoreReason,
    triggerBy?: HealTriggerBy

    battleInfo: BattleInfo,

    callbacks: BattleCallback
  }) => void | Promise<void>

  afterSimpleAttack?: (obj: {
    thisState: BattleStateInBattle;

    self: BaseBattleUnit;
    battleInfo: BattleInfo;
    thisRoundInfo?: FullBattleAction;
    callbacks: BattleCallback;
    dealDamageCallback?: SimpleBattleTargetDamageActionCallback;
  }) => void | Promise<void>;

  onBeforeApplyStateToUnit?: (obj: {
    thisState: BattleStateInBattle;

    self: BaseBattleUnit;
    applier?: BaseBattleUnit;
    target: BaseBattleUnit;
    // battleInfo: BattleInfo;
    // thisRoundInfo?: FullBattleAction,

    stateId: AllBattleStateId;
    duration: number;
  }) => {
    duration: number;
  };

  onBeforeGetState?: (obj: {
    thisState: BattleStateInBattle;

    self: BaseBattleUnit;
    source: BaseBattleUnit;

    stateId: AllBattleStateId;
    duration: number;

    callbacks?: BattleCallback;
    battleInfo?: BattleInfo;
  }) => {
    cancel?: boolean;
    duration: number;
  } | void;

  calcBattleWinRewardExtraDropRate?: (param: {
    self: BaseBattleUnit;
    battleInfo: BattleInfo;
    callbacks: BattleCallback;
    enemy: Enemy;
    thisState: BattleStateInBattle;
    drop: ItemDrop;
  }) => number; // 战斗胜利奖励掉落率

  calcBattleWinRewardExtraDropCount?: (param: {
    self: BaseBattleUnit;
    battleInfo: BattleInfo;
    callbacks: BattleCallback;
    enemy: Enemy;
    thisState: BattleStateInBattle;
    drop: ItemDrop;
  }) => number; // 战斗胜利奖励掉落率

  calcBattleWinExtraExpPercent?: (param: {
    self: BaseBattleUnit;
    battleInfo: BattleInfo;
    thisState: BattleStateInBattle;
  }) => number; // 战斗胜利额外经验百分比


  onRandomPercentPassCheckSuccess?: (param: {
    thisState: BattleStateInBattle;
    self: BaseBattleUnit,

    battleInfo: BattleInfo,
    callbacks: BattleCallback

    finalGetPercent: number;

    passNeedPercent: number;
  }) => Promise<void> | void
  onRandomPercentPassCheckFailed?: (param: {
    thisState: BattleStateInBattle;
    self: BaseBattleUnit,

    battleInfo: BattleInfo,
    callbacks: BattleCallback

    finalGetPercent: number;

    passNeedPercent: number;
  }) => Promise<void> | void
};

export type BattleStateInBattleExtraInfo = {
    thisStateActuralValue?: number
    thisStateActuralValueUnit?: 'number' | 'percent' | undefined

    stack?: number

    readableDesc?: {
        [key: string]: string // 可读描述
    }

    [key: string]: any
}

export type BattleStateInBattle = {
    id: AllBattleStateId

    addBy: string // 添加者的UUID

    duration: number
    remainingDuration: number
    triggered: boolean

    extra?: BattleStateInBattleExtraInfo
}

export type AllBattleStateId = keyof typeof allBattleState
export type AllGlobalStatusEffectStateId = keyof typeof allGlobalStatusEffectState
export type AllGlobalOtherEffectStateId = keyof typeof allGlobalOtherEffectState
export type AllGlobalActionDurationEffectStateId = keyof typeof allGlobalActionEffectState
export type AllGlobalEffectStateId = AllGlobalStatusEffectStateId | AllGlobalOtherEffectStateId