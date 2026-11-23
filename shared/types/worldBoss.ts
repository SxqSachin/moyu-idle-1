import type { BaseBattleUnit } from "./unit";
import type { ItemDrop } from "./emeny";

export type WorldBossStateStatus = "waiting" | "battling" | "player_win" | "player_lose";

export interface WorldBossBattleConfig {
  id: string;
  name: string;
  description?: string;
  bossMembers: BaseBattleUnit[];
  state: WorldBossStateStatus;
  // 可选：活动开始与结束时间（毫秒时间戳）
  startAt?: number;
  endAt?: number;
  version: number;
  updatedAt: number;

  hidden?: boolean; // 是否在前端对玩家可见（默认为 false）
}


export type BossUnitWithDrops = BaseBattleUnit & { drops?: ItemDrop[] };
export interface CreateWorldBossBattleConfigInput {
  id: string;
  name: string;
  description?: string;
  bossMembers: BossUnitWithDrops[];
  state?: WorldBossStateStatus;

  hidden?: boolean;

  startAt?: number;
  endAt?: number;
}

export interface WorldBossDeltaEvent {
  worldBossBattleUuid: string;
  bossId: string;
  // 总体 HP 变化（对整个 Boss，总是 sum of unit deltaHp）
  totalDeltaHp: number;
  // 每个 Boss 单位的 HP 变化明细
  units: Array<{
    unitUuid: string;
    deltaHp: number;
    afterHp: number;
  }>;
  roomId: string;
  battleId: string;
  turn: number;
  seq: number;
  createdAt: number;
  // 事件携带的玩家列表，减少同步侧 Redis 查询
  players: string[];
}

export interface WorldBossGlobalState {
  uuid: string;
  bossId: string;
  version: number;
  bossMembers: BaseBattleUnit[];
  totalHp: number;
  currentHp: number;
  lastUpdated: number;
  status: WorldBossStateStatus;

  dispatchedRewards?: boolean;
}

export interface WorldBossSnapshot {
  bossId: string;
  name: string;
  description?: string;
  version: number;
  state: WorldBossStateStatus;
  updatedAt: number;
  lootDrops?: ItemDrop[];
  bossMembersSummary?: { name: string; currentHp: number; maxHp: number }[];
  globalState?: WorldBossGlobalState | null;
}

export interface WorldBossConfigInBattleInfo {
  bossId: string;

  worldBossBattleUuid: string

  uuidList: string[];

  startAt?: number;
  endAt?: number;
}

export interface WorldBossConfigWithState extends WorldBossBattleConfig {
  globalState?: WorldBossGlobalState | null;
  // 当前用户是否已经领取过该场次奖励（仅 listAvailable 接口按用户补充）
  hasClaimedReward?: boolean;
}