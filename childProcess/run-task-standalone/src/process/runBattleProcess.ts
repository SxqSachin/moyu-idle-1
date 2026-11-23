/**
 * 战斗调度优化版（开始到开始固定间隔 + 错峰 + 低 CPU）
 *
 * 核心变化（本次改动）：
 * - 将相位分布限制到“400ms 窗口”内（默认 400ms，可改），而非分布在整个 1680ms。
 *   这样每个 INTERVAL 内只在前 400ms 范围内分散启动，大幅降低 10~20ms 级别的频繁唤醒次数。
 * - 每个战斗仍严格以“开始到开始”的 INTERVAL=1680ms 作为时间线锚点，不以结束时间推进。
 * - 仍使用“最小堆 + 动态睡眠 + 可打断睡眠”，在多房间时保持较低 CPU。
 *
 * 可调参数（环境变量）：
 * - BATTLE_PHASE_WINDOW_MS（默认 400）：相位分布窗口，建议 200~600。
 * - BATTLE_PHASE_STEP_MS（默认 20）：窗口内相位粒度，决定窗口内分散的细度。
 */

import { dumpAllLocalMemoryBattleInfoToRedis, generateCallback, loadAllBattleInfoFromRedisToMemory } from '../utils/game/battle';
import { cleanupMsgQueueMemory } from '../utils/game/msgQueue';
import { runBattle } from '../process/runBattle';
// 仍保留对池的 init 调用以便未来扩展，但不再把慢房间 offload 到 worker。
import { logger } from '../utils/logger.js'
import { loadUnitStatisticFromRedis, saveUnitStatisticIntoRedis, setGlobalBattleCallbackGenerator } from '~/server/utils/game/battleAction';
import { redisClient } from '../utils/redis'
import { mGetChunked } from '../utils/redisHelpers'
import { alignNextStartAtOrAfter as alignNextStartAtOrAfterBase, alignPrevStartAtOrBefore as alignPrevStartAtOrBeforeBase, createMonotonicNow, createSmartSleep, hashStringToPositive, ScheduleMinHeap } from '../utils/schedulerCore';

// ======================== 常量与基础配置 ========================

// 回合“开始到开始”的固定间隔（ms）
const INTERVAL = 1880;

// 超过该值（ms）视为“慢运行”，会触发延长该房间执行间隔若干次
const LONG_TASK_THRESHOLD_MS = 5000; // 可按需调整
// 对于被判定为慢运行的房间，连续延长执行间隔的次数
const SLOW_STICK_RUNS = 3; // 若干次，按需调整
// 每次延长的额外时间（ms）
const SLOW_EXTRA_MS = 3000; // 将执行间隔延长 3000ms

// 主循环最小睡眠（ms），避免忙等
const MIN_SLEEP_MS = 50;

// 最大并行战斗执行数量（可选），默认不限制以保持与旧逻辑一致
// 现在写死为无限（受事件循环与单线程约束），如需限制请在代码中修改此常量
const MAX_PARALLEL = Number.MAX_SAFE_INTEGER;

// 单个调度循环中最多提取的 due 房间数量（批量上限）
// 限制过大在高峰会造成长时间集中分配；限制过小会增加循环次数
const DISPATCH_BATCH_LIMIT = 128;

// 当存在并行限制时，如果 backlog（待执行 due 房间）未能全部启动，下一轮会被立即唤醒；
// backlog 过大说明 MAX_PARALLEL 可能偏小或单回合耗时过长。

// 相位“分布窗口”（ms）：仅在 [0, PHASE_WINDOW_MS) 内分布相位（而不是 [0, INTERVAL)）
// 默认 400ms，可通过环境变量 BATTLE_PHASE_WINDOW_MS 调整；必须 < INTERVAL
const DEFAULT_PHASE_WINDOW_MS = 400;
const MIN_PHASE_WINDOW_MS = 50;
const envPhaseWindow = Number(process.env.BATTLE_PHASE_WINDOW_MS);
let PHASE_WINDOW_MS = Math.max(
  MIN_PHASE_WINDOW_MS,
  Math.min(
    Number.isFinite(envPhaseWindow) && envPhaseWindow > 0 ? envPhaseWindow : DEFAULT_PHASE_WINDOW_MS,
    INTERVAL - 1
  )
);

// 调优目标：每个槽平均房间数（可通过环境变量调整）
const TARGET_ROOMS_PER_SLOT = 10;

// 最小步长/最大步长（避免过于精细导致忙等）
const MIN_STEP_MS = 5;
const MAX_STEP_MS = 500;

// 相位粒度（ms）：窗口内的离散步长，默认 20ms（可通过环境变量 BATTLE_PHASE_STEP_MS 调整）
const envPhaseStep = Number(process.env.BATTLE_PHASE_STEP_MS);
let PHASE_STEP_MS = Math.max(
  MIN_STEP_MS,
  Number.isFinite(envPhaseStep) && envPhaseStep > 0 ? Math.min(envPhaseStep, MAX_STEP_MS) : 20
);

// 槽位数（窗口内），可动态调整
let PHASE_SLOTS = Math.max(1, Math.floor(PHASE_WINDOW_MS / PHASE_STEP_MS));

// 单调时钟（避免系统时钟跳变影响调度）；保持 epoch 对齐，兼容日志/存储
const nowMs = createMonotonicNow();

/** 根据当前活跃房间数动态计算 phase step/slots，以保持每槽大约 TARGET_ROOMS_PER_SLOT */
function recomputePhaseConfig(activeCount: number, now: number) {
  const prevStep = PHASE_STEP_MS;
  const prevSlots = PHASE_SLOTS;

  // 理想槽位数
  const desiredSlots = Math.max(1, Math.ceil(activeCount / TARGET_ROOMS_PER_SLOT));
  // 限制最大槽位由窗口与最小步长决定
  const maxSlots = Math.max(1, Math.floor(PHASE_WINDOW_MS / Math.max(MIN_STEP_MS, 1)));
  const slots = Math.min(desiredSlots, maxSlots);

  // 计算步长（向下取整以便整除），并 clamp 到合理范围
  let step = Math.max(MIN_STEP_MS, Math.floor(PHASE_WINDOW_MS / slots));
  step = Math.min(MAX_STEP_MS, step);

  const slotsCalc = Math.max(1, Math.floor(PHASE_WINDOW_MS / step));

  if (step === prevStep && slotsCalc === prevSlots) {
    return false;
  }

  PHASE_STEP_MS = step;
  PHASE_SLOTS = slotsCalc;
  // 优化：仅重分配非运行房间，避免频繁重建堆
  for (const roomUuid of battleSchedules.keys()) {
    const sch = battleSchedules.get(roomUuid);
    if (!sch || sch.running) continue;
    // 重新计算相位
    const newPhase = computePhaseMs(roomUuid);
    sch.phaseMs = newPhase;
    // 对齐 nextScheduledStartMs 到未来最近的档位
    sch.nextScheduledStartMs = alignNextStartAtOrAfter(now, newPhase);
    // 更新堆
    heap.update(roomUuid);
  }
  metrics.phaseStep = PHASE_STEP_MS;
  metrics.phaseSlots = PHASE_SLOTS;
  metrics.phaseWindow = PHASE_WINDOW_MS;
  return true;
}



// args: 进程分片
function parseArgs() {
  const groupArg = process.argv.find(arg => arg.startsWith('--group='));
  const groupCountArg = process.argv.find(arg => arg.startsWith('--groupCount='));
  const group = groupArg ? parseInt(groupArg.split('=')[1], 10) : 0;
  const groupCount = groupCountArg ? parseInt(groupCountArg.split('=')[1], 10) : 9;
  return { group, groupCount };
}
const { group, groupCount } = parseArgs();

// ============== 房间事件（离开）订阅，跨分片快速处理 ==============
const ROOM_LEAVE_CHANNEL = 'BATTLE_ROOM_LEAVE';
const ROOM_EVENT_CHANNEL = 'BATTLE_ROOM_EVENT';
let schedulesDirty = false;

function belongsToMe(roomUuid: string): boolean {
  return (hashStringToPositive(roomUuid) % Math.max(1, groupCount)) === group;
}

async function setupRoomSubscribers() {
  try {
    const sub = redisClient.duplicate();
    await sub.connect();
    await sub.subscribe(ROOM_LEAVE_CHANNEL, async (message: string) => {
      try {
        const evt = JSON.parse(message || '{}') as { roomId?: string; userId?: string; ts?: number };
        const roomUuid = evt.roomId;
        if (!roomUuid || typeof roomUuid !== 'string') return;

        // 仅在本分片负责该房间时进行一次加速处理
        if (belongsToMe(roomUuid)) {
          // logger.info(`[RoomLeaveEvent][group=${group}] room=${roomUuid} user=${evt.userId ?? ''} ts=${evt.ts ?? ''}`);
          expediteRoomSchedule(roomUuid);
        }
      } catch (_) {
        // ignore malformed message
      }
    });

    await sub.subscribe(ROOM_EVENT_CHANNEL, async (message: string) => {
      try {
        const evt = JSON.parse(message || '{}') as { type?: string; roomId?: string; status?: string; battleType?: string };
        if (!evt?.roomId) return;
        // logger.info(`[RoomEvent][group=${group}] type=${evt.type ?? ''} room=${evt.roomId} status=${evt.status ?? ''} battleType=${evt.battleType ?? ''}`);
        handleRoomEvent(evt);
      } catch (_) {}
    });
  } catch (e) {
    console.error('[RoomLeaveSubscriber] setup failed:', e);
  }
}

function handleRoomEvent(evt: { type?: string; roomId?: string; status?: string; battleType?: string }) {
  const roomUuid = evt.roomId;
  if (!roomUuid) return;
  if (evt.battleType === 'worldBoss' && evt.type !== 'remove') return; // world boss handled elsewhere

  const isActive = ACTIVE_ROOM_STATUSES.has(evt.status ?? '');
  if (evt.type === 'remove') {
    knownActiveRooms.delete(roomUuid);
    schedulesDirty = true;
    // logger.info(`[RoomEvent][remove][group=${group}] room=${roomUuid}`);
    wake();
    return;
  }

  if (evt.type === 'upsert') {
    if (isActive) {
      knownActiveRooms.add(roomUuid);
      if (belongsToMe(roomUuid)) {
        // logger.info(`[RoomEvent][upsert][group=${group}] room=${roomUuid} active=1`);
        expediteRoomSchedule(roomUuid);
      }
    } else {
      knownActiveRooms.delete(roomUuid);
      // logger.info(`[RoomEvent][upsert][group=${group}] room=${roomUuid} active=0`);
    }
    schedulesDirty = true;
    wake();
  }
}

function expediteRoomSchedule(roomUuid: string) {
  try {
    const now = nowMs();
    let sch = battleSchedules.get(roomUuid);
    if (!sch) {
      // 若不在调度表但房间活跃，补登记并立即调度一次
      if (!knownActiveRooms.has(roomUuid)) return;
      const phaseMs = computePhaseMs(roomUuid);
      sch = {
        roomUuid,
        phaseMs,
        nextScheduledStartMs: Math.max(0, now - 1),
        running: false,
      };
      battleSchedules.set(roomUuid, sch);
      heap.push(roomUuid);
      wake();
      return;
    }
    if (!sch.running) {
      sch.nextScheduledStartMs = Math.min(sch.nextScheduledStartMs, Math.max(0, now - 1));
      heap.update(roomUuid);
      wake();
    }
  } catch (_) {
    // noop
  }
}

// ======================== 类型与数据结构 ========================

/**
 * 单房间调度信息
 * - 所有调度锚定在“相位 + k*INTERVAL”的时间线上
 * - nextScheduledStartMs 始终表示下一次“计划开始时间”（与结束时间无关）
 */
interface BattleSchedule {
  roomUuid: string;
  phaseMs: number;                 // 稳定相位（位于 [0, PHASE_WINDOW_MS)），按 PHASE_STEP_MS 对齐
  nextScheduledStartMs: number;    // 下一次计划开始时间
  running: boolean;                // 是否正在执行（防重入）
  lastScheduledStartMs?: number;   // 最近一次计划开始时间（记录用）
  markRemoved?: boolean;           // 标记：若在运行中发现该房间非活跃，结束后不再入堆
  // 若 >0，则表示该房间需要在 worker 中执行的剩余次数（每次执行后递减），
  // 直到降为 0 后恢复为正常主线程执行。
  // 若 >0，则表示该房间在接下来的若干次调度中需要延长执行间隔
  slowRunsRemaining?: number;
}

const battleSchedules = new Map<string, BattleSchedule>();

// 每个房间的历史平均执行耗时（ms），使用 EWMA 更新
const roomAvgDuration = new Map<string, number>();

/**
 * Fast check whether any schedule is currently running without allocating intermediate arrays.
 */
function anyScheduleRunning(): boolean {
  for (const s of battleSchedules.values()) {
    if (s.running) return true;
  }
  return false;
}

// 最小堆：按 nextScheduledStartMs 排序，避免 O(N) 扫描
const heap = new ScheduleMinHeap<BattleSchedule>((roomUuid) => battleSchedules.get(roomUuid));

// Worker 池的实现已拆分到 `runBattlePool.ts`。保留池的预热/监控接口，但默认不再把慢房间 offload 到 worker。

/**
 * Run a battle inside a Worker thread to isolate CPU-bound or blocking work
 * from the main scheduler event loop. Returns a Promise that resolves when
 * the worker finishes. Uses `runBattleWorker.ts` which imports and executes
 * the existing `runBattle` logic.
 */
async function runBattleInWorker(roomUuid: string): Promise<void> {
  // 统一在主线程运行战斗；慢房间会被标记为延长下次执行间隔（见调度完成时的处理）。
  // const sch = battleSchedules.get(roomUuid);
  try {
    // 我们不再把慢房间 offload 到 worker（之前发现会降低整体效率）。
    // 统一在主线程执行 runBattle，延长间隔的策略在调度完成处处理。
    await runBattle(roomUuid);

    return;
  } catch (err: any) {
    throw err;
  }
}

// ======================== 工具函数 ========================
/** 计算稳定相位：限制在 [0, PHASE_WINDOW_MS) 内，按 PHASE_STEP_MS 对齐 */
function computePhaseMs(roomUuid: string): number {
  const slot = hashStringToPositive(roomUuid) % PHASE_SLOTS;
  return slot * PHASE_STEP_MS;
}

/** 计算“>= now 的最近计划开始时间”，保持相位不变（每 INTERVAL 重复一次） */
function alignNextStartAtOrAfter(now: number, phaseMs: number): number {
  return alignNextStartAtOrAfterBase(now, phaseMs, INTERVAL);
}

/** “<= now 的上一次计划开始时间”，保持相位 */
function alignPrevStartAtOrBefore(now: number, phaseMs: number): number {
  return alignPrevStartAtOrBeforeBase(now, phaseMs, INTERVAL);
}

// ======================== 活跃房间增量扫描（避免全量遍历） ========================

// 认为是活跃战斗的房间状态
const ACTIVE_ROOM_STATUSES = new Set(['battling', 'waiting_for_autostart', 'waiting_for_restart', 'go_to_area']);
// 进程内缓存的活跃房间集合；避免每 5s 全量扫描 redis
const knownActiveRooms = new Set<string>();
// 上次 SSCAN 游标位置与时间戳，用于切片扫描
let roomScanCursor = '0';
let lastRoomScanTs = 0;
let lastFullSweepTs = 0;
const ROOM_SCAN_BATCH = 512;   // 每批最多扫描 512 个 key，避免阻塞
const ROOM_SCAN_INTERVAL = 1000; // ms，最小扫描间隔，防止过度轮询
const ROOM_FULL_SWEEP_INTERVAL = 6000; // ms，兜底全量扫一圈保证不漏
const MAX_BATCHES_PER_TICK = 4; // 普通增量每次最多扫 4 批
const MAX_BATCHES_FULL = 40;    // 触发全量补扫时的批次数上限

/**
 * 增量刷新活跃房间集合：使用 SSCAN 分批遍历 ALL_ROOM_KEYS，分片执行。
 * - 不再每轮全量扫描；长期运行下 knownActiveRooms 近似保持最新。
 * - 房间下线会在扫到该 key 时被移除（若状态非活跃）。
 * - 若要强制立即全量，可重置 roomScanCursor 为 '0'。
 */
async function refreshKnownActiveRooms(scanAll: boolean = false): Promise<Set<string>> {
  const now = nowMs();
  const needFullSweep = scanAll || (now - lastFullSweepTs >= ROOM_FULL_SWEEP_INTERVAL);

  if (!needFullSweep && (now - lastRoomScanTs < ROOM_SCAN_INTERVAL)) return knownActiveRooms;

  let batches = 0;
  const maxBatches = needFullSweep ? MAX_BATCHES_FULL : MAX_BATCHES_PER_TICK;

  do {
    lastRoomScanTs = nowMs();
    const { cursor, members } = await redisClient.SSCAN('ALL_ROOM_KEYS', roomScanCursor, { COUNT: ROOM_SCAN_BATCH });
    roomScanCursor = cursor;

    if (Array.isArray(members) && members.length > 0) {
      const roomsData = await mGetChunked(redisClient, members, 256);
      for (let i = 0; i < roomsData.length; i++) {
        const key = members[i];
        const data = roomsData[i];

        if (!data) {
          if (key && typeof key === 'string' && key.startsWith('ROOM_')) {
            knownActiveRooms.delete(key.slice('ROOM_'.length));
          }

          console.error(`[runBattleInWorker] no room data for key ${key}`);
          continue;
        }

        let room: any;
        try {
          room = JSON.parse(data as string);
        } catch (e: any) {
          console.error(`[runBattleInWorker] failed to parse room data for key ${key}` + e.message);
          continue;
        }
        const uuid = room?.uuid;

        if (!uuid) continue;
        // 世界Boss房间交由单独进程处理，这里直接跳过
        if (room?.battleType === 'worldBoss') {
          knownActiveRooms.delete(uuid);
          continue;
        }
        if (ACTIVE_ROOM_STATUSES.has(room.status)) {
          knownActiveRooms.add(uuid);
        } else {
          console.error(`[runBattleInWorker] remove inactive room ${uuid} with status ${room.status}`);
          knownActiveRooms.delete(uuid);
        }
      }
    }

    batches++;

    // 若走完整圈或达到批次上限则退出；下一轮再继续
    if (roomScanCursor === '0') {
      lastFullSweepTs = nowMs();
      break;
    }
  } while (batches < maxBatches);

  return knownActiveRooms;
}

/** 启动时全量扫描一次，后续靠事件维护集合 */
async function initialLoadActiveRooms(): Promise<void> {
  await refreshKnownActiveRooms(true);
}

// ======================== 可打断睡眠 + 运行计数 + 指标 ========================

let running = true;
let runningCount = 0; // 当前运行中的战斗数量

const { sleep: smartSleep, wake } = createSmartSleep();

// 基础指标（每 60s 打印一次）
const metrics = {
  windowStart: nowMs(),
  totalRuns: 0,
  startedLateCount10: 0,   // 启动延迟 > 10ms
  startedLateCount50: 0,   // 启动延迟 > 50ms
  maxStartLagMs: 0,
  sumStartLagMs: 0,
  sumDurationMs: 0,
  rooms: 0,
  heapSize: 0,
  runningCount: 0,
  phaseWindow: PHASE_WINDOW_MS,
  phaseStep: PHASE_STEP_MS,
  phaseSlots: PHASE_SLOTS,
  dispatchBatch: 0,          // 本轮批量启动的数量
  dispatchBacklog: 0,        // 本轮未能启动的 due 剩余
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
    `[BattleSched][group=${group}] rooms=${metrics.rooms}, heap=${metrics.heapSize}, running=${metrics.runningCount}, ` +
    `rps=${rps}, avgLagMs=${avgStartLag}, maxLagMs=${metrics.maxStartLagMs}, >10ms=${metrics.startedLateCount10}, >50ms=${metrics.startedLateCount50}, ` +
    `avgRunMs=${avgDuration}, phaseWindow=${metrics.phaseWindow}, step=${metrics.phaseStep}, slots=${metrics.phaseSlots}, batch=${metrics.dispatchBatch}, backlog=${metrics.dispatchBacklog}, maxParallel=${metrics.maxParallel}`
  );
  resetWindowMetrics();
}

// ======================== 外部接口与初始化 ========================

/** 获取当前进程负责的房间（按 group 分片） */
async function getMyActiveRooms(): Promise<string[]> {
  const activeList = Array.from(knownActiveRooms).filter(belongsToMe).sort();
  return activeList;
}

/** 同步/修正调度（增删房间、对齐相位、入堆） */
async function updateSchedules() {
  const now = nowMs();
  const activeRooms = await getMyActiveRooms();
  const activeSet = new Set(activeRooms);

  // 动态调整 phase 配置以适配当前活跃房间数
  const phaseChanged = recomputePhaseConfig(activeRooms.length, now);

  let hasAdded = false;
  let hasRemoved = false;
  let hasCorrectedDrift = false;

  // 移除不再活跃的房间：运行中则标记，结束后不再回堆
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

  // 新增房间：计算相位，并对齐到“>= now 的最近计划开始时间”
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
    // 有新任务入堆，唤醒主循环
    wake();
  }

  // 已在 Map 但未运行、且 nextScheduledStartMs 明显滞后时，进行纠正（防极端漂移）
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

  // 若无新增/移除/漂移纠正且相位未变，直接刷新指标后返回
  if (!hasAdded && !hasRemoved && !hasCorrectedDrift && !phaseChanged) {
    metrics.rooms = battleSchedules.size;
    metrics.heapSize = heap.size();
    metrics.runningCount = runningCount;
    return;
  }

  // 更新可观测指标
  metrics.rooms = battleSchedules.size;
  metrics.heapSize = heap.size();
  metrics.runningCount = runningCount;
}

// ======================== 调度与执行 ========================

/** 核心：按计划开始时间调度（错峰 + 开始到开始固定间隔） */
async function dispatchDueBattles() {
  const nowStart = nowMs();
  const due: string[] = [];

  // 1. 收集当前到期（且不在运行）的房间，限制批量大小
  let now = nowStart;
  while (heap.size() > 0 && due.length < DISPATCH_BATCH_LIMIT) {
    const room = heap.peekRoom();
    if (!room) break;
    const sch = battleSchedules.get(room);
    if (!sch) { heap.pop(); continue; }
    if (now < sch.nextScheduledStartMs || sch.running) break; // 顶部未到期则结束
    heap.pop();
    due.push(room);

    // 若批量很大，适当刷新当前时间以避免长循环导致轻微超时判断
    if ((due.length & 31) === 0) now = nowMs();
  }

  if (due.length === 0) {
    metrics.heapSize = heap.size();
    metrics.runningCount = runningCount;
    metrics.dispatchBatch = 0;
    metrics.dispatchBacklog = 0;
    return;
  }

  // 2. 若设置最大并行限制，则只启动一部分，其余回滚入堆（保持计划时间不变）
  const availableSlots = Math.max(0, MAX_PARALLEL - runningCount);
  let willStart = due;
  let backlog: string[] = [];
  if (availableSlots < due.length) {
    willStart = due.slice(0, availableSlots);
    backlog = due.slice(availableSlots);
    // 未启动的重新放回堆（仍然是已经 due，下一轮会立即再次尝试）
    for (const roomUuid of backlog) {
      const sch = battleSchedules.get(roomUuid);
      if (sch && !sch.running) {
        heap.push(roomUuid);
      }
    }
  }

  metrics.dispatchBatch = willStart.length;
  metrics.dispatchBacklog = backlog.length;

  // 3. 启动任务
  for (const roomUuid of willStart) {
    const sch = battleSchedules.get(roomUuid);
    if (!sch) continue; // 已被移除
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

    // 战斗执行（不 await，保持并行度）
    runBattleInWorker(roomUuid)
      .catch(err => {
        console.error(err)
        logger.error(`[BattleRun][ERROR] room=${roomUuid} error=`, err);
      })
      .finally(() => {
        const endNow = nowMs();
        const durationMs = Math.max(0, endNow - actualStart);
        metrics.sumDurationMs += durationMs;
        // 更新房间历史平均耗时（EWMA）
        try {
          const alpha = 0.2; // EWMA 衰减系数
          const prev = roomAvgDuration.get(roomUuid) ?? durationMs;
          const next = alpha * durationMs + (1 - alpha) * prev;
          roomAvgDuration.set(roomUuid, next);
        } catch (_) {}
        // （已移除常规每次运行的详细打印，避免日志噪音）
        // 若本次耗时超过阈值，则将该房间切换到 worker 模式：在 worker 中运行若干次后再回到普通队列
        try {
          if (durationMs >= LONG_TASK_THRESHOLD_MS) {
            const s = battleSchedules.get(roomUuid);
            if (s) {
              s.slowRunsRemaining = SLOW_STICK_RUNS;
              logger.info(`[BattleOffload][MARK] room=${roomUuid} lastDuration=${durationMs}ms -> will extend interval by ${SLOW_EXTRA_MS}ms for ${SLOW_STICK_RUNS} runs`);
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
        // 若该房间处于慢运行延长模式，则在下次计划上额外延长 SLOW_EXTRA_MS 并递减计数
        try {
          if (sch.slowRunsRemaining && sch.slowRunsRemaining > 0) {
            sch.slowRunsRemaining = Math.max(0, (sch.slowRunsRemaining ?? 0) - 1);
            sch.nextScheduledStartMs += SLOW_EXTRA_MS;
            logger.info(`[BattleOffload][SLOW] room=${roomUuid} delayed next start by ${SLOW_EXTRA_MS}ms, remaining=${sch.slowRunsRemaining}`);
          }
        } catch (_) {}
        heap.push(roomUuid);
        wake();
      });
  }

  metrics.heapSize = heap.size();
  metrics.runningCount = runningCount;

  // 若存在 backlog，快速唤醒主循环以减少延迟
  if (metrics.dispatchBacklog > 0) {
    wake();
  }
}

// ======================== 健康检查与关停 ========================

/** 清理异常卡住的战斗：若运行时间超过阈值，强制重置 */
function cleanupStuckBattles() {
  const now = nowMs();
  const stuckThreshold = 5 * 60 * 1000; // 5 分钟
  for (const sch of battleSchedules.values()) {
    // 简化：仅按“计划开始时间”判断，若运行过久，重置下次计划到最近未来档位
    if (sch.running && sch.lastScheduledStartMs && (now - sch.lastScheduledStartMs) > stuckThreshold) {
      logger.warn(`Resetting stuck battle for room ${sch.roomUuid}`);
      sch.running = false;
      sch.nextScheduledStartMs = alignNextStartAtOrAfter(now, sch.phaseMs);
      heap.update(sch.roomUuid);
      wake();
    }
  }
}

async function gracefulShutdown() {
  running = false;
  console.info(`Process ${group} shutting down...`);

  const shutdownStart = nowMs();
  // 等待在运行的房间结束（最多 30s）
  while (anyScheduleRunning()) {
    if (nowMs() - shutdownStart > 30000) {
      logger.warn(`Force shutdown after 30s`);
      break;
    }
    await smartSleep(1000);
  }

  try {
    await saveUnitStatisticIntoRedis(group, redisClient);
    await dumpAllLocalMemoryBattleInfoToRedis(group + '');
    console.log(`Process ${group} data saved`);
  } catch (error: any) {
    console.error(`Failed to save data:`, error);
  }

  // 清理内存泄漏：Maps, Sets
  try {
    battleSchedules.clear();
    roomAvgDuration.clear();
    knownActiveRooms.clear();
    cleanupMsgQueueMemory();
    console.info(`Process ${group} memory cleanup completed`);
  } catch (error: any) {
    console.error(`Failed to cleanup memory:`, error);
  }

  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// ======================== 主循环（动态睡眠，低 CPU） ========================

async function main() {
  try {
    await loadUnitStatisticFromRedis(group, redisClient);
    await loadAllBattleInfoFromRedisToMemory(group + '')
    setGlobalBattleCallbackGenerator((battleInfo) => generateCallback(battleInfo, {}));
    // 预热 worker 池，减少运行时首次创建延迟
    // try {
    //   await initPool();
    //   try {
    //     const info = getPoolInfo();
    //     logger.info(`Worker pool initialized: total=${info.total}, idle=${info.idle}`);
    //   } catch (_) {}
    // } catch (err: any) {
    //   logger.error('initPool failed:', err);
    // }
    await initialLoadActiveRooms();
    await setupRoomSubscribers();
    schedulesDirty = true;
    await updateSchedules();
    logger.info(`Process ${group} initialized with ${battleSchedules.size} rooms; phaseWindow=${PHASE_WINDOW_MS}ms, step=${PHASE_STEP_MS}ms, slots=${PHASE_SLOTS}`);
  } catch (error: any) {
    console.error(`Initialization failed:`, error);
    process.exit(1);
  }

  console.log(`[BattleSched][group=${group}/${groupCount}] Main loop started.`);

  let lastMetricLog = nowMs();

  while (running) {
    const loopStart = nowMs();

    try {
      // 到点的任务立即调度
      await dispatchDueBattles();

      if (schedulesDirty) {
        await updateSchedules();
        schedulesDirty = false;
      }

      // 健康检查（低频）
      if ((loopStart % 60000) < 10) {
        cleanupStuckBattles();
      }

      // 指标输出（每 60s）
      if (loopStart - lastMetricLog >= 60000) {
        // dumpMetrics();
        lastMetricLog = loopStart;
      }
    } catch (error: any) {
      logger.error(`Main loop error:`, error);
    }

    // 计算睡多久：
    // 1) 若有最近计划时间 -> 睡到它（提前 1ms），与发现间隔取较小
    // 2) 堆空但仍有战斗在跑 -> 短睡（PHASE_STEP_MS）
    // 3) 真正无任务 -> 按发现间隔长睡
    const earliest = heap.peekTime(); // 可能 undefined（无任务）
    const now = nowMs();
    let sleepMs: number;

    if (earliest != null) {
      const timeToEarliest = Math.max(0, (earliest - now) - 1); // ms until planned event (提前 1ms)
      sleepMs = timeToEarliest <= MIN_SLEEP_MS ? Math.max(1, timeToEarliest) : Math.max(MIN_SLEEP_MS, timeToEarliest);
    } else if (runningCount > 0 || anyScheduleRunning()) {
      // 堆空但仍有战斗在跑：短睡，等待 runBattle 结束时唤醒或下一轮快速轮询
      sleepMs = Math.max(MIN_SLEEP_MS, PHASE_STEP_MS);
    } else {
      sleepMs = MIN_SLEEP_MS;
    }

    await smartSleep(sleepMs);
  }
}

// 顶层启动
// setInterval(() => {
//   writeHeapSnapshot(`battle-${group}-${groupCount}.heapsnapshot`);
// }, 60000)?.unref();

await main().catch(async error => {
  logger.error(`Fatal error:`, error);
  try {
  } catch (e: any) {
    logger.error('flushPendingBattleInfoWrites failed on fatal error', e);
  }
  process.exit(1);
});