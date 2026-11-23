import { prisma } from "./db";
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

export function toDTO(list: Awaited<ReturnType<typeof listHarvestBoxes>>): HarvestBoxListItemDTO[] {
  return list.items.map((b) => ({
    id: b.id,
    uuid: b.uuid,
    title: b.title ?? null,
    source: (b.source ?? null) as any,
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
      // 更新过期时间（取更晚）
      if (expiresAt && (!existing.expiresAt || expiresAt > existing.expiresAt)) {
        await trx.harvestBox.update({ where: { id: existing.id }, data: { expiresAt } });
      }
      // 覆盖 extra（按当前需求）
      if (extra) {
        await trx.harvestBox.update({ where: { id: existing.id }, data: { extra: JSON.stringify(extra) } });
      }
      // 累加或创建条目
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
export async function listHarvestBoxes(query: HarvestBoxListQuery): Promise<{ items: HarvestBoxRecord[]; hasMore: boolean; nextCursor: number | null }> {
  const { userUuid, includeClaimed = false, take = 20, beforeId } = query;
  const pageSize = Math.max(1, Math.min(take, 100));

  const where: Prisma.HarvestBoxWhereInput = {
    userUuid,
    ...(includeClaimed ? {} : { claimed: false }),
    ...(beforeId ? { id: { lt: beforeId } } : {}),
  };

  // 获取 pageSize + 1 来判断是否还有更多
  const rows = await prisma.harvestBox.findMany({
    where,
    orderBy: { id: "desc" },
    take: pageSize + 1,
    include: { items: true },
  });

  const hasMore = rows.length > pageSize;
  const slice = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.id : null;

  const items = slice.map((b) => ({
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

  return { items, hasMore, nextCursor };
}

// 领取一个箱子（整体领取）：把所有未领取条目入包，并标记 claimed
import { increaseItemCount } from "./characterInventory";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { emitEventToUser } from "~/server/io";

export async function claimHarvestBox(boxId: number, userUuid: string) {
  return await prisma.$transaction(async (tx) => {
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

    // 标记为已领取
    await tx.harvestBox.update({ where: { id: box.id }, data: { claimed: true, claimedAt: new Date() } });
    await tx.harvestBoxItem.updateMany({ where: { harvestBoxId: box.id, claimed: false }, data: { claimed: true, claimedAt: new Date() } });

    return { ok: true };
  });
}

// 批量领取当前用户所有未领取的收获箱条目
export async function claimAllHarvestBoxes(userUuid: string) {
  return await prisma.$transaction(async (tx) => {
    const boxes = await tx.harvestBox.findMany({ where: { userUuid, claimed: false }, include: { items: true } })
    if (!boxes.length) return { ok: true, alreadyClaimed: true, claimedItems: [] }

    const toClaimItems = [] as Array<{ resourceId: string; amount: number }>
    const countInfo: ItemCountInfo = {}
    for (const box of boxes) {
      for (const it of box.items) {
        if (it.claimed) continue
        const rid = it.resourceId as any
        const amt = Number(it.amount)
        toClaimItems.push({ resourceId: it.resourceId, amount: amt })
        const prev = countInfo[rid]?.count ?? 0
        countInfo[rid] = { count: prev + amt } as any
      }
    }

    if (!toClaimItems.length) return { ok: true, alreadyClaimed: true, claimedItems: [] }

    await increaseItemCount(
      userUuid,
      countInfo,
      {
        actionName: "领取收获箱中的所有物品",
        type: ModifyItemCountType.Other,
        sendModifyEvent: true,
        showModifyInfo: true,
      },
      tx,
    );
    await invalidateInventoryCache(userUuid);

    // 标记所有涉及的条目与箱子为已领取
    const boxIds = boxes.map(b => b.id)
    await tx.harvestBoxItem.updateMany({ where: { harvestBoxId: { in: boxIds }, claimed: false }, data: { claimed: true, claimedAt: new Date() } })
    await tx.harvestBox.updateMany({ where: { id: { in: boxIds } }, data: { claimed: true, claimedAt: new Date() } })

    return { ok: true, alreadyClaimed: false, claimedItems: toClaimItems }
  })
}

// 领取单条明细（按条领取）
export async function claimHarvestBoxItem(itemId: number, userUuid: string) {
  return await prisma.$transaction(async (tx) => {
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

    await tx.harvestBoxItem.update({ where: { id: itemId }, data: { claimed: true, claimedAt: new Date() } });

    // 如果该箱子所有条目均已领取，则把箱子标记为 claimed
    const remain = await tx.harvestBoxItem.count({ where: { harvestBoxId: item.harvestBoxId, claimed: false } });
    if (!remain) {
      await tx.harvestBox.update({ where: { id: item.harvestBoxId }, data: { claimed: true, claimedAt: new Date() } });
    }

    return { ok: true };
  });
}

// 工具级别方法：与 increaseItemCount 同层级的“入收获箱”
// 约定：不直接发放，只记录到箱子，交由客户端/玩家主动领取
export async function enqueueToHarvestBox(userUuid: string, items: ItemCountInfo, opt?: { title?: string; source?: HarvestBoxSource; sourceId?: string; extra?: any; expiresAt?: Date | null }, tx?: PrismaTx) {
  const input: HarvestBoxCreateInput = { userUuid, items, title: opt?.title, source: opt?.source, sourceId: opt?.sourceId, extra: opt?.extra, expiresAt: opt?.expiresAt ?? null };
  const res = await createHarvestBox(input, tx);

  dispatchHarvestBoxListToUser(userUuid);

  return res;
}


export async function dispatchHarvestBoxListToUser(userUuid: string) {
  const list = await listHarvestBoxes({ userUuid, includeClaimed: false, take: 5 });
  emitEventToUser(userUuid, "harvestBox:list:success", { list: toDTO(list), hasMore: list.hasMore, nextCursor: list.nextCursor });
}