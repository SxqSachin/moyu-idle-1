import type { AffixDefinition, AffixKeyTemplate, AffixRarity } from '@/shared/types/affix'
import type { CharacterStatusInfo } from '~/shared/types/characterInfo'

/**
 * 生成基础状态提升词条（支持单一或多个 status），按 5 个稀有度输出一组定义。
 *
 * - 命名规则：`${baseName}·${中文后缀}`，例：力量·新芽 / 属性提升·新芽
 * - affixId 规则：`${baseId}_${suffixKey}_${rarity.toLowerCase()}`
 * - 多状态：一个词条里可同时提升多个 status（同 rarity 下组成一个 statusEffect 数组）
 * - 数值：可统一给定 ranges 应用于所有 status；也可通过 rangesPerStatus 为某些 status 单独指定
 */
export function generateBasicStatusAffixSeries(opts: {
  /** 必填：要提升的多个状态（可只填一个元素表示单状态） */
  statuses: (keyof CharacterStatusInfo)[]
  /** 词条 id 前缀，不传则：单状态用第一个 status，多状态用 `multi_${statuses.join('_')}` */
  baseId?: string
  /** 名称前缀，默认：单状态用第一个 status 的中文映射，多状态用“属性提升” */
  baseName?: string
  tags?: string[]
  /** 统一区间：各稀有度数值区间；未指定则使用默认预设（1-2/2-3/3-5/5-8/8-12） */
  ranges?: Partial<Record<AffixRarity, { min: number; max: number }>>
  /** 按 status 单独指定区间（优先级高于 ranges） */
  rangesPerStatus?: Record<string, Partial<Record<AffixRarity, { min: number; max: number }>>>
}): AffixDefinition[] {
  const statusesArr = Array.isArray(opts.statuses) ? opts.statuses.filter(Boolean) : []
  if (statusesArr.length === 0) {
    throw new Error('generateBasicStatusAffixSeries: `statuses` is required and should not be empty')
  }

  const computedBaseId = opts.baseId ?? (statusesArr.length === 1
    ? statusesArr[0]
    : `multi_${statusesArr.join('_')}`)

  const defaultBaseName = (statusesArr.length === 1)
    ? (statusLabelMap[statusesArr[0]] || statusesArr[0])
    : '属性提升'

  const baseName = opts.baseName ?? defaultBaseName
  const tags = opts.tags ?? ['attribute', 'panel']
  const ranges = opts.ranges ?? {}
  const rangesPerStatus = opts.rangesPerStatus ?? {}

  const defs: AffixDefinition[] = []
  for (const rarity of rarityOrderAsc) {
    const suffix = raritySuffixMap[rarity]
    const suffixKey = raritySuffixKeyMap[rarity]
    const name = `${baseName}·${suffix}`

    // 组装本稀有度下的所有 status 提升
    const statusEffect = statusesArr.map((s) => {
      const perStatus = rangesPerStatus[s]?.[rarity]
      const range = perStatus || ranges[rarity] || defaultRanges[rarity]
      return { status: s, increase: { min: range.min, max: range.max } }
    })

    defs.push({
      affixId: `${computedBaseId}_${suffixKey.toLowerCase()}_${rarity.toLowerCase()}`,
      name,
      rarity,
      effect: { statusEffect },
      description: ``,
      tags,
    })
  }
  return defs
}

// 中文后缀，用于名称展示
export const raritySuffixMap: Record<AffixRarity, string> = {
  COMMON: '新芽',
  UNCOMMON: '精进',
  RARE: '锐意',
  EPIC: '激昂',
  LEGENDARY: '传奇',
}

// 英文（拼音化）后缀 key，用于 affixId
export const raritySuffixKeyMap: Record<AffixRarity, string> = {
  COMMON: 'bud',
  UNCOMMON: 'polish',
  RARE: 'edge',
  EPIC: 'zeal',
  LEGENDARY: 'legend',
}

// 稀有度正序：从普通到传说
export const rarityOrderAsc: AffixRarity[] = [
  'COMMON',
  'UNCOMMON',
  'RARE',
  'EPIC',
  'LEGENDARY',
]

// 默认区间：与攻击/防御系列保持一致梯度
export const defaultRanges: Record<AffixRarity, { min: number; max: number }> = {
  COMMON: { min: 1, max: 2 },
  UNCOMMON: { min: 2, max: 3 },
  RARE: { min: 3, max: 5 },
  EPIC: { min: 5, max: 8 },
  LEGENDARY: { min: 8, max: 12 },
}

// 常见状态的中文名映射
export const statusLabelMap: Record<string, string> = {
  strength: '力量',
  dexterity: '敏捷',
  intelligence: '智力',
  stamina: '体质',
}

// =============== 辅助：根据 baseId 快速得到系列 ID / Pool Entries ===============

/**
 * 给定 baseId 与稀有度，返回系列 affixId。
 * 规则需与 generateBasicStatusAffixSeries 中保持一致
 */
export function seriesAffixIdForRarity(baseId: string, rarity: AffixRarity): string {
  const suffixKey = raritySuffixKeyMap[rarity].toLowerCase()
  return `${baseId}_${suffixKey}_${rarity.toLowerCase()}`
}

/**
 * 尝试从系列 affixId 中解析出 baseId；不符合系列命名规则的返回 null。
 * 规则需与 generateBasicStatusAffixSeries / generateCustomEffectSeries 保持一致。
 */
export function parseSeriesBaseId(affixId: string): { baseId: string; rarity: AffixRarity } | null {
  for (const r of rarityOrderAsc) {
    const suffixKey = raritySuffixKeyMap[r].toLowerCase()
    const tail = `_${suffixKey}_${r.toLowerCase()}`
    if (affixId.endsWith(tail)) {
      const baseId = affixId.slice(0, -tail.length)
      if (baseId) return { baseId, rarity: r }
    }
  }
  return null
}

export function nextRarity(r: AffixRarity): AffixRarity | null {
  const idx = rarityOrderAsc.indexOf(r)
  if (idx < 0 || idx === rarityOrderAsc.length - 1) return null
  return rarityOrderAsc[idx + 1]
}

/**
 * 返回该系列所有稀有度的 affixId 映射
 */
export function seriesAffixIds(baseId: string): Record<AffixRarity, string> {
  return rarityOrderAsc.reduce((acc, r) => {
    acc[r] = seriesAffixIdForRarity(baseId, r)
    return acc
  }, {} as Record<AffixRarity, string>)
}

// 默认权重（参考攻击/防御系列）
export const defaultWeightPerRarity: Record<AffixRarity, number> = {
  COMMON: 100,
  UNCOMMON: 60,
  RARE: 35,
  EPIC: 18,
  LEGENDARY: 8,
}

/**
 * 生成用于 Pool.entries 的数组，不需要记忆 id。
 */
export function generatePoolEntriesForSeries(opts: {
  baseId: string
  tags?: string[]
  weightPerRarity?: Partial<Record<AffixRarity, number>>
  includeRarities?: AffixRarity[]
}) {
  const {
    baseId,
    tags = [],
    weightPerRarity = {},
    includeRarities = rarityOrderAsc,
  } = opts
  const items: Array<{ affixId: string; weight: number; tags: string[] }> = []
  for (const r of includeRarities) {
    const affixId = seriesAffixIdForRarity(baseId, r)
    const weight = weightPerRarity[r] ?? defaultWeightPerRarity[r]
    items.push({ affixId, weight, tags })
  }
  return items
}

// =============== 通用：按稀有度批量生成“自定义效果模板”系列 ===============

/**
 * 按稀有度批量生成自定义效果系列：调用方提供每个稀有度的区间（或可按比例推导），以及如何用该区间构造 effect。
 * 适合“各稀有度仅范围不同，逻辑相同”的场景。
 */
export function generateCustomEffectSeries(opts: {
  baseId: string
  baseName: string
  tags?: string[]
  /** 指定每个稀有度的区间 */
  ranges: Partial<Record<AffixRarity, { min: number; max: number }>>
  /** 给定稀有度与区间，返回该稀有度下的 effect 模板 */
  effectFor: (rarity: AffixRarity, range: { min: number; max: number }) => AffixKeyTemplate
}): AffixDefinition[] {
  const { baseId, baseName, tags = [], ranges, effectFor } = opts
  const defs: AffixDefinition[] = []
  for (const rarity of rarityOrderAsc) {
    const range = ranges[rarity]
    if (!range) continue
    const name = `${baseName}·${raritySuffixMap[rarity]}`
    defs.push({
      affixId: `${baseId}_${raritySuffixKeyMap[rarity].toLowerCase()}_${rarity.toLowerCase()}`,
      name,
      rarity,
      effect: effectFor(rarity, range),
      description: `${baseName}（${raritySuffixMap[rarity]}）`,
      tags,
    })
  }
  return defs
}

/**
 * 便捷：基于 COMMON 的基准区间与倍率，为各稀有度按倍率缩放区间后生成系列。
 */
export function generateScaledEffectSeries(opts: {
  baseId: string
  baseName: string
  tags?: string[]
  /** 基准区间（通常以 COMMON 为基准） */
  baseRange: { min: number; max: number }
  /** 各稀有度倍率（未提供的将使用 1） */
  scaleByRarity?: Partial<Record<AffixRarity, number>>
  effectFor: (rarity: AffixRarity, range: { min: number; max: number }) => any
}): AffixDefinition[] {
  const {
    baseId,
    baseName,
    tags = [],
    baseRange,
    scaleByRarity = { COMMON: 1, UNCOMMON: 1.5, RARE: 2, EPIC: 2.5, LEGENDARY: 3 },
    effectFor,
  } = opts
  const ranges: Partial<Record<AffixRarity, { min: number; max: number }>> = {}
  for (const r of rarityOrderAsc) {
    const mul = scaleByRarity[r] ?? 1
    ranges[r] = {
      min: Math.round(baseRange.min * mul),
      max: Math.round(baseRange.max * mul),
    }
  }
  return generateCustomEffectSeries({ baseId, baseName, tags, ranges, effectFor })
}

/**
 * 使用示例（请在需要的模块中调用并合并到 affixDefinitions）：
 *
 * import { generateBasicStatusAffixSeries } from '@/shared/data/affix/generators'
 * const strengthSeries = generateBasicStatusAffixSeries({ status: 'strength' })
 * const dexSeries = generateBasicStatusAffixSeries({ status: 'dexterity' })
 * const intSeries = generateBasicStatusAffixSeries({ status: 'intelligence' })
 *
 * // 或者自定义区间：
 * const customStrength = generateBasicStatusAffixSeries({
 *   status: 'strength',
 *   ranges: {
 *     COMMON: { min: 1, max: 3 },
 *     UNCOMMON: { min: 3, max: 6 },
 *     RARE: { min: 6, max: 12 },
 *     EPIC: { min: 12, max: 20 },
 *     LEGENDARY: { min: 20, max: 30 },
 *   }
 * })
 *
 * // 多状态：一次词条同时提升 力量/敏捷/智力
 * const triAttr = generateBasicStatusAffixSeries({
 *   statuses: ['strength', 'dexterity', 'intelligence'],
 *   baseId: 'char_attr_tri_boost',
 *   baseName: '三系属性提升',
 *   // 统一区间（可选）
 *   ranges: { COMMON: { min: 1, max: 2 } },
 *   // 或者为某个 status 单独指定：优先级更高
 *   rangesPerStatus: {
 *     strength: { EPIC: { min: 10, max: 20 } },
 *     dexterity: { EPIC: { min: 8, max: 16 } },
 *   }
 * })
 */
