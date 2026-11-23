export enum GameBroadcastKind {
  USER_ACTION_DURATION_UPDATED = "USER_ACTION_DURATION_UPDATED",
  USER_PROFILE_UPDATED = "USER_PROFILE_UPDATED",

  USER_STATUS_UPDATED = "USER_STATUS_UPDATED",
  USER_TALENT_CAT_UPDATED = "USER_TALENT_CAT_UPDATED",
  USER_QUEST_UPDATED = "USER_QUEST_UPDATED",
  USER_WORK_EQUIPMENT = "USER_WORK_EQUIPMENT",
  USER_GLOBAL_STATE_UPDATED = "USER_GLOBAL_STATE_UPDATED",
  USER_SKILL_TREE_UPDATED = "USER_SKILL_TREE_UPDATED",

  USER_TASK_QUEUE_CHANGED = "USER_TASK_QUEUE_CHANGED",
  USER_DATA_INVALIDATE = "USER_DATA_INVALIDATE",


  USER_BASIC_INFO_UPDATED = "USER_BASIC_INFO_UPDATED",
}

export interface BroadcastMessage {
  kind: GameBroadcastKind;
}

export type UserActionDurationUpdateMessage = BroadcastMessage & {
  kind: GameBroadcastKind.USER_ACTION_DURATION_UPDATED;
  userUuid: string;
};

export type UserStatusUpdateMessage = BroadcastMessage & {
  kind: GameBroadcastKind.USER_STATUS_UPDATED;
  userUuid: string;
};

export type UserTalentCatUpdateMessage = BroadcastMessage & {
  kind: GameBroadcastKind.USER_TALENT_CAT_UPDATED;
  userUuid: string;
};

export type UserQuestUpdateMessage = BroadcastMessage & {
  kind: GameBroadcastKind.USER_QUEST_UPDATED;
  userUuid: string;
}

export type UserWorkEquipmentUpdateMessage = BroadcastMessage & {
  kind: GameBroadcastKind.USER_WORK_EQUIPMENT;
  userUuid: string;
}

export type UserGlobalStateUpdateMessage = BroadcastMessage & {
  kind: GameBroadcastKind.USER_GLOBAL_STATE_UPDATED;
  userUuid: string;
}

export type UserSkillTreeUpdateMessage = BroadcastMessage & {
  kind: GameBroadcastKind.USER_SKILL_TREE_UPDATED;
  userUuid: string;
}

export type UserTaskQueueChangedMessage = BroadcastMessage & {
  kind: GameBroadcastKind.USER_TASK_QUEUE_CHANGED;
  userUuid: string;
}

export type UserBasicInfoUpdateMessage = BroadcastMessage & {
  kind: GameBroadcastKind.USER_BASIC_INFO_UPDATED;
  userUuid: string;
}

export type AllBroadcastMessage = 
  | UserActionDurationUpdateMessage

  | UserStatusUpdateMessage
  | UserTalentCatUpdateMessage
  | UserQuestUpdateMessage
  | UserWorkEquipmentUpdateMessage
  | UserGlobalStateUpdateMessage
  | UserSkillTreeUpdateMessage

  | UserTaskQueueChangedMessage
  | UserBasicInfoUpdateMessage
  ;