import {
  allCharacterBaseStatusType,
  allCharacterStatus,
  allCharacterStatusType,
  emptyCharacterStatus,
} from "~/shared/data/allCharacterStatus";
import { levelExpTable } from "~/shared/data/levelExpTable";
import type {
  AllBaseCharacterStatusType,
  AllCharacterStatusType,
  CharacterStatusDetail,
  CharacterStatusImprove,
  CharacterStatusInfo,
  CharacterStatusInfoDB,
  PlayerState,
} from "~/shared/types/characterInfo";
import { clone } from "~/shared/utils";
import { prisma } from "../prisma";
import { redisClient } from "../redis";
import { updateCharacterStatusInfo } from "./character";
import { addPlayerExpStats } from "./weeklyPlayerStats";
import { memoryCache } from "../memoryCache";
import type { PrismaTx } from "~/shared/types/socket/db";
import { Prisma } from "~/generated/prisma";
import { dbExecuteWithRetry } from "../dbUtils"

const REDIS_STATUS_KEY_PREFIX = "characterStatus:";
const getStatusRedisKey = (characterUuid: string) => `${REDIS_STATUS_KEY_PREFIX}${characterUuid}`;

const MEM_CACHE_TTL_MS = 5000;
const getStatusMemKey = (characterUuid: string) => getStatusRedisKey(characterUuid);

const buildDbPayloadFromStatus = (statusInfo: CharacterStatusInfo): CharacterStatusInfoDB => {
  const dbData: CharacterStatusInfoDB = {} as CharacterStatusInfoDB;
  for (const status of allCharacterBaseStatusType) {
    dbData[status] = JSON.stringify(statusInfo[status]);
  }
  return dbData;
};

// Cache strategy
const STATUS_CACHE_TTL_SEC = 3600; // 正常命中缓存时间
const MISSING_LOG_SAMPLE = 5;      // 缺失日志示例数量

export const getMultiCharacterStatusInfo = async (
  characterUuids: string[]
): Promise<Map<string, CharacterStatusInfo>> => {
  const result = new Map<string, CharacterStatusInfo>();
  if (!characterUuids.length) return result;

  // 0. 先读内存缓存，避免同批次反复 Redis/DB
  const needFromRemote: string[] = [];
  for (const uuid of characterUuids) {
    const mem = memoryCache.get<CharacterStatusInfo>(getStatusMemKey(uuid));
    if (mem) {
      result.set(uuid, mem);
    } else {
      needFromRemote.push(uuid);
    }
  }
  if (!needFromRemote.length) return result;

  // 1. 批量查 Redis
  const cacheKeys = needFromRemote.map(getStatusRedisKey);
  let cacheResults: (string | null)[] = [];
  
  try {
    cacheResults = await redisClient.mGet(cacheKeys);
  } catch (error) {
    console.error('getMultiCharacterStatusInfo: Redis mGet error:', error);
    // 如果Redis出错，直接查数据库
    cacheResults = new Array(characterUuids.length).fill(null);
  }

  const missedUuids: string[] = [];
  needFromRemote.forEach((uuid, idx) => {
    const cache = cacheResults[idx];
    if (cache) {
      try {
        const parsed = JSON.parse(cache);
        result.set(uuid, parsed);
        memoryCache.set(getStatusMemKey(uuid), parsed, MEM_CACHE_TTL_MS);
      } catch {
        missedUuids.push(uuid);
      }
    } else {
      missedUuids.push(uuid);
    }
  });

  // 2. 批量查数据库
  if (missedUuids.length) {
    const dbRecords = await prisma.characterStatus.findMany({
      where: {
        character_uuid: { in: missedUuids },
      },
    });

    let promiseList: Promise<any>[] = []
    for (const record of dbRecords) {
      const statusInfo: CharacterStatusInfo = {} as CharacterStatusInfo;
      // 仅解析关心的字段，避免无关键遍历
      for (const status of allCharacterBaseStatusType) {
        // @ts-ignore
        const raw = record[status];
        statusInfo[status] = raw ? JSON.parse(raw) : { level: 1, currentExp: 0 };
      }
      result.set(record.character_uuid, statusInfo);
      memoryCache.set(getStatusMemKey(record.character_uuid), statusInfo, MEM_CACHE_TTL_MS);

      // 写入 Redis 缓存
      promiseList.push(redisClient.set(getStatusRedisKey(record.character_uuid), JSON.stringify(statusInfo), {
        expiration: { type: 'EX', value: STATUS_CACHE_TTL_SEC }
      }));
    }

    await Promise.all(promiseList);

    // 没查到的也要返回空（并写入短期负缓存，避免反复 miss/打日志/查库）
    const notFound = missedUuids.filter((uuid) => !result.has(uuid));
    if (notFound.length) {
      // 始终打印一次聚合日志，避免逐条噪声；附带少量示例便于排查
      const sample = notFound.slice(0, Math.min(MISSING_LOG_SAMPLE, notFound.length));
      const ratio = (notFound.length / characterUuids.length * 100).toFixed(1);
      console.warn(
        `[characterStatus] missing rows: count=${notFound.length}/${characterUuids.length} (${ratio}%), sample=${sample.join(',')}`
      );

      const upserts: Promise<any>[] = [];
      const redisWrites: Promise<any>[] = [];
      for (const uuid of notFound) {
        const empty = clone(emptyCharacterStatus);
        const dbData = buildDbPayloadFromStatus(empty);
        result.set(uuid, empty);
        memoryCache.set(getStatusMemKey(uuid), empty, MEM_CACHE_TTL_MS);

        // 直接补齐数据库行，避免后续反复 miss；冲突时转为 update。
        upserts.push(
          prisma.characterStatus.upsert({
            where: { character_uuid: uuid },
            update: { user_uuid: uuid, character_uuid: uuid, ...dbData },
            create: { user_uuid: uuid, character_uuid: uuid, ...dbData },
          }).catch((err) => {
            console.error('[characterStatus] upsert missing row fail', uuid, err);
          })
        );

        // 写正缓存，拉长生命周期，避免短时间重复访问。
        redisWrites.push(
          redisClient.set(getStatusRedisKey(uuid), JSON.stringify(empty), {
            expiration: { type: 'EX', value: STATUS_CACHE_TTL_SEC },
          }).catch((err) => {
            console.error('[characterStatus] redis set missing row fail', uuid, err);
          })
        );
      }
      if (upserts.length) {
        await Promise.all(upserts);
      }
      if (redisWrites.length) {
        await Promise.all(redisWrites);
      }
    }
  }

    if (!missedUuids.length) {
      // console.log('All character statuses found in cache or DB', characterUuids.length);
    }

  return result;
};

export const getCharacterStatusInfo = async (
  characterUuid: string,
  tx?: PrismaTx,
  ignoreCache: boolean = false
): Promise<CharacterStatusInfo> => {
  if (!tx) {
    tx = prisma;
  }

  const redisKey = getStatusRedisKey(characterUuid);
  // 优先从 Redis 读取
  if (!ignoreCache) {
    const cache = await redisClient.get(redisKey);
    if (cache) {
      try {
        return JSON.parse(cache);
      } catch (e) {
        console.error("[characterStatus] Redis cache parse error:", e);
      }
    }
  }

  const characterStatus = await tx.characterStatus.findFirst({
    where: {
      character_uuid: characterUuid,
    },
  });

  if (!characterStatus) {
    // 返回空并短期写入负缓存，避免反复打 DB
    const empty = clone(emptyCharacterStatus);
    try {
      await redisClient.set(getStatusRedisKey(characterUuid), JSON.stringify(empty), {
        expiration: { type: 'EX', value: 60 },
      });
    } catch {}
    memoryCache.set(getStatusMemKey(characterUuid), empty, MEM_CACHE_TTL_MS);
    return empty;
  }

  const result: CharacterStatusInfo = {} as CharacterStatusInfo;

  Object.keys(characterStatus).forEach((status) => {
    if (["id", "user_uuid", "character_uuid"].includes(status)) {
      return;
    }

    let statusKey: AllCharacterStatusType = status as AllCharacterStatusType;

    // @ts-ignore
    result[statusKey] = JSON.parse(characterStatus[status]);
  });

  // 查库后写入一份到 Redis
  await redisClient.set(redisKey, JSON.stringify(result), {
    expiration: {
      type: 'EX',
      value: STATUS_CACHE_TTL_SEC // 缓存1小时
    }
  });
  memoryCache.set(getStatusMemKey(characterUuid), result, MEM_CACHE_TTL_MS);

  return result;
};

export const increaseCharacterStatusExp = async (
  characterUuid: string,
  improveInfo: CharacterStatusImprove[],
  tx?: PrismaTx
): Promise<CharacterStatusInfo> => {
  if (!tx) {
    tx = prisma;
  }

  const redisKey = getStatusRedisKey(characterUuid);
  const characterStatusInfo = await tx.characterStatus.findFirst({
    where: { character_uuid: characterUuid },
  });

  const dbDataPartial: Record<string, string> = {}; // 仅写入变动的字段
  const res: CharacterStatusInfo = {} as CharacterStatusInfo;

  // 预先把当前状态读出来，后续对比用
  for (const status of allCharacterBaseStatusType) {
    res[status] = JSON.parse(characterStatusInfo?.[status] ?? JSON.stringify({ level: 1, currentExp: 0 }));
  }

  // 新增路径保持原有行为（不变）
  if (!characterStatusInfo) {
    let newStatusInfo = clone(emptyCharacterStatus);

    for (const { status, increaseExp } of improveInfo) {
      newStatusInfo[status] = { level: 1, currentExp: increaseExp };
    }

    newStatusInfo = checkAllStatusLevelUpgrade(newStatusInfo);
    for (const status of allCharacterBaseStatusType) {
      dbDataPartial[status] = JSON.stringify(newStatusInfo[status]);
      res[status] = newStatusInfo[status];
    }

    await tx.characterStatus.create({
      data: {
        user_uuid: characterUuid,
        character_uuid: characterUuid,
        ...dbDataPartial,
      },
    });

    await addPlayerExpStats({ userUuid: characterUuid, statusImprovements: improveInfo });

    await redisClient.set(redisKey, JSON.stringify(newStatusInfo), { expiration: { type: 'EX', value: 3600 }});
    memoryCache.set(getStatusMemKey(characterUuid), newStatusInfo, MEM_CACHE_TTL_MS);

    return newStatusInfo;
  }

  // 已有记录：仅更新实际变动的字段
  // 计算每个 improveInfo 对应的潜在新值，并决定是否需要写入
  const updatePayload: any = {};
  for (const { status, increaseExp } of improveInfo) {
    const old = res[status];
    const candidate = { ...old, level: old.level, currentExp: old.currentExp + increaseExp };
    candidate.currentExp = +candidate.currentExp.toFixed(4)
    const upgraded = checkStatusUpgrade(candidate);

    // 如果状态真的变化了（包括升级或当前经验变更），就写入该字段
    if (upgraded.level !== old.level || upgraded.currentExp !== old.currentExp) {
      updatePayload[status] = JSON.stringify(upgraded);
      // 同步内存中的状态
      res[status] = upgraded;
    }
  }

  // 如果没有实际变动，直接跳过 DB 写入
  const hasChanges = Object.keys(updatePayload).length > 0
  if (hasChanges) {
    // 只更新变动的字段，不改动其他未变字段，使用原生 UPDATE 保持精确写入
    const setFragments = Object.entries(updatePayload).map(([key, val]) =>
      Prisma.sql`${Prisma.raw("`" + key + "`")} = ${val}`
    )

    await dbExecuteWithRetry(async () => {
      const query = Prisma.sql`
        UPDATE CharacterStatus
        SET ${Prisma.join(setFragments, ', ')}
        WHERE character_uuid = ${characterUuid}
      `
      await tx.$executeRaw(query)
    }, 'updateCharacterStatusInfoIntoDB-'+characterUuid)
  }

  await addPlayerExpStats({ userUuid: characterUuid, statusImprovements: improveInfo });

  // 写入 Redis 缓存：若有变动，刷新整状态对象；否则保持现状
  try {
    if (hasChanges) {
      // 将完整状态刷回缓存，确保后续读取一致
      await redisClient.set(redisKey, JSON.stringify(res), { expiration: { type: 'EX', value: 3600 }});
    }
  } catch {
    // 忽略 Redis 失败，缓存仅影响性能，不阻塞业务
  }

  memoryCache.set(getStatusMemKey(characterUuid), res, MEM_CACHE_TTL_MS);

  return res;
};

const checkStatusUpgrade = (
  statusDetail: CharacterStatusDetail
): CharacterStatusDetail => {
  const res = clone(statusDetail);

  while (res.currentExp >= levelExpTable[res.level]) {
    res.currentExp -= levelExpTable[res.level];
    res.level += 1;
  }

  return res;
};
const checkAllStatusLevelUpgrade = (
  statusInfo: CharacterStatusInfo
): CharacterStatusInfo => {
  const statusInfoRes = clone(statusInfo);

  for (const status of allCharacterBaseStatusType) {
    statusInfoRes[status] = checkStatusUpgrade(statusInfoRes[status]);
  }

  return statusInfoRes;
};

export const compareUpgradedStatus = (
  oriCharacterStatusInfo: CharacterStatusInfo,
  latestCharacterStatusInfo: CharacterStatusInfo
): Partial<CharacterStatusInfo> | null => {
  const upgraded: Partial<CharacterStatusInfo> = {};

  for (const status of allCharacterBaseStatusType) {
    const ori = oriCharacterStatusInfo[status];
    const latest = latestCharacterStatusInfo[status];
    if (latest.level > ori.level) {
      upgraded[status] = {
        level: latest.level,
        currentExp: latest.currentExp,
      };
    }
  }

  if (!Object.keys(upgraded).length) {
    return null
  }

  return upgraded;
};

// export const dispatchCharacterStatusInfo = async (userUuid: string, characterStatusInfo: CharacterStatusInfo) => {
//     emitEventToUser(userUuid, "dispatchCharacterStatusInfo", characterStatusInfo)
// }
// export const dispatchTargetCharacterStatusInfo = async (userUuid: string, characterStatusInfo: CharacterStatusInfo) => {
//     emitEventToUser(userUuid, "targetCharacterStatusInfo", characterStatusInfo)
// }
// export const dispatchCharacterStatusLevelUpgrade = async (userUuid: string, upgradegStatus: Partial<CharacterStatusInfo>) => {
//     // emitEventToUser(userUuid, "characterStatusLevelUpgrade", upgradegStatus)
// }

export const increaseCharacterStatusFromOther = async (userUuid:string, status: AllBaseCharacterStatusType, value: number, other: string) => {
  // 获取角色uuid（假设userUuid即characterUuid，或你有映射关系请替换）
  const characterUuid = userUuid;

  // 1. 获取原始属性
  const oriStatusInfo = await getCharacterStatusInfo(characterUuid);

  if (!oriStatusInfo[status].fromOther) {
    oriStatusInfo[status].fromOther = {};
  }

  if (!oriStatusInfo[status].fromOther[other]) {
    oriStatusInfo[status].fromOther[other] = 0
  }

  oriStatusInfo[status].fromOther[other] += value
  

  await prisma.characterStatus.update({
    where: {
      character_uuid: characterUuid,
    },
    data: {
      user_uuid: characterUuid,
      character_uuid: characterUuid,
      [status]: JSON.stringify(oriStatusInfo[status]),
    },
  });

  const redisKey = getStatusRedisKey(characterUuid);
  await redisClient.set(redisKey, JSON.stringify(oriStatusInfo), {
    expiration: {
      type: 'EX',
      value: 3600
    }
  });
  memoryCache.set(getStatusMemKey(characterUuid), oriStatusInfo, MEM_CACHE_TTL_MS);
  await updateCharacterStatusInfo(userUuid);
};

export const removeCharacterStatusFromOther = async (userUuid:string, other: string, tx: PrismaTx, opt?: {
  ignoreRefresh?: boolean, // 是否在最后调用 updateCharacterStatusInfo 刷新状态（默认刷新）
}) => {
  // 获取角色uuid（假设userUuid即characterUuid，或你有映射关系请替换）
  const characterUuid = userUuid;

  // 1. 获取原始属性
  const oriStatusInfo = await getCharacterStatusInfo(characterUuid, tx, true);

  for(const status of allCharacterBaseStatusType) {
    if (!oriStatusInfo[status].fromOther) {
      continue;
    }

    if (!oriStatusInfo[status].fromOther[other]) {
      continue;
    }

    delete oriStatusInfo[status].fromOther[other];

    await tx.characterStatus.update({
      where: {
        character_uuid: characterUuid,
      },
      data: {
        user_uuid: characterUuid,
        character_uuid: characterUuid,
        [status]: JSON.stringify(oriStatusInfo[status]),
      },
    });
  }

  if (!opt?.ignoreRefresh) {
    let latestInfo = await updateCharacterStatusInfo(userUuid, tx);

    const redisKey = getStatusRedisKey(characterUuid);
    await redisClient.set(redisKey, JSON.stringify(latestInfo), {
      expiration: {
        type: 'EX',
        value: 3600
      }
    });
    memoryCache.set(getStatusMemKey(characterUuid), latestInfo, MEM_CACHE_TTL_MS);
  }
}

// 从playerState，反查other来源的状态，并恢复到角色状态中（用于状态过期时的清理）
export const revertRemoveCharacterStatusFromOther = async (userUuid:string, state: PlayerState) => {
  // 获取角色uuid（假设userUuid即characterUuid，或你有映射关系请替换）
  const characterUuid = userUuid;

  const oriStatusInfo = await getCharacterStatusInfo(characterUuid, prisma, true);

  const allTmpStatusState = Object.values(state.global?.statusEffect ?? {}).map(s => s.id)

  for(const status of allCharacterBaseStatusType) {
    if (!oriStatusInfo[status].fromOther) {
      continue;
    }

    for(const other of Object.keys(oriStatusInfo[status].fromOther)) {
      if (!allTmpStatusState.includes(other as unknown as typeof allTmpStatusState[number])) {
        // 这个状态已经不在玩家状态里了，说明之前被清理掉了，需要恢复
        delete oriStatusInfo[status].fromOther[other];
      }
    }

    await prisma.characterStatus.update({
      where: {
        character_uuid: characterUuid,
      },
      data: {
        user_uuid: characterUuid,
        character_uuid: characterUuid,
        [status]: JSON.stringify(oriStatusInfo[status]),
      },
    });
  }
}

export const decreaseCharacterStatusFromOther = async (userUuid:string, status: AllBaseCharacterStatusType, value: number, other: string) => {
  // 获取角色uuid（假设userUuid即characterUuid，或你有映射关系请替换）
  const characterUuid = userUuid;

  // 1. 获取原始属性
  const oriStatusInfo = await getCharacterStatusInfo(characterUuid);

  if (!oriStatusInfo[status].fromOther) {
    oriStatusInfo[status].fromOther = {};
  }

  if (!oriStatusInfo[status].fromOther[other]) {
    oriStatusInfo[status].fromOther[other] = 0
  }

  oriStatusInfo[status].fromOther[other] -= value
  if (oriStatusInfo[status].fromOther[other] < 0) {
    oriStatusInfo[status].fromOther[other] = 0
  }
  
  await prisma.characterStatus.update({
    where: {
      character_uuid: characterUuid,
    },
    data: {
      user_uuid: characterUuid,
      character_uuid: characterUuid,
      [status]: JSON.stringify(oriStatusInfo[status]),
    },
  });

  const redisKey = getStatusRedisKey(characterUuid);
  await redisClient.set(redisKey, JSON.stringify(oriStatusInfo), {
    expiration: {
      type: 'EX',
      value: 3600
    }
  });
  memoryCache.set(getStatusMemKey(characterUuid), oriStatusInfo, MEM_CACHE_TTL_MS);
  await updateCharacterStatusInfo(userUuid);
};

export const updateCharacterStatusInfoIntoDB = async (
  characterUuid: string,
  statusInfo: CharacterStatusInfo,
  tx?: PrismaTx
) => {
  if (!tx) {
    tx = prisma;
  }
  const dbData: CharacterStatusInfoDB = {} as CharacterStatusInfoDB;

  // 序列化所有属性
  for (const status of allCharacterBaseStatusType) {
    dbData[status] = JSON.stringify(statusInfo[status]);
  }

  // 检查是否已存在
  const exist = await tx.characterStatus.findFirst({
    where: {
      character_uuid: characterUuid,
    },
  });

  if (exist) {
    // 更新
    await tx.characterStatus.update({
      where: {
        character_uuid: characterUuid,
      },
      data: {
        ...dbData,
      },
    });
  } else {
    // 新建
    await tx.characterStatus.create({
      data: {
        user_uuid: characterUuid, // 如有独立user_uuid请替换
        character_uuid: characterUuid,
        ...dbData,
      },
    });
  }

  // 写入 Redis 缓存
  const redisKey = getStatusRedisKey(characterUuid);
  await redisClient.set(redisKey, JSON.stringify(statusInfo), {
    expiration: {
      type: 'EX',
      value: 3600
    }
  });
  memoryCache.set(getStatusMemKey(characterUuid), statusInfo, MEM_CACHE_TTL_MS);
};