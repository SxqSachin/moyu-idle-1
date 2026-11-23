import { VillageBuildingStatus } from "~/shared/types/village/building";
import { prisma } from "../utils/prisma";
import { redisClient } from "../utils/redis"

const VILLAGE_NORMAL_BUILDINGS_CACHE_KEY = "VILLAGE_NORMAL_BUILDINGS_LIST";
const INTERVAL = 1 * 60 * 1000; // 10分钟，单位毫秒

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function updateVillageBuildingState() {
  const now = new Date();
  try {
    // 查找所有已过期且仍为 WORKING 状态的专家
    const processingBuildings = await prisma.villageBuilding.findMany({
      where: {
        status: {
          in: [VillageBuildingStatus.BUILDING, VillageBuildingStatus.UPGRADING]
        }
      },
    });

    let waitingPromise: Promise<any>[] = [];
    for(const building of processingBuildings) {
      switch(building.status) {
        case VillageBuildingStatus.BUILDING:
          if (building.endBuildAt && building.endBuildAt <= now) {
            // 如果建筑已完成建造，更新状态
            waitingPromise.push(
              prisma.villageBuilding.update({
                where: { uuid: building.uuid },
                data: {
                  status: VillageBuildingStatus.NORMAL,
                  endBuildAt: null, // 清除结束时间
                  level: {
                    increment: 1
                  },
                }
              })
            );
          }
          break;

        case VillageBuildingStatus.UPGRADING:
          if (building.endUpgradeAt && building.endUpgradeAt <= now) {
            // 如果建筑已完成升级，更新状态
            waitingPromise.push(
              prisma.villageBuilding.update({
                where: { uuid: building.uuid },
                data: {
                  status: VillageBuildingStatus.NORMAL,
                  level: {
                    increment: 1
                  },
                  endUpgradeAt: null // 清除升级结束时间
                }
              })
            );
          }
          break;
      }
    }

    await Promise.all(waitingPromise);
    console.log(`[VillageBuilding] 更新建筑状态完成，共处理 ${waitingPromise.length} 个建筑，当前时间: ${now.toISOString()}`);

    console.log(waitingPromise.length)
    if (waitingPromise.length > 0) {
      let res = await redisClient.del(VILLAGE_NORMAL_BUILDINGS_CACHE_KEY)

      console.log(`[VillageBuilding] 清除建筑缓存成功，影响 ${res} 个键`);
    }

  } catch (error) {
    console.error('[VillageBuilding] 更新建筑状态失败:', error);
  }
}

async function mainLoop() {
  console.log('[VillageBuilding] 建筑状态定时检查服务启动，每1分钟检查一次...');
  while (running) {
    await updateVillageBuildingState();
    for (let i = 0; i < INTERVAL / 1000 && running; i++) {
      await new Promise(res => setTimeout(res, 1000));
    }
  }
  console.log('[VillageBuilding] 服务已停止');
}

await mainLoop();
process.exit(0);