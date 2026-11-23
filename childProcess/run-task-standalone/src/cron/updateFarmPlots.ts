import { prisma } from "../utils/prisma";
import { withUniqueLock } from "../utils";
import { autoHarvestAndReplant } from "../utils/game/farming";
import pLimit from "p-limit"; // 并发控制（替代手写 inFlight 队列）
import { delay } from "~/shared/utils";

// ====== 调度参数（可根据负载调优，已写死以保证行为稳定） ======
// 运行间隔：默认 120 秒（单位 ms）
const INTERVAL_MS = 60_000; // 每轮间隔
const BATCH_SIZE = 100000; // 单轮最多处理的田地数量（成熟 & 自动收获）
const CONCURRENCY = 4; // 并发上限：顺序执行以降低锁冲突风险
const AUTO_HARVEST_MAX_RETRY = 1; // 自动收获的重试次数（遇到瞬态事务超时）

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

/**
 * 阶段 1：成熟推进
 * 查找已到 expectedHarvestAt 的 GROWING 田地，翻转为 READY。
 * 使用 updateMany(where: {id, state:GROWING}) 防止并发竞态抛 P2025。
 */
interface MaturityResult { flipped: number; skipped: number; autoTargets: Array<{ userUuid: string; plotIndex: number }>; }

async function processBatch(now: Date): Promise<MaturityResult> {
  // 1) 筛选符合成熟条件的田地（仍是 GROWING）；顺便拿到 autoReplant + user/plot 信息，锁内一次取出
  const matured = await prisma.userFarmPlot.findMany({
    where: { state: 'GROWING', expectedHarvestAt: { lte: now } },
    orderBy: [ { expectedHarvestAt: 'asc' }, { id: 'asc' } ],
    take: BATCH_SIZE,
    select: { id: true, userUuid: true, plotIndex: true, autoReplant: true },
  });
  if (!matured.length) return { flipped: 0, skipped: 0, autoTargets: [] };

  const ids = matured.map(m => m.id);
  // 2) 批量条件翻转：仅翻转仍为 GROWING 的记录
  const updateRes = await prisma.userFarmPlot.updateMany({
    where: { id: { in: ids }, state: 'GROWING' },
    data: { state: 'READY', lastTickAt: now, expectedHarvestAt: now }
  });
  const flipped = updateRes.count;
  const skipped = matured.length - flipped; // 代表已被其他流程处理/状态改变

  if (flipped || skipped) {
    console.log(`[FarmCron] 成熟翻转完成: READY=${flipped}${skipped ? ` 跳过=${skipped}` : ''}`);
  }

  // 3) 仅对本次查询中 autoReplant=true 的田地发起后续自动收获尝试（不在锁内执行）
  const autoTargets = matured
    .filter(m => m.autoReplant)
    .map(m => ({ userUuid: m.userUuid, plotIndex: m.plotIndex }));

  return { flipped, skipped, autoTargets };
}

/**
 * After flipping to READY, auto-harvest plots that have autoReplant=true.
 * This will call harvestPlot which handles reward distribution and auto-replanting.
 */
/**
 * 锁外执行的自动收获阶段：使用 p-limit 控制并发，避免延长全局锁持有时间。
 */
async function runAutoHarvest(autoTargets: Array<{ userUuid: string; plotIndex: number }>) {
  if (!autoTargets.length) return { done: 0, skipped: 0, failed: 0 };
  const limit = pLimit(CONCURRENCY);
  let done = 0, skipped = 0, failed = 0;

  // Group by userUuid so that we process each user's plots sequentially (reduce contention)
  const byUser = new Map<string, number[]>();
  for (const t of autoTargets) {
    const arr = byUser.get(t.userUuid) || [];
    arr.push(t.plotIndex);
    byUser.set(t.userUuid, arr);
  }

  // For each user, create a task that processes their plots sequentially
  const tasks: Array<Promise<void>> = [];
  for (const [userUuid, plots] of byUser.entries()) {
    tasks.push(limit(async () => {
      for (const plotIndex of plots) {
        let attempt = 0;
        while (attempt <= AUTO_HARVEST_MAX_RETRY) {
          attempt++;
          try {
            await autoHarvestAndReplant(userUuid, plotIndex);
            done++;
            break;
          } catch (err: any) {
            const msg = err?.message || String(err);
            if (/尚未成熟|作物信息缺失|田地不存在/i.test(msg)) { skipped++; break; }
            // 若为事务过期类错误，可重试；否则记录并跳出
            if (/Transaction already closed|timeout|expired/i.test(msg) && attempt <= AUTO_HARVEST_MAX_RETRY) {
              const backoff = 100 * attempt;
              console.warn(`[FarmCron] transient tx error, retrying user=${userUuid} plot=${plotIndex} attempt=${attempt} after ${backoff}ms:`, msg);
              await new Promise(res => setTimeout(res, backoff));
              continue;
            }
            failed++;
            console.error(`[FarmCron] 自动收获+补种失败 user=${userUuid} plot=${plotIndex}:`, msg);
            break;
          }
        }
      }
    }));
  }

  await Promise.all(tasks);

  if (done || skipped || failed) {
    console.log(`[FarmCron] 自动收获补种完成: 收获=${done}${skipped ? ` 跳过=${skipped}` : ''}${failed ? ` 失败=${failed}` : ''}`);
  }
  return { done, skipped, failed };
}

async function tickLoop() {
  console.log(`[FarmCron] 农场进度定时器启动，间隔 ${Math.round(INTERVAL_MS / 1000)}s ...`);
  while (running) {
    const start = Date.now();
    // Step 1: 锁内执行成熟翻转，拿到需要自动收获的目标列表
    let maturity: MaturityResult = { flipped: 0, skipped: 0, autoTargets: [] };
    try {
      const now = new Date();
      // Ensure only one process flips states at a time across workers
      maturity = await processBatch(now);
    } catch (e: any) {
      console.error('[FarmCron] 成熟阶段失败：', e?.message || e);
    }

    await delay(5000);

    // Step 2: 锁外执行自动收获补种（仅对本轮成熟中标记 autoReplant 的田地）
    try {
      const harvestRes = await runAutoHarvest(maturity.autoTargets);
      if (maturity.flipped === 0 && harvestRes.done === 0 && harvestRes.skipped === 0 && harvestRes.failed === 0) {
        console.log('[FarmCron] 本轮无成熟或自动收获事件');
      }
    } catch (e: any) {
      console.error('[FarmCron] 自动收获阶段异常：', e?.message || e);
    }

    // Sleep until next interval
    const elapsed = Date.now() - start;
    const toSleep = Math.max(0, INTERVAL_MS - elapsed);
    await sleep(toSleep);
  }
  console.log('[FarmCron] 服务已停止');
}

await tickLoop();
process.exit(0);
