import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import * as villageBuildingService from "~/server/utils/game/village/building";
import { withUniqueLock } from "~/server/utils/lock";
import { ItemCountInfo } from "~/shared/types/gameInventory";

export async function handleGetNormalStateBaseVillageBuildings (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{}>
) {
  const userUuid = data.user.uuid;
  try {
    const list = await villageBuildingService.getNormalStateBaseVillageBuildings();
    emitEventToUser(userUuid, "villageBuilding:normalStateBaseBuildings:success", { list });
  } catch (e: any) {
    emitEventToUser(userUuid, "villageBuilding:normalStateBaseBuildings:fail", { message: e.message || "获取失败" });
  }
}

// 开始筹备升级建筑
export async function handlePrepareUpgradeVillageBuilding(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ buildingType: string }>
) {
  const userUuid = data.user.uuid;
  const { buildingType } = data.data;

  try {
    await withUniqueLock(`prepareUpgradeVillageBuilding:${buildingType}`, async () => {
      const building = await villageBuildingService.prepareUpgradeVillageBuilding(userUuid, buildingType);
      emitEventToUser(userUuid, "villageBuilding:upgrade:success", { buildingType, building });
    });
  } catch (e: any) {
    emitEventToUser(userUuid, "villageBuilding:upgrade:fail", { message: e.message || "筹备升级失败" });
  }
}

// 获取所有小镇建筑（已建造和未建造的都返回）
export async function handleGetBuiltVillageBuildings (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{}>
) {
  const userUuid = data.user.uuid;
  try {
    const list = await villageBuildingService.getBuiltVillageBuildings();
    emitEventToUser(userUuid, "villageBuilding:list:success", { list });
  } catch (e: any) {
    emitEventToUser(userUuid, "villageBuilding:list:fail", { message: e.message || "获取失败" });
  }
}

// 开始筹备建造建筑
export async function handlePrepareBuildVillageBuilding(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ buildingType: string }>
) {
  const userUuid = data.user.uuid;
  const { buildingType } = data.data;

  // 这里可以添加权限检查，比如只有特定角色才能发起建筑筹备
  // 目前暂时允许所有用户发起

  try {
    const building = await villageBuildingService.prepareBuildVillageBuilding(userUuid, buildingType);
    emitEventToUser(userUuid, "villageBuilding:prepare:success", { buildingType, building });
  } catch (e: any) {
    emitEventToUser(userUuid, "villageBuilding:prepare:fail", { message: e.message || "筹备失败" });
  }
}

// 玩家捐赠建筑材料
export async function handleDonateVillageBuildingMaterial(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ buildingType: string; info: ItemCountInfo }>
) {
  const userUuid = data.user.uuid;
  const { buildingType, info } = data.data;

  // 验证捐赠信息
  if (!info || Object.values(info).every(countInfo => !countInfo?.count)) {
    return;
  }

  for(const resourceId in info) {
    if (!info[resourceId]?.count) {
      continue;
    }

    let count = info[resourceId].count;

    if (!Number.isInteger(count)) {
      emitEventToUser(userUuid, "villageBuilding:donate:fail", { message: "捐赠数量必须为整数" });
      return;
    }
    if (count < 0) {
      emitEventToUser(userUuid, "villageBuilding:donate:fail", { message: "捐赠数量必须大于0" });
      return;
    }

    // 检查溢出
    if (count > 1000000000) {
      emitEventToUser(userUuid, "villageBuilding:donate:fail", { message: "捐赠数量不能超过1000000000" });
      return;
    }
  }

  try {
    await villageBuildingService.donateVillageBuildingMaterial(buildingType, userUuid, info);
    emitEventToUser(userUuid, "villageBuilding:donate:success", { buildingType });

    const fundList = await villageBuildingService.getVillageBuildingMaterialFund(buildingType);
    emitEventToUser(userUuid, "villageBuilding:fund:success", { buildingType, fundList });

    const list = await villageBuildingService.getBuiltVillageBuildings();
    emitEventToUser(userUuid, "villageBuilding:list:success", { list });
  } catch (e: any) {
    emitEventToUser(userUuid, "villageBuilding:donate:fail", { message: e.message || "捐赠失败" });
  }
}

// 获取某建筑的材料筹集情况
export async function handleGetVillageBuildingMaterialFund(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ buildingType: string }>
) {
  const userUuid = data.user.uuid;
  const { buildingType } = data.data;
  try {
    let fundList = await villageBuildingService.getVillageBuildingMaterialFund(buildingType);
    emitEventToUser(userUuid, "villageBuilding:fund:success", { buildingType, fundList });
  } catch (e: any) {
    emitEventToUser(userUuid, "villageBuilding:fund:fail", { message: e.message || "获取失败" });
  }
}

// 获取捐赠列表
export async function handleGetVillageBuildingDonationList(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ buildingType: string }>
) {
  const userUuid = data.user.uuid;
  const { buildingType } = data.data;

  try {
    const list = await villageBuildingService.getVillageBuildingDonationList(buildingType);
    emitEventToUser(userUuid, "villageBuilding:donationList:success", { list });
  } catch (e: any) {
    emitEventToUser(userUuid, "villageBuilding:donationList:fail", { message: e.message || "获取失败" });
  }
}