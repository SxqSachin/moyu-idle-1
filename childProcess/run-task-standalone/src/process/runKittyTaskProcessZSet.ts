/**
 * ZSET 驱动的小猫任务调度器（与用户任务调度一致的时间优先模型）。
 */
import { redisClient } from "../utils/redis.js";
import { runKittyTask } from "./runKittyTask.js";
import {
  getKittyTaskQueueInRedis,
  getKitty,
  getAllKittyByOwner,
  getKittyTaskQueueInRedis as getQueue,
  getFirstKittyTasks,
} from "../utils/game/kitty.js";
import { getMultiUserTalentCats } from "../utils/game/tarven.js";
import { getMultiCharacterStatusInfo } from "../utils/game/characterStatus.js";
import { prisma } from "../utils/prisma.js";
import { VillageBuildingStatus } from "~/shared/types/village/building.js";
import { MAX_OFFLINE_HOUR } from "~/shared/data/constant.js";
import type { Tavern } from "~/generated/prisma/client.js";
import type { CharacterStatusInfo } from "~/shared/types/characterInfo.js";
import { getKittyActionDuration } from "../utils/game/kitty.js";
import { getKittyTraits } from "../utils/game/kittyTraits.js"

const DUE_ZSET = "KITTY_TASK_DUE_ZSET";
const POP_LIMIT = Number(process.env.KITTY_TASK_POP_LIMIT || 300);
const EMPTY_WAIT = 500;
import { getUserFurnitureByType } from "../utils/game/kittyFurniture.js";
import type { KittyFurnitureExistInfo } from "~/shared/data/allKittyFurniture.js";
import type { Kitty, KittyTraitRow } from "~/shared/types/kitty.js";
const MAX_WAIT = 60_000;
const IDLE_SLICE_MAX = 1_000;
const EXEC_LEASE_TTL_MS = 30_000;
const TASK_EXEC_CONCURRENCY = Math.max(1, Number(process.env.KITTY_TASK_EXEC_CONCURRENCY || 100));
const BOOTSTRAP_LOCK_KEY = "KITTY_TASK_BOOTSTRAP_LOCK";
const BOOTSTRAP_LOCK_TTL_MS = 30_000;
const BOOTSTRAP_BATCH = 500;
const BOOTSTRAP_JITTER_MS = 5_000;

// 家具缓存（只存影响任务耗时的 4 件）
// interface FurnitureSnap { scratchingPost: boolean; cashmereToy: boolean; studyDesk: boolean; silkKittyNest: boolean; }
const furnitureCache = new Map<string, KittyFurnitureExistInfo>();
const furnitureExpire = new Map<string, number>();
const FURNITURE_TTL = 30_000;
function leaseKey(k: string) { return `kitty_task_lease:${k}`; }
async function ensureFurniture(ownerUuid: string) {
  const now = Date.now();
  if ((furnitureExpire.get(ownerUuid) || 0) > now && furnitureCache.has(ownerUuid)) return;
  const [scratchingPost, cashmereToy, studyDesk, silkKittyNest] = await Promise.all([
    getUserFurnitureByType(ownerUuid, 'scratchingPost' as any),
    getUserFurnitureByType(ownerUuid, 'furnitureCashmereToy' as any),
    getUserFurnitureByType(ownerUuid, 'studyDesk' as any),
    getUserFurnitureByType(ownerUuid, 'silkKittyNest' as any),
  ]).catch(() => [null,null,null,null]);
  furnitureCache.set(ownerUuid, {
    scratchingPost: !!scratchingPost && scratchingPost.isActive,
    cashmereToy: !!cashmereToy && cashmereToy.isActive,
    studyDesk: !!studyDesk && studyDesk.isActive,
    silkKittyNest: !!silkKittyNest && silkKittyNest.isActive,
  });
  furnitureExpire.set(ownerUuid, now + FURNITURE_TTL);
}

const traitsCache = new Map<string, KittyTraitRow[]>();
const traitsExpire = new Map<string, number>();
const TRAITS_TTL = 30_000;
async function ensureTraits(kittyUuid: string) {
  if ((traitsExpire.get(kittyUuid) || 0) > Date.now() && traitsCache.has(kittyUuid)) return;

  const traits = await getKittyTraits(kittyUuid);

  traitsCache.set(kittyUuid, traits);
  traitsExpire.set(kittyUuid, Date.now() + TRAITS_TTL);
}

// 弹出到期 kitty Lua (score<=now)
const POP_LUA = `
local zset = KEYS[1]
local now = ARGV[1]
local limit = tonumber(ARGV[2])
local arr = redis.call('ZRANGEBYSCORE', zset, '-inf', now, 'LIMIT', 0, limit)
if #arr > 0 then redis.call('ZREM', zset, unpack(arr)) end
return arr
`;

async function popDue(now: number): Promise<string[]> {
  try {
    // @ts-ignore
    const res: string[] = await redisClient.EVAL(POP_LUA, { keys: [DUE_ZSET], arguments: [String(now), String(POP_LIMIT)] });
    return res || [];
  } catch (e) {
    console.error("kitty popDue error", e); return [];
  }
}

async function schedule(kittyUuid: string, nextAt: number | null) {
  if (nextAt == null) return;
  try { await redisClient.ZADD(DUE_ZSET, { score: nextAt, value: kittyUuid }); } catch (e) { console.error("schedule kitty error", kittyUuid, e); }
}

let globalBuildings: { type: any; level: number }[] = [];
let globalExpire = 0;
async function ensureGlobal() {
  const now = Date.now();
  if (now < globalExpire) return;
  try {
    const rows = await prisma.villageBuilding.findMany({
      select: { type: true, level: true },
      where: {
        status: {
          in: [
            VillageBuildingStatus.NORMAL,
            VillageBuildingStatus.UPGRADING,
            VillageBuildingStatus.PREPARE_UPGRADE,
          ],
        },
      },
    });
    globalBuildings = rows.map(r => ({ type: r.type, level: r.level }));
    globalExpire = now + 10_000;
  } catch (e) { console.error("kitty global refresh fail", e); globalExpire = 0; }
}

interface Snap { status?: CharacterStatusInfo; taverns?: Tavern[]; basic?: any; }
const snapCache = new Map<string, Snap>();
const snapExpire = new Map<string, number>();
const SNAP_TTL = 10_000;
async function ensureOwners(owners: string[]) {
  const now = Date.now();
  const need = owners.filter(o => (snapExpire.get(o) || 0) < now);
  if (!need.length) return;
  const [tavernMap, statusMap, basicMap] = await Promise.all([
    getMultiUserTalentCats(need),
    getMultiCharacterStatusInfo(need),
    (async () => {
      const rows = await prisma.user.findMany({ where: { uuid: { in: need } }, select: { uuid: true, is_banned: true, last_online_date: true } });
      const m = new Map<string, any>(); rows.forEach(r => m.set(r.uuid, r)); return m;
    })()
  ]);
  for (const o of need) {
    snapCache.set(o, { taverns: tavernMap.get(o) || [], status: statusMap.get(o), basic: basicMap.get(o) });
    snapExpire.set(o, now + SNAP_TTL);
  }
}

function computeNextDue(firstTask: any, now: number, duration: number | null): number | null {
  if (!firstTask) return now + 30_000; // 空队列：稍后再看（也可能被新增任务立即唤醒）
  if (!firstTask.hasDeductFirstTaskResource) return now; // 需要立即扣资源
  if (!firstTask.lastSubtaskDoneTime) return now; // 需要初始化开始
  if (duration == null) return now + 1_000; // 无法计算，稍后再试
  const finishAt = firstTask.lastSubtaskDoneTime + duration;
  if (now < finishAt) return finishAt; // 等完成
  return now; // 已经到期，需要结算
}

async function loop() {
  let running = true; process.on("SIGINT", () => running = false); process.on("SIGTERM", () => running = false);

  // Bootstrap：拿锁后仅补缺（NX），避免多实例覆盖已有调度
  try {
    const gotLock = await redisClient
      .SET(BOOTSTRAP_LOCK_KEY, "1", { NX: true, PX: BOOTSTRAP_LOCK_TTL_MS } as any)
      .catch(() => null);
    if (gotLock) {
      const keys: string[] = await redisClient.SMEMBERS("ALL_KITTY_TASK_QUEUE_KEYS");
      const now = Date.now();
      if (keys.length) {
        for (let i = 0; i < keys.length; i += BOOTSTRAP_BATCH) {
          const slice = keys.slice(i, i + BOOTSTRAP_BATCH);
          const pipeline = redisClient.multi();
          for (const k of slice) {
            const uuid = k.replace("KITTY_TASK_QUEUE_", "");
            const jitter = Math.floor(Math.random() * BOOTSTRAP_JITTER_MS);
            // NX：仅补缺，不改已有 score
            pipeline.ZADD(DUE_ZSET, { score: now + jitter, value: uuid }, {
              condition: "NX"
            });
          }
          await pipeline.exec();
        }
        console.log(`[kitty-bootstrap] done, queues=${keys.length}`);
      }
    }
  } catch (e) { console.error("kitty bootstrap error", e); }

  while (running) {
    const now = Date.now();
    const dueKitties = await popDue(now);
    if (!dueKitties.length) {
      const next = await redisClient.ZRANGE_WITHSCORES(DUE_ZSET, 0, 0);
      if (next.length) {
        const rawWait = Math.min(MAX_WAIT, Math.max(20, next[0].score - Date.now()));
        const wait = Math.min(rawWait, IDLE_SLICE_MAX);
        await new Promise(r => setTimeout(r, wait));
      } else {
        await new Promise(r => setTimeout(r, EMPTY_WAIT));
      }
      continue;
    }

    // 预热
    await ensureGlobal();

    // 并行预取 Kitty，避免重复 IO；构建 kitty 映射与 owners 集合
    const kittyPairs = await Promise.all(
      dueKitties.map(async (k) => [k, await getKitty(k)] as const)
    );
    // 批量预取每只 kitty 的首任务，避免单独 LINDEX 引起的 RTT
    const firstTaskMap = await getFirstKittyTasks(dueKitties);
    const kittyMap = new Map<string, any>();
    const owners = new Set<string>();
    for (const [k, kitty] of kittyPairs) {
      if (kitty) {
        kittyMap.set(k, kitty);
        owners.add(kitty.owner);
      }
    }
    await ensureOwners([...owners]);
    // 批量预取家具，降低 handleKitty 内重复 IO
    if (owners.size) {
      await Promise.all([...owners].map(o => ensureFurniture(o)));
    }

    if (kittyMap.size) {
      await Promise.all([...kittyMap.keys()].map(k => ensureTraits(k)));
    }

    // 返回下次调度时间，由外部批量 ZADD
    const handleKitty = async (kittyUuid: string, kittyPre?: Kitty): Promise<{ kittyUuid: string; nextAt: number | null }> => {
      const kitty = kittyPre || await getKitty(kittyUuid);
      if (!kitty) { return { kittyUuid, nextAt: null }; }
      // 如果小猫的主人正在钓鱼，则暂时跳过该 kitty 的任务调度
      try {
        // check by actor id (kitty uuid) so both player-actors and kitty-actors are covered
        const isFishing = await redisClient.SISMEMBER('FISHING_ACTIVE_ACTOR_UUIDS', kittyUuid).catch(() => 0 as any);
        if (Number(isFishing) === 1) {
          return { kittyUuid, nextAt: Date.now() + 60_000 };
        }
      } catch (e) {
        // Redis 检查失败则继续处理
      }
      if (kitty.isInExpedition) { return { kittyUuid, nextAt: Date.now() + 30_000 }; }

      const snap = snapCache.get(kitty.owner) || {};
      const basic = snap.basic;
  if (!basic) { return { kittyUuid, nextAt: Date.now() + 5_000 }; }
  if (basic.is_banned) { return { kittyUuid, nextAt: null }; }
      const lastOnline = basic.last_online_date?.getTime() || 0;
      const offlineMs = MAX_OFFLINE_HOUR * 3600 * 1000;
  if (!lastOnline || Date.now() - lastOnline > offlineMs) { return { kittyUuid, nextAt: Date.now() + 60_000 }; }

    // 优先使用预取的首任务，只有在 needRun 时再拉取整队列
    let firstTask = firstTaskMap.get(kittyUuid) || null;
    let tasks: any[] = [];
    if (firstTask) tasks = [firstTask];
      let duration: number | null = null;
      if (firstTask && firstTask.hasDeductFirstTaskResource && firstTask.lastSubtaskDoneTime) {
        try {
          // 兜底：批量阶段如未加载或已过期，这里确保一次
          await ensureFurniture(kitty.owner);
          await ensureTraits(kittyUuid);
          const furn = furnitureCache.get(kitty.owner) ?? {};
          duration = getKittyActionDuration(kitty, firstTask.actionId, furn, traitsCache.get(kittyUuid) || []);
        } catch {}
      }

      let needRun = false;
      if (!firstTask) needRun = false;
      else if (!firstTask.hasDeductFirstTaskResource) needRun = true;
      else if (!firstTask.lastSubtaskDoneTime) needRun = true;
      else if (duration != null && Date.now() >= firstTask.lastSubtaskDoneTime + duration) needRun = true;

      if (kitty.satiety <= 0) {
        // 饱食度 0：延后并等待可能的喂食；不在这里直接清，因为业务逻辑里会清
        return { kittyUuid, nextAt: Date.now() + 60_000 };
      }

      if (needRun) {
        // 只有当确实要执行时再获取整队列
        try {
          tasks = await getKittyTaskQueueInRedis(kittyUuid);
          firstTask = tasks[0];
        } catch (e) { tasks = tasks || []; }
        const got = await redisClient.SET(leaseKey(kittyUuid), "1", { NX: true, PX: EXEC_LEASE_TTL_MS } as any).catch(() => null);
        if (!got) { return { kittyUuid, nextAt: Date.now() + 300 }; }
        try {
          await runKittyTask(kittyUuid, {
            kitty: kitty as any,
            userTavern: (snap.taverns || []) as any,
            userCharacterStatus: snap.status as any,
            villageBuildingInfo: globalBuildings as any,
            furnitureInfo: furnitureCache.get(kitty.owner) ?? {},
            kittyTraits: traitsCache.get(kittyUuid) || [],
          });
        } catch (e) { console.error("runKittyTask error", kittyUuid, e); }
        finally { await redisClient.DEL(leaseKey(kittyUuid)).catch(() => {}); }
      }

      const updatedFirst = needRun ? (await getQueue(kittyUuid))[0] : tasks[0];
      let next = computeNextDue(updatedFirst,  Date.now(), duration);
      if (updatedFirst && updatedFirst.currentRepeat >= updatedFirst.repeatCount) {
        next = Date.now() + 2_000; // run 内部会删除，这里兜底
      }
      return { kittyUuid, nextAt: next };
    };

    // 批量执行并批量调度，降低 ZADD 往返次数
    if (TASK_EXEC_CONCURRENCY <= 1 || dueKitties.length <= 1) {
      const results: { kittyUuid: string; nextAt: number | null }[] = [];
      for (const k of dueKitties) results.push(await handleKitty(k, kittyMap.get(k)));
      if (results.length) {
        const pipeline = redisClient.multi();
        for (const r of results) if (r.nextAt != null) pipeline.ZADD(DUE_ZSET, { score: r.nextAt, value: r.kittyUuid });
        await pipeline.exec();
      }
    } else {
      for (let i = 0; i < dueKitties.length; i += TASK_EXEC_CONCURRENCY) {
        const slice = dueKitties.slice(i, i + TASK_EXEC_CONCURRENCY);
        const results = await Promise.all(slice.map(k => handleKitty(k, kittyMap.get(k))));
        const pipeline = redisClient.multi();
        for (const r of results) if (r.nextAt != null) pipeline.ZADD(DUE_ZSET, { score: r.nextAt, value: r.kittyUuid });
        await pipeline.exec();
      }
    }
  }
}

await loop().catch(e => { console.error(e); process.exit(1); });
