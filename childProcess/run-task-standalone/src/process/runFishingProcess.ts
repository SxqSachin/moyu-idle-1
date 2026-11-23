/**
 * runFishingProcess
 *
 * 可扩展的钓鱼后台工作进程（基于 Redis ZSET 调度）。
 * 设计要点：
 * - 启动时从数据库拉取所有活跃的钓鱼会话并加入 ZSET 以便调度。
 * - 使用 Lua 脚本原子地弹出到期的 sessionId（避免竞态）。
 * - 对每个 session 使用短租约（SET NX PX）避免多进程重复处理。
 * - 使用会话快照中保存的 `rndSeed`（保存在 activeSession.rndSeed）作为确定性随机种子。
 * - 本文件尽量保持简洁：随机种子不在这里生成，使用 activeSession.rndSeed；注释均为中文；使用常量替代环境变量。
 */

import { redisClient } from "../utils/redis";
import { prisma } from "../utils/prisma";
import crypto from "crypto";
import { endFishingSession, sampleFishForPond, computeEffectiveBaitModifiersForSession, type BaitModifiers } from "../utils/game/fishing";
import type { FishingSession } from "~/generated/prisma";
import { FISHING_DUE_ZSET, DEFAULT_MIN_TICK_MS, DEFAULT_MAX_TICK_MS, BOOTSTRAP_JITTER_MS, POP_LIMIT, LEASE_TTL_MS, FISHING_LEASE_PREFIX } from '~/shared/data/fishingConstant'
import type { AllFishPondID } from "~/shared/data/allFishPond";

// 支持通过环境变量覆盖（便于在 ecosystem 中针对 local/production 配置）
function parseEnvMs(name: string, fallback: number) {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

let MIN_TICK_MS = parseEnvMs('FISHING_MIN_TICK_MS', DEFAULT_MIN_TICK_MS);
let MAX_TICK_MS = parseEnvMs('FISHING_MAX_TICK_MS', DEFAULT_MAX_TICK_MS);
// 保证范围合理
if (MAX_TICK_MS < MIN_TICK_MS) {
  MAX_TICK_MS = MIN_TICK_MS;
}

console.log(MIN_TICK_MS, MAX_TICK_MS);

// 行为开关（常量控制，不再读取环境变量）
const END_AFTER_EPIC = false; // 是否在获得史诗后结束会话（示例）

// Lua script to pop due items from zset (same pattern as other processes)
// Lua 脚本：原子地从 zset 中按 score 弹出到期的元素
const POP_LUA = `
local zset = KEYS[1]
local now = ARGV[1]
local limit = tonumber(ARGV[2])
local arr = redis.call('ZRANGEBYSCORE', zset, '-inf', now, 'LIMIT', 0, limit)
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
      keys: [FISHING_DUE_ZSET],
      arguments: [String(now), String(POP_LIMIT)],
    });
    return res || [];
  } catch (e) {
    console.error('runFishingProcess.popDue error', e);
    return [];
  }
}

function leaseKey(sessionId: string) {
  return `${FISHING_LEASE_PREFIX}${sessionId}`;
}

/**
 * 将 sessionId 安排到 ZSET 的指定时间（score 为时间戳毫秒）
 */
async function schedule(sessionId: string, nextAt: number | null) {
  if (nextAt == null) return;
  try {
    await redisClient.ZADD(FISHING_DUE_ZSET, { score: nextAt, value: sessionId });
  } catch (e) {
    console.error('runFishingProcess.schedule error', e);
  }
}

/**
 * 对给定的 rndSeed 和 tickIndex 生成确定性伪随机数，返回 [0,1)
 * rndSeed 必须由 activeSession.rndSeed 提供（本文件不负责生成种子）
 */
function deterministicRand(rndSeed: string | null, tickIndex: number) {
  const seed = `${rndSeed ?? 'anon'}:${tickIndex}`;
  const h = crypto.createHash('sha256').update(seed).digest('hex');
  // 取前 15 个 hex 字符约等于 60 位熵
  const sub = h.slice(0, 15);
  const num = parseInt(sub, 16);
  return (num % 1_000_000_000) / 1_000_000_000;
}

/**
 * 生成玩家下一次钓鱼判定的延迟（毫秒）
 *
 * 说明：当前默认行为是在 `MIN_TICK_MS` 到 `MAX_TICK_MS` 之间随机抖动一个值。
 * 抽离为单独方法是为了便于后续扩展（例如：基于玩家道具、天气、诱饵效率、活跃会话权重等调整间隔）。
 *
 * 参数：
 * - session: Prisma 的 `FishingSession`（包含用户/池信息）
 * - active: activeFishingSession 中的快照（可包含 rndSeed、优先级等运行时信息），可选
 * - tickIndex: 当前 tick 索引，可选，便于在 deterministic 模式下用 seed 产生确定性 jitter
 *
 * 返回值：下次判定的延迟毫秒数（>= MIN_TICK_MS 且 <= MAX_TICK_MS）
 */
async function generateNextInterval(modifiers: BaitModifiers, active: any | null, tickIndex?: number) {
  // 默认随机抖动范围
  const range = Math.max(0, MAX_TICK_MS - MIN_TICK_MS);

  // 如果提供了确定性种子（active.rndSeed）和 tickIndex，优先使用 deterministicRand
  // 以便在复现/回放时得到稳定的时序；否则使用 Math.random()
  let jitter = 0;
  try {
    if (active?.rndSeed && typeof tickIndex === 'number') {
      // 生成一个 [0, range) 的确定性值
      const r = deterministicRand(active.rndSeed, tickIndex + 1); // +1 避免与当前 tick 冲突
      jitter = Math.floor(r * (range + 1));
    } else {
      jitter = Math.floor(Math.random() * (range + 1));
    }
  } catch (e) {
    // 兜底：使用 Math.random
    jitter = Math.floor(Math.random() * (range + 1));
  }

  // 考虑诱饵带来的上钩时间减少效果（会话/附近区域）
  try {
    const reduction = Math.min(0.99, (modifiers?.areaHookTimeReductionPercent || 0) + (modifiers?.sessionHookTimeReductionPercent || 0))

    const adjJitter = Math.floor(jitter * Math.max(0, 1 - reduction))
    return MIN_TICK_MS + adjJitter
  } catch (e) {
    return MIN_TICK_MS + jitter
  }
}

/**
 * 计算当前 tick 的基础命中率（[0,1]）
 *
 * 当前实现（向后兼容）：
 * - 随时间增长的基础命中率，初始为 0.05
 * - 每个 tick 累加 0.02（最多累加到 +1），最终上限为 0.9
 *
 * 抽离为函数便于后续在此处加入：
 * - 受玩家诱饵数量/品质影响的额外加成
 * - 受附近 bait-area 的数量/效果加成
 * - 受活动/增益/装备等影响的修正
 */
async function computeBaseChance(modifiers: BaitModifiers, tickIndex: number) {
  // 保持与历史实现一致的基础公式
  const base = 0.05 + Math.min(1, tickIndex * 0.02);
  // 考虑诱饵的全局咬口率提升
  try {
    const biteBoost = (modifiers?.areaBiteRateIncreasePercent || 0) + (modifiers?.sessionBiteRateIncreasePercent || 0)

    const final = Math.min(0.99, base * (1 + biteBoost))
    return Math.min(0.99, final)
  } catch (e) {
    return Math.min(0.9, base);
  }
}

/**
 * processSingleSession
 * - loads active session + linked fishingSession
 * - computes tick index and deterministic RNG
 * - decides whether a catch occurs; if catch -> call onCatch (pluggable)
 * - schedules next check or ends session if appropriate
 */
async function processSingleSession(sessionId: string) {
  // 先尝试获取租约，避免多个 worker 重复处理同一会话
  const lease = await redisClient.SET(leaseKey(sessionId), '1', { NX: true, PX: LEASE_TTL_MS } as any).catch(() => null);
  if (!lease) return; // 已有其他进程在处理

  try {
    // 以 activeSession 作为主数据来源（会话种子保存在 active.rndSeed）
    const active = await prisma.activeFishingSession.findUnique({ where: { sessionId } });
    if (!active) return; // 会话已结束或不存在

    const session = await prisma.fishingSession.findUnique({ where: { uuid: sessionId } });
    if (!session) {
      // 数据不一致：主动删除 active 记录以自愈
      await prisma.activeFishingSession.deleteMany({ where: { sessionId } }).catch(() => null);
      return;
    }

    const now = Date.now();
    const startedAt = (active.startedAt?.getTime && active.startedAt.getTime()) ?? Date.now();
    // 为保证随机数的确定性，我们使用基于最小间隔的 tickIndex：
    // tickIndex = floor((now - startedAt) / MIN_TICK_MS)
    // 这样即便实际调度间隔在 5-12 分钟之间波动，使用相同 rndSeed+tickIndex 仍可重现结果。
    const tickIndex = Math.floor((now - startedAt) / MIN_TICK_MS);

    // 使用 active.rndSeed 作为确定性随机种子（如果不存在则回退到 session.id）
    const seedToUse = active.rndSeed ?? session.id;
    const r = deterministicRand(seedToUse ?? null, tickIndex);

    const modifiers = await computeEffectiveBaitModifiersForSession({ session: session, pondId: session.pondId, pointX: active.pointX, pointY: active.pointY, userUuid: session.userUuid });

    // 简单的触发规则：通过 `computeBaseChance` 计算基础命中率（可由该函数扩展）
    const baseChance = await computeBaseChance(modifiers, tickIndex);

    if (r < baseChance) {
      // 触发命中，交给可插拔的 onCatch 处理（持久化、发事件等）
      try {
        await onCatch({ session, active, tickIndex, rand: r });
      } catch (e) {
        console.error('runFishingProcess.onCatch handler error', e);
      }
    }

    // 如果仍然活跃，重新安排下一次检查
    const stillActive = await prisma.activeFishingSession.findUnique({ where: { sessionId } });
    if (stillActive) {
      // 生成下一次判定的延迟（ms），通过 `generateNextInterval` 可在未来加入基于 session/active 的策略
      const delay = await generateNextInterval(modifiers, active, tickIndex);
      const nextAt = Date.now() + delay;
      await schedule(sessionId, nextAt);
    }
  } finally {
    // 释放租约
    await redisClient.DEL(leaseKey(sessionId)).catch(() => null);
  }
}

/**
 * onCatch
 * - Default handler: appends a summary to `fishingSession.resultSummary` (JSON array)
 * - You should replace/extend this with your game's reward persistence (give items, update inventory, send events)
 */
/**
 * onCatch：默认处理器
 * - 将一个简短的捕获摘要追加到 fishingSession.resultSummary（JSON 数组字符串）
 * - 这里作为示例逻辑，生产环境应替换为：写入 CaughtFish 表、发放物品、通过 socket 通知客户端等
 */
async function onCatch(ctx: { session: FishingSession; active: any; tickIndex: number; rand: number }) {
  const { session, active, tickIndex, rand } = ctx;
  const now = new Date();

  // 调用 sampleFishForPond 进行鱼类采样并持久化到 CaughtFish 表
  try {
    await sampleFishForPond(session.pondId as AllFishPondID, active.rndSeed ?? session.rndSeed, now, {
      sessionId: session.uuid,
      userUuid: session.userUuid,
    });
  } catch (e) {
    console.error('sampleFishForPond error', e);
  }

  // 注意：不在这里直接修改 fishingSession.resultSummary，采样函数负责持久化捕获记录。
}

async function bootstrap() {
  // push all current active sessions into ZSET with small jitter
  const actives = await prisma.activeFishingSession.findMany({ select: { sessionId: true } });
  const now = Date.now();
  if (actives.length === 0) return;
  const pipeline = redisClient.multi();
  for (const a of actives) {
    const jitter = Math.floor(Math.random() * BOOTSTRAP_JITTER_MS);
    pipeline.ZADD(FISHING_DUE_ZSET, { score: now + jitter, value: a.sessionId });
  }
  await pipeline.exec();
}

async function main() {
  await bootstrap();
  console.log('runFishingProcess bootstrapped');

  // duplicate client for blocking operations if desired (not used here)

  let running = true;
  process.on('SIGINT', () => (running = false));
  process.on('SIGTERM', () => (running = false));

  while (running) {
    try {
      const now = Date.now();
      const due = await popDue(now);
      if (!due.length) {
        // sleep until next scheduled item or short idle
        const next = await redisClient.ZRANGE_WITHSCORES(FISHING_DUE_ZSET, 0, 0);
        if (next && next.length) {
          const wait = Math.max(50, Math.min(5000, Math.ceil(next[0].score - Date.now())));
          await new Promise(r => setTimeout(r, wait));
        } else {
          await new Promise(r => setTimeout(r, 1000));
        }
        continue;
      }

      // process batch in parallel but bounded
      await Promise.all(due.map(sid => processSingleSession(sid)));

    } catch (e) {
      console.error('runFishingProcess main loop error', e);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('runFishingProcess shutting down');
}

// start
main().catch(e => {
  console.error('runFishingProcess fatal', e);
  process.exit(1);
});
