// Clean, non-duplicated achievement type definitions.

import { ItemCountInfo } from "./gameInventory";

export type AchievementRuleType =
  | 'resourceCounter'
  | 'actionCounter'
  | 'enemyKillCounter'
  | 'customCounter'
  | 'event'
  | 'oneoff'
  | 'composite'
  | 'predicate'
  | 'behavioral'
  | 'milestone';

export type ResourceCounterRule = {
  type: 'resourceCounter';
  key: string; // e.g. "item:iron" or "kill:goblin"
  thresholds: number;
  windowMs?: number;
};

export type ActionCounterRule = {
  type: 'actionCounter';
  key: string; // e.g. "item:iron" or "kill:goblin"
  thresholds: number;
  windowMs?: number;
};

export type EnemyKillCounterRule = {
  type: 'enemyKillCounter';
  key: string; // e.g. "kill:goblin"
  thresholds: number;
  windowMs?: number;
};

export type CustomCounterRule = {
  type: 'customCounter';
  key: string; // e.g. "item:iron" or "kill:goblin"
  thresholds: number;
  windowMs?: number;
};

export type MilestoneCounterRule = {
  type: 'milestoneCount';
  key: string; // e.g. "item:iron" or "kill:goblin"
  thresholds: number;
  windowMs?: number;
};

// export type MilestoneRule = {
//   type: 'milestone';
//   prop: string; // e.g. "player.level"
//   target: number;
// };

export type EventRule = {
  type: 'event';
  eventType: string; // e.g. "login", "guild:joined"
  conditions: () => boolean; // placeholder for future condition logic
};

export type BehavioralRule = {
  type: 'behavioral';
  metric: string; // e.g. "chat.messages_per_day"
  operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq';
  value: number;
  windowMs?: number;
};

export type PredicateRule = {
  type: 'predicate';
  evaluator: string; // registered evaluator name
  params?: Record<string, unknown>;
};

export type OneoffRule = { type: 'oneoff'; id?: string };

export type CompositeRule = { type: 'composite'; op: 'and' | 'or'; children: AchievementRule[] };

export type AchievementRule =
  | ResourceCounterRule
  | ActionCounterRule
  | EnemyKillCounterRule
  | CustomCounterRule
  | MilestoneCounterRule
  | EventRule
  | BehavioralRule
  | PredicateRule
  | OneoffRule
  | CompositeRule;

export interface AchievementDefinition {
  id: string;
  name: string;
  description?: string;
  rule: AchievementRule;
  reward?: ItemCountInfo;
  active?: boolean;
  meta?: Record<string, unknown>;
  // Optional prerequisites: other achievement codes that must be completed first
  prerequisites?: string[];
}

export interface AchievementEvent {
  eventId: string;
  playerId: string;
  type: string;
  payload?: Record<string, unknown>;
  ts?: number;
}

export interface PlayerAchievementRecord {
  userUuid: string;
  achievementId: string;
  progress: number;
  target?: number;
  completed?: boolean;
  completedAt?: Date | null;
  meta?: Record<string, unknown>;
}

export type PredicateEvaluator = (playerId: string, params?: Record<string, unknown>) => Promise<boolean> | boolean;

export interface AchievementRegistry {
  definitions: Record<string, AchievementDefinition>;
  predicateEvaluators?: Record<string, PredicateEvaluator>;
}

// 队列消息结构：将业务事件送入成就队列时的消息格式
export interface AchievementQueueMessage {
  eventId: string;
  playerId: string;
  type: string;
  payload?: Record<string, unknown>;
  ts?: number;
}

// 默认队列 key（可被覆盖）
export const ACHIEVEMENT_QUEUE_KEY = 'achievement:queue';

export default {} as const;
