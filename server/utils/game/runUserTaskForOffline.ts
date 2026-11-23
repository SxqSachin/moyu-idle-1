/**
 * runUserTaskForOffline
 * --------------------------------------------------
 * 对当前任务队列首元素执行一次“离线模式”推进。
 * 由 offlineCatchUp 的循环使用 nowOverride(虚拟时间) 多次调用。
 * 与在线实时执行逻辑语义保持一致；差异点：aggregate=true 时不直接向客户端发事件，
 * 而是将奖励 / 状态升级 / 建筑变化聚合到返回值中，供外层统一下发。
 *
 * 阶段结果 (OfflineRunResult.type)：
 *  - requirement-fail   条件检查失败 -> 任务被移除
 *  - init-resource      首次扣资源完成（尚未开始计时）
 *  - init-time          第一次记录 lastSubtaskDoneTime
 *  - repeat-done        完成一个子循环 (repeat)，外层应以 duration 推进虚拟时间
 *  - cooldown-wait      冷却中，返回 nextAvailable 供外层跳跃时间
 *  - removed-finished   所有 repeat 完成并移除任务
 *  - noop               未发生任何有效推进（异常 / 缺数据）
 */
import { getTaskQueueInRedis, removeFirstTask, updateFirstTaskInfo } from './taskQueue';
import { checkTaskRequirement, giveTaskReward, giveTaskStatusImprove, returnTaskUsedResource, useTaskResourceRequirement } from './task';
import { compareUpgradedStatus, getCharacterStatusInfo } from './characterStatus';
import { getActionDuration } from './character';
import { prisma } from './db';
import { emitEventToUser } from '~/server/io';
import { redisClient as redis } from '../index';
import type { Tavern } from '~/generated/prisma';
import type { CharacterEquipmentInfo, CharacterStatusInfo, PlayerState } from '~/shared/types/characterInfo';
import type { GameTask } from '~/shared/types/gameTask';
import type { BaseVillageBuildingInfo } from '~/shared/types/village/building';
import type { Quest } from '~/shared/types/quest';

export interface OfflineRunResult {
  type: 'init-resource' | 'init-time' | 'repeat-done' | 'requirement-fail' | 'removed-finished' | 'cooldown-wait' | 'noop';
  duration?: number;          // repeat-done: 本次子任务耗时 (ms)
  nextAvailable?: number;     // cooldown-wait: 下一次可执行时间戳 (ms)
  taskId?: string;            // 本次涉及的任务 actionId
  agg?: {                     // 聚合模式下收集的增量
    inventory?: any[];        // ItemCountInfo 列表（后续会被合并）
    buildingInfoChanged?: boolean;
    statusUpgradeList?: any[];
  };
}

// Quest 进度最小推进：不处理完成奖励，仅 +delta，保证离线补进与在线一致
async function updateQuestProgress(questUuid: string, delta: number): Promise<Quest | null> {
  const dbQuest = await prisma.quest.findUnique({ where: { uuid: questUuid } });
  if (!dbQuest) return null;
  if (dbQuest.targetCurrentCount >= dbQuest.targetGoalCount) return null;
  const newCurrent = Math.min(dbQuest.targetCurrentCount + delta, dbQuest.targetGoalCount);
  const updated = await prisma.quest.update({
    where: { uuid: questUuid },
    data: {
      targetCurrentCount: newCurrent,
      updatedAt: new Date(),
      status: newCurrent >= dbQuest.targetGoalCount ? 'DONE' : dbQuest.status,
    },
  });
  await redis.del(`quest:list:${updated.executor}`).catch(() => {}); // 使缓存失效
  return {
    uuid: updated.uuid,
    title: updated.title,
    actionMainType: updated.actionMainType,
    description: updated.description ?? undefined,
    executor: updated.executor,
    difficulty: updated.difficulty,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt ?? undefined,
    completedAt: updated.completedAt ?? undefined,
    status: updated.status,
    rerollCount: updated.rerollCount ?? 0,
    target: { actionId: updated.targetActionId, count: updated.targetGoalCount, current: updated.targetCurrentCount },
    dueDate: updated.dueDate ?? undefined,
    rewards: JSON.parse(updated.rewards),
  } as Quest;
}

// --- 辅助函数 ----------------------------------------------------------
function emitTaskQueueChange(userUuid: string, tasks: GameTask[]) {
  emitEventToUser(userUuid, 'taskUpdated', tasks[0]);
  emitEventToUser(userUuid, 'dispatchTaskQueueToClient', tasks);
}

function appendRewardAgg(agg: OfflineRunResult['agg'] | undefined, reward: any): OfflineRunResult['agg'] | undefined {
  if (!reward) return agg;
  const next = agg || {};
  if (reward.resourceReward) (next.inventory = next.inventory || []).push(reward.resourceReward);
  if (reward.buildingReward) next.buildingInfoChanged = true;
  return next;
}

/**
 * 执行离线任务单步推进
 * @param userUuid 玩家ID
 * @param param 依赖快照与控制参数
 */
export async function runUserTaskForOffline(
  userUuid: string,
  param: {
    userTavern: Tavern[];
    userCharacterStatus: CharacterStatusInfo;
    userTasks: GameTask[];
    userQuests: Quest[];
    workEquipment: CharacterEquipmentInfo; // 当前未使用，接口保留
    villageBuildingInfo: BaseVillageBuildingInfo[]; // 可能影响耗时或奖励（预留）
    userBasicInfo?: { uuid: string; is_banned?: boolean; last_online_date?: Date | null };
    playerState?: PlayerState; // 预留
    nowOverride?: number;     // 虚拟当前时间戳
    aggregate?: boolean;      // 聚合模式（true: 不发事件，收集结果）
  }
): Promise<OfflineRunResult | void> {
  try {
    let { userTavern, userCharacterStatus, userTasks, userQuests } = param;
    const firstTask = userTasks.at(0);
    if (!firstTask) return; // 队列为空

    if (!userTavern) userTavern = [];
    if (!userCharacterStatus) userCharacterStatus = await getCharacterStatusInfo(userUuid);

    // Step1 条件校验（仅首次扣资源前需要）
    const inRequirement = firstTask.hasDeductFirstTaskResource ? true : await checkTaskRequirement(userUuid, firstTask);
    if (!inRequirement) {
      await removeFirstTask(userUuid);
      const updatedQueue = await getTaskQueueInRedis(userUuid);
      if (!param.aggregate) { // 聚合模式下抑制实时事件
        emitEventToUser(userUuid, 'needResetCurrentActionProgress');
        emitEventToUser(userUuid, 'dispatchTaskQueueToClient', updatedQueue);
      }
      if (firstTask.hasDeductFirstTaskResource) await returnTaskUsedResource(userUuid, firstTask);
      return { type: 'requirement-fail', taskId: firstTask.actionId };
    }

    // Step2 首次资源扣除
    if (!firstTask.hasDeductFirstTaskResource) {
      firstTask.hasDeductFirstTaskResource = true;
      await useTaskResourceRequirement(userUuid, firstTask);
      await updateFirstTaskInfo(userUuid, firstTask);
      return { type: 'init-resource', taskId: firstTask.actionId };
    }

    const now = param.nowOverride ?? Date.now();

    // Step3 首次计时点初始化
    if (!firstTask.lastSubtaskDoneTime) {
      firstTask.lastSubtaskDoneTime = now;
      await updateFirstTaskInfo(userUuid, firstTask);
      return { type: 'init-time', taskId: firstTask.actionId };
    }

    // Step4 判断是否完成一个子循环
    const pastTime = now - firstTask.lastSubtaskDoneTime;
    const durationObj = await getActionDuration(userUuid, firstTask.actionId);
    if (!durationObj) return { type: 'noop' };
    const { final: finalDuration } = durationObj;

    let agg: OfflineRunResult['agg'] | undefined = undefined;

    if (pastTime >= finalDuration) {
      // Step4.1 子任务完成：推进 repeat
      firstTask.currentRepeat = (firstTask.currentRepeat ?? 0) + 1;
      firstTask.lastSubtaskDoneTime = now;
      firstTask.hasDeductFirstTaskResource = false; // 下一个循环需要重新扣资源
      await updateFirstTaskInfo(userUuid, firstTask);
      if (!param.aggregate) emitTaskQueueChange(userUuid, userTasks);

      // Step5 奖励与状态提升
      const [reward, statusRes] = await Promise.all([
        giveTaskReward(userUuid, firstTask),
        giveTaskStatusImprove(userUuid, firstTask),
      ]);
      if (param.aggregate) {
        agg = appendRewardAgg(agg, reward);
      } else if (reward) {
        if (reward.resourceReward) emitEventToUser(userUuid, 'inventoryModify', reward.resourceReward);
        if (reward.buildingReward) emitEventToUser(userUuid, 'buildingInfo');
      }

      if (statusRes) {
        const { latestCharacterStatusInfo, oriCharacterStatusInfo } = statusRes;
        const upgradedStatus = compareUpgradedStatus(oriCharacterStatusInfo, latestCharacterStatusInfo);
        if (upgradedStatus) {
          if (param.aggregate) {
            agg = agg || {}; (agg.statusUpgradeList = agg.statusUpgradeList || []).push(upgradedStatus);
          } else {
            emitEventToUser(userUuid, 'statusUpgrade', upgradedStatus);
          }
        }
      }

      // Step6 Quest 进度推进
      const questJobs: Promise<Quest | null>[] = [];
      for (const q of (userQuests || [])) {
        if (q.target.actionId === firstTask.actionId && q.target.count > q.target.current) {
          questJobs.push(updateQuestProgress(q.uuid, 1));
        }
      }
      await Promise.all(questJobs);

      // 未完成所有 repeat -> repeat-done（外层推进时间）
      if ((firstTask.currentRepeat ?? 0) < firstTask.repeatCount) {
        return { type: 'repeat-done', duration: finalDuration, taskId: firstTask.actionId, agg };
      }
    }

    // Step7 任务所有 repeat 完成 -> 移除
    if (firstTask.currentRepeat >= firstTask.repeatCount) {
      await removeFirstTask(userUuid);
      const updatedQueue = await getTaskQueueInRedis(userUuid);
      if (!param.aggregate) {
        emitEventToUser(userUuid, 'taskUpdated', firstTask);
        emitEventToUser(userUuid, 'dispatchTaskQueueToClient', updatedQueue);
      }
      return { type: 'removed-finished', taskId: firstTask.actionId };
    }

    // Step8 冷却等待阶段
    const nextAvailable = (firstTask.lastSubtaskDoneTime || now) + (await getActionDuration(userUuid, firstTask.actionId))!.final;
    return { type: 'cooldown-wait', nextAvailable, taskId: firstTask.actionId };
  } catch (e) {
    // 失败后保持静默（返回 noop），避免打断 offlineCatchUp 主循环；记录日志可选
    return { type: 'noop' };
  }
}

