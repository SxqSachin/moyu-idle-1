import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { KittyExpeditionTeamInGame } from "~/shared/types/kittyExpedition";

// 获取所有探险队
export function emitGetAllExpeditionTeams() {
  emitEventToServer("kittyExpedition:getAll");
}
export const onGetAllExpeditionTeamsSuccess = registerSocketEventListener<{ teams: KittyExpeditionTeamInGame[] }>("kittyExpedition:list:success");
export const onGetAllExpeditionTeamsFail = registerSocketEventListener<{ message: string }>("kittyExpedition:list:fail");

export function emitGetMyExpeditionTeams() {
  emitEventToServer("kittyExpedition:my");
}
export const onGetMyExpeditionTeamsSuccess = registerSocketEventListener<{ data: { [kittyUuid: string]: KittyExpeditionTeamInGame | null } }>("kittyExpedition:my:success");
export const onGetMyExpeditionTeamsFail = registerSocketEventListener<{ message: string }>("kittyExpedition:my:fail");

export function emitGetMyExpeditionHistory() {
  emitEventToServer("kittyExpedition:myHistory");
}
export const onGetMyExpeditionHistorySuccess = registerSocketEventListener<{ data: KittyExpeditionTeamInGame[] }>("kittyExpedition:myHistory:success");
export const onGetMyExpeditionHistoryFail = registerSocketEventListener<{ message: string }>("kittyExpedition:myHistory:fail");

// 创建探险队
export function emitCreateExpeditionTeam(kittyUuids: string[], name: string, expeditionAreaId: string) {
  emitEventToServer("kittyExpedition:create", { kittyUuids, name, expeditionAreaId });
}
export const onCreateExpeditionTeamSuccess = registerSocketEventListener<{ team: KittyExpeditionTeamInGame }>("kittyExpedition:create:success");
export const onCreateExpeditionTeamFail = registerSocketEventListener<{ message: string }>("kittyExpedition:create:fail");


export function emitJoinExpeditionTeam(teamUuid: string, kittyUuid: string) {
  emitEventToServer("kittyExpedition:join", { teamUuid, kittyUuid });
}
export const onJoinExpeditionTeamSuccess = registerSocketEventListener<{ team: KittyExpeditionTeamInGame }>("kittyExpedition:join:success");
export const onJoinExpeditionTeamFail = registerSocketEventListener<{ message: string }>("kittyExpedition:join:fail");

// 删除探险队
export function emitDeleteExpeditionTeam(teamUuid: string) {
  emitEventToServer("kittyExpedition:delete", { teamUuid });
}
export const onDeleteExpeditionTeamSuccess = registerSocketEventListener<{ teamUuid: string }>("kittyExpedition:delete:success");
export const onDeleteExpeditionTeamFail = registerSocketEventListener<{ teamUuid: string; message: string }>("kittyExpedition:delete:fail");

// 开始探险
export function emitBeginExpedition(teamUuid: string) {
  emitEventToServer("kittyExpedition:begin", { teamUuid });
}
export const onBeginExpeditionSuccess = registerSocketEventListener<{ team: KittyExpeditionTeamInGame }>("kittyExpedition:begin:success");
export const onBeginExpeditionFail = registerSocketEventListener<{ teamUuid: string; message: string }>("kittyExpedition:begin:fail");

export function emitLeaveExpeditionTeam(teamUuid: string, kittyUuid: string) {
  emitEventToServer("kittyExpedition:leave", { teamUuid, kittyUuid });
}
export const onLeaveExpeditionTeamSuccess = registerSocketEventListener<{ team: KittyExpeditionTeamInGame }>("kittyExpedition:leave:success");
export const onLeaveExpeditionTeamFail = registerSocketEventListener<{ message: string }>("kittyExpedition:leave:fail");

export function emitReturnExpedition(teamUuid: string) {
  emitEventToServer("kittyExpedition:return", { teamUuid });
}
export const onReturnExpeditionSuccess = registerSocketEventListener<void>("kittyExpedition:return:success");
export const onReturnExpeditionFail = registerSocketEventListener<{ teamUuid: string; message: string }>("kittyExpedition:return:fail");