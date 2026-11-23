import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { getAllKittyByOwner } from "../utils/game/kitty";
import { addKittyEssay } from "../utils/game/kittyEssay";
import { increaseItemCount } from "../utils/game/characterInventory";
import { gmListToMarket } from "../utils/game/market";
import { redisClient } from "../utils/redis";
import {
  delay,
  randomIntegerInFullCloseRange,
  safeJsonParse,
} from "~/shared/utils";
import { type GMRestockMarketInput } from "~/shared/types/gm";

const EXECUTION_HOURS = [6, 9, 12, 15, 18, 21];
let lastExecutedHour: number | null = null;

let running = true;
process.on("SIGINT", () => {
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});

const gmUuid = "2509432e-caea-4abd-9220-e66ff6ef6a08";

async function run() {
  const savedRestockMarketInfoStr = await redisClient.get("gm:marketRestock");

  const info = safeJsonParse<GMRestockMarketInput[]>(savedRestockMarketInfoStr);

  if (!info || !savedRestockMarketInfoStr) {
    console.log("[GmRestockMarket] 无法获取补货市场信息");
    return;
  }

  for (const restockInfo of info) {
    const { resourceId, count, cost } = restockInfo;

    // 处理每个补货请求
    // 例如：增加物品数量、更新数据库等

    const actCount = randomIntegerInFullCloseRange(count);
    const actCost = randomIntegerInFullCloseRange(cost);

    try {
      let randomDelay = randomIntegerInFullCloseRange(5000, 12000);
      await delay(randomDelay);

      await gmListToMarket(
        {
          sellResourceId: resourceId,
          sellResourceCount: actCount,

          costResourceId: "gold",
          costPerUnit: actCost,
        },
        gmUuid
      );

      console.log(`[GmRestockMarket] 上架成功 - ${resourceId} x ${actCount} - ${actCost}`);
    } catch (err) {
      console.error(err);
    }
  }
}

async function mainLoop() {
  console.log("[GmRestockMarket] 服务已启动");

    console.log(
      `[GmRestockMarket] 启动执行 开始执行`
    );
    await run()
    console.log(
      `[GmRestockMarket] 启动执行 完成`
    );

  while (running) {
    const now = new Date();
    const currentHour = now.getHours();

    if (
      EXECUTION_HOURS.includes(currentHour) &&
      lastExecutedHour !== currentHour
    ) {
      console.log(
        `[GmRestockMarket] 到达执行时间点 ${currentHour}:00，开始执行 - ${now.toLocaleString()}`
      );
      await run();
      console.log(
        `[GmRestockMarket] ${currentHour}:00，执行完毕 - ${now.toLocaleString()}`
      );
      lastExecutedHour = currentHour;
    }

    // 重置执行记录（跨天时）
    if (currentHour === 0 && lastExecutedHour !== 0) {
      lastExecutedHour = null;
    }

    // 每分钟检查一次
    await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 15));
  }
  console.log("[KittyMood] 服务已关闭");
}

await mainLoop();
process.exit(0);
