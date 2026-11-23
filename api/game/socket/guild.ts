import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { GameGuild, GuildMemberInfo, GuildRole } from "~/shared/types/guild";

// 创建公会
export function emitCreateGuild(params: { name: string; description?: string; type?: string[] }) {
  emitEventToServer("guild:create", params);
}
export const onCreateGuildSuccess = registerSocketEventListener<{ guild: GameGuild }>("guild:create:success");
export const onCreateGuildFail = registerSocketEventListener<{ message: string }>("guild:create:fail");

// 获取公会列表
export function emitGetGuildList() {
  emitEventToServer("guild:getList");
}
export const onGetGuildList = registerSocketEventListener<{ list: GameGuild[] }>("guild:list");
export const onGetGuildListFail = registerSocketEventListener<{ message: string }>("guild:list:fail");

// 申请加入公会
export function emitRequestJoinGuild(guildUuid: string, message?: string) {
  emitEventToServer("guild:requestJoin", { guildUuid, message });
}
export const onRequestJoinGuildSuccess = registerSocketEventListener<{ guildUuid: string }>("guild:join:request:success");
export const onRequestJoinGuildFail = registerSocketEventListener<{ message: string }>("guild:join:request:fail");


// 获取公会成员列表
export function emitLeaveGuild(guildUuid: string) {
  emitEventToServer("guild:leave", { guildUuid });
}
export const onLeaveGuildSuccess = registerSocketEventListener<{ guild: GameGuild | null }>("guild:leave:success");
export const onLeaveGuildFail = registerSocketEventListener<{ message: string }>("guild:leave:fail");

// 审核入会申请
export function emitHandleJoinRequest(guildUuid: string, userUuid: string, approve: boolean) {
  emitEventToServer("guild:handleJoinRequest", { guildUuid, userUuid, approve });
}
export const onHandleJoinRequestSuccess = registerSocketEventListener<{ userUuid: string; approve: boolean }>("guild:join:handle:success");
export const onHandleJoinRequestFail = registerSocketEventListener<{ message: string }>("guild:join:handle:fail");

// 监听入会申请结果
export const onJoinRequestResult = registerSocketEventListener<{ guildUuid: string; approve: boolean }>("guild:join:result");

// 获取公会成员列表
export function emitGetGuildMembers(guildUuid: string) {
  emitEventToServer("guild:getMembers", { guildUuid });
}
export const onGetGuildMembers = registerSocketEventListener<{ guildUuid: string; members: { uuid: string; name: string; role: GuildRole, title: string }[] }>("guild:members");
export const onGetGuildMembersFail = registerSocketEventListener<{ message: string }>("guild:members:fail");

// 获取公会成员列表
export function emitGetOtherGuildInfo(guildUuid: string) {
  emitEventToServer("guild:getOtherGuild", { guildUuid });
}
export const onGetOtherGuildSuccess = registerSocketEventListener<{ guild: GameGuild | null }>("guild:getOtherGuild:success");
export const onGetOtherGuildFail = registerSocketEventListener<{ message: string }>("guild:getOtherGuild:fail");

// 编辑公会信息
export function emitUpdateGuildInfo(params: { guildUuid: string; name?: string; description?: string; type?: string[] }) {
  emitEventToServer("guild:updateInfo", params);
}
export const onUpdateGuildInfoSuccess = registerSocketEventListener<{ guild: GameGuild }>("guild:update:success");
export const onUpdateGuildInfoFail = registerSocketEventListener<{ message: string }>("guild:update:fail");

// 踢出成员
export function emitKickMember(guildUuid: string, userUuid: string) {
  emitEventToServer("guild:kickMember", { guildUuid, userUuid });
}
export const onKickMemberSuccess = registerSocketEventListener<{ userUuid: string }>("guild:kick:success");
export const onKickMemberFail = registerSocketEventListener<{ message: string }>("guild:kick:fail");
export const onKicked = registerSocketEventListener<{ guildUuid: string }>("guild:kicked");

// 解散公会
export function emitDisbandGuild(guildUuid: string) {
  emitEventToServer("guild:disband", { guildUuid });
}
export const onDisbandGuildSuccess = registerSocketEventListener<{ guildUuid: string }>("guild:disband:success");
export const onDisbandGuildFail = registerSocketEventListener<{ message: string }>("guild:disband:fail");

// 转让会长
export function emitTransferGuildOwner(guildUuid: string, newOwnerUuid: string) {
  emitEventToServer("guild:transferOwner", { guildUuid, newOwnerUuid });
}
export const onTransferGuildOwnerSuccess = registerSocketEventListener<{ newOwnerUuid: string }>("guild:transfer:success");
export const onTransferGuildOwnerFail = registerSocketEventListener<{ message: string }>("guild:transfer:fail");
export const onTransferGuildOwnerReceived = registerSocketEventListener<{ guildUuid: string }>("guild:transfer:received");

// 获取公会入会申请列表
export function emitGetGuildJoinRequests(guildUuid: string) {
  emitEventToServer("guild:getJoinRequests", { guildUuid });
}
export const onGetGuildJoinRequests = registerSocketEventListener<{ 
  guildUuid: string;
  requests: {
    createdAt: Date,
    message: string | null
    status: string
    userUuid: string
  }[]
}>("guild:join:requests");
export const onGetGuildJoinRequestsFail = registerSocketEventListener<{ message: string }>("guild:join:requests:fail");

// 获取用户的入会申请
export function emitGetUserJoinRequests() {
  emitEventToServer("guild:getUserJoinRequests");
}
export const onGetUserJoinRequests = registerSocketEventListener<{ requests: any[] }>("guild:join:myrequests");
export const onGetUserJoinRequestsFail = registerSocketEventListener<{ message: string }>("guild:join:myrequests:fail");

export function emitGetMyGuild() {
  emitEventToServer("guild:getMyGuild");
}
export const onGetMyGuildSuccess = registerSocketEventListener<{ guild: GameGuild }>("guild:getMyGuild:success");
export const onGetMyGuildFailed = registerSocketEventListener<{ message: string }>("guild:getMyGuild:fail");

export function emitGetMyGuildMemberInfo(guildUuid: string) {
  emitEventToServer("guild:getMyGuildMemberInfo", {guildUuid});
}
export const onGetMyGuildMemberInfoSuccess = registerSocketEventListener<{ guildUuid: string, member: GuildMemberInfo }>("guild:getMyGuildMemberInfo:success");
export const onGetMyGuildMemberInfoFailed = registerSocketEventListener<{ message: string }>("guild:getMyGuildMemberInfo:fail");


// 添加公会头衔
export function emitAddGuildTitle(params: { guildUuid: string; title: string; role: GuildRole; description?: string }) {
  emitEventToServer("guild:title:add", params);
}
export const onAddGuildTitleSuccess = registerSocketEventListener<{ guildUuid: string; title: string }>("guild:title:add:success");
export const onAddGuildTitleFail = registerSocketEventListener<{ message: string }>("guild:title:add:fail");

// 修改公会头衔
export function emitUpdateGuildTitle(params: { guildUuid: string; titleUuid: string; title: string; role: GuildRole; description?: string }) {
  emitEventToServer("guild:title:update", params);
}
export const onUpdateGuildTitleSuccess = registerSocketEventListener<{ guildUuid: string; titleUuid: string }>("guild:title:update:success");
export const onUpdateGuildTitleFail = registerSocketEventListener<{ message: string }>("guild:title:update:fail");

// 删除公会头衔
export function emitDeleteGuildTitle(params: { guildUuid: string; titleUuid: string }) {
  emitEventToServer("guild:title:delete", params);
}
export const onDeleteGuildTitleSuccess = registerSocketEventListener<{ guildUuid: string; titleUuid: string }>("guild:title:delete:success");
export const onDeleteGuildTitleFail = registerSocketEventListener<{ message: string }>("guild:title:delete:fail");

// 获取公会所有头衔
export function emitGetGuildTitles(guildUuid: string) {
  emitEventToServer("guild:title:list", { guildUuid });
}
export const onGetGuildTitlesSuccess = registerSocketEventListener<{ guildUuid: string; titles: { uuid: string; title: string; role: GuildRole; description?: string }[] }>("guild:title:list:success");
export const onGetGuildTitlesFail = registerSocketEventListener<{ message: string }>("guild:title:list:fail");

// 为玩家设置头衔
export function emitSetGuildMemberTitle(params: { guildUuid: string; userUuid: string; titleUuid: string }) {
  emitEventToServer("guild:title:set", params);
}
export const onSetGuildMemberTitleSuccess = registerSocketEventListener<{ guildUuid: string; userUuid: string; titleUuid: string }>("guild:title:set:success");
export const onSetGuildMemberTitleFail = registerSocketEventListener<{ message: string }>("guild:title:set:fail");