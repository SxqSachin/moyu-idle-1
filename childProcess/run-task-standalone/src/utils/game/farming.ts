import { prisma } from "../prisma";
/**
 * Farming module 结构重构说明 (2025-10):
 * 1. harvestPlot 现在只负责：校验 READY -> 结算产出 -> 发放奖励 -> 清空田地。
 *    - 不再内置自动补种。避免隐藏的免费续期与重复成本逻辑冲突。
 * 2. autoHarvestAndReplant 负责：
 *    - 调用 harvestPlot (可指定 yieldFactor / delivery)
 *    - 若 plot.autoReplant==true 则再调用 plantPlot 重新扣资源、重新应用肥料与成长配置
 *    - 若资源不足或失败，关闭 autoReplant 并返回清空后的田地
 * 3. 原 HarvestOptions.respectAutoReplant 字段删除。
 * 这样数据与成本路径唯一：任何进入 GROWING 的作物都必然经过 plantPlot（含成本校验）。
 */
import { withUniqueLock } from "../index";
import type { FarmAreaId, FarmPlotDTO, FarmPlotState, WeightedYield, FertilizerEffect } from "~/shared/types/farming";
import { BASE_MAX_FARM_PLOTS_PER_USER, FARM_PLOT_CREATE_RESOURCE_REQUIREMENT } from "~/shared/data/constant";
import { checkResourceRequirementInDB, decreaseItemCount } from "./characterInventory";
import { convertReseourceRequirementToItemModify, } from "~/shared/utils/game/requirementCheck";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
// Use shared readonly registries instead of ad-hoc finders
import { allFarmingData, allFertilizer } from "~/shared/data/allFarmingData";
import { increaseCharacterStatusExp, getCharacterStatusInfo } from "./characterStatus"; // FIX: added getCharacterStatusInfo (was missing causing auto-replant failure)
import { computeFarmingOutcome } from "~/shared/utils/game/farmingOutcome";
import { allGameResource } from "~/shared/data/allGameResources";
import { enqueueToHarvestBox } from "./harvestBox";
import { increaseItemCount, invalidateInventoryCache } from "./characterInventory"

type AreaId = FarmAreaId; // alias for internal usage

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
      const multiplier = Math.max(0, nextIndex);
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

      // Helper to check and consume unlock cost
      const payUnlockCost = async () => {
        const multiplier = Math.max(0, plotIndex);
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
  // Use a short hard-coded transaction timeout and a small retry for transient tx expiration errors.
  const PLANT_TX_TIMEOUT_MS = 5000; // 5s
  const MAX_TX_RETRY = 2;
  const isTransientTxError = (e: any) => {
    const m = (e && (e.message || String(e))) || '';
    return /Transaction already closed|timeout|expired|Transaction expired/i.test(m);
  };

  let lastErr: any = null;
  for (let attempt = 1; attempt <= MAX_TX_RETRY; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
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
          const updated = await tx.userFarmPlot.update({
            where: { id: existing.id },
            data: { ...baseUpdate, config: JSON.stringify(newCfg) } as any,
          });
          return mapPlotToDTO(updated);
        }
      }, { timeout: PLANT_TX_TIMEOUT_MS, maxWait: PLANT_TX_TIMEOUT_MS });
    } catch (e: any) {
      lastErr = e;
      if (!isTransientTxError(e) || attempt === MAX_TX_RETRY) {
        throw e;
      }
      const backoff = 100 * attempt;
      console.warn(`[Farm] plantPlot transaction attempt ${attempt} failed (transient), retrying after ${backoff}ms:`, e?.message || e);
      await new Promise(res => setTimeout(res, backoff));
      continue;
    }
  }
  throw lastErr;
}

/**
 * 收获：
 * - 优先使用存储的常规/变异产出
 * - 若缺失，则按定义与肥料即时计算变异产出
 * - 发奖后根据自动补种决定保留或清空状态
 */
type HarvestDeliveryMode = "inventory" | "harvestBox";
interface HarvestOptions {
  yieldFactor?: number; // multiply yields then floor
  delivery?: HarvestDeliveryMode; // default: inventory
  boxTitle?: string;
  boxSource?: "Auto" | "Manual" | "Event" | "Mail" | "GM" | "Other";
  boxExtra?: any;
  noTransaction?: boolean; // 如果为 true，则不使用交互事务，直接使用 prisma（依赖外层锁保证互斥）
  // NOTE: 自动补种逻辑已从 harvestPlot 移除，统一在上层 (autoHarvestAndReplant) 使用 plantPlot 完成并扣除资源。
}

export async function harvestPlot(userUuid: string, plotIndex: number, opt?: HarvestOptions): Promise<FarmPlotDTO> {
  const now = new Date();
  return await withUniqueLock(`farm:harvest:${userUuid}:${plotIndex}`, async () => {
  // tx 既可能是 prisma 也可能是事务上下文，使用宽类型 any 以避免 PrismaClient 裁剪导致的类型不兼容
  const run = async (tx: any) => {
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
      const rewardsFull: Record<string, number> = materializeYields(combinedExpected);

      // 应用可选系数（默认 1.0，向上取整）
      const factor = typeof opt?.yieldFactor === 'number' ? Math.max(0, opt.yieldFactor) : 1;
      const rewards: Record<string, number> = {};
      for (const [id, count] of Object.entries(rewardsFull)) {
        const n = Math.ceil(count * factor);
        if (n > 0) rewards[id] = n;
      }

      if (Object.keys(rewards).length) {
        const inc = Object.entries(rewards).reduce((acc, [id, count]) => {
          (acc as any)[id] = { count };
          return acc;
        }, {} as any);

        const delivery: HarvestDeliveryMode = opt?.delivery ?? "inventory";
        if (delivery === "inventory") {
          await increaseItemCount(userUuid, inc, {
            type: ModifyItemCountType.ActionGain,
            actionName: "收获",
            showModifyInfo: true,
            sendModifyEvent: true,
          }, tx);
          await invalidateInventoryCache(userUuid);
        } else {
          await enqueueToHarvestBox(userUuid, inc, {
            title: opt?.boxTitle ?? `收获：${allGameResource[seedId as any]?.name ?? seedId}`,
            source: opt?.boxSource ?? "Other",
            extra: opt?.boxExtra ?? { plotIndex, area: plot.area, seedId },
          }, tx);
        }
      }

      if (expGain > 0) {
        await increaseCharacterStatusExp(userUuid, [
          {
            status: "farmingPlant",
            increaseExp: expGain,
          }
        ], tx);
      }

      // 统一：harvestPlot 仅负责奖励与清空，不再自动补种
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
    };

    if (opt?.noTransaction) {
      // 非事务模式：更快但不保证多步原子性；依赖外层 withUniqueLock 避免并发冲突
      try {
        const start = Date.now();
        const res = await run(prisma);
        const cost = Date.now() - start;
        if (cost > 4000) console.warn(`[Farm] harvestPlot(noTx) slow ${cost}ms user=${userUuid} plot=${plotIndex}`);
        return res;
      } catch (e) {
        console.error('[Farm] harvestPlot(noTx) error', (e as any)?.message || e);
        throw e;
      }
    }

    // 事务模式：延长超时，避免 5s 默认限制
    const TX_TIMEOUT_MS = 15000;
    return prisma.$transaction((tx) => run(tx), { timeout: TX_TIMEOUT_MS, maxWait: TX_TIMEOUT_MS });
  });
}

/**
 * 自动收获并尝试按当前配置补种：
 * - 收获时只发放标准产量的80%（向下取整）
 * - 若补种所需素材足够，则扣费并写入为 GROWING
 * - 若素材不足，则将该田地清空为 EMPTY 并关闭 autoReplant（停止自动补种）
 */
export async function autoHarvestAndReplant(userUuid: string, plotIndex: number): Promise<FarmPlotDTO> {
  return await withUniqueLock(`farm:autoHarvest:${userUuid}:${plotIndex}`, async () => {
    // 预取配置（为了补种时保留肥料等）
    const plot = await prisma.userFarmPlot.findFirst({ where: { userUuid, plotIndex } });
    if (!plot) throw new Error('田地不存在');
    if (plot.state !== 'READY') throw new Error('尚未成熟');
    if (!plot.seedId) throw new Error('作物信息缺失，无法收获');

    const cfg = plot.config ? safeParseJSON(plot.config) : (undefined as any);
    const ext = cfg?.plantingExt || cfg?.farmingExt || undefined;
    const fertilizers = plot.fertilizers ? safeParseJSON(plot.fertilizers) : ext?.fertilizers ?? undefined;

    // 1) 仅收获（统一逻辑：harvestPlot 不再自动重生）
    await harvestPlot(userUuid, plotIndex, {
      yieldFactor: 0.8,
      delivery: 'harvestBox',
      boxTitle: `自动收获：${allGameResource[plot.seedId as any]?.name ?? plot.seedId}`,
      boxSource: 'Auto',
      boxExtra: { plotIndex, area: plot.area, seedId: plot.seedId },
      noTransaction: true,
    });

  // 2) 若设置了自动补种，则尝试按相同配置补种（使用现有 plantPlot 处理扣费/校验）
    if (plot.autoReplant && plot.seedId) {
      try {
        const planted = await plantPlot(userUuid, {
          plotIndex,
          seedId: plot.seedId,
          area: plot.area as any,
          fertilizers: Array.isArray(fertilizers) ? fertilizers : undefined,
        });
        return planted;
      } catch (e: any) {
        // 之前这里静默吞掉所有异常，导致真正代码错误（如缺失 getCharacterStatusInfo 引用）被误判为资源不足并悄悄关闭自动补种
        console.error('[FarmCron] autoReplant 失败，关闭自动补种 user=' + userUuid + ' plot=' + plotIndex + ':', e?.message || e);
        const updated = await prisma.userFarmPlot.update({
          where: { id: plot.id },
          data: { autoReplant: false },
        });
        return mapPlotToDTO(updated);
      }
    }

    // 若未开启自动补种，返回收获后清空的田地（harvestPlot 已清空）
    const after = await prisma.userFarmPlot.findFirst({ where: { id: plot.id } });
    return mapPlotToDTO(after);
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
