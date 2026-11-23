import { prisma } from "./db";
import type { PrismaTx } from "~/shared/types/socket/db";
import type {
  PlayerItemCollectCodex,
  PlayerUnitKillCodex,
  RecordUnitKillInput,
  RecordUnitKillResult,
  TouchItemCollectInput,
  TouchItemCollectResult,
} from "~/shared/types/codex";

const toUnitKillCodex = (row: any): PlayerUnitKillCodex => ({
  userUuid: row.userUuid,
  unitId: row.unitId,
  killCount: Number(row.killCount ?? 0),
  firstKillAt: row.firstKillAt ?? null,
  lastKillAt: row.lastKillAt ?? null,
});

const toItemCollectCodex = (row: any): PlayerItemCollectCodex => ({
  userUuid: row.userUuid,
  itemId: row.itemId,
  firstAcquiredAt: row.firstAcquiredAt ?? null,
});

export async function recordUnitKill(
  input: RecordUnitKillInput,
  tx?: PrismaTx,
): Promise<RecordUnitKillResult> {
  const client = tx ?? prisma;
  const { userUuid, unitId } = input;
  const delta = input.delta ?? 1;
  const occurredAt = input.occurredAt ?? new Date();

  const row = await client.playerCodexUnitKill.upsert({
    where: {
      player_unit_unique: {
        userUuid,
        unitId,
      },
    },
    update: {
      killCount: { increment: BigInt(delta) },
      lastKillAt: occurredAt,
    },
    create: {
      userUuid,
      unitId,
      killCount: BigInt(Math.max(delta, 1)),
      firstKillAt: occurredAt,
      lastKillAt: occurredAt,
    },
  });

  const isFirstKill = Number(row.killCount ?? 0) === Math.max(delta, 1);

  return {
    record: toUnitKillCodex(row),
    isFirstKill,
  };
}

export async function touchItemCollect(
  input: TouchItemCollectInput,
  tx?: PrismaTx,
): Promise<TouchItemCollectResult> {
  const client = tx ?? prisma;
  const { userUuid, itemId } = input;
  const acquiredAt = input.acquiredAt ?? new Date();

  const existing = await client.playerCodexItemCollect.findUnique({
    where: {
      player_item_unique: {
        userUuid,
        itemId,
      },
    },
  });

  if (!existing) {
    const created = await client.playerCodexItemCollect.create({
      data: {
        userUuid,
        itemId,
        firstAcquiredAt: acquiredAt,
      },
    });

    return {
      record: toItemCollectCodex(created),
      isFirstAcquire: true,
    };
  }

  if (!existing.firstAcquiredAt) {
    const updated = await client.playerCodexItemCollect.update({
      where: { id: existing.id },
      data: { firstAcquiredAt: acquiredAt },
    });

    return {
      record: toItemCollectCodex(updated),
      isFirstAcquire: true,
    };
  }

  return {
    record: toItemCollectCodex(existing),
    isFirstAcquire: false,
  };
}

/**
 * 批量记录物品获得（去重后 createMany skipDuplicates），返回实际尝试插入的条数。
 */
export async function recordItemCollectBatch(
  userUuid: string,
  itemIds: string[],
  tx?: PrismaTx,
  acquiredAt: Date = new Date(),
): Promise<number> {
  const client = tx ?? prisma;
  const uniqueIds = Array.from(new Set(itemIds));
  if (!uniqueIds.length) return 0;

  const result = await client.playerCodexItemCollect.createMany({
    data: uniqueIds.map((itemId) => ({
      userUuid,
      itemId,
      firstAcquiredAt: acquiredAt,
    })),
    skipDuplicates: true,
  });

  return result.count ?? 0;
}
