import { prisma } from "../utils/prisma";

const BATCH_SIZE = Number(process.env.CODEX_INIT_BATCH ?? 2000);

async function main() {
  let cursorId = 0;
  let processed = 0;
  let inserted = 0;
  let batches = 0;

  console.log(`[codex-init] start, batchSize=${BATCH_SIZE}`);

  while (true) {
    const rows = await prisma.characterNewInventory.findMany({
      select: { id: true, user_uuid: true, item_id: true, created_at: true },
      where: { id: { gt: cursorId } },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });

    if (!rows.length) break;

    cursorId = rows[rows.length - 1]!.id;
    batches += 1;
    processed += rows.length;

    const dedup = new Map<string, { userUuid: string; itemId: string; firstAcquiredAt: Date }>();
    for (const r of rows) {
      const key = `${r.user_uuid}::${r.item_id}`;
      const ts = r.created_at ?? new Date();
      const prev = dedup.get(key);
      if (!prev || ts < prev.firstAcquiredAt) {
        dedup.set(key, { userUuid: r.user_uuid, itemId: r.item_id, firstAcquiredAt: ts });
      }
    }

    if (dedup.size === 0) continue;

    const data = Array.from(dedup.values()).map((d) => ({
      userUuid: d.userUuid,
      itemId: d.itemId,
      firstAcquiredAt: d.firstAcquiredAt,
    }));

    const result = await prisma.playerCodexItemCollect.createMany({
      data,
      skipDuplicates: true,
    });

    inserted += result.count ?? 0;

    console.log(
      `[codex-init] batch ${batches} done: scanned=${processed}, inserted+=${result.count ?? 0}, totalInserted=${inserted}`
    );
  }

  console.log(`[codex-init] finished: batches=${batches}, scanned=${processed}, inserted=${inserted}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[codex-init] failed", err);
  await prisma.$disconnect();
  process.exit(1);
});
