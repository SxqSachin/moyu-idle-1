import type { AllBaseCharacterStatusType } from "../types/characterInfo";
import type { ResourceRequirement } from "../types/gameAction";

// ================= Character Affix (随机词条) 常量 =================
// 抽取冷却（秒）
export const CHARACTER_AFFIX_ROLL_COOLDOWN_SECONDS = 1;
// 重抽冷却（秒）
export const CHARACTER_AFFIX_REROLL_COOLDOWN_SECONDS = 1;
// 启用上限（默认）
export const CHARACTER_AFFIX_MAX_ACTIVE_DEFAULT = 6;
// 持有上限（默认）
export const CHARACTER_AFFIX_MAX_OWNED_DEFAULT = 12;

// 词条持有上限扩展配置
export const CHARACTER_AFFIX_OWNED_EXPANSION_MAX = 360; // 可扩展到的最大“持有上限”
export const CHARACTER_AFFIX_ACTIVE_EXPANSION_MAX = 12; // 可扩展到的最大“启用上限”

// 基础消耗（资源需求）与每次递增的消耗（同结构）
export const CHARACTER_AFFIX_OWNED_EXPANSION_BASE_REQUIREMENT: Readonly<ResourceRequirement[]> = [
  { id: "gold", count: 2_500_000 },
  { id: "genesisEssence", count: 5 },
  { id: "catRelic", count: 25 },
  { id: "hb_null_signature", count: 2 },
] as const;

export const CHARACTER_AFFIX_OWNED_EXPANSION_INCREMENT_REQUIREMENT: Readonly<ResourceRequirement[]> = [
  { id: "gold", count: 2_500_000 },
  { id: "genesisEssence", count: 1 },
  { id: "catRelic", count: 2 },
  { id: "hb_null_signature", count: 1 },
] as const;

// 扩容消耗分段
export type AffixOwnedExpansionTier = {
  count: number | "infinity";
  base: Readonly<ResourceRequirement[]>;
  increment?: Readonly<ResourceRequirement[]>;
};

// 方案A（常规资源）——三段 1-6 / 7-12 / 13-18，之后延续
export const CHARACTER_AFFIX_OWNED_EXPANSION_SCHEDULE: Readonly<AffixOwnedExpansionTier[]> = [
  // 1~6
  {
    count: "infinity",
    base: CHARACTER_AFFIX_OWNED_EXPANSION_BASE_REQUIREMENT,
    increment: CHARACTER_AFFIX_OWNED_EXPANSION_INCREMENT_REQUIREMENT,
  },
];

// 多方案支持
export type AffixOwnedExpansionSchemeId = "schemeA" | "schemeB"
export type CharacterAffixOwnedExpansionSchemeConfig = {
  id: AffixOwnedExpansionSchemeId;
  name: string;
  schedule: Readonly<AffixOwnedExpansionTier[]>;
  maxUsable: number | "infinity";
  limitReachedMessage?: string;
};

export const CHARACTER_AFFIX_OWNED_DEFAULT_SCHEDULE = CHARACTER_AFFIX_OWNED_EXPANSION_SCHEDULE;

export const CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_CONFIG: Readonly<Record<AffixOwnedExpansionSchemeId, CharacterAffixOwnedExpansionSchemeConfig>> = {
  schemeA: {
    id: 'schemeA',
    name: '方案A',
    schedule: CHARACTER_AFFIX_OWNED_DEFAULT_SCHEDULE,
    maxUsable: 24,
    limitReachedMessage: '方案A 的可用次数已用尽，请选择其他方案。',
  },
  schemeB: {
    id: 'schemeB',
    name: '方案B',
    schedule: [
      { count: 'infinity', base: [{ id: 'affixCapacityUpgrade', count: 1 }], increment: [{ id: 'affixCapacityUpgrade', count: 0 }] },
    ],
    maxUsable: 'infinity',
    limitReachedMessage: '方案B 的可用次数已用尽',
  }
};

export const CHARACTER_AFFIX_OWNED_EXPANSION_SCHEMES: Readonly<{ id: AffixOwnedExpansionSchemeId; name: string }[]> =
  Object.values(CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_CONFIG).map(c => ({ id: c.id, name: c.name }));

export const CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_MAX_USABLE: Readonly<Record<AffixOwnedExpansionSchemeId, number | "infinity">> =
  Object.fromEntries(Object.entries(CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_CONFIG).map(([k, v]) => [k, v.maxUsable])) as any;

export const CHARACTER_AFFIX_OWNED_EXPANSION_SCHEDULE_MAP: Readonly<Record<AffixOwnedExpansionSchemeId, Readonly<AffixOwnedExpansionTier[]>>> =
  Object.fromEntries(Object.entries(CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_CONFIG).map(([k, v]) => [k, v.schedule])) as any;

export function getCharacterAffixSchemeLimitMessage(id?: AffixOwnedExpansionSchemeId) {
  if (!id) return '';
  return CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_CONFIG[id]?.limitReachedMessage || '';
}

export const CHARACTER_AFFIX_INCREASE_ACTIVE_RESOURCE_REQUIREMENT: Readonly<ResourceRequirement[]> = [
  { id: "genesisEssence", count: 50 },
  { id: "hb_null_signature", count: 10 },
];
export const CHARACTER_AFFIX_INCREASE_ACTIVE_STATUS_REQUIREMENT: Readonly<{[status in AllBaseCharacterStatusType]?: number}> = {
  battle: 90
};