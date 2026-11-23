import { PLAYER_SHOP_EXPANSION_SCHEDULE_MAP, PLAYER_SHOP_EXPANSION_SCHEMES, PLAYER_SHOP_EXPANSION_SCHEME_MAX_USABLE } from "~/shared/data/playerShopSlotConstants";
import type { PlayerShopExpansionSchemeId } from "~/shared/data/playerShopSlotConstants";

type ResourceRequirement = { id: string; count: number };

/**
 * Compute the resource requirement for the next player shop expansion.
 * - expansionsDone: number of expansions already purchased
 * - schemeId: optional scheme id to pick a schedule
 */
export function getPlayerShopExpansionRequirement(
  expansionsDone: number,
  schemeId?: PlayerShopExpansionSchemeId,
  schemeUsageForThisScheme?: number
): ResourceRequirement[] {
  const schemes = PLAYER_SHOP_EXPANSION_SCHEMES.map(s => s.id);
  const isSchemeAllowed = (id: PlayerShopExpansionSchemeId) => {
    const cap = PLAYER_SHOP_EXPANSION_SCHEME_MAX_USABLE[id];
    if (cap === 'infinity') return true;
    // here expansionsDone still represents a fallback global count; caller should provide per-scheme usage via schemeUsageForThisScheme
    return (schemeUsageForThisScheme ?? expansionsDone) < cap;
  };

  let effectiveScheme: PlayerShopExpansionSchemeId | undefined = undefined;
  if (schemeId && schemes.includes(schemeId) && isSchemeAllowed(schemeId)) {
    effectiveScheme = schemeId;
  } else {
    for (const s of schemes) {
      if (isSchemeAllowed(s as PlayerShopExpansionSchemeId)) {
        effectiveScheme = s as PlayerShopExpansionSchemeId;
        break;
      }
    }
    effectiveScheme = effectiveScheme || (schemeId ?? 'default');
  }

  const schedule = PLAYER_SHOP_EXPANSION_SCHEDULE_MAP[effectiveScheme ?? 'default'];
  if (!schedule || !schedule.length) return [];

  // Find the tier that matches the expansionsDone (simple linear handling)
  // Our schedules use 'infinity' so we can treat as single-tier.
  const tier = schedule[0];
  const base = tier.base || [];
  const increment = tier.increment || [];

  // requirement = base + increment * expansionsDone
  const map = new Map<string, number>();
  for (const r of base) map.set(r.id, (map.get(r.id) ?? 0) + r.count);
  // requirement = base + increment * offset
  const offset = typeof schemeUsageForThisScheme === 'number' ? schemeUsageForThisScheme : expansionsDone;
  for (const r of increment) map.set(r.id, (map.get(r.id) ?? 0) + r.count * offset);

  const res: ResourceRequirement[] = [];
  for (const [id, count] of map.entries()) res.push({ id, count });
  return res;
}

export default {};
