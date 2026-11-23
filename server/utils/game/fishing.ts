import { prisma } from "~/server/utils/game/db"
import { v7 } from 'uuid'
import type { FishingSessionDTO, ActiveFishingSessionDTO, ActiveSession, NearbyPlayer } from '~/shared/types/fishing'
import { redisClient } from '~/server/utils'

// 本地进程级别的创建钓点冷却（用于 Redis 不可用时的回退）
const createPointCooldowns = new Map<string, number>()
const CREATE_POINT_COOLDOWN_SEC = 180 // 3 minutes
import { FISHING_DUE_ZSET, BOOTSTRAP_JITTER_MS, VISIBLE_RADIUS } from '~/shared/data/fishingConstant'
import { allGameResource } from "~/shared/data/allGameResources"
import { allFishPond, AllFishPondID } from "~/shared/data/allFishPond"
import { ItemCountInfo, ModifyItemCountType } from "~/shared/types/gameInventory"
import { AllFishingBaitId, allFishingBaits } from "~/shared/data/allFishBaitInfo"
import { userInfo } from "os"
import { safeJsonParse } from "~/shared/utils"

/**
 * 创建一次新的钓鱼会话，并在 ActiveFishingSession 表中记录为活跃会话。
 * 验证输入并返回新创建的会话与活跃会话记录。
 */
export async function startFishingSession(params: {
  userUuid: string
  characterUuid?: string | null
  pointX: number
  pointY: number
  pondId: AllFishPondID
  toolConfig?: Record<string, unknown> | null
  baitConfig?: {[key in AllFishingBaitId]?: number} | null,
  endConditions?: any
  endAction: "STOP" | "CONTINUE"
  actorType: "PLAYER" | "KITTY"
  actorId: string
  rndSeed: string
}) {
  let { userUuid, pointX, pointY, pondId, toolConfig = null, baitConfig = null, endConditions = null, endAction, actorType, actorId, rndSeed } = params

  // 基本验证
  if (!userUuid) throw new Error("userUuid is required")
  if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) throw new Error("pointX/pointY must be finite numbers")


  const selfInfo = await prisma.user.findUnique({ where: { uuid: userUuid } });

  if (!selfInfo) {
    throw new Error('无法获取用户信息')
  }

  const pondInfo = allFishPond[pondId];
  if (!pondInfo) {
    throw new Error('鱼塘信息不存在')
  }

  // 将 toolConfig 序列化为 LongText JSON（数据库字段为 String）
  const toolConfigStr = toolConfig ? JSON.stringify(toolConfig) : "{}"

  // 验证新字段：endConditions / endAction / actorType / actorId
  const allowedConditionTypes = ['DURATION', 'COUNT']
  const allowedEndActions = ['STOP', 'CONTINUE']
  const allowedActorTypes = ['PLAYER', 'KITTY']

  if (endConditions !== null && endConditions !== undefined) {
    if (!Array.isArray(endConditions)) throw new Error('endConditions must be an array')
    for (const c of endConditions) {
      if (!c || typeof c !== 'object') throw new Error('each endCondition must be an object')
      if (!c.type || typeof c.type !== 'string' || !allowedConditionTypes.includes(c.type)) throw new Error('endCondition.type invalid')
      if (!Number.isFinite(Number(c.value)) || Number(c.value) <= 0) throw new Error('endCondition.value must be positive number')
    }
  }

  if (endAction !== undefined && endAction !== null) {
    if (!allowedEndActions.includes(String(endAction))) throw new Error('endAction invalid')
  }

  if (actorType !== undefined && actorType !== null) {
    if (!allowedActorTypes.includes(String(actorType))) throw new Error('actorType invalid')
      switch (String(actorType)) {
        case 'PLAYER':
          actorId = userUuid
          break;
        case 'KITTY':
          if (!actorId || typeof actorId !== 'string') {
            throw new Error('必须选择小猫咪')
          }
          actorId = actorId
          break;
      }
    if (String(actorType) === 'KITTY' && (!actorId || typeof actorId !== 'string')) {
      throw new Error('必须选择小猫咪')
    }

    if (actorType == 'KITTY') {
      const kitty = await prisma.kitty.findUnique({ where: { uuid: actorId } });
      if (!kitty || kitty.owner != userUuid) {
        throw new Error('选择的小猫咪不存在或不属于你')
      }
    }
  }

  const baitUsedResource: ItemCountInfo = {}
  if (baitConfig) {
    for(const [baitId, qty] of Object.entries(baitConfig)) {
      const resourceInfo = allGameResource[baitId];
      if (!resourceInfo) {
        throw new Error(`鱼饵信息不存在: ${baitId}`)
      }
      if (!allFishingBaits[baitId as AllFishingBaitId]) {
        throw new Error(`鱼饵信息不存在: ${baitId}`)
      }

      if (!qty || qty <= 0 || !Number.isInteger(qty)) {
        throw new Error(`鱼饵数量无效: ${resourceInfo.name}`)
      }

      const hasEnoughResource = await checkResourceRequirementInDB(userUuid, [
        {
          id: baitId,
          count: qty,
        }
      ])
      if (!hasEnoughResource) {
        throw new Error(`鱼饵资源不足: ${resourceInfo.name}`)
      }

      baitUsedResource[baitId] = { count: qty }
    }
  }

  // 防止短时间内重复创建钓点：优先使用 Redis 的 SET NX + EX 原子操作；若不可用则使用本地 Map 回退
  if (!selfInfo.is_gm) {
    const now = Date.now()
    const localUntil = createPointCooldowns.get(userUuid) ?? 0
    if (localUntil > now) {
      const remain = Math.ceil((localUntil - now) / 1000)
      throw new Error(`你刚创建过钓点，请在 ${remain} 秒后再试`)
    }

    const redisKey = `fishing:create:cooldown:${userUuid}`
    let redisSetRes = await redisClient.set(redisKey, '1', { EX: CREATE_POINT_COOLDOWN_SEC, NX: true })

    if (!redisSetRes) {
      // Redis reports existing key / set failed: try to read remaining TTL for a friendlier message
      let ttlSec: number | null = await redisClient.ttl(redisKey)
      if (ttlSec && ttlSec > 0) {
        throw new Error(`你刚创建过钓点，请在 ${ttlSec} 秒后再试`)
      }

      // Redis not available or key exists but ttl unknown: fall back to local map and inform generic message
      createPointCooldowns.set(userUuid, Date.now() + CREATE_POINT_COOLDOWN_SEC * 1000)
      throw new Error('你刚创建过钓点，请稍后再试')
    }

    // Redis set success: also set local map for immediate process-local checks
    createPointCooldowns.set(userUuid, Date.now() + CREATE_POINT_COOLDOWN_SEC * 1000)
  }

  // 将创建 session 与 active 放入同一事务，减少竞态条件
  const { session, active } = await prisma.$transaction(async (tx) => {
    // 检查用户是否已有活跃会话（不允许重复创建）
    const existing = await tx.activeFishingSession.findFirst({ where: { userUuid } })
    if (existing) {
      throw new Error('用户已有活跃的钓鱼会话')
    }

    await decreaseItemCount(userUuid, baitUsedResource, {
      showModifyInfo: true,
      sendModifyEvent: true,
      type: ModifyItemCountType.ActionUse,
      actionName: `在“${pondInfo.name}”钓鱼 - 消耗鱼饵`,
    }, tx);
    await invalidateInventoryCache(userUuid);

    const uuid = v7();

    const session = await tx.fishingSession.create({
      data: {
        uuid,
        userUuid,
        characterUuid: userUuid,
        pointX,
        pointY,
        pondId,
        toolConfig: toolConfigStr,
        baitConfig: baitConfig ? JSON.stringify(baitConfig) : "{}",
        endConditions: endConditions ?? undefined,
        endAction: endAction,
        actorType: actorType,
        actorId: actorId,
        rndSeed,
      },
    })

    const active = await tx.activeFishingSession.create({
      data: {
        sessionId: session.uuid,
        userUuid,
        pointX,
        pointY,
        pondId,
        rndSeed: session.rndSeed,
        endConditions: endConditions ?? undefined,
        endAction: endAction ?? undefined,
        actorType: actorType ?? undefined,
        actorId: actorId ?? undefined,
      },
    })

    return { session, active }
  })

  // 将新创建的活跃会话加入调度 ZSET（有小随机抖动以避免瞬间并发）
  try {
    const now = Date.now()
    const jitter = Math.floor(Math.random() * BOOTSTRAP_JITTER_MS)
    await redisClient.ZADD(FISHING_DUE_ZSET, { score: now + jitter, value: session.uuid })
    // 标记该 actorId（player 或 kitty）为正在钓鱼（供其他后端进程快速判断）
    try {
      const actorMember = actorId ?? userUuid;
      await redisClient.SADD('FISHING_ACTIVE_ACTOR_UUIDS', actorMember);
    } catch (e) { console.error('startFishingSession: failed to mark active fishing actor', e) }
  } catch (e) {
    console.error('startFishingSession: failed to schedule session in redis', e)
  }

  // map DB rows to DTOs expected by callers
  const sessionDto: FishingSessionDTO = {
    id: session.id,
    uuid: session.uuid,
    userUuid: session.userUuid,
    characterUuid: session.characterUuid ?? null,
    pointX: session.pointX,
    pointY: session.pointY,
    pondId: session.pondId ?? null,
    startAt: session.startAt,
    endAt: session.endAt ?? undefined,
    durationSec: session.durationSec ?? undefined,
    toolConfig: session.toolConfig ? (typeof session.toolConfig === 'string' ? JSON.parse(session.toolConfig) : session.toolConfig) : null,
    rngSeed: session.rndSeed ?? null,
    endConditions: session.endConditions ?? null,
    endAction: session.endAction,
    actorType: session.actorType,
    actorId: session.actorId,
    resultSummary: session.resultSummary ?? null,
    visiblePlayers: session.visiblePlayers ?? null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }

  const activeDto: ActiveSession = {
    sessionId: active.sessionId,

    userUuid: active.userUuid,
    name: selfInfo?.name,
    avatar: selfInfo?.avatar,

    characterUuid: session.characterUuid ?? null,
    pointX: active.pointX,
    pointY: active.pointY,
    pondId: active.pondId ?? null,
    startedAt: active.startedAt,
    rndSeed: session.rndSeed,
    endConditions: active.endConditions ?? null,
    endAction: active.endAction ?? null,
    actorType: active.actorType ?? null,
    actorId: active.actorId ?? null,
  }

  return { session: sessionDto, active: activeDto }
}

/**
 * Create a FishingBaitArea record with strict parameter validation.
 * radius/duration will be computed from bait info when not provided.
 */
export async function createFishingBaitArea(opts: {
  creatorUuid: string
  pondId: AllFishPondID
  pointX: number
  pointY: number
  baitArea: {
    baitId: string
    qty?: number
  }
}) {
  const { creatorUuid, pondId, pointX, pointY, baitArea } = opts

  const pondInfo = allFishPond[pondId];
  if (!pondInfo) {
    throw new Error('鱼塘信息不存在')
  }

  if (!creatorUuid) throw new Error('creatorUuid required')
  if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) throw new Error('pointX/pointY must be finite numbers')
  if (!baitArea || typeof baitArea !== 'object') throw new Error('baitArea required')

  let { baitId, qty } = baitArea
  if (!baitId || typeof baitId !== 'string') throw new Error('baitArea.baitId required')

  if (!allGameResource[baitId]) {
    throw new Error('打窝鱼饵信息不存在')
  }

  const baitInfo = allFishingBaits[baitId as AllFishingBaitId];
  if (!baitInfo) {
    throw new Error('打窝鱼饵信息不存在')
  }

  if (!qty || qty <= 0 || !Number.isInteger(qty)) {
    throw new Error('打窝鱼饵数量无效')
  }

  qty = Number(qty)

  const hasEnoughResource = await checkResourceRequirementInDB(creatorUuid, [
    { id: baitId, count: qty },
  ]);

  if (!hasEnoughResource) {
    throw new Error('资源不足，无法创建打窝区域')
  }

  await decreaseItemCount(creatorUuid, {
    [baitId]: {
      count: qty,
    }
  }, {
    sendModifyEvent: true,
    showModifyInfo: true,
    actionName: `创建打窝区域 - ${pondInfo.name}`,
    type: ModifyItemCountType.ActionUse
  })

  // radius: NOT stacking. Use baitInfo.baitAreaRadius if available, else fallback 50.
  let radius: number
  if (baitInfo && Number.isFinite(Number(baitInfo.baitAreaRadius))) {
    radius = Number(baitInfo.baitAreaRadius)
  } else {
    radius = 50
  }

  // durationSec: stacking by qty. base = baitInfo.baitAreaDurationSec || 300; total = base * qty
  let baseDuration = 300
  if (baitInfo && Number.isFinite(Number(baitInfo.baitAreaDurationSec))) {
    baseDuration = Number(baitInfo.baitAreaDurationSec)
  }
  const durationSec = Math.max(0, Math.floor(baseDuration * qty))

  const now = new Date()
  const expiresAt = durationSec ? new Date(now.getTime() + durationSec * 1000) : null

  const created = await prisma.fishingBaitArea.create({
    data: {
      creatorUuid,
      pondId: pondId ?? undefined,
      pointX,
      pointY,
      radius,
      baitId: String(baitId),
      effect: { qty },
      startedAt: now,
      expiresAt: expiresAt ?? undefined,
      active: true,
    }
  })

  return created
}

/**
 * 查询在指定坐标半径内的活跃钓鱼玩家。
 * 实现思路：先按包围盒过滤（避免全表扫描），再在应用层按真实距离筛选并返回用户信息。
 */
export async function getNearbyActiveFishers(opts: {
  pointX: number
  pointY: number
  radius: number
  excludeUserUuid?: string | null
  limit?: number
}) {
  let { pointX, pointY, radius, excludeUserUuid = null, limit = 50 } = opts

  if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) throw new Error("pointX/pointY must be finite numbers")
  if (!Number.isFinite(radius) || radius <= 0) throw new Error("radius must be positive number")


  if (excludeUserUuid) {
    const eu = await prisma.user.findUnique({ where: { uuid: excludeUserUuid } });

    if (eu?.is_gm) {
      radius = 9999999999;
    }
  }

  const minX = pointX - radius
  const maxX = pointX + radius
  const minY = pointY - radius
  const maxY = pointY + radius

  // 查询包围盒内的活跃会话
  const candidates = await prisma.activeFishingSession.findMany({
    where: {
      pointX: { gte: minX, lte: maxX },
      pointY: { gte: minY, lte: maxY },
    },
    take: limit,
  })

  // 过滤掉自己（如有）并按真实距离计算
  const filtered = candidates
    .filter(c => (excludeUserUuid ? c.userUuid !== excludeUserUuid : true))
    .map(c => ({
      userUuid: c.userUuid,
      sessionId: c.sessionId,
      pointX: c.pointX,
      pointY: c.pointY,
      pondId: c.pondId,
      startedAt: c.startedAt,
      dist2: (c.pointX - pointX) * (c.pointX - pointX) + (c.pointY - pointY) * (c.pointY - pointY),
      endConditions: c.endConditions,
      endAction: c.endAction,
      actorType: c.actorType,
      actorId: c.actorId,
    }))
    .filter(x => x.dist2 <= radius * radius)
    .sort((a, b) => a.dist2 - b.dist2)

  // 获取用户基本信息（批量查询以减少 DB roundtrip）
  const uuids = Array.from(new Set(filtered.map(f => f.userUuid)))
  const users = await prisma.user.findMany({
    where: { uuid: { in: uuids } },
    select: { uuid: true, name: true, avatar: true },
  })
  const userMap = new Map(users.map(u => [u.uuid, u]))

  const result: NearbyPlayer[] = filtered.map(f => ({
    userUuid: f.userUuid,
    name: userMap.get(f.userUuid)?.name ?? "",
    avatar: userMap.get(f.userUuid)?.avatar ?? "",

    sessionId: f.sessionId,
    pointX: f.pointX,
    pointY: f.pointY,
    pondId: f.pondId,
    startedAt: f.startedAt,

    endConditions: f.endConditions,
    endAction: f.endAction,
    actorType: f.actorType,
    actorId: f.actorId,
  }))

  return result
}

/**
 * 查询给定点附近的活跃 bait areas（以及当前用户创建的所有 bait areas）
 */
export async function getNearbyAndMyBaitAreas(opts: {
  pointX: number
  pointY: number
  radius: number
  userUuid: string
  limit?: number
}) {
  let { pointX, pointY, radius, userUuid, limit = 200 } = opts

  // enforce server-visible radius
  radius = VISIBLE_RADIUS;

  const user = await prisma.user.findUnique({ where: { uuid: userUuid } });
  if (user?.is_gm) {
    radius = 9999999;
  }

  if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) throw new Error('pointX/pointY must be finite numbers')
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('radius must be positive number')

  const minX = pointX - radius
  const maxX = pointX + radius
  const minY = pointY - radius
  const maxY = pointY + radius

  const now = new Date()

  // 查询包围盒内的 active bait areas
  const candidates = await prisma.fishingBaitArea.findMany({
    where: {
      active: true,
      pointX: { gte: minX, lte: maxX },
      pointY: { gte: minY, lte: maxY },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } }
      ]
    },
    take: limit,
  })

  console.debug('[getNearbyAndMyBaitAreas] candidates found:', candidates.length)
  if (candidates.length > 0) {
    console.debug('  sample candidate coords:', candidates.slice(0,5).map(c => ({ uuid: c.uuid, creator: c.creatorUuid, x: c.pointX, y: c.pointY, radius: c.radius })))
  }

  const nearby = candidates
    .map(c => ({
      uuid: c.uuid,
      userUuid: c.creatorUuid,
      pondId: c.pondId,
      pointX: c.pointX,
      pointY: c.pointY,
      radius: c.radius,
      baitId: c.baitId,
      effect: c.effect,
      startedAt: c.startedAt,
      expiresAt: c.expiresAt,
      active: c.active,
    }))
    .filter(c => {
      const dx = c.pointX - pointX
      const dy = c.pointY - pointY
      return dx * dx + dy * dy <= radius * radius
    })

    // Attach creator name/avatar for nearby results
    const nearbyUuids = Array.from(new Set(nearby.map(n => n.userUuid)))
    const nearbyUsers = nearbyUuids.length ? await prisma.user.findMany({ where: { uuid: { in: nearbyUuids } }, select: { uuid: true, name: true, avatar: true } }) : []
    const nearbyUserMap = new Map(nearbyUsers.map(u => [u.uuid, u]))
    const nearbyWithMeta = nearby.map(n => ({ ...n, creatorName: nearbyUserMap.get(n.userUuid)?.name ?? '', creatorAvatar: nearbyUserMap.get(n.userUuid)?.avatar ?? '' }))

  // 获取用户自己创建的 bait areas（无视范围限制）
  const myAreas = await prisma.fishingBaitArea.findMany({
    where: {
      creatorUuid: userUuid,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const mine = myAreas.map(c => ({
    id: c.id,
    uuid: c.uuid,
    userUuid: c.creatorUuid,
    pondId: c.pondId,
    pointX: c.pointX,
    pointY: c.pointY,
    radius: c.radius,
    baitId: c.baitId,
    effect: c.effect,
    startedAt: c.startedAt,
    expiresAt: c.expiresAt,
    active: c.active,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    creatorName: undefined,
    creatorAvatar: undefined,
  }))

  // attach creator info for mine (single user - use user's own profile)
  const me = await prisma.user.findUnique({ where: { uuid: userUuid }, select: { uuid: true, name: true, avatar: true } })
  const mineWithMeta = mine.map(m => ({ ...m, creatorName: me?.name ?? '', creatorAvatar: me?.avatar ?? '' }))

  return { nearby: nearbyWithMeta, mine: mineWithMeta }
}

/**
 * 获取用户当前的活跃钓鱼会话（如果存在），返回 active 记录及其关联的 session
 */
export async function getMyActiveSession(userUuid: string): Promise<{ active: ActiveSession; session: FishingSessionDTO } | null> {
  if (!userUuid) throw new Error('userUuid is required')
  const active = await prisma.activeFishingSession.findFirst({ where: { userUuid } })
  if (!active) return null

  const session = await prisma.fishingSession.findUnique({ where: { uuid: active.sessionId } })
  if (!session) return null

  const selfInfo = await getPlayerProfileInfo(userUuid);
  
  if (!selfInfo) {
    throw new Error('无法获取用户信息')
  }

  const sessionDto: FishingSessionDTO = {
    id: session.id,
    uuid: session.uuid,
    userUuid: session.userUuid,
    characterUuid: session.characterUuid ?? null,
    pointX: session.pointX,
    pointY: session.pointY,
    pondId: session.pondId ?? null,
    startAt: session.startAt,
    endAt: session.endAt ?? undefined,
    durationSec: session.durationSec ?? undefined,
    toolConfig: session.toolConfig ? (typeof session.toolConfig === 'string' ? JSON.parse(session.toolConfig) : session.toolConfig) : null,

    baitConfig: session.baitConfig ? (typeof session.baitConfig === 'string' ? JSON.parse(session.baitConfig) : session.baitConfig) : null,

    rngSeed: session.rndSeed ?? null,
    resultSummary: session.resultSummary ?? null,
    visiblePlayers: session.visiblePlayers ?? null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,

    actorId: session.actorId,
    actorType: session.actorType,
    endAction: session.endAction,
    endConditions: session.endConditions ?? null,
  }

  const activeDto: ActiveSession = {
    sessionId: active.sessionId,

    userUuid: active.userUuid,
    name: selfInfo?.name,
    avatar: selfInfo?.avatar,

    characterUuid: session.characterUuid ?? null,
    pointX: active.pointX,
    pointY: active.pointY,
    pondId: active.pondId ?? null,
    startedAt: active.startedAt,
    rndSeed: session.rndSeed,

    actorId: session.actorId,
    actorType: session.actorType,
    endAction: session.endAction,
    endConditions: session.endConditions ?? null,
  }

  return { active: activeDto, session: sessionDto }
}

/**
 * 结束用户的活跃钓鱼会话（如果存在），返回被删除的 active 记录。
 */
export async function endFishingSession(userUuid: string): Promise<ActiveSession | null> {
  if (!userUuid) throw new Error('userUuid is required')

  const active = await prisma.activeFishingSession.findFirst({ where: { userUuid } })
  if (!active) return null

  const selfInfo = await getPlayerProfileInfo(userUuid);
  
  if (!selfInfo) {
    throw new Error('无法获取用户信息')
  }

  // 删除活跃会话记录（保留历史 FishingSession）
  const deleted = await prisma.activeFishingSession.delete({ where: { sessionId: active.sessionId } })
  const deletedDto: ActiveSession = {
    sessionId: deleted.sessionId,

    userUuid: deleted.userUuid,
    name: selfInfo?.name,
    avatar: selfInfo?.avatar,

    characterUuid: null,
    pointX: deleted.pointX,
    pointY: deleted.pointY,
    pondId: deleted.pondId ?? null,
    startedAt: deleted.startedAt,

    rndSeed: deleted.rndSeed,

    actorId: deleted.actorId,
    actorType: deleted.actorType,
    endAction: deleted.endAction,
    endConditions: deleted.endConditions ?? null,
  }

  try {
    const member = deleted.actorId ?? deleted.userUuid;
    await redisClient.SREM('FISHING_ACTIVE_ACTOR_UUIDS', member);
  } catch (e) { console.error('closeFishingSessionForUser: failed to SREM active fishing actor', e) }
  // 取消标记用户为正在钓鱼
  try {
    const member = deleted.actorId ?? deleted.userUuid;
    await redisClient.SREM('FISHING_ACTIVE_ACTOR_UUIDS', member);
  } catch (e) { console.error('endFishingSession: failed to SREM active fishing actor', e) }
  // 更新对应的 FishingSession：endAt / status / duration
  try {
    const session = await prisma.fishingSession.findUnique({ where: { uuid: active.sessionId } })
    if (session) {
      const now = new Date()
      const durationSec = session.startAt ? Math.max(0, Math.floor((now.getTime() - session.startAt.getTime()) / 1000)) : undefined
      await prisma.fishingSession.update({ where: { uuid: session.uuid }, data: { endAt: now, status: 'COMPLETED', durationSec } }).catch(() => null)

      const remainingBaitConfig: {[key in AllFishingBaitId]?: number} = safeJsonParse(session.baitConfig, {})
      // 返还剩余鱼饵给用户
      if (remainingBaitConfig && Object.keys(remainingBaitConfig).length > 0) {
        const returnResource: ItemCountInfo = {}
        for (const [baitId, qty] of Object.entries(remainingBaitConfig)) {
          const resourceInfo = allGameResource[baitId];
          if (resourceInfo) {
            returnResource[baitId as AllFishingBaitId] = { count: qty }
          }
        }

        if (Object.keys(returnResource).length > 0) {
          await enqueueToHarvestBox(userUuid, returnResource, {
            title: `结束垂钓-饵料返还`,
            source: "Other",
          });
        }
      }

    }
  } catch (e) {
    console.error('endFishingSession: failed to update fishingSession', e)
  }

  // 从调度集合中移除（容错）
  try {
    await redisClient.ZREM(FISHING_DUE_ZSET, active.sessionId)
  } catch (e) {
    console.error('endFishingSession: failed to ZREM session', e)
  }

  return deletedDto
}