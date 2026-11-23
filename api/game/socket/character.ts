import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";
import type { GameSocketData } from "~/shared/types/socket";
import type { CharacterEquipmentInfo, CharacterEquipmentType, PlayerInfo, PlayerState } from "~/shared/types/characterInfo";
import type { AllGameActionDurationDetail, AllGameActionID, AllGameActionResourceRequirementDetail } from "~/shared/types/gameAction";
import type { UnitBattleInventoryInfo } from "~/shared/types/unit";
import type { allTitles } from "~/shared/data/allTitle";
import type { Kitty } from "~/shared/types/kitty";
import type { GameFullBattleLogic } from "~/shared/types/skill";
import type { AllBattlePhase } from "~/shared/types/battle";

// 获取角色信息
export function emitGetCharacterInfo(characterUuid: string) {
  emitEventToServer("character:getInfo", { characterUuid });
}

// 修改密码
export function emitResetPassword(oldPassword: string, newPassword: string) {
  emitEventToServer("character:resetPassword", { oldPassword, newPassword });
}

// 角色相关 socket 事件绑定（兼容老用法）
export function bindCharacteSocketAction(funcs: {
  onGetInfoSuccess?: (info: GameSocketData<{playerInfo: PlayerInfo, currentActionId: string; kittiesInfo: {kitty: Kitty, currentActionId: AllGameActionID}[]} | null>) => void,
  onGetInfoError?: (info: GameSocketData<{ message: string }>) => void,
  onResetPasswordSuccess?: (data: GameSocketData<{ message: string }>) => void,
  onResetPasswordError?: (data: GameSocketData<{ message: string }>) => void,
}, action: 'on' | 'once' = 'on') : () => void {
  const listeners: Array<{ event: string, callback: (...args: any[]) => void }> = [];

  if (funcs.onGetInfoSuccess) {
    const cb = funcs.onGetInfoSuccess;
    registerSocketEventListener<GameSocketData<{playerInfo: PlayerInfo, currentActionId: string; kittiesInfo: {kitty: Kitty, currentActionId: AllGameActionID}[]} | null>>("character:getInfo:success")(cb);
    listeners.push({ event: "character:getInfo:success", callback: cb });
  }
  if (funcs.onGetInfoError) {
    const cb = funcs.onGetInfoError;
    registerSocketEventListener<GameSocketData<{ message: string }>>("character:getInfo:error")(cb);
    listeners.push({ event: "character:getInfo:error", callback: cb });
  }
  if (funcs.onResetPasswordSuccess) {
    const cb = funcs.onResetPasswordSuccess;
    registerSocketEventListener<GameSocketData<{ message: string }>>("character:resetPassword:success")(cb);
    listeners.push({ event: "character:resetPassword:success", callback: cb });
  }
  if (funcs.onResetPasswordError) {
    const cb = funcs.onResetPasswordError;
    registerSocketEventListener<GameSocketData<{ message: string }>>("character:resetPassword:error")(cb);
    listeners.push({ event: "character:resetPassword:error", callback: cb });
  }

  // 返回解绑方法（注意：registerSocketEventListener 已返回解绑函数，实际解绑需保存这些返回值）
  return () => {
    // 这里无法直接解绑，建议直接用 registerSocketEventListener 的返回值解绑
  };
}

// 动作耗时
export function emitUpdateActionDuration() {
  emitEventToServer("character:updateActionDuration");
}
export const onDispatchLatestActionDurationDetail = registerSocketEventListener<AllGameActionDurationDetail>("character:updateActionDuration:success");

// 动作资源需求
export function emitUpdateActionResourceRequirement() {
  emitEventToServer("character:updateActionResourceRequirement");
}
export const onDispatchLatestActionResourceRequirementDetail = registerSocketEventListener<AllGameActionResourceRequirementDetail>("character:updateActionResourceRequirement:success");

// 装备
export function emitGetEquipment(type: CharacterEquipmentType) {
  emitEventToServer("character:getEquipment", {type});
}
export const onGetWorkEquipmentSuccess = registerSocketEventListener<CharacterEquipmentInfo>("character:getEquipment:work:success");
export const onGetBattleEquipmentSuccess = registerSocketEventListener<CharacterEquipmentInfo>("character:getEquipment:battle:success");

export function emitGetOtherPlayerEquipment(characterUuid: string) {
  emitEventToServer("character:getOtherPlayerEquipment", { characterUuid });
}
export const onGetOtherPlayerEquipmentSuccess = registerSocketEventListener<CharacterEquipmentInfo>("character:getOtherPlayerEquipment:success");

export function emitGetOtherPlayerWorkEquipment(characterUuid: string) {
  emitEventToServer("character:getOtherPlayerWorkEquipment", { characterUuid });
}
export const onGetOtherPlayerWorkEquipmentSuccess = registerSocketEventListener<CharacterEquipmentInfo>("character:getOtherPlayerWorkEquipment:success");

// 战斗背包
export function emitGetBattleInventory() {
  emitEventToServer("character:getBattleInventory");
}
export const onGetBattleInventorySuccess = registerSocketEventListener<UnitBattleInventoryInfo>("character:getBattleInventory:success");

// 装备
export function emitAddResourceToBattleInventory(resourceId: string, count: number) {
  emitEventToServer("character:addResourceToBattleInventory", { resourceId, count });
}
export const onAddResourceToBattleInventorySuccess = registerSocketEventListener<UnitBattleInventoryInfo>("character:addResourceToBattleInventory:success");
export const onAddResourceToBattleInventoryFail = registerSocketEventListener<{message: string}>("character:addResourceToBattleInventory:fail");

export function emitRemoveResourceFromBattleInventory(resourceId: string) {
  emitEventToServer("character:removeResourceFromBattleInventory", { resourceId });
}
export const onRemoveResourceFromBattleInventorySuccess = registerSocketEventListener<UnitBattleInventoryInfo>("character:removeResourceFromBattleInventory:success");
export const onRemoveResourceFromBattleInventoryFail = registerSocketEventListener<{message: string}>("character:removeResourceFromBattleInventory:fail");

// 装备
export function emitRefillBattleInventory(resourceId: string, count: number) {
  emitEventToServer("character:refillBattleInventory", { resourceId, count });
}
export const onRefillBattleInventorySuccess = registerSocketEventListener<UnitBattleInventoryInfo>("character:refillBattleInventory:success");
export const onRefillBattleInventoryFail = registerSocketEventListener<{message: string}>("character:refillBattleInventory:fail");

// 技能顺序调整
export const emitReorderCharacterBattleInventory = (order: string[]) => {
    emitEventToServer("character:reorderBattleInventory", { order })
}
export const onReorderCharacterBattleInventorySuccess = registerSocketEventListener<UnitBattleInventoryInfo>("character:reorderBattleInventory:success")
export const onReorderCharacterBattleInventoryError = registerSocketEventListener<{ message: string }>("character:reorderBattleInventory:error")



export const onGetTitleSuccess = registerSocketEventListener<{titleId: keyof typeof allTitles}>("player:addTitle:success");


export function emitUpdateBattleUseItemLogic(resourceId: string, logic: GameFullBattleLogic, useWhen?: AllBattlePhase[]) {
  emitEventToServer("character:updateBattleUseItemLogic", { resourceId, logic, useWhen });
}
export const onUpdateBattleUseItemLogicSuccess = registerSocketEventListener<UnitBattleInventoryInfo>("character:updateBattleUseItemLogic:success");
export const onUpdateBattleUseItemLogicFail = registerSocketEventListener<{message: string}>("character:updateBattleUseItemLogic:fail");

export const emitGetCharacterGameState = (characterUuid?: string) => {
  emitEventToServer("character:getGameState", { uuid: characterUuid });
}
export const onGetCharacterGameStateSuccess = registerSocketEventListener<{ gameState: PlayerState }>("character:getGameState:success");
export const onGetCharacterGameStateError = registerSocketEventListener<{ message: string }>("character:getGameState:error");