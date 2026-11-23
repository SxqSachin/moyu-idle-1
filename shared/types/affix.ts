// 随机词条类型定义（简化版）
// 说明：数据库仅持久化 CharacterAffix / CharacterAffixLog；
// 词条“定义”和“词条池”在代码侧（shared/data）维护，便于快速迭代与版本控制。

import type { MinMax } from "."
import type { GameEffectActionAboutStatus } from "./gameEffect"
import type { ItemCountInfo } from "./gameInventory"
import type { AllBaseCharacterStatusType, CharacterStatusDetail, CharacterStatusInfo } from "./characterInfo"
import type { BattleCallback, BattleInfo } from "./battle"
import type { DamageType } from "./skill"
import type { BaseBattleUnit } from "./unit"

// 稀有度 / 词条状态（与数据库枚举保持一致）
export type AffixRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
export type CharacterAffixState = 'ACTIVE' | 'INACTIVE' | 'LOCKED'

// 数值区间：模板阶段支持区间，落地实例需解析为具体数值
export type NumericRange = MinMax
export type RangeOrFixed = number | NumericRange

// 与现有装备/状态一致的回调集合（精简版）
// 说明：签名保持宽松（any），由引擎侧负责具体上下文
export type AffixKeyHooks = Partial<{
  onCalcStatus: (ctx: {characterStatus: CharacterStatusInfo, effect: AffixEffectResolved}) => {[key in AllBaseCharacterStatusType]?: number}

  onModifyMaxHp: (ctx: {characterStatus: CharacterStatusInfo, effect: AffixEffectResolved}) => {maxHp?: number}

  onDamageSourceNeedModifyDefenceIgnorePercent?: (param: {
    self: BaseBattleUnit;
    target: BaseBattleUnit;

    effect: AffixEffectResolved

    oriDamage: number;

    oriDefenceIgnorePercent: number; // 原始无视防御百分比

    battleInfo: BattleInfo;
    callbacks: BattleCallback;
    damageType: DamageType; // 伤害类型
  }) => number;


  onBattleStart: (ctx: any) => any | Promise<any>
  onTurnStart: (ctx: any) => any | Promise<any>
  onTurnEnd: (ctx: any) => any | Promise<any>

  // 战斗修正类
  onNeedModifyOriginDamage: (ctx: any) => number | void
  beforeTakeDamage: (ctx: any) => number | void
  afterTakeDamage: (ctx: any) => any | Promise<any>
  afterDealDamage: (ctx: any) => any | Promise<any>
  beforeDamageSourceCalcDefenceIgnore: (ctx: any) => number | void
  beforeDamageSourceCalcDamage: (ctx: any) => number | void

  // 常用便捷回调
  extraHpRegenWhenTurnStart: (ctx: any) => number
  extraMpRegenWhenTurnStart: (ctx: any) => number
  onAfterSimpleAttack: (ctx: any) => any | Promise<any>
  calcBattleWinRewardExtraDropRate: (ctx: any) => number
  calcBattleWinRewardExtraExpPercent: (ctx: any) => number
}>

// 以 key 的形式表达词条效果（对齐 allBattleState / allEquipmentTriggerData 的回调风格）
// 模板阶段允许区间；实例阶段需为确定值；并可直接内嵌回调
// 模板阶段的 statusEffect：支持数值或区间
export type AffixStatusEffectTemplate = {
  status: AllBaseCharacterStatusType
} & (
  | { increase: RangeOrFixed; decrease?: never }
  | { decrease: RangeOrFixed; increase?: never }
)

// payload 模板：允许直接给定区间，或带元信息的对象 { value, name?, unit? }
export type AffixPayloadValueTemplate = RangeOrFixed | { value: RangeOrFixed; name?: string; unit?: string }
export type AffixPayloadTemplate = RangeOrFixed | Record<string, AffixPayloadValueTemplate>

// 固定成员：用于自定义的范围值（更聚焦，便于调用方与渲染统一）
export type AffixCustomValueTemplate = RangeOrFixed | { value: RangeOrFixed; name?: string; unit?: string }
export type AffixCustomTemplate = RangeOrFixed | Record<string, AffixCustomValueTemplate>

export type AffixKeyTemplate = {
  statusEffect?: AffixStatusEffectTemplate[]
  // 可选通用负载：用于定义回调可读取的参数（支持区间/命名）
  // 例如：{ perLuck: { value: { min: 0.3, max: 1.0 }, name: '每点幸运加成' } }
  payload?: AffixPayloadTemplate
  // 固定成员：建议优先使用 custom 作为自定义范围值的承载位置
  custom?: AffixCustomTemplate
} & AffixKeyHooks

export type AffixKeyInstance = {
  // 负载：已解析为确定值（可为对象，但不再包含区间）
  statusEffect?: GameEffectActionAboutStatus[]
  payload?: number | Record<string, number>
  // 固定成员：自定义范围值解析结果
  custom?: number | Record<string, number>
}

// A definition can provide multiple effect keys
// 模板效果：单个模板对象（不再是数组）
export type AffixEffectTemplate = AffixKeyTemplate
// Instance effect: single resolved effect block (not an array)
export type AffixEffectResolved = AffixKeyInstance

// 词条定义（代码侧）：最小可用集合
export interface AffixDefinition {
  affixId: string // 唯一 ID（代码内约定）
  name: string
  rarity: AffixRarity
  effect: AffixEffectTemplate // 由多个 key 组成，每个 key 由注册表实现具体效果
  description?: string
  tags?: string[] // 可选标签，用于筛选/分组
}

// 词条池规则（代码侧）：控制抽取数量/是否允许重复/稀有度权重
export interface AffixPoolRules {
  count: { min: number; max: number }
  rarityWeight?: Partial<Record<AffixRarity, number>>
  // 单次抽取（每生成1条词条）的资源消耗；总消耗 = 单次消耗 * 本次抽取数量
  costPerRoll?: ItemCountInfo
  // 重抽（reroll）消耗：根据词条稀有度分别定义
  rerollCostPerRarity?: Partial<Record<AffixRarity, ItemCountInfo>>
  // 进阶重随（rerollUp）消耗：根据词条稀有度分别定义（若未配置则回退到 rerollCostPerRarity）
  rerollUpCostPerRarity?: Partial<Record<AffixRarity, ItemCountInfo>>
  // 稀有度升级消耗：按“当前稀有度”定义升级到下一稀有度的消耗；LEGENDARY 无下一档可不填
  rarityUpgradeCostPerRarity?: Partial<Record<AffixRarity, ItemCountInfo>>
}

// 词条池条目：把定义加入池，并可给定独立权重/附加筛选
export interface AffixPoolEntry {
  affixId: string
  weight?: number // 抽取权重（不放在定义上，避免重复/歧义）
  tags?: string[]
}

// 词条池（代码侧）：按玩法/来源划分
export interface AffixPool {
  poolId: string
  name: string
  rules?: AffixPoolRules
  entries: AffixPoolEntry[]
}

// 角色持有的词条实例（与数据库结构对应）
export interface CharacterAffixInstance {
  id?: number
  userUuid?: string
  characterUuid?: string
  affixId: string
  rarity: AffixRarity
  effect: AffixEffectResolved // 单个效果块（每条词条一条记录，不再是数组）
  score?: number
  state?: CharacterAffixState
  source?: string
  seed?: string
  version?: number
  createdAt?: string
  updatedAt?: string
}

// 词条操作日志（与数据库结构对应）
export interface CharacterAffixLogEntry {
  id?: number
  userUuid?: string
  characterUuid?: string
  action: 'INITIALIZE' | 'REROLL' | 'ADD' | 'REMOVE' | 'UPDATE'
  before?: CharacterAffixInstance[]
  after?: CharacterAffixInstance[]
  cost?: unknown // 例如 { gold: 100, items: [...] }
  result?: unknown
  createdAt?: string
}

// 判断是否为区间
export function isNumericRange(v: RangeOrFixed): v is NumericRange {
  return typeof v === 'object' && v !== null && 'min' in v && 'max' in v
}

// 注意：已移除处理器注册表/工厂等间接层，回调直接内嵌在 AffixKeyTemplate/Instance 中

// 工具：将区间/固定值解析为固定数字
export function resolveRange(value: RangeOrFixed, rnd: () => number = Math.random): number {
  if (typeof value === 'number') return value
  const min = Math.min(value.min, value.max)
  const max = Math.max(value.min, value.max)
  const bothIntegers = Number.isInteger(min) && Number.isInteger(max)
  if (bothIntegers) {
    // 整数区间：保持离散均匀，含两端
    return min + Math.floor((max - min + 1) * rnd())
  }
  // 非整数区间：连续均匀，限制在 [min, max]
  const x = min + (max - min) * rnd()
  // 规避浮点边界导致的越界
  const clamped = Math.max(min, Math.min(max, x))
  // 可按需量化精度（例如保留两位小数）
  return Number(clamped.toFixed(3))
}
