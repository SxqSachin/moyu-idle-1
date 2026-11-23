import { prisma } from "../prisma"
import type { FishingSessionDTO, ActiveSession, NearbyPlayer, FishSpecies } from '~/shared/types/fishing'
import { allFishPond, type AllFishPondID } from '~/shared/data/allFishPond'
import { getCharacterStatusInfo, increaseCharacterStatusExp } from "./characterStatus"
import crypto from 'crypto'
import { v7 } from 'uuid'
import type { CaughtFish, FishingBaitArea, FishingSession } from "~/generated/prisma"
import { FISHING_DUE_ZSET } from "~/shared/data/fishingConstant"
import { allFishSpecies, allFishSpeciesIds } from "~/shared/data/allFishSpecies"
import { allGameResource } from "~/shared/data/allGameResources"
import { allFishingBaits } from "~/shared/data/allFishBaitInfo"
import { getRandomElementInPoolWithWeight, randomElementInCollection, randomNumberInFullColseRange, safeJsonParse } from "~/shared/utils"
import type { FishBaitInfo } from '~/shared/types/fishing'
import { enqueueToHarvestBox } from "./harvestBox"

const overrideFishSpeciesMap: {[key in typeof allFishSpeciesIds[number]]?: FishSpecies} = {
  "rareThing": {
    "id": "rareThing",
    "name": "稀有的小玩意儿",
    "icon": "",
    "description": "",
    "percent": 0.005,
    "rarity": 1,
    "qualityWeight": [],
    "minLength": 0,
    "maxLength": 0,
    "minWeight": 0,
    "maxWeight": 100,
    "neededStatus": [],
    "neededConfiguration": {},
    "neededBait": [],
    "activeHours": {
      "start": "03:00",
      "end": "19:00"
    },
    "shopBaseRecallPrice": 0,
    "extraPriceForEachLength": 0,
    "extraPriceForEachWeight": 0,
    "extraPriceForEachQuality": 0,
    "disabled": false,
    "asResource": true,
    "resourcePool": {
      "fish": 93,
      "cuteOutfit": 2,
      "cuteHat": 2,
      "cuteDoll": 2,
      "cuteIronBox": 1
    },
    "exp": 1
  },
}

// 导出：计算会话/位置的饵料综合效果（可被其他进程调用）
export interface BaitModifiers {
  baitIds: string[];
  areaCount: number;
  // 会话（session）中显式使用的饵料 id 列表
  sessionBaitIds: string[];

  // area 层面的最大类效果（覆盖该点的所有 area 中取最大）
  areaBiteRateIncreasePercent: number;
  areaHookTimeReductionPercent: number;
  areaPreferredSpeciesPercentBoost: Record<string, number>;
  areaPreferredSpeciesWeightBoost: Record<string, number>;

  // session 层面的累加类效果（会话内道具/饵料按会话累加）
  sessionBiteRateIncreasePercent: number;
  sessionHookTimeReductionPercent: number;
  sessionPreferredSpeciesPercentBoost: Record<string, number>;

  // 对每种鱼类的命中率百分比加成（area 部分取最大，session 部分累加，返回合并值）
  // preferredSpeciesPercentBoost: Record<string, number>;
  // 对每种鱼类的权重加成（area 与 session 均可叠加）
  // preferredSpeciesWeightBoost: Record<string, number>;
}

export async function computeEffectiveBaitModifiersForSession(opts: { session: FishingSession; pondId: string; pointX: number; pointY: number; userUuid: string }): Promise<BaitModifiers> {
  const { pondId, pointX, pointY, session } = opts;

  const out: BaitModifiers = {
    baitIds: [],
    areaCount: 0,
    sessionBaitIds: [],
    areaBiteRateIncreasePercent: 0,
    areaHookTimeReductionPercent: 0,
    areaPreferredSpeciesPercentBoost: {},
    areaPreferredSpeciesWeightBoost: {},

    sessionBiteRateIncreasePercent: 0,
    sessionHookTimeReductionPercent: 0,
    sessionPreferredSpeciesPercentBoost: {},
  };

  // 查询会话的 baitConfig（如果提供）
  let sessionBaits: string[] = [];
  const parsed = safeJsonParse<Record<string, unknown>>(session.baitConfig as string) || {};
  sessionBaits = Object.keys(parsed);

  // 获取 pond 下所有 active bait areas
  const areas = await prisma.fishingBaitArea.findMany({
    where: {
      pondId,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  // area 层面的临时汇总（对某些字段取最大，对 weight boost 可累加）
  const areaBaitIds = new Set<string>();
  let areaCnt = 0;
  const tmpAreaPreferredPercent: Record<string, number> = {};
  const tmpAreaPreferredWeight: Record<string, number> = {};
  let tmpAreaBiteRateMax = 0;
  let tmpAreaHookTimeReductionMax = 0;

  for (const a of areas) {
    if (typeof pointX === 'number' && typeof pointY === 'number') {
      const dx = pointX - (a.pointX as number);
      const dy = pointY - (a.pointY as number);
      const r = (a.radius as number) || 0;
      if (dx * dx + dy * dy <= r * r) {
        areaCnt += 1;
        if (a.baitId) areaBaitIds.add(a.baitId);

        const info = allFishingBaits[(a.baitId as keyof typeof allFishingBaits)] as FishBaitInfo | undefined;
        if (!info) continue;

        tmpAreaBiteRateMax = Math.max(tmpAreaBiteRateMax, info.baitAreaBiteRateIncreasePercent ?? 0);
        tmpAreaHookTimeReductionMax = Math.max(tmpAreaHookTimeReductionMax, info.baitAreaHookTimeReductionPercent ?? 0);

        for (const [sid, val] of Object.entries(info.baitAreaPreferredSpeciesPercentBoost ?? {})) {
          tmpAreaPreferredPercent[sid] = Math.max(tmpAreaPreferredPercent[sid] || 0, Number(val ?? 0));
        }
        for (const [sid, val] of Object.entries(info.baitAreaPreferredSpeciesWeightBoost ?? {})) {
          tmpAreaPreferredWeight[sid] = (tmpAreaPreferredWeight[sid] || 0) + Number(val ?? 0);
        }
      }
    }
  }

  // 会话内饵料（session）统计，单独作为一类
  const sessionSet = new Set<string>(sessionBaits || []);
  let tmpSessionBite = 0;
  let tmpSessionHook = 0;
  const tmpSessionPreferredPercent: Record<string, number> = {};

  for (const bid of sessionSet) {
    const info = allFishingBaits[bid as keyof typeof allFishingBaits] as FishBaitInfo | undefined;
    if (!info) continue;
    tmpSessionBite += info.biteRateIncreasePercent ?? 0;
    tmpSessionHook += info.hookTimeReductionPercent ?? 0;
    for (const [sid, val] of Object.entries(info.preferredSpeciesBoost ?? {})) {
      tmpSessionPreferredPercent[sid] = (tmpSessionPreferredPercent[sid] || 0) + Number(val ?? 0);
    }
  }

  // 合并并输出
  const combinedBaitSet = new Set<string>([...Array.from(areaBaitIds), ...Array.from(sessionSet)]);
  out.baitIds = Array.from(combinedBaitSet);
  out.areaCount = areaCnt;
  out.sessionBaitIds = Array.from(sessionSet);

  out.areaBiteRateIncreasePercent = tmpAreaBiteRateMax;
  out.areaHookTimeReductionPercent = tmpAreaHookTimeReductionMax;
  out.areaPreferredSpeciesPercentBoost = tmpAreaPreferredPercent;
  out.areaPreferredSpeciesWeightBoost = tmpAreaPreferredWeight;


  out.sessionBiteRateIncreasePercent = tmpSessionBite;
  out.sessionHookTimeReductionPercent = tmpSessionHook;
  out.sessionPreferredSpeciesPercentBoost = tmpSessionPreferredPercent;

  return out;
}

/**
 * 消耗会话内的一份饵料
 * - session: `FishingSession` 实例（包含 uuid 与 baitConfig）
 * - baitId: 要消耗的饵料 id
 * 返回 true 表示成功消耗并已写回 DB，false 表示没有库存或消耗失败
 */
export async function consumeSessionBait(session: FishingSession, baitId: string): Promise<boolean> {
  if (!session || !baitId) return false;
  try {
    const parsed = safeJsonParse<Record<string, number>>(session.baitConfig as string) || {};
    const count = parsed[baitId] ?? 0;
    if (count <= 0) return false;
    parsed[baitId] = Math.max(0, count - 1);
    const json = JSON.stringify(parsed);
    try {
      await prisma.fishingSession.update({ where: { uuid: session.uuid }, data: { baitConfig: json } });
    } catch (e: any) {
      console.error('consumeSessionBait: failed to update fishingSession baitConfig', e?.message ?? String(e));
      return false;
    }
    return true;
  } catch (e: any) {
    console.error('consumeSessionBait: error parsing or updating baitConfig', e?.message ?? String(e));
    return false;
  }
}

/**
 * 尝试为一次捕获选择并消耗会话饵料。
 * - 会基于 species 的 need 与会话内饵料、以及 session 层面的加成判断是否应消耗
 * - 若成功消耗，会同时更新传入的 `sessionBaitCounts`（内存副本）以保持一致
 * 返回 true 表示已成功消耗（并已写回 DB），false 表示未消耗
 */
export async function tryConsumeBaitForCatch(
  session: FishingSession,
  sessionBaitCounts: Record<string, number>,
  species: FishSpecies,
  modifiers: BaitModifiers
): Promise<boolean> {
  try {
    const hasSessionBait = Object.keys(sessionBaitCounts).some(k => (sessionBaitCounts[k] || 0) > 0);
    if (!hasSessionBait) return false;

    const need = species.neededBait ?? [];
    const baitIntersection = need.filter(nb => (sessionBaitCounts[nb] || 0) > 0);
    const sessionInfluence = (modifiers.sessionBiteRateIncreasePercent || 0) > 0 || ((modifiers.sessionPreferredSpeciesPercentBoost || {})[species.id] ?? 0) > 0;

    if (!(baitIntersection.length > 0 || sessionInfluence)) return false;

    // 优先消费与 species 匹配的饵料；若无则消费任意会话内有库存的饵料
    let consumeId: string | undefined;
    if (baitIntersection.length > 0) consumeId = baitIntersection[0];
    else consumeId = Object.keys(sessionBaitCounts).find(k => (sessionBaitCounts[k] || 0) > 0);

    if (!consumeId) return false;

    const ok = await consumeSessionBait(session, consumeId);
    if (ok) {
      sessionBaitCounts[consumeId] = Math.max(0, (sessionBaitCounts[consumeId] || 0) - 1);
      return true;
    }
    return false;
  } catch (e: any) {
    console.error('tryConsumeBaitForCatch: error', e?.message ?? String(e));
    return false;
  }
}

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


/**
 * 根据 `pondId` 与 `seed` 以及时间点，确定一次“鱼获”的方法（确定性、可复现）
 *
 * 规则：
 * - 只从 `allFishPond[pondId].fishConfig` 中挑选候选鱼类
 * - 根据每个候选的 `weight`（相对权重）进行加权采样
 * - 在采样前会过滤掉不在当前时间段 `activeHours` 内的鱼类
 * - 随机数由 `seed`（若无则使用 pondId）与时间戳一起生成，保证同一 seed + 时间得到相同结果
 * - 返回值包含 `speciesId`、species 元数据、以及按 species 的 min/max 计算出的确定性长度与重量
 *
 * 返回 null 表示没有可用候选（例如 pondId 无效或全部鱼类在非活跃时段）
 */
export async function sampleFishForPond(pondId: AllFishPondID, seed: string, at: Date, opts: { sessionId: string; userUuid: string }) {
  const pid = pondId ?? Object.keys(allFishPond)[0]
  const pond = allFishPond[pid]
  if (!pond) return null

  // ===== 辅助类型与方法（中文注释） =====

  const sess = await prisma.fishingSession.findUnique({ where: { uuid: opts.sessionId } })
  if (!sess) return null

  // 查询并返回指定 pond 下仍然 active 的 bait areas（不做距离过滤）
  async function fetchActiveBaitAreasForPond(pondIdArg: string): Promise<FishingBaitArea[]> {
    const rows = await prisma.fishingBaitArea.findMany({
      where: {
        pondId: pondIdArg,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    const out: FishingBaitArea[] = []
    for (const r of rows) {
      if (r && typeof r === 'object' && r !== null && 'pointX' in r && 'pointY' in r && 'radius' in r) {
        const rec = r as Record<string, unknown>
        const px = rec['pointX']
        const py = rec['pointY']
        const pr = rec['radius']
        if (typeof px === 'number' && typeof py === 'number' && typeof pr === 'number') {
          out.push(r)
        }
      }
    }
    return out
  }

  // 合并会话内饵料与附近 area 饵料，返回最终生效的饵料数组
  // 注意：上层代码会尽量避免对同一会话重复请求，这里保留简单实现以便单独使用场景。
  let candidates: Array<{ speciesId: string; percent: number, weight: number; species: FishSpecies }> = []

  // 如果提供了 sessionId，先一次性获取会话相关的饵料与 area 汇总，避免重复请求
  let playerBaitsSet = new Set<string>()
  let nearbyAreaCount = 0
  const BAIT_AREA_BOOST_PER_AREA = 0.10
  const MAX_MULTIPLIER = 2

  const modifiers = await computeEffectiveBaitModifiersForSession({ session: sess, pondId: pid, pointX: sess?.pointX ?? null, pointY: sess?.pointY ?? null, userUuid: opts.userUuid })
  nearbyAreaCount = modifiers.areaCount
  playerBaitsSet = new Set<string>(modifiers.baitIds)

  // 解析会话内的饵料配置（{ baitId: count }）用于消耗逻辑
  let sessionBaitCounts: Record<string, number> = {};
  try {
    sessionBaitCounts = safeJsonParse<Record<string, number>>(sess.baitConfig as string) || {};
  } catch (e) {
    sessionBaitCounts = {};
  }

  for (const fc of pond.fishConfig ?? []) {
    const sid = fc.speciesId
    const species = overrideFishSpeciesMap[sid] ?? allFishSpecies[sid]
    if (!species) continue

    // activeHours check：如果 species.activeHours 存在，则判断当前时间是否在区间内
    const ah = species.activeHours
    if (ah && typeof ah.start === 'string' && typeof ah.end === 'string') {
      const now = at
      const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes()
      const startParts = ah.start.split(':').map((s: string) => parseInt(s, 10))
      const endParts = ah.end.split(':').map((s: string) => parseInt(s, 10))
      const startMin = (startParts[0] || 0) * 60 + (startParts[1] || 0)
      const endMin = (endParts[0] || 0) * 60 + (endParts[1] || 0)
      const nowMin = minutes(now)
      let inWindow = false
      if (startMin <= endMin) {
        inWindow = nowMin >= startMin && nowMin <= endMin
      } else {
        // 跨日区间，例如 23:00 - 06:00
        inWindow = nowMin >= startMin || nowMin <= endMin
      }
      if (!inWindow) continue
    }

    // 如果 species 对饵料有要求，且玩家当前没有相应饵料，则跳过该 species
    const need = species.neededBait ?? []
    if (Array.isArray(need) && need.length > 0) {
      // species may accept any of the listed baits — require intersection
      const hasAny = need.some((nb: string) => playerBaitsSet.has(nb))
      if (!hasAny) {

        // 10% 概率放行（避免饵料不够时完全钓不到鱼的情况）
        if (randomNumberInFullColseRange(0, 1) < 0.9) {
          continue;
        }
      }
    }

    // 通过 pond 配置的 weight 与 species 数据一同作为候选
    candidates.push({ speciesId: sid, percent: species.percent, weight: fc.weight ?? 1, species })
  }

  // 根据每个候选项的 percent，过滤掉此次没有命中的鱼类
  // 如果 fish species 不是 asResource，且玩家周围有打窝 area，则提高该 species 的命中概率（按原始几率的线性增益），
  // 增益按每个 area 提升 `BAIT_AREA_BOOST_PER_AREA` 的倍数（对原始 percent 做放大），最终按 1.0 截断。
  candidates = candidates.filter(c => {
    const percent = c.percent ?? 0
    if (percent <= 0) return false

    let adjustedPercent = percent

    const areaBoost = modifiers.areaBiteRateIncreasePercent || 0
    const sessionBoost = modifiers.sessionBiteRateIncreasePercent || 0


    const sessionPreferredPercent = modifiers.sessionPreferredSpeciesPercentBoost?.[c.speciesId] ?? 0
    const areaPreferredPercent = modifiers.areaPreferredSpeciesPercentBoost?.[c.speciesId] ?? 0

    adjustedPercent = Math.min(1, adjustedPercent + areaBoost + sessionBoost + sessionPreferredPercent + areaPreferredPercent)

    if (adjustedPercent >= 1) return true

    const rPercent = randomNumberInFullColseRange(0, 1)
    return rPercent < adjustedPercent
  })

  if (candidates.length === 0) return null

  // 根据 preferredSpeciesWeightBoost 调整权重（不修改原 candidates 对象）
  const candidateWeights = candidates.map(c => {
    const baseWeight = c.weight;

    const wboost = modifiers.areaPreferredSpeciesWeightBoost?.[c.speciesId] ?? 0

    const adjWeight = baseWeight + wboost
    return { c, adjWeight }
  })

  // 计算权重总和
  const total = candidateWeights.reduce((s, cw) => s + cw.adjWeight, 0)
  if (total <= 0) return null

  // 生成确定性伪随机数 [0,1)
  const seedBase = `${seed ?? pid}:${Math.floor(at.getTime() / 1000)}`
  const h = crypto.createHash('sha256').update(seedBase).digest('hex')
  // 取前 12 位 hex -> number
  const sub = h.slice(0, 12)
  const randVal = (parseInt(sub, 16) % 1_000_000) / 1_000_000

  // 根据权重选取 species（基于本地 adjWeight，不修改 candidates）
  let acc = 0
  const target = randVal * total
  let chosenWrapper = candidateWeights[0]
  for (const cw of candidateWeights) {
    acc += cw.adjWeight
    if (target <= acc) { chosenWrapper = cw; break }
  }
  const chosen = chosenWrapper.c

  // 命中了过后，直接给予相应的经验值
  if (chosen.species.exp) {
    await increaseCharacterStatusExp(opts.userUuid, [
      {
        status: "fishing",
        increaseExp: chosen.species.exp,
      },
    ]);
  }

  // 如果该 species 是 asResource，则直接返回资源结果
  if (chosen.species.asResource) {
    const pool = chosen.species.resourcePool || {}
    let finalResourceId = getRandomElementInPoolWithWeight(pool)
    
    if (finalResourceId && allGameResource[finalResourceId]) {
      const cfData: Omit<CaughtFish, 'id'> = {
        userUuid: opts.userUuid,
        pondId: pid,
        sessionId: opts.sessionId,
        fishId: chosen.speciesId,
        length: 0,
        weight: 0,
        quality: 0,
        caughtAt: at,
        createdAt: at,
        extra: null, 

        asResource: chosen.species.asResource ?? false,
        resourceResult: JSON.stringify({ [finalResourceId]: 1 }),
      }

      // 尝试写入 caughtFish 表（字段名以 schema 中常见命名为准），失败时记录错误但不抛出
      await prisma.caughtFish.create({ data: cfData })

      // 直接加入收获箱
      await enqueueToHarvestBox(
        opts.userUuid,
        {
          [finalResourceId]: {
            count: 1,
          },
        },
        {
            title: "垂钓收获",
            source: "Event", // `${pondId}-${seed}-${opts.sessionId}`,
            extra: {},
        }
      );
    }
      // 捕获成功：尝试以统一方法选择并消耗会话饵料
      try {
        await tryConsumeBaitForCatch(sess, sessionBaitCounts, chosen.species, modifiers);
      } catch (e: any) {
        console.error('sampleFishForPond: bait consumption error (asResource):', e?.message ?? String(e));
      }

      return;
  }

  // 质量（quality）优先决定：先按权重（species.qualityWeights 可配置）选择 quality（0..4），
  // 然后在该 quality 对应的区间内（fraction of [min,max]）决定长度和重量。
  // 使用多个确定性随机片段以保证可复现性。
  const sub2 = h.slice(12, 24)
  const sub3 = h.slice(24, 36)
  const sub4 = h.slice(36, 48)
  const rndLen = (parseInt(sub2, 16) % 1_000_000) / 1_000_000
  const rndW = (parseInt(sub3, 16) % 1_000_000) / 1_000_000
  const rndQ = (parseInt(sub4, 16) % 1_000_000) / 1_000_000

  // quality 权重：species 可以提供 qualityWeights: number[5]，否则使用默认稀疏分布（高品质更稀有）
  // 固定质量权重：5 个等级 (0..4)。为了使最高稀有度（4）约为 1% 的概率，
  // 我们使用权重和为 100 的分配，示例： [50,30,15,4,1] -> top = 1/100 = 1%
  // 如果需要更极端或更温和的分布，可在这里调整。
  const defaultQualityWeights = [50, 30, 15, 4, 1]
  const qualityWeights: number[] = chosen.species.qualityWeight ?? defaultQualityWeights;

  const totalQ = qualityWeights.reduce((s, n) => s + (n || 0), 0) || 1
  let accQ = 0
  let sampledQuality = 0
  for (let i = 0; i < qualityWeights.length; i++) {
    accQ += qualityWeights[i]
    if (rndQ * totalQ <= accQ) {
      sampledQuality = i
      break
    }
  }

  // quality -> fraction ranges inside [min,max]
  // 可以由 species.qualityRanges 提供覆盖，格式为 Array<[minFrac,maxFrac]> 长度 5
  const defaultQualityRanges: [number, number][] = [
    [0.0, 0.32],
    [0.18, 0.52],
    [0.45, 0.75],
    [0.68, 0.92],
    [0.86, 1.0],
  ]
  // 安全读取 species 上可选的 qualityRanges（避免使用 any）
  const speciesMeta = chosen.species as unknown as Record<string, unknown>
  const qRanges: [number, number][] = Array.isArray(speciesMeta.qualityRanges) && (speciesMeta.qualityRanges as unknown[]).length === 5
    ? (speciesMeta.qualityRanges as unknown) as [number, number][]
    : defaultQualityRanges

  const fracLRange = qRanges[Math.max(0, Math.min(4, sampledQuality))] || defaultQualityRanges[0]
  const fracWRange = qRanges[Math.max(0, Math.min(4, sampledQuality))] || defaultQualityRanges[0]

  const minL = (chosen.species.minLength ?? 1)
  const maxL = (chosen.species.maxLength ?? minL)
  const fracL = fracLRange[0] + rndLen * (Math.max(fracLRange[1], fracLRange[0]) - fracLRange[0])
  const rawLength = minL + fracL * Math.max(0, (maxL - minL))
  const length = parseFloat(rawLength.toFixed(1))

  const minW = (chosen.species.minWeight ?? 1)
  const maxW = (chosen.species.maxWeight ?? minW)
  const fracW = fracWRange[0] + rndW * (Math.max(fracWRange[1], fracWRange[0]) - fracWRange[0])
  const rawWeight = minW + fracW * Math.max(0, (maxW - minW))
  const weight = parseFloat(rawWeight.toFixed(1))

  const result = {
    pondId: pid,
    speciesId: chosen.speciesId,
    species: chosen.species,
    length,
    weight,
  }

  // 如果传入了 sessionId / userUuid，则将该条捕获写入 CaughtFish 表（尽量容错）
  if (opts && (opts.sessionId || opts.userUuid)) {
    try {
        // quality 已在上方按权重确定（变量 sampledQuality），此处直接使用选中的 quality

      const cfData: Omit<CaughtFish, 'id'> = {
        userUuid: opts.userUuid,
        pondId: pid,
        sessionId: opts.sessionId,
        fishId: chosen.speciesId,
        length,
        weight,
        quality: sampledQuality,
        caughtAt: at,
        createdAt: at,
        extra: null, 

        asResource: chosen.species.asResource ?? false,
        resourceResult: ""
      }

      // 尝试写入 caughtFish 表（字段名以 schema 中常见命名为准），失败时记录错误但不抛出
      await prisma.caughtFish.create({ data: cfData })
    } catch (e) {
      // 写入失败时记录错误并继续返回结果，避免阻塞主流程
      console.error('sampleFishForPond: failed to create CaughtFish', e)
    }
  }

  // 捕获成功：尝试以统一方法选择并消耗会话饵料
  try {
    await tryConsumeBaitForCatch(sess, sessionBaitCounts, chosen.species, modifiers);
  } catch (e: any) {
    console.error('sampleFishForPond: bait consumption error:', e?.message ?? String(e));
  }

  return result
}

