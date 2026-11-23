import { randomUUID } from "crypto";
import { INVITE_REWARD_DEFAULT_ITEM_LIMIT, INVITE_REWARD_EDIT_COOLDOWN_MS, INVITE_REWARD_ITEM_LIMITS, INVITE_REWARD_MAX_BATTLE_EQUIPITEM_KINDS, INVITE_REWARD_MAX_EQUIPITEM_LIMIT, INVITE_REWARD_MAX_ITEM_KINDS, INVITE_REWARD_MAX_WORK_EQUIPITEM_KINDS, REFERRER_REWARD } from "~/shared/data/constant";
import { prisma } from "./db";
import { InviteRewardSetting, ReferrerInfo } from "~/shared/types/referrer";
import { clone } from "~/shared/utils";
import { dispatchInventoryInfoToClient, increaseItemCount, decreaseItemCount } from "./characterInventory";
import { addSponsorPoints } from "./sponsorPoint";
import { getCharacterStatusInfo } from "./characterStatus";
import { allWorkStatus } from "~/shared/data/allCharacterStatus";
import { HarvestBoxSource, UserReferral, type UserInviteRewardSetting as UserInviteRewardSettingModel } from "~/generated/prisma";
import { ItemCountInfo, ModifyItemCountOption, ModifyItemCountType } from "~/shared/types/gameInventory";
import { allGameResource } from "~/shared/data/allGameResources";
import { AllGameResourceID } from "~/shared/types/gameResource";
import { checkResourceRequirementInDB } from "./characterInventory";
import type { ResourceRequirement } from "~/shared/types/gameAction";
import { convertItemCountInfoToResourceRequirement } from "~/shared/utils/game/requirementCheck";

/**
 * 获取用户的推荐列表
 */
export async function getUserReferralInfo(userUuid: string, full: boolean = false): Promise<ReferrerInfo> {
    let total = await prisma.userReferral.findMany({
        where: {
            referrerUuid: userUuid,
        }
    })
    let matchStage = await prisma.userReferral.findMany({
        where: 
        {
            status: 'CONFIRMED',
            referrerUuid: userUuid,
            OR: [
                {
                    matchStage1Reward: true,
                },
                {
                    confirmedByReferred: true,
                    matchStage2Reward: true,
                }
            ],
        }
    })

    let matchStage1Count = matchStage.filter(item => item.matchStage1Reward).length;
    let matchStage2Count = matchStage.filter(item => item.matchStage2Reward).length;

    let claimedStage1 = matchStage.filter(item => {
        return item.matchStage1Reward && item.referrerRewardedStage1
    })
    let claimedStage2 = matchStage.filter(item => {
        return item.matchStage2Reward && item.referrerRewardedStage2
    })

    let unclaimedStage1 = matchStage.filter(item => {
        return item.matchStage1Reward && !item.referrerRewardedStage1
    })
    let unclaimedStage2 = matchStage.filter(item => {
        return item.matchStage2Reward && !item.referrerRewardedStage2
    })

    let info: UserReferral[] = []

    if (full) {
        info = matchStage
    }

    let referredUserUuid = total.map(item => item.referredUuid);
    let users = await prisma.user.findMany({
        select: {
            uuid: true,
            create_date: true,
            last_online_date: true,
        },
        where: {
            uuid: {
                in: referredUserUuid
            }
        },
        orderBy: {
            create_date: "desc"
        }
    })

    let referredUuidList = users.map((u) => ({
      uuid: u.uuid,
      createDate: u.create_date,
      latestOnlineDate: u.last_online_date,
      confirmed: matchStage.find(item => item.referredUuid === u.uuid)?.confirmedByReferred || false,
    }));

    return {
        total: total.length,

        matchStage1Count,
        matchStage2Count,

        claimedStage1Count: claimedStage1.length,
        claimedStage2Count: claimedStage2.length,

        unclaimedStage1Count: unclaimedStage1.length,
        unclaimedStage2Count: unclaimedStage2.length,

        referredUserInfo: referredUuidList,

        info
    }
}

const sanitizeRewardPayload = (payload: ItemCountInfo): ItemCountInfo => {
    const entries = Object.entries(payload ?? {});
    if (!entries.length) {
        return {};
    }

    let currentWorkEquipmentCount = 0;
    let currentBattleEquipmentCount = 0;

    const result: ItemCountInfo = {};
    for (const [rawKey, rawVal] of entries) {
        const key = rawKey as string;

        const resource = allGameResource[key];

        if (!['gold', 'cutePoint'].includes(key)) {
            if (resource.hideInShop) {
                throw new Error("礼包内不可添加无法交易的物品：" + resource.name);
            } 
            if (resource.hideInMarket) {
                throw new Error("礼包内不可添加无法交易的物品：" + resource.name);
            }
        }

        if (!resource) {
            throw new Error("礼包内存在不可添加的物品");
        }

        if (key.startsWith("__")) {
            throw new Error("礼包内存在不可添加的物品：" + resource.name);
        }

        if (key.toLowerCase().includes("genesisessence")) {
            throw new Error("礼包内存在不可添加的物品：" + resource.name);
        }

        if (key.toLowerCase().includes("+")) {
            throw new Error("礼包内存在强化物品：" + resource.name);
        }

        if (!rawVal || typeof rawVal.count !== "number" || !Number.isInteger(rawVal.count) || !Number.isFinite(rawVal.count)) {
            throw new Error("礼包内物品数量异常：" + resource.name);
        }

        const count = Math.floor(rawVal.count);
        if (count <= 0) {
            throw new Error("礼包内物品数量必须大于0：" + resource.name);
        }

        const itemLimit = INVITE_REWARD_ITEM_LIMITS[key] ?? INVITE_REWARD_DEFAULT_ITEM_LIMIT;
        if (count > itemLimit) {
            throw new Error("礼包内物品数量超过上限：" + resource.name);
        }

        if (resource.equipmentType?.includes('work')) {
            currentWorkEquipmentCount += 1;
        }
        if (resource.equipmentType?.includes('battle')) {
            currentBattleEquipmentCount += 1;
        }

        if (resource.equipPart && count > INVITE_REWARD_MAX_EQUIPITEM_LIMIT) {
            throw new Error(`礼包内单个装备类物品数量不能超过${INVITE_REWARD_MAX_EQUIPITEM_LIMIT}个：` + resource.name);
        }

        result[key as AllGameResourceID] = { count };
    }

    if (Object.keys(result).length > INVITE_REWARD_MAX_ITEM_KINDS) {
        throw new Error(`礼包内物品种类不能超过${INVITE_REWARD_MAX_ITEM_KINDS}种`);
    }

    if (currentWorkEquipmentCount > INVITE_REWARD_MAX_WORK_EQUIPITEM_KINDS) {
        throw new Error(`礼包内生活类装备物品种类不能超过${INVITE_REWARD_MAX_WORK_EQUIPITEM_KINDS}种`);
    }

    if (currentBattleEquipmentCount > INVITE_REWARD_MAX_BATTLE_EQUIPITEM_KINDS) {
        throw new Error(`礼包内战斗类装备物品种类不能超过${INVITE_REWARD_MAX_BATTLE_EQUIPITEM_KINDS}种`);
    }

    return result;
};

const parseSetting = (record: UserInviteRewardSettingModel): InviteRewardSetting => {
    const reward = JSON.parse(record.rewardPayload) as ItemCountInfo;
    return {
        uuid: record.uuid,
        userUuid: record.userUuid,
        reward,
        isActive: record.isActive,
        lastUpdatedAt: record.lastUpdatedAt,
        nextEditableAt: new Date(record.lastUpdatedAt.getTime() + INVITE_REWARD_EDIT_COOLDOWN_MS)
    };
};

export async function setInviteRewardSetting(referrerUuid: string, rewardPayload: ItemCountInfo): Promise<InviteRewardSetting> {
    const normalized = sanitizeRewardPayload(rewardPayload);
    const now = new Date();

    return await prisma.$transaction(async (tx) => {
        const existing = await tx.userInviteRewardSetting.findUnique({ where: { userUuid: referrerUuid } });
        const lastUpdatedAt = existing ? existing.lastUpdatedAt : null;
        const nextEditableAt = lastUpdatedAt ? new Date(lastUpdatedAt.getTime() + INVITE_REWARD_EDIT_COOLDOWN_MS) : now;
        if (existing && nextEditableAt.getTime() > now.getTime()) {
            throw new Error("每7天可修改一次，请稍后再试");
        }

        const payloadStr = JSON.stringify(normalized);

        if (existing) {
            const updated = await tx.userInviteRewardSetting.update({
                where: { userUuid: referrerUuid },
                data: {
                    rewardPayload: payloadStr,
                    isActive: true,
                    lastUpdatedAt: now,
                }
            });
            return parseSetting(updated);
        }

        const created = await tx.userInviteRewardSetting.create({
            data: {
                uuid: randomUUID(),
                userUuid: referrerUuid,
                rewardPayload: payloadStr,
                isActive: true,
                lastUpdatedAt: now,
            }
        });
        return parseSetting(created);
    });
}

export async function getInviteRewardSetting(referrerUuid: string): Promise<InviteRewardSetting | null> {
    const record = await prisma.userInviteRewardSetting.findUnique({ where: { userUuid: referrerUuid } });
    if (!record) return null;
    return parseSetting(record);
}

const rewardToOption = (actionName: string): ModifyItemCountOption => ({
    actionName,
    type: ModifyItemCountType.Other,
    showModifyInfo: true,
    sendModifyEvent: true,
});

export async function confirmReferredRelationshipAndGrantReward(referredUuid: string): Promise<void> {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
        const referral = await tx.userReferral.findUnique({
            where: { referredUuid: referredUuid },
        });

        if (!referral) {
            throw new Error("未找到邀请关系");
        }

        if (referral.confirmedByReferred) {
            return; // 已确认直接返回，幂等
        }

        const referrerUuid = referral.referrerUuid;
        if (!referrerUuid) {
            throw new Error("邀请人不存在");
        }

        const setting = await tx.userInviteRewardSetting.findUnique({ where: { userUuid: referrerUuid } });

        if (!setting || !setting.isActive) {
            throw new Error("邀请人奖励已停用");
        }

        const rewardFromSetting: ItemCountInfo = setting ? JSON.parse(setting.rewardPayload) as ItemCountInfo : {};
        const reward: ItemCountInfo = rewardFromSetting;

        if (Object.keys(reward).length > 0) {
            const requirements = convertItemCountInfoToResourceRequirement(reward);
            const hasEnough = await checkResourceRequirementInDB(referrerUuid, requirements, tx);
            if (!hasEnough) {
                throw new Error("邀请人库存不足，无法发放奖励");
            }

            await decreaseItemCount(
              referrerUuid,
              reward,
              rewardToOption("发放邀新礼包"),
              tx,
            );
            await invalidateInventoryCache(referrerUuid);
            await enqueueToHarvestBox(referredUuid, reward, {
                title: "确认推荐关系获得奖励",
                source: HarvestBoxSource.Manual,
            }, tx);
        }

        await tx.userReferral.update({
            where: { referredUuid },
            data: {
                confirmedByReferred: true,
                status: "CONFIRMED",
                confirmedAt: now,
                confirmReferredRelationRewardSnapshot: JSON.stringify(reward),
                updatedAt: now,
            },
        });
    });
}


export async function updateReferrerState(referrerUuid: string) {
    await updateStage1Check(referrerUuid);
    await updateStage2Check(referrerUuid);
}
export async function updateStage1Check(referrerUuid: string) {
    let resList = await prisma.userReferral.findMany({
        select: {
            status: true,
            referredUuid: true,
        },
        where: {
            status: 'CONFIRMED', // 刚注册
            // confirmedByReferred: true,
            referrerUuid: referrerUuid,
            matchStage1Reward: false,
            referrerRewardedStage1: false,
        }
    })


    for(const item of resList) {
        let referredUuid = item.referredUuid;

        let userData = await prisma.user.findUnique({
            where: {
                uuid: referredUuid,
                is_banned: false,
            },
        });

        if (!userData) {
            continue;
        }

        let createDate = userData.create_date;
        let lastOnlineDate = userData.last_online_date;
        let emailVerified = userData.email_verified;

        if (!lastOnlineDate || !createDate || !emailVerified) {
            continue;
        }

        // 注册满5天
        let fiveDays = 1000 * 60 * 60 * 24 * 5;
        if (Date.now() - createDate.getTime() < fiveDays) {
            continue;
        }

        // 近期活跃过
        let oneDay = 1000 * 60 * 60 * 24 * 1;
        if (Date.now() - lastOnlineDate.getTime() > oneDay) {
            continue;
        }


        let characterStatus = await getCharacterStatusInfo(referredUuid)
        // 生活等级（不含交易），达到100级
        let totalWorkLevel = 0
        for(const status of allWorkStatus) {
            if (status != 'trading') {
                totalWorkLevel += characterStatus[status].level ?? 0
            }
        }

        if (totalWorkLevel < 100) {
            continue;
        }

        await prisma.userReferral.update({
            where: {
                user_referral_unique: {
                    referrerUuid: referrerUuid,
                    referredUuid: referredUuid
                }
            },
            data: {
                matchStage1Reward: true
            }
        });
    }
}
export async function updateStage2Check(referrerUuid: string) {
    let resList = await prisma.userReferral.findMany({
        select: {
            status: true,
            referredUuid: true,
        },
        where: {
            status: 'CONFIRMED', // 刚注册
            confirmedByReferred: true,
            referrerUuid: referrerUuid,
            matchStage1Reward: true,
            matchStage2Reward: false,
            referrerRewardedStage2: false,
        }
    })


    for(const item of resList) {
        let referredUuid = item.referredUuid;

        let userData = await prisma.user.findUnique({
            where: {
                uuid: referredUuid,
                is_banned: false,
            },
        });

        if (!userData) {
            continue;
        }

        let createDate = userData.create_date;
        let lastOnlineDate = userData.last_online_date;
        let emailVerified = userData.email_verified;

        if (!lastOnlineDate || !createDate || !emailVerified) {
            continue;
        }

        // 注册满10天
        let tenDays = 1000 * 60 * 60 * 24 * 10;
        if (Date.now() - createDate.getTime() < tenDays) {
            continue;
        }

        // 近期活跃过
        let oneDay = 1000 * 60 * 60 * 24 * 1;
        if (Date.now() - lastOnlineDate.getTime() > oneDay) {
            continue;
        }


        let characterStatus = await getCharacterStatusInfo(referredUuid)
        // 生活等级（不含交易），达到220级
        let totalWorkLevel = 0
        for(const status of allWorkStatus) {
            if (status != 'trading') {
                totalWorkLevel += characterStatus[status].level ?? 0
            }
        }

        if (totalWorkLevel < 220) {
            continue;
        }

        await prisma.userReferral.update({
            where: {
                user_referral_unique: {
                    referrerUuid: referrerUuid,
                    referredUuid: referredUuid
                }
            },
            data: {
                matchStage2Reward: true
            }
        });
    }
}

export async function claimStage1Rewards(userUuid: string) {
    let referralInfo = await getUserReferralInfo(userUuid, true);

    if (!referralInfo?.unclaimedStage1Count || !referralInfo.info?.length) {
        throw new Error('没有可领取的奖励');
    }

    // 领取奖励逻辑
    let fullInfo = referralInfo.info;
    for(const info of fullInfo) {
        if (info.matchStage1Reward && !info.referrerRewardedStage1) {
            await giveReferrerStage1Reward(userUuid);

            await prisma.userReferral.update({
                where: {
                    uuid: info.uuid
                },
                data: {
                    referrerRewardedStage1: true,
                    referrerStage1RewardAt: new Date()
                }
            });
        }
    }
}

export async function claimStage2Rewards(userUuid: string) {
    let referralInfo = await getUserReferralInfo(userUuid, true);

    if (!referralInfo?.unclaimedStage2Count || !referralInfo.info?.length) {
        throw new Error('没有可领取的奖励');
    }

    // 领取奖励逻辑
    let fullInfo = referralInfo.info;
    for(const info of fullInfo) {
        if (info.matchStage2Reward && !info.referrerRewardedStage2) {
            await giveReferrerStage2Reward(userUuid);

            await prisma.userReferral.update({
                where: {
                    uuid: info.uuid
                },
                data: {
                    referrerRewardedStage2: true,
                    referrerStage2RewardAt: new Date()
                }
            });
        }
    }
}

export async function giveReferrerStage1Reward(userUuid: string) {
    let rewardInfo = clone(REFERRER_REWARD[0])

    let sponsorPointCount = rewardInfo['__sponsorPoint']!.count

    delete rewardInfo['__sponsorPoint']

    await increaseItemCount(userUuid, rewardInfo, {
        actionName: '通过推荐链接注册的玩家到达1阶段',
        type: ModifyItemCountType.Other,
        showModifyInfo: true
    });
    await dispatchInventoryInfoToClient(userUuid)

    await addSponsorPoints(userUuid, sponsorPointCount, '通过推荐链接注册的玩家到达一阶段')
}

export async function giveReferrerStage2Reward(userUuid: string) {
    let rewardInfo = clone(REFERRER_REWARD[1])

    let sponsorPointCount = rewardInfo['__sponsorPoint']!.count

    delete rewardInfo['__sponsorPoint']

    await increaseItemCount(userUuid, rewardInfo, {
        actionName: '通过推荐链接注册的玩家到达2阶段',
        type: ModifyItemCountType.Other,
        showModifyInfo: true
    });
    await dispatchInventoryInfoToClient(userUuid)

    await addSponsorPoints(userUuid, sponsorPointCount, '通过推荐链接注册的玩家到达二阶段')
}