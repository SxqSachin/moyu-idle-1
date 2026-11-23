/**
 * ZSET 驱动的用户任务调度器（多进程安全）。
 */
// Use wall-clock time by default for scheduling
import { redisClient } from "../utils/redis.js";
import {
  getTaskQueueInRedis,
  getAllTaskQueueKeys,
  getFirstTask,
  getFirstTasks,
  getAllTaskQueueKeysUnsorted,
} from "../utils/game/taskQueue.js";
import { runUserTask } from "./runUserTask.js";
import { getActionDuration, batchGetPlayerGlobalState, getPlayerGlobalState } from "../utils/game/character.js";
import { batchGetBasicUserInfo } from "../utils/game/user.js";
import { getMultiCharacterStatusInfo, getCharacterStatusInfo } from "../utils/game/characterStatus.js";
import { getMultiUserTalentCats, getUserTalentCats } from "../utils/game/tarven.js";
import { getMultiQuestList, getQuestList } from "../utils/game/quest.js";
import { getMultiUserWorkEquipment, getUserEquipment } from "../utils/game/equipment.js";
import { prisma } from "../utils/prisma.js";
import { VillageBuildingStatus } from "~/shared/types/village/building.js";
import { MAX_OFFLINE_HOUR } from "~/shared/data/constant.js";
import type {
  CharacterEquipmentInfo,
  CharacterStatusInfo,
  PlayerState,
} from "~/shared/types/characterInfo.js";
import type { Tavern } from "~/generated/prisma/client.js";
import type { Quest } from "~/shared/types/quest.js";
import type { LearnedSkillFlatItem } from "~/shared/types/skillTree.js";
import { batchGetAllLearnedSkillTreeNodes, listAllLearnedSkillTreeNodes } from "../utils/game/skillTree.js";
import { subscribeGameBroadcast } from "../utils/game/broadcastHub.js";
import { GameBroadcastKind, type BroadcastMessage } from "~/shared/types/broadcast.js";


// 启动广播订阅：当收到包含 userUuid 或 userUuidList 的广播时刷新对应快照
(async function initBroadcastSubscription() {
  try {
    await subscribeGameBroadcast(async (msg) => {
      try {
        if (!msg) return;

        switch(msg.kind) {
          case GameBroadcastKind.USER_BASIC_INFO_UPDATED:
            await refreshSingleUser(msg.userUuid, 'basic');
            return;

          case GameBroadcastKind.USER_ACTION_DURATION_UPDATED:
            // no-op for scheduler
            return;

          case GameBroadcastKind.USER_STATUS_UPDATED:
            await refreshSingleUser(msg.userUuid, 'status');
            return;
          case GameBroadcastKind.USER_TALENT_CAT_UPDATED:
            await refreshSingleUser(msg.userUuid, 'taverns');
            return;
          case GameBroadcastKind.USER_QUEST_UPDATED:
            await refreshSingleUser(msg.userUuid, 'quests');
            return;
          case GameBroadcastKind.USER_WORK_EQUIPMENT:
            await refreshSingleUser(msg.userUuid, 'work');
            return;
          case GameBroadcastKind.USER_GLOBAL_STATE_UPDATED:
            await refreshSingleUser(msg.userUuid, 'playerGlobalState');
            return;
          case GameBroadcastKind.USER_SKILL_TREE_UPDATED:
            await refreshSingleUser(msg.userUuid, 'skillNodes');
            return;

          default:
            break;
        }
      } catch (e) {
        console.error('[broadcast] handler error', e, msg);
      }
    });
  } catch (e) {
    console.error('[broadcast] subscribe init failed', e);
  }
})();



const DUE_ZSET = "USER_TASK_DUE_ZSET";
// 外部服务在立即调度用户时会往该列表推送一条唤醒信号，
// 调度器在空闲时通过 BRPOP 等待，从而避免频繁短时间轮询造成的 CPU 抖动。
const WAKE_LIST = "USER_TASK_WAKE";
// 可调批量弹出数量，影响单批延迟与 Redis 压力
const POP_LIMIT = 300;
const EMPTY_WAIT = 100;
const MAX_WAIT = 60_000;
// 空闲长等待最大切片：确保有新用户被立即调度时最迟 1s 内被发现
const IDLE_SLICE_MAX = Math.max(20, Number(process.env.TASK_IDLE_SLICE_MS || 200));
const BOOTSTRAP_BATCH = 500;
const BOOTSTRAP_JITTER_MS = 5_000;
const EXEC_LEASE_TTL_MS = 30_000;
const BOOTSTRAP_LOCK_KEY = "USER_TASK_BOOTSTRAP_LOCK";
const BOOTSTRAP_LOCK_TTL_MS = 30_000;
// 用户处理并发（不同用户之间并发），默认 20。过大可能增加 Redis / DB 压力。
const TASK_EXEC_CONCURRENCY = 250;
// Local in-process concurrency cap for running user tasks (per instance).
// This prevents starting unbounded work when popping large batches.
const LOCAL_QUEUE_CONCURRENCY = 250;
let _activeLocalTasks = 0;
function leaseKey(u: string) {
  return `user_task_lease:${u}`;
}

// Use wall-clock time for scheduling. Using `performance.now()` caused
// issues when the host suspended (sleep); `performance.now()` is paused
// during suspend which made `nowMs()` lag behind other producers that use
// `Date.now()`, producing multi-hour scheduling delays after long sleeps.
const nowMs = () => Date.now();

// Lua：弹出到期用户
const POP_LUA = `
local zset = KEYS[1]
local now = ARGV[1]
local limit = tonumber(ARGV[2])
local arr = redis.call('ZRANGEBYSCORE', zset, '-inf', now, 'LIMIT', 0, limit)
-- Remove all popped members in a single call to reduce command overhead
if #arr > 0 then
  local _unpack = unpack or table.unpack
  redis.call('ZREM', zset, _unpack(arr))
end
return arr
`;

async function popDue(now: number): Promise<string[]> {
  try {
    // @ts-ignore
    const res: string[] = await redisClient.EVAL(POP_LUA, {
      keys: [DUE_ZSET],
      arguments: [String(now), String(POP_LIMIT)],
    });
    return res || [];
  } catch (e) {
    console.error("popDue error", e);
    return [];
  }
}

async function schedule(userUuid: string, nextAt: number | null) {
  if (nextAt == null) return;
  try {
    await redisClient.ZADD(DUE_ZSET, { score: nextAt, value: userUuid });
    // If the next run time is very close, proactively wake a blocked scheduler
    // try {
    //   if (nextAt <= Date.now() + 500) {
    //     // Best-effort wake: LPUSH a token so a BRPOP waiter wakes up immediately
    //     await redisClient.LPUSH(WAKE_LIST, "w");
    //   }
    // } catch (e) {
    //   // Non-fatal: continue even if wake fails
    // }
  } catch (e) {
    console.error("schedule error", userUuid, e);
  }
}

/* 轻量全局缓存 */
const GLOBAL_TTL_MS = Math.max(10000, Number(process.env.VILLAGE_GLOBAL_TTL_MS || 60000));
let globalBuildings: { type: any; level: number }[] = [];
let globalExpire = 0;
async function ensureGlobal() {
  const now = nowMs();
  if (now < globalExpire) return;
  try {
    const rows = await prisma.villageBuilding.findMany({
      select: { type: true, level: true, extra: true },
      where: { 
        status: {
          in: [VillageBuildingStatus.NORMAL, VillageBuildingStatus.UPGRADING, VillageBuildingStatus.PREPARE_UPGRADE]
        }
      },
    });
    globalBuildings = rows.map((r) => ({ type: r.type, level: r.level, extra: r.extra })) as any;
    globalExpire = now + GLOBAL_TTL_MS;
  } catch (e) {
    console.error("global refresh fail", e);
    globalExpire = 0;
  }
}

/* 用户数据缓存 */
interface Snap {
  basic?: any;
  status?: CharacterStatusInfo;
  taverns?: Tavern[];
  quests?: Quest[];
  work?: CharacterEquipmentInfo;
  playerGlobalState?: PlayerState
  skillNodes?: LearnedSkillFlatItem[]
}
const snapCache = new Map<string, Snap>();
// 不再使用 TTL：当请求到来时总是刷新对应用户的数据。这样便于广播触发时按需刷新。
async function ensureUsers(uuids: string[]) {
  if (!uuids || !uuids.length) return;

  // 只找到缺失的用户
  const missing = uuids.filter((u) => !snapCache.has(u));
  if (!missing.length) return;
  uuids = missing;

  // 先拿基础信息（轻量），后面根据是否有队列再决定是否拉取重数据
  const basicMap = await batchGetBasicUserInfo(uuids);

  // 判断哪些用户当前有队列（只对这些用户拉取重数据，避免无谓 miss 和日志）
  let withTasks: string[] = [];
  try {
    const firstTaskMap = await getFirstTasks(uuids);
    withTasks = uuids.filter((u) => !!firstTaskMap.get(u));
  } catch {
    // 如果获取失败，回退为全部（不会影响正确性，只是少了优化）
    withTasks = uuids.slice();
  }

  const [statusMap, tavernMap, questMap, workMap, playerState, skillNodes] = await Promise.all([
    withTasks.length ? getMultiCharacterStatusInfo(withTasks) : Promise.resolve(new Map()),
    withTasks.length ? getMultiUserTalentCats(withTasks) : Promise.resolve(new Map()),
    withTasks.length ? getMultiQuestList(withTasks) : Promise.resolve(new Map()),
    withTasks.length ? getMultiUserWorkEquipment(withTasks) : Promise.resolve(new Map()),
    withTasks.length ? batchGetPlayerGlobalState(withTasks) : Promise.resolve(new Map()),
    withTasks.length ? batchGetAllLearnedSkillTreeNodes(withTasks) : Promise.resolve(new Map())
  ]);

  for (const u of uuids) {
    snapCache.set(u, {
      basic: basicMap.get(u),
      status: statusMap.get(u),
      taverns: (tavernMap.get(u) as any) || [],
      quests: (questMap.get(u) as any) || [],
      work: (workMap.get(u) as any) || ({} as any),
      playerGlobalState: (playerState.get(u) as any) || ({} as PlayerState),
      skillNodes: (skillNodes.get(u) as any) || []
    });
  }

  // console.log(`[snap-cache] refreshed users=${uuids.length}`);
}

const refreshStrategy = {
  basic: async (userUuid: string) => {
    let res = await batchGetBasicUserInfo([userUuid]);
    // console.log(`[snap-cache] refreshed single user=${userUuid} basic`);
    return res.get(userUuid);
  },
  status: async (userUuid: string) => {
    // console.log(`[snap-cache] refreshing single user=${userUuid} status`);
    return await getCharacterStatusInfo(userUuid);
  },
  taverns: async (userUuid: string) => {
    // console.log(`[snap-cache] refreshing single user=${userUuid} taverns`);
    return await getUserTalentCats(userUuid);
  },
  quests: async (userUuid: string) => {
    // console.log(`[snap-cache] refreshing single user=${userUuid} quests`);
    return await getQuestList(userUuid);
  },
  work: async (userUuid: string) => {
    // console.log(`[snap-cache] refreshing single user=${userUuid} work equipment`);
    return await getUserEquipment(userUuid, 'work');
  },
  playerGlobalState: async (userUuid: string) => {
    // console.log(`[snap-cache] refreshing single user=${userUuid} playerGlobalState`);
    return await getPlayerGlobalState(userUuid);
  },
  skillNodes: async (userUuid: string) => {
    // console.log(`[snap-cache] refreshing single user=${userUuid} skillNodes`);
    return await listAllLearnedSkillTreeNodes(userUuid);
  }
} as const;

// 单用户刷新，供广播处理器或外部调用使用
async function refreshSingleUser(u: string, part: keyof Snap) {
  const snap = snapCache.get(u);
  if (!snap) {
    return ensureUsers([u]);
  }

  if (!u) return;
  try {
    const res = await refreshStrategy[part](u);

    snap[part] = res;
    snapCache.set(u, snap);

    // console.log(`[snap-cache] refreshed single user=${u} ${part}`);
  } catch (e) {
    console.error('[snap-cache] refreshSingleUser error', u, e);
  }
}

function computeNextDue(
  userUuid: string,
  firstTask: any,
  now: number,
  actionDuration: number | null
): number | null {
  // 队列为空：不再重新加入调度，由新增任务时 scheduleUserImmediate 负责重新入队
  if (!firstTask) return null;
  if (!firstTask.hasDeductFirstTaskResource) return now; // 立即处理一次扣资源
  if (!firstTask.lastSubtaskDoneTime) return now; // 需要初始化开始时间
  if (actionDuration == null) return now + 1_000;
  const finishAt = firstTask.lastSubtaskDoneTime + actionDuration;
  if (now < finishAt) return finishAt;
  return now; // 已到期，立即执行结算
}

async function loop() {
  // 创建一个用于阻塞等待的专用 Redis 连接，避免阻塞主连接影响其他命令
  // @ts-ignore
  const wakeClient = redisClient.duplicate();
  // @ts-ignore
  await wakeClient.connect();
  // Bootstrap: 拿锁后仅补缺（NX），避免多实例覆盖已有调度
  try {
    const gotLock = await redisClient
      .SET(BOOTSTRAP_LOCK_KEY, "1", { NX: true, PX: BOOTSTRAP_LOCK_TTL_MS } as any)
      .catch(() => null);

    if (gotLock) {
      const keys = await getAllTaskQueueKeysUnsorted(); // 返回 TASK_QUEUE_<uuid>
      if (keys.length) {
        console.log(`[scheduler-bootstrap] start, queues=${keys.length}`);
        const now = nowMs();
        for (let i = 0; i < keys.length; i += BOOTSTRAP_BATCH) {
          const slice = keys.slice(i, i + BOOTSTRAP_BATCH);
          const pipeline = redisClient.multi();
          slice.forEach((k) => {
            const uuid = k.replace(/^TASK_QUEUE_/, "");
            const jitter = Math.floor(Math.random() * BOOTSTRAP_JITTER_MS);
            // NX：只补缺，不覆盖已有 score；仍加 jitter 分散首次调度
            pipeline.ZADD(DUE_ZSET, { score: now + jitter, value: uuid }, {
              condition: "NX"
            });
          });
          await pipeline.exec();
        }
        console.log("[scheduler-bootstrap] done");
      } else {
        console.log("[scheduler-bootstrap] no queues found, skip");
      }
    }
  } catch (e) {
    console.error("[scheduler-bootstrap] error", e);
  }

  let running = true;
  process.on("SIGINT", () => (running = false));
  process.on("SIGTERM", () => (running = false));

  while (running) {
    const now = nowMs();
    const dueUsers = await popDue(now);
    if (!dueUsers.length) {
      // 计算下一个最早的，并基于此进行阻塞等待（或被唤醒）
      const next = await redisClient.ZRANGE_WITHSCORES(DUE_ZSET, 0, 0);
      if (next.length) {
        const rawWait = Math.min(
          MAX_WAIT,
          Math.max(20, next[0].score - nowMs())
        );
        const wait = Math.min(rawWait, IDLE_SLICE_MAX);
        await new Promise(r => setTimeout(r, wait));
      } else {
        await new Promise(r => setTimeout(r, EMPTY_WAIT));
      }
      continue;
    }

    await ensureGlobal();
    await ensureUsers(dueUsers);
    const firstTaskMap = await getFirstTasks(dueUsers);

    // 分批并发处理 dueUsers，全部处理完后统一批量 schedule
    const handleUser = async (u: string): Promise<{ userUuid: string; nextAt: number | null }> => {
      const batchNow = nowMs();
      try {
        const isFishing = await redisClient.SISMEMBER('FISHING_ACTIVE_ACTOR_UUIDS', u).catch(() => 0 as any);
        if (Number(isFishing) === 1) {
          return { userUuid: u, nextAt: batchNow + 60_000 };
        }
      } catch (e) {}

      const snap = snapCache.get(u) || {};
      const basic = snap.basic;
      if (!basic) {
        return { userUuid: u, nextAt: batchNow + 5_000 };
      }
      if (basic.is_banned) return { userUuid: u, nextAt: null };
      const lastOnline = basic.last_online_date?.getTime() || 0;
      const offlineMax = MAX_OFFLINE_HOUR * 3600 * 1000;
      if (!lastOnline || batchNow - lastOnline > offlineMax) {
        return { userUuid: u, nextAt: batchNow + 60_000 };
      }

      const firstTask = firstTaskMap.get(u) || null;
      let tasks: any[] = [];
      if (firstTask) tasks = [firstTask];

      let duration: number | null = null;
      if (
        firstTask &&
        firstTask.hasDeductFirstTaskResource &&
        firstTask.lastSubtaskDoneTime
      ) {
        try {
          const res = await getActionDuration(u, firstTask.actionId);
          if (res) duration = res.final;
        } catch {}
      }

      let needRun = false;
      if (!firstTask) needRun = false;
      else if (!firstTask.hasDeductFirstTaskResource) needRun = true;
      else if (!firstTask.lastSubtaskDoneTime) needRun = true;
      else if (
        duration != null &&
        nowMs() >= firstTask.lastSubtaskDoneTime + duration
      ) needRun = true;

      if (needRun) {
        try {
          tasks = await getTaskQueueInRedis(u);
        } catch (e) { tasks = tasks || []; }
        const got = await redisClient
          .SET(leaseKey(u), "1", { NX: true, PX: EXEC_LEASE_TTL_MS } as any)
          .catch(() => null);
        if (!got) {
          return { userUuid: u, nextAt: nowMs() + 300 };
        }
        try {
          await runUserTask(u, {
            userTavern: snap.taverns || [],
            userCharacterStatus: snap.status as any,
            userTasks: tasks,
            userQuests: snap.quests || [],
            villageBuildingInfo: globalBuildings as any,
            workEquipment: snap.work || ({} as any),
            userBasicInfo: basic,
            playerState: snap.playerGlobalState || ({} as PlayerState),
            skillNodes: snap.skillNodes || []
          });
        } catch (e) {
          console.error("runUserTask error", u, e);
        } finally {
          await redisClient.DEL(leaseKey(u)).catch(() => {});
        }
      }

      const updatedFirst = needRun ? await getFirstTask(u) : tasks[0];
      let next = computeNextDue(u, updatedFirst, nowMs(), duration);
      if (
        updatedFirst &&
        updatedFirst.currentRepeat >= updatedFirst.repeatCount
      ) {
        next = nowMs() + 2_000;
      }
      return { userUuid: u, nextAt: next };
    };

    if (TASK_EXEC_CONCURRENCY <= 1 || dueUsers.length <= 1) {
      const results: { userUuid: string; nextAt: number | null }[] = [];
      for (const u of dueUsers) results.push(await handleUser(u));
      if (results.length) {
        const pipeline = redisClient.multi();
        for (const r of results) if (r.nextAt != null) pipeline.ZADD(DUE_ZSET, { score: r.nextAt, value: r.userUuid });
        await pipeline.exec();
      }
    } else {
      for (let i = 0; i < dueUsers.length; i += TASK_EXEC_CONCURRENCY) {
        const slice = dueUsers.slice(i, i + TASK_EXEC_CONCURRENCY);
        const results = await Promise.all(slice.map(u => handleUser(u)));
        const pipeline = redisClient.multi();
        for (const r of results) if (r.nextAt != null) pipeline.ZADD(DUE_ZSET, { score: r.nextAt, value: r.userUuid });
        await pipeline.exec();
      }
    }
  }
}

await loop().catch((e) => {
  console.error(e);
  process.exit(1);
});
