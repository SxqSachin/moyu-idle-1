import { allFarmingData, allFertilizer } from "~/shared/data/allFarmingData";
import type { FertilizerEffect, WeightedYield } from "~/shared/types/farming";

export type FertilizerStacks = { id: string; stacks?: number }[];

export type FarmingOutcome = {
  finalGrowthSeconds: number;
  finalMutationChance: number;
  expectedYield: WeightedYield[]; // merged absolute probabilities (0..1), normal + mutation combined by id
};

/**
 * 统一的种植结果计算：给定 seedId 与施肥情况，返回最终耗时/变异概率/合并后的产出（绝对概率）。
 * 规则：
 * - 时长：叠加 shortenDuration（秒/百分比，依次应用，结果向下取整，最小1s）
 * - 变异：increaseMutationChance/adjustMutationChance（百分比点相加，乘法相乘，最终 clamp 0..1）
 * - 概率调整：adjustYieldProbability（按 scope 与 selector 作用到普通/变异产出；只做下限0限制，不上限）
 * - 增加产量：increaseYield（对 count 或 range 应用 flat/percent 叠加；结果四舍五入并不小于0）
 * - 产出合并：将变异产出的概率乘以最终变异概率，之后与普通产出按 id 合并：概率相加；数量/范围若不同，优先变异定义
 */
export function computeFarmingOutcome(seedId: string, fertilizers?: FertilizerStacks): FarmingOutcome {
  const base = allFarmingData[seedId as any];
  if (!base) {
    throw new Error(`未找到种子定义: ${seedId}`);
  }

  // 允许的肥料白名单
  const allowIds = base.fertilizerIds && base.fertilizerIds.length ? new Set(base.fertilizerIds) : null;

  // 规范化叠层并展开效果
  const stacks = (fertilizers ?? [])
    .filter((f) => !!f && !!f.id)
    .filter((f) => !allowIds || allowIds.has(f.id))
    .map((f) => ({ id: f.id, stacks: Math.max(1, f.stacks ?? 1) }));

  const effects: FertilizerEffect[] = [];
  for (const f of stacks) {
    const def = allFertilizer[f.id as any];
    if (!def?.effects?.length) continue;
    const maxStacks = def.maxStacks ?? 1;
    const s = Math.min(f.stacks ?? 0, maxStacks);
    for (let i = 0; i < s; i++) effects.push(...def.effects);
  }

  // 时长
  let duration = base.baseGrowthSeconds ?? 0;
  if (!duration || duration <= 0) {
    throw new Error("缺少生长时长：请在 Excel 定义 baseGrowthSeconds");
  }
  for (const e of effects) {
    if (e.type === "shortenDuration") {
      if (typeof e.seconds === "number") duration = Math.max(1, duration - e.seconds);
      if (typeof e.percent === "number") duration = Math.max(1, Math.floor(duration * (1 - e.percent)));
    }
  }

  // 变异概率
  let mutation = base.baseMutationChance ?? 0;
  for (const e of effects) {
    if (e.type === "increaseMutationChance") {
      if (typeof e.percentPoint === "number") mutation += e.percentPoint;
    } else if (e.type === "adjustMutationChance") {
      if (typeof e.percentPoint === "number") mutation += e.percentPoint;
      if (typeof e.multiply === "number") mutation *= e.multiply;
    }
  }
  mutation = Math.max(0, Math.min(1, mutation));

  // 概率调整（普通/变异 分别）
  const applyYieldProbAdjust = (arr: WeightedYield[] | undefined, scope: "normal" | "mutation"): WeightedYield[] => {
    const list = (arr ?? []).map((y) => ({ ...y }));
    for (const e of effects) {
      if (e.type !== "adjustYieldProbability") continue;
      const matchScope = e.scope === "all" || !e.scope || e.scope === scope;
      if (!matchScope) continue;
      list.forEach((y) => {
        const matchSelector = e.selector === "BY_ID" ? (e.id ? y.id === e.id : false) : true;
        if (!matchSelector) return;
        let p = y.percent ?? 1;
        if (typeof e.percentPoint === "number") p += e.percentPoint;
        if (typeof e.multiply === "number") p *= e.multiply;
        y.percent = Math.max(0, p);
      });
    }
    return list;
  };

  // 增加产量
  const applyIncreaseYield = (list: WeightedYield[] | undefined): WeightedYield[] => {
    const out = (list ?? []).map((y) => ({ ...y })) as any[];
    for (const eff of effects) {
      if (eff.type !== "increaseYield") continue;
      out.forEach((y: any) => {
        if (typeof y.count === "number") {
          if (typeof eff.flat === "number") y.count = Math.max(0, y.count + eff.flat);
          if (typeof eff.percent === "number") y.count = Math.max(0, Math.round(y.count * (1 + eff.percent)));
        } else if (y.range && typeof y.range.min === "number" && typeof y.range.max === "number") {
          if (typeof eff.flat === "number") {
            y.range = {
              min: Math.max(0, Math.round(y.range.min + eff.flat)),
              max: Math.max(0, Math.round(y.range.max + eff.flat)),
            };
          }
          if (typeof eff.percent === "number") {
            y.range = {
              min: Math.max(0, Math.round(y.range.min * (1 + eff.percent))),
              max: Math.max(0, Math.round(y.range.max * (1 + eff.percent))),
            };
          }
        }
      });
    }
    return out as WeightedYield[];
  };

  const adjustedNormal = applyIncreaseYield(applyYieldProbAdjust(base.yields, "normal"));
  const adjustedMutation = applyIncreaseYield(applyYieldProbAdjust(base.mutationYields, "mutation")).map((y: any) => ({
    ...y,
    percent: (y.percent ?? 1) * mutation,
  }));

  // 合并
  const map: Record<string, any> = {};
  for (const y of adjustedNormal ?? []) {
    if (!y || !y.id) continue;
    map[y.id] = { ...y, percent: y.percent ?? 1, source: "normal" };
  }
  for (const y of adjustedMutation ?? []) {
    if (!y || !y.id) continue;
    if (!map[y.id]) {
      map[y.id] = { ...y, percent: y.percent ?? 0, source: "mutation" };
    } else {
      map[y.id].percent = (map[y.id].percent || 0) + (y.percent ?? 0);
      if ("range" in y) map[y.id].range = (y as any).range;
      if ((y as any).count != null) map[y.id].count = (y as any).count;
      map[y.id].source = "combined";
    }
  }

  return {
    finalGrowthSeconds: duration,
    finalMutationChance: mutation,
    expectedYield: Object.values(map) as WeightedYield[],
  };
}
