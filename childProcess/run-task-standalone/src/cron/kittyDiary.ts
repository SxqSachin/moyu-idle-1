import { toKitty } from "../utils/game/kitty";
import { prisma } from "../utils/prisma";
import { allKittyEssayContent, allKittyIdleEssayContent } from "~/shared/data/allKittyEssayContent";
import { maybeGrantForMainType } from "../utils/game/traitGrantEngine";
import { type Kitty as KittyCat } from "~/shared/types/kitty";
import { addKittyEssay, } from "../utils/game/kittyEssay";
import { getMainTypeByActionId } from "~/shared/data/allGameActions";
import { randomIntegerInFullCloseRange, randomNumberInFullColseRange } from "~/shared/utils";
import { ModifyItemCountType, type ItemCountInfo } from "~/shared/types/gameInventory";
import { increaseItemCount } from "../utils/game/characterInventory";
import type { AllBaseCharacterStatusType, AllCharacterStatusType, CharacterStatusInfo } from "~/shared/types/characterInfo";
import { allWorkStatus } from "~/shared/data/allCharacterStatus";

const INTERVAL = 30 * 60 * 1000; // 30分钟，单位毫秒
const LOG_PROBABILITY = 0.1; // 10%概率
const IDLE_LOG_PROBABILITY = 0.1; // 10%概率

function getKittyEsayContentAndReward(kitty: KittyCat) {

    const actionId = kitty.actionId as keyof typeof allKittyEssayContent;
    const actionMainType = getMainTypeByActionId(actionId);

    if (!actionMainType) {
      console.warn(`未找到猫咪 ${kitty.name} 的工作类型: ${actionId}`);
      return;
    }

    const generateContentAndReward = () => {
      const templates = allKittyEssayContent[actionMainType];
      let resourceRewardInfo: ItemCountInfo = {};
      if (templates && templates.length > 0) {
        const content = templates[Math.floor(Math.random() * templates.length)];

        if (content.reward?.length <= 0) {
          return { content: content.content, resourceRewardInfo: {} };
        }

        // 如果存在奖励，则发放奖励
        for (const reward of content.reward ?? []) {
          // 资源奖励
          if (reward.id) {
            let count = 0;
            if (reward.percent && reward.percent < 1) {
              let basePercent = reward.percent;

              const perc = randomNumberInFullColseRange(0, 1);

              if (perc > basePercent) {
                continue;
              }
            }

            if (reward.range) {
              count = randomIntegerInFullCloseRange(reward.range);
            } else {
              count = (reward.count as number) ?? 0;
            }

            if (!count) {
              continue;
            }

            if (!resourceRewardInfo) {
              resourceRewardInfo = {};
            }

            const id = reward.id;
            if (!resourceRewardInfo[id]) {
              resourceRewardInfo[id] = { count: 0 };
            }
            resourceRewardInfo[id].count += count;
          }
        }

        if (!Object.keys(resourceRewardInfo).length) {
          return generateContentAndReward();
        }

        return { content: content.content, resourceRewardInfo };
      }
    };

    return generateContentAndReward();
}

async function maybeWriteKittyDiary(kitty: KittyCat) {
  // 每30分钟尝试写日志
  if (Math.random() < LOG_PROBABILITY) {
    const actionId = kitty.actionId as keyof typeof allKittyEssayContent;
    const actionMainType = getMainTypeByActionId(actionId);

    console.log(kitty.name, 'pass 1')

    if (!actionMainType) {
      console.warn(`未找到猫咪 ${kitty.name} 的工作类型: ${actionId} ${kitty.actionId}`);
      return;
    }

    let res = getKittyEsayContentAndReward(kitty);
    if (!res) {
      console.warn(`未找到合适的模板 ${kitty.name} ${actionId}`)
      return;
    }

    let { content, resourceRewardInfo } = res

    if (Object.keys(resourceRewardInfo)) {
      await increaseItemCount(kitty.owner, resourceRewardInfo, {
        actionName: content,
        type: ModifyItemCountType.KittySpecialAction,
        showModifyInfo: true,
      });
    }

    // non-destructive: attempt to grant traits according to templates for this main type
    try {
      await maybeGrantForMainType(actionMainType, kitty);
    } catch (e) {
      console.error('maybeGrantForMainType error', e);
    }

    await addKittyEssay(kitty, content, {
      action: kitty.actionId,
      extra: JSON.stringify({
        reward: resourceRewardInfo,
      }),
    });
  } else {
    console.log(kitty.name, `(${kitty.uuid})运气太差`)
  }
}

async function runWorkingKittyTask() {
    const allKitty = await prisma.kitty.findMany({
      where: {
        is_working: true,
        isInExpedition: false,
      }
    });

    const allKittyOwnerUuid = allKitty.map(kitty => kitty.owner);
    const allKittyOwnerStatus = await prisma.characterStatus.findMany({
      where: {
        user_uuid: {
          in: allKittyOwnerUuid
        }
      }
    });

    const allKittyOwnerStatusMap = new Map<string, typeof allKittyOwnerStatus[0]>();
    for (const status of allKittyOwnerStatus) {
      allKittyOwnerStatusMap.set(status.user_uuid, status);
    }

    console.log(`正在处理 ${allKitty.length} 只工作中的猫咪...`);

    let success = 0
    for(const kitty of allKitty) {

      let kittyOwnerStatus = allKittyOwnerStatusMap.get(kitty.owner);
      if (!kittyOwnerStatus) {
        console.warn(`未找到猫咪 ${kitty.name} 的主人状态: ${kitty.owner}`);
        continue;
      }

      let totalLevel = 0;
      const result: CharacterStatusInfo = {} as CharacterStatusInfo;
      Object.keys(kittyOwnerStatus).forEach((status) => {
        if (["id", "user_uuid", "character_uuid"].includes(status)) {
          return;
        }

        let statusKey: AllCharacterStatusType = status as AllCharacterStatusType;

        // @ts-ignore
        result[statusKey] = JSON.parse(kittyOwnerStatus[status]);
      });
      for (let [id, status] of Object.entries(result)) {
        let cid = id as typeof allWorkStatus[number]
        if (!allWorkStatus.includes(cid)) {
          continue;
        }
        if (cid == 'trading') {
          continue;
        }
       if (allWorkStatus.includes(cid)) {
         totalLevel += status.level;
       }
      }

      if (totalLevel < 100) {
        console.warn(`猫咪 ${kitty.name} 主人 的工作总等级不足 100，当前为 ${totalLevel}`);
        continue;
      }

      try {
        // 日志逻辑
        console.log("try write diray for kitty", kitty.name)
        await maybeWriteKittyDiary(toKitty(kitty));
        console.log("write diray done by kitty", kitty.name)
        success++;
      } catch (error) {
        console.error(`猫咪 ${kitty.uuid} 日志更新失败：`, error);
      }
    }

    console.log(`猫咪日志处理完成: ${success}/${allKitty.length} 只猫咪处理成功`);
}


async function maybeWriteIdleKittyDiary(kitty: KittyCat) {
  // 每30分钟尝试写日志
  if (Math.random() < IDLE_LOG_PROBABILITY) {
    const templates = allKittyIdleEssayContent;
    if (templates && templates.length > 0) {
      const content = templates[Math.floor(Math.random() * templates.length)];
      await addKittyEssay(kitty, content, {
        action: "idle" // 空闲状态
      })
    } else {
      console.log(`猫咪 ${kitty.name} 没有找到合适的日志模板, ${kitty.actionId}`);
    }
  }
}

async function runIdleKittyTask() {
  const allKitty = await prisma.kitty.findMany({
    where: {
      is_working: false,
      isInExpedition: false,
    }
  });

  console.log(`正在处理 ${allKitty.length} 只空闲中的猫咪...`);
  let success = 0
  for (const kitty of allKitty) {
    try {
      // 日志逻辑
      await maybeWriteIdleKittyDiary(toKitty(kitty));
      success++;
    } catch (error) {
      console.error(`猫咪 ${kitty.uuid} 日志更新失败：`, error);
    }
  }

  console.log(`空闲猫咪日志处理完成: ${success}/${allKitty.length} 只猫咪处理成功`);
}

async function runTask() {
  try {
    await runWorkingKittyTask()
    await runIdleKittyTask()
  } catch (error) {
    console.error('猫咪日志定时任务执行失败:', error);
  }
}

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function mainLoop() {
  console.log('猫咪日志服务启动...');
  while (running) {
    await runTask();

    // 随记正负10分钟浮动
    let thisTimeInterval = INTERVAL + (Math.random() * 20 - 10) * 60 * 1000;

    if (running) {
      await new Promise(resolve => setTimeout(resolve, thisTimeInterval));
    }
  }
  console.log('猫咪日志服务已停止。');
}

await mainLoop();
process.exit(0);