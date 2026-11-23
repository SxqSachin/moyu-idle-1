import { getTaskQueueInRedis, removeFirstTask, updateFirstTaskInfo } from "../utils/game/taskQueue"
import { checkTaskRequirement, extraReturnTaskUsedResource, giveTaskReward, giveTaskStatusImprove, returnTaskUsedResource, useTaskResourceRequirement } from "../utils/game/task";
import { compareUpgradedStatus, getCharacterStatusInfo, } from "../utils/game/characterStatus";
import { getQuestListByExecutorAndActionId, updateQuestProgress } from "../utils/game/quest";
import { getActionDuration } from "../utils/game/character";
import { prisma } from "../utils/prisma"
import { pushMessageToQueue } from "../utils/game/msgQueue";
import type { Quest } from "~/shared/types/quest";
import type { Tavern } from "~/generated/prisma";
import type { CharacterEquipmentInfo, CharacterStatusInfo, PlayerState } from "~/shared/types/characterInfo";
import type { GameTask } from "~/shared/types/gameTask";
import type { BaseVillageBuildingInfo } from "~/shared/types/village/building";
import { calcExtraWrokExpRewardPercent } from "~/shared/utils/game/requirementCheck";
import type { ItemCountInfo } from "~/shared/types/gameInventory";
import { allGameAction, allGameActionId } from "~/shared/data/allGameActions";
import type { LearnedSkillFlatItem } from "~/shared/types/skillTree";
import { allWorkSkillTreeNodesMap } from "~/shared/data/skillTrees";
import { isActionInclude } from "~/shared/utils/game/game";
import { randomNumberInFullColseRange } from "~/shared/utils";

export async function runUserTask(userUuid: string, param: {
  userTavern: Tavern[],
  userCharacterStatus: CharacterStatusInfo,
  userTasks: GameTask[],
  userQuests: Quest[],
  workEquipment: CharacterEquipmentInfo,
  villageBuildingInfo: BaseVillageBuildingInfo[],
  userBasicInfo: { uuid: string, is_banned: boolean, last_online_date: Date | null },
  playerState: PlayerState,
  skillNodes: LearnedSkillFlatItem[]
}) {
  try {
    let { userTavern, userCharacterStatus, userTasks, userQuests, villageBuildingInfo, workEquipment, userBasicInfo, playerState, skillNodes } = param;

    const taskAboutUser = userTasks;
    const firstTask = taskAboutUser.at(0);

    if (!userTavern) {
      userTavern = [];
    }
    if (!userCharacterStatus) {
      userCharacterStatus = await getCharacterStatusInfo(userUuid)
      console.log(userUuid, ' try getCharacterStatusInfo')
    }

    if (!firstTask) {
      return;
    }

    const taskConfig = allGameAction[firstTask.actionId];

    if (!taskConfig || taskConfig.hidden) {
      return;
    }

    const isDismentleAction = firstTask.actionId.startsWith('dismantle_')

    // 如果动作不存在，则删除
    if (!allGameAction[firstTask.actionId]) {
      await removeFirstTask(userUuid);
      return;
    }

    if (isDismentleAction) {
      // return;
    }

    // 首个任务被删除的，直接删除此任务，并通知客户端刷新队列
    // 删除任务的逻辑已被移动至removeTaskFromQueue.ts

    const inRequirement = firstTask.hasDeductFirstTaskResource
      ? true
      : await checkTaskRequirement(userUuid, firstTask);

    // 不符合要求的，直接删除
    if (!inRequirement) {
      await removeFirstTask(userUuid);
      const updatedTaskAboutUser = await getTaskQueueInRedis(userUuid);
      pushMessageToQueue({
        type: "need_reset_current_action_progress",
        userUuid: userUuid
      });
      pushMessageToQueue({
        type: "dispatch_task_queue_to_client",
        userUuid: userUuid,
        info: updatedTaskAboutUser
      });

      if (firstTask.hasDeductFirstTaskResource) {
        await returnTaskUsedResource(userUuid, firstTask);
      }
      return;
    }

    // 进行任务前，先扣除本次执行需要的资源
    if (!firstTask.hasDeductFirstTaskResource) {
      firstTask.hasDeductFirstTaskResource = true;
      await useTaskResourceRequirement(userUuid, firstTask);
      await updateFirstTaskInfo(userUuid, firstTask);
      return
    }

    const now = Date.now();
    if (!firstTask.lastSubtaskDoneTime) {
      firstTask.lastSubtaskDoneTime = now;
      await updateFirstTaskInfo(userUuid, firstTask);
      return;
    }

    const pastTime = now - firstTask.lastSubtaskDoneTime;
    const obj = await getActionDuration(userUuid, firstTask.actionId);
    if (!obj) {
      return;
    }
    const { final: finalDuration } = obj;
    // 完成了一个任务
    if (pastTime >= finalDuration) {
      firstTask.currentRepeat = (firstTask.currentRepeat ?? 0) + 1;
      firstTask.lastSubtaskDoneTime = now;

      // 完成了一次子任务后，标记尚未扣除资源
      firstTask.hasDeductFirstTaskResource = false;

      // todo 补足因长时间执行导致出现的余数
      // firstTask.pastTimeAboutLastSubtask = 0;

      await updateFirstTaskInfo(userUuid, firstTask);
      pushMessageToQueue({
        type: "task_updated",
        userUuid: userUuid,
        firstTask: firstTask
      });
      pushMessageToQueue({
        type: "dispatch_task_queue_to_client",
        userUuid: userUuid,
        info: taskAboutUser
      });

      const expPercent = 1 + calcExtraWrokExpRewardPercent(villageBuildingInfo);

      const quests = userQuests || []
      const [reward, statusRes] = await Promise.all([
        giveTaskReward(userUuid, firstTask, {
          experts: userTavern,
          status: userCharacterStatus,
          playerState,
          workEquipment,
          skillNodes,
          villageBuildingInfo
        }),
        giveTaskStatusImprove(
          userUuid,
          firstTask,
          userTavern,
          userCharacterStatus,
          workEquipment,
          skillNodes,
          expPercent,
        ),
      ]);
      // let quests: Quest[] = [];

      if (!isDismentleAction && skillNodes.length) {
        for(const {nodeId, level} of skillNodes) {
          const node = allWorkSkillTreeNodesMap[nodeId]
          if (typeof node?.businessEffects?.actionReturnDeductEffect != 'function') {
            continue;
          }

          const deductReturnEffects = node.businessEffects.actionReturnDeductEffect(level)

          for(const effect of deductReturnEffects) {
            const passActionCheck = [effect.actionId].some(effectActionId => isActionInclude(effectActionId, firstTask.actionId))

            if (!passActionCheck) {
              continue;
            }

            if (randomNumberInFullColseRange(0, 1) < effect.modifyPercent) {
              await extraReturnTaskUsedResource(userUuid, firstTask, effect.desc, effect.deductResourceReturnPercent);
            }
          }
        }
      }

      if (!!reward) {
        if (reward.resourceReward) {
          pushMessageToQueue({
            type: 'inventory_modify',
            userUuid,
            info: reward.resourceReward
          })
        }
        if (reward.buildingReward) {
          pushMessageToQueue({
            type: "building_info",
            userUuid: userUuid,
          });
        }
      }

      if (statusRes) {
        const { latestCharacterStatusInfo, oriCharacterStatusInfo } = statusRes;
        const upgradedStatus = compareUpgradedStatus(oriCharacterStatusInfo, latestCharacterStatusInfo);
        if (upgradedStatus) {
          pushMessageToQueue({
            type: "status_upgrade",
            userUuid: userUuid,
            info: upgradedStatus
          });
        }
      }

      let questPromiseList: Promise<Quest>[] = []
      for (const quest of quests) {
        if (
          quest.target.actionId == firstTask.actionId &&
          quest.target.count > quest.target.current
        ) {
          questPromiseList.push(updateQuestProgress(quest.uuid, 1));
        }
      }
      let res = await Promise.all(questPromiseList);

      // for (const r of res) {
      //   pushMessageToQueue({
      //     type: "quest_update",
      //     userUuid: userUuid,
      //     info: r
      //   });
      // }

      // 上面已经更新过核心状态并保存一次，这里不再重复写入，避免双写
      // await updateFirstTaskInfo(userUuid, firstTask);
    }

    // 完成了一组队列
    if (firstTask.currentRepeat >= firstTask.repeatCount) {
      await removeFirstTask(userUuid);
      const updatedTaskAboutUser = await getTaskQueueInRedis(userUuid);

        pushMessageToQueue({
          type: "task_updated",
          userUuid: userUuid,
          firstTask: firstTask
        });
        pushMessageToQueue({
          type: "dispatch_task_queue_to_client",
          userUuid: userUuid,
          info: updatedTaskAboutUser
        });
      return;
    }
  } catch (e) {
    // swallow error, keep process running
    return;
  }
}