import { getAllRooms, getRoomById, updateRoom, getUserRoomKey } from "../utils/game/room";
import { redisClient } from "../utils/redis";
import { leaveBattle } from "../utils/game/battle";
import type { BattleRoom } from "~/shared/types/battleRoom";

/**
 * 一次性脚本：清理同时处于多个战斗（battling）的玩家
 * 策略：对同时出现在多个正在战斗房间的玩家，保留最近活跃的一个房间，
 * 并从其它房间中强制移除该玩家（GM 模式）。
 */
async function clearPlayersInMultipleBattles() {
  console.log('[clearPlayersInMultipleBattles] start');
  const rooms = await getAllRooms<BattleRoom>();

  // 仅统计处于战斗中的房间
  const battlingRooms = rooms.filter(r => r.status === 'battling' || (!!r.battleUuid));

  const userRoomsMap = new Map<string, BattleRoom[]>();

  for (const room of battlingRooms) {
    for (const memberId of room.memberIds || []) {
      const arr = userRoomsMap.get(memberId) || [];
      arr.push(room);
      userRoomsMap.set(memberId, arr);
    }
  }

  let totalFixed = 0;

  // Reporting mode: collect users who are in multiple battling rooms and the
  // rooms that would be impacted. Do NOT perform any destructive operations.
  const duplicateUsers: Record<string, { rooms: { uuid: string; battleUuid?: string; lastUpdateAt?: number }[] }> = {};
  const roomsToDisband = new Set<string>();

  for (const [user, userRooms] of userRoomsMap) {
    if (userRooms.length <= 1) continue;
    duplicateUsers[user] = {
      rooms: userRooms.map(r => ({ uuid: r.uuid, battleUuid: r.battleUuid, lastUpdateAt: r.lastUpdateAt }))
    };
    for (const r of userRooms) roomsToDisband.add(r.uuid);
  }

  const roomsReport: Record<string, { memberCount: number; members: string[]; battleUuid?: string; lastUpdateAt?: number }> = {};
  for (const roomUuid of roomsToDisband) {
    const room = await getRoomById<BattleRoom>(roomUuid);
    if (!room) continue;
    roomsReport[roomUuid] = {
      memberCount: (room.memberIds || []).length,
      members: room.memberIds || [],
      battleUuid: room.battleUuid,
      lastUpdateAt: room.lastUpdateAt,
    };
  }

  const report = {
    timestamp: Date.now(),
    duplicateUserCount: Object.keys(duplicateUsers).length,
    duplicateUsers,
    roomsToDisbandCount: roomsToDisband.size,
    roomsReport,
  };

  console.log('[clearPlayersInMultipleBattles] REPORT START');
  console.log(JSON.stringify(report, null, 2));
  console.log('[clearPlayersInMultipleBattles] REPORT END');

  // Now perform removal: for each duplicate user, remove them from all listed rooms
  for (const user of Object.keys(duplicateUsers)) {
    const userRooms = duplicateUsers[user].rooms;
    for (const r of userRooms) {
      try {
        // 1) try to leave battle (non-destructive if user not in battle)
        try {
          await leaveBattle(user, r.uuid);
          console.log(`[clearPlayersInMultipleBattles] leaveBattle succeeded for user ${user} room ${r.uuid}`);
        } catch (e: any) {
          console.warn(`[clearPlayersInMultipleBattles] leaveBattle warning for user ${user} room ${r.uuid}:`, e?.message ?? String(e));
        }

        // 2) remove from room member list and update
        const latestRoom = await getRoomById<BattleRoom>(r.uuid);
        if (!latestRoom) {
          console.log(`[clearPlayersInMultipleBattles] room ${r.uuid} no longer exists`);
          continue;
        }

        if ((latestRoom.memberIds || []).includes(user)) {
          latestRoom.memberIds = latestRoom.memberIds.filter(id => id !== user);
          if (latestRoom.readyMap) delete latestRoom.readyMap[user];
          await updateRoom(latestRoom.uuid, latestRoom as any);
          console.log(`[clearPlayersInMultipleBattles] removed user ${user} from room ${r.uuid}`);
        } else {
          console.log(`[clearPlayersInMultipleBattles] user ${user} not present in room ${r.uuid}`);
        }

        // 3) cleanup USER_ROOM_ mapping if it points to this room
        try {
          const userRoomKey = getUserRoomKey(user);
          const mapped = await redisClient.get(userRoomKey);
          if (mapped) {
            try {
              const parsed = JSON.parse(mapped) as { uuid?: string };
              if (parsed?.uuid === r.uuid) {
                await redisClient.del(userRoomKey);
                console.log(`[clearPlayersInMultipleBattles] deleted USER_ROOM_ mapping for ${user}`);
              }
            } catch (er) {
              // malformed mapping: delete to be safe
              await redisClient.del(userRoomKey);
              console.log(`[clearPlayersInMultipleBattles] deleted malformed USER_ROOM_ mapping for ${user}`);
            }
          }
        } catch (er: any) {
          console.warn(`[clearPlayersInMultipleBattles] failed to cleanup USER_ROOM_ for ${user}:`, er?.message ?? String(er));
        }

        totalFixed++;
      } catch (e: any) {
        console.error(`[clearPlayersInMultipleBattles] failed to remove user ${user} from room ${r.uuid}:`, e?.message ?? String(e));
      }
    }
  }

  console.log(`[clearPlayersInMultipleBattles] completed. total removed entries: ${totalFixed}`);
}

// run once
await clearPlayersInMultipleBattles();
process.exit(0);
