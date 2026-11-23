import type {
  AchievementEvent,
  AchievementDefinition,
  PlayerAchievementRecord,
  AchievementQueueMessage,
  AchievementRule,
  AchievementRegistry,
  ResourceCounterRule,
  ActionCounterRule,
  EnemyKillCounterRule,
  CustomCounterRule,
  EventRule,
  PredicateRule,
  CompositeRule,
  OneoffRule,
  MilestoneCounterRule,
} from "~/shared/types/achievement";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP_BY_ID,
} from "~/shared/data/achievements";
import { redisClient } from "~/server/utils";
import { ACHIEVEMENT_QUEUE_KEY } from "~/shared/types/achievement";
import { PrismaTx } from "~/shared/types/socket/db";

// 说明：此模块为成就服务工具集（不包含消费逻辑）。
// - 成就定义的单一源为 `shared/data/achievements.ts`（`ACHIEVEMENTS` / `ACHIEVEMENT_MAP_BY_CODE`）
// - 只实现：入队、检查可解锁性、以及在 DB 中写入解锁（幂等 + 事务）

/* ----------------------------
 * 下面实现可复用的公开方法（不包含消费逻辑）
 * - `enqueueAchievementMessage` 将事件写入 Redis 队列
 * - `checkAchievementEligibility` 使用 Prisma 检查是否可解锁（前置、已解锁）
 * - `unlockAchievementInDb` 使用 Prisma 原子/幂等写入解锁记录并发出解锁事件
 * 注意：此处假设全局存在 `prisma` 变量，且 Redis 客户端在 `~/server/utils` 已导出为 `redisClient`。
 * ----------------------------*/

/** 将事件放入成就处理队列（生产消费者会消费该队列） */
export async function enqueueAchievementMessage(
  msg: AchievementQueueMessage,
): Promise<void> {
  if (!redisClient) throw new Error("redisClient 未初始化");
  const key = ACHIEVEMENT_QUEUE_KEY;
  await redisClient.rPush(key, JSON.stringify(msg));
}

/* ----------------------------
 * 每种规则的判断与进度更新（类型安全实现）
 * - 为每种 `AchievementRule` 提供：
 *   1) 判断是否满足：`is...Satisfied(rule, playerId, opts?)`（返回 Promise<boolean>）
 *   2) 更新/读取进度：`update...Progress(rule, playerId, opts?)`（返回 { progress, target }）
 * - 然后提供两项聚合函数：
 *   - `evaluateRuleSatisfied(rule, playerId, opts?)`：根据 rule.type 分发到对应判断函数
 *   - `updateRuleProgress(rule, playerId, opts?)`：根据 rule.type 分发到对应进度更新函数
 *
 * 实现原则（保证类型安全）：
 * - 使用类型守卫/规范化函数把运行时的 rule 转为受控的结构（避免直接使用 any）。
 * - 与数据库交互时尽量显式检查字段并处理缺失情况。
 * - 所有注释均为中文，保证可读性。
 * ---------------------------*/

type EvalOptions = {
  payload?: Record<string, unknown>;
  registry?: AchievementRegistry;
};

type CounterRule =
  | ResourceCounterRule
  | ActionCounterRule
  | EnemyKillCounterRule
  | CustomCounterRule
  | MilestoneCounterRule
  ;

/**
 * 类型守卫：将任意规则对象规范化为 { key, thresholds[] }
 * - 若无法规范化则返回 null
 */
function normalizeCounterRule(
  rule: CounterRule,
): { key: string; thresholds: number } | null {
  if (!rule || typeof rule !== "object") return null;

  const r = rule;

  if (typeof r.key !== "string") return null;

  const ts = r.thresholds;

  if (typeof ts !== "number") return null;

  return { key: r.key, thresholds: ts };
}

function isCounterAchievementRule(
  rule: AchievementRule,
): rule is CounterRule {
  if (!rule || typeof rule !== "object") return false;
  switch (rule.type) {
    case "resourceCounter":
    case "actionCounter":
    case "enemyKillCounter":
    case "customCounter":
    case "milestoneCount":
      return true;
    default:
      return false;
  }
}

/** 从数据库安全读取玩家计数值（若不存在，返回 0） */
async function getUserAchievementCounterValue(
  userUuid: string,
  key: string,
  tx?: PrismaTx
): Promise<number> {
  if (!tx) tx = prisma;
  const row = await tx.userAchievementCounter.findUnique({
    where: {
      user_achievement_counter_unique: {
        userUuid: userUuid,
        key,
      },
    },
  });
  return Number(row?.value ?? 0);
}

/** 计数类规则的满足判断（资源/动作/击杀/自定义计数） */
async function isCounterRuleSatisfied(
  rule: CounterRule,
  userUuid: string,
): Promise<boolean> {
  const norm = normalizeCounterRule(rule);
  if (!norm) return false;
  const value = await getUserAchievementCounterValue(userUuid, norm.key);
  const threshold = norm.thresholds
  if (typeof threshold === "undefined") return false;
  return value >= threshold;
}

/**
 * 计数类规则的进度更新（原子读写）
 * - 返回当前 progress 与 target（若有）
 */
async function updateCounterRuleProgress(
  rule: CounterRule,
  userUuid: string,
  delta = 1,
): Promise<{ progress: number; target: number }> {
  const norm = normalizeCounterRule(rule);
  if (!norm) return { progress: 0, target: 0 };
  const ruleKey = norm.key;
  const target = norm.thresholds;

  // 使用事务避免读写竞争；兼容 userAchievementCounter 可能没有单一 id 的情况
  const res = await prisma.$transaction(async (tx) => {
    const existing = await tx.userAchievementCounter.findUnique({
      where: {
        user_achievement_counter_unique: {
          userUuid: userUuid,
          key: ruleKey,
        },
      },
    });

    if (existing) {
      const next = Number(existing.value ?? 0) + delta;
      // 优先使用主键更新，如果没有 id 则使用 updateMany 回退
      const existingId = existing.id;
      const updated = await tx.userAchievementCounter.update({
        where: { id: existingId },
        data: { value: BigInt(next) },
      });
      return { progress: Number(updated.value), target };
    }

    const created = await tx.userAchievementCounter.create({
      data: { userUuid: userUuid, key: ruleKey, value: BigInt(delta) },
    });
    return { progress: Number(created.value), target };
  });

  return res as { progress: number; target: number };
}

/** 事件型规则判断（基于事件 payload） */
async function isEventRuleSatisfied(
  rule: EventRule,
  _playerId: string,
  opts?: EvalOptions,
): Promise<boolean> {
  if (!rule || !opts?.payload) return false;
  if (rule.eventType && opts.payload["eventType"] !== rule.eventType)
    return false;
  if (typeof rule.conditions === "function") {
    try {
      // conditions 可能是同步或异步函数
      // @ts-ignore - 按设计允许函数存在于 rule.meta 中
      const ok = await rule.conditions(opts.payload);
      return Boolean(ok);
    } catch (e) {
      return false;
    }
  }
  return true;
}

async function updateEventRuleProgress(
  _rule: EventRule,
  _playerId: string,
  _opts?: EvalOptions,
) {
  return { progress: 1, target: 1 };
}

/** 谓词规则：委托给 registry 中的 evaluator */
async function isPredicateRuleSatisfied(
  rule: PredicateRule,
  playerId: string,
  opts?: EvalOptions,
): Promise<boolean> {
  if (!rule || !rule.evaluator || !opts?.registry?.predicateEvaluators)
    return false;
  const fn = opts.registry.predicateEvaluators[rule.evaluator];
  if (!fn) return false;
  const ret = await fn(playerId, rule.params ?? {});
  return Boolean(ret);
}

async function updatePredicateRuleProgress(
  _rule: PredicateRule,
  _playerId: string,
  _opts?: EvalOptions,
) {
  return { progress: 0, target: undefined };
}

/** 复合规则（AND/OR） */
async function isCompositeRuleSatisfied(
  rule: CompositeRule,
  playerId: string,
  opts?: EvalOptions,
): Promise<boolean> {
  if (!rule || !Array.isArray(rule.children)) return false;
  if (rule.op === "and") {
    for (const c of rule.children) {
      const ok = await evaluateRuleSatisfied(c, playerId, opts);
      if (!ok) return false;
    }
    return true;
  }
  // op === 'or'
  for (const c of rule.children) {
    const ok = await evaluateRuleSatisfied(c, playerId, opts);
    if (ok) return true;
  }
  return false;
}

async function updateCompositeRuleProgress(
  rule: CompositeRule,
  playerId: string,
  opts?: EvalOptions,
) {
  if (!rule || !Array.isArray(rule.children))
    return { progress: 0, target: rule.children?.length ?? 0 };
  let completed = 0;
  for (const c of rule.children) {
    if (await evaluateRuleSatisfied(c, playerId, opts)) completed++;
  }
  return { progress: completed, target: rule.children.length };
}

/** 聚合判断：对任意 rule 根据类型分发到具体实现 */
export async function evaluateRuleSatisfied(
  rule: AchievementRule,
  playerId: string,
  opts?: EvalOptions,
): Promise<boolean> {
  switch (rule.type) {
    case "resourceCounter":
    case "actionCounter":
    case "enemyKillCounter":
    case "customCounter":
    case "milestoneCount":
      return isCounterRuleSatisfied(rule as CounterRule, playerId);
    case "event":
      return isEventRuleSatisfied(rule as EventRule, playerId, opts);
    case "predicate":
      return isPredicateRuleSatisfied(rule as PredicateRule, playerId, opts);
    case "composite":
      return isCompositeRuleSatisfied(rule as CompositeRule, playerId, opts);
    case "oneoff":
      return false;
    default:
      return false;
  }
}

/** 聚合进度更新：对任意 rule 根据类型分发到具体实现 */
export async function updateRuleProgress(
  rule: AchievementRule,
  playerId: string,
  opts?: EvalOptions,
): Promise<{ progress: number; target?: number }> {
  switch (rule.type) {
    case "resourceCounter":
    case "actionCounter":
    case "enemyKillCounter":
    case "customCounter": {
      const delta = Number(
        opts?.payload?.["qty"] ?? opts?.payload?.["delta"] ?? 1,
      );
      return updateCounterRuleProgress(rule as CounterRule, playerId, delta);
    }
    case "event":
      return updateEventRuleProgress(rule as EventRule, playerId, opts);
    case "predicate":
      return updatePredicateRuleProgress(rule as PredicateRule, playerId, opts);
    case "composite":
      return updateCompositeRuleProgress(rule as CompositeRule, playerId, opts);
    case "oneoff":
      return { progress: 1, target: 1 };
    default:
      return { progress: 0, target: undefined };
  }
}

/**
 * 检查玩家是否满足一个成就的解锁条件（仅检查前置成就与是否已解锁）
 * - 不进行计数器评估（计数器由消费流程或 Redis Lua 负责）
 */
export async function checkAchievementEligibility(
  userUuid: string,
  achievementId: string,
): Promise<{
  exists: boolean;
  alreadyUnlocked: boolean;
  missingPrerequisites: string[];
}> {
  // 查找成就定义（来源：shared/data/achievements）
  const def =
    ACHIEVEMENT_MAP_BY_ID[achievementId] ??
    ACHIEVEMENTS.find((a) => a.id === achievementId);
  if (!def)
    return { exists: false, alreadyUnlocked: false, missingPrerequisites: [] };
  // 检查数据库是否已存在解锁记录（schema 中的 model: UserAchievement）
  const existing = await prisma.userAchievement.findUnique({
    where: {
      user_achievement_unique: {
        userUuid: userUuid,
        achievementId: achievementId,
      },
    },
  });
  if (existing && existing.completed) {
    return { exists: true, alreadyUnlocked: true, missingPrerequisites: [] };
  }

  // 检查前置成就
  const reqs = def.prerequisites ?? [];
  const missing: string[] = [];
  if (reqs.length > 0) {
    // 只查询已完成的 code，降低数据传输
    const rows = await prisma.userAchievement.findMany({
      where: {
        userUuid: userUuid,
        achievementId: { in: reqs },
        completed: true,
      },
      select: { achievementId: true },
    });
    const completedSet = new Set(rows.map((r) => r.achievementId));
    for (const code of reqs) if (!completedSet.has(code)) missing.push(code);
  }

  return {
    exists: true,
    alreadyUnlocked: false,
    missingPrerequisites: missing,
  };
}

export async function checkAchievementUnlockable(
  userUuid: string,
  achievementId: string,
): Promise<boolean> {
  // 先检查是否已经解锁，及前置成就是否满足
  const achievement = ACHIEVEMENT_MAP_BY_ID[achievementId];
  if (!achievement) return false;

  const eligibility = await checkAchievementEligibility(userUuid, achievementId);

  if (!eligibility.exists) return false;
  if (eligibility.alreadyUnlocked) return false;
  if (eligibility.missingPrerequisites.length > 0) return false;

  const rule = achievement.rule;

  if (isCounterAchievementRule(rule)) {
    const checkRes = await isCounterRuleSatisfied(rule, userUuid);

    if (checkRes) {
      return true;
    }
  }

  return false;
}

/**
 * 在数据库中记录成就解锁（幂等）并发出解锁事件。
 * - 如果记录已存在则直接返回
 * - 会尝试读取对应计数器以填充 `progress` 字段（若模型存在 `PlayerCounter`）
 */
export async function unlockAchievementInDb(
  playerId: string,
  achievementId: string,
): Promise<PlayerAchievementRecord | null> {
  const achievement = ACHIEVEMENT_MAP_BY_ID[achievementId];
  if (!achievement) return null;

  // 已解锁检查（UserAchievement）
  const existing = await prisma.userAchievement.findUnique({
    where: {
      user_achievement_unique: {
        userUuid: playerId,
        achievementId: achievementId,
      },
    },
  });

  if (existing && existing.completed) {
    return {
      userUuid: playerId,
      achievementId: existing.achievementId,
      progress: Number(existing.progress ?? 0),
      target:
        existing.target !== null && typeof existing.target !== "undefined"
          ? Number(existing.target)
          : undefined,
      completed: existing.completed,
      completedAt: existing.completedAt
    };
  }

  // 读取计数器（如果规则带 key 且数据库中有 userAchievementCounter）
  // let progress = 0;
  // let target: number | undefined;
  // const rule = def.rule;

  // 在事务中写入 userAchievement 与 AchievementEvent，保证原子性与审计一致性
  type CreatedUserAchievement = {
    userUuid?: string;
    achievementId?: string;
    progress?: bigint | number;
    target?: bigint | number | null;
    completed?: boolean;
    completedAt?: Date | null;
  };
  let created: CreatedUserAchievement | null = null;
  try {
    let target = 1;
    let progress = 0;
    if (isCounterAchievementRule(achievement.rule)) {
      const norm = normalizeCounterRule(achievement.rule);
      if (norm) {
        target = norm.thresholds;
      }

      progress = await getUserAchievementCounterValue(
        playerId,
        norm?.key ?? "",
      );
    }

    created = await prisma.$transaction(async (tx) => {
      const existInTx = await tx.userAchievement.findUnique({
        where: { 
          user_achievement_unique: {
            userUuid: playerId, achievementId
          }
        }
      });
      if (existInTx && existInTx.completed) return existInTx;

      const c = await tx.userAchievement.create({
        data: {
          userUuid: playerId,
          achievementId,
          progress,
          target,
          completed: true,
          completedAt: new Date(),
        },
      });

      await tx.achievementEvent.create({
        data: {
          eventId: `ach-unlock-${achievementId}`,
          userUuid: playerId,
          type: "achievement:unlocked",
          payload: JSON.stringify({ achievementId }),
          processedAt: new Date(),
        },
      });

      return c;
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const existAfter = await prisma.userAchievement.findUnique({
        where: { user_achievement_unique: { userUuid: playerId, achievementId } },
      });
      if (existAfter) created = existAfter;
      else throw err;
    } else throw err;
  }

  const rec: PlayerAchievementRecord = {
    userUuid: created.userUuid ?? playerId,
    achievementId: created.achievementId!,
    progress: Number(created.progress),
    target: Number(created.target),
    completed: created.completed ?? true,
    completedAt: created.completedAt
  };

  return rec;
}

/**
 * 处理计数类事件：
 * - keySelector 根据 payload 返回计数器 key（例如 itemId -> `item:iron`）
 * - payload 应包含数值型的增量（qty 或 delta）
 */
// function processCounterEvent(
//   evt: AchievementEvent,
//   keySelector: (payloadKey: string) => string,
// ) {
//   const playerId = evt.playerId;
//   if (!playerId || !evt.payload) return;

//   // 从 payload 提取原始 id（优先尝试常用字段）
//   const id = (evt.payload.itemId ?? evt.payload.enemyId ?? evt.payload.key) as
//     | string
//     | undefined;
//   const delta = Number(evt.payload.qty ?? evt.payload.delta ?? 1);
//   if (!id || !Number.isFinite(delta)) return;

//   const key = keySelector(id);

//   // 追加/更新计数器后评估阈值是否达成
//   const reached = incrPlayerCounterAndCheck(playerId, key, delta);
//   if (!reached || reached.length === 0) return;

//   for (const ach of reached) {
//     try {
//       if (!prerequisitesMet(playerId, ach)) {
//         // 尚未满足前置成就，跳过；当前置成就解锁后，后续事件会再次触发评估
//         continue;
//       }
//       unlockAchievementForPlayer(playerId, ach);
//     } catch (err) {
//       console.error("unlock check error", err);
//     }
//   }
// }

// function prerequisitesMet(
//   playerId: string,
//   ach: AchievementDefinition,
// ): boolean {
//   // 优先使用显式的 prerequisites 字段；meta.prerequisites 作为兼容来源
//   const maybeMeta = ach.meta as { prerequisites?: string[] } | undefined;
//   const reqs = ach.prerequisites ?? maybeMeta?.prerequisites ?? [];
//   if (!reqs || reqs.length === 0) return true;
//   const pmap = playerAchievements.get(playerId);
//   if (!pmap) return false;
//   for (const code of reqs) {
//     const r = pmap.get(code);
//     if (!r || !r.completed) return false;
//   }
//   return true;
// }
// function incrPlayerCounterAndCheck(
//   playerId: string,
//   key: string,
//   delta: number,
// ): AchievementDefinition[] {
//   let map = playerCounters.get(playerId);
//   if (!map) {
//     map = new Map();
//     playerCounters.set(playerId, map);
//   }
//   const prev = map.get(key) ?? 0;
//   const next = prev + delta;
//   map.set(key, next);

//   // 查找相关的已展开成就
//   const candidates = EXPANDED_BY_KEY[key] ?? [];
//   const reached: AchievementDefinition[] = [];
//   for (const ach of candidates) {
//     // 使用局部断言读取 thresholds（可能为 number 或 number[]）
//     const rule = ach.rule as { thresholds?: number | number[] };
//     if (rule && typeof rule.thresholds !== "undefined") {
//       const thresholdsArr = Array.isArray(rule.thresholds)
//         ? rule.thresholds
//         : [rule.thresholds as number];
//       for (const t of thresholdsArr) {
//         if (prev < t && next >= t) {
//           reached.push(ach);
//           break;
//         }
//       }
//     }
//   }
//   return reached;
// }

// function unlockAchievementForPlayer(
//   playerId: string,
//   ach: AchievementDefinition,
// ) {
//   let pmap = playerAchievements.get(playerId);
//   if (!pmap) {
//     pmap = new Map();
//     playerAchievements.set(playerId, pmap);
//   }
//   const existing = pmap.get(ach.code);
//   if (existing && existing.completed) return; // 已经解锁，忽略重复

//   // determine target and progress from counter if possible
//   let progress = 0;
//   let target: number | undefined = undefined;
//   // 如果规则包含 key/thresholds，则从计数器读取进度与目标
//   const rule = ach.rule as { key?: string; thresholds?: number | number[] };
//   if (rule && rule.key) {
//     const key = rule.key;
//     const counters = playerCounters.get(playerId);
//     progress = counters?.get(key) ?? 0;
//     const thresholdsArr =
//       typeof rule.thresholds === "undefined"
//         ? []
//         : Array.isArray(rule.thresholds)
//           ? rule.thresholds
//           : [rule.thresholds];
//     target =
//       thresholdsArr.length > 0
//         ? thresholdsArr[thresholdsArr.length - 1]
//         : undefined;
//   }

//   const rec: PlayerAchievementRecord = {
//     userUuid: playerId,
//     achievementId: ach.code,
//     progress,
//     target,
//     completed: true,
//     completedAt: Date.now(),
//   };
//   pmap.set(ach.code, rec);

//   // 向系统其它部分发布解锁事件（例如发放奖励、推送通知）
//   const unlockEvt = {
//     eventId: `ach-unlock-${ach.code}-${playerId}-${Date.now()}`,
//     playerId,
//     type: "achievement:unlocked",
//     payload: { achievement: ach, record: rec },
//     ts: Date.now(),
//   };
//   emitAchievementEvent(unlockEvt);
//   console.info(`[AchievementBus] player=${playerId} unlocked ${ach.code}`);
// }

// 注意：
// - 为了适配分布式部署，内存级别的 EventEmitter、playerCounters 等运行时状态
//   已从核心工具模块中剥离，避免在多实例环境下产生不一致。
// - 本模块导出的公共 API 限于：
//   - `enqueueAchievementMessage`
//   - `checkAchievementEligibility`
//   - `unlockAchievementInDb`
// - 如需消费队列，请在独立的 worker 进程中实现消费者，该消费者从 Redis 队列读取
//   消息，调用 `updateRuleProgress` / `evaluateRuleSatisfied` 并在满足条件时调用
//   `unlockAchievementInDb`。
