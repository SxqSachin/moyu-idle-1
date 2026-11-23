import { prisma } from "../utils/prisma";
import { allVillageBuilding } from "~/shared/data/allVillageBuilding";
import { VillageBuildingStatus } from "~/shared/types/village/building";
import { repairFurniture } from "../utils/game/kittyFurniture";

const INTERVAL = 10 * 60 * 1000; // 1分钟，单位毫秒

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });


async function repairAllFurniture() {
  let allRepairableFurniture = await prisma.userKittyFurniture.findMany({
    where: {
      OR: [
        {
          durability: { lte: 4 },
          is_active: true,
        },
        {
          durability: 0,
          is_active: false,
        },
      ]
    },
  })

  for(const repairAllFurniture of allRepairableFurniture) {
    try {
      await repairFurniture(repairAllFurniture.user_uuid, repairAllFurniture.furniture_id, '猫猫家政服务中心上门服务-修理家具');
    } catch (error: any) {
      // console.log(`猫咪家政服务中心: 修理家具失败: ${repairAllFurniture.user_uuid}, ${repairAllFurniture.furniture_id}`, error.message);
    }
  }

  console.log(`猫咪家政服务中心: 共检查了 ${allRepairableFurniture.length} 件家具`);
}


async function runTask() {
  try {
    let kittyHomeServiceCenterBuilding = await prisma.villageBuilding.findUnique({
      where: { 
        type: allVillageBuilding.kittyHomeServiceCenter.id,
        status: {
          in: [
            VillageBuildingStatus.NORMAL,
            VillageBuildingStatus.PREPARE_UPGRADE,
            VillageBuildingStatus.UPGRADING,
          ]
        }
      },
    });

    if (!kittyHomeServiceCenterBuilding) {
      console.log("猫咪家政服务中心建筑不存在");
      return;
    }

    let level = kittyHomeServiceCenterBuilding.level;

    // 猫舍家具维修
    if (level >= 0) {
      await repairAllFurniture()
    }
  } catch (e: any) {
  }
}

async function mainLoop() {
  console.log('猫咪家政服务中心...');
  console.log(`更新间隔: ${INTERVAL / 1000 / 60} 分钟`);
  
  while (running) {
    if (!running) break;
    
    await runTask();
    
    // 执行完成后等待30分钟间隔，防止死循环
    await new Promise(resolve => setTimeout(resolve, INTERVAL));
  }
}

await mainLoop();
process.exit(0);