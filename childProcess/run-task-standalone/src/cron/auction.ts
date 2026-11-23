import { settleAuction } from "../utils/game/auction";
import { prisma } from "../utils/prisma";

const INTERVAL = 1 * 60 * 1000; // 1分钟，单位毫秒

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function run() {
  const now = new Date();
  try {
    // 查找所有已过期且仍为 WORKING 状态的专家
    const expired = await prisma.auction.findMany({
      where: {
        state: "OPEN",
        end_at: {
            lt: now
        }
      },
      select: { uuid: true },
    });

    if (expired.length > 0) {
      for(const {uuid} of expired) {
        await settleAuction(uuid)
      }

      console.log(`[Auction] 已更新 ${expired.length} 个到期的拍卖交易`);
    } else {
      console.log(`[Auction] 没有需要更新的拍卖交易`);
    }
  } catch (error) {
    console.error('[Auction] 更新状态失败:', error);
  }
}

async function mainLoop() {
  console.log('[Auction] 拍卖行服务运行中...');
  while (running) {
    await run();
    await new Promise(res => setTimeout(res, INTERVAL));
  }
  console.log('[Auction] 服务已停止');
}

await mainLoop();
process.exit(0);