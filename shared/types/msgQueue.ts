import type { BattleInfo, DealDamageTargetDetail, FullBattleAction } from "./battle";
import type { BattleRoom } from "./battleRoom";
import type { AllBattleStateId } from "./BattleState";
import type { CharacterStatusInfo } from "./characterInfo";
import type { GameAction } from "./gameAction";
import type { ItemCountInfo } from "./gameInventory";
import type { AllGameResourceID } from "./gameResource";
import type { GameTask } from "./gameTask";
import type { Quest } from "./quest";
import type { AllBattleSkillId, DamageType } from "./skill";
import type { UnitExpRewardInSingleBattle, UnitStatisticInfoInSingleBattle } from "./unit";

// 消息类型枚举
export type MsgQueueType = "use_item" | "get_item";

// 仓库物品使用消息
export interface UseResourceMsg {
  type: "use_resource";
  userUuid: string;
  info: ItemCountInfo;
}

export interface NeedResetCurrentActionProgressMsg {
    type: "need_reset_current_action_progress";
    userUuid: string;
}

export interface DispatchTaskQueueToClientMsg {
    type: "dispatch_task_queue_to_client";
    userUuid: string;
    info: GameTask[]
}

export interface DispatchResourceIncrease {
  type: "dispatch_resource_increase";
  userUuid: string;
  info: ItemCountInfo;
}

export interface TaskUpdatedMsg {
  type: "task_updated";
  userUuid: string;
  firstTask: GameTask;
}

export interface TaskDoneMsg {
  type: "task_done";
  userUuid: string;
  info: GameTask;
}

export interface DispatchInventoryUpdatedToClientMsg {
    type: "inventory_updated";
    userUuid: string;
}

export interface DispatchInventoryModifyEvent {
    type: "inventory_modify";
    userUuid: string;
    info: ItemCountInfo
}

export interface DispatchBuildingInfo {
    type: "building_info";
    userUuid: string;
}

export interface DispatchStatusInfo {
    type: "status_info";
    userUuid: string;
    info: CharacterStatusInfo;
}

export interface DispatchStatusUpgradeInfo {
    type: "status_upgrade";
    userUuid: string;
    info: Partial<CharacterStatusInfo>
}

export interface QuestUpdate {
    type: "quest_update";
    userUuid: string;
    info: Quest
}

export interface DispatchBattleInfo {
  type: "dispatch_battle_info_to_client";
  roomUuid: string;
  battleInfo: BattleInfo;
  thisRoundAction?: FullBattleAction
}

export interface DispatchBattleEnd {
  type: "dispatch_battle_end";
  roomUuid: string;
}

export interface notifyAllRoomMembersToUpdateRoom {
  type: "notify_all_room_members_to_update_room";
  roomUuid: string;
}

export interface BattlePrepareBeginMsg {
  type: "battle_prepare_begin";
  battleInfo: BattleInfo;
  battleUuid: string;
  info: {
  }
}
export interface BattlePrepareEndMsg {
  type: "battle_prepare_end";
  battleInfo: BattleInfo;
  battleUuid: string;
  info: {
  }
}
export interface BattleBeginMsg {
  type: "battle_begin";
  battleInfo: BattleInfo;
  battleUuid: string;
  info: {
    turnIndex: number
  }
}

export interface BattleStartMsg {
  type: "battle_start";
  userUuid: string;
  battleRoom: BattleRoom
}

export interface DispatchLatestBattleInfo {
  type: "dispatch_latest_battle_info";
  battleRoom: BattleRoom
  latestBattleInfo?: BattleInfo;
}

export interface DispatchKittyTaskQueue {
  type: "dispatch_kitty_task_queue";
  userUuid: string;
  kittyUuid: string;
  taskQueue: GameTask[];
}

export interface UseBattleItem {
  type: "use_battle_item";
  battleUuid: string;
  battleInfo: BattleInfo;
  info: {
    user: string;
    itemId: AllGameResourceID;
    remainingCount: number;
  }
}

export interface OnDealDamage {
  type: "on_deal_damage";
  battleUuid: string;
  battleInfo: BattleInfo;
  info: {
    source: string;
    target: (Omit<DealDamageTargetDetail, 'unit'> & {
    unit: string
    })[]
    hideAnimEffect_Line?: boolean
    color?: string
  };
}

export interface OnHeal {
  type: "on_heal";
  battleUuid: string;
  battleInfo: BattleInfo;
  info: {
    source: string;
    target: string;
    value: number;
  }
}
export interface OnLossMp {
  type: "on_loss_mp";
  battleUuid: string;
  battleInfo: BattleInfo;
  info: {
    source: string;
    target: string;
    value: number;
  }
}
export interface OnRestoreMp {
  type: "on_restore_mp";
  battleUuid: string;
  battleInfo: BattleInfo;
  info: {
    source: string;
    target: string;
    value: number;
  }
}

export interface OnCastSkill {
  type: "on_cast_skill";
  battleUuid: string;
  battleInfo: BattleInfo;
  info: {
    skillId: AllBattleSkillId;
    source: string;
  }
}

export interface BattleFloatText {
  type: "battle_float_text";
  battleUuid: string;
  battleInfo: BattleInfo;
  info: {
    unit: string;
    text: string;
    hidePopover?: boolean
  }
}
export interface OnAddState{
  type: "on_add_state";
  battleUuid: string;
  battleInfo: BattleInfo;
  info: {
    source: string;
    target: string;
    value: number;
    stateId: AllBattleStateId;
  }
}

export interface OnTurnStart{
  type: "on_turn_start";
  battleInfo: BattleInfo;
  battleUuid: string;
  info: {
    source: string;
  }
}

export interface OnTurnEnd{
  type: "on_turn_end";
  battleInfo: BattleInfo;
  battleUuid: string;
  info: {
    source: string;
  }
}

export interface BattleInfoDetail {
  type: "battle_info_detail";
  battleUuid: string;
  playerUuid: string[];
  info: {
    detail: Record<string, UnitStatisticInfoInSingleBattle>
  }
}
export interface GiveBattleExpReward {
  type: "give_battle_exp_reward";
  battleUuid: string;
  playerUuid: string[];
  info: {
    expRewardDetail: Record<string, UnitExpRewardInSingleBattle>
  }
}

export interface GiveBattleResourceReward {
  type: "give_battle_resource_reward";
  battleUuid: string;
  playerUuid: string[];
  info: {
    resourceRewardDetail: Record<string, ItemCountInfo>
  }
}

export interface BattleDrawLine {
  type: "draw_line";
  battleUuid: string;
  battleInfo: BattleInfo;
  info: {
    source: string;
    target: string;
    color: string;
  }
}

export interface WorldBossHpUpdate {
  type: "worldBoss:hp_update";
  battleUuid: string;
  battleInfo: BattleInfo;
  playerUuid: string[];
  info: {
    bossId: string;
    currentHp: number;
    totalHp: number;
    lastUpdated: number;
    bossMembers: Array<{
      uuid: string;
      hp: number;
      maxHp: number;
    }>;
  };
}

export interface WorldBossVictory {
  type: "worldBoss:victory";
  battleUuid: string;
  battleInfo: BattleInfo;
  playerUuid: string[];
  info: {
    bossId: string;
  };
}

export interface WorldBossDefeat {
  type: "worldBoss:defeat";
  battleUuid: string;
  battleInfo: BattleInfo;
  playerUuid: string[];
  info: {
    bossId: string;
  };
}

// 联合类型
export type MsgQueuePayload = DispatchInventoryUpdatedToClientMsg | DispatchInventoryModifyEvent 
| UseResourceMsg | DispatchResourceIncrease
| NeedResetCurrentActionProgressMsg | DispatchTaskQueueToClientMsg
    
    | TaskUpdatedMsg | TaskDoneMsg
    | DispatchBuildingInfo

    | DispatchStatusInfo | DispatchStatusUpgradeInfo
    | QuestUpdate

    |DispatchBattleInfo | DispatchBattleEnd | notifyAllRoomMembersToUpdateRoom 
    | BattleBeginMsg | BattlePrepareBeginMsg | BattlePrepareEndMsg
    | BattleStartMsg | DispatchLatestBattleInfo
    | DispatchKittyTaskQueue 
    | UseBattleItem | OnCastSkill
    | OnDealDamage | OnHeal | OnLossMp | OnRestoreMp | OnAddState
    | OnTurnStart | OnTurnEnd
    | BattleFloatText 
    | GiveBattleExpReward | BattleInfoDetail | GiveBattleResourceReward  | BattleDrawLine
    | WorldBossHpUpdate | WorldBossVictory | WorldBossDefeat
    ;