import { redisClient } from '../utils/redis';
import { pushMessageToQueue, type BattleOutcomeBatchJob } from '../utils/game/msgQueue';
import pLimit from 'p-limit';
import { giveBattleExpReward, giveBattleReward } from '../utils/game/battle';
import type { ItemCountInfo } from '~/shared/types/gameInventory';
import { safeJsonParse } from '~/shared/utils';
import type { NormalBattleRoom } from '~/shared/types/battleRoom';
// (No compression/inflation used for payloads to avoid CPU overhead)

// Tunables via env
// Tunables and safety caps via env
// hard cap to avoid accidental huge batches from env and protect redis
const DEFAULT_POP_BATCH = 100;
const MAX_POP_BATCH = 200; // safety upper bound to avoid long blocking operations
const POP_BATCH = Math.min(MAX_POP_BATCH, Math.max(1, Number(process.env.BATTLE_OUTCOME_POP_BATCH ?? DEFAULT_POP_BATCH)));
// avoid accidental huge batches from env; keep an upper safety bound
const WORKER_CONCURRENCY = Math.max(1, Number(process.env.BATTLE_OUTCOME_WORKER_CONCURRENCY ?? 8));
const FIRST_POP_TIMEOUT_SEC = Math.max(0.1, Number(process.env.BATTLE_OUTCOME_POP_TIMEOUT_SEC ?? 2));
const POLL_DELAY_MS = Math.max(10, Number(process.env.BATTLE_OUTCOME_POLL_DELAY_MS ?? 10)); // Added POLL_DELAY_MS

const OUTCOME_QUEUE_KEY = 'queue:battle_outcome_id';

async function brpop(queue: string, timeoutSec = FIRST_POP_TIMEOUT_SEC): Promise<string | null> {
  try {
    // using Redis v4: BRPOP returns [key, value] or null
    const res = await redisClient.brPop(queue, timeoutSec);
    if (!res) return null;
    return Array.isArray(res) ? res[1] : (typeof res === 'object' ? res?.element ?? null : null);
  } catch (err) {
    console.error('[battleOutcomeWorker] BRPOP error', err);
    return null;
  }
}

async function bulkRpop(queue: string, count: number): Promise<string[]> {
  if (count <= 0) return [];
  const cap = Math.min(count, POP_BATCH);
  try {
    const res = await redisClient.rPopCount(queue, cap);
    if (!res) return [];
    if (Array.isArray(res)) return res.map(String);
    return [String(res)];
  } catch (err) {
    console.error('[battleOutcomeWorker] bulkRpop error', err);
    return [];
  }
}

async function handleJob(item: { key: string; raw?: string }) {
  // item.key is payload key; item.raw may contain the pre-fetched JSON string
  const payloadKey = item.key;
  let job: BattleOutcomeBatchJob | null = null;
  try {
    const rawPayload = typeof item.raw === 'string' ? item.raw : await redisClient.get(payloadKey);
    if (!rawPayload) {
      console.warn('[battleOutcomeWorker] payload missing for key', payloadKey);
      return;
    }
    job = JSON.parse(rawPayload) as BattleOutcomeBatchJob;
  } catch (e) {
    console.error('[battleOutcomeWorker] invalid job payload', e);
    return;
  }
  if (!job || job.type !== 'battle_outcome_batch') return;

  // use `let` so we can explicitly clear references for long-running worker
  // (helps GC if jobs contain large nested objects)
  // @ts-ignore -- dynamic typing for ease in this worker
  let room = job.room;
  let battleInfo = job.battleInfo;
  let unitStatistic = job.unitStatistic;
  let extraExpPercent = job.extraExpPercent;
  let result = job.result;

  try {
    // 计算并落库（复用现有重函数，但在后台执行，避免阻塞主路径）
    const tasks: Promise<any>[] = [];
    const runExp = giveBattleExpReward(room as NormalBattleRoom, battleInfo as any, unitStatistic as any, extraExpPercent ?? 0);
    tasks.push(runExp);

    // 胜利或逃跑时才发放资源奖励（按现有业务约定）
    let runItem: Promise<any> | null = null;
    if (result === 'win' || result === 'escaped') {
      runItem = giveBattleReward(room as NormalBattleRoom, battleInfo, {
        target: job.resourceRewardTarget,
        title: job.resourceRewardTitle,
      });

      tasks.push(runItem);
    }

    const results = await Promise.all(tasks);
    const expRewardDetail = results[0];
    const itemReward: Record<string, ItemCountInfo> | undefined = runItem ? results[1] : undefined;

    // 回放与客户端通知（保持事件与结构不变）
    if (expRewardDetail && expRewardDetail !== null) {
      // pushMessageToQueue({
      //   type: 'battle_info_detail',
      //   playerUuid: Object.keys(expRewardDetail),
      //   battleUuid: battleInfo.uuid,
      //   info: { detail: unitStatistic }
      // } as any);

      // pushMessageToQueue({
      //   type: 'give_battle_exp_reward',
      //   playerUuid: Object.keys(expRewardDetail),
      //   battleUuid: battleInfo.uuid,
      //   info: { expRewardDetail }
      // } as any);
    }

    if (itemReward && itemReward !== null) {
      const roomUuid = room.uuid;

      if (roomUuid) {
        const battleRewardRedisKey = `battle:rewardInfo:${roomUuid}`;

        const lastRewardDataRaw = await redisClient.get(battleRewardRedisKey);

        let lastRewardData: Record<string, ItemCountInfo> = {};
        if (lastRewardDataRaw) {
          lastRewardData = safeJsonParse<Record<string, ItemCountInfo>>(lastRewardDataRaw);
        }

        // merge itemReward into currentData
        for(const userUuid of Object.keys(itemReward)) {
          const thisUserNewReward = itemReward[userUuid];

          if (!lastRewardData[userUuid]) {
            lastRewardData[userUuid] = itemReward[userUuid];
          } else {
            const existing = lastRewardData[userUuid];
            for (const itemId of Object.keys(thisUserNewReward)) {
              if (!existing[itemId]) {
                existing[itemId] = thisUserNewReward[itemId];
              } else {
                existing[itemId].count += thisUserNewReward[itemId]?.count || 0;
              }
            }
          }
        }

        // 过滤掉当前房间中不存在的用户key
        const neededRemovedUserUuids = new Set<string>();
        const existedUserUuids = room.memberIds;
        for (const uuid of Object.keys(lastRewardData)) {
          if (!existedUserUuids.includes(uuid)) {
            neededRemovedUserUuids.add(uuid);
          }
        }

        for (const uuid of neededRemovedUserUuids) {
          delete lastRewardData[uuid];
        }
        
        await redisClient.set(battleRewardRedisKey, JSON.stringify(lastRewardData), {
          EX: 3600 * 6, // 6 hours expiration
        });
      }

      // pushMessageToQueue({
      //   type: 'give_battle_resource_reward',
      //   playerUuid: Object.keys(itemReward),
      //   battleUuid: battleInfo.uuid,
      //   info: { resourceRewardDetail: itemReward }
      // } as any);
    }
  } catch (err) {
    console.error('[battleOutcomeWorker] handleJob error', err);
  } finally {
    // Explicitly clear large references to help the GC in long-running process
    try {
      // @ts-ignore
      job = undefined;
      // @ts-ignore
      room = undefined;
      // @ts-ignore
      battleInfo = undefined;
      // @ts-ignore
      unitStatistic = undefined;
      // @ts-ignore
      extraExpPercent = undefined;
      // @ts-ignore
      result = undefined;
    } catch (err) {
      // ignore
    }
    // cleanup payload key after processing attempt
    try {
      await redisClient.del(payloadKey as string);
    } catch (e) {
      // ignore deletion failures; TTL will eventually remove it
    }
  }
}

/**
 * Process `items` with `limit` concurrent workers.
 * This implementation avoids retaining settled Promises in an array
 * (previous implementation pushed settled promises into `inFlight` and
 * caused the array to grow over time). Each worker loops and processes
 * items sequentially; memory usage is bounded by `limit`.
 */
async function runWithConcurrency<T>(items: T[], limit: number, worker: (it: T) => Promise<any>) {
  if (!items || items.length === 0) return;
  // Bounded concurrency using a Set of in-flight promises.
  // This avoids scheduling all tasks up-front and keeps the number of
  // retained promise objects bounded by `limit`.
  let idx = 0;
  const inFlight = new Set<Promise<any>>();

  const launchOne = () => {
    if (idx >= items.length) return;
    const it = items[idx++];
    const p = worker(it).catch(err => {
      // worker already logs; still catch to prevent unhandled rejection
      console.error('[battleOutcomeWorker] worker error', err);
    });
    inFlight.add(p);
    p.finally(() => inFlight.delete(p));
  };

  // prime initial workers
  while (idx < items.length && inFlight.size < limit) launchOne();

  // whenever there are remaining items, wait for one in-flight to finish then launch next
  while (idx < items.length) {
    // wait for any promise to settle
    await Promise.race(inFlight);
    while (idx < items.length && inFlight.size < limit) launchOne();
  }

  // wait for remaining in-flight to finish
  await Promise.allSettled(Array.from(inFlight));
}

async function main() {
  console.info('[battleOutcomeWorker] starting', { POP_BATCH, WORKER_CONCURRENCY, FIRST_POP_TIMEOUT_SEC, POLL_DELAY_MS }); // Log POLL_DELAY_MS
  while (true) {
    // Add a small delay to reduce CPU pressure and prevent tight polling
    await new Promise(resolve => setTimeout(resolve, POLL_DELAY_MS)); // Use POLL_DELAY_MS

    try {
      const first = await brpop(OUTCOME_QUEUE_KEY, FIRST_POP_TIMEOUT_SEC);
      if (!first) continue;

      // micro-batch: after first pop, drain up to POP_BATCH-1 items atomically
      const more = await bulkRpop(OUTCOME_QUEUE_KEY, Math.max(0, POP_BATCH - 1));
      const keys = [first, ...more];

      // Batch-prefetch payloads using a pipeline to reduce RTT.
      const pipeline = redisClient.multi();
      for (const k of keys) pipeline.get(k as string);
      const rawResults = await pipeline.exec();

      // Normalize results and pair with keys. Skip missing payloads.
      const items: { key: string; raw?: string }[] = [];
      for (let i = 0; i < keys.length; i++) {
        const rawVal = rawResults?.[i] ?? null;
        if (rawVal == null) {
          console.warn('[battleOutcomeWorker] payload missing for key (prefetch)', keys[i]);
          continue;
        }
        items.push({ key: keys[i], raw: String(rawVal) });
      }

      if (items.length === 0) continue;
      await runWithConcurrency(items, WORKER_CONCURRENCY, handleJob);
    } catch (err) {
      console.error('[battleOutcomeWorker] loop error', err);
    }
  }
}

await main().catch(err => {
  console.error('[battleOutcomeWorker] fatal', err);
  process.exit(1);
});
