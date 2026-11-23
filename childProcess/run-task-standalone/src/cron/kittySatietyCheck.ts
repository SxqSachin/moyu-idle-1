import { getAllKittyTaskQueues } from "../utils/game/kitty";
import { KITTY_SATIETY_PER_SECOND } from "~/shared/data/constant";
import { prisma } from "../utils/prisma";

const INTERVAL = 10 * 60 * 1000; // 10分钟，单位毫秒

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function runTask() {
  try {
    const allQueue = await getAllKittyTaskQueues();
    const allKittyUuid = Object.keys(allQueue);

    if (allKittyUuid.length === 0) {
      console.log('没有工作中的猫咪需要处理');
      return;
    }

    // 只查询工作中的猫咪
    const allKitty = await prisma.kitty.findMany({
      where: {
        uuid: { in: allKittyUuid },
        is_working: true
      }
    });

    console.log(`开始处理 ${allKitty.length} 只工作中的猫咪饱食度...`);

    // 使用Promise.all并行处理所有猫咪更新
    let success = 0;
    for (const kitty of allKitty) {
      try {
        // 每10分钟扣除对应饱食度 (10分钟 = 600秒)
        let newSatiety = Math.max(0, kitty.satiety - KITTY_SATIETY_PER_SECOND * 600);
        newSatiety = +newSatiety.toFixed(4);

        let isWorking = newSatiety > 0;
        let actionId = isWorking ? kitty.action_id : "";
        
        await prisma.kitty.update({
          where: { uuid: kitty.uuid },
          data: {
            satiety: newSatiety,
            is_working: isWorking,
            action_id: actionId
          }
        });
        
        success += 1;
      } catch (error) {
        console.error(`更新猫咪 ${kitty.uuid} 饱食度失败:`, error);
      }
    }

    
    console.log(`猫咪饱食度更新完成: ${success}/${allKitty.length} 只猫咪更新成功`);
    
  } catch (error) {
    console.error('猫咪饱食度检查任务执行失败:', error);
  }
}


function getNextExecutionTime() {
  const now = new Date();
  const currentMinutes = now.getMinutes();
  
  // 计算下一个10分钟间隔的时间点 (0, 10, 20, 30, 40, 50)
  const nextMinutes = Math.ceil(currentMinutes / 10) * 10;
  const nextExecution = new Date(now);
  
  if (nextMinutes >= 60) {
    nextExecution.setHours(nextExecution.getHours() + 1);
    nextExecution.setMinutes(0);
  } else {
    nextExecution.setMinutes(nextMinutes);
  }
  
  nextExecution.setSeconds(0);
  nextExecution.setMilliseconds(0);
  
  return nextExecution;
}

async function mainLoop() {
  console.log('猫咪饱食度检查服务启动...');
  
  while (running) {
    const now = new Date();
    const nextExecution = getNextExecutionTime();
    const timeUntilNext = nextExecution.getTime() - now.getTime();
    
    console.log(`下次执行时间: ${nextExecution.toLocaleString()}`);
    console.log(`等待时间: ${Math.round(timeUntilNext / 1000)} 秒`);
    
    // 等待到下一个执行时间
    if (timeUntilNext > 0) {
      await new Promise(resolve => setTimeout(resolve, timeUntilNext));
    }
    
    if (!running) break;
    
    console.log(`开始执行猫咪饱食度检查 - ${new Date().toLocaleString()}`);
    await runTask();
    
    // 执行完成后等待10分钟间隔，防止死循环
    await new Promise(resolve => setTimeout(resolve, INTERVAL));
  }
}

await mainLoop();
process.exit(0);