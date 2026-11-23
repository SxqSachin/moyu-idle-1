import { getKitty, toKitty } from "../utils/game/kitty";
import { prisma } from "../utils/prisma";
import { type Kitty as KittyCat } from "~/shared/types/kitty";
import { addKittyEssay, createKittyEssay, } from "../utils/game/kittyEssay";
import { allGameAction, getMainTypeByActionId, } from "~/shared/data/allGameActions";
import { createKittyEncounter, createKittyFriendship, getAllKittyFriendship, } from "../utils/game/kittyFriend";
import { allKittyEncounterActionContent, allKittyFriendActionContent, allKittyFriendSameWorkActionContent } from "~/shared/data/allKittyEssayContent";
import type { KittyFriendshipInfo } from "~/shared/types/kittyFriend";

const INTERVAL = 30 * 60 * 1000; // 30分钟，单位毫秒
const NORMAL_PROBABILITY = 0.10; // 5%概率

async function playWithFriend(relationship: KittyFriendshipInfo) {

  if (Math.random() > NORMAL_PROBABILITY) {
    return;
  }

  const kittyA = await getKitty(relationship.kittyAUuid);
  const kittyB = await getKitty(relationship.kittyBUuid);

  if (!kittyA || !kittyB) {
    return;
  }

  if (kittyA.isInExpedition || kittyB.isInExpedition) {
    return
  }

  let atSameWork = kittyA.isWorking && kittyB.isWorking && kittyA.actionId === kittyB.actionId;
  let actionId = 'play_with_friend';

  // 首先肯定会增加好感度
  await prisma.kittyFriendship.update({
    where: {
      id: relationship.id
    },
    data: {
      intimacy: relationship.intimacy + 1
    }
  });


  // 写日记
  let template = allKittyFriendActionContent[Math.floor(Math.random() * allKittyFriendActionContent.length)];

  if (atSameWork) {
    const actionMainType = getMainTypeByActionId(kittyA.actionId);
    if (actionMainType) {
      let pool = allKittyFriendSameWorkActionContent[actionMainType]
      let sameActionTemplate = pool[Math.floor(Math.random() * pool.length)];
      if (sameActionTemplate) {
        template = sameActionTemplate;
        actionId = 'work_with_friend';
      }
    }
  }

  if (template) {
    let content = template.content
      .replace("{kittyA}", `[${kittyA.name}{${kittyA.uuid}}]`)
      .replace("{kittyB}", `[${kittyB.name}{${kittyB.uuid}}]`);
    await Promise.all([
      addKittyEssay(kittyA, content, {
        action: actionId,
        extra: JSON.stringify({
          reward: template.reward
        })
      }),
      addKittyEssay(kittyB, content, {
        action: actionId,
        extra: JSON.stringify({
          reward: template.reward
        })
      })
    ])
  }
}

let playedKittyAList: string[] = [];
async function runTask() {
  try {
    const allKittyFriend = await getAllKittyFriendship()

    console.log(`正在处理 ${allKittyFriend.length} 只好友猫咪的事件..`);

    let success = 0
    for(const kittyRelationship of allKittyFriend) {
      try {
        // 偶遇逻辑
        if (playedKittyAList.includes(kittyRelationship.kittyAUuid)) { 
          continue;
        }

        await playWithFriend(kittyRelationship);

        playedKittyAList.push(kittyRelationship.kittyAUuid);

        success++;
      } catch (error) {
        console.error(`猫咪 ${kittyRelationship.kittyAUuid} 和 ${kittyRelationship.kittyBUuid} 玩耍失败：`, error);
      }
    }

    console.log(`猫咪玩伴处理完成: ${success}/${allKittyFriend.length} 只猫咪处理成功`);

  } catch (error) {
    console.error('猫咪玩伴定时任务执行失败:', error);
  }
}

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function mainLoop() {
  console.log('猫咪玩伴服务启动...');
  while (running) {
    await runTask();
    playedKittyAList = [];

    if (running) {
      await new Promise(resolve => setTimeout(resolve, INTERVAL));
    }
  }
  console.log('猫咪玩伴服务启动已停止。');
}

await mainLoop();
process.exit(0);