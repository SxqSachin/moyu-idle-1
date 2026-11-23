import type { ResourceRequirement } from "../types/gameAction";

// 最大允许扩展次数（防 abuse）
export const PLAYER_SHOP_EXPANSION_MAX = 200;

export type PlayerShopExpansionTier = {
  count: number | "infinity";
  base: Readonly<ResourceRequirement[]>;
  increment?: Readonly<ResourceRequirement[]>;
};

export const PLAYER_SHOP_EXPANSION_SCHEDULE: Readonly<PlayerShopExpansionTier[]> = [
  {
    count: "infinity",
    base: [
      { id: "gold", count: 10000000 },
      { id: "catPawCoin", count: 50 },
      { id: "catPawStamp", count: 50 },
      { id: "genesisEssence", count: 5 },
    ],
    increment: [
      { id: "gold", count: 10000000 },
      { id: "catPawCoin", count: 25 },
      { id: "catPawStamp", count: 25 },
      { id: "genesisEssence", count: 1 },
    ],
  },
];

export type PlayerShopExpansionSchemeId = "default" | "fast";
// Consolidated per-scheme configuration.
// The goal: keep each scheme's metadata (id, name), resource schedule, per-scheme max usable
// and a user-facing message when that scheme has reached its usable cap in one place.
export type PlayerShopExpansionSchemeConfig = {
  id: PlayerShopExpansionSchemeId;
  name: string;
  /** schedule of tiers (base + optional increment) for this scheme */
  schedule: Readonly<PlayerShopExpansionTier[]>;
  /** how many times this scheme may be used (per-player). 'infinity' means no limit */
  maxUsable: number | "infinity";
  /** optional user-facing message when the scheme has reached its max (for UI hints) */
  limitReachedMessage?: string;
};

// Keep the default schedule exported separately (the user requested DEFAULT series remain addressable)
export const PLAYER_SHOP_DEFAULT_EXPANSION_SCHEDULE = PLAYER_SHOP_EXPANSION_SCHEDULE;

export const PLAYER_SHOP_EXPANSION_SCHEME_CONFIG: Readonly<Record<PlayerShopExpansionSchemeId, PlayerShopExpansionSchemeConfig>> = {
  default: {
    id: "default",
    name: "方案A",
    schedule: PLAYER_SHOP_DEFAULT_EXPANSION_SCHEDULE,
    maxUsable: 5,
    limitReachedMessage: "方案A 的可用次数已用尽，请选择其他方案或返回后再试",
  },
  fast: {
    id: "fast",
    name: "方案B",
    schedule: [
      {
        count: "infinity",
        base: [{ id: "playerShopCapacityUpgrade", count: 1 }],
        increment: [{ id: "playerShopCapacityUpgrade", count: 0 }],
      },
    ],
    maxUsable: "infinity",
    limitReachedMessage: "方案B 的可用次数已用尽",
  },
};

// Backwards-compatible derived exports (so existing code can keep using these names).
export const PLAYER_SHOP_EXPANSION_SCHEMES: Readonly<({ id: PlayerShopExpansionSchemeId; name: string })[]> =
  Object.values(PLAYER_SHOP_EXPANSION_SCHEME_CONFIG).map((c) => ({ id: c.id, name: c.name }));

export const PLAYER_SHOP_EXPANSION_SCHEDULE_MAP: Readonly<Record<PlayerShopExpansionSchemeId, Readonly<PlayerShopExpansionTier[]>>> =
  Object.fromEntries(Object.entries(PLAYER_SHOP_EXPANSION_SCHEME_CONFIG).map(([k, v]) => [k, v.schedule])) as any;

export const PLAYER_SHOP_EXPANSION_SCHEME_MAX_USABLE: Readonly<Record<PlayerShopExpansionSchemeId, number | "infinity">> =
  Object.fromEntries(Object.entries(PLAYER_SHOP_EXPANSION_SCHEME_CONFIG).map(([k, v]) => [k, v.maxUsable])) as any;

// Convenience accessor to get the per-scheme limit message. UI can use this to show a friendly hint.
export function getPlayerShopSchemeLimitMessage(id?: PlayerShopExpansionSchemeId) {
  if (!id) return '';
  return PLAYER_SHOP_EXPANSION_SCHEME_CONFIG[id]?.limitReachedMessage || '';
}

export default {};
