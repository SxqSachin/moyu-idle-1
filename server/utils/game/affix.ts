// 随机词条（Affix）核心服务
// 约束说明：
// - 尽量减少对外部输入依赖，所有入口均做严格校验（由 IO 层与本服务共同完成）
// - 关键写操作使用 Redis 分布式锁 + Prisma 事务，保证并发安全
// - 重要操作均记录审计日志（ADD/UPDATE/REMOVE/REROLL），便于追踪
import { prisma } from "./db";
import { Prisma } from "~/generated/prisma";
import type { PrismaTx } from "~/shared/types/socket/db";
import { safeJsonParse } from "~/shared/utils";
import type {
  AffixDefinition,
  AffixPool,
  CharacterAffixInstance,
  CharacterAffixState,
  AffixRarity,
  AffixEffectResolved,
  AffixKeyInstance,
  AffixKeyTemplate,
} from "~/shared/types/affix";
import { affixDefinitions } from "~/shared/data/affix/definitions";
import { allAffixPools } from "~/shared/data/affix/pools";
import { buildInstanceFromDefinition } from "~/shared/utils/affix";
import { nextRarity, parseSeriesBaseId, seriesAffixIdForRarity } from "~/shared/data/affix/generators";
import { withUniqueLock } from "~/server/utils/lock";
import { getCharacterAffixLimits } from "~/server/utils/game/affixLimit";
import { convertItemCountInfoToResourceRequirement } from "~/shared/utils/game/requirementCheck";
import {
  checkResourceRequirementInDB,
  decreaseItemCount,
} from "~/server/utils/game/characterInventory";
import { ModifyItemCountType } from "~/shared/types/gameInventory";

// 内存映射：affixId -> 定义
const definitionMap = new Map<string, AffixDefinition>(
  affixDefinitions.map((d) => [d.affixId, d])
);

// Narrow type for resource cost maps used throughout (e.g., { gold: { count: 10 } })
type ItemCost = Record<string, { count: number }>;

// Backward-compat: normalize legacy array-shaped effect JSON to a single object
function normalizeAffixEffect<T extends object = any>(val: unknown, fallback: T): T {
  const v = (val ?? fallback) as any;
  if (Array.isArray(v)) return (v[0] ?? fallback) as T;
  if (v && typeof v === "object") return v as T;
  return fallback;
}

function getPoolById(poolId: string): AffixPool | undefined {
  return allAffixPools.find((p) => p.poolId === poolId);
}

function findFirstPoolContainsAffix(affixId: string): AffixPool | undefined {
  return allAffixPools.find((p) => p.entries.some(e => e.affixId === affixId))
}

function pickWeighted<T>(
  items: T[],
  getWeight: (x: T) => number
): T | undefined {
  const total = items.reduce(
    (sum, it) => sum + Math.max(0, getWeight(it) || 0),
    0
  );
  if (total <= 0) return undefined;
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, getWeight(it) || 0);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function computeEntryWeight(
  entry: { affixId: string; weight?: number },
  rarityWeight?: Partial<Record<AffixRarity, number>>
): number {
  const base = entry.weight ?? 1;
  const def = definitionMap.get(entry.affixId);
  if (!def) return base;
  const rw = rarityWeight?.[def.rarity] ?? 1;
  return base * rw;
}

// 查询角色词条（只读）
// 查询角色词条：仅返回指定用户与角色下的数据
export async function listCharacterAffixes(
  userUuid: string,
  characterUuid: string,
  tx?: PrismaTx
): Promise<CharacterAffixInstance[]> {
  if (!tx) tx = prisma;
  const rows = await tx.characterAffix.findMany({
    where: { userUuid, characterUuid },
    orderBy: [{ createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    userUuid: r.userUuid,
    characterUuid: r.characterUuid,
    affixId: r.affixId,
    rarity: r.rarity as any,
  effect: normalizeAffixEffect(safeJsonParse(r.effect, {}), {}),
    score: Number(r.score || 0),
    state: r.state as any,
    source: r.source || undefined,
    seed: r.seed || undefined,
    version: r.version,
    createdAt: r.createdAt?.toISOString?.() ?? (r.createdAt as any),
    updatedAt: r.updatedAt?.toISOString?.() ?? (r.updatedAt as any),
  }));
}

// 写操作审计日志（轻量 JSON 存储 before/after/cost/result）
export async function logCharacterAffixAction(
  params: {
    userUuid: string;
    characterUuid: string;
    action: "INITIALIZE" | "REROLL" | "ADD" | "REMOVE" | "UPDATE";
    before?: CharacterAffixInstance[];
    after?: CharacterAffixInstance[];
    cost?: unknown;
    result?: unknown;
  },
  tx?: PrismaTx
) {
  const { userUuid, characterUuid, action, before, after, cost, result } = params;
  const client = tx ?? prisma;
  await client.characterAffixLog.create({
    data: {
      userUuid,
      characterUuid,
      action,
      before: before ? JSON.stringify(before) : null,
      after: after ? JSON.stringify(after) : null,
      cost: cost ? JSON.stringify(cost) : null,
      result: result ? JSON.stringify(result) : null,
    },
  });
}

// ================= Helpers for progressive reroll =================

const DECIMALS_DEFAULT_FLOAT = 3;
const DECIMALS_CUSTOM_FLOAT = 1;

function isRange(v: unknown): v is { min: number; max: number } {
  return !!v && typeof v === 'object' && 'min' in (v as any) && 'max' in (v as any);
}

function extractTplRange(value: any): { min: number; max: number } | null {
  const raw = value && typeof value === 'object' && 'value' in value ? (value as any).value : value;
  if (isRange(raw)) {
    const min = Math.min(raw.min, raw.max);
    const max = Math.max(raw.min, raw.max);
    return { min, max };
  }
  return null;
}

function progressiveIncreaseInteger(cur: number, min: number, max: number, rnd: () => number): number | undefined {
  const lower = Math.max(cur, min);
  if (lower >= max) return undefined;
  const next = lower + 1 + Math.floor((max - lower) * rnd());
  return next > cur ? next : undefined;
}

function progressiveIncreaseFloat(cur: number, min: number, max: number, decimals: number, rnd: () => number): number | undefined {
  if (cur >= max) return undefined;
  const m = Math.pow(10, decimals);
  const curTimes = Math.round(cur * m); // round to avoid 0.999999
  const minStep = Math.max(Math.ceil(min * m), curTimes + 1);
  const maxStep = Math.floor(max * m);
  if (minStep > maxStep) return undefined;
  const step = minStep + Math.floor((maxStep - minStep + 1) * rnd());
  const next = Math.min(max, step / m);
  return next > cur ? Number(next.toFixed(decimals)) : undefined;
}

function progressiveRerollOneKey(
  eff: AffixKeyInstance,
  tplEff: AffixKeyTemplate,
  rnd: () => number
): { changed: boolean; hasRange: boolean } {
  let changed = false;
  let hasRange = false;

  // statusEffect
  if (Array.isArray(eff.statusEffect) && Array.isArray((tplEff as any)?.statusEffect)) {
    for (const se of eff.statusEffect) {
      const match = (tplEff as any).statusEffect.find((x: any) => x && x.status === (se as any).status);
      if (!match) continue;
      const r = extractTplRange(match.increase ?? match.decrease);
      if (!r) continue;
      hasRange = true;
      const cur = typeof (se as any).increase === 'number' ? (se as any).increase
        : (typeof (se as any).decrease === 'number' ? (se as any).decrease : null);
      if (typeof cur !== 'number') continue;
      const { min, max } = r;
      const next = Number.isInteger(min) && Number.isInteger(max) && Number.isInteger(cur)
        ? progressiveIncreaseInteger(cur, min, max, rnd)
        : progressiveIncreaseFloat(cur, min, max, DECIMALS_DEFAULT_FLOAT, rnd);
      if (typeof next === 'number' && next > cur) {
        if (typeof (se as any).increase === 'number') (se as any).increase = next; else (se as any).decrease = next;
        changed = true;
      }
    }
  }

  // custom / payload numeric ranges
  const instScalar = (eff as any).custom ?? (eff as any).payload;
  const tplScalar = (tplEff as any).custom ?? (tplEff as any).payload;
  const decimals = (eff as any).custom !== undefined ? DECIMALS_CUSTOM_FLOAT : DECIMALS_DEFAULT_FLOAT;

  const handleOne = (curVal: number, tplVal: any, assign: (v: number) => void) => {
    const r = extractTplRange(tplVal);
    if (!r) return; hasRange = true;
    const { min, max } = r;
    const next = (Number.isInteger(min) && Number.isInteger(max) && Number.isInteger(curVal))
      ? progressiveIncreaseInteger(curVal, min, max, rnd)
      : progressiveIncreaseFloat(curVal, min, max, decimals, rnd);
    if (typeof next === 'number' && next > curVal) { assign(next); changed = true; }
  };

  if (instScalar !== undefined && tplScalar !== undefined) {
    if (typeof instScalar === 'number') {
      handleOne(instScalar, tplScalar, (v) => {
        if ((eff as any).custom !== undefined) (eff as any).custom = v; else (eff as any).payload = v;
      });
    } else if (instScalar && typeof instScalar === 'object' && !Array.isArray(instScalar)) {
      const instObj = instScalar as Record<string, number>;
      const tplObj = (tplScalar && typeof tplScalar === 'object' && !Array.isArray(tplScalar)) ? (tplScalar as Record<string, any>) : {};
      for (const k of Object.keys(instObj)) {
        handleOne(instObj[k], tplObj[k], (v) => { ((eff as any).custom ?? (eff as any).payload)[k] = v; });
      }
    }
  }

  return { changed, hasRange };
}

// 从给定词条池抽取若干条并写入数据库
// - 进行持有上限校验与扣费（若配置 costPerRoll）
// - 默认新建词条根据“启用上限”自动设置 ACTIVE/INACTIVE
export async function rollCharacterAffixes(params: {
  userUuid: string;
  characterUuid: string;
  poolId: string;
  countOverride?: number;
  source?: string;
  seed?: string;
}): Promise<{ created: CharacterAffixInstance[] }> {
  const {
    userUuid,
    characterUuid,
    poolId,
    countOverride,
    source = "ADD",
    seed,
  } = params;

  // 关键操作加锁，避免并发抽取导致的不一致
  return await withUniqueLock(`char-affix:${characterUuid}`, async () => {
    const pool = getPoolById(poolId);
    if (!pool) throw new Error("无效的词条池: " + poolId);

    const rules = pool.rules ?? { count: { min: 1, max: 1 } };
    let count =
      countOverride ??
      Math.floor(Math.random() * (rules.count.max - rules.count.min + 1)) +
        rules.count.min;

    // 持有上限校验
    const { maxOwned, maxActive } = await getCharacterAffixLimits(userUuid);
    const currentOwned = await prisma.characterAffix.count({
      where: { userUuid, characterUuid },
    });
    const remainingOwned = maxOwned - currentOwned;
    if (remainingOwned <= 0) {
      throw new Error(`已达最大持有数量上限（${maxOwned}），无法继续抽取`);
    }
    if (count > remainingOwned) {
      throw new Error(
        `本次至多可抽取 ${remainingOwned} 条（持有上限：${maxOwned}）`
      );
    }

    // 先在内存中根据权重完成抽取
    const picked: AffixDefinition[] = [];
    for (let i = 0; i < count; i++) {
      const options = pool.entries;
      if (!options.length) break;
      const item = pickWeighted(options, (e) =>
        computeEntryWeight(e, rules.rarityWeight)
      );
      if (!item) break;
      const def = definitionMap.get(item.affixId);
      if (!def) continue;
      picked.push(def);
    }

    if (!picked.length) return { created: [] };

    // 事务内扣费 + 批量插入并记录日志
    return await prisma.$transaction(async (tx) => {
      // 扣费：若配置了每次抽取消耗，则计算总消耗并校验/扣除
      const perRollCost = rules.costPerRoll;
      let totalCost: ItemCost | null = null;
      if (perRollCost && Object.keys(perRollCost).length && count > 0) {
        const totalCostLocal: ItemCost = Object.fromEntries(
          Object.entries(perRollCost as Record<string, { count?: number }>).map(
            ([rid, info]) => [rid, { count: (info?.count ?? 0) * count }]
          )
        );
        // 校验库存是否足够（在同一事务中）
        const requirement =
          convertItemCountInfoToResourceRequirement(totalCostLocal);
        const enough = await checkResourceRequirementInDB(
          userUuid,
          requirement,
          tx
        );
        if (!enough) {
          throw new Error("资源不足，无法抽取词条");
        }
        // 扣减资源
        await decreaseItemCount(
          userUuid,
          totalCostLocal,
          {
            actionName: `抽取词条（${pool.name}）×${count}`,
            type: ModifyItemCountType.Other,
            showModifyInfo: true,
            sendModifyEvent: true,
          },
          tx
        );
        await invalidateInventoryCache(userUuid);
        totalCost = totalCostLocal;
      }

      // 计算当前启用数量，用于决定新建的默认状态（超过上限则置为 INACTIVE）
      let currentActive = await tx.characterAffix.count({
        where: { userUuid, characterUuid, state: "ACTIVE" as any },
      });
      const created: CharacterAffixInstance[] = [];
      for (const def of picked) {
        const inst = buildInstanceFromDefinition(
          def,
          { userUuid, characterUuid },
          Math.random
        );
        const nextState: CharacterAffixState =
          currentActive < maxActive ? "ACTIVE" : "INACTIVE";
        const row = await tx.characterAffix.create({
          data: {
            userUuid,
            characterUuid,
            affixId: inst.affixId,
            rarity: inst.rarity as any,
            effect: JSON.stringify(inst.effect ?? {}),
            score: new Prisma.Decimal(inst.score ?? 0),
            state: nextState as any,
            source,
            seed: seed ?? null,
            version: 0,
          },
        });

        created.push({
          ...inst,
          state: nextState,
          id: row.id,
          version: row.version,
          createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
          updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as any),
        });
        if (nextState === "ACTIVE") currentActive += 1;
      }

      await logCharacterAffixAction(
        {
          userUuid,
          characterUuid,
          action: "ADD",
          before: undefined,
          after: created,
          cost: totalCost,
          result: { ok: true },
        },
        tx
      );

      return { created };
    });
  });
}

// 稀有度升级：将同系列词条从当前稀有度升级到下一稀有度
export async function upgradeCharacterAffixRarity(params: {
  userUuid: string
  characterUuid: string
  id: number
  expectedVersion?: number
}): Promise<{ current: CharacterAffixInstance | null }> {
  const { userUuid, characterUuid, id, expectedVersion } = params
  return await withUniqueLock(`char-affix:${characterUuid}`, async () => {
    return await prisma.$transaction(async (tx) => {
      const curRow = await tx.characterAffix.findUnique({ where: { id } })
      if (!curRow || curRow.userUuid !== userUuid || curRow.characterUuid !== characterUuid) {
        return { current: null }
      }

      if (typeof expectedVersion === 'number' && curRow.version !== expectedVersion) {
        throw new Error('词条已被其他操作更新，请刷新后重试')
      }

      const curDef = definitionMap.get(curRow.affixId)
      if (!curDef) throw new Error('无效的词条定义')

      const parsed = parseSeriesBaseId(curRow.affixId)
      if (!parsed) throw new Error('该词条不支持稀有度升级')
      const next = nextRarity(curDef.rarity)
      if (!next) throw new Error('已是最高稀有度')
      const targetId = seriesAffixIdForRarity(parsed.baseId, next)
      const targetDef = definitionMap.get(targetId)
      if (!targetDef) throw new Error('未找到对应稀有度的词条定义')

      // 费用：从第一个包含该 affix 的池读取配置
      const pool = findFirstPoolContainsAffix(curRow.affixId)
      const rules = pool?.rules
      const upgradeCost = rules?.rarityUpgradeCostPerRarity?.[curDef.rarity]
      if (!upgradeCost || !Object.keys(upgradeCost).length) {
        throw new Error('未配置该稀有度的升级消耗')
      }

      // 校验/扣费
      const requirement = convertItemCountInfoToResourceRequirement(upgradeCost)
      const enough = await checkResourceRequirementInDB(userUuid, requirement, tx)
      if (!enough) throw new Error('资源不足，无法升级稀有度')
      await decreaseItemCount(userUuid, upgradeCost as ItemCost, {
        actionName: `词条稀有度升级（${curDef.name} → ${targetDef.name}）`,
        type: ModifyItemCountType.Other,
        showModifyInfo: true,
        sendModifyEvent: true,
      }, tx)
      await invalidateInventoryCache(userUuid);

      // 读取当前实例并构造新效果（确保不低于目标稀有度的最小范围）
      const before: CharacterAffixInstance = {
        id: curRow.id,
        userUuid: curRow.userUuid,
        characterUuid: curRow.characterUuid,
        affixId: curRow.affixId,
        rarity: curRow.rarity as any,
        effect: normalizeAffixEffect(safeJsonParse(curRow.effect, {}), {}),
        score: Number(curRow.score || 0),
        state: curRow.state as any,
        source: curRow.source || undefined,
        seed: curRow.seed || undefined,
        version: curRow.version,
        createdAt: curRow.createdAt as any,
        updatedAt: curRow.updatedAt as any,
      }

      const instEff = (before.effect as AffixKeyInstance) || {}
      const tplEff = (targetDef.effect as AffixKeyTemplate) || {}

      // 基于目标模板生成一个“至少为模板最小范围”的效果，且尽量保留当前值（不低于目标最小值）
      const nextEff: AffixKeyInstance = { ...instEff }

      // statusEffect：逐项按 status 对齐
      if (Array.isArray((tplEff as any).statusEffect)) {
        const mapCur = new Map<string, any>()
        if (Array.isArray((instEff as any).statusEffect)) {
          for (const se of (instEff as any).statusEffect) mapCur.set(se.status, se)
        }
        const nextList: any[] = []
        for (const t of (tplEff as any).statusEffect) {
          const r = extractTplRange(t.increase ?? t.decrease) ?? (typeof (t.increase ?? t.decrease) === 'number' ? { min: Number(t.increase ?? t.decrease), max: Number(t.increase ?? t.decrease) } : null)
          const cur = mapCur.get(t.status)
          const curVal = (cur && (typeof cur.increase === 'number' ? cur.increase : (typeof cur.decrease === 'number' ? cur.decrease : undefined)))
          const minVal = r ? r.min : (typeof (t.increase ?? t.decrease) === 'number' ? Number(t.increase ?? t.decrease) : 0)
          const finalVal = Math.max(Number(curVal ?? Number.NEGATIVE_INFINITY), minVal)
          if ('increase' in t && t.increase !== undefined) nextList.push({ status: t.status, increase: finalVal })
          else if ('decrease' in t && t.decrease !== undefined) nextList.push({ status: t.status, decrease: finalVal })
          else nextList.push({ status: t.status, increase: minVal })
        }
        nextEff.statusEffect = nextList
      }

      // custom / payload：支持标量或对象
      const scalarTpl = (tplEff as any).custom ?? (tplEff as any).payload
      const useCustom = (tplEff as any).custom !== undefined
      const readMin = (tplVal: any): number | null => {
        const r = extractTplRange(tplVal)
        if (r) return r.min
        if (typeof tplVal === 'number') return tplVal
        return null
      }

      if (scalarTpl !== undefined) {
        const scalarCur = (instEff as any).custom ?? (instEff as any).payload
        if (typeof scalarTpl === 'number' || isRange(scalarTpl) || (scalarTpl && typeof scalarTpl === 'object' && 'value' in scalarTpl)) {
          const minV = readMin(scalarTpl)
          const curV = typeof scalarCur === 'number' ? scalarCur : undefined
          const finalV = minV != null ? Math.max(curV ?? Number.NEGATIVE_INFINITY, minV) : (curV ?? 0)
          if (useCustom) (nextEff as any).custom = finalV; else (nextEff as any).payload = finalV
        } else if (scalarTpl && typeof scalarTpl === 'object') {
          const obj: Record<string, number> = {}
          const keys = Object.keys(scalarTpl)
          for (const k of keys) {
            const minV = readMin((scalarTpl as any)[k])
            const curV = scalarCur && typeof scalarCur === 'object' ? Number((scalarCur as any)[k] ?? Number.NEGATIVE_INFINITY) : Number.NEGATIVE_INFINITY
            obj[k] = minV != null ? Math.max(curV, minV) : (isFinite(curV) ? curV : 0)
          }
          if (useCustom) (nextEff as any).custom = obj; else (nextEff as any).payload = obj
        }
      }

      // 更新行
      const row = await tx.characterAffix.update({
        where: { id },
        data: {
          affixId: targetDef.affixId,
          rarity: next as any,
          effect: JSON.stringify(nextEff ?? {}),
          version: { increment: 1 },
        }
      })

      const current: CharacterAffixInstance = {
        id: row.id,
        userUuid: row.userUuid,
        characterUuid: row.characterUuid,
        affixId: row.affixId,
        rarity: row.rarity as any,
        effect: normalizeAffixEffect(safeJsonParse(row.effect, {}), {}),
        score: Number(row.score || 0),
        state: row.state as any,
        source: row.source || undefined,
        seed: row.seed || undefined,
        version: row.version,
        createdAt: row.createdAt as any,
        updatedAt: row.updatedAt as any,
      }

      await logCharacterAffixAction({
        userUuid,
        characterUuid,
        action: 'UPDATE',
        before: [before],
        after: [current],
        cost: upgradeCost,
        result: { upgradedTo: next, targetId: targetDef.affixId },
      }, tx)

      return { current }
    })
  })
}

// 更新词条状态（ACTIVE/INACTIVE/LOCKED）
// - 若启用（ACTIVE）需校验启用上限
// - 使用乐观锁控制并发写
export async function updateCharacterAffixState(params: {
  userUuid: string;
  characterUuid: string;
  id: number;
  newState: CharacterAffixState;
  expectedVersion?: number;
}): Promise<{ ok: boolean; current?: CharacterAffixInstance | null }> {
  const { userUuid, characterUuid, id, newState, expectedVersion } = params;
  return await withUniqueLock(`char-affix:${characterUuid}`, async () => {
    return await prisma.$transaction(async (tx) => {
      // 读取当前行
      const curRow = await tx.characterAffix.findUnique({ where: { id } });
      if (
        !curRow ||
        curRow.userUuid !== userUuid ||
        curRow.characterUuid !== characterUuid
      ) {
        return { ok: false };
      }

      // 若要启用则校验上限
      if (newState === "ACTIVE" && curRow.state !== "ACTIVE") {
        const { maxActive } = await getCharacterAffixLimits(userUuid);
        const activeCount = await tx.characterAffix.count({
          where: { userUuid, characterUuid, state: "ACTIVE" as any },
        });
        if (activeCount >= maxActive) {
          throw new Error(`启用的词条数量已达上限（${maxActive}）`);
        }
      }

      // 乐观锁：确保版本一致
      const where: any = { id, userUuid, characterUuid };
      if (typeof expectedVersion === "number") {
        where.version = expectedVersion;
      }
      const updated = await tx.characterAffix.updateMany({
        where,
        data: { state: newState as any, version: { increment: 1 } as any },
      });
      if (updated.count <= 0) {
        return { ok: false };
      }

      const newRow = await tx.characterAffix.findUnique({ where: { id } });
      const current = curRow
        ? ({
            id: newRow!.id,
            userUuid: newRow!.userUuid,
            characterUuid: newRow!.characterUuid,
            affixId: newRow!.affixId,
            rarity: newRow!.rarity as any,
            effect: safeJsonParse(newRow!.effect, {}),
            score: Number(newRow!.score || 0),
            state: newRow!.state as any,
            source: newRow!.source || undefined,
            seed: newRow!.seed || undefined,
            version: newRow!.version,
            createdAt:
              newRow!.createdAt?.toISOString?.() ?? (newRow!.createdAt as any),
            updatedAt:
              newRow!.updatedAt?.toISOString?.() ?? (newRow!.updatedAt as any),
          } as CharacterAffixInstance)
        : null;

      await logCharacterAffixAction(
        {
          userUuid,
          characterUuid,
          action: "UPDATE",
          before: undefined,
          after: current ? [current] : undefined,
          result: { ok: true, op: "updateState" },
        },
        tx
      );

      return { ok: true, current };
    });
  });
}

// 删除词条（按 id）
// - 仅在当前用户与角色下操作；日志亦仅记录本人的数据
export async function removeCharacterAffix(params: {
  userUuid: string;
  characterUuid: string;
  id: number;
}): Promise<{ ok: boolean }> {
  const { userUuid, characterUuid, id } = params;
  return await withUniqueLock(`char-affix:${characterUuid}`, async () => {
    return await prisma.$transaction(async (tx) => {
      // 仅查询并记录当前用户与角色下的记录，避免误记录他人数据
      const before = await tx.characterAffix.findFirst({
        where: { id, userUuid, characterUuid },
      });
      await tx.characterAffix.deleteMany({
        where: { id, userUuid, characterUuid },
      });

      await logCharacterAffixAction(
        {
          userUuid,
          characterUuid,
          action: "REMOVE",
          before: before
            ? [
                {
                  id: before.id,
                  userUuid: before.userUuid,
                  characterUuid: before.characterUuid,
                  affixId: before.affixId,
                  rarity: before.rarity as any,
                  effect: normalizeAffixEffect(safeJsonParse(before.effect, {}), {}),
                  score: Number(before.score || 0),
                  state: before.state as any,
                  source: before.source || undefined,
                  seed: before.seed || undefined,
                  version: before.version,
                  createdAt:
                    before.createdAt?.toISOString?.() ??
                    (before.createdAt as any),
                  updatedAt:
                    before.updatedAt?.toISOString?.() ??
                    (before.updatedAt as any),
                },
              ]
            : undefined,
          after: undefined,
          result: { ok: true, op: "remove" },
        },
        tx
      );

      return { ok: true };
    });
  });
}

// 批量删除词条（按 id 列表）
// - 仅在当前用户与角色下操作；日志仅记录本人的数据
export async function removeCharacterAffixesBulk(params: {
  userUuid: string;
  characterUuid: string;
  ids: number[];
}): Promise<{ ok: boolean; removedIds: number[] }> {
  const { userUuid, characterUuid, ids } = params;
  if (!Array.isArray(ids) || ids.length === 0)
    return { ok: true, removedIds: [] };
  const uniqIds = Array.from(
    new Set(ids.filter((x) => Number.isInteger(x) && x > 0))
  );
  if (uniqIds.length === 0) return { ok: true, removedIds: [] };

  return await withUniqueLock(`char-affix:${characterUuid}`, async () => {
    return await prisma.$transaction(async (tx) => {
      // 查询并记录当前用户与角色下的将被删除的记录
      const befores = await tx.characterAffix.findMany({
        where: { id: { in: uniqIds }, userUuid, characterUuid },
      });

      // 执行删除（仅自己的记录会被删除）
      const delRes = await tx.characterAffix.deleteMany({
        where: { id: { in: uniqIds }, userUuid, characterUuid },
      });

      if (befores.length) {
        await logCharacterAffixAction(
          {
            userUuid,
            characterUuid,
            action: "REMOVE",
            before: befores.map((before) => ({
              id: before.id,
              userUuid: before.userUuid,
              characterUuid: before.characterUuid,
              affixId: before.affixId,
              rarity: before.rarity as any,
              effect: normalizeAffixEffect(safeJsonParse(before.effect, {}), {}),
              score: Number(before.score || 0),
              state: before.state as any,
              source: before.source || undefined,
              seed: before.seed || undefined,
              version: before.version,
              createdAt:
                before.createdAt?.toISOString?.() ?? (before.createdAt as any),
              updatedAt:
                before.updatedAt?.toISOString?.() ?? (before.updatedAt as any),
            })),
            after: undefined,
            result: { ok: true, op: "removeMany", count: delRes.count },
          },
          tx
        );
      }

      const removedIds = befores.map((b) => b.id);
      return { ok: true, removedIds };
    });
  });
}

// 对单个词条进行“重抽数值”：保持 affixId 与稀有度不变，仅重新解析模板中的区间，生成新的具体数值
// 重抽词条（仅重掷模板区间数值，不改变 affixId/稀有度/状态）
// - 在包含该词条的池中查找按稀有度配置的重抽消耗并扣费
// - 使用乐观锁保护并发更新
export async function rerollCharacterAffix(params: {
  userUuid: string;
  characterUuid: string;
  id: number;
  expectedVersion?: number;
}): Promise<{ ok: boolean; current?: CharacterAffixInstance | null }> {
  const { userUuid, characterUuid, id, expectedVersion } = params;
  return await withUniqueLock(`char-affix:${characterUuid}`, async () => {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.characterAffix.findUnique({ where: { id } });
      if (
        !row ||
        row.userUuid !== userUuid ||
        row.characterUuid !== characterUuid
      ) {
        throw new Error("无效的词条");
      }

      const def = definitionMap.get(row.affixId);
      if (!def) {
        throw new Error("词条定义不存在，无法重抽");
      }

      // 记录 before
      const beforeInst: CharacterAffixInstance = {
        id: row.id,
        userUuid: row.userUuid,
        characterUuid: row.characterUuid,
        affixId: row.affixId,
        rarity: row.rarity as any,
  effect: normalizeAffixEffect(safeJsonParse(row.effect, {}), {}),
        score: Number(row.score || 0),
        state: row.state as any,
        source: row.source || undefined,
        seed: row.seed || undefined,
        version: row.version,
        createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
        updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as any),
      };

      // 在池中查找该词条定义所属的任一池，以确定重抽成本
      const containingPool = allAffixPools.find((p) =>
        p.entries.some((e) => e.affixId === row.affixId)
      );
      const rarity = row.rarity as AffixRarity;
      let totalCost: ItemCost | null = null;
      if (containingPool?.rules?.rerollCostPerRarity) {
        const cost = containingPool.rules.rerollCostPerRarity[rarity];
        if (cost && Object.keys(cost).length) {
          const totalCostLocal = cost as ItemCost;
          const requirement =
            convertItemCountInfoToResourceRequirement(totalCostLocal);
          const enough = await checkResourceRequirementInDB(
            userUuid,
            requirement,
            tx
          );
          if (!enough) {
            throw new Error("资源不足，无法重抽");
          }
          await decreaseItemCount(
            userUuid,
            totalCostLocal,
            {
              actionName: `重抽词条（${def.name}）`,
              type: ModifyItemCountType.Other,
              showModifyInfo: true,
              sendModifyEvent: true,
            },
            tx
          );
          await invalidateInventoryCache(userUuid);
          totalCost = totalCostLocal;
        }
      }

      // 使用相同定义重建 effect（重新掷区间）
      const rebuilt = buildInstanceFromDefinition(
        def,
        { userUuid, characterUuid },
        Math.random
      );

      // 乐观锁
      const where: any = { id };
      if (typeof expectedVersion === "number") where.version = expectedVersion;

      const updated = await tx.characterAffix.updateMany({
        where,
        data: {
          effect: JSON.stringify(rebuilt.effect ?? {}),
          score: new Prisma.Decimal(rebuilt.score ?? 0),
          version: { increment: 1 } as any,
        },
      });
      if (updated.count <= 0) {
        throw new Error("重抽失败，请重试");
      }

      const newRow = await tx.characterAffix.findUnique({ where: { id } });
      const current: CharacterAffixInstance = {
        id: newRow!.id,
        userUuid: newRow!.userUuid,
        characterUuid: newRow!.characterUuid,
        affixId: newRow!.affixId,
        rarity: newRow!.rarity as any,
            effect: normalizeAffixEffect(safeJsonParse(newRow!.effect, {}), {}),
        score: Number(newRow!.score || 0),
        state: newRow!.state as any,
        source: newRow!.source || undefined,
        seed: newRow!.seed || undefined,
        version: newRow!.version,
        createdAt:
          newRow!.createdAt?.toISOString?.() ?? (newRow!.createdAt as any),
        updatedAt:
          newRow!.updatedAt?.toISOString?.() ?? (newRow!.updatedAt as any),
      };

      await logCharacterAffixAction(
        {
          userUuid,
          characterUuid,
          action: "REROLL",
          before: [beforeInst],
          after: [current],
          cost: totalCost,
          result: { ok: true, op: "reroll" },
        },
        tx
      );

      return { ok: true, current };
    });
  });
}

// 进阶重随：仅将“区间生成的数值”向上重掷，保证新值 >= 当前值，且不超过定义上限
// 规则：
// - 仅支持模板中存在区间（NumericRange）的数值项（当前实现针对 statusEffect）
// - 对于每一个区间数值，按 [current, max] 重新取整点，若已等于 max 则保持不变
// - 若该词条不存在任何区间数值，或所有区间数值均已达上限，则报错
// - 扣费规则与普通重抽相同（按包含该词条的池的 rerollCostPerRarity）
export async function rerollCharacterAffixProgressive(params: {
  userUuid: string;
  characterUuid: string;
  id: number;
  expectedVersion?: number;
}): Promise<{ ok: boolean; current?: CharacterAffixInstance | null }> {
  const { userUuid, characterUuid, id, expectedVersion } = params;
  return await withUniqueLock(`char-affix:${characterUuid}`, async () => {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.characterAffix.findUnique({ where: { id } });
      if (
        !row ||
        row.userUuid !== userUuid ||
        row.characterUuid !== characterUuid
      ) {
        throw new Error("无效的词条");
      }

      const def = definitionMap.get(row.affixId);
      if (!def) throw new Error("词条定义不存在，无法进阶重随");

      const beforeInst: CharacterAffixInstance = {
        id: row.id,
        userUuid: row.userUuid,
        characterUuid: row.characterUuid,
        affixId: row.affixId,
        rarity: row.rarity as any,
  effect: normalizeAffixEffect(safeJsonParse(row.effect, {}), {}),
        score: Number(row.score || 0),
        state: row.state as any,
        source: row.source || undefined,
        seed: row.seed || undefined,
        version: row.version,
        createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
        updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as any),
      };

      // 扣费（优先使用进阶重随专用消耗，其次回退到普通重抽消耗）
      const containingPool = allAffixPools.find((p) =>
        p.entries.some((e) => e.affixId === row.affixId)
      );
      const rarity = row.rarity as AffixRarity;
      let totalCost: ItemCost | null = null;
      if (containingPool?.rules) {
        const costMapUp = (containingPool.rules)
          .rerollUpCostPerRarity as
          | Partial<Record<AffixRarity, any>>
          | undefined;
        const costMap = containingPool.rules.rerollCostPerRarity;
        const cost =
          (costMapUp && costMapUp[rarity]) || (costMap && costMap[rarity]);
        if (cost && Object.keys(cost).length) {
          const totalCostLocal = cost as ItemCost;
          const requirement =
            convertItemCountInfoToResourceRequirement(totalCostLocal);
          const enough = await checkResourceRequirementInDB(
            userUuid,
            requirement,
            tx
          );
          if (!enough) {
            throw new Error("资源不足，无法进阶重随");
          }
          await decreaseItemCount(
            userUuid,
            totalCostLocal,
            {
              actionName: `进阶重随（${def.name}）`,
              type: ModifyItemCountType.Other,
              showModifyInfo: true,
              sendModifyEvent: true,
            },
            tx
          );
          await invalidateInventoryCache(userUuid);
          totalCost = totalCostLocal;
        }
      }

      // 构造新的 effect：仅对区间数值进行向上重掷
      const currentEffect: AffixEffectResolved = JSON.parse(
        JSON.stringify(beforeInst.effect)
      ) as AffixEffectResolved;
  const tpl = def.effect as AffixKeyTemplate | null;

      if (!tpl) throw new Error("词条定义无效，无法进阶重随");

      let hasRange = false;
      let changed = false;
      {
        const eff = currentEffect as AffixKeyInstance;
        const { hasRange: hr, changed: ch } = progressiveRerollOneKey(eff, tpl, Math.random);
        if (hr) hasRange = true;
        if (ch) changed = true;
      }

      if (!hasRange) {
        throw new Error("该词条不包含可进阶的区间数值");
      }
      if (!changed) {
        throw new Error("所有数值已达上限，无法进阶重随");
      }

      // 乐观锁更新（仅更新 effect 与版本；保留 score 原值）
      const where: any = { id };
      if (typeof expectedVersion === "number") where.version = expectedVersion;

      const updated = await tx.characterAffix.updateMany({
        where,
        data: {
          effect: JSON.stringify(currentEffect ?? {}),
          version: { increment: 1 } as any,
        },
      });
      if (updated.count <= 0) throw new Error("进阶重随失败，请重试");

      const newRow = await tx.characterAffix.findUnique({ where: { id } });
      const current: CharacterAffixInstance = {
        id: newRow!.id,
        userUuid: newRow!.userUuid,
        characterUuid: newRow!.characterUuid,
        affixId: newRow!.affixId,
        rarity: newRow!.rarity as any,
  effect: normalizeAffixEffect(safeJsonParse(newRow!.effect, {}), {}),
        score: Number(newRow!.score || 0),
        state: newRow!.state as any,
        source: newRow!.source || undefined,
        seed: newRow!.seed || undefined,
        version: newRow!.version,
        createdAt:
          newRow!.createdAt?.toISOString?.() ?? (newRow!.createdAt as any),
        updatedAt:
          newRow!.updatedAt?.toISOString?.() ?? (newRow!.updatedAt as any),
      };

      await logCharacterAffixAction(
        {
          userUuid,
          characterUuid,
          action: "REROLL",
          before: [beforeInst],
          after: [current],
          cost: totalCost,
          result: { ok: true, op: "rerollUp" },
        },
        tx
      );

      return { ok: true, current };
    });
  });
}
