// api/game/socket/curio.ts
import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";
import type { CurioItem, CurioItemWithOwner, CurioIdentifyResult } from "~/shared/types/curio";

// 鉴定古董
export function emitCurioIdentify(count: number) {
  emitEventToServer("curio:identify", { count });
}

// 监听鉴定成功
export const onCurioIdentifySuccess = registerSocketEventListener<{ results: CurioIdentifyResult[] }>("curio:identify:success");

// 监听鉴定失败
export const onCurioIdentifyError = registerSocketEventListener<{ message: string }>("curio:identify:error");

// 查询古董列表
export function emitCurioQuery(data: { page?: number; limit?: number } = {}) {
  emitEventToServer("curio:query", data);
}

// 监听查询成功
export const onCurioQuerySuccess = registerSocketEventListener<{ curios: CurioItem[]; total: number }>("curio:query:success");

// 监听查询失败
export const onCurioQueryError = registerSocketEventListener<{ message: string }>("curio:query:error");

// 获取所有标签
export function emitCurioGetTags() {
  emitEventToServer("curio:getTags", {});
}

// 监听获取标签成功
export const onCurioGetTagsSuccess = registerSocketEventListener<{ tags: string[] }>("curio:getTags:success");

// 监听获取标签失败
export const onCurioGetTagsError = registerSocketEventListener<{ message: string }>("curio:getTags:error");

// 按标签查询
export function emitCurioQueryByTag(data: { tag: string; page?: number; limit?: number }) {
  emitEventToServer("curio:queryByTag", data);
}

// 监听按标签查询成功
export const onCurioQueryByTagSuccess = registerSocketEventListener<{ curios: CurioItem[]; total: number }>("curio:queryByTag:success");

// 监听按标签查询失败
export const onCurioQueryByTagError = registerSocketEventListener<{ message: string }>("curio:queryByTag:error");

// 查询博物馆
export function emitCurioMuseum(data: { page?: number; limit?: number } = {}) {
  emitEventToServer("curio:museum", data);
}

// 监听博物馆查询成功
export const onCurioMuseumSuccess = registerSocketEventListener<{ curios: CurioItemWithOwner[]; total: number }>("curio:museum:success");

// 监听博物馆查询失败
export const onCurioMuseumError = registerSocketEventListener<{ message: string }>("curio:museum:error");