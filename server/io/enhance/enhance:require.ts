import { DefaultEventsMap, Socket } from "socket.io"
import { AllGameResourceID, GameResourceEnhanceInfo } from "~/shared/types/gameResource"
import { GameSocketData } from "~/shared/types/socket"
import enhanceInfoJson from "@/assets/resource/enhanceInfo.json"
import { getInventoryInfo, decreaseItemCount, increaseItemCount, dispatchInventoryUpdatedEventToClient } from "~/server/utils/game/characterInventory"
import { emitEventToUser } from ".."
import { randomNumberInFullColseRange, } from "~/shared/utils"
import { allGameResource } from "~/shared/data/allGameResources"
import { dispatchCharacterStatusInfo, getCharacterStatusInfo, increaseCharacterStatusExp } from "~/server/utils/game/characterStatus"
import { ENHANCE_PERCENT_MODIFY_PER_LEVEL, EXTRA_ENHANCE_PERCENT_PER_LUCK } from "~/shared/data/constant"
import { enhanceLogger } from "~/server/utils/logger"
import { getUserWorkingTalentCats } from "~/server/utils/game/tarven"
import { ModifyItemCountType } from "~/shared/types/gameInventory"
import { prisma } from "~/server/utils/game/db"
import { allTitles, GameTitle } from "~/shared/data/allTitle"
import { getPlayerTitle } from "~/server/utils/game/character"

type EnhanceRequest = {
  resourceId: AllGameResourceID
  protectedResourceId?: AllGameResourceID
}

const ENHANCE_LOCK_PREFIX = "enhance:request:lock:";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<EnhanceRequest>
) {
  let userUuid = data.user.uuid;

  // Redis锁检查
  const lockKey = ENHANCE_LOCK_PREFIX + userUuid;
  const lock = await redisClient.set(lockKey, "1", {
    NX: true,
    EX: 3,
  });

  if (lock !== "OK") {
    emitEventToUser(data.user, "enhance:result:error", {
      msg: "操作过于频繁，请稍后再试",
    });
    return;
  }

  try {
  await withUniqueLock("enhance:lock:" + userUuid, async () => {
    if (!userUuid) {
      emitEventToUser(userUuid, "enhance:result:error", {
        msg: "用户未登录或会话已过期，请重新登录",
      });
      return;
    }

    const user = data.user;
    const { resourceId, protectedResourceId } = data.data;

    // 边界检查：参数有效性
    if (!resourceId || typeof resourceId !== "string") {
      emitEventToUser(user, "enhance:result:error", {
        msg: "参数错误，缺少或非法的装备ID",
      });
      return;
    }

    // 检查玩家库存
    const inventory = await getInventoryInfoPreferCache(user.uuid);
    if (!inventory[resourceId] || inventory[resourceId]!.count < 1) {
      emitEventToUser(user, "enhance:result:error", {
        msg: "背包中没有该装备，无法强化",
      });
      return;
    }

    // 获取强化信息
    // @ts-ignore
    const enhanceInfo = enhanceInfoJson[resourceId] as
      | GameResourceEnhanceInfo
      | undefined;
    const successTo = enhanceInfo?.enhanceSuccessTo;
    if (!enhanceInfo || !successTo) {
      emitEventToUser(user, "enhance:result:error", {
        msg: "此物品无法被强化(01)",
      });
      return;
    }

    // 边界检查：强化目标ID有效性
    const failToWithProtected = enhanceInfo.enhanceFailToWithProtected;
    const failToWithUnprotected = enhanceInfo.enhanceFailToWithUnprotected;
    if (!failToWithProtected || !failToWithUnprotected) {
      emitEventToUser(user, "enhance:result:error", {
        success: false,
        msg: "此物品无法被强化(02)",
      });
      return;
    }

    if (!allGameResource[successTo]) {
      emitEventToUser(user, "enhance:result:error", {
        msg: "强化目标物品不存在",
      });
      return;
    }
    if (!allGameResource[failToWithProtected]) {
      emitEventToUser(user, "enhance:result:error", {
        msg: "回退物品不存在(01)",
      });
      return;
    }
    if (!allGameResource[failToWithUnprotected]) {
      emitEventToUser(user, "enhance:result:error", {
        msg: "回退物品不存在(02)",
      });
      return;
    }

    // 检查强化所需材料
    let materialCost: Record<string, { count: number }> = {};
    if (
      Array.isArray(enhanceInfo.enhanceRequireResource) &&
      enhanceInfo.enhanceRequireResource.length > 0
    ) {
      for (const req of enhanceInfo.enhanceRequireResource) {
        if (!req.resourceId || typeof req.count !== "number" || req.count < 1) {
          emitEventToUser(user, "enhance:result:error", {
            msg: "强化材料配置有误",
          });
          return;
        }

        const inventoryCount = inventory[req.resourceId]?.count || 0;

        if (req.resourceId == resourceId) {
          // 主装备已经检查过了，这里要额外减去1
          if (inventoryCount - 1 < req.count) {
            emitEventToUser(user, "enhance:result:error", {
              msg: `缺少强化所需材料：${allGameResource[req.resourceId]?.name || req.resourceId
                }`,
            });
            return;
          }
        }

        if (
          !inventory[req.resourceId] ||
          inventoryCount < req.count
        ) {
          emitEventToUser(user, "enhance:result:error", {
            msg: `缺少强化所需材料：${allGameResource[req.resourceId]?.name || req.resourceId
              }`,
          });
          return;
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
        emitEventToUser(user, "enhance:result:error", {
          msg: "所选保护装备无效",
        });
        return;
      }
      if (
        !inventory[protectedResourceId] ||
        inventory[protectedResourceId]!.count < 1
      ) {
        emitEventToUser(user, "enhance:result:error", {
          msg: "背包中没有所选保护装备",
        });
        return;
      }
      useProtect = true;
    }

    // 概率判定
    let rand = randomNumberInFullColseRange(0, 1);
    let enhanceResultId = "";
    let msg = "";
    let success = false;

    let characterStatusInfo = await getCharacterStatusInfo(user.uuid);
    let enhanceLevel = (characterStatusInfo.enhance.final || characterStatusInfo.enhance.level)

    // 增加等级补正
    let extraPercentFromEnhanceLevel = enhanceLevel * ENHANCE_PERCENT_MODIFY_PER_LEVEL;

    let luck = characterStatusInfo.luck?.final ?? 1
    let extraPercentFromLuck = +(luck - 1) * EXTRA_ENHANCE_PERCENT_PER_LUCK;

    if (extraPercentFromLuck <= 0) {
      extraPercentFromLuck = 0;
    }

    let extraFromTitle = 0;
    const currentTitle = await getPlayerTitle(user.uuid);
    if (currentTitle) {
      const titleData = allTitles[currentTitle.active] as GameTitle;
      if (titleData && titleData.enhanceExtraSuccessPercent) {
        extraFromTitle = titleData.enhanceExtraSuccessPercent;
      }
    }

    let baseEnhancePercent = enhanceInfo.enhanceBasePercent + extraPercentFromEnhanceLevel;

    let experts = await getUserWorkingTalentCats(userUuid);

    // 包括type=enhanceExpert的专家
    if (experts.some((expert) => expert.type === "enhanceExpert")) {
      // 强化专家猫猫提升20%成功率
      baseEnhancePercent *= 1.2;
    }

    const finalSuccessPercent = baseEnhancePercent + extraPercentFromLuck + extraFromTitle;

    if (rand < finalSuccessPercent) {
      // 强化成功
      enhanceResultId = successTo;
      msg = "强化成功！";
      success = true;
    } else {
      // 强化失败
      if (useProtect) {
        enhanceResultId = failToWithProtected;
        msg = "强化失败，装备降级";
      } else {
        enhanceResultId = failToWithUnprotected;
        msg = "强化失败，装备退回初始等级";
      }
      success = false;
    }

    // 不论成功与否，给予经验
    await increaseCharacterStatusExp(user.uuid, [
      {
        status: "enhance",
        increaseExp: enhanceInfo.rewardEnhanceExp,
      },
    ]);
    // await dispatchCharacterStatusInfo(user.uuid, info);

    // 记录已消耗资源，便于异常时返还
    let consumed: { [id: string]: number } = {};
    try {
      // 1. 整合所有要扣除的资源
      const toConsume: Record<string, { count: number }> = {};

      // 扣除原物品
      toConsume[resourceId] = { count: 1 };

      // 扣除强化材料
      for (const k in materialCost) {
        if (toConsume[k]) {
          toConsume[k].count += materialCost[k].count;
        } else {
          toConsume[k] = { count: materialCost[k].count };
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

      await prisma.$transaction(async (tx) => {
        // 2. 统一扣除
        await decreaseItemCount(user.uuid, toConsume, {
          actionName: "装备强化消耗",
          showModifyInfo: true,
          type: ModifyItemCountType.Enhance
        }, tx);

        // 3. 统计已消耗
        for (const k in toConsume) {
          consumed[k] = (consumed[k] || 0) + toConsume[k].count;
        }

        // 增加新物品
        // if (!allGameResource[enhanceResultId]) {
        //   // 返还已消耗资源
        //   if (Object.keys(consumed).length > 0) {
        //     await increaseItemCount(
        //       user.uuid,
        //       Object.fromEntries(
        //         Object.entries(consumed).map(([k, v]) => [k, { count: v }])
        //       ),
        //       { actionName: "强化异常返还", showModifyInfo: true }
        //     );
        //   }
        //   emitEventToUser(user, "enhance:result:error", {
        //     msg: "强化结果物品不存在，请联系管理员",
        //   });
        //   return;
        // }
        await increaseItemCount(
          user.uuid,
          { [enhanceResultId]: { count: 1 } },
          {
            actionName: "装备强化获得",
            showModifyInfo: true,
            type: ModifyItemCountType.Enhance
          },
          tx
        );

        await invalidateInventoryCache(user.uuid);
      })

      // 返回结果
      emitEventToUser(user, "enhance:require:success", {
        success,
        msg,
        enhanceResultId,
      });

      // 推送背包变更
      await dispatchInventoryUpdatedEventToClient(user.uuid);
    } catch (e: any) {
      // 返还已消耗资源
      // if (Object.keys(consumed).length > 0) {
      //   await increaseItemCount(
      //     user.uuid,
      //     Object.fromEntries(
      //       Object.entries(consumed).map(([k, v]) => [k, { count: v }])
      //     ),
      //     { actionName: "强化异常返还", showModifyInfo: true }
      //   );
      // }
      await dispatchInventoryUpdatedEventToClient(user.uuid);
      emitEventToUser(user, "enhance:result:error", {
        msg: "强化过程中发生异常，请重试或联系管理员",
      });
      return;
    }
  })
  } catch (e: any) {
    emitEventToUser(data.user, "enhance:result:error", {
      msg: "操作过于频繁，本次强化已取消，请稍后重试",
    });
  }
}