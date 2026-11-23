import { generateCallback, } from '../utils/game/battle';
import { runBattle } from '../process/runBattle';
import { logger } from '../utils/logger.js';
import { loadUnitStatisticFromRedis, saveUnitStatisticIntoRedis, setGlobalBattleCallbackGenerator } from '~/server/utils/game/battleAction';
import { redisClient } from '../utils/redis';
import { mGetChunked } from '../utils/redisHelpers';
import { listWorldBossRoomListKeys } from '../utils/game/room';
import { alignNextStartAtOrAfter as alignNextStartAtOrAfterBase, alignPrevStartAtOrBefore as alignPrevStartAtOrBeforeBase, createMonotonicNow, createSmartSleep, hashStringToPositive, ScheduleMinHeap } from '../utils/schedulerCore';

// ======================== 常量与基础配置 ========================

// 回合“开始到开始”的固定间隔（ms）
const INTERVAL = 1680;

// 超过该值（ms）视为“慢运行”，会触发延长该房间执行间隔若干次
const LONG_TASK_THRESHOLD_MS = 5000; // 可按需调整
// 对于被判定为慢运行的房间，连续延长执行间隔的次数
const SLOW_STICK_RUNS = 3; // 若干次，按需调整
// 每次延长的额外时间（ms）
const SLOW_EXTRA_MS = 3000; // 将执行间隔延长 3000ms

// 活跃房间发现/同步间隔（ms）
const ROOM_DISCOVERY_INTERVAL = 5000;

// 主循环最小睡眠（ms），避免忙等
const MIN_SLEEP_MS = 50;

// 最大并行战斗执行数量（可选），默认不限制以保持与旧逻辑一致
// 现在写死为无限（受事件循环与单线程约束），如需限制请在代码中修改此常量
const MAX_PARALLEL = Number.MAX_SAFE_INTEGER;

// 单个调度循环中最多提取的 due 房间数量（批量上限）
// 限制过大在高峰会造成长时间集中分配；限制过小会增加循环次数
const DISPATCH_BATCH_LIMIT = 128;

// 相位“分布窗口”（ms）：仅在 [0, PHASE_WINDOW_MS) 内分布相位（而不是 [0, INTERVAL)）
// 默认 400ms，可通过环境变量 BATTLE_PHASE_WINDOW_MS 调整；必须 < INTERVAL
let PHASE_WINDOW_MS = Math.min(800, INTERVAL - 1);

// 调优目标：每个槽平均房间数（可通过环境变量调整）
const TARGET_ROOMS_PER_SLOT = 10;

// 相位粒度（ms）：窗口内的离散步长，默认 20ms（可通过环境变量调整）
let PHASE_STEP_MS = Math.max(5, 20);

// 槽位数（窗口内），可动态调整
let PHASE_SLOTS = Math.max(1, Math.floor(PHASE_WINDOW_MS / PHASE_STEP_MS));

// 最小步长（避免过于精细导致忙等）
const MIN_STEP_MS = 5;
const MAX_STEP_MS = 500;

// 单调时钟（避免系统时钟跳变影响调度）；保持 epoch 对齐，兼容日志/存储
const nowMs = createMonotonicNow();

const ACTIVE_ROOM_STATUSES = new Set(['battling', 'waiting_for_autostart', 'waiting_for_restart', 'go_to_area']);

function parseArgs() {
  const groupArg = process.argv.find(arg => arg.startsWith('--group='));
  const groupCountArg = process.argv.find(arg => arg.startsWith('--groupCount='));
  const group = groupArg ? parseInt(groupArg.split('=')[1], 10) : 0;
  const groupCount = groupCountArg ? parseInt(groupCountArg.split('=')[1], 10) : 1;
  return { group, groupCount };
}

const { group, groupCount } = parseArgs();
logger.info(`WorldBossScheduler start: group=${group}/${groupCount}`);

// ======================== 类型与数据结构 ========================

interface BattleSchedule {
  roomUuid: string;
  phaseMs: number;
  nextScheduledStartMs: number;
  running: boolean;
  lastScheduledStartMs?: number;
  markRemoved?: boolean;
  slowRunsRemaining?: number;
}

const battleSchedules = new Map<string, BattleSchedule>();
const roomAvgDuration = new Map<string, number>();

const heap = new ScheduleMinHeap<BattleSchedule>((roomUuid) => battleSchedules.get(roomUuid));

function computePhaseMs(roomUuid: string): number {
  const slot = hashStringToPositive(roomUuid) % PHASE_SLOTS;
  return slot * PHASE_STEP_MS;
}

function alignNextStartAtOrAfter(now: number, phaseMs: number): number {
  return alignNextStartAtOrAfterBase(now, phaseMs, INTERVAL);
}

function alignPrevStartAtOrBefore(now: number, phaseMs: number): number {
  return alignPrevStartAtOrBeforeBase(now, phaseMs, INTERVAL);
}

// ======================== 活跃房间增量扫描 ========================

const knownActiveRooms = new Set<string>();

async function refreshKnownActiveRooms(): Promise<Set<string>> {
  const listKeys = await listWorldBossRoomListKeys();
  if (!Array.isArray(listKeys) || listKeys.length === 0) {
    knownActiveRooms.clear();
    return knownActiveRooms;
  }

  const roomKeys: string[] = [];
  for (const listKey of listKeys) {
    const members = await redisClient.sMembers(listKey);
    if (Array.isArray(members) && members.length) roomKeys.push(...members);
  }

  if (roomKeys.length === 0) {
    knownActiveRooms.clear();
    return knownActiveRooms;
  }

  const uniqueKeys = Array.from(new Set(roomKeys));
  const roomsData = await mGetChunked(redisClient, uniqueKeys, 256);

  knownActiveRooms.clear();
  for (let i = 0; i < roomsData.length; i++) {
    const data = roomsData[i];
    if (!data) continue;

    let room: any;
    try {
      room = JSON.parse(data as string);
    } catch (_) {
      continue;
    }
    const uuid = room?.uuid;
    if (!uuid) continue;
    if (room?.battleType !== 'worldBoss' || !room?.worldBossId) continue;
    if (ACTIVE_ROOM_STATUSES.has(room.status)) {
      knownActiveRooms.add(uuid);
    }
  }

  return knownActiveRooms;
}

// ======================== 可打断睡眠 + 运行计数 + 指标 ========================

let running = true;
let runningCount = 0; // 当前运行中的战斗数量

const { sleep: smartSleep, wake } = createSmartSleep();

const metrics = {
  windowStart: nowMs(),
  totalRuns: 0,
  startedLateCount10: 0,
  startedLateCount50: 0,
  maxStartLagMs: 0,
  sumStartLagMs: 0,
  sumDurationMs: 0,
  rooms: 0,
  heapSize: 0,
  runningCount: 0,
  phaseWindow: PHASE_WINDOW_MS,
  phaseStep: PHASE_STEP_MS,
  phaseSlots: PHASE_SLOTS,
  dispatchBatch: 0,
  dispatchBacklog: 0,
  maxParallel: MAX_PARALLEL,
};

function resetWindowMetrics() {
  metrics.windowStart = nowMs();
  metrics.totalRuns = 0;
  metrics.startedLateCount10 = 0;
  metrics.startedLateCount50 = 0;
  metrics.maxStartLagMs = 0;
  metrics.sumStartLagMs = 0;
  metrics.sumDurationMs = 0;
}

function dumpMetrics() {
  const now = nowMs();
  const elapsedSec = Math.max(1, (now - metrics.windowStart) / 1000);
  const rps = (metrics.totalRuns / elapsedSec).toFixed(1);
  const avgStartLag = metrics.totalRuns ? (metrics.sumStartLagMs / metrics.totalRuns).toFixed(2) : '0';
  const avgDuration = metrics.totalRuns ? (metrics.sumDurationMs / metrics.totalRuns).toFixed(2) : '0';
  logger.info(
    `[WorldBossSched][group=${group}] rooms=${metrics.rooms}, heap=${metrics.heapSize}, running=${metrics.runningCount}, ` +
    `rps=${rps}, avgLagMs=${avgStartLag}, maxLagMs=${metrics.maxStartLagMs}, >10ms=${metrics.startedLateCount10}, >50ms=${metrics.startedLateCount50}, ` +
    `avgRunMs=${avgDuration}, phaseWindow=${metrics.phaseWindow}, step=${metrics.phaseStep}, slots=${metrics.phaseSlots}, batch=${metrics.dispatchBatch}, backlog=${metrics.dispatchBacklog}, maxParallel=${metrics.maxParallel}`
  );
  resetWindowMetrics();
}

// ======================== 外部接口与初始化 ========================

async function getMyActiveRooms(): Promise<string[]> {
  const activeList = Array.from(knownActiveRooms).sort();
  const total = activeList.length;
  const groupSize = Math.ceil(total / groupCount);
  const start = group * groupSize;
  const end = group === groupCount - 1 ? total : (group + 1) * groupSize;
  return activeList.slice(start, end);
}

function recomputePhaseConfig(activeCount: number, now: number) {
  const prevStep = PHASE_STEP_MS;
  const prevSlots = PHASE_SLOTS;

  const desiredSlots = Math.max(1, Math.ceil(activeCount / TARGET_ROOMS_PER_SLOT));
  const maxSlots = Math.max(1, Math.floor(PHASE_WINDOW_MS / Math.max(MIN_STEP_MS, 1)));
  const slots = Math.min(desiredSlots, maxSlots);

  let step = Math.max(MIN_STEP_MS, Math.floor(PHASE_WINDOW_MS / slots));
  step = Math.min(MAX_STEP_MS, step);

  const slotsCalc = Math.max(1, Math.floor(PHASE_WINDOW_MS / step));

  if (step === prevStep && slotsCalc === prevSlots) {
    return false;
  }

  PHASE_STEP_MS = step;
  PHASE_SLOTS = slotsCalc;
  for (const roomUuid of battleSchedules.keys()) {
    const sch = battleSchedules.get(roomUuid);
    if (!sch) continue;
    const newPhase = computePhaseMs(roomUuid);
    sch.phaseMs = newPhase;
    sch.nextScheduledStartMs = alignNextStartAtOrAfter(now, newPhase);
    heap.remove(roomUuid);
    if (!sch.running) heap.push(roomUuid);
  }
  metrics.phaseStep = PHASE_STEP_MS;
  metrics.phaseSlots = PHASE_SLOTS;
  metrics.phaseWindow = PHASE_WINDOW_MS;
  logger.info(`Recomputed phase config: step=${PHASE_STEP_MS}ms, slots=${PHASE_SLOTS}, window=${PHASE_WINDOW_MS} (active=${activeCount})`);
  return true;
}

async function updateSchedules() {
  const now = nowMs();
  await refreshKnownActiveRooms();
  const activeRooms = await getMyActiveRooms();
  const activeSet = new Set(activeRooms);

  const phaseChanged = recomputePhaseConfig(activeRooms.length, now);

  let hasAdded = false;
  let hasRemoved = false;
  let hasCorrectedDrift = false;

  for (const [roomUuid, sch] of battleSchedules.entries()) {
    if (!activeSet.has(roomUuid)) {
      hasRemoved = true;
      if (sch.running) {
        sch.markRemoved = true;
        heap.remove(roomUuid);
      } else {
        heap.remove(roomUuid);
        battleSchedules.delete(roomUuid);
        roomAvgDuration.delete(roomUuid);
      }
    }
  }

  for (const roomUuid of activeSet) {
    if (battleSchedules.has(roomUuid)) continue;
    hasAdded = true;
    const phaseMs = computePhaseMs(roomUuid);
    const next = alignNextStartAtOrAfter(now, phaseMs);
    const sch: BattleSchedule = {
      roomUuid,
      phaseMs,
      nextScheduledStartMs: next,
      running: false,
    };
    battleSchedules.set(roomUuid, sch);
    heap.push(roomUuid);
    wake();
  }

  for (const roomUuid of activeSet) {
    const sch = battleSchedules.get(roomUuid);
    if (!sch || sch.running) continue;
    if (sch.nextScheduledStartMs < now - INTERVAL) {
      sch.nextScheduledStartMs = alignNextStartAtOrAfter(now, sch.phaseMs);
      heap.update(roomUuid);
      wake();
      hasCorrectedDrift = true;
    }
  }

  if (!hasAdded && !hasRemoved && !hasCorrectedDrift && !phaseChanged) {
    metrics.rooms = battleSchedules.size;
    metrics.heapSize = heap.size();
    metrics.runningCount = runningCount;
    return;
  }

  metrics.rooms = battleSchedules.size;
  metrics.heapSize = heap.size();
  metrics.runningCount = runningCount;
}

// ======================== 调度与执行 ========================

async function runBattleInWorker(roomUuid: string): Promise<void> {
  try {
    await runBattle(roomUuid);
    return;
  } catch (err: any) {
    throw err;
  }
}

async function dispatchDueBattles() {
  const nowStart = nowMs();
  const due: string[] = [];

  let now = nowStart;
  while (heap.size() > 0 && due.length < DISPATCH_BATCH_LIMIT) {
    const room = heap.peekRoom();
    if (!room) break;
    const sch = battleSchedules.get(room);
    if (!sch) { heap.pop(); continue; }
    if (now < sch.nextScheduledStartMs || sch.running) break;
    heap.pop();
    due.push(room);

    if ((due.length & 31) === 0) now = nowMs();
  }

  if (due.length === 0) {
    metrics.heapSize = heap.size();
    metrics.runningCount = runningCount;
    metrics.dispatchBatch = 0;
    metrics.dispatchBacklog = 0;
    return;
  }

  const availableSlots = Math.max(0, MAX_PARALLEL - runningCount);
  let willStart = due;
  let backlog: string[] = [];
  if (availableSlots < due.length) {
    willStart = due.slice(0, availableSlots);
    backlog = due.slice(availableSlots);
    for (const roomUuid of backlog) {
      const sch = battleSchedules.get(roomUuid);
      if (sch && !sch.running) {
        heap.push(roomUuid);
      }
    }
  }

  metrics.dispatchBatch = willStart.length;
  metrics.dispatchBacklog = backlog.length;

  for (const roomUuid of willStart) {
    const sch = battleSchedules.get(roomUuid);
    if (!sch) continue;
    const scheduledStart = sch.nextScheduledStartMs;
    sch.lastScheduledStartMs = scheduledStart;
    sch.running = true;
    runningCount++;
    const actualStart = nowMs();
    const startLagMs = Math.max(0, actualStart - scheduledStart);
    metrics.totalRuns++;
    metrics.sumStartLagMs += startLagMs;
    metrics.maxStartLagMs = Math.max(metrics.maxStartLagMs, startLagMs);
    if (startLagMs > 10) metrics.startedLateCount10++;
    if (startLagMs > 50) metrics.startedLateCount50++;

    runBattleInWorker(roomUuid)
      .catch(err => {
        console.error(err);
        logger.error(`[WorldBossRun][ERROR] room=${roomUuid} error=`, err);
      })
      .finally(() => {
        const endNow = nowMs();
        const durationMs = Math.max(0, endNow - actualStart);
        metrics.sumDurationMs += durationMs;
        try {
          const alpha = 0.2;
          const prev = roomAvgDuration.get(roomUuid) ?? durationMs;
          const next = alpha * durationMs + (1 - alpha) * prev;
          roomAvgDuration.set(roomUuid, next);
        } catch (_) {}
        try {
          if (durationMs >= LONG_TASK_THRESHOLD_MS) {
            const s = battleSchedules.get(roomUuid);
            if (s) {
              s.slowRunsRemaining = SLOW_STICK_RUNS;
              logger.info(`[WorldBossOffload][MARK] room=${roomUuid} lastDuration=${durationMs}ms -> extend interval by ${SLOW_EXTRA_MS}ms for ${SLOW_STICK_RUNS} runs`);
            }
          }
        } catch (_) {}
        const current = battleSchedules.get(roomUuid);
        if (!current || sch.markRemoved) {
          battleSchedules.delete(roomUuid);
          runningCount = Math.max(0, runningCount - 1);
          wake();
          return;
        }
        sch.running = false;
        runningCount = Math.max(0, runningCount - 1);
        const last = sch.lastScheduledStartMs ?? alignPrevStartAtOrBefore(endNow, sch.phaseMs);
        const missed = Math.max(1, Math.ceil((endNow - last) / INTERVAL));
        sch.nextScheduledStartMs = last + missed * INTERVAL;
        try {
          if (sch.slowRunsRemaining && sch.slowRunsRemaining > 0) {
            sch.slowRunsRemaining = Math.max(0, (sch.slowRunsRemaining ?? 0) - 1);
            sch.nextScheduledStartMs += SLOW_EXTRA_MS;
            logger.info(`[WorldBossOffload][SLOW] room=${roomUuid} delayed next start by ${SLOW_EXTRA_MS}ms, remaining=${sch.slowRunsRemaining}`);
          }
        } catch (_) {}
        heap.push(roomUuid);
        wake();
      });
  }

  metrics.heapSize = heap.size();
  metrics.runningCount = runningCount;

  if (metrics.dispatchBacklog > 0) {
    wake();
  }
}

// ======================== 健康检查与关停 ========================

function anyScheduleRunning(): boolean {
  for (const s of battleSchedules.values()) {
    if (s.running) return true;
  }
  return false;
}

function cleanupStuckBattles() {
  const now = nowMs();
  const stuckThreshold = 5 * 60 * 1000; // 5 分钟
  for (const sch of battleSchedules.values()) {
    if (sch.running && sch.lastScheduledStartMs && (now - sch.lastScheduledStartMs) > stuckThreshold) {
      logger.warn(`Resetting stuck world-boss battle for room ${sch.roomUuid}`);
      sch.running = false;
      sch.nextScheduledStartMs = alignNextStartAtOrAfter(now, sch.phaseMs);
      heap.update(sch.roomUuid);
      wake();
    }
  }
}

async function gracefulShutdown() {
  running = false;
  logger.info(`WorldBoss process ${group} shutting down...`);

  const shutdownStart = nowMs();
  while (anyScheduleRunning()) {
    if (nowMs() - shutdownStart > 30000) {
      logger.warn(`Force shutdown after 30s`);
      break;
    }
    await smartSleep(1000);
  }

  try {
    await saveUnitStatisticIntoRedis(group, redisClient);
    logger.info(`Process ${group} data saved`);
  } catch (error: any) {
    logger.error(`Failed to save data:`, error);
  }

  try {
    // await flushPendingBattleInfoWrites('shutdown');
  } catch (error: any) {
    logger.error('flushPendingBattleInfoWrites failed during shutdown', error);
  }

  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// ======================== 主循环 ========================

async function main() {
  try {
    await loadUnitStatisticFromRedis(group, redisClient);
    setGlobalBattleCallbackGenerator((battleInfo) => generateCallback(battleInfo, {}));
    await updateSchedules();
    logger.info(`WorldBoss process ${group} initialized with ${battleSchedules.size} rooms; phaseWindow=${PHASE_WINDOW_MS}ms, step=${PHASE_STEP_MS}ms, slots=${PHASE_SLOTS}`);
  } catch (error: any) {
    logger.error(`Initialization failed:`, error);
    process.exit(1);
  }

  let lastDiscovery = nowMs();
  let lastMetricLog = nowMs();

  while (running) {
    const loopStart = nowMs();

    try {
      await dispatchDueBattles();

      if (loopStart - lastDiscovery >= ROOM_DISCOVERY_INTERVAL) {
        await updateSchedules();
        lastDiscovery = nowMs();
      }

      if ((loopStart % 60000) < 10) {
        cleanupStuckBattles();
      }

      if (loopStart - lastMetricLog >= 60000) {
        // dumpMetrics();
        lastMetricLog = loopStart;
      }
    } catch (error: any) {
      logger.error(`Main loop error:`, error);
    }

    const earliest = heap.peekTime();
    const now = nowMs();
    let sleepMs: number;

    if (earliest != null) {
      const timeToEarliest = Math.max(0, (earliest - now) - 1);
      const wakeByPlan = timeToEarliest <= MIN_SLEEP_MS ? Math.max(1, timeToEarliest) : Math.max(MIN_SLEEP_MS, timeToEarliest);
      const wakeByDiscovery = Math.max(MIN_SLEEP_MS, ROOM_DISCOVERY_INTERVAL - (now - lastDiscovery));
      sleepMs = Math.min(wakeByPlan, wakeByDiscovery);
    } else if (runningCount > 0 || anyScheduleRunning()) {
      sleepMs = Math.max(MIN_SLEEP_MS, PHASE_STEP_MS);
    } else {
      sleepMs = Math.max(MIN_SLEEP_MS, ROOM_DISCOVERY_INTERVAL - (now - lastDiscovery));
    }

    await smartSleep(sleepMs);
  }
}

await main().catch(async error => {
  logger.error(`Fatal error:`, error);
  try {
    // await flushPendingBattleInfoWrites('fatal');
  } catch (e: any) {
    logger.error('flushPendingBattleInfoWrites failed on fatal error', e);
  }
  process.exit(1);
});
