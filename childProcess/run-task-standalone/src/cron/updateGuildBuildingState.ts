import { GuildBuildingStatus } from "~/shared/types/guild";
import { prisma } from "../utils/prisma";

const INTERVAL = 0.5 * 60 * 1000; // 30s

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function updateGuildBuildingState() {
  const now = new Date();
  try {
    // 查找所有已过期且仍为 WORKING 状态的专家
    const processingBuildings = await prisma.guildBuilding.findMany({
      where: {
        status: {
          in: [GuildBuildingStatus.BUILDING, GuildBuildingStatus.UPGRADING]
        }
      },
    });

    let i = 0;
    for(const building of processingBuildings) {
      switch(building.status) {
        case GuildBuildingStatus.BUILDING:
          if (building.endBuildAt && building.endBuildAt <= now) {
            // 如果建筑已完成建造，更新状态
            await prisma.guildBuilding.update({
              where: { uuid: building.uuid },
              data: {
                status: GuildBuildingStatus.NORMAL,
                endBuildAt: null, // 清除结束时间
                level: {
                  increment: 1
                },
              }
            })
            i++;
          }
          break;

        case GuildBuildingStatus.UPGRADING:
          if (building.endUpgradeAt && building.endUpgradeAt <= now) {
            // 如果建筑已完成升级，更新状态
            await prisma.guildBuilding.update({
              where: { uuid: building.uuid },
              data: {
                status: GuildBuildingStatus.NORMAL,
                level: {
                  increment: 1
                },
                endUpgradeAt: null // 清除升级结束时间
              }
            })
            i++;
          }
          break;
      }
    }

    console.log(`[GuildBuilding] 更新建筑状态完成，共处理 ${i} 个建筑，当前时间: ${now.toISOString()}`);

  } catch (error) {
    console.error('[GuildBuilding] 更新建筑状态失败:', error);
  }
}

async function mainLoop() {
  console.log('[GuildBuilding] 建筑状态定时检查服务启动，每1分钟检查一次...');
  while (running) {
    await updateGuildBuildingState();
    for (let i = 0; i < INTERVAL / 1000 && running; i++) {
      await new Promise(res => setTimeout(res, 1000));
    }
  }
  console.log('[GuildBuilding] 服务已停止');
}

await mainLoop();
process.exit(0);