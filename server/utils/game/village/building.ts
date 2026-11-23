import { prisma } from "~/server/utils/game/db";
import { allVillageBuilding } from "~/shared/data/allVillageBuilding";
import { ModifyItemCountType, type ItemCountInfo } from "~/shared/types/gameInventory";
import { allGameResource } from "~/shared/data/allGameResources";
import { BaseVillageBuildingInfo, GameVillageBuilding, VillageBuildingConfig, VillageBuildingMaterialFundStatus, VillageBuildingStatus } from "~/shared/types/village/building";
import { decreaseItemCount, getInventoryInfo } from "../characterInventory";
import { VillageBuilding } from "~/generated/prisma";
import { safeJsonParse } from "~/shared/utils";
import { redisClient } from "~/server/utils";
import { v4 } from "uuid";

export function toGameVillageBuilding(building: VillageBuilding): GameVillageBuilding {
  return {
    // id: building.id,
    uuid: building.uuid,
    type: building.type as keyof typeof allVillageBuilding,
    level: building.level,
    exp: building.exp,
    maxLevel: building.maxLevel,
    status: (building.status as VillageBuildingStatus) ?? VillageBuildingStatus.UNBUILD,

    startBuildAt: building.startBuildAt ?? null, // 开始建造时间
    endBuildAt: building.endBuildAt ?? null, // 预计结束建造时间
    startUpgradeAt: building.startUpgradeAt ?? null, // 开始升级时间
    endUpgradeAt: building.endUpgradeAt ?? null, // 预计结束升级时间

    createdAt: building.createdAt,
    updatedAt: building.updatedAt,
    extra: building.extra ?? null,
  };
}

const VILLAGE_NORMAL_BUILDINGS_CACHE_KEY = "VILLAGE_NORMAL_BUILDINGS_LIST";
const VILLAGE_NORMAL_BUILDINGS_CACHE_TTL = 30 * 60; // 2小时（秒）
export async function getNormalStateBaseVillageBuildings(): Promise<BaseVillageBuildingInfo[]> {
    try {
        // 尝试从缓存获取
        const cached = await redisClient.get(VILLAGE_NORMAL_BUILDINGS_CACHE_KEY);
        if (cached) {
            return safeJsonParse(cached, []);
        }
    } catch (error) {
    }

    const list = await prisma.villageBuilding.findMany({
        where: { 
            status: {
                in: [VillageBuildingStatus.NORMAL, VillageBuildingStatus.UPGRADING, VillageBuildingStatus.PREPARE_UPGRADE]
            }
        } 
    });
    let res = list.map(b => ({
        level: b.level,
        type: b.type as keyof typeof allVillageBuilding,
        extra: b.extra
    }));

    await redisClient.set(
        VILLAGE_NORMAL_BUILDINGS_CACHE_KEY,
        JSON.stringify(res), {
        expiration: {
            type: 'EX',
            value: VILLAGE_NORMAL_BUILDINGS_CACHE_TTL,
        }
    }
    );

    return res;
}

/**
 * 获取公会现有建筑
 */
export async function getBuiltVillageBuildings(): Promise<GameVillageBuilding[]> {
    const list = await prisma.villageBuilding.findMany({
        orderBy: { createdAt: "asc" }
    });
    return list.map(toGameVillageBuilding);
}

/**
 * 获取某建筑的材料筹集情况
 */
export async function getVillageBuildingMaterialFund(buildingType: string) {
    // 取当前建筑记录，按当前等级阶段（建造 level=0 / 升级 level=当前等级）查询
    const b = await prisma.villageBuilding.findUnique({ where: { type: buildingType } });
    const levelPhase = b?.level ? b.level : 0;
    let list = await prisma.villageBuildingMaterialFund.findMany({
        where: { buildingType, level: levelPhase }
    });

  let res = list.map(f => ({
    id: f.id,
    buildingType: f.buildingType,
    materialId: f.materialId,
    required: Number(f.required),
    collected: Number(f.collected),
        status: f.status as VillageBuildingMaterialFundStatus,
  }));

  return res
}

/**
 * 开始筹备建造建筑（初始化材料筹集表和建筑记录）
 */
export async function prepareBuildVillageBuilding(actionUserUuid: string, buildingType: string) {
    const config = allVillageBuilding[buildingType as keyof typeof allVillageBuilding] as VillageBuildingConfig;
    if (!config) throw new Error("未知建筑类型");

    return prisma.$transaction(async (tx) => {
        // 检查是否已存在该建筑
        const exist = await tx.villageBuilding.findUnique({
            where: { type: buildingType }
        });
        if (exist) throw new Error("该建筑已存在");

        // 初始化材料筹集表
        const buildCost = config.buildCost;
        for (const materialId in buildCost) {
            const count = buildCost[materialId]?.count ?? 0;
            await tx.villageBuildingMaterialFund.create({
                data: {
                    buildingType,
                    materialId,
                    required: count,
                    collected: 0,
                    level: 0,
                }
            });
        }

        // 插入一条建筑记录，状态为 PREPARE
        let res = await tx.villageBuilding.create({
            data: {
                uuid: v4(),
                type: buildingType,
                level: 0,
                exp: 0,
                maxLevel: config.maxLevel,
                status: VillageBuildingStatus.PREPARE
            }
        });

        await redisClient.del(VILLAGE_NORMAL_BUILDINGS_CACHE_KEY)

        return toGameVillageBuilding(res);
    })
}

/**
 * 开始筹备升级建筑（初始化对应等级的材料筹集，更新状态为 PREPARE_UPGRADE）
 */
export async function prepareUpgradeVillageBuilding(actionUserUuid: string, buildingType: string) {
    const config = allVillageBuilding[buildingType as keyof typeof allVillageBuilding] as VillageBuildingConfig;
    if (!config) throw new Error("未知建筑类型");

    return prisma.$transaction(async (tx) => {
        const exist = await tx.villageBuilding.findUnique({ where: { type: buildingType } });
        if (!exist) throw new Error("该建筑不存在，无法升级");
        if (exist.level >= config.maxLevel) throw new Error("建筑已达最高等级，无法升级");
        if (exist.level === 0 || exist.status !== VillageBuildingStatus.NORMAL) throw new Error("建筑状态不正确，无法升级");

        const upgradeCost = config.upgradeCost(exist.level);

        for (const materialId in upgradeCost) {
            const count = upgradeCost[materialId]?.count ?? 0;
            await tx.villageBuildingMaterialFund.create({
                data: {
                    buildingType,
                    materialId,
                    required: count,
                    collected: 0,
                    level: exist.level,
                }
            });
        }

        const res = await tx.villageBuilding.update({
            where: { type: buildingType },
            data: {
                status: VillageBuildingStatus.PREPARE_UPGRADE,
            }
        });

        await redisClient.del(VILLAGE_NORMAL_BUILDINGS_CACHE_KEY)

        return toGameVillageBuilding(res);
    })
}

/**
 * 玩家捐赠建筑材料
 */
export async function donateVillageBuildingMaterial(
  buildingType: string,
  donorUuid: string,
  info: ItemCountInfo
) {
    await prisma.$transaction(async (tx) => {
        const config = allVillageBuilding[buildingType as keyof typeof allVillageBuilding] as VillageBuildingConfig;
        if (!config) throw new Error("未知建筑类型");

        const buildingInfo = await tx.villageBuilding.findUnique({
            where: { 
                type: buildingType
            }
        })
        if (!buildingInfo) throw new Error("该建筑不存在");

        // 检查建筑状态
        if (buildingInfo.status !== VillageBuildingStatus.PREPARE && buildingInfo.status !== VillageBuildingStatus.PREPARE_UPGRADE) {
            throw new Error("建筑状态不正确，无法捐赠材料");
        }

        let donorInventory = await getInventoryInfo(donorUuid, tx);

        // 先计算实际可捐赠的数量（不超过所需剩余）
        const actualDonate: ItemCountInfo = {};
        for (const materialId in info) {
            const wantDonate = info[materialId]?.count ?? 0;
            if (wantDonate <= 0) continue;

            // 查找对应的筹集项
            const fund = await tx.villageBuildingMaterialFund.findFirst({
                where: {
                    buildingType,
                    materialId,
                    level: buildingInfo.status === VillageBuildingStatus.PREPARE ? 0 : buildingInfo.level
                }
            });
            if (!fund) throw new Error(`未找到材料筹集项: ${allGameResource[materialId].name}`);

            const remain = Math.max(Number(fund.required) - Number(fund.collected), 0);
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
            actionName: `捐赠小镇建筑材料 - ${config.name}`,
            showModifyInfo: true,
            type: ModifyItemCountType.Village
        }, tx);
        await invalidateInventoryCache(donorUuid);

        // 更新筹集表和记录捐赠明细
        for (const materialId in actualDonate) {
            const amount = actualDonate[materialId]?.count ?? 0;
            if (amount <= 0) continue;

            // 查找对应的筹集项
            const fund = await tx.villageBuildingMaterialFund.findFirst({
                where: { 
                    buildingType,
                    materialId,
                    level: buildingInfo.status === VillageBuildingStatus.PREPARE ? 0 : buildingInfo.level
                }
            });
            if (!fund) continue;

            // 更新筹集表
            await tx.villageBuildingMaterialFund.update({
                where: { id: fund.id },
                data: { 
                    status: (fund.collected + BigInt(amount)) >= fund.required ? VillageBuildingMaterialFundStatus.COMPLETED : VillageBuildingMaterialFundStatus.COLLECTING,
                    collected: { increment: amount }
                }
            });

            // 记录捐赠明细
            await tx.villageBuildingMaterialDonation.upsert({
                where: {
                    village_building_material_donation_level_unique: {
                        buildingType,
                        materialId,
                        donorUuid,
                        buildingLevel: buildingInfo.level,
                    }
                },
                update: {
                    amount: { increment: amount }
                },
                create: {
                    buildingType,
                    materialId,
                    donorUuid,
                    amount,
                    buildingLevel: buildingInfo.level
                }
            });
        }
    });

    // 检查所有材料是否已筹齐，若已齐则修改建筑状态为 PREPARE -> BUILDING
    return await startBuildVillageBuilding(buildingType);
}

/**
 * 检查材料是否全部筹齐
 */
export async function isVillageBuildingMaterialReady(buildingType: string): Promise<boolean> {
    const building = await prisma.villageBuilding.findUnique({ where: { type: buildingType } });
    const levelPhase = building?.status === VillageBuildingStatus.PREPARE ? 0 : (building?.level ?? 0);
    const funds = await prisma.villageBuildingMaterialFund.findMany({
        where: { buildingType, level: levelPhase }
    });
    return funds.length > 0 && funds.every(f => f.collected >= f.required);
}

/**
 * 开始建造建筑（材料齐全后，状态变更为 BUILDING）
 */
export async function startBuildVillageBuilding(buildingType: string) {
  // 检查材料是否齐全
  const ready = await isVillageBuildingMaterialReady(buildingType);
  if (!ready) return false

    const building = await prisma.villageBuilding.findUnique({ where: { type: buildingType } });
    if (!building) return false;
    const cfg = allVillageBuilding[buildingType as keyof typeof allVillageBuilding];

    if (building.status === VillageBuildingStatus.PREPARE) {
        // 更新建筑状态为 BUILDING（首次建造）
        let buildDuration = cfg.buildDuration || 0;
        await prisma.villageBuilding.update({
            where: { type: buildingType },
            data: { 
                    status: VillageBuildingStatus.BUILDING, 
                    startBuildAt: new Date(),
                    endBuildAt: new Date(Date.now() + buildDuration * 1000)
            }
        });
    } else if (building.status === VillageBuildingStatus.PREPARE_UPGRADE) {
        // 升级
        let upgradeDuration = cfg.upgradeDuration(building.level) || 0;
        await prisma.villageBuilding.update({
            where: { type: buildingType },
            data: { 
                    status: VillageBuildingStatus.UPGRADING, 
                    startUpgradeAt: new Date(),
                    endUpgradeAt: new Date(Date.now() + upgradeDuration * 1000)
            }
        });
    }

  await redisClient.del(VILLAGE_NORMAL_BUILDINGS_CACHE_KEY)

  return true
}

export async function getVillageBuildingDonationList(buildingType: string) {
    const list = await prisma.villageBuildingMaterialDonation.findMany({
        select: {
            donorUuid: true,
            amount: true,
            materialId: true,
            buildingLevel: true,
        },
        where: { buildingType },
        orderBy: { createdAt: "asc" }
    });

    let res = list.map(f => ({
        donorUuid: f.donorUuid,
        amount: Number(f.amount),
        materialId: f.materialId,
        buildingLevel: f.buildingLevel,
    }));

    return res;
}