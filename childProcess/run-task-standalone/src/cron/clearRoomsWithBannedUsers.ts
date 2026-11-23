import { getAllRooms, removeRoomKey } from "../utils/game/room";
import { redisClient } from "../utils/redis";
import { removeBattleInfoFromRedis } from "../utils/game/battle";
import type { BattleRoom } from "~/shared/types/battleRoom";
import { prisma } from "../utils/prisma";

// 预加载所有被封禁用户 UUID，避免逐个查询
async function getAllBannedUserUuids(): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const users = await prisma.user.findMany({
      where: { is_banned: true },
      select: { uuid: true },
    });
    for (const u of users) set.add(u.uuid);
  } catch (e: any) {
    console.error('[clearRoomsWithBannedUsers] 预加载封禁用户失败:', e?.message ?? String(e));
  }
  // 兼容：并入 Redis 集合中的封禁用户（如存在）
  return set;
}

async function clearRoomsWithBannedUsers() {
  const rooms = await getAllRooms<BattleRoom>();
  const toRemove: BattleRoom[] = [];
  const bannedSet = await getAllBannedUserUuids();

  for (const room of rooms) {
    const members = room.memberIds || [];
    if (members.length === 0) continue;
    // O(n) 集合查找：避免逐成员 IO
    if (members.some(m => bannedSet.has(m))) {
      toRemove.push(room);
    }
  }

  for (const room of toRemove) {
    try {
      console.log(`[clearRoomsWithBannedUsers] 清理房间: ${room.uuid}，成员: ${room.memberIds?.join(',')}`);
      // 删除房间集合索引
      await removeRoomKey(room.uuid);
      // 删除房间主数据
      await redisClient.del(`ROOM_${room.uuid}`);
      // 删除所有成员的用户房间映射
      for (const memberId of room.memberIds || []) {
        await redisClient.del(`USER_ROOM_${memberId}`);
      }
      // 删除战斗信息（如有）
      if (room.battleUuid) {
        await removeBattleInfoFromRedis(room.battleUuid);
      }
    } catch (e: any) {
      console.error(`[clearRoomsWithBannedUsers] 清理房间 ${room.uuid} 时发生错误:`, e?.message ?? String(e));
    }
  }
}

try {
  await clearRoomsWithBannedUsers();
  console.log("包含封禁用户的房间清理完成");
} finally {
  await prisma.$disconnect();
}
process.exit(0);
