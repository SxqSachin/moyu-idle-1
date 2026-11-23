import type { ResourceRequirement } from "../types/gameAction";
import { BASE_MAX_SELLER_TRANSACTION_COUNT, BASE_MAX_BUYER_TRANSACTION_COUNT } from "./constant";

// 最大允许扩展次数（防 abuse）
export const MARKET_LISTING_EXPANSION_MAX = 200;

// 默认上限来自常量：BASE_MAX_SELLER_TRANSACTION_COUNT / BASE_MAX_BUYER_TRANSACTION_COUNT
export const MARKET_BASE_SELLER = BASE_MAX_SELLER_TRANSACTION_COUNT;
export const MARKET_BASE_BUYER = BASE_MAX_BUYER_TRANSACTION_COUNT;

// 分段消耗表（简单版）
// 每次扩展 +1 槽，分段决定消耗 base + increment * offset
export type MarketListingExpansionTier = {
  count: number | "infinity";
  base: Readonly<ResourceRequirement[]>;
  increment?: Readonly<ResourceRequirement[]>;
};

export const MARKET_LISTING_EXPANSION_SCHEDULE_SELLER: Readonly<
  MarketListingExpansionTier[]
> = [
  {
    count: "infinity",
    base: [
      { id: "gold", count: 25000000 },
      { id: "catPawCoin", count: 100 },
      { id: "catPawStamp", count: 100 },
      { id: "genesisEssence", count: 5 },
    ],
    increment: [
      { id: "gold", count: 25000000 },
      { id: "catPawCoin", count: 100 },
      { id: "catPawStamp", count: 100 },
      { id: "genesisEssence", count: 1 },
    ],
  },
];

// 买方市场扩展消耗表（可以与卖家不同）
export const MARKET_LISTING_EXPANSION_SCHEDULE_BUYER: Readonly<MarketListingExpansionTier[]> = [
  {
    count: "infinity",
    base: [
      { id: "gold", count: 25000000 },
      { id: "catPawCoin", count: 100 },
      { id: "catPawStamp", count: 100 },
    ],
    increment: [
      { id: "gold", count: 25000000 },
      { id: "catPawCoin", count: 100 },
      { id: "catPawStamp", count: 100 },
    ],
  },
];

// Multi-scheme consolidated config (seller & buyer schedules per scheme)
export type MarketListingExpansionSchemeId = "schemeA" | "schemeB";

export type MarketListingExpansionSchemeConfig = {
  id: MarketListingExpansionSchemeId;
  name: string;
  scheduleSeller: Readonly<MarketListingExpansionTier[]>;
  scheduleBuyer: Readonly<MarketListingExpansionTier[]>;
  maxUsable: number | "infinity";
  limitReachedMessage?: string;
};

export const MARKET_LISTING_DEFAULT_SELLER_SCHEDULE = MARKET_LISTING_EXPANSION_SCHEDULE_SELLER;
export const MARKET_LISTING_DEFAULT_BUYER_SCHEDULE = MARKET_LISTING_EXPANSION_SCHEDULE_BUYER;

export const MARKET_LISTING_EXPANSION_SCHEME_CONFIG: Readonly<Record<MarketListingExpansionSchemeId, MarketListingExpansionSchemeConfig>> = {
  schemeA: {
    id: 'schemeA',
    name: '方案A',
    scheduleSeller: MARKET_LISTING_DEFAULT_SELLER_SCHEDULE,
    scheduleBuyer: MARKET_LISTING_DEFAULT_BUYER_SCHEDULE,
    maxUsable: 5,
    limitReachedMessage: '方案A 的可用次数已用尽，请选择其他方案。',
  },
  schemeB: {
    id: 'schemeB',
    name: '方案B',
    scheduleSeller: [ { count: 'infinity', base: [{ id: 'marketTransitionCapacityUpgrade', count: 1 }], increment: [{ id: 'marketTransitionCapacityUpgrade', count: 0 }] } ],
    scheduleBuyer: [ { count: 'infinity', base: [{ id: 'buyerMarketTransitionCapacityUpgrade', count: 1 }], increment: [{ id: 'buyerMarketTransitionCapacityUpgrade', count: 0 }] } ],
    maxUsable: 'infinity',
    limitReachedMessage: '方案B 的可用次数已用尽',
  }
};

// Backwards-compatible derived exports
export const MARKET_LISTING_EXPANSION_SCHEMES: Readonly<{ id: MarketListingExpansionSchemeId; name: string }[]> =
  Object.values(MARKET_LISTING_EXPANSION_SCHEME_CONFIG).map(c => ({ id: c.id, name: c.name }));

export const MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE: Readonly<Record<MarketListingExpansionSchemeId, number | "infinity">> =
  Object.fromEntries(Object.entries(MARKET_LISTING_EXPANSION_SCHEME_CONFIG).map(([k, v]) => [k, v.maxUsable])) as any;

export const MARKET_LISTING_EXPANSION_SCHEDULE_MAP_SELLER: Readonly<Record<MarketListingExpansionSchemeId, Readonly<MarketListingExpansionTier[]>>> =
  Object.fromEntries(Object.entries(MARKET_LISTING_EXPANSION_SCHEME_CONFIG).map(([k, v]) => [k, v.scheduleSeller])) as any;

export const MARKET_LISTING_EXPANSION_SCHEDULE_MAP_BUYER: Readonly<Record<MarketListingExpansionSchemeId, Readonly<MarketListingExpansionTier[]>>> =
  Object.fromEntries(Object.entries(MARKET_LISTING_EXPANSION_SCHEME_CONFIG).map(([k, v]) => [k, v.scheduleBuyer])) as any;

export function getMarketSchemeLimitMessage(id?: MarketListingExpansionSchemeId) {
  if (!id) return '';
  return MARKET_LISTING_EXPANSION_SCHEME_CONFIG[id]?.limitReachedMessage || '';
}

export default {};

