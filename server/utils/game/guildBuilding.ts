
import { prisma } from "~/server/utils/game/db";
import { GuildBuildingConfig, GameGuildBuilding, GuildBuildingStatus } from "~/shared/types/guild";
import { allGuildBuilding } from "~/shared/data/allGuildBuilding";
import { ModifyItemCountType, type ItemCountInfo } from "~/shared/types/gameInventory";
import { GuildBuilding, GuildBuildingMaterialFund } from "~/generated/prisma";
import { decreaseItemCount, getInventoryInfo } from "./characterInventory";
import { allGameResource } from "~/shared/data/allGameResources";
import { PrismaTx } from "~/shared/types/socket/db";

export function toGameGuildBuilding(building: GuildBuilding): GameGuildBuilding {
  return {
    // id: building.id,
    uuid: building.uuid,
    guildUuid: building.guildUuid,
    type: building.type as keyof typeof allGuildBuilding,
    level: building.level,
    exp: building.exp,
    maxLevel: building.maxLevel,
    status: (building.status as GuildBuildingStatus) ?? GuildBuildingStatus.UNBUILD,

    startBuildAt: building.startBuildAt ?? null, // 开始建造时间
    endBuildAt: building.endBuildAt ?? null, // 预计结束建造时间
    startUpgradeAt: building.startUpgradeAt ?? null, // 开始升级时间
    endUpgradeAt: building.endUpgradeAt ?? null, // 预计结束升级时间

    createdAt: building.createdAt,
    updatedAt: building.updatedAt,
    extra: building.extra ?? null,
  };
}

/**
 * 获取公会现有建筑
 */
export async function getBuiltGuildBuildings(guildUuid: string): Promise<GameGuildBuilding[]> {
  const list = await prisma.guildBuilding.findMany({
    where: { guildUuid },
    orderBy: { createdAt: "asc" }
  });
  return list.map(toGameGuildBuilding);
}

/**
 * 获取某建筑的材料筹集情况
 */
export async function getGuildBuildingMaterialFund(
  guildUuid: string,
  buildingType: string
) {
  return prisma.$transaction(async (tx) => {
    let building = await tx.guildBuilding.findFirst({
      where: { guildUuid, type: buildingType },
    });
    if (!building) throw new Error("该建筑不存在");

    const list = await tx.guildBuildingMaterialFund.findMany({
      where: { guildUuid, buildingType, level: building.level },
    });
    return list;
  });
}

/**
 * 开始筹备建造建筑（初始化材料筹集表和建筑记录）
 */
export async function prepareBuildGuildBuilding(actionUserUuid: string, guildUuid: string, buildingType: string) {
    const config = allGuildBuilding[buildingType as keyof typeof allGuildBuilding] as GuildBuildingConfig;
    if (!config) throw new Error("未知建筑类型");

    return prisma.$transaction(async (tx) => {
        // 检查是否已存在该建筑
        const exist = await tx.guildBuilding.findFirst({
            where: { guildUuid, type: buildingType }
        });
        if (exist) throw new Error("该建筑已存在");

        // 初始化材料筹集表
        const buildCost = config.buildCost;
        for (const materialId in buildCost) {
            const count = buildCost[materialId]?.count ?? 0;
            await tx.guildBuildingMaterialFund.create({
                data: {
                    guildUuid,
                    buildingType,
                    materialId,
                    required: count,
                    collected: 0,
                    level: 0,
                }
            });
        }

        // 插入一条建筑记录，状态为 PREPARE
        let res = await tx.guildBuilding.create({
            data: {
                uuid: crypto.randomUUID(),
                guildUuid,
                type: buildingType,
                level: 0,
                exp: 0,
                maxLevel: config.maxLevel,
                status: GuildBuildingStatus.PREPARE
            }
        });

        return toGameGuildBuilding(res);
    })
}

export async function prepareUpgradeGuildBuilding(actionUserUuid: string, guildUuid: string, buildingType: string) {
    const config = allGuildBuilding[buildingType as keyof typeof allGuildBuilding] as GuildBuildingConfig;
    if (!config) throw new Error("未知建筑类型");

    return prisma.$transaction(async (tx) => {
        // 检查是否已存在该建筑
        const exist = await tx.guildBuilding.findFirst({
            where: { guildUuid, type: buildingType }
        });
        if (!exist) {
            throw new Error("该建筑不存在，无法升级");
        }

        if (exist.level >= config.maxLevel) {
            throw new Error("建筑已达最高等级，无法升级");
        }

        if (exist.level == 0 || exist.status !== GuildBuildingStatus.NORMAL) {
            throw new Error("建筑状态不正确，无法升级");
        }

        const upgradeCost = config.upgradeCost(exist.level);

        // 初始化材料筹集表
        for (const materialId in upgradeCost) {
            const count = upgradeCost[materialId]?.count ?? 0;
            await tx.guildBuildingMaterialFund.create({
                data: {
                    guildUuid,
                    buildingType,
                    materialId,
                    required: count,
                    collected: 0,
                    level: exist.level
                }
            });
        }

        // 更新建筑记录，状态为 PREPARE_UPGRADE
        let res = await tx.guildBuilding.update({
            where: { id: exist.id },
            data: {
                type: buildingType,
                status: GuildBuildingStatus.PREPARE_UPGRADE,
            }
        });

        return toGameGuildBuilding(res);
    })
}

/**
 * 玩家捐赠建筑材料
 */
export async function donateGuildBuildingMaterial(
  guildUuid: string,
  buildingType: string,
  donorUuid: string,
  info: ItemCountInfo
) {
    return await prisma.$transaction(async (tx) => {
        const config = allGuildBuilding[buildingType as keyof typeof allGuildBuilding] as GuildBuildingConfig;
        if (!config) throw new Error("未知建筑类型");

        const buildingInfo = await tx.guildBuilding.findUnique({
            where: { 
                guild_building_unique: {
                    guildUuid,
                    type: buildingType
                }
            }
        })
        if (!buildingInfo) throw new Error("该建筑不存在");

        // 检查建筑状态
        if (buildingInfo.status !== GuildBuildingStatus.PREPARE && buildingInfo.status !== GuildBuildingStatus.PREPARE_UPGRADE) {
            throw new Error("建筑状态不正确，无法捐赠材料");
        }

        let donorInventory = await getInventoryInfo(donorUuid, tx);

        // 先计算实际可捐赠的数量（不超过所需剩余）
        const actualDonate: ItemCountInfo = {};
        for (const materialId in info) {
            const wantDonate = info[materialId]?.count ?? 0;
            if (wantDonate <= 0) continue;

            // 查找对应的筹集项
            const fund = await tx.guildBuildingMaterialFund.findFirst({
                where: { guildUuid, buildingType, materialId, level: buildingInfo.level }
            });
            if (!fund) throw new Error(`未找到材料筹集项: ${allGameResource[materialId].name}`);

            const remain = Math.max(fund.required - fund.collected, 0);
            if (remain <= 0) continue; // 已满

            // 实际可捐赠数量
            const donateAmount = Math.min(wantDonate, remain);

            // 检查库存
            const inventoryItem = donorInventory[materialId];
            if (!inventoryItem || inventoryItem.count < donateAmount) {
                throw new Error(`库存不足，无法捐赠: ${allGameResource[materialId].name}，需要 ${donateAmount}，但只有 ${inventoryItem?.count ?? 0}`);
            }

            actualDonate[materialId] = { count: donateAmount };
        }

        // 实际没有可捐赠的材料
        if (Object.keys(actualDonate).length === 0) {
            return
        }

        // 扣除物品
        await decreaseItemCount(donorUuid, actualDonate, {
            actionName: `捐赠建筑材料 - ${config.name}`,
            showModifyInfo: true,
            type: ModifyItemCountType.Guild,
            sendModifyEvent: true,
        }, tx);
        await invalidateInventoryCache(donorUuid);

        // 更新筹集表和记录捐赠明细
        for (const materialId in actualDonate) {
            const amount = actualDonate[materialId]?.count ?? 0;
            if (amount <= 0) continue;

            // 查找对应的筹集项
            const fund = await tx.guildBuildingMaterialFund.findFirst({
                where: { guildUuid, buildingType, materialId, level: buildingInfo.level }
            });
            if (!fund) continue;

            // 更新筹集表
            await tx.guildBuildingMaterialFund.update({
                where: { id: fund.id },
                data: { 
                    status: (fund.collected + amount) >= fund.required ? "COMPLETED" : "COLLECTING",
                    collected: { increment: amount }
                }
            });

            // 记录捐赠明细
            await tx.guildBuildingMaterialDonation.upsert({
                where: {
                    // 你需要在prisma schema中为 (guildUuid, buildingType, materialId, donorUuid) 建唯一索引
                    guild_building_material_donation_level_unique: {
                        guildUuid,
                        buildingType,
                        materialId,
                        buildingLevel: buildingInfo.level,
                        donorUuid,
                    }
                },
                update: {
                    amount: { increment: amount }
                },
                create: {
                    guildUuid,
                    buildingType,
                    materialId,
                    donorUuid,
                    amount,
                    buildingLevel: buildingInfo.level
                }
            });
        }
        // 检查所有材料是否已筹齐，若已齐则修改建筑状态为 PREPARE -> BUILDING
        return await startBuildGuildBuilding(guildUuid, buildingType, buildingInfo.level, tx);
    });
}

/**
 * 检查材料是否全部筹齐
 */
export async function isGuildBuildingMaterialReady(
  guildUuid: string,
  buildingType: string,
  buildingLevel: number,
  tx: PrismaTx
): Promise<boolean> {
  if (!tx) {
    tx = prisma;
  }

  const funds = await tx.guildBuildingMaterialFund.findMany({
    where: { guildUuid, buildingType, level: buildingLevel },
  });
  return funds.every((f) => f.collected >= f.required);
}

/**
 * 开始建造建筑（材料齐全后，状态变更为 BUILDING）
 */
export async function startBuildGuildBuilding(
  guildUuid: string,
  buildingType: string,
  buildingLevel: number,
  tx: PrismaTx
) {
  // 检查材料是否齐全
  const ready = await isGuildBuildingMaterialReady(
    guildUuid,
    buildingType,
    buildingLevel,
    tx
  );
  if (!tx) {
    tx = prisma;
  }

  if (!ready) return false;

  const isBuilding = buildingLevel == 0;

  if (isBuilding) {
    let buildDuration = allGuildBuilding[buildingType as keyof typeof allGuildBuilding] .buildDuration || 0;
    await tx.guildBuilding.updateMany({
        where: { guildUuid, type: buildingType },
        data: {
        status: GuildBuildingStatus.BUILDING,
        startBuildAt: new Date(),
        endBuildAt: new Date(Date.now() + buildDuration * 1000), // 计算结束时间
        },
    });
  } else {
    let buildDuration = allGuildBuilding[ buildingType as keyof typeof allGuildBuilding ].upgradeDuration(buildingLevel) || 0;
    await tx.guildBuilding.updateMany({
        where: { guildUuid, type: buildingType },
        data: {
        status: GuildBuildingStatus.UPGRADING,
        startUpgradeAt: new Date(),
        endUpgradeAt: new Date(Date.now() + buildDuration * 1000), // 计算结束时间
        },
    });
  }

  return true;
}

export async function getGuildBuildingDonationList(guildUuid: string, buildingType: string) {
    const list = await prisma.guildBuildingMaterialDonation.findMany({
        select: {
            donorUuid: true,
            amount: true,
            materialId: true,
            buildingLevel: true,
        },
        where: { guildUuid, buildingType },
        orderBy: { createdAt: "desc" }
    });
    return list;
}