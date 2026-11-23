import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";
import type { GameSocketData } from "~/shared/types/socket";
import type { PlayerProfileInfo } from "~/shared/types/characterInfo";

// 获取用户基础信息
export function emitGetProfile(uuid?: string) {
  emitEventToServer("character:getProfile", uuid);
}

// 监听获取用户基础信息成功
export const onGetProfileSuccess = registerSocketEventListener<PlayerProfileInfo | null>("character:getProfile:success");

// 监听获取用户基础信息失败
export const onGetProfileError = registerSocketEventListener<{ message: string }>("character:getProfile:error");

// 修改用户基础信息（昵称、头像）
export function emitUpdateProfile(profile: Partial<PlayerProfileInfo>) {
  emitEventToServer("character:updateProfile", {...profile });
}

// 监听修改用户基础信息成功
export const onUpdateProfileSuccess = registerSocketEventListener<{ message: string }>("character:updateProfile:success");

// 监听修改用户基础信息失败
export const onUpdateProfileError = registerSocketEventListener<{ message: string }>("character:updateProfile:error");

// 清理监听器（如需解绑，调用返回的 off 函数）
export function clearProfileListeners() {
  // 解绑请直接调用 onGetProfileSuccess/off 等返回的函数
}