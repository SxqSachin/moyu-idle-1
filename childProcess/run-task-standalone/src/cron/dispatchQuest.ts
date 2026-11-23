import { BASE_MAX_QUEST_COUNT, } from "~/shared/data/constant";
import { generateQuestParam, getQuestList, quickCreateActionQuest } from "../utils/game/quest";
import { prisma } from "../utils/prisma";

// 定义执行时间点（小时）
const EXECUTION_HOURS = [0, 4, 8, 12, 16, 20, 22];

let running = true;
let lastExecutedHour: number | null = null;

process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function dispatchQuestToAllPlayers() {
  try {
    const users = await prisma.user.findMany({
      select: { uuid: true }, 
      where: { is_banned: false }
    });
    
    console.log(`开始为 ${users.length} 个玩家分发任务...`);
    
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      for(const user of batch) {
        try {
          let thisUserPendingQuestCount = await getQuestList(user.uuid);
          if (thisUserPendingQuestCount.length >= 20) {
            console.log(`玩家${user.uuid}当前待完成任务数${thisUserPendingQuestCount.length}已达上限${BASE_MAX_QUEST_COUNT}，跳过分发`);
            continue;
          }

          const param = generateQuestParam(user.uuid);
          await quickCreateActionQuest(param);
          successCount++;
          thisUserPendingQuestCount.length = 0
          console.log(`为玩家${user.uuid}创建任务成功，当前已分发成功 ${successCount} 个任务`);
        } catch (e) {
          errorCount++;
          console.error(`为玩家${user.uuid}创建任务失败:`, e);
        }
      }
      
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`任务分发完成 - 成功: ${successCount}, 失败: ${errorCount}, 总计: ${users.length}`);
    
  } catch (error) {
    console.error('分发任务过程中发生错误:', error);
  }
}

async function mainLoop() {
  console.log('任务分发服务启动...');
  console.log(`执行时间点: ${EXECUTION_HOURS.map(h => `${h}:00`).join(', ')}`);
  
  while (running) {
    const now = new Date();
    const currentHour = now.getHours();
    
    // await dispatchQuestToAllPlayers();
    // 检查是否需要执行
    if (EXECUTION_HOURS.includes(currentHour) && lastExecutedHour !== currentHour) {
      console.log(`到达执行时间点 ${currentHour}:00，开始执行任务分发 - ${now.toLocaleString()}`);
      await dispatchQuestToAllPlayers();
      lastExecutedHour = currentHour;
    }
    
    // 重置执行记录（跨天时）
    if (currentHour === 0 && lastExecutedHour !== 0) {
      lastExecutedHour = null;
    }
    
    // 每分钟检查一次
    await new Promise(resolve => setTimeout(resolve, 600000));
  }
}

// 启动主循环
await mainLoop();