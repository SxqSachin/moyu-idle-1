import { prisma } from "../utils/prisma";
import { removeCharacterStatusFromOther } from "../utils/game/characterStatus";

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function run() {
  const now = new Date();
  try {
    let allCharacterStatusWithWishingPool = await prisma.characterStatus.findMany({
      select: {
        user_uuid: true
      },
      where: {
        luck: {
          contains: "wishingPool"
        }
      }
    });

    for(const characterStatus of allCharacterStatusWithWishingPool) {
      await removeCharacterStatusFromOther(characterStatus.user_uuid, 'luck', "wishingPool");
    }
   
    console.log(`[cleanWishingPoolLuckStatus] 更新许愿池Luck完成 共处理 ${allCharacterStatusWithWishingPool.length} 个，当前时间: ${now.toISOString()}`);

  } catch (error) {
    console.error(`[cleanWishingPoolLuckStatus] 更新许愿池Luck 失败`, error);
  }
}

function getNext2355Delay() {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getHours() < 23 || (now.getHours() === 23 && now.getMinutes() < 55) ? now.getDate() : now.getDate() + 1);
  next.setHours(23, 55, 0, 0);
  return next.getTime() - now.getTime();
}

async function mainLoop() {
  console.log('[cleanWishingPoolLuckStatus] 服务启动，每天00:00执行...');
  while (running) {
    // await run();
    const delay = getNext2355Delay();
    console.log(`[cleanWishingPoolLuckStatus] 下次执行时间: ${new Date(Date.now() + delay).toISOString()}`);
    await new Promise(res => setTimeout(res, delay));
    if (!running) break;
    await run();
  }
  console.log('[cleanWishingPoolLuckStatus] 服务已停止');
}

await mainLoop();
process.exit(0);