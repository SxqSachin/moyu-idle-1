import { runUserTask } from './runUserTask.js';
import { getAllTaskQueueKeys, getMultiUserTaskQueueInRedis, removeUserTaskQueueInRedis } from '../utils/game/taskQueue';
import { withUniqueLock } from '../utils/index';
import { getMultiUserTalentCats, } from '../utils/game/tarven.js';
import { getCharacterStatusInfo, getMultiCharacterStatusInfo } from '../utils/game/characterStatus.js';
import pLimit from "p-limit";
import type { GameTask } from '~/shared/types/gameTask.js';
import { getMultiQuestList, getQuestListByExecutorAndActionId } from '../utils/game/quest.js';
import { logger } from '../utils/logger.js'
import { prisma } from '../utils/prisma.js';
import { VillageBuildingStatus, type BaseVillageBuildingInfo } from '~/shared/types/village/building.js';
import type { allVillageBuilding } from '~/shared/data/allVillageBuilding.js';
import { getMultiUserWorkEquipment } from '../utils/game/equipment.js';
import type { CharacterEquipmentInfo, CharacterStatusInfo } from '~/shared/types/characterInfo.js';
import type { Quest } from '~/shared/types/quest.js';
import type { Tavern } from '~/generated/prisma/client.js';
import { batchGetBasicUserInfo } from '../utils/game/user.js';
import { MAX_OFFLINE_HOUR } from '~/shared/data/constant.js';

function parseArgs() {
    const groupArg = process.argv.find(arg => arg.startsWith('--group='));
    const groupCountArg = process.argv.find(arg => arg.startsWith('--groupCount='));
    const group = groupArg ? parseInt(groupArg.split('=')[1], 10) : 0;
    const groupCount = groupCountArg ? parseInt(groupCountArg.split('=')[1], 10) : 6;
    return { group, groupCount };
}

const INTERVAL = 750;
let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

const REFRESH_DATA_EACH_LOOP = 10;
let currentLoopCount = 0;

async function main() {
  const { group, groupCount } = parseArgs();

  let userTaverns = new Map<string, Tavern[]>();
  let userCharacterStatuses = new Map<string, CharacterStatusInfo>();
  let userQuests = new Map<string, Quest[]>();
  let userWorkEquipments = new Map<string, CharacterEquipmentInfo>();
  let villageBuildingList: BaseVillageBuildingInfo[] = []
  let userBasicInfo: Map<string, { uuid: string, is_banned: boolean, last_online_date: Date | null }> = new Map();

  let needRefresh = true;

  let lastTimeUserUuids: string[] = []

  while (running) {
    const startTime = Date.now();

    const allQueueIds = await getAllTaskQueueKeys(); // 假设返回用户uuid数组
    const userUuids = allQueueIds.map(id => id.replace('TASK_QUEUE_', '')); // 去掉前缀
    const total = userUuids.length;

    const groupSize = Math.ceil(total / groupCount);
    const start = group * groupSize;
    let end = (group + 1) * groupSize;
    if (group === groupCount - 1) {
      end = total; // 最后一组处理剩余所有
    }
    const myUserUuids = userUuids.slice(start, end);

    // 当上次处理的用户uuid与本次有任何区别时，刷新数据
    if (!myUserUuids.every(uuid => lastTimeUserUuids.includes(uuid))) {
      needRefresh = true;
    }
    lastTimeUserUuids = myUserUuids;

    if (needRefresh) {
      let queryStart = Date.now();

      const [newUserTaverns, newUserCharacterStatuses, newUserQuests, newUserWorkEquipments, newUserBasicInfo] = await Promise.all([
        getMultiUserTalentCats(myUserUuids),
        getMultiCharacterStatusInfo(myUserUuids),
        getMultiQuestList(myUserUuids),
        getMultiUserWorkEquipment(myUserUuids),
        batchGetBasicUserInfo(myUserUuids)
      ])

      userTaverns = newUserTaverns;
      userCharacterStatuses = newUserCharacterStatuses;
      userQuests = newUserQuests;
      userWorkEquipments = newUserWorkEquipments;
      userBasicInfo = newUserBasicInfo;

      const villageBuildingInfo = await prisma.villageBuilding.findMany({
        select: {
          type: true,
          level: true
        },
        where: {
          status: VillageBuildingStatus.NORMAL
        }
      })
      villageBuildingList = villageBuildingInfo.map((item): BaseVillageBuildingInfo => ({
        type: item.type as keyof typeof allVillageBuilding,
        level: item.level
      }));

      let queryEnd = Date.now();

      needRefresh = false;
      console.log(`User data refreshed, "query time: ${queryEnd - queryStart}ms.`);
    }

    const userTasks = await getMultiUserTaskQueueInRedis(myUserUuids);

    let promiseList: Promise<void>[] = [];
    for (const userUuid of myUserUuids) {
      promiseList.push(
        new Promise(async (resolve) => {
          const thisUserBasicInfo = userBasicInfo.get(userUuid)

          // 被封禁的用户，直接清空任务队列
          if (thisUserBasicInfo?.is_banned) {
            await removeUserTaskQueueInRedis(userUuid);

            resolve();
            return
          }

          // maxOfflineHour内没登录的用户，不处理任务
          // if (thisUserBasicInfo?.last_online_date) {
          //   const now = new Date();
          //   const diffTime = now.getTime() - thisUserBasicInfo.last_online_date.getTime();
          //   const maxOfflineHour = MAX_OFFLINE_HOUR;
          //   if (diffTime > maxOfflineHour * 60 * 60 * 1000) {
          //     resolve();
          //     return;
          //   }
          // }

          // await withUniqueLock("userTask:" + userUuid, async () => {
            await runUserTask(userUuid, {
              userTavern: userTaverns.get(userUuid) || [],
              userCharacterStatus: userCharacterStatuses.get(userUuid)!,
              userTasks: userTasks.get(userUuid) || [],
              userQuests: userQuests.get(userUuid) || [],
              villageBuildingInfo: villageBuildingList ?? [],
              workEquipment: userWorkEquipments.get(userUuid) || {},
              userBasicInfo: userBasicInfo.get(userUuid)!
            });
          // });
          resolve();
        })
      );
    }

    await Promise.allSettled(promiseList).catch((error) => {
      console.error(
        `Error processing tasks for group ${group}:`,
        error
      );
    });

    const t2 = Date.now();
    if (t2 - startTime > INTERVAL) {
      logger.info(`Processed group ${group} with ${myUserUuids.length} rooms in ${t2 - startTime}ms`);
    }

    currentLoopCount++;
    if (currentLoopCount > REFRESH_DATA_EACH_LOOP) {
      needRefresh = true;
      currentLoopCount = 0;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < INTERVAL) {
      await new Promise(res => setTimeout(res, INTERVAL - elapsed));
    }
  }
}

await main();
process.exit(0)