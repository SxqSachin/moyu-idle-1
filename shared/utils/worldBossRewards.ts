import type { ItemCountInfo } from "~/shared/types/gameInventory";
import type { ItemDrop } from "~/shared/types/emeny";
import type { BossUnitWithDrops, WorldBossBattleConfig } from "~/shared/types/worldBoss";
import { randomIntegerInFullCloseRange, randomNumberInFullColseRange } from "~/shared/utils";

export function flattenDropsFromMembers(members: BossUnitWithDrops[] = []): ItemDrop[] {
  const safeMembers = Array.isArray(members) ? members : [];
  return safeMembers.flatMap((m) => Array.isArray(m.drops) ? m.drops : []);
}

export function rollDrops(
  flatDrops: ItemDrop[] = [],
  simpleClaim: boolean = false,
  // extraMultiplier: if >0, will be applied multiplicatively to probabilities when
  // `simpleClaim` is false. Acceptable values: 1, 1.5, etc. Default 0 means "no extra".
  extraMultiplier: number = 0,
): ItemCountInfo {
  const randomFloat = (min: number, max: number) => randomNumberInFullColseRange(min, max);
  const randomInt = (min: number, max: number) => randomIntegerInFullCloseRange(min, max);
  const rewards: ItemCountInfo = {};

  for (const drop of flatDrops) {
    const prob = Number(drop.percent ?? 0);

    // Preserve original simpleClaim behaviour and explicitly skip applying
    // `extraMultiplier` when simpleClaim === true.
    let effectiveProb: number;
    if (simpleClaim) {
      effectiveProb = prob < 1 ? prob * 0.2 : prob;
    } else {
      // Treat `extraMultiplier` as an *additional* multiplier amount.
      // e.g. extraMultiplier=1 means +100% -> applied multiplier = 2.0
      // extraMultiplier=1.5 means +150% -> applied multiplier = 2.5
      const applied = Number.isFinite(extraMultiplier) && extraMultiplier > 0 ? (1 + extraMultiplier) : 1;
      effectiveProb = prob * applied;
    }

    // Clamp into [0,1]
    effectiveProb = Math.max(0, Math.min(1, effectiveProb));

    const hit = randomFloat(0, 1) < effectiveProb;
    if (!hit) continue;

    const min = drop.range?.min ?? 1;
    const max = drop.range?.max ?? min;

    // simpleClaim 特殊规则：
    // - 100% 掉落（prob >= 1）：数量降低 25%，向下取整，且至少为 1
    // - 非 100% 掉落：概率降低 75%（已在 effectiveProb 应用），数量范围不变
    let cnt: number;
    if (simpleClaim && prob >= 1) {
      const adjMin = Math.max(1, Math.floor(min * 0.65));
      const adjMax = Math.max(adjMin, Math.floor(max * 0.65));
      cnt = Math.max(1, randomInt(adjMin, adjMax));
    } else {
      cnt = randomInt(min, max);
    }
    if (cnt <= 0) continue;

    const prev = rewards[drop.id]?.count ?? 0;
    rewards[drop.id] = { count: prev + cnt };
  }

  return rewards;
}

export function rollWorldBossDropsForPlayerFromConfig(
  config: Pick<WorldBossBattleConfig, 'bossMembers'>,
  simpleClaim: boolean = false,
  // extraMultiplier: pass 0 for no extra effect (default), or pass 1 / 1.5 etc.
  extraMultiplier: number = 0,
): ItemCountInfo {
  const members = (config?.bossMembers ?? []) as BossUnitWithDrops[];
  const flat = flattenDropsFromMembers(members);
  return rollDrops(flat, simpleClaim, extraMultiplier);
}
