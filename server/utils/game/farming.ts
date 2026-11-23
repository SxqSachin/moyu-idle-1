import { prisma } from "./db";
import { withUniqueLock } from "../../utils/lock";
import type { FarmAreaId, FarmPlotDTO, FarmPlotState, WeightedYield, FertilizerEffect } from "~/shared/types/farming";
import { BASE_MAX_FARM_PLOTS_PER_USER, FARM_PLOT_CREATE_RESOURCE_REQUIREMENT } from "~/shared/data/constant";
import { checkResourceRequirementInDB, decreaseItemCount, increaseItemCount } from "./characterInventory";
import { convertReseourceRequirementToItemModify, convertItemCountInfoToDecrease } from "~/shared/utils/game/requirementCheck";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
// Use shared readonly registries instead of ad-hoc finders
import { allFarmingData, allFertilizer } from "~/shared/data/allFarmingData";
import { computeFarmingOutcome } from "~/shared/utils/game/farmingOutcome";
// For fields not present in allFarmingData (e.g., plantCost), read from the JSON source
import allFarmingDefsJson from "~/assets/resource/allFarmingDefinitions.json";
import { v7 } from "uuid";
import { allGameResource } from "~/shared/data/allGameResources";

type AreaId = FarmAreaId; // alias for internal usage

// 计算田地成本倍率：第 0~5 块随索引递增，其余(索引>=6)固定与第 6 块一致
function getPlotCostMultiplier(plotIndex: number): number {
  return Math.min(5, Math.max(0, plotIndex));
}

export type PlantParams = {
  plotIndex: number;
  seedId: string;
  growthSecondsRequired?: number; // total seconds to mature (optional; will be computed from defs if omitted)
  area?: AreaId;
  fertilizers?: { id: string; stacks?: number }[]; // 使用的肥料
  expectedYield?: WeightedYield[];  // 预估产出（常规产出，含概率/范围）
  mutationChance?: number; // 0~1
};

export type UnlockParams = {
  plotIndex: number;
  area?: AreaId;
};

/**
 * 将数据库行映射为对前端友好的 FarmPlotDTO
 * - 优先使用独立列；若不存在则从 config JSON 中回退读取（plantingExt）
 */
function mapPlotToDTO(p: any): FarmPlotDTO {
  // Prefer dedicated columns; fallback to config JSON if not present
  const cfg = p.config ? safeParseJSON(p.config) : undefined as any;
  const ext = cfg?.plantingExt || cfg?.farmingExt || undefined;
  const fertilizers = p.fertilizers ? safeParseJSON(p.fertilizers) : (ext?.fertilizers ?? undefined);
  const expectedYield = p.expectedYield ? safeParseJSON(p.expectedYield) : (ext?.expectedYield ?? undefined);
  const mutationChance = typeof p.mutationChance === 'number' ? p.mutationChance : (typeof ext?.mutationChance === 'number' ? ext?.mutationChance : null);
  return {
    id: p.id,
    uuid: p.uuid,
    userUuid: p.userUuid,
    plotIndex: p.plotIndex,
    area: p.area,
    state: p.state as FarmPlotState,
    seedId: p.seedId ?? null,
    fertilizers,
    expectedYield,
    mutationChance,
    plantedAt: p.plantedAt ? new Date(p.plantedAt).toISOString() : null,
    expectedHarvestAt: p.expectedHarvestAt ? new Date(p.expectedHarvestAt).toISOString() : null,
    growthSecondsRequired: p.growthSecondsRequired ?? null,
    growthSecondsAccumulated: p.growthSecondsAccumulated ?? 0,
    lastTickAt: p.lastTickAt ? new Date(p.lastTickAt).toISOString() : null,
    autoReplant: !!p.autoReplant,
    config: cfg,
    extra: p.extra ? safeParseJSON(p.extra) : undefined,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
  };
}

/** 安全 JSON 解析（失败返回 undefined） */
function safeParseJSON(s: string) {
  try { return JSON.parse(s); } catch { return undefined; }
}

// ================= Helpers: yields & effects =================
/** 在[min,max]之间取整随机数 */
function rollBetween(min: number, max: number): number {
  if (max < min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 根据权重与概率，物化产物包（生成具体数量） */
function materializeYields(yields: WeightedYield[] | undefined): { [id: string]: number } {
  const bag: Record<string, number> = {};
  if (!yields?.length) return bag;
  for (const y of yields) {
    const chance = y.percent ?? 1;
    if (chance <= 0) continue;
    if (chance < 1) {
      const r = Math.random();
      if (r > chance) continue;
    }
    const n = 'range' in y ? rollBetween(y.range.min, y.range.max) : y.count;
    bag[y.id] = (bag[y.id] ?? 0) + n;
  }
  return bag;
}

/**
 * 查询田地列表（按 area、plotIndex 排序）
 */
export async function listPlots(userUuid: string, area?: AreaId): Promise<FarmPlotDTO[]> {
  const rows = await prisma.userFarmPlot.findMany({
    where: {
      userUuid,
      ...(area ? { area } : {}),
    },
    orderBy: [
      { area: "asc" },
      { plotIndex: "asc" },
    ],
  });
  return rows.map(mapPlotToDTO);
}

// Create a new plot for the user by appending next plotIndex in the area.
/**
 * 新建田地（全局递增 plotIndex），并扣除资源
 */
export async function createPlot(userUuid: string, area?: AreaId): Promise<FarmPlotDTO> {
  const finalArea = area ?? "home";
  return await withUniqueLock(`farm:create:${userUuid}:${finalArea}`, async () => {
    return prisma.$transaction(async (tx) => {
      // Count current plots for this user (all areas count to the same cap or only this area?)
      // Here we cap by ALL plots under this user to keep it simple initially.
      const totalCount = await tx.userFarmPlot.count({
        where: { userUuid },
      });
      if (totalCount >= BASE_MAX_FARM_PLOTS_PER_USER) {
        throw new Error("已达到田地上限");
      }

      // Determine next global plotIndex for this user (unique per user)
      const maxIndexRow = await tx.userFarmPlot.findFirst({
        where: { userUuid },
        orderBy: { plotIndex: "desc" },
        select: { plotIndex: true },
      });
      const nextIndex = (maxIndexRow?.plotIndex ?? -1) + 1;

      // Scale resource requirement by nextIndex (plotIndex multiplier)
      // 需求调整：第 0~5 块(索引 0-5)正常递增，其后新增的田地与第 6 块(索引5)相同消耗
      const multiplier = getPlotCostMultiplier(nextIndex);
      const scaledRequirement = (FARM_PLOT_CREATE_RESOURCE_REQUIREMENT || []).map(r => ({
        ...r,
        count: Math.max(0, Math.floor((r.count ?? 0) * multiplier))
      })).filter(r => (r.count ?? 0) > 0);

      if (scaledRequirement.length) {
        // Check & consume scaled resources
        const pass = await checkResourceRequirementInDB(
          userUuid,
          scaledRequirement,
          tx
        );
        if (!pass) {
          throw new Error("资源不足，无法新建田地");
        }
        // Deduct with modify event
        const decreaseInfo = convertReseourceRequirementToItemModify(
          scaledRequirement
        );
        await decreaseItemCount(userUuid, decreaseInfo, {
          actionName: "新建田地",
          type: ModifyItemCountType.Other,
          showModifyInfo: true,
          sendModifyEvent: true,
        }, tx);
        await invalidateInventoryCache(userUuid);
      }

      const created = await tx.userFarmPlot.create({
        data: {
          userUuid,
          area: finalArea,
          plotIndex: nextIndex,
          state: "LOCKED",
        },
      });
      return mapPlotToDTO(created);
    });
  });
}

/**
 * 解锁指定田地（可能会创建新田地或从 LOCKED 改为 EMPTY）
 */
export async function unlockPlot(
  userUuid: string,
  params: UnlockParams
): Promise<FarmPlotDTO> {
  const area = params.area ?? "home";
  const { plotIndex } = params;

  return await withUniqueLock(`farm:unlock:${userUuid}:${plotIndex}`, async () => {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.userFarmPlot.findFirst({
        where: { userUuid, plotIndex },
      });

      // Helper to check and consume unlock cost (同上：成本在第6块后封顶)
        const payUnlockCost = async () => {
        const multiplier = getPlotCostMultiplier(plotIndex);
        const scaledRequirement = (FARM_PLOT_CREATE_RESOURCE_REQUIREMENT || []).map(r => ({
          ...r,
          count: Math.max(0, Math.floor((r.count ?? 0) * multiplier))
        })).filter(r => (r.count ?? 0) > 0);

        if (scaledRequirement.length) {
          const pass = await checkResourceRequirementInDB(
            userUuid,
            scaledRequirement,
            tx
          );
          if (!pass) throw new Error("资源不足，无法解锁田地");
          const decreaseInfo = convertReseourceRequirementToItemModify(
            scaledRequirement
          );
          await decreaseItemCount(userUuid, decreaseInfo, {
            actionName: `解锁田地 #${plotIndex}`,
            type: ModifyItemCountType.Other,
            showModifyInfo: true,
            sendModifyEvent: true,
          }, tx);
          await invalidateInventoryCache(userUuid);
        }
      };

      if (!existing) {
        // Creating a brand-new plot consumes a slot; check cap
        const totalCount = await tx.userFarmPlot.count({
          where: { userUuid },
        });
        if (totalCount >= BASE_MAX_FARM_PLOTS_PER_USER) {
          throw new Error("已达到田地上限");
        }

        await payUnlockCost();

        const created = await tx.userFarmPlot.create({
          data: {
            userUuid,
            plotIndex,
            area,
            state: "EMPTY",
          },
        });
        return mapPlotToDTO(created);
      }

      if (existing.state === "LOCKED") {
        await payUnlockCost();
        const updated = await tx.userFarmPlot.update({
          where: { id: existing.id },
          data: { state: "EMPTY", area },
        });
        return mapPlotToDTO(updated);
      }

      // Already unlocked; ensure area is updated for consistency
      if (existing.area !== area) {
        const updated = await tx.userFarmPlot.update({
          where: { id: existing.id },
          data: { area },
        });
        return mapPlotToDTO(updated);
      }
      return mapPlotToDTO(existing);
    });
    }
  );
}

/**
 * 播种：
 * - 基于定义与肥料计算生长时间、变异概率、常规/变异产出（概率已调整）
 * - 扣除播种成本（种子与肥料）
 * - 落库时优先写入独立列，失败则回退到 config JSON
 */
export async function plantPlot(userUuid: string, params: PlantParams): Promise<FarmPlotDTO> {
  const area = params.area ?? "home";
  const { plotIndex, seedId } = params;
  let { fertilizers, expectedYield, mutationChance } = params;
  const now = new Date();

  if (!seedId) throw new Error("seedId 不能为空");

  // Compute planting config from definitions if not fully provided by client
  const baseSeedCfg = allFarmingData[seedId as any];
  if (!baseSeedCfg) {
    throw new Error(`未找到种子定义: ${seedId}`);
  }

  // Apply fertilizers effects (stacks) with allowlist check per crop
  const allowIds = baseSeedCfg.fertilizerIds && baseSeedCfg.fertilizerIds.length ? new Set(baseSeedCfg.fertilizerIds) : null;

  const fertStacks = (fertilizers ?? [])
    .filter(f => !!f && !!f.id)
    .filter(f => !allowIds || allowIds.has(f.id))
    .map(f => ({ id: f.id, stacks: Math.max(1, f.stacks ?? 1) }));
  const effects: FertilizerEffect[] = [];
  for (const f of fertStacks) {
    const def = allFertilizer[f.id as any];
    if (!def?.effects?.length) continue;
    for (let i = 0; i < (def.maxStacks ? Math.min(f.stacks, def.maxStacks) : f.stacks); i++) {
      effects.push(...def.effects);
    }
  }

  // Use shared computation for outcome consistency
  const outcome = computeFarmingOutcome(seedId, fertilizers ?? []);
  const finalGrowthSeconds = outcome.finalGrowthSeconds;
  const finalMutationChance = typeof mutationChance === 'number' ? mutationChance : outcome.finalMutationChance;
  const growthSecondsRequired = finalGrowthSeconds;
  mutationChance = finalMutationChance;
  expectedYield = outcome.expectedYield?.length ? outcome.expectedYield : undefined;
  fertilizers = fertStacks.length ? fertStacks : undefined;

  // Consume planting costs: seed plantCost + fertilizer cost (per stack)
  // Read plantCost from raw JSON definition (not in the seed config registry)
  const defs = allFarmingData;
  const cropsArr: any[] = Object.values(defs);
  const cropFull = cropsArr.find((c) => c && c.seedId === seedId);
  const plantCost = [...((cropFull?.plantCost as any[]) ?? [])];
  for (const f of fertStacks) {
    const fd = allFertilizer[f.id as any];
    if (fd?.cost?.length) {
      for (let i = 0; i < (fd.maxStacks ? Math.min(f.stacks, fd.maxStacks) : f.stacks); i++) {
        plantCost.push(...fd.cost);
      }
    }
  }

  // Additionally, consume the fertilizer items themselves equal to used stacks
  const fertilizerSelfReq: { id: string; count: number }[] = [];
  for (const f of fertStacks) {
    const fd = allFertilizer[f.id as any];
    const useStacks = fd?.maxStacks ? Math.min(f.stacks, fd.maxStacks) : f.stacks;
    if (useStacks > 0) fertilizerSelfReq.push({ id: f.id, count: useStacks });
  }

  // Merge fertilizer self consumption into overall plantCost for unified deduction
  plantCost.push(...fertilizerSelfReq);

  return await withUniqueLock(`farm:plant:${userUuid}:${plotIndex}`, async () => {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.userFarmPlot.findFirst({
          where: { userUuid, plotIndex },
        });

        if (!existing) {
          throw new Error("田地不存在");
        }

        // If selected fertilizers, check their sufficiency first to provide clearer error
        if (fertilizerSelfReq.length) {
          const passF = await checkResourceRequirementInDB(userUuid, fertilizerSelfReq, tx);
          if (!passF) throw new Error("肥料不足，无法播种");
        }
        if (plantCost.length) {
          const pass = await checkResourceRequirementInDB(userUuid, plantCost, tx);
          if (!pass) throw new Error(`种植所需资源不足`);
          const dec = convertReseourceRequirementToItemModify(plantCost);
          await decreaseItemCount(userUuid, dec, {
            type: ModifyItemCountType.ActionUse,
            actionName: `种植消耗: ${allGameResource[seedId].name}`,
            showModifyInfo: true,
            sendModifyEvent: true,
          }, tx);
          await invalidateInventoryCache(userUuid);
        }

        if (existing.state !== "EMPTY" && existing.state !== "WITHERED") {
          throw new Error("当前田地不可播种");
        }

        const thisSeedRequiredFarmingPlantLevel = baseSeedCfg.farmingPlantLevelRequired ?? 0;
        if (thisSeedRequiredFarmingPlantLevel > 0) {
            // Check player's farmingPlant level
          const playerFarmingPlantLevel = await getCharacterStatusInfo(userUuid, tx, true);
          const level = playerFarmingPlantLevel.farmingPlant.final ?? playerFarmingPlantLevel.farmingPlant.level ?? 0
          if (level < thisSeedRequiredFarmingPlantLevel) {
            throw new Error(`种植该作物需要种植等级达到 ${thisSeedRequiredFarmingPlantLevel} 级，当前仅 ${playerFarmingPlantLevel.farmingPlant.final ?? 0} 级`);
          }
        }

        const baseUpdate = {
          area,
          state: "GROWING" as const,
          seedId,
          plantedAt: now,
          expectedHarvestAt: new Date(
            now.getTime() + (growthSecondsRequired as number) * 1000
          ),
          growthSecondsRequired,
          growthSecondsAccumulated: 0,
          lastTickAt: now,
        };
        const extUpdate = {
          fertilizers: fertilizers ? JSON.stringify(fertilizers) : undefined,
          expectedYield: expectedYield
            ? JSON.stringify(expectedYield)
            : undefined,
          mutationChance:
            typeof mutationChance === "number" ? mutationChance : undefined,
        };
        try {
          const updated = await prisma.userFarmPlot.update({
            where: { id: existing.id },
            data: { ...(baseUpdate as any), ...(extUpdate as any) } as any,
          });
          return mapPlotToDTO(updated);
        } catch (e: any) {
          // Fallback to config JSON merge
          const oldCfg = existing.config ? safeParseJSON(existing.config) : {};
          const newCfg = {
            ...oldCfg,
            plantingExt: {
              fertilizers: fertilizers ?? undefined,
              expectedYield: expectedYield ?? undefined,
              mutationChance:
                typeof mutationChance === "number" ? mutationChance : undefined,
            },
          };
          const updated = await prisma.userFarmPlot.update({
            where: { id: existing.id },
            data: { ...baseUpdate, config: JSON.stringify(newCfg) } as any,
          });
          return mapPlotToDTO(updated);
        }
      });
    }
  );
}

/**
 * 收获：
 * - 优先使用存储的常规/变异产出
 * - 若缺失，则按定义与肥料即时计算变异产出
 * - 发奖后根据自动补种决定保留或清空状态
 */
export async function harvestPlot(userUuid: string, plotIndex: number): Promise<FarmPlotDTO> {
  const now = new Date();
  return await withUniqueLock(`farm:harvest:${userUuid}:${plotIndex}`, async () => {
    return prisma.$transaction(async (tx) => {
      const plot = await tx.userFarmPlot.findFirst({
        where: { userUuid, plotIndex },
      });
      if (!plot) throw new Error("田地不存在");
      if (plot.state !== "READY") throw new Error("尚未成熟");


      const seedId = plot.seedId;
      const thisSeedCfg = seedId ? allFarmingData[seedId as any] : null;

      if (!seedId || !thisSeedCfg) throw new Error("作物信息缺失，无法收获");

      const expGain = thisSeedCfg?.farmingPlantExpGainWhenHarvest ?? 0;

      // Resolve harvest rewards using stored expectedYield/mutationChance and crop defs
      const cfg = plot.config ? safeParseJSON(plot.config) : (undefined as any);
      const ext = cfg?.plantingExt || cfg?.farmingExt || undefined;
      const fertilizers = plot.fertilizers
        ? safeParseJSON(plot.fertilizers)
        : ext?.fertilizers ?? undefined;
      // 读取合并后的 expectedYield；若缺失，使用共享工具计算一次
      let combinedExpected: WeightedYield[] | undefined = (plot as any)
        .expectedYield
        ? safeParseJSON((plot as any).expectedYield)
        : ext?.expectedYield ?? undefined;
      if (!combinedExpected || combinedExpected.length === 0) {
        if (plot.seedId) {
          const outcome = computeFarmingOutcome(plot.seedId, fertilizers ?? []);
          combinedExpected = outcome.expectedYield;
        } else {
          combinedExpected = undefined;
        }
      }

      // 依据统一的 expectedYield（绝对概率）进行物化
      const rewards: Record<string, number> =
        materializeYields(combinedExpected);

      if (Object.keys(rewards).length) {
        const inc = Object.entries(rewards).reduce((acc, [id, count]) => {
          (acc as any)[id] = { count };
          return acc;
        }, {} as any);
        await increaseItemCount(userUuid, inc, {
          type: ModifyItemCountType.ActionGain,
          actionName: "收获",
          showModifyInfo: true,
          sendModifyEvent: true,
        }, tx);
        await invalidateInventoryCache(userUuid);
      }

      if (expGain > 0) {
        await increaseCharacterStatusExp(userUuid, [
          {
            status: "farmingPlant",
            increaseExp: expGain,
          }
        ], tx);
      }

      const auto =
        plot.autoReplant &&
        plot.seedId &&
        plot.growthSecondsRequired &&
        plot.growthSecondsRequired > 0;
      if (auto) {
        // 重置为新一轮生长
        const updated = await tx.userFarmPlot.update({
          where: { id: plot.id },
          data: {
            state: "GROWING",
            plantedAt: now,
            expectedHarvestAt: new Date(
              now.getTime() + (plot.growthSecondsRequired as number) * 1000
            ),
            growthSecondsAccumulated: 0,
            lastTickAt: now,
          },
        });
        return mapPlotToDTO(updated);
      } else {
        // 清空为 EMPTY
        // Try to clear dedicated columns; if not available, clear config plantingExt
        const baseClear = {
          state: "EMPTY" as const,
          seedId: null as any,
          plantedAt: null as any,
          expectedHarvestAt: null as any,
          growthSecondsRequired: null as any,
          growthSecondsAccumulated: 0,
          lastTickAt: null as any,
        };
        const extClear = {
          fertilizers: null as any,
          expectedYield: null as any,
          mutationChance: null as any,
        };
        try {
          const updated = await tx.userFarmPlot.update({
            where: { id: plot.id },
            data: { ...(baseClear as any), ...(extClear as any) } as any,
          });
          return mapPlotToDTO(updated);
        } catch (e: any) {
          const oldCfg = plot.config ? safeParseJSON(plot.config) : {};
          if (oldCfg?.plantingExt) {
            delete oldCfg.plantingExt;
          }
          const updated = await tx.userFarmPlot.update({
            where: { id: plot.id },
            data: { ...baseClear, config: JSON.stringify(oldCfg || {}) } as any,
          });
          return mapPlotToDTO(updated);
        }
      }
    });
  });
}

/**
 * 设置指定田地的自动补种开关
 */
export async function toggleAutoReplant(userUuid: string, plotIndex: number, value: boolean): Promise<FarmPlotDTO> {
  return await withUniqueLock(`farm:autoReplant:${userUuid}:${plotIndex}`, async () => {
    const plot = await prisma.userFarmPlot.findFirst({ where: { userUuid, plotIndex } });
    if (!plot) throw new Error("田地不存在");
    const updated = await prisma.userFarmPlot.update({
      where: { id: plot.id },
      data: { autoReplant: value },
    });
    return mapPlotToDTO(updated);
  });
}

/**
 * 清理作物：直接清空当前田地，不产生收益与返还（用于误种的纠正）
 * - 仅允许在 GROWING / READY / WITHERED 状态下执行
 * - 执行后状态置为 EMPTY，清空本轮种植相关字段
 */
export async function shovelPlot(userUuid: string, plotIndex: number): Promise<FarmPlotDTO> {
  return await withUniqueLock(`farm:shovel:${userUuid}:${plotIndex}`, async () => {
    return prisma.$transaction(async (tx) => {
      const plot = await tx.userFarmPlot.findFirst({ where: { userUuid, plotIndex } });
      if (!plot) throw new Error("田地不存在");
      if (plot.state === "LOCKED") throw new Error("田地未解锁");
      if (plot.state === "EMPTY") throw new Error("当前为空地，无需清理");

      const baseClear = {
        state: "EMPTY" as const,
        seedId: null as any,
        plantedAt: null as any,
        expectedHarvestAt: null as any,
        growthSecondsRequired: null as any,
        growthSecondsAccumulated: 0,
        lastTickAt: null as any,
      };
      const extClear = {
        fertilizers: null as any,
        expectedYield: null as any,
        mutationChance: null as any,
      };

      try {
        const updated = await tx.userFarmPlot.update({
          where: { id: plot.id },
          data: { ...(baseClear as any), ...(extClear as any) } as any,
        });
        return mapPlotToDTO(updated);
      } catch (e: any) {
        const oldCfg = plot.config ? safeParseJSON(plot.config) : {};
        if (oldCfg?.plantingExt) delete oldCfg.plantingExt;
        const updated = await tx.userFarmPlot.update({
          where: { id: plot.id },
          data: { ...baseClear, config: JSON.stringify(oldCfg || {}) } as any,
        });
        return mapPlotToDTO(updated);
      }
    });
  });
}
