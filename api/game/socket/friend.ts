import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { FriendRequest, Friendship } from "~/generated/prisma";

// 发送好友请求
export function emitSendFriendRequest(toUserName: string) {
  emitEventToServer("friend:sendRequest", { toUserName });
}
export const onSendFriendRequestSuccess = registerSocketEventListener<{ toUserUuid: string }>("friend:request:send:success");
export const onSendFriendRequestFail = registerSocketEventListener<{ message: string }>("friend:request:send:fail");

// 接受好友请求
export function emitAcceptFriendRequest(requestId: number) {
  emitEventToServer("friend:acceptRequest", { requestId });
}
export const onAcceptFriendRequestSuccess = registerSocketEventListener<{ requestId: number }>("friend:request:accept:success");
export const onAcceptFriendRequestFail = registerSocketEventListener<{ message: string }>("friend:request:accept:fail");

// 拒绝好友请求
export function emitRejectFriendRequest(requestId: number) {
  emitEventToServer("friend:rejectRequest", { requestId });
}
export const onRejectFriendRequestSuccess = registerSocketEventListener<{ requestId: number }>("friend:request:reject:success");
export const onRejectFriendRequestFail = registerSocketEventListener<{ message: string }>("friend:request:reject:fail");

// 删除好友
export function emitRemoveFriend(friendUuid: string) {
  emitEventToServer("friend:remove", { friendUuid });
}
export const onRemoveFriendSuccess = registerSocketEventListener<{ friendUuid: string }>("friend:remove:success");
export const onRemoveFriendFail = registerSocketEventListener<{ message: string }>("friend:remove:fail");

// 获取好友列表
export function emitGetFriendList() {
  emitEventToServer("friend:getList");
}
export const onGetFriendList = registerSocketEventListener<{ list: {name: string, uuid: string}[] }>("friend:list");
export const onGetFriendListFail = registerSocketEventListener<{ message: string }>("friend:list:fail");

// 获取好友请求列表
export function emitGetFriendRequests() {
  emitEventToServer("friend:getRequests");
}
export const onGetFriendRequests = registerSocketEventListener<{ requests: FriendRequest[] }>("friend:requests");
export const onGetFriendRequestsFail = registerSocketEventListener<{ message: string }>("friend:requests:fail");

// 监听收到好友请求
export const onFriendRequestReceived = registerSocketEventListener<{ fromUserUuid: string }>("friend:request:received");

// 监听好友请求被接受
export const onFriendRequestAccepted = registerSocketEventListener<{ fromUserUuid?: string; toUserUuid?: string }>("friend:request:accepted");

// 监听好友请求被拒绝
export const onFriendRequestRejected = registerSocketEventListener<{ toUserUuid: string }>("friend:request:rejected");

// 监听被好友删除
export const onFriendRemoved = registerSocketEventListener<{ userUuid: string }>("friend:removed");