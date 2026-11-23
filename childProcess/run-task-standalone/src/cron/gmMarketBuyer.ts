import { prisma } from "../utils/prisma";
import { redisClient } from "../utils/redis";
import { gmBuyFromMarket, getTransactionInfoList, getAllMarketResourceIds, getHotMarketResourceIds } from "../utils/game/market";
import { safeJsonParse, randomIntegerInFullCloseRange, delay } from "~/shared/utils";
import { allGameResource } from "~/shared/data/allGameResources";

// Daytime schedule: 9:00 ~ 21:00, every 2 hours (9,11,13,15,17,19,21)
const DAY_START = 9;
const DAY_END = 21;
const INTERVAL_HOURS = 2;
const RUN_PROB_PERCENT = 80; // 每个时间点触发执行的概率（%）

let scheduledHours: number[] = [];
let lastScheduledDay: number | null = null;

let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });

const gmUuid = "2509432e-caea-4abd-9220-e66ff6ef6a08";

// 可为某些特殊资源单独配置最高购买单价（单位：货币单位/每件）
// 例如: { 'rare_sword+1': 50000, 'super_potion': 1000 }
// 留空或不包含的资源将使用全局 MAX_UNIT_PRICE 作为上限
const RESOURCE_MAX_UNIT_PRICE: Record<string, number> = {
  // 示例配置：
  berry: 40,
  mushroom: 100,
  bamboo: 100,
  // "rare_sword+1": 50000,
  // "super_potion": 1000,
};

function recomputeScheduleIfNeeded() {
  const now = new Date();
  const today = now.getDate();
  if (lastScheduledDay === today && scheduledHours.length > 0) return;

  // 生成白天固定的小时点（每两个小时一个机会）
  const hours: number[] = [];
  for (let h = DAY_START; h <= DAY_END; h += INTERVAL_HOURS) {
    hours.push(h);
  }
  scheduledHours = hours;
  lastScheduledDay = today;
  console.log(`[GmMarketBuyer] scheduled hours for today: ${scheduledHours.join(",")}`);
}

async function runOnce() {
  // 使用代码内置的配置（不再依赖 redis 配置）
  const ENABLED = true;
  const DAILY_RUNS = 6; // 每天运行次数（用于生成随机小时数）
  const ORDER_THRESHOLD = 6; // 当某资源订单数大于此值时触发购买
  const BUY_CANDIDATES = 4; // 每个资源最多考虑前多少个订单
  const SKIP_PERCENT = 20; // 随机跳过单个订单的百分比
  // 购买比例选项：50%, 75%, 100%

  if (!ENABLED) {
    console.log("[GmMarketBuyer] 未启用（code config），跳过");
    return;
  }

  // 只获取热销的资源 id（未关闭订单数超过阈值），以提高效率
  const resourceIds = await getHotMarketResourceIds(ORDER_THRESHOLD);

  const runStart = Date.now();
  const runLog: any = {
    time: new Date().toISOString(),
    totalResources: resourceIds.length,
    actions: [],
  };

  // 用来记录本次运行已经购买过的卖家，避免一次运行中多次买同一人
  const sellersBoughtThisRun = new Set<string>();

  for (let idx = 0; idx < resourceIds.length; idx++) {
    const resourceId = resourceIds[idx];
    const resourceName = (allGameResource as any)[resourceId]?.name ?? resourceId;
    console.log(`[GmMarketBuyer] Processing ${idx + 1}/${resourceIds.length} - ${resourceId} (${resourceName})`);
    try {
      const txList = await getTransactionInfoList(resourceId);
      if (!txList || txList.length === 0) continue;

      if (txList.length > ORDER_THRESHOLD) {
        // 按订单数的 40% 选择候选订单（至少保留 BUY_CANDIDATES 个）以处理订单数量较多的情况
        const candidateCount = Math.max(BUY_CANDIDATES, Math.ceil(txList.length * 0.3));
        // 只考虑价格最低的 candidateCount 个
        const toBuy = txList.slice(0, candidateCount);
        const resourceAction: any = { resourceId, totalOrders: txList.length, candidates: toBuy.length, bought: [] };

        for (const order of toBuy) {
          // 随机跳过部分订单以显得自然
          const skipChance = randomIntegerInFullCloseRange(1, 100);
          if (skipChance <= SKIP_PERCENT) {
            resourceAction.bought.push({ tradeUuid: order.tradeUuid, skipped: true, reason: 'random-skip' });
            continue;
          }

          // 避免在同一次运行中从同一卖家多次购买
          if (sellersBoughtThisRun.has(order.seller)) {
            resourceAction.bought.push({ tradeUuid: order.tradeUuid, skipped: true, reason: 'seller-already-bought' });
            continue;
          }

          // 随机决定购买比例（50%, 75%, 100%），然后向下取整为整数且至少为1
          const remaining = order.sellResourceCount - order.selledResourceCount;
          if (remaining <= 0) {
            resourceAction.bought.push({ tradeUuid: order.tradeUuid, skipped: true, reason: 'no-remaining' });
            continue;
          }
          const percentOptions = [50, 75, 100];
          const pick = percentOptions[Math.floor(Math.random() * percentOptions.length)];
          let buyCount = Math.floor((remaining * pick) / 100);
          if (buyCount < 1) buyCount = 1;
          if (buyCount > remaining) buyCount = remaining;
          if (buyCount <= 0) {
            resourceAction.bought.push({ tradeUuid: order.tradeUuid, skipped: true, reason: 'no-remaining' });
            continue;
          }

          // 随机等待以避免突发流量
          await delay(randomIntegerInFullCloseRange(400, 3000));

          try {
            // Enforce per-purchase limits
            const MAX_SINGLE_PURCHASE_COUNT = 1000000;
            const MAX_UNIT_PRICE = 150000;
            // 如果为当前资源定义了单独的最高购买价，使用该值作为上限
            const resourceMax = RESOURCE_MAX_UNIT_PRICE[resourceId];
            const effectiveMaxUnitPrice = typeof resourceMax === 'number' ? resourceMax : MAX_UNIT_PRICE;
            if (order.costPerUnit > effectiveMaxUnitPrice) {
              resourceAction.bought.push({ tradeUuid: order.tradeUuid, skipped: true, reason: 'unit-price-too-high', unitPrice: order.costPerUnit, maxAllowed: effectiveMaxUnitPrice });
              console.log(`[GmMarketBuyer] skip ${order.tradeUuid} due to high unit price ${order.costPerUnit}, maxAllowed=${effectiveMaxUnitPrice}`);
            } else {
              const finalBuyCount = Math.min(buyCount, MAX_SINGLE_PURCHASE_COUNT);
              await gmBuyFromMarket({ tradeUuid: order.tradeUuid, buyerUuid: gmUuid, buyCount: finalBuyCount });
              resourceAction.bought.push({ tradeUuid: order.tradeUuid, skipped: false, buyCount: finalBuyCount });
              sellersBoughtThisRun.add(order.seller);
              console.log(`[GmMarketBuyer] bought ${finalBuyCount} of ${order.sellResourceId} from ${order.tradeUuid}`);
            }
          } catch (err) {
            resourceAction.bought.push({ tradeUuid: order.tradeUuid, skipped: false, buyCount, error: String(err) });
            console.error(`[GmMarketBuyer] buy failed for ${order.tradeUuid}:`, err);
          }
        }

        // 在每个资源后增加一段随机间隔（使行为更人类化）
        await delay(randomIntegerInFullCloseRange(1000, 8000));

        runLog.actions.push(resourceAction);
      }
    } catch (err) {
      console.error("[GmMarketBuyer] error scanning resource", resourceId, err);
    }
  }

  // 本次运行结束，输出简洁总结到控制台（不再写入 redis）
  try {
    const durationMs = Date.now() - runStart;
    const totalActions = runLog.actions.length;
    const totalBought = runLog.actions.reduce((acc: number, a: any) => {
      const bought = a.bought?.filter((b: any) => !b.skipped && b.buyCount)?.reduce((s: number, x: any) => s + (x.buyCount || 0), 0) || 0;
      return acc + bought;
    }, 0);

    console.log(`[GmMarketBuyer] 运行结束: time=${runLog.time}, resourcesChecked=${runLog.totalResources}, actions=${totalActions}, totalBought=${totalBought}, durationMs=${durationMs}`);
  } catch (err) {
    console.error("[GmMarketBuyer] failed to print run summary", err);
  }
}

async function mainLoop() {
  console.log("[GmMarketBuyer] 服务已启动");

  // 每次启动或跨天时重算当天的6个随机执行小时
  recomputeScheduleIfNeeded();

  // 启动立即执行一次（但带一点随机延迟）
  await delay(randomIntegerInFullCloseRange(500, 3000));
  await runOnce();

  while (running) {
    const now = new Date();
    const currentDay = now.getDate();
    const currentHour = now.getHours();

    // 如果跨天，重算当天调度
    if (lastScheduledDay !== currentDay) {
      recomputeScheduleIfNeeded();
    }

    // 当当前小时在计划内时，触发一次（并带随机分钟偏移来避免规律）
    if (scheduledHours.includes(currentHour)) {
      // 每个时间点有一定概率真正执行，避免完全规律（例如 80%）
      const runChance = randomIntegerInFullCloseRange(1, 100);
      if (runChance > RUN_PROB_PERCENT) {
        console.log(`[GmMarketBuyer] scheduled hour ${currentHour} skipped by probability (${runChance}%)`);
        // 等待到下一个小时再检查
        await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * (60 - now.getMinutes())));
        continue;
      }
      // 为了避免精确在整点触发，做一个随机分钟延迟（0-59 分钟）和随机秒延迟
      const minuteOffset = randomIntegerInFullCloseRange(0, 59);
      const secondOffset = randomIntegerInFullCloseRange(0, 59);
      console.log(`[GmMarketBuyer] scheduled hour hit ${currentHour}, waiting offset ${minuteOffset}m ${secondOffset}s`);
      await new Promise((resolve) => setTimeout(resolve, (minuteOffset * 60 + secondOffset) * 1000));

      console.log(`[GmMarketBuyer] 执行开始 - ${new Date().toLocaleString()}`);
      await runOnce();
      console.log(`[GmMarketBuyer] 执行完毕 - ${new Date().toLocaleString()}`);
      // 避免在同一小时重复执行多次，sleep 至下一个小时
      await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * (60 - now.getMinutes())));
    }

    // 小睡一会儿，减少轮询频率
    await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 5));
  }

  console.log("[GmMarketBuyer] 服务已关闭");
}

// 如果这个文件是单独运行的脚本，启动主循环
(async () => {
  await mainLoop();
  process.exit(0);
})();
