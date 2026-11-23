import { randomNumberInFullColseRange } from "~/shared/utils";
import { modifyKittyMood, modifyKittyMaxMood } from "../utils/game/kittyMood";
import { prisma } from "../utils/prisma";
import pLimit from 'p-limit';

// 并发来自环境变量，可通过 ecosystem 配置覆盖
const CONCURRENCY = parseInt(process.env.KITTY_MOOD_CONCURRENCY ?? '100', 10) || 100;

let lastExecutedHour: number | null = null;
let running = true;
process.on("SIGINT", () => {
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});

// 使用已安装的 p-limit 库来限制并发

async function runOnceWithPLimit() {
  // 读取被封禁的 owner 列表
  const banned = await prisma.user.findMany({ where: { is_banned: true }, select: { uuid: true } });
  const bannedOwners = banned.map((b) => b.uuid);

  // 直接查询所有 kitty（仅选择必要字段）。注意：在 50k 左右条目下，这次查询会返回较大的数组，但后续操作由并发器控制。
  const where: any = {};
  if (bannedOwners.length) where.owner = { notIn: bannedOwners };

  const allKitties = await prisma.kitty.findMany({ where, select: { owner: true, uuid: true, is_working: true, mood: true, max_mood: true } });
  console.log(`[KittyMood] 拉取到猫咪数量: ${allKitties.length}`);

  const allKittyFurniture = await prisma.userKittyFurniture.findMany({
    where: { is_active: true, furniture_id: 'silkCurtain' },
    select: { user_uuid: true, furniture_id: true },
  });
  const usersWithSilkCurtain = new Set(allKittyFurniture.map((f) => f.user_uuid));

  let processed = 0;

  const dateNowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
  const dateHour = new Date(dateNowStr).getHours();
  const isNight = (dateHour >= 19 || dateHour < 6);

  for (const k of allKitties) {
    const isWorking = !!k.is_working;
    // const mood = k.mood ?? 0;
    // const maxMood = k.max_mood ?? 100;

    // if (isWorking && mood <= 0) return;
    // if (!isWorking && mood >= maxMood) return;

    try {
      if (isWorking) {
        let moodDecrease = 1.5;

        if (usersWithSilkCurtain.has(k.owner)) {
          moodDecrease -= 0.3;
        }

        await modifyKittyMood(k.uuid, moodDecrease, "工作消耗");
      } else {
        await modifyKittyMood(k.uuid, 5, "休息恢复");

        if (usersWithSilkCurtain.has(k.owner)) {
          // 有丝绸窗帘家具，额外恢复1点心情
          await modifyKittyMood(k.uuid, 15, "遮光窗帘，休息时额外心情恢复");
        }
      }

      if (
        isNight &&
        usersWithSilkCurtain.has(k.owner) &&
        randomNumberInFullColseRange(0, 1) < 0.07
      ) {
        // 夜间有20%概率额外恢复1点心情
        await modifyKittyMood(k.uuid, 1, "遮光窗帘，夜间额外心情恢复");
      }

      // 超过上限的部分，每次降低5点心情，直到回到上限为止
      if (k.mood > k.max_mood) {
        const excess = k.mood - k.max_mood;
        const reduce = Math.min(5, excess);
        await modifyKittyMood(k.uuid, -reduce, "心情值超过当前上限");
      }

      // 心情上限超过100，每次降低2，直到回到100为止
      if (k.max_mood > 100) {
        const excessMax = k.max_mood - 100;
        const reduceMax = Math.min(2, excessMax);
        await modifyKittyMaxMood(k.uuid, -reduceMax, "心情上限超过基础值");
      }

      processed++;
    } catch (err: any) {
      console.error(
        "[KittyMood] update failed for",
        k.uuid,
        err?.message ?? err,
      );
    }
  }

  console.log(`[KittyMood] 本次更新完成，处理猫咪数量: ${processed}`);
}

async function mainLoop() {
  console.log('[KittyMood] 小时心情更新服务已启动（并发控制模式）');
  while (running) {
    try {
      const now = new Date();
      const currentHour = now.getHours();

      if (lastExecutedHour !== currentHour) {
        console.log(`[KittyMood] 小时变更 ${currentHour}:00，开始更新 - ${now.toLocaleString()}`);
        await runOnceWithPLimit();
        lastExecutedHour = currentHour;
      }

      // 每分钟检查一次小时变更
      await new Promise((resolve) => setTimeout(resolve, 1000 * 60));
    } catch (e: any) {
      console.error('[KittyMood] 主循环发生错误', e?.message ?? e);
      await new Promise((resolve) => setTimeout(resolve, 1000 * 30));
    }
  }
  console.log('[KittyMood] 服务已关闭');
}

await mainLoop();
process.exit(0);
