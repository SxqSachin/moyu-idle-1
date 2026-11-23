import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket"
import type { GameSocketData } from "~/shared/types/socket"
import type { ChatMessage } from "~/shared/types/chat"

// 发送公共聊天消息
export function emitCreatePublicChatMsg(content: string) {
  emitEventToServer("chat:createPublicChatMsg", { content })
}

// 监听发送消息错误
export const onCreateChatMsgError = registerSocketEventListener<{ message: string }>("chat:createPublicMessage:error")

export const onCreateCommentError = registerSocketEventListener<{ message: string }>("chat:createComment:error")

// 发送公共聊天消息
export function emitCreatePrivateChatMsg(toUser: string, content: string) {
  emitEventToServer("chat:createPrivateChatMsg", { toUser, content })
}
// 监听发送私聊消息错误
export const onCreatePrivateChatMsgError = registerSocketEventListener<{ message: string }>("chat:createPrivateChatMsg:error")
export const onReceivePrivateChatMsg = registerSocketEventListener<{ msg: ChatMessage }>("chat:newPrivateChatMsg")

export function emitGetPrivateChatList(receiverUuid: string) {
  emitEventToServer("chat:getPrivateChatList", { receiverUuid })
}
// 监听获取私聊消息列表成功
export const onGetPrivateChatListSuccess = registerSocketEventListener<{ list: ChatMessage[] }>("chat:getPrivateChatList:success")

export function emitGetAllPrivateChatList() {
  emitEventToServer("chat:getAllPrivateChatList")
}
// 监听获取所有私聊消息列表成功
export const onGetAllPrivateChatListSuccess = registerSocketEventListener<{ list: ChatMessage[] }>("chat:getAllPrivateChatList:success")

// 监听新消息广播
export const onNewPublicChatMsg = registerSocketEventListener<ChatMessage>("chat:newPublicChatMsg")

// 获取公共聊天消息列表
export function emitGetPublicChatList() {
  emitEventToServer("chat:getPublicChatList")
}

// 监听获取消息列表成功
export const onGetPublicChatListSuccess = registerSocketEventListener<{ list: ChatMessage[] }>("chat:getChatList:success")

// 监听获取消息列表失败
export const onGetPublicChatListError = registerSocketEventListener<{ message: string }>("chat:getChatList:error")

// 房间聊天：发送消息
export function emitCreateRoomChatMsg(roomId: string, content: string) {
  emitEventToServer("chat:createRoomChatMsg", { roomId, content })
}
// 房间聊天：监听发送消息错误
export const onCreateRoomChatMsgError = registerSocketEventListener<{ message: string }>("chat:room:error")
// 房间聊天：监听新消息
export const onNewRoomChatMsg = registerSocketEventListener<{ msg: ChatMessage }>("chat:newRoomChatMsg")

// 房间聊天：获取消息列表
export function emitGetRoomChatList(roomId: string) {
  emitEventToServer("chat:getRoomChatList", { roomId })
}
// 房间聊天：监听获取消息列表成功
export const onGetRoomChatListSuccess = registerSocketEventListener<{ list: ChatMessage[] }>("chat:getRoomChatList:success")
// 房间聊天：监听获取消息列表失败
export const onGetRoomChatListError = registerSocketEventListener<{ message: string }>("chat:getRoomChatList:error")

// 房间聊天：发送消息
export function emitCreateGuildChatMsg(guildUuid: string, content: string) {
  emitEventToServer("chat:createGuildChatMsg", { guildUuid, content })
}
// 公会聊天：监听发送消息错误
export const onCreateGuildChatMsgError = registerSocketEventListener<{ message: string }>("chat:guild:error")
// 公会聊天：监听新消息
export const onNewGuildChatMsg = registerSocketEventListener<{ msg: ChatMessage }>("chat:newGuildChatMsg")

export function emitGetGuildChatList(guildUuid: string) {
  emitEventToServer("chat:getGuildChatList", { guildUuid })
}
// 公会：监听获取消息列表成功
export const onGetGuildChatListSuccess = registerSocketEventListener<{ list: ChatMessage[] }>("chat:getGuildChatList:success")
// 公会聊天：监听获取消息列表失败
export const onGetGuildChatListError = registerSocketEventListener<{ message: string }>("chat:getGuildChatList:error")

export function emitCreateIronPublicChatMsg(content: string) {
  emitEventToServer("chat:createIronPublicChatMsg", { content })
}
export function emitGetIronPublicChatList() {
  emitEventToServer("chat:getIronPublicChatList")
}
export const onGetIronPublicChatListSuccess = registerSocketEventListener<{ list: ChatMessage[] }>("chat:getIronPublicChatList:success")
export const onGetIronPublicChatListError = registerSocketEventListener<{ message: string }>("chat:getIronPublicChatList:error")
export const onNewIronPublicChatMsg = registerSocketEventListener<ChatMessage>("chat:newIronPublicChatMsg")

// ===== 屏蔽功能相关 =====
export function emitBlockUser(targetUuid: string) {
  emitEventToServer("chat:blockUser", { targetUuid })
}
export function emitUnblockUser(targetUuid: string) {
  emitEventToServer("chat:unblockUser", { targetUuid })
}
export function emitGetBlockList() {
  emitEventToServer("chat:getBlockList")
}
export const onBlockSuccess = registerSocketEventListener<{ targetUuid: string; type: string }>("chat:block:success")
export const onUnblockSuccess = registerSocketEventListener<{ targetUuid: string; type: string }>("chat:unblock:success")
export const onBlockError = registerSocketEventListener<{ message: string }>("chat:block:error")
export const onUnblockError = registerSocketEventListener<{ message: string }>("chat:unblock:error")
export const onGetBlockListSuccess = registerSocketEventListener<{ list: { all: string[]; public: string[] } }>("chat:blockList:success")
export const onGetBlockListError = registerSocketEventListener<{ message: string }>("chat:blockList:error")