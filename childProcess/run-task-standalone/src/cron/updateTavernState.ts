import { GameBroadcastKind, type UserTalentCatUpdateMessage } from "~/shared/types/broadcast";
import { updateTalentCatCache } from "../utils/game/tarven";
import { publishGameBroadcast } from "../utils/game/broadcastHub"
import { prisma } from "../utils/prisma";

const INTERVAL = 1 * 60 * 1000; // 1分钟，单位毫秒

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function updateTavernState() {
  const now = new Date();
  try {
    // 查找所有已过期且仍为 WORKING 状态的专家
    const expired = await prisma.tavern.findMany({
      where: {
        end_date: { lte: now },
        state: "WORKING",
      },
      select: { uuid: true, owner: true },
    });

    if (expired.length > 0) {
      // 批量更新状态为 EXPIRED
      await prisma.tavern.updateMany({
        where: {
          uuid: { in: expired.map(e => e.uuid) },
        },
        data: {
          state: "EXPIRED",
        },
      });

      for(const {owner} of expired) {
        await updateTalentCatCache(owner)

        await publishGameBroadcast<UserTalentCatUpdateMessage>({
          kind: GameBroadcastKind.USER_TALENT_CAT_UPDATED,
          userUuid: owner
        })
      }

      console.log(`[Tavern] 已更新 ${expired.length} 个过期专家状态为 EXPIRED`);
    } else {
      console.log(`[Tavern] 没有需要更新的过期专家`);
    }
  } catch (error) {
    console.error('[Tavern] 更新专家状态失败:', error);
  }
}

async function mainLoop() {
  console.log('[Tavern] 酒馆专家状态定时检查服务启动，每1分钟检查一次...');
  while (running) {
    await updateTavernState();
    for (let i = 0; i < INTERVAL / 1000 && running; i++) {
      await new Promise(res => setTimeout(res, 1000));
    }
  }
  console.log('[Tavern] 服务已停止');
}

await mainLoop();
process.exit(0);