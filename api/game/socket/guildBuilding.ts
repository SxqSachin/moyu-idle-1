import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { GameGuildBuilding } from "~/shared/types/guild";
import type { ItemCountInfo } from "~/shared/types/gameInventory";

// 获取所有已建造的公会建筑
export function emitGetBuiltGuildBuildings(guildUuid: string) {
  emitEventToServer("guildBuilding:list", { guildUuid });
}
export const onGetBuiltGuildBuildingsSuccess = registerSocketEventListener<{ guildUuid: string; list: GameGuildBuilding[] }>("guildBuilding:list:success");
export const onGetBuiltGuildBuildingsFail = registerSocketEventListener<{ message: string }>("guildBuilding:list:fail");

// 开始筹备建造建筑
export function emitPrepareBuildGuildBuilding(guildUuid: string, buildingType: string) {
  emitEventToServer("guildBuilding:prepare", { guildUuid, buildingType });
}
export const onPrepareBuildGuildBuildingSuccess = registerSocketEventListener<{ guildUuid: string; buildingType: string; building: GameGuildBuilding }>("guildBuilding:prepare:success");
export const onPrepareBuildGuildBuildingFail = registerSocketEventListener<{ message: string }>("guildBuilding:prepare:fail");

export function emitPrepareUpgradeGuildBuilding(guildUuid: string, buildingType: string) {
  emitEventToServer("guildBuilding:upgrade", { guildUuid, buildingType });
}
export const onPrepareUpgradeGuildBuildingSuccess = registerSocketEventListener<{ guildUuid: string; buildingType: string; building: GameGuildBuilding }>("guildBuilding:upgrade:success");
export const onPrepareUpgradeGuildBuildingFail = registerSocketEventListener<{ message: string }>("guildBuilding:upgrade:fail");

// 玩家捐赠建筑材料
export function emitDonateGuildBuildingMaterial(guildUuid: string, buildingType: string, info: ItemCountInfo) {
  emitEventToServer("guildBuilding:donate", { guildUuid, buildingType, info });
}
export const onDonateGuildBuildingMaterialSuccess = registerSocketEventListener<{ guildUuid: string; buildingType: string }>("guildBuilding:donate:success");
export const onDonateGuildBuildingMaterialFail = registerSocketEventListener<{ message: string }>("guildBuilding:donate:fail");

// 获取某建筑的材料筹集情况
export function emitGetGuildBuildingMaterialFund(guildUuid: string, buildingType: string) {
  emitEventToServer("guildBuilding:fund", { guildUuid, buildingType });
}
export const onGetGuildBuildingMaterialFundSuccess = registerSocketEventListener<{ guildUuid: string; buildingType: string; fundList: any[] }>("guildBuilding:fund:success");
export const onGetGuildBuildingMaterialFundFail = registerSocketEventListener<{ message: string }>("guildBuilding:fund:fail");

export function emitGetGuildBuildingDonationList(guildUuid: string, buildingType: string) {
  emitEventToServer("guildBuilding:donationList", { guildUuid, buildingType });
}
export const onGetGuildBuildingDonationListSuccess = registerSocketEventListener<{ guildUuid: string; list: 
{
    materialId: string;
    donorUuid: string;
    amount: number;
    buildingLevel: number;
}[]
}>("guildBuilding:donationList:success");
export const onGetGuildBuildingDonationListFail = registerSocketEventListener<{ message: string }>("guildBuilding:donationList:fail");