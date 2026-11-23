// One-off migration: convert CharacterAffix.effect JSON from array to single object
// Usage: MYSQL_PATH=mysql://user:pass@host:port/db npm run migrate:affix-effect

import { PrismaClient } from '../generated/prisma/index.js';

const DB_URL = process.env.MYSQL_PATH;
if (!DB_URL) {
  console.error('[migrate-affix-effect] Missing MYSQL_PATH environment variable.');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

function normalizeEffect(val) {
  try {
    const v = typeof val === 'string' ? JSON.parse(val) : val;
    if (Array.isArray(v)) return v[0] ?? {};
    if (v && typeof v === 'object') return v;
    return {};
  } catch (e) {
    return {};
  }
}

async function run() {
  console.log('[migrate-affix-effect] Start');
  let updated = 0;
  let processed = 0;
  const batch = 500;
  let cursor = undefined;

  while (true) {
    const rows = await prisma.characterAffix.findMany({
      take: batch,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });
    if (!rows.length) break;

    for (const row of rows) {
      processed++;
      const eff = normalizeEffect(row.effect);
      const isArray = Array.isArray(JSON.parse(row.effect || 'null') || undefined);
      // Only update rows that are arrays or where normalized differs from original string
      const effStr = JSON.stringify(eff);
      if (isArray || row.effect !== effStr) {
        await prisma.characterAffix.update({
          where: { id: row.id },
          data: { effect: effStr },
        });
        updated++;
      }
      cursor = row.id;
    }
    console.log(`[migrate-affix-effect] processed=${processed}, updated=${updated}`);
  }

  console.log(`[migrate-affix-effect] Done. processed=${processed}, updated=${updated}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
