import { prisma } from "../prisma";
import type { Prisma } from "~/generated/prisma";
import type { ItemCountInfo } from "~/shared/types/gameInventory";
import type { PrismaTx } from "~/shared/types/socket/db";
import type {
  HarvestBoxCreateInput,
  HarvestBoxItemDTO,
  HarvestBoxListItemDTO,
  HarvestBoxListQuery,
  HarvestBoxRecord,
  HarvestBoxSource,
} from "~/shared/types/harvestBox";
import { emitEventToUser } from "./msgQueue"
import { withUniqueLock } from "../index"; // 为自动收获合并增加锁，避免并发产生多个箱子

export function toDTO(list: Awaited<ReturnType<typeof listHarvestBoxes>>): HarvestBoxListItemDTO[] {
  return list.map((b) => ({
    id: b.id,
    uuid: b.uuid,
    title: b.title ?? null,
    source: (b.source ?? null) as any,
    sourceId: b.sourceId ?? null,
    createdAt: b.createdAt.toISOString(),
    expiresAt: b.expiresAt ? b.expiresAt.toISOString() : null,
    claimed: b.claimed,
    items: b.items.map<HarvestBoxItemDTO>((i) => ({
      id: (i as any).id,
      resourceId: i.resourceId,
      amount: typeof i.amount === "bigint" ? Number(i.amount) : i.amount,
      // Do not expose raw meta to clients to avoid leaking sensitive info
      meta: null,
      claimed: i.claimed,
      claimedAt: i.claimedAt ? i.claimedAt.toISOString() : null,
    })),
  }));
}


// 工具：把 ItemCountInfo 展开成条目数组
function flattenItemCountInfo(items: ItemCountInfo): Array<{ resourceId: string; amount: number }> {
  const result: Array<{ resourceId: string; amount: number }> = [];
  for (const [rid, info] of Object.entries(items)) {
    if (!info || !info.count) continue;
    const amount = Number(info.count);
    if (amount > 0) {
      result.push({ resourceId: rid, amount });
    }
  }
  return result;
}

// 创建一个收获箱（仅写箱子与条目，不做立即入背包）
export async function createHarvestBox(input: HarvestBoxCreateInput, tx?: PrismaTx) {
  const { userUuid, source, sourceId, title, extra, expiresAt, items } = input;
  const flat = flattenItemCountInfo(items);
  if (!flat.length) return null;
  // 抽取公共合并+创建逻辑，避免事务与非事务模式的重复代码
  const run = async (trx: any) => {
    const existing = await trx.harvestBox.findFirst({
      where: { userUuid, claimed: false, source: source as any, title: title ?? null },
      orderBy: { id: 'desc' }
    });
    if (existing) {
      // 累加或创建条目（先动子表，避免与其他路径的锁序冲突）
      const existingItems = await trx.harvestBoxItem.findMany({
        where: { harvestBoxId: existing.id, claimed: false },
        select: { id: true, resourceId: true, amount: true }
      });
      const itemMap: Record<string, { id: number; amount: bigint }> = {};
      for (const it of existingItems) itemMap[it.resourceId] = { id: it.id, amount: it.amount };

      const createData: { harvestBoxId: number; resourceId: string; amount: bigint; meta: any }[] = [];
      const updatePromises: Promise<any>[] = [];
      for (const it of flat) {
        const key = it.resourceId;
        const amt = BigInt(it.amount);
        if (itemMap[key]) {
          const newAmt = itemMap[key].amount + amt;
          updatePromises.push(trx.harvestBoxItem.update({ where: { id: itemMap[key].id }, data: { amount: newAmt } }));
          itemMap[key].amount = newAmt;
        } else {
          createData.push({ harvestBoxId: existing.id, resourceId: key, amount: amt, meta: null });
        }
      }
      if (createData.length) await trx.harvestBoxItem.createMany({ data: createData });
      if (updatePromises.length) await Promise.all(updatePromises);

      // 最后再更新父表字段（过期时间 / extra），保持锁序“子 -> 父”一致
      const parentUpdate: Prisma.HarvestBoxUpdateInput = {};
      if (expiresAt && (!existing.expiresAt || expiresAt > existing.expiresAt)) {
        parentUpdate.expiresAt = expiresAt;
      }
      if (extra) {
        parentUpdate.extra = JSON.stringify(extra);
      }
      if (Object.keys(parentUpdate).length) {
        await trx.harvestBox.update({ where: { id: existing.id }, data: parentUpdate });
      }
      return existing;
    }
    const created = await trx.harvestBox.create({
      data: {
        userUuid,
        source: source as any,
        sourceId: sourceId ?? null,
        title: title ?? null,
        extra: extra ? JSON.stringify(extra) : null,
        expiresAt: expiresAt ?? null,
      },
    });
    await trx.harvestBoxItem.createMany({
      data: flat.map((it) => ({
        harvestBoxId: created.id,
        resourceId: it.resourceId,
        amount: BigInt(it.amount),
        meta: null,
      })),
    });
    return created;
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}

// 列出收获箱（简单分页）
export async function listHarvestBoxes(query: HarvestBoxListQuery): Promise<HarvestBoxRecord[]> {
  const { userUuid, includeClaimed = false, take = 20 } = query;
  const pageSize = Math.max(1, Math.min(take, 100));

  const where: Prisma.HarvestBoxWhereInput = {
    userUuid,
    ...(includeClaimed ? {} : { claimed: false }),
  };

  const boxes = await prisma.harvestBox.findMany({
    where,
    orderBy: { id: "desc" },
    take: pageSize,
    include: { items: true },
  });

  return boxes.map((b) => ({
    id: b.id,
    uuid: b.uuid,
    title: b.title,
    source: (b as any).source ?? null,
    sourceId: b.sourceId,
    createdAt: b.createdAt,
    expiresAt: b.expiresAt,
    claimed: b.claimed,
    items: b.items.map((i) => ({
      id: i.id,
      resourceId: i.resourceId,
      amount: i.amount,
      meta: i.meta,
      claimed: i.claimed,
      claimedAt: i.claimedAt ?? undefined,
    })),
  }));
}

// 领取一个箱子（整体领取）：把所有未领取条目入包，并标记 claimed
import { increaseItemCount, invalidateInventoryCache } from "./characterInventory";
import { ModifyItemCountType } from "~/shared/types/gameInventory";

export async function claimHarvestBox(boxId: number, userUuid: string) {
  return await withUniqueLock(`harvestBox:claim:${boxId}`, () => prisma.$transaction(async (tx) => {
    const box = await tx.harvestBox.findUnique({ where: { id: boxId }, include: { items: true } });
    if (!box || box.userUuid !== userUuid) throw new Error("HarvestBox not found");

    if (box.claimed) return { ok: true, alreadyClaimed: true };

    // 聚合未领取条目
    const toClaim = box.items.filter((i) => !i.claimed);
    if (!toClaim.length) {
      await tx.harvestBox.update({ where: { id: box.id }, data: { claimed: true, claimedAt: new Date() } });
      return { ok: true };
    }

    // 聚合为 ItemCountInfo
    const countInfo: ItemCountInfo = {};
    for (const it of toClaim) {
      const rid = it.resourceId as any;
      const prev = countInfo[rid]?.count ?? 0;
      countInfo[rid] = { count: prev + Number(it.amount) } as any;
    }

    // 增加到背包
    await increaseItemCount(
      userUuid,
      countInfo,
      {
        actionName: "从收获箱中领取物品",
        type: ModifyItemCountType.Other,
        sendModifyEvent: true,
        showModifyInfo: true,
      },
      tx,
    );
    await invalidateInventoryCache(userUuid);

    // 先标记子表，再标记父表（保持锁序一致）
    const now = new Date();
    const toClaimIds = toClaim.map((i) => i.id);
    await tx.harvestBoxItem.updateMany({ where: { id: { in: toClaimIds }, claimed: false }, data: { claimed: true, claimedAt: now } });
    await tx.harvestBox.update({ where: { id: box.id }, data: { claimed: true, claimedAt: now } });

    return { ok: true };
  }));
}

// 领取单条明细（按条领取）
export async function claimHarvestBoxItem(itemId: number, userUuid: string) {
  return await withUniqueLock(`harvestBox:item:${itemId}`, () => prisma.$transaction(async (tx) => {
    const item = await tx.harvestBoxItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("HarvestBoxItem not found");

    const box = await tx.harvestBox.findUnique({ where: { id: item.harvestBoxId } });
    if (!box || box.userUuid !== userUuid) throw new Error("HarvestBox not found");

    if (item.claimed) return { ok: true, alreadyClaimed: true };

    const countInfo: ItemCountInfo = { [item.resourceId]: { count: Number(item.amount) } } as any;
    await increaseItemCount(
      userUuid,
      countInfo,
      {
        actionName: "从收获箱中领取部分物品",
        type: ModifyItemCountType.Other,
        sendModifyEvent: true,
        showModifyInfo: true,
      },
      tx,
    );
    await invalidateInventoryCache(userUuid);

    const now = new Date();
    await tx.harvestBoxItem.update({ where: { id: itemId }, data: { claimed: true, claimedAt: now } });

    // 如果该箱子所有条目均已领取，则把箱子标记为 claimed
    const remain = await tx.harvestBoxItem.count({ where: { harvestBoxId: item.harvestBoxId, claimed: false } });
    if (!remain) {
      await tx.harvestBox.update({ where: { id: item.harvestBoxId }, data: { claimed: true, claimedAt: now } });
    }

    return { ok: true };
  }));
}

// 工具级别方法：与 increaseItemCount 同层级的“入收获箱”
// 约定：不直接发放，只记录到箱子，交由客户端/玩家主动领取
export async function enqueueToHarvestBox(
  userUuid: string,
  items: ItemCountInfo,
  opt?: { title?: string; source?: HarvestBoxSource; sourceId?: string; extra?: any; expiresAt?: Date | null },
  tx?: PrismaTx
) {
  const input: HarvestBoxCreateInput = {
    userUuid,
    items,
    title: opt?.title,
    source: opt?.source,
    sourceId: opt?.sourceId,
    extra: opt?.extra,
    expiresAt: opt?.expiresAt ?? null,
  };

  // 针对自动收获 (source=Auto)：
  // 多个田地同时成熟会并发调用，原先仅靠 "findFirst + create" 可能竞态产生多个同标题箱子。
  // 这里加一层用户 + 标题的互斥锁，确保串行创建/合并，提升“同类作物合并”稳定性。
  const doCreate = () => createHarvestBox(input, tx);
  const res =
    input.source === 'Auto'
      ? await withUniqueLock(`harvestBox:auto:${userUuid}:${input.title || 'auto'}`, doCreate)
      : await doCreate();

  dispatchHarvestBoxListToUser(userUuid);
  return res;
}


export async function dispatchHarvestBoxListToUser(userUuid: string) {
  const list = await listHarvestBoxes({ userUuid, includeClaimed: false });
  emitEventToUser(userUuid, "harvestBox:list:success", { list: toDTO(list) });
}