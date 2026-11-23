import { feedKitty, getAllKittyByOwner } from "../utils/game/kitty";
import { prisma } from "../utils/prisma";
import { safeJsonParse } from "~/shared/utils";

const INTERVAL = 10 * 60 * 1000; // 10分钟，单位毫秒

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function runTask() {
  try {
    // 找到所有拥有autoFeeder
    const activeAutoFeeders = await prisma.userKittyFurniture.findMany({
      where: {
        furniture_id: 'autoFeeder',
        is_active: true,
        durability: { gt: 0 }
      },
      select: {
        uuid: true,
        user_uuid: true,
        config: true,
      }
    });

    for (const feeder of activeAutoFeeders) {
      let config = safeJsonParse<{ foodId?: string, count: number }>(feeder.config, {})
      if (!config?.foodId || !config.count) {
        continue;
      }

      let kitties = await getAllKittyByOwner(feeder.user_uuid)

      for(const kitty of kitties) {
        if (kitty.satiety < kitty.maxSatiety * 0.5) {
          try {
            await feedKitty(kitty.uuid, config.foodId, config.count)
            console.log(`喂食猫咪 ${kitty.uuid} 成功`, config.foodId, config.count);
          } catch (error) {
            // @ts-expect-error
            console.error(`喂食猫咪 ${kitty.uuid} 失败`, error?.message! ?? "");
          }
        }
      }
    }
    
  } catch (error) {
    console.error('猫咪自动喂食执行失败:', error);
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
  console.log('猫咪自动喂食服务启动...');
  
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

    console.log(`开始执行猫咪自动喂食 - ${new Date().toLocaleString()}`);
    await runTask();
    
    // 执行完成后等待10分钟间隔，防止死循环
    await new Promise(resolve => setTimeout(resolve, INTERVAL));
  }
}

await mainLoop();
process.exit(0);