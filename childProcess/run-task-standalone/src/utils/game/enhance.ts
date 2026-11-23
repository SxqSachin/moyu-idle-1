import { decreaseItemCount, getInventoryInfo, increaseItemCount, invalidateInventoryCache } from "./characterInventory";
import { prisma } from "../prisma";
import type { AllGameResourceID, GameResourceEnhanceInfo } from "~/shared/types/gameResource";
import enhanceInfoJson from "@/assets/resource/enhanceInfo.json"
import { allGameResource } from "~/shared/data/allGameResources";
import { ModifyItemCountType, type ItemCountInfo } from "~/shared/types/gameInventory";
import { delay, randomNumberInFullColseRange, safeJsonParse } from "~/shared/utils";
import { getCharacterStatusInfo, increaseCharacterStatusExp } from "./characterStatus";
import { ENHANCE_PERCENT_MODIFY_PER_LEVEL, EXTRA_ENHANCE_PERCENT_PER_LUCK } from "~/shared/data/constant";
import { getUserWorkingTalentCats } from "./tarven";
import { AutoEnhanceRequestStatus, type AutoEnhanceRequestResult, type AutoEnhanceResult } from "~/shared/types/enhance";
import type { EnhanceRequire, Prisma, PrismaClient, Tavern } from "~/generated/prisma";
import type { DefaultArgs } from "@prisma/client/runtime/library";
import { emitEventToUser } from "./msgQueue";
import { getEquipmentLevel } from "~/shared/utils/game/equipment";
import type { CharacterStatusInfo } from "~/shared/types/characterInfo";
import { withUniqueLock } from '../index'
import type { PrismaTx } from "~/shared/types/socket/db";
import { getPlayerTitle } from "./character";
import { allTitles, type GameTitle } from "~/shared/data/allTitle";


export async function enhanceItem(userUuid: string, enhanceItemId: string, protectedResourceId?: string, 
    opt?: {
        experts?: Tavern[],
        characterStatusInfo: CharacterStatusInfo
    },
    tx?: PrismaTx
): Promise<AutoEnhanceResult> {
    // return prisma.$transaction(async (tx) => {
    return await withUniqueLock("enhance:lock:" + userUuid, async () => {
        if (!tx) {
            tx = prisma;
        }

        let { experts, characterStatusInfo } = opt || {};

        if (!experts) {
            experts = await getUserWorkingTalentCats(userUuid);
        }
        if (!characterStatusInfo) {
            characterStatusInfo = await getCharacterStatusInfo(userUuid, tx);
        }


        // 边界检查：参数有效性
        if (!enhanceItemId || typeof enhanceItemId !== "string") {
            return { result: 'error', reason: "参数错误，缺少或非法的装备ID" };
        }

        // 检查玩家库存
        const inventory = await getInventoryInfo(userUuid, tx);
        if (!inventory[enhanceItemId] || inventory[enhanceItemId]!.count < 1) {
            return { result: 'error', reason: `背包中没有所需的待强化物品：${allGameResource[enhanceItemId]?.name || enhanceItemId}` };
        }

        // 获取强化信息
        // @ts-ignore
        const enhanceInfo = enhanceInfoJson[enhanceItemId] as
            | GameResourceEnhanceInfo
            | undefined;
        const successTo = enhanceInfo?.enhanceSuccessTo;
        if (!enhanceInfo || !successTo) {
            return {
                result: 'restart',
                reason: "此物品已无法被强化",
                currentItemId: enhanceItemId
            }
        }

        // 边界检查：强化目标ID有效性
        const failToWithProtected = enhanceInfo.enhanceFailToWithProtected;
        const failToWithUnprotected = enhanceInfo.enhanceFailToWithUnprotected;
        if (!failToWithProtected || !failToWithUnprotected) {
            return {
                result: 'error',
                reason: "此物品无法被强化(02)",
            }
        }

        if (!allGameResource[successTo]) {
            return {
                result: 'error',
                reason: "强化目标物品不存在",
            }
        }
        if (!allGameResource[failToWithProtected]) {
            return {
                result: 'error',
                reason: "回退物品不存在(01)",
            }
        }
        if (!allGameResource[failToWithUnprotected]) {
            return {
                result: 'error',
                reason: "回退物品不存在(02)",
            }
        }

        // 检查强化所需材料
        let materialCost: ItemCountInfo = {}
        if (
            Array.isArray(enhanceInfo.enhanceRequireResource) &&
            enhanceInfo.enhanceRequireResource.length > 0
        ) {
            for (const req of enhanceInfo.enhanceRequireResource) {
                if (!req.resourceId || typeof req.count !== "number" || req.count < 1) {
                    return {
                        result: 'error',
                        reason: "强化材料配置有误",
                    }
                }

                const inventoryCount = inventory[req.resourceId]?.count || 0;

                if (req.resourceId == enhanceItemId) {
                  // 主装备已经检查过了，这里要额外减去1
                  if (inventoryCount - 1 < req.count) {
                    return {
                        result: 'error',
                        reason: `缺少强化所需材料：${allGameResource[req.resourceId]?.name || req.resourceId}`,
                    };
                  }
                }

                if (
                  !inventory[req.resourceId] ||
                  inventoryCount < req.count
                ) {
                    return {
                        result: 'error',
                        reason: `缺少强化所需材料：${allGameResource[req.resourceId]?.name || req.resourceId}`,
                    };
                }
                materialCost[req.resourceId] = { count: req.count };
            }
        }

        // 检查保护物品（如果请求了保护）
        let useProtect = false;
        if (protectedResourceId) {
            if (
                !Array.isArray(enhanceInfo.enhanceProtecteResourceIds) ||
                !enhanceInfo.enhanceProtecteResourceIds.includes(protectedResourceId) ||
                !allGameResource[protectedResourceId]
            ) {
                return {
                    result: 'error',
                    reason: "所选保护装备无效",
                };
            }
            if (
                (inventory[protectedResourceId]?.count ?? 0) < 1
            ) {
                return {
                    result: 'error',
                    reason: `背包中没有所需的保护装备：${allGameResource[protectedResourceId]?.name || protectedResourceId}`,
                };
            }

            useProtect = true;
        }

        // 概率判定
        let rand = randomNumberInFullColseRange(0, 1);
        let enhanceResultId = "";
        let enhanceSuccess = false;

        let enhanceLevel = (characterStatusInfo.enhance.final || characterStatusInfo.enhance.level)

        // 增加等级补正
        let extraPercentFromEnhanceLevel = enhanceLevel * ENHANCE_PERCENT_MODIFY_PER_LEVEL;

        let luck = characterStatusInfo.luck?.final ?? 1
        let extraPercentFromLuck = +(luck - 1) * EXTRA_ENHANCE_PERCENT_PER_LUCK;

        if (extraPercentFromLuck <= 0) {
          extraPercentFromLuck = 0;
        }

        let extraFromTitle = 0;
        const currentTitle = await getPlayerTitle(userUuid);
        if (currentTitle) {
          const titleData = allTitles[currentTitle.active] as GameTitle;
          if (titleData && titleData.enhanceExtraSuccessPercent) {
            extraFromTitle = titleData.enhanceExtraSuccessPercent;
          }
        }

        let baseEnhancePercent = enhanceInfo.enhanceBasePercent + extraPercentFromEnhanceLevel;

        // 包括type=enhanceExpert的专家
        if (experts.some((expert) => expert.type === "enhanceExpert")) {
          // 强化专家猫猫提升20%成功率
          baseEnhancePercent *= 1.2;
        }

        const finalSuccessPercent = baseEnhancePercent + extraPercentFromLuck + extraFromTitle;

        if (rand < finalSuccessPercent) {
            // 强化成功
            enhanceResultId = successTo;
            enhanceSuccess = true;
        } else {
            // 强化失败
            if (useProtect) {
                enhanceResultId = failToWithProtected;
            } else {
                enhanceResultId = failToWithUnprotected;
            }
            enhanceSuccess = false;
        }

        // 不论成功与否，给予经验
        await increaseCharacterStatusExp(userUuid, [
            {
                status: "enhance",
                increaseExp: enhanceInfo.rewardEnhanceExp,
            },
        ], tx);

        // 记录已消耗资源，便于异常时返还
        const toConsume: ItemCountInfo = {};

        // 扣除原物品
        toConsume[enhanceItemId] = { count: 1 };

        // 扣除强化材料
        for (const k of Object.keys(materialCost)) {
            if (toConsume[k]) {
                toConsume[k].count += materialCost[k]!.count;
            } else {
                toConsume[k] = { count: materialCost[k]!.count };
            }
        }

        // 扣除保护装备
        if (useProtect && protectedResourceId) {
            if (toConsume[protectedResourceId]) {
                toConsume[protectedResourceId].count += 1;
            } else {
                toConsume[protectedResourceId] = { count: 1 };
            }
        }

        // 2. 统一扣除
        await decreaseItemCount(userUuid, toConsume, {
            actionName: "装备强化消耗",
            sendModifyEvent: true,
            showModifyInfo: true,
            type: ModifyItemCountType.Enhance
        }, tx);

        await increaseItemCount(
            userUuid,
            { [enhanceResultId]: { count: 1 } },
            {
                actionName: "装备强化获得",
                sendModifyEvent: true,
                showModifyInfo: true,
                type: ModifyItemCountType.Enhance
            },
            tx
        );

        await invalidateInventoryCache(userUuid);

        return {
            result: enhanceSuccess ? 'success' : 'failed',
            increaseItemId: enhanceResultId,
            decreaseItemId: toConsume
        }
    });
}

export async function autoEnhance(enhanceRequest: EnhanceRequire, opt?: {
    experts?: Tavern[],
    characterStatusInfo: CharacterStatusInfo
}) {
    // let tx = prisma;
    const transactionOptions = {
        timeout: 30000, // 提高事务超时时间以减少高负载时的超时
        maxWait: 5000, // 设置最大等待时间为5秒
    };

    let item: any = null;
    let tries = 0;
    const maxTries = 2;
    while (true) {
        try {
          item = await prisma.$transaction(async (tx) => {
            let uuid = enhanceRequest.uuid;

            let alreadyRepeatCount = enhanceRequest?.currentRepeatCount || 0;

            if (!enhanceRequest) {
              throw new Error("未找到自动强化请求");
            }

            let enhanceItemId = enhanceRequest.enhanceItemId;
            if (enhanceRequest.lastTimeEnhanceResultItemId) {
              enhanceItemId = enhanceRequest.lastTimeEnhanceResultItemId;
            }

            let currentLevel = getEquipmentLevel(enhanceItemId);
            let protectedResourceId: string | undefined;
            if (
              enhanceRequest.startProtectedWhen &&
              currentLevel >= +enhanceRequest.startProtectedWhen
            ) {
              protectedResourceId =
                enhanceRequest.protectedResourceId ?? undefined;
            }

            let thisTimeResult = await enhanceItem(
              enhanceRequest.userUuid,
              enhanceItemId,
              protectedResourceId,
              opt,
              tx
            );

            let resultList =
              safeJsonParse<AutoEnhanceResult[]>(enhanceRequest.resultDetail) ||
              [];
            let allGetItems =
              safeJsonParse<ItemCountInfo>(enhanceRequest.allGetItems) || {};
            let allUsedItems =
              safeJsonParse<ItemCountInfo>(enhanceRequest.allUsedItems) || {};
            const addToGetItems = (items: ItemCountInfo) => {
              for (const [id, info] of Object.entries(items)) {
                if (!info?.count) {
                  continue;
                }
                if (allGetItems[id]) {
                  allGetItems[id].count += info.count;
                } else {
                  allGetItems[id] = { ...info };
                }
              }
            };
            const addToUsedItems = (items: ItemCountInfo) => {
              for (const [id, info] of Object.entries(items)) {
                if (!info?.count) {
                  continue;
                }
                if (allUsedItems[id]) {
                  allUsedItems[id].count += info.count;
                } else {
                  allUsedItems[id] = { ...info };
                }
              }
            };

            let thisTimeAutoEnhanceResult: AutoEnhanceResult;

            switch (thisTimeResult.result) {
              case "success":
                thisTimeAutoEnhanceResult = {
                  result: "success",
                  increaseItemId: thisTimeResult.increaseItemId,
                  decreaseItemId: thisTimeResult.decreaseItemId,
                };
                addToGetItems({
                  [thisTimeResult.increaseItemId]: { count: 1 },
                });
                addToUsedItems(thisTimeResult.decreaseItemId);
                // 处理成功逻辑
                break;
              case "failed":
                thisTimeAutoEnhanceResult = {
                  result: "failed",
                  increaseItemId: thisTimeResult.increaseItemId,
                  decreaseItemId: thisTimeResult.decreaseItemId,
                };

                addToGetItems({
                  [thisTimeResult.increaseItemId]: { count: 1 },
                });
                addToUsedItems(thisTimeResult.decreaseItemId);
                break;
              case "error":
                thisTimeAutoEnhanceResult = {
                  result: "error",
                  reason: thisTimeResult.reason,
                };
                break;
              case "restart":
                thisTimeAutoEnhanceResult = {
                  result: "restart",
                  reason: thisTimeResult.reason,
                  currentItemId: thisTimeResult.currentItemId,
                };
                break;
            }

            resultList.push(thisTimeAutoEnhanceResult);
            alreadyRepeatCount++;

            // resultList
            // resultList仅保留最后100次结果
            if (resultList.length > 100) {
              resultList = resultList.slice(resultList.length - 100);
            }

            // 如果强化失败，则直接结束此次自动强化
            if (thisTimeResult.result == "error") {
              return await tx.enhanceRequire.update({
                where: { uuid },
                data: {
                  status: AutoEnhanceRequestStatus.ERROR,
                  resultDetail: JSON.stringify(resultList),
                  allGetItems: JSON.stringify(allGetItems),
                  allUsedItems: JSON.stringify(allUsedItems),
                  currentRepeatCount: alreadyRepeatCount,
                  lastTimeEnhanceResultItemId: null,
                  updatedAt: new Date(),
                  finishedAt: new Date(),
                },
              });
            }

            if (thisTimeResult.result == "restart") {
              return await tx.enhanceRequire.update({
                where: { uuid },
                data: {
                  status: AutoEnhanceRequestStatus.PROCESSING,
                  resultDetail: JSON.stringify(resultList),
                  allGetItems: JSON.stringify(allGetItems),
                  allUsedItems: JSON.stringify(allUsedItems),
                  currentRepeatCount: alreadyRepeatCount,
                  lastTimeEnhanceResultItemId: enhanceRequest.enhanceItemId,
                  updatedAt: new Date(),
                  finishedAt: new Date(),
                },
              });
            }

            if (
              thisTimeResult.increaseItemId ===
              enhanceRequest.stopWhenGetResource
            ) {
              return await tx.enhanceRequire.update({
                where: { uuid },
                data: {
                  status: AutoEnhanceRequestStatus.SUCCESS,
                  resultDetail: JSON.stringify(resultList),
                  allGetItems: JSON.stringify(allGetItems),
                  allUsedItems: JSON.stringify(allUsedItems),
                  currentRepeatCount: alreadyRepeatCount,
                  lastTimeEnhanceResultItemId: thisTimeResult.increaseItemId,
                  updatedAt: new Date(),
                  finishedAt: new Date(),
                },
              });
            }

            if (alreadyRepeatCount >= enhanceRequest.repeatCount) {
              return await tx.enhanceRequire.update({
                where: { uuid },
                data: {
                  status: AutoEnhanceRequestStatus.FINISHED,
                  resultDetail: JSON.stringify(resultList),
                  allGetItems: JSON.stringify(allGetItems),
                  allUsedItems: JSON.stringify(allUsedItems),
                  currentRepeatCount: alreadyRepeatCount,
                  lastTimeEnhanceResultItemId: thisTimeResult.increaseItemId,
                  updatedAt: new Date(),
                  finishedAt: new Date(),
                },
              });
            }

            if (!enhanceRequest.status) {
              return await tx.enhanceRequire.update({
                where: { uuid },
                data: {
                  status: AutoEnhanceRequestStatus.PROCESSING,
                  resultDetail: JSON.stringify(resultList),
                  allGetItems: JSON.stringify(allGetItems),
                  allUsedItems: JSON.stringify(allUsedItems),
                  currentRepeatCount: alreadyRepeatCount,
                  lastTimeEnhanceResultItemId: thisTimeResult.increaseItemId,
                  updatedAt: new Date(),
                  finishedAt: new Date(),
                },
              });
            }

            let item = await tx.enhanceRequire.update({
              where: { uuid },
              data: {
                resultDetail: JSON.stringify(resultList),
                allGetItems: JSON.stringify(allGetItems),
                allUsedItems: JSON.stringify(allUsedItems),
                currentRepeatCount: alreadyRepeatCount,
                lastTimeEnhanceResultItemId: thisTimeResult.increaseItemId,
                updatedAt: new Date(),
                finishedAt: new Date(),
              },
            });

            return item;
          }, transactionOptions);
          break;
        } catch (err: any) {
          tries++;
          const msg =
            err && err.message ? String(err.message).toLowerCase() : "";
          // 仅在疑似超时/锁等待相关错误时重试一次
          if (
            tries >= maxTries ||
            !(
              msg.includes("timeout") ||
              msg.includes("timed out") ||
              msg.includes("transaction") ||
              msg.includes("deadlock") ||
              msg.includes("could not serialize")
            )
          ) {
            throw err;
          }
          console.warn(
            `[autoEnhance] transaction attempt ${tries} failed, retrying after delay:`,
            err && err.message ? err.message : err
          );
          await delay(200 + Math.floor(Math.random() * 300));
        }
    }

    let eachResult: AutoEnhanceResult[] = safeJsonParse(item.resultDetail ?? "[]") as AutoEnhanceResult[];
    let res: AutoEnhanceRequestResult = {
        uuid: item.uuid,
        enhanceItemId: item.enhanceItemId,

        status: item.status as AutoEnhanceRequestStatus,

        repeatCount: item.currentRepeatCount,

        targetRepeatCount: item.repeatCount,
        targetResourceId: item.stopWhenGetResource ?? undefined,

        startAt: item.createdAt,
        endAt: null,

        eachResult,
        allGetItems: safeJsonParse(item.allGetItems ?? "[]"),
        allUsedItems: safeJsonParse(item.allUsedItems ?? "[]")
    };
    emitEventToUser(item.userUuid, "enhance:current:success", { res });
}