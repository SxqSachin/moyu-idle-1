/**
 * 离线追赶：玩家上线时一次性结算离线期间应完成的任务进度与收益。
 * 设计原则：
 *  - 不复制 runUserTask 的奖励/校验逻辑；保持幂等与一致性。
 *  - 通过循环驱动 runUserTask，按时间顺序推进任务。
 *  - 计算可完成次数：基于 (now - lastSubtaskDoneTime)/duration；每次循环推进一份，直到全部补齐。
 *  - 初始化阶段（尚未扣资源 / 无 lastSubtaskDoneTime）需要先跑 runUserTask 让状态就绪。
 *  - 使用与实时调度相同的租约键，避免并发重复执行。
 */
import { redisClient } from "@/server/utils/index";
import { getTaskQueueInRedis } from "./taskQueue";
import { runUserTaskForOffline } from "./runUserTaskForOffline";
import { emitOfflineAggregated } from "./offlineEmit";
import { scheduleUserImmediate } from "./schedule";
import type {
  CharacterEquipmentInfo,
  CharacterStatusInfo,
  PlayerState,
} from "~/shared/types/characterInfo";
import type { Tavern } from "~/generated/prisma/client";
import type { Quest } from "~/shared/types/quest";
import { prisma } from "./db";
import { getUserTalentCats } from "./tarven";
import { getCharacterStatusInfo } from "./characterStatus";
import { getQuestList } from "./quest";
import { getUserEquipment } from "./equipment";
// lightweight basic user info loader
async function getBasicUserInfo(userUuid: string) {
  return await prisma.user.findUnique({
    where: { uuid: userUuid },
    select: {
      uuid: true,
      name: true,
      last_online_date: true,
      last_offline_date: true,
      sponsor_points: true,
      max_sponsor_points: true,
      current_title: true,
    },
  });
}

const EXEC_LEASE_TTL_MS = 30_000; // 与实时调度一致
const MAX_SINGLE_RUN_MS = Number(process.env.OFFLINE_CATCHUP_MAX_MS || 8_000); // 单次 catchUp 最多占用时长
const MAX_ACTIONS_PER_USER = Number(
  process.env.OFFLINE_CATCHUP_MAX_ACTIONS || 2_000
); // 防止极端长离线刷爆CPU

function leaseKey(u: string) {
  return `user_task_lease:${u}`;
}

interface Snap {
  basic?: any;
  status?: CharacterStatusInfo;
  taverns?: Tavern[];
  quests?: Quest[];
  work?: CharacterEquipmentInfo;
  playerGlobalState?: PlayerState;
}

async function loadSnap(userUuid: string): Promise<Snap> {
  const [basic, status, taverns, quests, work, playerStateMap] =
    await Promise.all([
      getBasicUserInfo(userUuid),
      getCharacterStatusInfo(userUuid),
      getUserTalentCats(userUuid),
      getQuestList(userUuid),
      getUserEquipment(userUuid, "work"),
      batchGetPlayerGlobalState([userUuid]),
    ]);
  return {
    basic,
    status: status || undefined,
    taverns: taverns || [],
    quests: quests || [],
    work: (work as any) || ({} as any),
    playerGlobalState: playerStateMap.get(userUuid) || ({} as PlayerState),
  };
}

function getFirstTaskLocal(tasks: any[]) {
  return tasks[0] || null;
}

export async function offlineCatchUp(userUuid: string) {
  const realStart = Date.now();
  const got = await redisClient
    .SET(leaseKey(userUuid), "1", { NX: true, PX: EXEC_LEASE_TTL_MS } as any)
    .catch(() => null);
  if (!got) return; // 有并发执行，直接放弃
  try {
    const snap = await loadSnap(userUuid);
    if (!snap.basic) return;

    // 拉取全局建筑缓存（简单直接：不走调度器那套）
    const villageBuildingInfo = await prisma.villageBuilding.findMany({
      select: { type: true, level: true, status: true },
      where: { status: { in: ["NORMAL", "UPGRADING", "PREPARE_UPGRADE"] } },
    });

    // 虚拟时间窗口
    const offlineBase = snap.basic.last_offline_date
      ? new Date(snap.basic.last_offline_date).getTime()
      : snap.basic.last_online_date
      ? new Date(snap.basic.last_online_date).getTime()
      : realStart;
    const offlineEnd = Date.now();
    let virtualNow = offlineBase;
    if (offlineEnd - offlineBase < 1_000) {
      // 离线时间太短无需追赶
    } else {
      let actionsDone = 0;
      const aggInventory: any[] = [];
      let aggBuildingChanged = false;
      const aggStatusUpgrade: any[] = [];
      while (
        virtualNow < offlineEnd &&
        Date.now() - realStart < MAX_SINGLE_RUN_MS &&
        actionsDone < MAX_ACTIONS_PER_USER
      ) {
        const currentQueue = await getTaskQueueInRedis(userUuid);
        const firstTask = getFirstTaskLocal(currentQueue);
        if (!firstTask) break;

        const result = await runUserTaskForOffline(userUuid, {
          userTavern: snap.taverns || [],
          userCharacterStatus: snap.status as any,
          userTasks: currentQueue,
          userQuests: snap.quests || [],
          villageBuildingInfo: villageBuildingInfo as any,
          workEquipment: snap.work || ({} as any),
          userBasicInfo: snap.basic,
          playerState: snap.playerGlobalState || ({} as PlayerState),
          nowOverride: virtualNow,
          aggregate: true,
        });

        actionsDone++;
        if (!result) continue;
        if (result.agg) {
          if (result.agg.inventory) aggInventory.push(...result.agg.inventory);
          if (result.agg.buildingInfoChanged) aggBuildingChanged = true;
          if (result.agg.statusUpgradeList)
            aggStatusUpgrade.push(...result.agg.statusUpgradeList);
        }
        switch (result.type) {
          case "init-resource":
          case "init-time":
          case "requirement-fail":
          case "removed-finished":
            if (result.type === "removed-finished") {
              // 任务切换，刷新一次角色状态（可能影响后续任务耗时 / 奖励系数）
              try {
                snap.status =
                  (await getCharacterStatusInfo(userUuid)) || snap.status;
              } catch {
                /* ignore */
              }
            }
          case "noop":
            // 不推进时间，只是状态改变 / 任务换入
            break;
          case "repeat-done":
            if (result.duration && result.duration > 0) {
              virtualNow += result.duration;
            } else {
              // 防御：未知 duration 视为最小 1ms
              virtualNow += 1;
            }
            break;
          case "cooldown-wait":
            if (result.nextAvailable) {
              if (result.nextAvailable > offlineEnd) {
                virtualNow = offlineEnd; // 超出窗口，结束
              } else if (result.nextAvailable <= virtualNow) {
                virtualNow += 1; // 防御异常，至少推进1ms避免死循环
              } else {
                virtualNow = result.nextAvailable;
              }
            } else {
              virtualNow += 1;
            }
            break;
        }
      }
      // 批量下发聚合事件（改为通过适配层统一发送）
      let mergedInventory: Record<string, { count: number }> | undefined =
        undefined;
      if (aggInventory.length) {
        mergedInventory = {};
        for (const inv of aggInventory) {
          if (!inv || typeof inv !== "object") continue;
          for (const key of Object.keys(inv)) {
            const entry = inv[key];
            if (!entry || typeof entry.count !== "number") continue;
            const prev = mergedInventory[key]?.count || 0;
            mergedInventory[key] = { count: prev + entry.count };
          }
        }
      }
      // 获取最终任务队列
      const finalQueue = await getTaskQueueInRedis(userUuid);
      await emitOfflineAggregated(userUuid, {
        inventory: mergedInventory,
        buildingInfoChanged: aggBuildingChanged,
        statusUpgradeList: aggStatusUpgrade,
        taskQueue: finalQueue,
      });
    }
  } catch (e) {
    console.error("offlineCatchUp error", userUuid, e);
  } finally {
    await redisClient.DEL(leaseKey(userUuid)).catch(() => {});
    await scheduleUserImmediate(userUuid); // 让实时调度接管后续
  }
}
