import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import * as guildBuildingService from "~/server/utils/game/guildBuilding";
import { ItemCountInfo } from "~/shared/types/gameInventory";
import { prisma } from "~/server/utils/game/db";
import { GuildRole } from "~/shared/types/guild";

// 获取所有公会建筑（已建造和未建造的都返回）
export async function handleGetBuiltGuildBuildings (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid } = data.data;
  try {
    const list = await guildBuildingService.getBuiltGuildBuildings(guildUuid);
    emitEventToUser(userUuid, "guildBuilding:list:success", { guildUuid, list });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildBuilding:list:fail", { message: e.message || "获取失败" });
  }
}

// 开始筹备建造建筑
export async function handlePrepareBuildGuildBuilding(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; buildingType: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, buildingType } = data.data;

  await withUniqueLock(`prepareBuildGuildBuilding:${guildUuid}:${buildingType}`, async () => {
    let userRole = await prisma.guildMember.findUnique({
      where: { guildUuid_userUuid: { guildUuid, userUuid } },
      select: { role: true }
    });

    if (!userRole || (userRole.role != GuildRole.LEADER && userRole.role != GuildRole.OFFICER)) {
      emitEventToUser(userUuid, "guildBuilding:prepare:fail", { message: "权限不足" });
      return;
    }

    try {
      const building = await guildBuildingService.prepareBuildGuildBuilding(userUuid, guildUuid, buildingType);
      emitEventToUser(userUuid, "guildBuilding:prepare:success", { guildUuid, buildingType, building });
    } catch (e: any) {
      emitEventToUser(userUuid, "guildBuilding:prepare:fail", { message: e.message || "筹备失败" });
    }
  })
}

export async function handlePrepareUpgradeGuildBuilding(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; buildingType: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, buildingType } = data.data;

  await withUniqueLock(`prepareUpgradeGuildBuilding:${guildUuid}:${buildingType}`, async () => {
    let userRole = await prisma.guildMember.findUnique({
      where: { guildUuid_userUuid: { guildUuid, userUuid } },
      select: { role: true }
    });

    if (!userRole || (userRole.role != GuildRole.LEADER && userRole.role != GuildRole.OFFICER)) {
      emitEventToUser(userUuid, "guildBuilding:upgrade:fail", { message: "权限不足" });
      return;
    }

    try {
      const building = await guildBuildingService.prepareUpgradeGuildBuilding(userUuid, guildUuid, buildingType);
      emitEventToUser(userUuid, "guildBuilding:upgrade:success", { guildUuid, buildingType, building });
    } catch (e: any) {
      emitEventToUser(userUuid, "guildBuilding:upgrade:fail", { message: e.message || "筹备失败" });
    }
  })
}

// 玩家捐赠建筑材料
export async function handleDonateGuildBuildingMaterial(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; buildingType: string; info: ItemCountInfo }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, buildingType, info } = data.data;

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
      emitEventToUser(userUuid, "guildBuilding:donate:fail", { message: "捐赠数量必须为整数" });
      return;
    }
    if (count < 0) {
      emitEventToUser(userUuid, "guildBuilding:donate:fail", { message: "捐赠数量必须大于0" });
      return;
    }

    // 检查溢出
    if (count > 1000000000) {
      emitEventToUser(userUuid, "guildBuilding:donate:fail", { message: "捐赠数量不能超过1000000000" });
      return;
    }
  }

  await withUniqueLock(`donateGuildBuildingMaterial:${guildUuid}:${buildingType}`, async () => {
    try {
      await guildBuildingService.donateGuildBuildingMaterial(guildUuid, buildingType, userUuid, info);
      emitEventToUser(userUuid, "guildBuilding:donate:success", { guildUuid, buildingType });

      const fundList = await guildBuildingService.getGuildBuildingMaterialFund(guildUuid, buildingType);
      emitEventToUser(userUuid, "guildBuilding:fund:success", { guildUuid, buildingType, fundList });

      const list = await guildBuildingService.getBuiltGuildBuildings(guildUuid);
      emitEventToUser(userUuid, "guildBuilding:list:success", { guildUuid, list });
    } catch (e: any) {
      emitEventToUser(userUuid, "guildBuilding:donate:fail", { message: e.message || "捐赠失败" });
    }
  })
}

// 获取某建筑的材料筹集情况
export async function handleGetGuildBuildingMaterialFund(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; buildingType: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, buildingType } = data.data;
  try {
    const fundList = await guildBuildingService.getGuildBuildingMaterialFund(guildUuid, buildingType);
    emitEventToUser(userUuid, "guildBuilding:fund:success", { guildUuid, buildingType, fundList });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildBuilding:fund:fail", { message: e.message || "获取失败" });
  }
}

// getDonateList
export async function handleGetDonationList(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; buildingType: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, buildingType } = data.data;

  try {
    const list = await guildBuildingService.getGuildBuildingDonationList(guildUuid, buildingType);
    emitEventToUser(userUuid, "guildBuilding:donationList:success", { guildUuid, list });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildBuilding:donationList:fail", { message: e.message || "获取失败" });
  }
}