import { prisma } from '../utils/prisma';

async function migrateAllInventory() {
  return;
  const allOldInventories = await prisma.characterInventory.findMany();

  let migratedCount = 0;
  for (const oldInv of allOldInventories) {
    const { user_uuid, character_uuid, inventory } = oldInv;
    if (!inventory) continue;

    let parsed: Record<string, { count: number, [key: string]: any }>;
    try {
      parsed = JSON.parse(inventory);
    } catch (e) {
      console.error(`Failed to parse inventory for character_uuid=${character_uuid}:`, e);
      continue;
    }

    for (const [item_id, itemInfo] of Object.entries(parsed)) {
      const count = typeof itemInfo === 'object' && typeof itemInfo.count === 'number' ? itemInfo.count : 0;
      if (count <= 0) continue;
      
      // 确保是整数，如果不是的话转换成整数
        const itemCount = Math.floor(count);

      // 可扩展 position/extra 字段
      await prisma.characterNewInventory.upsert({
        where: {
          character_uuid_item_id: {
            character_uuid,
            item_id,
          },
        },
        update: {
          count: itemCount,
          updated_at: new Date(),
        },
        create: {
          user_uuid,
          character_uuid,
          item_id,
          count: itemCount,
          // position: itemInfo.position ?? undefined,
          // extra: itemInfo.extra ? JSON.stringify(itemInfo.extra) : undefined,
        },
      });
    }
    migratedCount++;
    if (migratedCount % 100 === 0) {
      console.log(`Migrated ${migratedCount} inventories...`);
    }
  }
  console.log(`Migration complete. Total inventories migrated: ${migratedCount}`);
  await prisma.$disconnect();
}

console.log("Starting inventory migration...");
await migrateAllInventory()
// .then(() => {
//     console.log("Migration finished successfully.");
//     process.exit(0);
// }).catch(e => {
//     console.error("Error during migration:");
//   console.error(e);
//   process.exit(1);
// });