import { prisma } from "../utils/prisma"
import { enqueueToHarvestBox } from "../utils/game/harvestBox"

const START = new Date("2026-02-06 08:00:00");
const END = new Date("2026-02-07 01:00:00");

async function main() {
  try {
    const boxes = await prisma.harvestBox.findMany({
      where: {
        claimed: true,
        claimedAt: {
          gt: START,
          lt: END,
        },
        source: "GM",
        title: {
          contains: "饱食度",
        },
      },
      select: {
        userUuid: true,
      },
    });

    const uniqueUserUuids = Array.from(new Set(boxes.map((item) => item.userUuid)));

    for (const userUuid of uniqueUserUuids) {
        await enqueueToHarvestBox(userUuid, {
            cutePoint: {
                count: 80
            }
        }, {
            title: "猫咪饱食度异常补偿回滚物品补发",
            source: "GM",
        });
    }

    console.log(
      `[findClaimedHarvestBoxGM] harvestBoxes=${boxes.length} uniqueUsers=${uniqueUserUuids.length}`,
    );
  } catch (error) {
    console.error("[findClaimedHarvestBoxGM] failed", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

void main();
