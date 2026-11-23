import type { BattleRoom } from "~/shared/types/battleRoom";
import { getAllRooms, removeRoomKey, updateRoom } from "../utils/game/room";
import { redisClient } from "../utils/redis";
import { removeBattleInfoFromRedis } from "../utils/game/battle";
import { emitEventToUser } from "../utils/game/msgQueue";

const restartBattle = async function(roomInfo: BattleRoom) {
    if (!roomInfo) {
      return;
    }

    roomInfo.beForceRestart = true;

    await updateRoom(roomInfo.uuid, roomInfo);
}

async function clearNightmarePrisonRooms() {
  // 获取所有房间
  const rooms = await getAllRooms<BattleRoom>();
  // 找到所有正在噩梦监狱的房间
  const toRemove = rooms.filter((room) => room.area === "cat_dungeon_002" || room.area == 'forbidden_library' || room.area == 'nightmare_prison');

  for (const room of toRemove) {
    try {
      await restartBattle(room);

      if (room.battleUuid) {
        console.log(`[clear12Room] 移除战斗: ${room.uuid}`);
        await removeBattleInfoFromRedis(room.battleUuid);
      }
    } catch (e) {
      console.error(
        `[clear12Room] 清理房间 ${room.uuid} 时发生错误:`,
        // @ts-expect-error
        e?.message ?? "error"
      );
    }
  }

  //   for (const room of toRemove) {
  //     // 删除房间主数据
  //     await redisClient.del(`ROOM_${room.uuid}`)
  //     // 删除房间key集合
  //     await removeRoomKey(room.uuid)
  //     // 删除所有成员的 userRoomKey
  //     for (const memberId of room.memberIds ?? []) {
  //       await redisClient.del(`USER_ROOM_${memberId}`)
  //     }
  //     console.log(`房间 ${room.uuid} 已解散`)
  //   }
}

await clearNightmarePrisonRooms();
console.log("噩梦监狱房间清理完成");
process.exit(0);
