import type { BattleRoom } from "~/shared/types/battleRoom";
import { getAllRooms, removeRoomKey } from "../utils/game/room";
import { redisClient } from "../utils/redis";
import { removeBattleInfoFromRedis } from "../utils/game/battle";

const IDLE_THRESHOLD = 4 * 60 * 60 * 1000; // 4小时未活跃
const CHECK_INTERVAL = 60 * 60 * 1000; // 每小时检查一次

const CREATE_DURATION = 8 * 60 * 60 * 1000; // 创建后8小时内未开始的房间视为闲置

let running = true;

process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function clearIdleRooms() {
  const now = Date.now();
  const allRooms = await getAllRooms<BattleRoom>();
  let cleared = 0;

  for (const room of allRooms) {
    try {
      if (
        room.name?.endsWith("的原闲") && !room.isPublic
      ) {
        // 创建后1小时内未开始的房间视为闲置
        await redisClient.del(`ROOM_${room.uuid}`);
        for (const memberId of room.memberIds || []) {
          await redisClient.del(`USER_ROOM_${memberId}`);
        }

        if (room.battleUuid) {

          console.log(`[clearIdleRoom] 移除战斗: ${room.uuid}`);
          await removeBattleInfoFromRedis(room.battleUuid);
        }

        await removeRoomKey(room.uuid); // 确保从集合中移除
        cleared++;
        console.log(`[clearIdleRoom] 已清理悠闲房间: ${room.uuid}`);
        continue;
      }
    } catch (e) {
      // @ts-expect-error
      console.error(`[clearIdleRoom] 清理房间 ${room.uuid} 时发生错误:`, e?.message ?? "error");
    }
  }
  if (cleared > 0) {
    console.log(`[clearIdleRoom] 本次共清理 ${cleared} 个闲置房间`);
  } else {
    console.log(`[clearIdleRoom] 没有发现需要清理的闲置房间`);
  }
}

async function mainLoop() {
  console.log(`[clearIdleRoom] 定时清理服务启动，每小时检查一次...`);
  while (running) {
    try {
      await clearIdleRooms();
    } catch (e) {
      console.error('[clearIdleRoom] 清理过程中发生错误:', e);
    }
    for (let i = 0; i < CHECK_INTERVAL / 1000 && running; i++) {
      await new Promise(res => setTimeout(res, 1000));
    }
  }
  console.log('[clearIdleRoom] 服务已停止');
}

await mainLoop();
process.exit(0);