import type { AutoWorldBossBattleConf, BattleRoom, CreateBattleRoomInput, UpdateBattleRoomInput } from "~/shared/types/battleRoom";
import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { BattleInfo } from "~/shared/types/battle";
import type { ItemCountInfo } from "~/shared/types/gameInventory";

// 创建战斗房间
export const emitBattleRoomCreate = (opt: CreateBattleRoomInput) => {
  emitEventToServer("battleRoom:create", opt);
};
export const onBattleRoomCreateSuccess = registerSocketEventListener<BattleRoom>("battleRoom:create:success");
export const onBattleRoomCreateError = registerSocketEventListener<{ message: string }>("battleRoom:create:error");

// 获取战斗房间列表
export const emitBattleRoomList = (opt: {page: number, name?: string, area?: string, onlyWaiting?: boolean}) => {
  emitEventToServer("battleRoom:list", opt);
};
export const onBattleRoomList = registerSocketEventListener<BattleRoom[]>("battleRoom:list:success");
export const onBattleRoomListError = registerSocketEventListener<{ message: string }>("battleRoom:list:error");

// 加入房间
export const emitJoinBattleRoom = (roomId: string) => {
  emitEventToServer("battleRoom:join", { roomId });
};
export const onJoinBattleRoomSuccess = registerSocketEventListener<BattleRoom>("battleRoom:join:success");
export const onJoinBattleRoomError = registerSocketEventListener<{ message: string }>("battleRoom:join:error");

// 离开房间
export const emitLeaveBattleRoom = () => {
  emitEventToServer("battleRoom:leave");
};
export const onLeaveBattleRoomSuccess = registerSocketEventListener<{roomId: string}>("battleRoom:leave:success");
export const onLeaveBattleRoomError = registerSocketEventListener<{ message: string }>("battleRoom:leave:error");

// 踢出房间
export const emitKickBattleRoomUser = (roomId: string, targetUserId: string) => {
  emitEventToServer("battleRoom:kick", { roomId, targetUserId });
};
export const onKickBattleRoomSuccess = registerSocketEventListener<BattleRoom>("battleRoom:kick:success");
export const onKickBattleRoomError = registerSocketEventListener<{ message: string }>("battleRoom:kick:error");
export const onBattleRoomKicked = registerSocketEventListener<{ roomId: string }>("battleRoom:kick");


// 排序单位
export const emitReorderRoomMember = (roomId: string, newMemberUuids : string[]) => {
  emitEventToServer("battleRoom:reorder", { roomId, newMemberUuids });
};
export const onReorderRoomMemberFailed = registerSocketEventListener<{ message: string }>("battleRoom:reorder:error");

export const emitGetRoomBattleRewardInfo = (roomId: string ) => {
  emitEventToServer("battleRoom:rewardInfo", { roomId });
};
export const onGetRoomBattleRewardInfoSuccess = registerSocketEventListener<{ data: Record<string, ItemCountInfo> }>("battleRoom:rewardInfo:success");
export const onGetRoomBattleRewardInfoError = registerSocketEventListener<{ message: string; }>("battleRoom:rewardInfo:error");

export const emitResetSelfBattleRewardInfo = (roomId: string ) => {
  emitEventToServer("battleRoom:resetSelfBattleRewardInfo", { roomId });
};
export const onResetSelfBattleRewardInfoSuccess = registerSocketEventListener<void>("battleRoom:resetSelfBattleRewardInfo:success");
export const onResetSelfBattleRewardInfoError = registerSocketEventListener<{ message: string; }>("battleRoom:resetSelfBattleRewardInfo:error");

// 更新准备状态
export const emitUpdateReadyState = (roomId: string, ready: boolean) => {
  emitEventToServer("battleRoom:updateReadyState", { roomId, ready });
};
// export const onUpdateReadyStateSuccess = registerSocketEventListener<BattleRoom>("battleRoom:updateReadyState:success");
export const onUpdateReadyStateError = registerSocketEventListener<{ message: string }>("battleRoom:updateReadyState:error");

// 获取当前所在房间
export const emitGetCurrentBattleRoom = () => {
  emitEventToServer("battleRoom:getCurrentRoom");
};
export const onGetCurrentBattleRoomSuccess = registerSocketEventListener<BattleRoom | null>("battleRoom:getCurrentRoom:success");
export const onGetCurrentBattleRoomError = registerSocketEventListener<{ message: string }>("battleRoom:getCurrentRoom:error");

// 房间内广播的房间信息实时更新事件
export const onBattleRoomUpdate = registerSocketEventListener<BattleRoom>("battleRoom:update");


export const emitBattleRoomStartBattle = (roomId: string) => {
  emitEventToServer("battleRoom:startBattle", { roomId });
};
export const onBattleRoomStartBattleSuccess = registerSocketEventListener<BattleRoom>("battleRoom:startBattle:success");
export const onBattleRoomStartBattleError = registerSocketEventListener<{ message: string }>("battleRoom:startBattle:error");


export const emitUpdateBattleRoomInfo = (
  roomId: string,
  data: UpdateBattleRoomInput,
) => {
  emitEventToServer("battleRoom:update", { roomId, ...data });
};
export const onUpdateBattleRoomInfoSuccess = registerSocketEventListener<BattleRoom>("battleRoom:update:success");
export const onUpdateBattleRoomInfoError = registerSocketEventListener<{ message: string }>("battleRoom:update:error");

// 单独更新 autoWorldBossBattleConf（仅普通房间）
export const emitSetAutoWorldBossBattleConf = (
  roomId: string,
  autoWorldBossBattleConf: AutoWorldBossBattleConf,
) => {
  emitEventToServer("battleRoom:setAutoWorldBossBattleConf", { roomId, autoWorldBossBattleConf });
};
export const onSetAutoWorldBossBattleConfSuccess = registerSocketEventListener<BattleRoom>("battleRoom:setAutoWorldBossBattleConf:success");
export const onSetAutoWorldBossBattleConfError = registerSocketEventListener<{ message: string }>("battleRoom:setAutoWorldBossBattleConf:error");

export const emitAddPhantomToBattleRoom = (
  roomId: string,
  phantomBorrowUuid: string,
) => {
  emitEventToServer("battleRoom:addPhantom", { roomId, phantomBorrowUuid });
};

export const emitRemovePhantomFromBattleRoom = (
  roomId: string,
  phantomBorrowUuid: string,
) => {
  emitEventToServer("battleRoom:removePhantom", { roomId, phantomBorrowUuid });
};

export const emitBattleRoomAddOffering = (
  roomId: string,
  specId: string,
  count: number,
  resourceId?: string,
) => {
  emitEventToServer("battleRoom:addOffering", { roomId, specId, count, resourceId });
};
export const onBattleRoomAddOfferingSuccess = registerSocketEventListener<void>("battleRoom:addOffering:success");
export const onBattleRoomAddOfferingError = registerSocketEventListener<{ message: string }>("battleRoom:addOffering:error");

export const emitBattleRoomReturnOffering = (
  roomId: string,
  specId: string,
) => {
  emitEventToServer("battleRoom:returnOffering", { roomId, specId });
};
export const onBattleRoomReturnOfferingSuccess = registerSocketEventListener<void>("battleRoom:returnOffering:success");
export const onBattleRoomReturnOfferingError = registerSocketEventListener<{ message: string }>("battleRoom:returnOffering:error");
// 加入房间
// export const emitJoinViewBattleRoom = (roomId: string) => {
//   emitEventToServer("battleRoom:joinView", { roomId });
// };
// export const onJoinBattleViewRoomSuccess = registerSocketEventListener<void>("battleRoom:joinView:success");
// export const onJoinBattleViewRoomError = registerSocketEventListener<{ message: string }>("battleRoom:joinView:error");

// // 离开房间
// export const emitLeaveViewBattleRoom = () => {
//   emitEventToServer("battleRoom:leaveView");
// };
// export const onLeaveViewBattleRoomSuccess = registerSocketEventListener<void>("battleRoom:leaveView:success");
// export const onLeaveViewBattleRoomError = registerSocketEventListener<{ message: string }>("battleRoom:leaveView:error");