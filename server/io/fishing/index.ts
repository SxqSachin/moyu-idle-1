import { DefaultEventsMap, Socket } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser, broadcastEvent } from "..";
import { prisma } from "~/server/utils/game/db";
import { startFishingSession, getNearbyActiveFishers, createFishingBaitArea, getNearbyAndMyBaitAreas, getMyActiveSession, endFishingSession } from "~/server/utils/game/fishing";
import sensitiveWords from '~/assets/resource/sensitiveWords.json'
import { VISIBLE_RADIUS } from "~/shared/data/fishingConstant";
import type { CaughtFishDTO, SellCaughtFishReceipt } from "~/shared/types/fishing";
import { allGameResource } from "~/shared/data/allGameResources";
import { AllFishPondID } from "~/shared/data/allFishPond";
import { withUniqueLock } from "~/server/utils/lock";
import { increaseItemCount } from "~/server/utils/game/characterInventory";
import { ItemCountInfo, ModifyItemCountType } from "~/shared/types/gameInventory";
import { allFishSpecies, AllFishSpeciesID } from "~/shared/data/allFishSpecies";
import { AllFishingBaitId } from "~/shared/data/allFishBaitInfo";

// 玩家请求开始垂钓：创建会话并返回会话信息，同时返回附近玩家列表
export async function handleStartFishing(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<{
    pointX: number;
    pointY: number;
    pondId: AllFishPondID;
    characterUuid?: string | null;
    toolConfig?: Record<string, unknown> | null;
    baitConfig?: {[key in AllFishingBaitId]?: number} | null;
    endConditions?: any;
    endAction: "STOP" | "CONTINUE";
    actorType: "PLAYER" | "KITTY";
    actorId: string;
    baiting?: boolean;
    baitArea?: {
      baitId?: string;
      qty?: number;
    } | null;
  }>
) {
  const userUuid = data.user.uuid;
  const {
    pointX,
    pointY,
    pondId,
    toolConfig = null,
    baitConfig = null,
    endConditions = null,
    endAction,
    actorType,
    actorId,
    baiting = false,
    baitArea = null,
  } = data.data;

  try {
    // 参数验证
    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) {
      emitEventToUser(userUuid, "fishing:start:fail", { message: "坐标无效" });
      return;
    }

    // 如果用户选择打窝（baiting），则创建一个 FishingBaitArea（逻辑委托给 utils）
    if (baiting && baitArea && baitArea.baitId) {
        await createFishingBaitArea({
          creatorUuid: userUuid,
          pondId: pondId,
          pointX,
          pointY,
          baitArea: {
            baitId: String(baitArea.baitId),
            qty: baitArea.qty !== undefined ? Number(baitArea.qty) : 0,
          },
        })
    }

    const rndSeed =
      String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8);
    const { session, active } = await startFishingSession({
      userUuid,
      characterUuid: userUuid,
      pointX,
      pointY,
      pondId,
      toolConfig,
      baitConfig,
      endConditions,
      endAction,
      actorType,
      actorId,
      rndSeed,
    });


    // 查询附近玩家（半径使用业务默认 300，可根据需要调整）
    const nearby = await getNearbyActiveFishers({
      pointX,
      pointY,
      radius: VISIBLE_RADIUS,
      excludeUserUuid: userUuid,
      limit: 50,
    });

    // 返回创建成功与附近玩家（使用已在 utils 中映射好的 DTO）
    emitEventToUser(userUuid, "fishing:start:success", {
      session,
      active,
      nearbyPlayers: nearby,
    });
  } catch (err: any) {
    // 将错误信息暴露给客户端，避免使用 any
    const message = err.message ?? String(err);
    emitEventToUser(userUuid, "fishing:start:fail", {
      message: message || "开始垂钓失败",
    });
  }
}

// 获取当前用户的活跃钓鱼会话（用于页面初始化）
export async function handleGetMyActiveSession(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid
  try {
    const res = await getMyActiveSession(userUuid)

    if (res?.session) {
      // @ts-ignore
      delete res.session.uuid;
      // @ts-ignore
      delete res.session.userUuid;
      delete res.session.visiblePlayers;
      delete res.session.resultSummary;
      // @ts-ignore
      delete res.session.endAction;
      delete res.session.characterUuid
    }

    if (!res) {
      emitEventToUser(userUuid, 'fishing:myActive:get:success', { active: null, nearbyPlayers: [] })
      return
    }

    // 查询附近玩家（以一定半径，例如 300）
    const nearby = await getNearbyActiveFishers({ pointX: res.active.pointX, pointY: res.active.pointY, radius: VISIBLE_RADIUS, excludeUserUuid: userUuid, limit: 100 })

    emitEventToUser(userUuid, 'fishing:myActive:get:success', { active: res.active, session: res.session, nearbyPlayers: nearby })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitEventToUser(userUuid, 'fishing:myActive:get:fail', { message })
  }
}

// 客户端单独请求附近玩家（可选）
export async function handleGetNearbyFishingPlayers(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<{ pointX: number; pointY: number; }>
) {
  const userUuid = data.user.uuid
  const { pointX, pointY, } = data.data

  try {
    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) {
      emitEventToUser(userUuid, "fishing:nearby:get:fail", { message: "坐标无效" })
      return
    }

    const nearby = await getNearbyActiveFishers({ pointX, pointY, radius: VISIBLE_RADIUS, excludeUserUuid: userUuid, limit: 200 })

    emitEventToUser(userUuid, "fishing:nearby:get:success", { players: nearby })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitEventToUser(userUuid, "fishing:nearby:get:fail", { message: message || "查询附近玩家失败" })
  }
}

// 广播玩家临时消息（一次性，不持久化），并做严格过滤与限频
const shoutCooldowns = new Map<string, number>()
export async function handleSendShout(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<{ text: string }>
) {
  const userUuid = data.user.uuid
  try {
    const textRaw = (data.data && data.data.text) ? String(data.data.text) : ''
    let text = textRaw.replace(/[\u0000-\u001F\u007F]/g, '').trim()
    if (!text) {
      emitEventToUser(userUuid, 'fishing:shout:send:fail', { message: '消息不能为空' })
      return
    }

    // 限制长度
    if (text.length > 32) {
      emitEventToUser(userUuid, 'fishing:shout:send:fail', { message: '消息长度不能超过32字符' })
      return
    }

    // 严格敏感词检查（包含子串匹配，大小写不敏感）
    const lower = text.toLowerCase()
    for (const w of (sensitiveWords as string[])) {
      if (!w) continue
      const lw = String(w).toLowerCase()
      if (lw && lower.includes(lw)) {
        emitEventToUser(userUuid, 'fishing:shout:send:fail', { message: '消息包含不允许的内容' })
        return
      }
    }

    const now = Date.now()
    const cooldownUntil = shoutCooldowns.get(userUuid) ?? 0
    if (cooldownUntil > now) {
      emitEventToUser(userUuid, 'fishing:shout:send:fail', { message: '请稍后再发送消息' })
      return
    }

    // 需要用户处于活跃钓鱼会话中以便在地图上显示坐标
    const my = await getMyActiveSession(userUuid)
    if (!my || !my.active) {
      emitEventToUser(userUuid, 'fishing:shout:send:fail', { message: '当前没有活跃钓鱼会话' })
      return
    }

    // 设定 cooldown 与过期时间（10s）
    const expiresAt = Date.now() + 10_000
    shoutCooldowns.set(userUuid, expiresAt)

    // 广播（服务器不做持久化），客户端负责可见性判断
    const payload = {
      userUuid,
      text,
      pointX: my.active.pointX,
      pointY: my.active.pointY,
      expiresAt,
    }

    // 向所有在线客户端广播，客户端会根据可见性决定是否渲染
    broadcastEvent('fishing:shout:received', payload)

    // 告知发送者成功（包含过期时间，客户端可据此进行本地限频控制）
    emitEventToUser(userUuid, 'fishing:shout:send:success', { expiresAt })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitEventToUser(userUuid, 'fishing:shout:send:fail', { message: message || '发送失败' })
  }
}

// 获取指定点附近的 bait areas（以及当前用户创建的全部 bait areas）
export async function handleGetBaitAreas(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<{ pointX: number; pointY: number }>
) {
  const userUuid = data.user.uuid
  const { pointX, pointY } = data.data || {}
  try {
    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) {
      emitEventToUser(userUuid, 'fishing:baitAreas:get:fail', { message: 'pointX/pointY required' })
      return
    }

    const { nearby, mine } = await getNearbyAndMyBaitAreas({ pointX, pointY, radius: VISIBLE_RADIUS, userUuid })

    emitEventToUser(userUuid, 'fishing:baitAreas:get:success', { nearby, mine })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitEventToUser(userUuid, 'fishing:baitAreas:get:fail', { message })
  }
}

// 客户端请求只获取当前用户自己创建的所有 bait areas（用于初始化专门拉取“我的打窝”）
export async function handleGetMyBaitAreas(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid
  try {
    const { mine } = await getNearbyAndMyBaitAreas({ pointX: -99999, pointY: -999999, radius: VISIBLE_RADIUS, userUuid })

    // 返回 mine 列表
    emitEventToUser(userUuid, 'fishing:myBaitAreas:get:success', { mine })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitEventToUser(userUuid, 'fishing:myBaitAreas:get:fail', { message })
  }
}

// 客户端请求结束当前活跃钓鱼会话
export async function handleEndFishing(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid
  try {
    const deleted = await endFishingSession(userUuid)
    if (!deleted) {
      emitEventToUser(userUuid, 'fishing:end:fail', { message: '没有活跃的钓鱼会话' })
      return
    }

    // 成功结束
    emitEventToUser(userUuid, 'fishing:end:success', { sessionId: deleted.sessionId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitEventToUser(userUuid, 'fishing:end:fail', { message: message || '结束钓鱼失败' })
  }
}

// 客户端请求拉取某个会话的捕获记录（需要权限/可见性校验）
export async function handleGetCatches(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<{ sessionId: string }>
) {
  const userUuid = data.user.uuid
  const applier = await prisma.user.findUnique({ where: { uuid: userUuid } })
  try {
    const { sessionId } = data.data || {}
    if (!sessionId) {
      emitEventToUser(userUuid, 'fishing:catches:get:fail', { message: 'missing sessionId' })
      return
    }

    const session = await prisma.fishingSession.findUnique({ where: { uuid: sessionId } })
    if (!session) {
      emitEventToUser(userUuid, 'fishing:catches:get:fail', { message: 'session not found' })
      return
    }

    if (userUuid == session.userUuid) {
      const catches = await prisma.caughtFish.findMany({ where: { sessionId }, orderBy: { caughtAt: 'desc' }, take: 500 })

      const res: CaughtFishDTO[] = catches.map(c => {
        return {
          ...c,
          asResource: c.asResource,
          resourceResult: c.resourceResult ? JSON.parse(c.resourceResult) : undefined,
        }
      })

      emitEventToUser(userUuid, 'fishing:catches:get:success', { sessionId, data: res })
      return;
    }

    // 如果请求者不是会话拥有者，需要有活跃会话并且在可见范围内
    const myActive = await getMyActiveSession(userUuid)
    if (!myActive || !myActive.active) {
        emitEventToUser(userUuid, 'fishing:catches:get:fail', { sessionId, message: 'forbidden' })
      return
    }

    const a = myActive.active
    const dx = (a.pointX - (session.pointX ?? 0))
    const dy = (a.pointY - (session.pointY ?? 0))
    const dist2 = dx * dx + dy * dy

    let radius = VISIBLE_RADIUS;
    if (applier?.is_gm) {
      radius = 999999;
    }

    if (dist2 > radius * radius) {
      emitEventToUser(userUuid, 'fishing:catches:get:fail', { sessionId, message: 'out of visible range' })
      return
    }

    const catches = await prisma.caughtFish.findMany({ where: { sessionId }, orderBy: { caughtAt: 'desc' }, take: 500 })

    const res: CaughtFishDTO[] = catches.map(c => {
      return {
        ...c,
        asResource: c.asResource,
        resourceResult: c.resourceResult ? JSON.parse(c.resourceResult) : undefined,
      }
    })

    emitEventToUser(userUuid, 'fishing:catches:get:success', { sessionId, data: res })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitEventToUser(userUuid, 'fishing:catches:get:fail', { message })
  }
}

// 客户端请求获取当前用户的全部钓鱼会话（历史 + 当前）
export async function handleGetMySessions(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid
  try {
    const sessions = await prisma.fishingSession.findMany({
      where: { userUuid },
      orderBy: { startAt: 'desc' },
      take: 100,
    })

    emitEventToUser(userUuid, 'fishing:sessions:get:success', { data: sessions })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitEventToUser(userUuid, 'fishing:sessions:get:fail', { message })
  }
}

// 获取当前用户的全部鱼获（asResource = false），按 caughtAt 倒序
export async function handleGetMyCatches(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid
  try {
    const catches = await prisma.caughtFish.findMany({
      where: { userUuid, asResource: false },
      orderBy: { caughtAt: 'desc' },
      take: 1000,
    })

    const res: CaughtFishDTO[] = catches.map(c => ({
      ...c,
      resourceResult: c.resourceResult ? JSON.parse(c.resourceResult) : undefined,
    }))

    emitEventToUser(userUuid, 'fishing:myCatches:get:success', { data: res })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitEventToUser(userUuid, 'fishing:myCatches:get:fail', { message })
  }
}

// 获取排行榜：按 fishId 分组，返回每种鱼的最大长度记录和最大重量记录（asResource = false）
export async function handleGetLeaderboard(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid
  try {
    // Optimized approach: let DB compute per-fish maxima, then merge results in one roundtrip per metric.
    // Query 1: rows that have the maximum length per fishId (asResource = 0)
    // Parameterized queries using Prisma tagged templates to avoid injection.
    // Force derived-first execution: compute per-fish maxima first, then join to CaughtFish
    const maxLenQuery = prisma.$queryRaw`
      SELECT c.id, c.fishId, c.length, c.weight, c.quality, c.caughtAt, c.userUuid, c.resourceResult
      FROM (
        SELECT fishId, MAX(length) AS max_len
        FROM CaughtFish
        WHERE asResource = ${0}
        GROUP BY fishId
      ) m
      JOIN CaughtFish c
        ON c.fishId = m.fishId AND c.length = m.max_len AND c.asResource = ${0}
    `

    const maxWeightQuery = prisma.$queryRaw`
      SELECT c.id, c.fishId, c.length, c.weight, c.quality, c.caughtAt, c.userUuid, c.resourceResult
      FROM (
        SELECT fishId, MAX(weight) AS max_wt
        FROM CaughtFish
        WHERE asResource = ${0}
        GROUP BY fishId
      ) m
      JOIN CaughtFish c
        ON c.fishId = m.fishId AND c.weight = m.max_wt AND c.asResource = ${0}
    `

    const [maxLenRows, maxWeightRows] = await Promise.all([
      maxLenQuery,
      maxWeightQuery,
    ]) as Array<any[]>

    // Merge results by fishId
    const map = new Map<string, { maxLength?: any; maxWeight?: any }>()

    for (const r of maxLenRows) {
      const fishId = String(r.fishId)
      const entry = map.get(fishId) ?? {}
      entry.maxLength = {
        id: r.id,
        fishId: r.fishId,
        length: Number(r.length),
        weight: Number(r.weight),
        quality: r.quality,
        caughtAt: r.caughtAt,
        userUuid: r.userUuid,
        resourceResult: r.resourceResult ? JSON.parse(r.resourceResult) : undefined,
      }
      map.set(fishId, entry)
    }

    for (const r of maxWeightRows) {
      const fishId = String(r.fishId)
      const entry = map.get(fishId) ?? {}
      entry.maxWeight = {
        id: r.id,
        fishId: r.fishId,
        length: Number(r.length),
        weight: Number(r.weight),
        quality: r.quality,
        caughtAt: r.caughtAt,
        userUuid: r.userUuid,
        resourceResult: r.resourceResult ? JSON.parse(r.resourceResult) : undefined,
      }
      map.set(fishId, entry)
    }

    const groups: Array<{ fishId: string; maxLength?: CaughtFishDTO | null; maxWeight?: CaughtFishDTO | null }> = []
    for (const [fishId, v] of map.entries()) {
      groups.push({ fishId, maxLength: v.maxLength ?? null, maxWeight: v.maxWeight ?? null })
    }

    emitEventToUser(userUuid, 'fishing:leaderboard:get:success', { data: groups })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitEventToUser(userUuid, 'fishing:leaderboard:get:fail', { message })
  }
}

// 出售单条鱼获：严格验证所有权与 id，使用事务执行增减并删除 caughtFish 记录
export async function handleSellCaughtFish(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<{ caughtFishId: number }>
) {
  const userUuid = data.user.uuid
  try {
    const { caughtFishId } = data.data || {}
    if (!Number.isInteger(caughtFishId) || caughtFishId <= 0) {
      emitEventToUser(userUuid, 'fishing:sell:fail', { message: 'invalid caughtFishId' })
      return
    }

    await withUniqueLock(`fishing-sell:${userUuid}`, async () => {
      return await prisma.$transaction(async (tx) => {
        const fishRow = await tx.caughtFish.findUnique({ where: { id: caughtFishId } })
        if (!fishRow) throw new Error('caughtFish not found')
        if (fishRow.userUuid !== userUuid) throw new Error('not owner')

        // 计算出售价格（依据 species 配置）
        const speciesMeta = allFishSpecies[fishRow.fishId as AllFishSpeciesID]
        const base = speciesMeta?.shopBaseRecallPrice ?? 0
        const length = fishRow.length ?? 0
        const weight = fishRow.weight ?? 0
        const quality = fishRow.quality ?? 0

        const lengthBonus = (speciesMeta?.extraPriceForEachLength ?? 0) * length
        const weightBonus = (speciesMeta?.extraPriceForEachWeight ?? 0) * (weight || 0)
        const qualityBonus = (speciesMeta?.extraPriceForEachQuality ?? 0) * quality

        let total = Math.max(0, Math.floor(base + lengthBonus + weightBonus + qualityBonus))

        total = Math.floor(total)

        if (total <= 0) throw new Error('no sell value')

        // 给用户发放收益（以 gold 为例）
        const gain: ItemCountInfo = { gold: { count: total } }

        await increaseItemCount(userUuid, gain, {
          actionName: '出售鱼获',
          type: ModifyItemCountType.Market,
          showModifyInfo: true,
          sendModifyEvent: true,
        }, tx)
        await invalidateInventoryCache(userUuid);

        // 删除该条鱼获记录
        await tx.caughtFish.delete({ where: { id: caughtFishId } })

        // 事务内完成后，返回
        emitEventToUser(userUuid, 'fishing:sell:success', { caughtFishId, received: gain })
      })
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitEventToUser(userUuid, 'fishing:sell:fail', { message })
  }
}

// 批量出售鱼获：严格检查输入与所有权，保证与单条出售互斥
export async function handleBatchSellCaughtFish(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
  data: GameSocketData<{ caughtFishIds: number[] }>
) {
  const userUuid = data.user.uuid
  try {
    const idsRaw = data.data?.caughtFishIds
    if (!Array.isArray(idsRaw)) {
      emitEventToUser(userUuid, 'fishing:sell:batch:fail', { message: '至少选择一条鱼获' })
      return
    }

    const normalized = Array.from(new Set(idsRaw.filter((id) => Number.isInteger(id) && id > 0)))
    if (normalized.length === 0) {
      emitEventToUser(userUuid, 'fishing:sell:batch:fail', { message: '至少选择一条鱼获' })
      return
    }

    await withUniqueLock(`fishing-sell:${userUuid}`, async () => {
      return prisma.$transaction(async (tx) => {
        const fishes = await tx.caughtFish.findMany({
          where: { id: { in: normalized }, userUuid, asResource: false },
          orderBy: { id: 'asc' },
        })

        if (fishes.length !== normalized.length) {
          throw new Error('部分鱼获不存在或不属于当前用户')
        }

        const receipts: SellCaughtFishReceipt[] = []
        let totalAmount = 0

        for (const fish of fishes) {
          const fishId = fish.fishId as AllFishSpeciesID;
          const speciesMeta = allFishSpecies[fishId]
          const base = Number(speciesMeta?.shopBaseRecallPrice ?? 0)
          const length = Number(fish.length ?? 0)
          const weight = Number(fish.weight ?? 0)
          const quality = Number(fish.quality ?? 0)

          const lengthBonus = (speciesMeta?.extraPriceForEachLength ?? 0) * length
          const weightBonus = (speciesMeta?.extraPriceForEachWeight ?? 0) * weight
          const qualityBonus = (speciesMeta?.extraPriceForEachQuality ?? 0) * quality

          const amount = Math.max(0, Math.floor(base + lengthBonus + weightBonus + qualityBonus))
          if (amount <= 0) throw new Error(`caughtFish ${fish.id} has no sell value`)

          receipts.push({
            caughtFishId: fish.id,
            fishId: fishId,
            length,
            weight,
            quality,
            amount,
          })

          totalAmount += amount
        }

        if (totalAmount <= 0) throw new Error('no sell value')

        const gain: ItemCountInfo = { gold: { count: totalAmount } }

        await increaseItemCount(userUuid, gain, {
          actionName: '批量出售鱼获',
          type: ModifyItemCountType.Market,
          showModifyInfo: true,
          sendModifyEvent: true,
        }, tx)
        await invalidateInventoryCache(userUuid);

        await tx.caughtFish.deleteMany({ where: { id: { in: normalized } } })

        emitEventToUser(userUuid, 'fishing:sell:batch:success', { sold: receipts, totalAmount, received: gain })
      })
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitEventToUser(userUuid, 'fishing:sell:batch:fail', { message })
  }
}
