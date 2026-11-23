import {
  allCharacterBaseStatusType,
  allCharacterStatus,
  allCharacterStatusType,
  emptyCharacterStatus,
} from "~/shared/data/allCharacterStatus";
import { levelExpTable } from "~/shared/data/levelExpTable";
import {
  AllBaseCharacterStatusType,
  AllCharacterStatusType,
  CharacterStatusDetail,
  CharacterStatusImprove,
  CharacterStatusInfo,
  CharacterStatusInfoDB,
  CharacterStatusLevelImprove,
} from "~/shared/types/characterInfo";
import { clone } from "~/shared/utils";
import { prisma } from "./db";
import { emitEventToUser } from "~/server/io";
import { updateCharacterStatusInfo } from "./character";
import { addPlayerExpStats } from "./weeklyPlayerStats";
import { PrismaTx } from "~/shared/types/socket/db";

const REDIS_STATUS_KEY_PREFIX = "characterStatus:";
const getStatusRedisKey = (characterUuid: string) => `${REDIS_STATUS_KEY_PREFIX}${characterUuid}`;

export const getCharacterStatusInfo = async (
  characterUuid: string,
  tx?: PrismaTx,
  ignoreCache: boolean = false
): Promise<CharacterStatusInfo> => {
  if (!tx) {
    tx = prisma;
  }

  ignoreCache = true;

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
    return emptyCharacterStatus;
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
      value: 3600 // 缓存1小时
    }
  });

  return result;
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

    return newStatusInfo;
  }

  // 已有记录：仅更新实际变动的字段
  // 计算每个 improveInfo 对应的潜在新值，并决定是否需要写入
  const updatePayload: any = {};
  for (const { status, increaseExp } of improveInfo) {
    const old = res[status];
    const candidate = { level: old.level, currentExp: old.currentExp + increaseExp };
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
  if (Object.keys(updatePayload).length > 0) {
    // 只更新变动的字段，不改动其他未变字段
    await tx.characterStatus.update({
      where: { character_uuid: characterUuid },
      data: updatePayload,
    });

    // 注意：这里只写入了变动的字段，user_uuid/character_uuid 保持不变
  }

  await addPlayerExpStats({ userUuid: characterUuid, statusImprovements: improveInfo });

  // 写入 Redis 缓存：若有变动，刷新整状态对象；否则保持现状
  try {
    const freshForRedis = Object.keys(res).length ? res : undefined;
    if (freshForRedis) {
      // 将完整状态刷回缓存，确保后续读取一致
      await redisClient.set(redisKey, JSON.stringify(freshForRedis), { expiration: { type: 'EX', value: 3600 }});
    }
  } catch {
    // 忽略 Redis 失败，缓存仅影响性能，不阻塞业务
  }

  return res;
};

export const increaseCharacterStatusLevel = async (
  characterUuid: string,
  improveInfo: CharacterStatusLevelImprove[]
): Promise<CharacterStatusInfo> => {
  const redisKey = getStatusRedisKey(characterUuid);
  const characterStatusInfo = await prisma.characterStatus.findFirst({
    where: {
      character_uuid: characterUuid,
    },
  });

  const dbData: CharacterStatusInfoDB = {} as CharacterStatusInfoDB;

  // 写入一份新数据
  if (!characterStatusInfo) {
    let newStatusInfo = clone(emptyCharacterStatus);

    for (const { status, increaseLevel } of improveInfo) {
      newStatusInfo[status] = {
        level: 1 + increaseLevel,
        currentExp: 0,
      };
    }

    for (const status of allCharacterBaseStatusType) {
      dbData[status] = JSON.stringify(newStatusInfo[status]);
    }

    await prisma.characterStatus.create({
      data: {
        user_uuid: characterUuid,
        character_uuid: characterUuid,
        ...dbData,
      },
    });

    // 写入 Redis 缓存
    await redisClient.set(redisKey, JSON.stringify(newStatusInfo), {
      expiration: {
        type: 'EX',
        value: 3600
      }
    });

    return newStatusInfo;
  }

  // 更新已有数据
  let res: CharacterStatusInfo = {} as CharacterStatusInfo;
  for (const status of allCharacterBaseStatusType) {
    res[status] = JSON.parse(characterStatusInfo[status] ?? "")
  }

  for (const { status, increaseLevel } of improveInfo) {
    res[status].level += increaseLevel;
  }

  for (const status of allCharacterBaseStatusType) {
    dbData[status] = JSON.stringify(res[status]);
  }

  await prisma.characterStatus.update({
    where: {
      character_uuid: characterUuid,
    },
    data: {
      user_uuid: characterUuid,
      character_uuid: characterUuid,
      ...dbData,
    },
  });

  // 写入 Redis 缓存
  await redisClient.set(redisKey, JSON.stringify(res), {
    expiration: {
      type: 'EX',
      value: 3600
    }
  });

  return res;
};

export const decreaseCharacterStatusLevel = async (
  characterUuid: string,
  status: keyof CharacterStatusInfo,
  level: number,
  tx?: PrismaTx
): Promise<CharacterStatusInfo> => {
  if (!tx) {
    tx = prisma;
  }

  const redisKey = getStatusRedisKey(characterUuid);
  const characterStatusInfo = await tx.characterStatus.findFirst({
    where: {
      character_uuid: characterUuid,
    },
  });

  const dbData: CharacterStatusInfoDB = {} as CharacterStatusInfoDB;

  // 写入一份新数据
  if (!characterStatusInfo) {
    throw new Error(`${allCharacterStatus[status].name} 等级不足(0)，无法继续降低`)
  }

  // 更新已有数据
  let res: CharacterStatusInfo = {} as CharacterStatusInfo;
  for (const status of allCharacterBaseStatusType) {
    res[status] = JSON.parse(characterStatusInfo[status] ?? "")
  }

  if (res[status].level < level) {
    throw new Error(`${allCharacterStatus[status].name} 等级不足(${res[status].level})，无法继续降低`)
  }

  res[status].level -= level;

  res[status] = checkStatusUpgrade(res[status]);

  for (const status of allCharacterBaseStatusType) {
    dbData[status] = JSON.stringify(res[status]);
  }

  await tx.characterStatus.update({
    where: {
      character_uuid: characterUuid,
    },
    data: {
      user_uuid: characterUuid,
      character_uuid: characterUuid,
      ...dbData,
    },
  });

  // 写入 Redis 缓存
  await redisClient.set(redisKey, JSON.stringify(res), {
    expiration: {
      type: 'EX',
      value: 3600
    }
  });

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

export const dispatchCharacterStatusInfo = async (userUuid: string, characterStatusInfo: CharacterStatusInfo) => {
    emitEventToUser(userUuid, "dispatchCharacterStatusInfo", characterStatusInfo)
}
export const dispatchTargetCharacterStatusInfo = async (userUuid: string, characterStatusInfo: CharacterStatusInfo) => {
    emitEventToUser(userUuid, "targetCharacterStatusInfo", characterStatusInfo)
}
export const dispatchCharacterStatusLevelUpgrade = async (userUuid: string, upgradegStatus: Partial<CharacterStatusInfo>) => {
    // emitEventToUser(userUuid, "characterStatusLevelUpgrade", upgradegStatus)
}

export const increaseCharacterStatusFromOther = async (
  userUuid: string,
  status: AllBaseCharacterStatusType,
  value: number,
  opt: {
    other: string;
    unique: boolean;
    ignoreUpdate?: boolean;
    tx?: PrismaTx;
  } = {
    other: "",
    ignoreUpdate: false,
    unique: false,
  }
) => {
  let { other, unique, tx, ignoreUpdate } = opt;

  if (!tx) {
    tx = prisma;
  }
  // 获取角色uuid（假设userUuid即characterUuid，或你有映射关系请替换）
  const characterUuid = userUuid;

  // 1. 获取原始属性
  const oriStatusInfo = await getCharacterStatusInfo(characterUuid, tx);

  if (!oriStatusInfo[status].fromOther) {
    oriStatusInfo[status].fromOther = {};
  }

  if (!oriStatusInfo[status].fromOther[other]) {
    oriStatusInfo[status].fromOther[other] = 0;
  }

  // 唯一效果则不可累加
  if (unique) {
    oriStatusInfo[status].fromOther[other] = 0;
  }

  oriStatusInfo[status].fromOther[other] += value;

  await tx.characterStatus.update({
    where: {
      character_uuid: characterUuid,
    },
    data: {
      [status]: JSON.stringify(oriStatusInfo[status]),
    },
  });

  const redisKey = getStatusRedisKey(characterUuid);
  await redisClient.set(redisKey, JSON.stringify(oriStatusInfo), {
    expiration: {
      type: "EX",
      value: 3600,
    },
  });

  if (!ignoreUpdate) {
    await updateCharacterStatusInfo(userUuid, tx);
  }
};

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
  await updateCharacterStatusInfo(userUuid);
};