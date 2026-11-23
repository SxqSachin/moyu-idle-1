import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { UserKittyFurnitureInstance } from "~/shared/types/kittyFurniture";
import type { AllKittyFurnitureID } from "~/shared/data/allKittyFurniture";
import type { ItemCountInfo } from "~/shared/types/gameInventory";
import type { AllGameResourceID } from "~/shared/types/gameResource";

// 获取用户所有家具
export function emitGetUserFurniture() {
  emitEventToServer("kitty:furniture:getAll");
}
export const onGetUserFurniture = registerSocketEventListener<{ furniture: UserKittyFurnitureInstance[] }>("kitty:furniture:list");
export const onGetUserFurnitureFail = registerSocketEventListener<{ message: string }>("kitty:furniture:list:fail");

// 安装家具
export function emitInstallFurniture(furnitureId: AllKittyFurnitureID) {
  emitEventToServer("kitty:furniture:install", { furnitureId });
}
export const onInstallFurnitureSuccess = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; furnitureUuid: string }>("kitty:furniture:install:success");
export const onInstallFurnitureFail = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; message: string }>("kitty:furniture:install:fail");

// 修理家具
export function emitRepairFurniture(furnitureId: AllKittyFurnitureID) {
  emitEventToServer("kitty:furniture:repair", { furnitureId });
}
export const onRepairFurnitureSuccess = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; repairCost: ItemCountInfo }>("kitty:furniture:repair:success");
export const onRepairFurnitureFail = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; message: string }>("kitty:furniture:repair:fail");

// 启用/停用家具
export function emitToggleFurniture(furnitureId: AllKittyFurnitureID, active: boolean) {
  emitEventToServer("kitty:furniture:toggle", { furnitureId, active });
}
export const onToggleFurnitureSuccess = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; active: boolean }>("kitty:furniture:toggle:success");
export const onToggleFurnitureFail = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; active: boolean; message: string }>("kitty:furniture:toggle:fail");

// 检查是否可以安装家具
export function emitCheckCanInstallFurniture(furnitureId: AllKittyFurnitureID) {
  emitEventToServer("kitty:furniture:checkCanInstall", { furnitureId });
}
export const onCheckCanInstallFurniture = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; canInstall: boolean; message?: string }>("kitty:furniture:canInstall");

// 检查是否可以修理家具
export function emitCheckCanRepairFurniture(furnitureId: AllKittyFurnitureID) {
  emitEventToServer("kitty:furniture:checkCanRepair", { furnitureId });
}
export const onCheckCanRepairFurniture = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; canRepair: boolean; message?: string }>("kitty:furniture:canRepair");

// 获取指定类型的家具
export function emitGetFurnitureByType(furnitureId: AllKittyFurnitureID) {
  emitEventToServer("kitty:furniture:getByType", { furnitureId });
}
export const onGetFurnitureByType = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; furniture: UserKittyFurnitureInstance | null }>("kitty:furniture:byType");
export const onGetFurnitureByTypeFail = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; message: string }>("kitty:furniture:byType:fail");

// 获取激活的指定类型家具（管理员功能）
export function emitGetActiveFurnitureByType(furnitureId: AllKittyFurnitureID) {
  emitEventToServer("kitty:furniture:getActiveByType", { furnitureId });
}
export const onGetActiveFurnitureByType = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; activeFurniture: UserKittyFurnitureInstance[] }>("kitty:furniture:active:byType");
export const onGetActiveFurnitureByTypeFail = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; message: string }>("kitty:furniture:active:byType:fail");

// 监听家具状态变化事件
export const onFurnitureInstalled = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; furnitureUuid: string; name: string }>("furniture-installed");
export const onFurnitureRepaired = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; furnitureUuid: string; name: string }>("furniture-repaired");
export const onFurnitureToggled = registerSocketEventListener<{ furnitureId: AllKittyFurnitureID; furnitureUuid: string; name: string; active: boolean }>("furniture-toggled");


export function emitConfigureFurniture_AutoFeeder(foodId: AllGameResourceID, count: number) {
  emitEventToServer("kitty:furniture:configureFurniture_AutoFeeder", { foodId, count });
}
