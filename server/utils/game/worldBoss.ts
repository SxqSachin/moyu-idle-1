import { v7 } from "uuid";
import { redisClient } from "~/server/utils";
import type {
  CreateWorldBossBattleConfigInput,
  WorldBossBattleConfig,
  WorldBossConfigWithState,
  WorldBossSnapshot,
  WorldBossStateStatus,
  WorldBossGlobalState,
  WorldBossDeltaEvent,
} from "~/shared/types/worldBoss";

const WORLD_BOSS_CONFIG_HASH_KEY = "worldBoss:config:hash";
const WORLD_BOSS_GLOBAL_STATE_HASH_KEY = "worldBoss:globalState:hash";
const WORLD_BOSS_DAMAGE_QUEUE_KEY_PREFIX = "worldBoss:hpModifyQueue:";

const getDamageQueueKey = (bossId: string): string => `${WORLD_BOSS_DAMAGE_QUEUE_KEY_PREFIX}${bossId}`;

const calcTotalHp = (members: WorldBossBattleConfig["bossMembers"]): number => {
  return members.reduce((sum, member) => {
    const maxHp = member.maxHp ?? member.hp ?? 0;
    const hp = member.hp ?? maxHp;
    return sum + (maxHp || hp || 0);
  }, 0);
};

const assertNonEmptyString = (value: string, label: string): void => {
  if (!value || !value.trim()) {
    throw new Error(`${label} 不能为空`);
  }
};

const normalizeState = (state: WorldBossStateStatus | undefined): WorldBossStateStatus => {
  return state === "battling" ? "battling" : "waiting";
};

export async function initializeGlobalBossState(bossId: string): Promise<WorldBossGlobalState> {
  const config = await getWorldBossConfigById(bossId);
  if (!config) {
    throw new Error(`未找到对应的“大麻烦”配置: ${bossId}`);
  }

  const totalHp = calcTotalHp(config.bossMembers);
  const state: WorldBossGlobalState = {
    uuid: v7(),
    bossId: config.id,
    version: config.version,
    bossMembers: JSON.parse(JSON.stringify(config.bossMembers)),
    totalHp,
    currentHp: totalHp,
    lastUpdated: Date.now(),
    status: config.state,
    dispatchedRewards: false,
  };

  await redisClient.hSet(WORLD_BOSS_GLOBAL_STATE_HASH_KEY, bossId, JSON.stringify(state));
  return state;
}

export async function getGlobalBossState(bossId: string): Promise<WorldBossGlobalState | null> {
  const raw = await redisClient.hGet(WORLD_BOSS_GLOBAL_STATE_HASH_KEY, bossId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorldBossGlobalState;
  } catch {
    return null;
  }
}

export async function resetGlobalBossState(bossId: string): Promise<WorldBossGlobalState> {
  // 清理未消费的伤害事件，避免影响重置后的血量
  await redisClient.del(getDamageQueueKey(bossId));
  return initializeGlobalBossState(bossId);
}

export async function createWorldBossConfig(
  input: CreateWorldBossBattleConfigInput
): Promise<WorldBossBattleConfig> {
  assertNonEmptyString(input.id, "配置ID");
  assertNonEmptyString(input.name, "名称");
  if (!Array.isArray(input.bossMembers) || input.bossMembers.length === 0) {
    throw new Error("至少需要一个Boss单位");
  }

  input.bossMembers = input.bossMembers.map((member, index) => {
    if (!member.id || !member.id.trim()) {
      throw new Error(`Boss单位[${index}]的ID不能为空`);
    }
    if ((member.hp ?? 0) <= 0 && (member.maxHp ?? 0) <= 0) {
      throw new Error(`Boss单位[${index}]的HP或MaxHP必须大于0`);
    }

    if (!member.skills.baseAttack) {
      throw new Error(`Boss单位[${index}]必须配置基础攻击技能`);
    }

    return member;
  });

  input.bossMembers = input.bossMembers.map((member, index) => {
    member.status = member.baseStatus;

    return member;
  });

  const now = Date.now();
  const config: WorldBossBattleConfig = {
    id: input.id,
    name: input.name,
    description: input.description?.trim() || undefined,
    // validate and accept optional start/end timestamps
    startAt: typeof input.startAt === 'number' && Number.isFinite(input.startAt) ? input.startAt : undefined,
    endAt: typeof input.endAt === 'number' && Number.isFinite(input.endAt) ? input.endAt : undefined,
    bossMembers: input.bossMembers,
    state: normalizeState(input.state),
    version: 1,
    updatedAt: now,
    hidden: input.hidden ?? false,
  };

  // If both start and end present, validate ordering
  if (config.startAt && config.endAt && config.startAt >= config.endAt) {
    throw new Error("开始时间必须早于结束时间");
  }

  await redisClient.hSet(WORLD_BOSS_CONFIG_HASH_KEY, config.id, JSON.stringify(config));
  return config;
}

export async function listWorldBossConfigs(ignoreHidden = false): Promise<WorldBossConfigWithState[]> {
  const [rawConfigs, rawStates] = await Promise.all([
    redisClient.hGetAll(WORLD_BOSS_CONFIG_HASH_KEY),
    redisClient.hGetAll(WORLD_BOSS_GLOBAL_STATE_HASH_KEY),
  ]);

  const stateMap = new Map<string, WorldBossGlobalState>();
  for (const [bossId, value] of Object.entries(rawStates)) {
    try {
      const state = JSON.parse(value) as WorldBossGlobalState;
      if (state) stateMap.set(bossId, state);
    } catch {
      // ignore bad state rows
    }
  }

  const result: WorldBossConfigWithState[] = [];
  for (const value of Object.values(rawConfigs)) {
    try {
      const parsed = JSON.parse(value) as WorldBossBattleConfig;
      const liveState = stateMap.get(parsed.id);
      const merged: WorldBossConfigWithState = {
        ...parsed,
        state: liveState?.status ?? parsed.state,
        globalState: liveState || undefined,
      };

      if (!ignoreHidden) {
        if (merged.hidden) {
          continue;
        }
      }

      result.push(merged);
    } catch {
      // 忽略坏数据，保守返回
    }
  }
  return result;
}

export async function getWorldBossConfigById(id: string): Promise<WorldBossBattleConfig | undefined> {
  if (!id) return;
  const raw = await redisClient.hGet(WORLD_BOSS_CONFIG_HASH_KEY, id);
  if (!raw) return;

  try {
    return JSON.parse(raw) as WorldBossBattleConfig;
  } catch {
    return;
  }
}

export async function markGlobalBossDispatchedRewards(bossId: string, dispatched: boolean): Promise<WorldBossGlobalState | null> {
  const state = await getGlobalBossState(bossId);
  if (!state) return null;

  state.dispatchedRewards = dispatched;
  state.lastUpdated = Date.now();

  await redisClient.hSet(WORLD_BOSS_GLOBAL_STATE_HASH_KEY, bossId, JSON.stringify(state));
  return state;
}