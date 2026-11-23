import type { BaseVillageBuildingInfo, GameVillageBuilding } from "~/shared/types/village/building";
import { emitEventToServer, registerSocketEventListener } from "../socket";
import type { ItemCountInfo } from "~/shared/types/gameInventory";

export function emitGetNormalStateBaseVillageBuildings() {
  emitEventToServer("villageBuilding:normalStateBaseBuildings", {});
}
export const onGetNormalStateBaseVillageBuildingsSuccess = registerSocketEventListener<{ list: BaseVillageBuildingInfo[] }>("villageBuilding:normalStateBaseBuildings:success");
export const onGetNormalStateBaseVillageBuildingsFail = registerSocketEventListener<{ message: string }>("villageBuilding:normalStateBaseBuildings:fail");

// 获取所有已建造的小镇建筑
export function emitGetBuiltVillageBuildings() {
  emitEventToServer("villageBuilding:list", {});
}
export const onGetBuiltVillageBuildingsSuccess = registerSocketEventListener<{ list: GameVillageBuilding[] }>("villageBuilding:list:success");
export const onGetBuiltVillageBuildingsFail = registerSocketEventListener<{ message: string }>("villageBuilding:list:fail");

// 开始筹备建造建筑
export function emitPrepareBuildVillageBuilding(buildingType: string) {
  emitEventToServer("villageBuilding:prepare", { buildingType });
}
export const onPrepareBuildVillageBuildingSuccess = registerSocketEventListener<{ buildingType: string; building: GameVillageBuilding }>("villageBuilding:prepare:success");
export const onPrepareBuildVillageBuildingFail = registerSocketEventListener<{ message: string }>("villageBuilding:prepare:fail");

// 玩家捐赠建筑材料
export function emitDonateVillageBuildingMaterial(buildingType: string, info: ItemCountInfo) {
  emitEventToServer("villageBuilding:donate", { buildingType, info });
}
export const onDonateVillageBuildingMaterialSuccess = registerSocketEventListener<{ buildingType: string }>("villageBuilding:donate:success");
export const onDonateVillageBuildingMaterialFail = registerSocketEventListener<{ message: string }>("villageBuilding:donate:fail");

// 获取某建筑的材料筹集情况
export function emitGetVillageBuildingMaterialFund(buildingType: string) {
  emitEventToServer("villageBuilding:fund", { buildingType });
}
export const onGetVillageBuildingMaterialFundSuccess = registerSocketEventListener<{ buildingType: string; fundList: any[] }>("villageBuilding:fund:success");
export const onGetVillageBuildingMaterialFundFail = registerSocketEventListener<{ message: string }>("villageBuilding:fund:fail");

// 获取捐赠列表
export function emitGetVillageBuildingDonationList(buildingType: string) {
  emitEventToServer("villageBuilding:donationList", { buildingType });
}
export const onGetVillageBuildingDonationListSuccess = registerSocketEventListener<{ list: 
{
    materialId: string;
    donorUuid: string;
    amount: number;
    buildingLevel: number;
}[]
}>("villageBuilding:donationList:success");
export const onGetVillageBuildingDonationListFail = registerSocketEventListener<{ message: string }>("villageBuilding:donationList:fail");

// 开始筹备升级建筑
export function emitPrepareUpgradeVillageBuilding(buildingType: string) {
  emitEventToServer("villageBuilding:upgrade", { buildingType });
}
export const onPrepareUpgradeVillageBuildingSuccess = registerSocketEventListener<{ buildingType: string; building: GameVillageBuilding }>("villageBuilding:upgrade:success");
export const onPrepareUpgradeVillageBuildingFail = registerSocketEventListener<{ message: string }>("villageBuilding:upgrade:fail");