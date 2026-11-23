import { v7 } from "uuid";
import { redisClient } from "../redis";
import { pushMessageToQueue } from "./msgQueue";
import { prisma } from "../prisma"
import type {
  CreateWorldBossBattleConfigInput,
  WorldBossBattleConfig,
  WorldBossSnapshot,
  WorldBossStateStatus,
  WorldBossGlobalState,
  WorldBossDeltaEvent,
} from "~/shared/types/worldBoss";

const WORLD_BOSS_CONFIG_HASH_KEY = "worldBoss:config:hash";
const WORLD_BOSS_GLOBAL_STATE_HASH_KEY = "worldBoss:globalState:hash";
const WORLD_BOSS_DAMAGE_QUEUE_KEY_PREFIX = "worldBoss:hpModifyQueue:";
const WORLD_BOSS_HP_SYNC_INTERVAL_MS = 800;
const lastWorldBossSyncAt = new Map<string, number>();

const calcTotalHp = (members: WorldBossBattleConfig["bossMembers"]): number => {
  return members.reduce((sum, member) => {
    const maxHp = member.maxHp ?? member.hp ?? 0;
    const hp = member.hp ?? maxHp;
    return sum + (maxHp || hp || 0);
  }, 0);
};

export async function listWorldBossConfigs(): Promise<WorldBossBattleConfig[]> {
  const raw = await redisClient.hGetAll(WORLD_BOSS_CONFIG_HASH_KEY);
  const result: WorldBossBattleConfig[] = [];

  for (const value of Object.values(raw)) {
    try {
      const parsed = JSON.parse(value) as WorldBossBattleConfig;
      result.push(parsed);
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
  try {
    const raw = await redisClient.hGet(WORLD_BOSS_GLOBAL_STATE_HASH_KEY, bossId);
    if (!raw) return null;

    return JSON.parse(raw) as WorldBossGlobalState;
  } catch (error) {
    console.error('Failed to get global boss state:', error);
    return null;
  }
}

export async function updateGlobalBossHp(bossId: string, deltaHp: number): Promise<WorldBossGlobalState | null> {
  try {
    const state = await getGlobalBossState(bossId);
    if (!state) return null;

    state.currentHp = Math.max(0, state.currentHp + deltaHp);
    state.lastUpdated = Date.now();

    if (state.currentHp <= 0) {
      state.status = 'waiting'; // Boss defeated
    }

    await redisClient.hSet(WORLD_BOSS_GLOBAL_STATE_HASH_KEY, bossId, JSON.stringify(state));
    return state;
  } catch (error) {
    console.error('Failed to update global boss HP:', error);
    return null;
  }
}

export async function updateGlobalBossStatus(bossId: string, status: WorldBossStateStatus): Promise<WorldBossGlobalState | null> {
  try {
    const state = await getGlobalBossState(bossId);
    if (!state) return null;

    state.status = status;
    state.lastUpdated = Date.now();

    await redisClient.hSet(WORLD_BOSS_GLOBAL_STATE_HASH_KEY, bossId, JSON.stringify(state));
    return state;
  } catch (error) {
    console.error('Failed to update global boss status:', error);
    return null;
  }
}

export async function resetGlobalBossState(bossId: string): Promise<WorldBossGlobalState> {
  // 清理未消费的伤害事件，避免影响重置后的血量
  await redisClient.del(getDamageQueueKey(bossId));
  return initializeGlobalBossState(bossId);
}

export async function markGlobalBossDispatchedRewards(bossId: string, dispatched: boolean): Promise<WorldBossGlobalState | null> {
  try {
    const state = await getGlobalBossState(bossId);
    if (!state) return null;

    state.dispatchedRewards = dispatched;
    state.lastUpdated = Date.now();

    await redisClient.hSet(WORLD_BOSS_GLOBAL_STATE_HASH_KEY, bossId, JSON.stringify(state));
    return state;
  } catch (error) {
    console.error('Failed to update world boss dispatchedRewards:', error);
    return null;
  }
}

export const getDamageQueueKey = (bossId: string): string => `${WORLD_BOSS_DAMAGE_QUEUE_KEY_PREFIX}${bossId}`;

export async function addDamageToQueue(bossId: string, damageEvent: WorldBossDeltaEvent): Promise<void> {
  try {
    const queueKey = getDamageQueueKey(bossId);
    await redisClient.rPush(queueKey, JSON.stringify(damageEvent));
  } catch (error) {
    console.error('Failed to add damage to queue:', error);
  }
}

export async function popDamageEvents(bossId: string, batchSize: number = 512): Promise<WorldBossDeltaEvent[]> {
  const events: WorldBossDeltaEvent[] = [];
  const queueKey = getDamageQueueKey(bossId);

  for (let i = 0; i < batchSize; i++) {
    const rawEvent = await redisClient.lPop(queueKey);
    if (!rawEvent) break;
    try {
      events.push(JSON.parse(rawEvent) as WorldBossDeltaEvent);
    } catch (error) {
      console.error('Failed to parse damage event:', error);
    }
  }

  return events;
}

export async function applyDamageEventsToGlobalState(
  bossId: string,
  events: WorldBossDeltaEvent[],
): Promise<WorldBossGlobalState | null> {
  if (!events.length) return getGlobalBossState(bossId);

  const state = await getGlobalBossState(bossId)
  if (!state) {
    throw new Error(`Global boss state not found for bossId: ${bossId}`);
  }

  if (state.currentHp <= 0) {
    return state; // Boss already defeated, ignore further damage
  }

  const memberMap = new Map(state.bossMembers.map((m) => [m.uuid, m] as const));
  let anyUnitUpdate = false;
  let remainingDelta = 0;
  const damageMap: Record<string, Record<string, number>> = {};
  const roomMemberMap: Record<string, string[]> = {}

  for (const event of events) {
    const units = Array.isArray(event.units) ? event.units : [];
    // const players = Array.isArray(event.players) ? event.players : [];
    const worldBossBattleUuid = event.worldBossBattleUuid;

    // 因为传递的是hp变动，所以伤害都是负数传递，因此这里要翻一下
    let totalDamage = -(event.totalDeltaHp ?? 0);

    // 生命恢复不统计
    if (totalDamage < 0) {
      continue;
    }

    // 累积伤害统计：按 battleUuid (roomId) 统计总伤害
    if (worldBossBattleUuid && totalDamage > 0) {
      if (!damageMap[worldBossBattleUuid]) {
        damageMap[worldBossBattleUuid] = {};
      }
      if (!damageMap[worldBossBattleUuid][event.roomId]) {
        damageMap[worldBossBattleUuid][event.roomId] = 0;
      }

      roomMemberMap[event.roomId] = event.players;
      damageMap[worldBossBattleUuid][event.roomId] += totalDamage;
    }

    if (units.length) {
      let unitSum = 0;
      for (const u of units) {
        const member = memberMap.get(u.unitUuid);
        if (!member) continue;
        anyUnitUpdate = true;
        unitSum += u.deltaHp;
        const maxHp = member.maxHp;
        const rawNext = member.hp + u.deltaHp;
        const boundedNext = maxHp > 0 ? Math.min(maxHp, rawNext) : rawNext;
        member.hp = Math.max(0, boundedNext);
      }
      const diff = (event.totalDeltaHp ?? 0) - unitSum;
      if (diff !== 0) remainingDelta += diff;
    } else {
      remainingDelta += (event.totalDeltaHp ?? 0);
    }
  }

  if (anyUnitUpdate) {
    const summed = state.bossMembers.reduce((sum, m) => sum + (m.hp ?? 0), 0);
    state.currentHp = Math.min(state.totalHp, Math.max(0, summed));
  }

  if (remainingDelta !== 0 || !anyUnitUpdate) {
    state.currentHp = Math.min(state.totalHp, Math.max(0, state.currentHp + remainingDelta));
  }

  state.lastUpdated = Date.now();
  if (state.currentHp <= 0 && state.status === 'battling') {
    state.status = 'player_win';
  }

  await redisClient.hSet(WORLD_BOSS_GLOBAL_STATE_HASH_KEY, bossId, JSON.stringify(state));

  // 更新伤害统计到数据库
  try {
    const updatesPromises: Promise<any>[] = [];

    for(const worldBossBattleUuid of Object.keys(damageMap)) {
      const roomDamageMap = damageMap[worldBossBattleUuid];

      for (const roomUuid of Object.keys(roomDamageMap)) {
        const damage = Math.trunc(roomDamageMap[roomUuid]);

          updatesPromises.push(prisma.worldBossDamageRecord.upsert({
            where: {
              boss_room_unique: { uuid: worldBossBattleUuid, roomId: roomUuid },
            },
            update: { 
              playerUuids: JSON.stringify(roomMemberMap[roomUuid] || []),
              totalDamage: { increment: damage } 
            },
            create: {
              uuid: worldBossBattleUuid,
              bossId,
              roomId: roomUuid,
              playerUuids: JSON.stringify(roomMemberMap[roomUuid] || []),
              totalDamage: damage,
            },
          })
        )
      } 
    }

    await Promise.all(updatesPromises);
  } catch (error) {
    console.error('Failed to update world boss damage records:', error);
  }

  return state;
}

/**
 * 在战斗回合内消费世界 Boss HP 事件，更新全局状态并广播给相关玩家。
 * 默认节流 2s，避免多房间高频重复消费。
 */
export async function syncWorldBossHp(
  bossId: string,
  roomMembers: string[],
  extraPlayers: string[] = [],
): Promise<WorldBossGlobalState | null> {
  const now = Date.now();
  const last = lastWorldBossSyncAt.get(bossId) ?? 0;
  if (now - last < WORLD_BOSS_HP_SYNC_INTERVAL_MS) return null;

  lastWorldBossSyncAt.set(bossId, now);
  const events = await popDamageEvents(bossId, 256);
  // if (events.length === 0) {
  //   return null;
  // }

  const updated = await applyDamageEventsToGlobalState(bossId, events);
  if (!updated) return null;

  const playerSet = new Set<string>();
  roomMembers.filter(Boolean).forEach((p) => playerSet.add(p));
  extraPlayers.filter(Boolean).forEach((p) => playerSet.add(p));
  for (const evt of events) {
    if (Array.isArray(evt.players)) {
      evt.players.filter(Boolean).forEach((p) => playerSet.add(p));
    }
  }

  pushMessageToQueue({
    type: "worldBoss:hp_update",
    battleUuid: "",
    battleInfo: {} as any,
    playerUuid: Array.from(playerSet),
    info: {
      bossId,
      currentHp: updated.currentHp,
      totalHp: updated.totalHp,
      lastUpdated: updated.lastUpdated,
      bossMembers: updated.bossMembers.map((m) => ({ uuid: m.uuid, hp: m.hp, maxHp: m.maxHp })),
    },
  });

  lastWorldBossSyncAt.set(bossId, now);

  return updated;
}

