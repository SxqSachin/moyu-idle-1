import type { AllGameActionID } from "~/shared/types/gameAction";
import {
  getKitty,
  getKittyActionDuration,
  getKittyTask,
  getKittyTaskQueueInRedis,
  removeFirstKittyTask,
  updateFirstKittyTaskInfo,
} from "../utils/game/kitty";
import {
  checkTaskRequirement,
  giveTaskReward,
  giveTaskStatusImprove,
  extraReturnTaskUsedResource,
  returnTaskUsedResource,
  useTaskResourceRequirement,
} from "../utils/game/task";
import { allGameAction, defaultAllGameActionDurationDetail } from "~/shared/data/allGameActions";
import { pushMessageToQueue } from "../utils/game/msgQueue";
import { getUserAllFurniture, getUserFurnitureByType } from "../utils/game/kittyFurniture";
import { compareUpgradedStatus, getCharacterStatusInfo } from "../utils/game/characterStatus";
import { randomNumberInFullColseRange } from "~/shared/utils";
import type { AllKittyFurnitureID, KittyFurnitureExistInfo } from "~/shared/data/allKittyFurniture";
import { ModifyItemCountType, type ItemCountInfo } from "~/shared/types/gameInventory";
import { prisma } from "../utils/prisma";
import type { Tavern } from "~/generated/prisma";
import type { CharacterStatusInfo } from "~/shared/types/characterInfo";
import type { Kitty, KittyTraitRow } from "~/shared/types/kitty";
import type { BaseVillageBuildingInfo } from "~/shared/types/village/building";
import { calcExtraWrokExpRewardPercent } from "~/shared/utils/game/requirementCheck";

// const getKittyFurniture = async (ownerUuid: string): Promise<KittyFurnitureExistInfo> => {
//   let [hasScratchingPost, hasCashmereToy, hasStudyDesk, hasSilkKittyNest] = await Promise.all([
//     getUserFurnitureByType(ownerUuid, 'scratchingPost'),
//     getUserFurnitureByType(ownerUuid, 'furnitureCashmereToy'),
//     getUserFurnitureByType(ownerUuid, 'studyDesk'),
//     getUserFurnitureByType(ownerUuid, 'silkKittyNest'),
//   ])

//   return {
//     scratchingPost: !!hasScratchingPost && hasScratchingPost.isActive,
//     cashmereToy: !!hasCashmereToy && hasCashmereToy.isActive,
//     studyDesk: !!hasStudyDesk && hasStudyDesk.isActive,
//     silkKittyNest: !!hasSilkKittyNest && hasSilkKittyNest.isActive,
//   }
// }


export const runKittyTask = async (kittyUuid: string, param: {
  kitty: Kitty,
  userTavern: Tavern[],
  userCharacterStatus: CharacterStatusInfo,
  villageBuildingInfo: BaseVillageBuildingInfo[]
  furnitureInfo: KittyFurnitureExistInfo,
  kittyTraits?: KittyTraitRow[]
}) => {
  // const kitty = await getKitty(kittyUuid);
  let { kitty, userTavern, userCharacterStatus, villageBuildingInfo, furnitureInfo, kittyTraits } = param;

  if (!kitty) {
    kitty = (await getKitty(kittyUuid))!;
    console.error(kittyUuid, ' try getKitty')
  }

  if (!kitty || !kitty.isWorking) {
    return;
  }

  if (kitty.isInExpedition) {
    return;
  }

  if (!userTavern) {
    userTavern = [];
  }
  if (!userCharacterStatus) {
    userCharacterStatus = await getCharacterStatusInfo(kitty.owner)
    console.error(kitty.owner, ' try getCharacterStatusInfo')
  }


  const taskAboutKitty = await getKittyTask(kittyUuid);

  const firstTask = taskAboutKitty.at(0);
  if (!firstTask) {
    return;
  }

  let action = allGameAction[firstTask.actionId];
  if (!action || action.hidden || action.banToKitty) {
    return;
  }

  const isDismentleAction = action?.id?.startsWith('dismantle_')

  if (isDismentleAction) {
    // return;
  }

  const ownerUuid = kitty.owner;

  // 如果猫咪的饱食度为0，清空所有队列
  if (kitty?.satiety <= 0) {
    await removeFirstKittyTask(kittyUuid);
    const updatedTaskAboutKitty = await getKittyTaskQueueInRedis(kittyUuid);
    await pushMessageToQueue({
      type: "dispatch_kitty_task_queue",
      userUuid: ownerUuid,
      kittyUuid,
      taskQueue: updatedTaskAboutKitty,
    });
    return;
  }

  // 先检查是否符合需求
  const inRequirement = firstTask.hasDeductFirstTaskResource
    ? true
    : await checkTaskRequirement(ownerUuid, firstTask);
  // 不符合要求的，直接删除
  if (!inRequirement) {
    await removeFirstKittyTask(kittyUuid);
    const updatedTaskAboutKitty = await getKittyTaskQueueInRedis(kittyUuid);
    pushMessageToQueue({
      type: "dispatch_kitty_task_queue",
      userUuid: ownerUuid,
      kittyUuid,
      taskQueue: updatedTaskAboutKitty,
    });

    // 被终止的任务，如果已经扣除了资源，则进行返还
    if (firstTask.hasDeductFirstTaskResource) {
      if (kitty?.owner) {
        await returnTaskUsedResource(ownerUuid, firstTask, true);
      }
    }
    return;
  }

  // 进行任务前，先扣除本次执行需要的资源
  if (!firstTask.hasDeductFirstTaskResource) {
    firstTask.hasDeductFirstTaskResource = true;
    await useTaskResourceRequirement(ownerUuid, firstTask, true);
    await updateFirstKittyTaskInfo(kittyUuid, firstTask);
  }

  const now = Date.now();
  if (!firstTask.lastSubtaskDoneTime) {
    firstTask.lastSubtaskDoneTime = now;
    // firstTask.pastTimeAboutLastSubtask = 0;

    await updateFirstKittyTaskInfo(kittyUuid, firstTask);
    return;
  }

  // 猫咪执行任务时，饱食度会消耗

  const pastTime = now - firstTask.lastSubtaskDoneTime;

  // 猫咪执行任务，总是使用基准时间
  const finalDuration = getKittyActionDuration(kitty, firstTask.actionId, furnitureInfo, kittyTraits || []);
  // 完成了一个任务
  if (pastTime >= finalDuration) {
    firstTask.currentRepeat = (firstTask.currentRepeat ?? 0) + 1;
    firstTask.lastSubtaskDoneTime = now;

    // 完成了一次子任务后，标记尚未扣除资源
    firstTask.hasDeductFirstTaskResource = false;


    pushMessageToQueue({
      type: "dispatch_kitty_task_queue",
      userUuid: ownerUuid,
      kittyUuid,
      taskQueue: taskAboutKitty,
    });

    // 猫咪如果有书桌，可以为主人提供35%的经验
    const experts = userTavern;

    let expRewardPercent = calcExtraWrokExpRewardPercent(villageBuildingInfo);
    if (furnitureInfo.studyDesk) {
      // 有书桌的话，提供35%的经验奖励
      expRewardPercent += 0.35
    }

    expRewardPercent = (+expRewardPercent.toFixed(2))

    let giveTaskStatusImprovePromise = furnitureInfo.studyDesk ?
      giveTaskStatusImprove(ownerUuid, firstTask, experts, userCharacterStatus, null, null, expRewardPercent) :
      Promise.resolve(null)

    const [reward, statusRes] = await Promise.all([
      giveTaskReward(ownerUuid, firstTask, {
        experts, 
        status: userCharacterStatus,
        kitty: kitty,
        kittyTraits: kittyTraits,
      }),
      giveTaskStatusImprovePromise
    ]); 

    // 有毛绒玩具的话，5%额外获得一次奖励
    if (!isDismentleAction && furnitureInfo.cashmereToy) {
      if (randomNumberInFullColseRange(0, 1) < 0.05) {
        await Promise.all([
          giveTaskReward(ownerUuid, firstTask, {
            experts,
            status: userCharacterStatus,
            modifyInfo: {
              showModifyInfo: true,
              actionName: `猫咪助手 “${
                allGameAction[firstTask.actionId].name
              }” 额外奖励`,
              type: ModifyItemCountType.ActionGain,
              sendModifyEvent: true,
            },
          }),
        ]);
      }
    }

    // 有舒适猫窝的话，5%返还消耗
    if (!isDismentleAction && furnitureInfo.silkKittyNest) {
      if (randomNumberInFullColseRange(0, 1) < 0.05) {
        await extraReturnTaskUsedResource(ownerUuid, firstTask, `猫咪助手 ${action.name} 额外返还资源`);
      }
    }

    if (!!reward) {
      if (reward.resourceReward) {
          // pushMessageToQueue({
          //   type: "inventory_updated",
          //   userUuid: ownerUuid,
          // });
          pushMessageToQueue({
            type: 'inventory_modify',
            userUuid: ownerUuid,
            info:reward.resourceReward 
          })
          pushMessageToQueue({
            type: "dispatch_kitty_task_queue",
            userUuid: ownerUuid,
            kittyUuid,
            taskQueue: taskAboutKitty,
          })
      }

      if (reward.buildingReward) {
        pushMessageToQueue({
          type: "building_info",
          userUuid: ownerUuid,
        });
      }

      if (statusRes) {
        const { latestCharacterStatusInfo, oriCharacterStatusInfo } = statusRes;
        const upgradedStatus = compareUpgradedStatus(oriCharacterStatusInfo, latestCharacterStatusInfo);
        if (upgradedStatus) {
          pushMessageToQueue({
            type: "status_upgrade",
            userUuid: ownerUuid,
            info: upgradedStatus
          });
        }
      }

    }
    // 猫咪无法进行锻炼
    // 猫咪无法替主人完成任务

    // 更新当前的动作
    await prisma.kitty.update({
      where: { uuid: kittyUuid },
      data: {
        action_id: firstTask.actionId
      }
    })

    await updateFirstKittyTaskInfo(kittyUuid, firstTask);
  }


  // 完成了一组队列
  if (firstTask.currentRepeat >= firstTask.repeatCount) {
    await removeFirstKittyTask(kittyUuid);
    const updatedTaskAboutKitty = await getKittyTaskQueueInRedis(kittyUuid);
    await pushMessageToQueue({
      type: "dispatch_kitty_task_queue",
      userUuid: ownerUuid,
      kittyUuid,
      taskQueue: updatedTaskAboutKitty,
    });
    return;
  }
};