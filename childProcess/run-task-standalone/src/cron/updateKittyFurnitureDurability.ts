import { decreaseFurnitureDurability } from "../utils/game/kittyFurniture";
import { allKittyFurniture } from "~/shared/data/allKittyFurniture";
import { prisma } from "../utils/prisma";

const INTERVAL = 30 * 60 * 1000; // 1分钟，单位毫秒
const HOURS_PER_INTERVAL = 30 / 60; // 1分钟 = 1/60小时

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function runTask() {
  try {
    console.log(`开始执行家具耐久度更新 - ${new Date().toLocaleString()}`);
    
    // 获取所有激活的家具实例
    const activeFurniture = await prisma.userKittyFurniture.findMany({
      where: {
        is_active: true,
        durability: { gt: 0 }
      },
      select: {
        uuid: true,
        user_uuid: true,
        furniture_id: true,
        level: true,
        durability: true,
        is_active: true
      }
    });

    if (activeFurniture.length === 0) {
      console.log('没有激活的家具需要处理');
      return;
    }

    console.log(`找到 ${activeFurniture.length} 个激活的家具实例`);

    for(const furniture of activeFurniture) {
      let lossPerHour = allKittyFurniture[furniture.furniture_id]?.durabilityLossPerHour || 0;

      if (!lossPerHour) {
        continue;
      }

      await decreaseFurnitureDurability(furniture.user_uuid, furniture.furniture_id, lossPerHour * HOURS_PER_INTERVAL);
    }

    console.log(`家具耐久度更新完成: 共 ${activeFurniture.length} 个 `);

    console.log('家具耐久度更新任务完成');
    
  } catch (error) {
    console.error('家具耐久度更新任务执行失败:', error);
  }
}

/**
 * 获取下一个执行时间
 */
function getNextExecutionTime() {
  const now = new Date();
  const intervalMinutes = INTERVAL / (60 * 1000); // 将毫秒转换为分钟
  
  // 获取当前时间的分钟数
  const currentMinutes = now.getMinutes();
  const currentSeconds = now.getSeconds();
  const currentMilliseconds = now.getMilliseconds();
  
  // 计算下一个间隔时间点
  let nextMinutes: number;
  
  if (intervalMinutes >= 60) {
    // 如果间隔大于等于1小时，按小时对齐
    const intervalHours = Math.floor(intervalMinutes / 60);
    const currentHour = now.getHours();
    const nextHour = Math.ceil((currentHour + 1) / intervalHours) * intervalHours;
    
    const nextExecution = new Date(now);
    nextExecution.setHours(nextHour);
    nextExecution.setMinutes(0);
    nextExecution.setSeconds(0);
    nextExecution.setMilliseconds(0);
    
    // 如果计算出的时间超过了今天，设置为明天的相应时间
    if (nextHour >= 24) {
      nextExecution.setDate(nextExecution.getDate() + 1);
      nextExecution.setHours(nextHour - 24);
    }
    
    return nextExecution;
  } else {
    // 如果间隔小于1小时，按分钟对齐
    // 计算下一个间隔时间点（向上取整到最近的间隔分钟）
    const totalCurrentMinutes = currentMinutes + (currentSeconds + currentMilliseconds / 1000) / 60;
    const nextIntervalMinutes = Math.ceil(totalCurrentMinutes / intervalMinutes) * intervalMinutes;
    
    const nextExecution = new Date(now);
    
    if (nextIntervalMinutes >= 60) {
      // 如果超过60分钟，进入下一小时
      nextExecution.setHours(nextExecution.getHours() + Math.floor(nextIntervalMinutes / 60));
      nextExecution.setMinutes(nextIntervalMinutes % 60);
    } else {
      nextExecution.setMinutes(nextIntervalMinutes);
    }
    
    nextExecution.setSeconds(0);
    nextExecution.setMilliseconds(0);
    
    return nextExecution;
  }
}

async function mainLoop() {
  console.log('家具耐久度更新服务启动...');
  console.log(`更新间隔: ${INTERVAL / 1000 / 60} 分钟 (${HOURS_PER_INTERVAL} 小时)`);
  console.log(`家具类型数量: ${Object.keys(allKittyFurniture).length}`);
  
  // 显示家具配置概览
  Object.entries(allKittyFurniture).forEach(([id, config]) => {
    console.log(`- ${config.name}(${id}): 每小时损失 ${config.durabilityLossPerHour || 1} 耐久度`);
  });
  
  while (running) {
    const now = new Date();
    const nextExecution = getNextExecutionTime();
    const timeUntilNext = nextExecution.getTime() - now.getTime();
    
    console.log(`\n下次执行时间: ${nextExecution.toLocaleString()}`);
    console.log(`等待时间: ${Math.round(timeUntilNext / 1000)} 秒`);
    
    // 等待到下一个执行时间
    if (timeUntilNext > 0) {
      await new Promise(resolve => setTimeout(resolve, timeUntilNext));
    }
    
    if (!running) break;
    
    await runTask();
    
    // 执行完成后等待30分钟间隔，防止死循环
    await new Promise(resolve => setTimeout(resolve, INTERVAL));
  }
}

await mainLoop();
process.exit(0);