import { PrismaClient } from "~/generated/prisma";
import { emitEventToUser } from "~/server/io";
import { AllGameBuildingID, CharacterBuildingInfo } from "~/shared/types/building";
import { BuildingRewardInfo } from "~/shared/types/gameInventory";
import { prisma } from "./db";
const REDIS_KEY_PREFIX = "characterBuilding:";

export async function getBuildingInfo(characterUuid: string): Promise<CharacterBuildingInfo> {
    const redisKey = `${REDIS_KEY_PREFIX}${characterUuid}`;
    // 优先从 Redis 读取
    const cache = await redisClient.get(redisKey);
    if (cache) {
        try {
            return JSON.parse(cache);
        } catch (e) {
            console.error("[building] Redis cache parse error:", e);
        }
    }

    const buildingInfo = await prisma.characterBuilding.findFirst({
        where: {
            character_uuid: characterUuid
        }
    })

    if (!buildingInfo) {
        return {}
    }

    const result = JSON.parse(buildingInfo.building) as CharacterBuildingInfo;
    // 查库后写入一份到 Redis
    await redisClient.set(redisKey, JSON.stringify(result), {
       expiration: {
        type: 'EX',
        value: 3600 // 缓存1小时
       } 
    });

    return result;
}

export async function applyBuildingReward(characterUuid: string, buildingRewards: BuildingRewardInfo): Promise<CharacterBuildingInfo> {
    const redisKey = `${REDIS_KEY_PREFIX}${characterUuid}`;
    const characterBuildingInfo = await prisma.characterBuilding.findFirst({
        where: {
            character_uuid: characterUuid
        }
    })

    let rewardBuildingIdList = Object.keys(buildingRewards) as AllGameBuildingID[]

    if (!characterBuildingInfo) {
        let newBuildingInfo: CharacterBuildingInfo = {}
        for(const buildingId of rewardBuildingIdList) {
            if (buildingRewards[buildingId]?.levelIncrease) {
                newBuildingInfo[buildingId] = {
                    level: buildingRewards[buildingId]?.levelIncrease,
                    status: 'BUILT',
                }
            }
        }

        await prisma.characterBuilding.create({
            data: {
                user_uuid: characterUuid,
                character_uuid: characterUuid,
                building: JSON.stringify(newBuildingInfo)
            }
        })

        // 写入 Redis 缓存
        await redisClient.set(redisKey, JSON.stringify(newBuildingInfo), {
          expiration: {
            type: "EX",
            value: 3600, // 缓存1小时
          },
        });

        return newBuildingInfo
    }

    const buildingInfo = JSON.parse(characterBuildingInfo.building) as CharacterBuildingInfo

    for (const buildingId of rewardBuildingIdList) {
        if (buildingRewards[buildingId]?.levelIncrease) {
            buildingInfo[buildingId] = {
                level: 0,
                status: 'BUILT',
            }
            buildingInfo[buildingId].level += buildingRewards[buildingId]?.levelIncrease
        }
    }

    await prisma.characterBuilding.update({
        where: {
            character_uuid: characterUuid,
        },
        data: {
            building: JSON.stringify(buildingInfo)
        }
    })

    // 写入 Redis 缓存
    await redisClient.set(redisKey, JSON.stringify(buildingInfo), {
        expiration: {
          type: "EX",
          value: 3600, // 缓存1小时
        },
    });

    return buildingInfo
}

export const dispatchCharacterBuildingInfoToClient = async (userUuid: string) => {
    const info = await getBuildingInfo(userUuid)

    emitEventToUser(userUuid, "dispatchCharacterBuildingInfo", info)
}