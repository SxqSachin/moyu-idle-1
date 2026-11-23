import type { ResourceRequirement } from "../types/gameAction";
import { CHARACTER_AFFIX_MAX_OWNED_DEFAULT, CHARACTER_AFFIX_OWNED_EXPANSION_SCHEDULE, CHARACTER_AFFIX_OWNED_EXPANSION_SCHEDULE_MAP, CHARACTER_AFFIX_OWNED_EXPANSION_SCHEMES, CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_MAX_USABLE, type AffixOwnedExpansionSchemeId } from "../data/characterAffixConstants";

// 合并若干 ResourceRequirement（同 id 累加）
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

// 根据当前上限计算本次扩容所需 ResourceRequirement（支持分段）
export function getCharacterAffixOwnedExpansionRequirement(
  currentOwnedLimit: number,
  schemeId?: AffixOwnedExpansionSchemeId,
  schemeUsageForThisScheme?: number
): ResourceRequirement[] {
  // 已扩容次数 = 当前上限 - 默认上限（不足0按0计）
  const expansionsDone = Math.max(
    0,
    currentOwnedLimit - CHARACTER_AFFIX_MAX_OWNED_DEFAULT
  );

  // If caller provided per-scheme usage, prefer it when deciding which
  // expansion tier applies to this scheme. This allows computing the
  // per-scheme requirement based on that scheme's own used count.
  const schemeOffset = typeof schemeUsageForThisScheme === 'number' ? schemeUsageForThisScheme : expansionsDone;

  // 寻找对应分段
  let idx = schemeOffset; // 0-based：下一次扩容属于哪一段、在段内的第几个
  let tierIndex = 0;
  let offsetInTier = 0;
  // Decide effective scheme based on per-scheme usage caps
  const schemes = CHARACTER_AFFIX_OWNED_EXPANSION_SCHEMES.map(s => s.id);
  const isSchemeAllowed = (id: AffixOwnedExpansionSchemeId) => {
    const cap = CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_MAX_USABLE[id];
    if (cap === 'infinity') return true;
    return schemeOffset < cap;
  };

  let effectiveScheme: AffixOwnedExpansionSchemeId | undefined = undefined;
  if (schemeId && schemes.includes(schemeId) && isSchemeAllowed(schemeId)) {
    effectiveScheme = schemeId;
  } else {
    for (const s of schemes) {
      if (isSchemeAllowed(s as AffixOwnedExpansionSchemeId)) {
        effectiveScheme = s as AffixOwnedExpansionSchemeId;
        break;
      }
    }
    effectiveScheme = effectiveScheme || (schemeId ?? 'schemeA');
  }

  const schedule = CHARACTER_AFFIX_OWNED_EXPANSION_SCHEDULE_MAP[effectiveScheme ?? 'schemeA'];
  for (let i = 0; i < schedule.length; i++) {
    const t = schedule[i];
    const c = t.count === "infinity" ? Infinity : t.count;
    if (idx < c) {
      tierIndex = i;
      offsetInTier = idx; // 在本段内的序号（从0开始）
      break;
    } else {
      idx -= c;
    }
  }

  const tier = schedule[Math.min(tierIndex, schedule.length - 1)];
  // 计算：base + increment * offsetInTier
  const map = mergeRequirements(tier.base);
  addScaled(map, tier.increment, offsetInTier);
  return Array.from(map.entries()).map(([id, count]) => ({ id: id as any, count }));
}
