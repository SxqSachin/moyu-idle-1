import type { ResourceRequirement } from "../types/gameAction";
import {
  MARKET_LISTING_EXPANSION_SCHEDULE_MAP_SELLER,
  MARKET_LISTING_EXPANSION_SCHEDULE_MAP_BUYER,
  MARKET_LISTING_EXPANSION_SCHEMES,
  MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE,
  type MarketListingExpansionSchemeId,
} from "../data/marketSlotConstants";

function mergeRequirements(list: Readonly<ResourceRequirement[]>): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of list) {
    map.set(r.id, (map.get(r.id) || 0) + r.count);
  }
  return map;
}

function addScaled(
  map: Map<string, number>,
  req: Readonly<ResourceRequirement[]> | undefined,
  mul: number
) {
  if (!req || mul <= 0) return;
  for (const r of req) {
    map.set(r.id, (map.get(r.id) || 0) + r.count * mul);
  }
}

// expansionsDone: number of expansions already purchased (0-based)
export function getMarketListingExpansionRequirement(
  expansionsDone: number,
  role: 'seller' | 'buyer',
  schemeId?: MarketListingExpansionSchemeId,
  schemeUsageForThisScheme?: number
): ResourceRequirement[] {
  // If the caller provided how many times this specific scheme has been used, prefer that for computing the next cost.
  // Otherwise fall back to expansionsDone (global count).
  let idx = typeof schemeUsageForThisScheme === 'number' ? schemeUsageForThisScheme : expansionsDone;
  let tierIndex = 0;
  let offsetInTier = 0;
  const scheduleMap = role === 'seller' ? MARKET_LISTING_EXPANSION_SCHEDULE_MAP_SELLER : MARKET_LISTING_EXPANSION_SCHEDULE_MAP_BUYER;
  // decide effective scheme based on schemeId and the per-scheme usage cap
  const schemes = MARKET_LISTING_EXPANSION_SCHEMES.map(s => s.id);
  const isSchemeAllowed = (id: MarketListingExpansionSchemeId) => {
    const cap = MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE[id];
    if (cap === 'infinity') return true;
    // If caller provided per-scheme usage for the requested scheme, use that for checks on that scheme.
    if (schemeId && id === schemeId && typeof schemeUsageForThisScheme === 'number') {
      return schemeUsageForThisScheme < cap;
    }
    // Otherwise fall back to the global expansionsDone provided by caller.
    return expansionsDone < cap; // expansionsDone is 0-based for next expansion
  };

  let effectiveScheme: MarketListingExpansionSchemeId | undefined = undefined;
  if (schemeId && schemes.includes(schemeId) && isSchemeAllowed(schemeId)) {
    // If a specific schemeId was requested and allowed for that scheme (based on provided
    // schemeUsageForThisScheme when available), use it strictly. This prevents silently
    // falling back to another scheme when the caller explicitly selected one.
    effectiveScheme = schemeId;
  } else {
    // pick first allowed scheme in configured order
    for (const s of schemes) {
      if (isSchemeAllowed(s as MarketListingExpansionSchemeId)) {
        effectiveScheme = s as MarketListingExpansionSchemeId;
        break;
      }
    }
    // fallback to provided schemeId or schemeA
    effectiveScheme = effectiveScheme || (schemeId as MarketListingExpansionSchemeId) || 'schemeA';
  }

  const schedule = scheduleMap[effectiveScheme];

  for (let i = 0; i < schedule.length; i++) {
    const t = schedule[i];
    const c = t.count === "infinity" ? Infinity : t.count;
    if (idx < c) {
      tierIndex = i;
      offsetInTier = idx;
      break;
    } else {
      idx -= c;
    }
  }
  const tier = schedule[Math.min(tierIndex, schedule.length - 1)];
  const map = mergeRequirements(tier.base);
  addScaled(map, tier.increment, offsetInTier);
  return Array.from(map.entries()).map(([id, count]) => ({ id: id as any, count }));
}

export default {};
