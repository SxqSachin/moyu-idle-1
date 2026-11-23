import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket"
import type { GameSocketData } from "~/shared/types/socket";
import type { CharacterInventory, ItemCountInfo, ItemCountModifyInfo, ModifyItemCountType } from "~/shared/types/gameInventory";

// 请求背包信息
export function emitRequestInventory() {
    emitEventToServer("requestInventoryInfo")
}

// 监听背包信息下发
export const onDispatchInventoryInfo = registerSocketEventListener<CharacterInventory>("dispatchInventoryInfo")

// 监听背包更新
export const onInventoryUpdated = registerSocketEventListener<CharacterInventory>("inventoryUpdated")

// 监听资源增加
export const onInventoryResourceIncrease = registerSocketEventListener<ItemCountInfo>("inventory:increase:success");

// 监听资源减少
export const onInventoryResourceDecrease = registerSocketEventListener<ItemCountInfo>("inventory:decrease:success");

export const onInventoryModify = registerSocketEventListener<ItemCountInfo>("inventoryModify");

// 请求背包变更记录
export function emitGetInventoryModifyinfo() {
    emitEventToServer("inventory:getModifyInfo")
}
// 监听背包变更记录下发
export const onGetInventoryModifyInfoSuccess = registerSocketEventListener<ItemCountModifyInfo[]>("inventory:getModifyInfo:success");

// 请求背包变更记录
export function emitGetInventoryModifyinfoByType(type: ModifyItemCountType) {
    emitEventToServer("inventory:getModifyInfoByType", {type})
}
export const onGetInventoryModifyInfoByTypeSuccess = registerSocketEventListener<ItemCountModifyInfo[]>("inventory:getModifyInfoByType:success");