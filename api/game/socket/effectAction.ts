import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";
import type { GameSocketData } from "~/shared/types/socket";
import type { UseItemInfo, UseItemResult } from "~/shared/types/gameEffect";
import type { AllGameResourceID } from "~/shared/types/gameResource";

// 使用物品
export function emitUseItem(info: UseItemInfo) {
    emitEventToServer("effectAction:useItem", info);
}

// 监听使用物品成功
export const onUseItemSuccess = registerSocketEventListener<{ itemId: AllGameResourceID; multiple: number; result: UseItemResult }>("effectAction:useItem:success");

// 监听使用物品失败
export const onUseItemError = registerSocketEventListener<{ message: string }>("effectAction:useItem:error");

// 清理监听器（如需手动解绑可调用返回的 off 函数）
export function clearEffectActionListeners() {
    // 若需要解绑，调用 onUseItemSuccess/off 和 onUseItemError/off 返回的函数
    // 例如 const off = onUseItemSuccess(cb); off();
}