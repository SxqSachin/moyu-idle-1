// Central skill tree type definitions (method-based API)
// NOTE: This is the new authoritative type module. Array-based fields (levels, requires) are deprecated.

import type { BattleCallback, BattleInfo } from "./battle";
import type { AllBaseCharacterStatusType, AllCharacterStatusType, CharacterEquipmentPart } from "./characterInfo";
import type { Enemy, ItemDrop } from "./emeny";
import type { AllGameActionID } from "./gameAction";
import type { AllGameResourceID } from "./gameResource";
import type { DamageType } from "./skill";
import type { BaseBattleUnit } from "./unit";

// ---------------- Effect Type System ----------------
// Restored union-based stat effects (previously commented out). This is still needed
// by aggregation / formatting logic. Authoring remains array-of-effects per level.
// export type StatEffectKind = 'flat' | 'percentAdd' | 'percentMul' | 'flag'

// export interface StatEffectBase {
//   /** A semantic key, e.g. 'maxHp', 'physicalDamage', 'unlock_berserk'. */
//   key?: string
//   kind: StatEffectKind
//   /** Optional description for UI tooltip */
//   desc?: string
// }

// export interface FlatEffect extends StatEffectBase {
//   kind: 'flat'
//   key: string
//   value: number
// }
// export interface PercentAddEffect extends StatEffectBase {
//   kind: 'percentAdd'
//   key: string
//   value: number // e.g. 0.15 for +15%
// }
// export interface PercentMulEffect extends StatEffectBase {
//   kind: 'percentMul'
//   key: string
//   value: number // internal stored multiplier delta (e.g. 0.10 meaning *1.10). Aggregator multiplies (1+value)
// }
// export interface FlagEffect extends StatEffectBase {
//   kind: 'flag'
//   key: string
//   value?: true
// }

export type StatEffect = {
  desc: string;
}
// FlatEffect | PercentAddEffect | PercentMulEffect | FlagEffect

// Central skill tree type definitions (method-based API)
// NOTE: This is the new authoritative type module. Array-based fields (levels, requires) are deprecated.

// Helper type guard for runtime safety when filtering placeholder objects
export function isStatEffect(obj: any): obj is StatEffect {
  return obj && typeof obj === 'object' && typeof obj.kind === 'string' &&
    (obj.kind === 'flag' || (typeof obj.key === 'string' && obj.key.length > 0))
}

export interface SkillTreeLevelDef {
  /** Price to allocate this level (1-based external level notion, but index is zero-based). */
  cost: number
  /** Effects applied upon owning this specific level (cumulative across acquired levels). */
  effects: StatEffect
  /** Optional free-form label for UI; if omitted, UI can auto-number. */
  label?: string
  /** Optional level description override (UI). */
  desc?: string
}

// Prerequisite types
export interface SkillPointRequirement { type: 'skillPointsSpent'; value: number }
export interface NodeLevelRequirement { type: 'nodeLevel'; nodeId: string; level: number }
export interface AttributeRequirement { type: 'attribute'; key: string; value: number }
export interface StatusLevelRequirement { type: 'status'; key: string; value: number }
export interface FlagRequirement { type: 'flag'; flag: string }
export interface MutuallyExclusiveRequirement { type: 'notWith'; nodeId: string }

export type SkillTreeRequirement =
  | SkillPointRequirement
  | NodeLevelRequirement
  | AttributeRequirement
  | StatusLevelRequirement
  | FlagRequirement
  | MutuallyExclusiveRequirement

export interface RequirementContext {
  nodeLevels: Record<string, number>
  pointsSpent: number
  attributes: Record<string, number>
  statusLevels: Record<string, number>
  currentNode: Readonly<SkillTreeNode>
  allNodes: ReadonlyArray<SkillTreeNode>
}

export interface RequirementCheckResult {
  unmet: boolean
  reason: string
}

// Business effects (already aggregated to higher-level semantics used by gameplay systems)
export interface BusinessEffects {
    actionDurationEffect?: (level: number) => {
        actionId: AllGameActionID,
        modifyPercent: number
    }[]

    actionExtraRewardEffect?: (level: number) => {
        actionId: AllGameActionID,
        modifyPercent: number,
        desc: string,
    }[]

    actionReturnDeductEffect?: (level: number) => {
        actionId: AllGameActionID,
        modifyPercent: number,
        deductResourceReturnPercent: number,
        desc: string,
    }[]

    actionExpRewardEffect?: (level: number) => {
        actionId: AllGameActionID,
        modifyPercent: number
    }[]

    statusModifyEffect?: (level: number) => {
        status: AllBaseCharacterStatusType,
        modifyNumber: number
    }[]
}
// export type BusinessEffectsProvider = (level: number) => BusinessEffectsProviderResult


export interface BusinessBattleEffects {
  onBattleStart?: (opt: {
    level: number;
    self: BaseBattleUnit;
    battleInfo: BattleInfo
    callbacks: BattleCallback;
  }) => Promise<void> | void;

  onNeedModifyOriginDamage?: (opt: {
    level: number;
    self: BaseBattleUnit;
    target: BaseBattleUnit;
    damageType: DamageType;
    battleInfo: BattleInfo;
    totalExtraDamageBeforeCalcDefence: number;
    originDamage: number;
    callbacks: BattleCallback;
  }) => Promise<number> | number;

  onBeforeTakeDamage?: (opt: {
    level: number;
    self: BaseBattleUnit;
    damageSource: BaseBattleUnit;
    target: BaseBattleUnit;
    battleInfo: BattleInfo;
    damageType: DamageType;
    reducedDamage: number;
    callbacks: BattleCallback;
  }) => Promise<number> | number;

  extraHpRegenWhenTurnStart?: (param: {
    self: BaseBattleUnit;
    level: number
  }) => number; // 回合开始时额外的
  extraMpRegenWhenTurnStart?: (param: {
    self: BaseBattleUnit;
    level: number
  }) => number; // 回合开始时额外的

  calcBattleWinRewardExtraDropRate?: (param: {
    self: BaseBattleUnit;
    battleInfo: BattleInfo;
    enemy: Enemy
    level: number,
    drop: ItemDrop
  }) => number; // 战斗胜利奖励掉落率

  calcBattleWinRewardExtraDropCount?: (param: {
    self: BaseBattleUnit;
    battleInfo: BattleInfo;
    level: number,
  }) => number; // 战斗胜利奖励掉落率


  hpModifyEffect?: (level: number) => {
      modifyNumber: number
  }
}

// New method-based node definition
export interface SkillTreeNode {
  id: string
  name: string
  /** Category or group for styling / filtering */
  group?: string
  /** Tier / depth information, if still used for layout. */
  tier: number
  /** Arbitrary icon ref */
  icon?: string
  /** Optional textual summary */
  description?: string
  /** Returns maximum number of levels (>=1). */
  maxLevel: number

  ui?: { 
    x?: number, 
    y?: number, 
    branch?: string,
  },

  /** Returns definition of a specific level (0 <= index < getMaxLevel()). */
  getLevelDef(level: number): SkillTreeLevelDef

  /** Returns prerequisite list for purchasing (nextLevel is 1-based target level). */
  getRequires?: (nextLevel: number) => SkillTreeRequirement[] | undefined

  /** Business layer synthesized or custom provider. */
  businessEffects?: BusinessEffects
  businessBattleEffects?: BusinessBattleEffects

  enableBattleEquipSlot?: CharacterEquipmentPart[]
  disableBattleEquipSlot?: CharacterEquipmentPart[]

  /** Optional internal tag to mark node types (e.g., 'autoDerived'). */
  tags?: string[]
  /** List of node ids that are mutually exclusive with this one; convenience mirror if using requirement type later. */
  mutuallyExclusiveWith?: string[]
}

export interface SkillTreeDef {
  id: string
  name: string
  nodes: Readonly<SkillTreeNode[]>
  /** Optional overall description */
  description?: string
}

// Removed all legacy array-authored types. Author nodes directly with SkillTreeNode.
export type SkillTreeId = 'battle' | 'life'

// ---------------------------------------------------------------------------
// Runtime structures (moved from server/utils/game/skillTree.ts)
// ---------------------------------------------------------------------------
export interface SkillTreeNodeRuntimeInfo {
  nodeId: string
  level: number
  maxLevel: number
  investedCost: number
  nextCost: number | null
  canAllocate: boolean
  canDeallocate: boolean
  unmetReasons: string[]
}

// 精简版 Summary：仅保留点数账本 + 节点等级映射。
// 其余运行时（investedCost / nextCost / unmetReasons / canAllocate 等）前端自行根据静态定义与等级推导。
export interface SkillTreeSummary {
  treeId: SkillTreeId | string
  totalEarned: number
  totalSpent: number
  effectiveSpent: number
  available: number
  /** 节点当前等级映射（未出现的默认为 0） */
  nodeLevels: Record<string, number>
  /** 可选：节点未满足前置列表映射（目标等级=当前level+1 时的 unmetReasons，可选优化减少前端重复计算） */
  unmetReasons?: Record<string, string[]>
  /** 节点是否可进行下一次加点（可学习） */
  canAllocate?: Record<string, boolean>

  formulaEarned?: number
  bonusEarned?: number
}

export interface AggregatedSkillTreeEffects {
  treeId: SkillTreeId | string
  flat: Record<string, number>
  percentAdd: Record<string, number>
  percentMul: Record<string, number>
  flags: string[]
}

export interface AggregatedBusinessEffects {
  treeId: SkillTreeId | string
  numbers: Record<string, number>
  arrays: Record<string, any[]>
  flags?: string[]
}

export interface LearnedSkillFlatItem {
  treeId: string;
  nodeId: string;
  level: number;
}