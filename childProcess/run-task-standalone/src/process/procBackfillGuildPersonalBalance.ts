/*
  Backfill script: Aggregate GuildInventoryDonate.info into GuildInventoryPersonalBalance
  - Reads donations in batches
  - Parses JSON info: Record<itemId, {count: number}>
  - Upserts per (guildUuid, donorUuid, itemId) balance with increment
  - Safe and idempotent: can run multiple times
*/

import { prisma } from "../utils/prisma";
import fs from "fs";
import path from "path";

// const prisma = new PrismaClient();

function safeParseInfo(info: string | null | undefined): Record<string, { count?: number }> {
  if (!info) return {};
  try {
    const obj = JSON.parse(info);
    if (obj && typeof obj === "object") return obj as Record<string, { count?: number }>;
    return {};
  } catch {
    return {};
  }
}

function loadAllGameResource(): Record<string, any> {
  try {
    const p = path.resolve(__dirname, "../../../../assets/resource/allGameResource.json");
    const data = fs.readFileSync(p, "utf-8");
    const obj = JSON.parse(data);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

async function backfillBatch(skip: number, take: number): Promise<number> {
  const donations = await prisma.guildInventoryDonate.findMany({
    skip,
    take,
    orderBy: { createdAt: "asc" },
    select: {
      guildUuid: true,
      donorUuid: true,
      info: true,
    },
  });

  if (donations.length === 0) return 0;

  // Group increments by (guildUuid, donorUuid, itemId)
  type Key = string; // `${guildUuid}|${donorUuid}|${itemId}`
  const increments = new Map<Key, bigint>();

  const resourceDict = loadAllGameResource();
  for (const d of donations) {
    const parsed = safeParseInfo(d.info);
    for (const itemId of Object.keys(parsed)) {
      // Ensure resource exists
      if (!resourceDict[itemId]) continue;
      const raw = parsed[itemId]?.count;
      // Validate: must be a finite integer within safe bounds and > 0
      if (typeof raw !== "number") continue;
      if (!Number.isFinite(raw)) continue;
      const cntInt = Math.floor(raw);
      if (cntInt <= 0) continue;
      // Upper bound guard to avoid absurd values; align with server validations if needed
      if (cntInt > 1_000_000_000) continue;
      const key = `${d.guildUuid}|${d.donorUuid}|${itemId}`;
      const prev = increments.get(key) ?? 0n;
      increments.set(key, prev + BigInt(cntInt));
    }
  }

  // Apply upserts inside a transaction for the batch
  if (increments.size > 0) {
    await prisma.$transaction(
      Array.from(increments.entries()).map(([key, inc]) => {
        const [guildUuid, userUuid, itemId] = key.split("|");
        return prisma.guildInventoryPersonalBalance.upsert({
          where: { guild_personal_balance_unique: { guildUuid, userUuid, itemId } },
          update: { count: { increment: inc } },
          create: { guildUuid, userUuid, itemId, count: inc },
        });
      })
    );
  }

  return donations.length;
}

async function main() {
  const take = 500; // fixed batch size for one-time backfill
  let skip = 0;
  let processed = 0;

  // Safety guard: prevent accidental re-run. Abort if table already has rows.
  const existing = await prisma.guildInventoryPersonalBalance.count();
  if (existing > 0) {
    console.error("[Backfill] Abort: GuildInventoryPersonalBalance already contains rows (", existing, ")");
    await prisma.$disconnect();
    process.exit(10);
  }

  console.log(`[Backfill] Start: batch=${take}`);

  while (true) {
    const n = await backfillBatch(skip, take);
    if (n === 0) break;
    processed += n;
    skip += take;
    console.log(`[Backfill] processed=${processed}`);
  }

  // Post-run validation: Σ personal balances per (guild,item) must be <= GuildInventory.count
  console.log(`[Backfill] Validating aggregates...`);
  const balances = await prisma.guildInventoryPersonalBalance.findMany({
    select: { guildUuid: true, itemId: true, count: true },
  });
  const sumByGuildItem = new Map<string, bigint>();
  for (const b of balances) {
    if (b.count < 0) {
      console.error(`[Validate] Negative balance detected:`, b);
      process.exit(2);
    }
    const key = `${b.guildUuid}|${b.itemId}`;
    const prev = sumByGuildItem.get(key) ?? 0n;
    sumByGuildItem.set(key, prev + BigInt(b.count));
  }

  const inventoryItems = await prisma.guildInventory.findMany({
    select: { guildUuid: true, itemId: true, count: true },
  });
  const inventoryMap = new Map<string, bigint>();
  for (const it of inventoryItems) {
    const key = `${it.guildUuid}|${it.itemId}`;
    inventoryMap.set(key, BigInt(it.count));
  }

  let violation = 0;
  for (const [key, sum] of sumByGuildItem.entries()) {
    const inv = inventoryMap.get(key) ?? 0n;
    if (sum > inv) {
      console.error(`[Validate] PersonalBalance sum exceeds GuildInventory: key=${key} sum=${sum} inv=${inv}`);
      violation++;
    }
  }

  if (violation > 0) {
    console.error(`[Validate] Found ${violation} violation(s). Please inspect before proceeding.`);
    await prisma.$disconnect();
    process.exit(3);
  }

  const finalRows = await prisma.guildInventoryPersonalBalance.count();
  console.log(`[Backfill] Validation passed. total processed donations=${processed}, new personal balance rows=${finalRows}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[Backfill] Error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
