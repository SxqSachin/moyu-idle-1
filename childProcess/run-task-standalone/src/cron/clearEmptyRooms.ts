import type { Room } from "~/shared/types/room";
import { getAllRooms, removeRoomKey } from "../utils/game/room";
import { getAllBattleRooms } from "../utils/game/battle";
import { redisClient } from "../utils/redis";
import { removeBattleInfoFromRedis } from "../utils/game/battle";

async function clearEmptyMemberRooms() {
  // 获取所有房间
  const rooms = await getAllBattleRooms();
  // 过滤出 memberIds 为空或未定义的房间
  const toRemove = rooms.filter((room) => !room.memberIds || room.memberIds.length === 0);

  for (const room of toRemove) {
    try {
      // 从房间集合移除
      await removeRoomKey(room.uuid);

      // 删除房间主数据
      await redisClient.del(`ROOM_${room.uuid}`);

      // 清理所有成员的 userRoomKey（虽然为空，这里保持逻辑完整性）
      for (const memberId of room.memberIds || []) {
        await redisClient.del(`USER_ROOM_${memberId}`);
      }

      // 清理关联战斗信息
      if (room.battleUuid) {
        console.log(`[clearEmptyRooms] 移除战斗: ${room.uuid}`);
        await removeBattleInfoFromRedis(room.battleUuid);
      }

      console.log(`[clearEmptyRooms] 已删除空房间: ${room.uuid}`);
    } catch (e) {
      console.error(
        `[clearEmptyRooms] 清理房间 ${room.uuid} 时发生错误:`,
        // @ts-expect-error
        e?.message ?? "error"
      );
    }
  }

  console.log(`空房间清理完成，数量: ${toRemove.length}`);
}

await clearEmptyMemberRooms();
process.exit(0);
