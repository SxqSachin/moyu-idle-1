import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { getAllKittyByOwner } from "../utils/game/kitty";
import { addKittyEssay } from "../utils/game/kittyEssay";
import { increaseItemCount } from "../utils/game/characterInventory";
import { prisma } from "../utils/prisma";
import { MAX_OFFLINE_HOUR } from "~/shared/data/constant";

const EXECUTION_HOURS = [9, 13, 19, 21];
let lastExecutedHour: number | null = null;

let running = true;
process.on("SIGINT", () => {
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});

async function run() {
  let allUser = await prisma.user.findMany({
    select: {
      uuid: true,
      last_online_date: true,
    },
    where: {
      is_banned: false,
    },
  });

  for (const user of allUser) {
    // 如果离线超过3天，不发送
    const lastOnline = user.last_online_date?.getTime() || 0;
    const offlineMs = MAX_OFFLINE_HOUR * 3600 * 1000;
    if (Date.now() - lastOnline > offlineMs) {
      continue;
    }

    let allKittyAboutUser = await getAllKittyByOwner(user.uuid);

    for (const kitty of allKittyAboutUser) {
    //   if (kitty.mood < 100) {
    //     continue;
    //   }

    // 如果现在是15点，则需要检查心情
    if (new Date().getHours() === 13) {
      if (kitty.mood < 90) {
        continue;
      }
    }

    if (new Date().getHours() === 19) {
      if (kitty.mood < 130) {
        continue;
      }
    }

      const description = `${kitty.name} 今天很开心`;
      await addKittyEssay(kitty, description, {
        action: kitty.actionId,
      });

      await increaseItemCount(
        kitty.owner,
        {
          cutePoint: {
            count: 1,
          },
        },
        {
          actionName: description,
          type: ModifyItemCountType.KittySpecialAction,
          showModifyInfo: true,
        }
      );
    }
  }
}

async function mainLoop() {
  console.log("[KittyMood] 服务已启动");
  while (running) {
    const now = new Date();
    const currentHour = now.getHours();
    
    if (
      EXECUTION_HOURS.includes(currentHour) &&
      lastExecutedHour !== currentHour
    ) {
      console.log(
        `[KittyMood] 到达执行时间点 ${currentHour}:00，开始执行 - ${now.toLocaleString()}`
      );
      await run();
      console.log(
        `[KittyMood] ${currentHour}:00，执行完毕 - ${now.toLocaleString()}`
      );
      lastExecutedHour = currentHour;
    }

    // 重置执行记录（跨天时）
    if (currentHour === 0 && lastExecutedHour !== 0) {
      lastExecutedHour = null;
    }

    // 每分钟检查一次
    await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 15));
  }
  console.log("[KittyMood] 服务已关闭");
}

await mainLoop();
process.exit(0);
