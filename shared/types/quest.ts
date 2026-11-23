import type { AllGameActionMainType, AllGameActionID } from "./gameAction";
import type { AllGameResourceIDWithInternal } from "./gameResource";

export interface QuickCreateActionQuestParams {
  executor: string;
  rewards: QuestReward[];
  mainType?: AllGameActionMainType;
  difficulty?: number;
  count?: number;
}

export type QuestTarget = {
    actionId: AllGameActionID; // 需要完成的具体 GameAction
    count: number;             // 需要完成的次数
    current: number;          // 当前已完成次数
};

export type QuestReward = {
    resourceId: AllGameResourceIDWithInternal;
    count: number;
};

export type Quest = {
    uuid: string;
    title: string;
    actionMainType: AllGameActionMainType;
    description?: string;

    executor: string

    difficulty: number

    createdAt: Date;
    updatedAt?: Date;
    completedAt?: Date;
    dueDate?: Date;

    status: "PENDING" | "DOING" | "DONE" | "REROLL" | "EXPIRED" | "CLOSED"

    rerollCount: number

    target: QuestTarget;      // 任务目标（单一目标）
    rewards: QuestReward[];      // 任务奖励
};