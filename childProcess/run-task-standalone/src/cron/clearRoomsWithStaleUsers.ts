import { getAllRooms, removeRoomKey, kickUserFromRoom, getRoomById, getRoomKey, getUserRoomKey } from "../utils/game/room";
import { redisClient } from "../utils/redis";
import { removeBattleInfoFromRedis } from "../utils/game/battle";
import type { BattleRoom } from "~/shared/types/battleRoom";
import { prisma } from "../utils/prisma";

// Persistent scheduler: run cleanup once per day at midnight.
// Hardcoded service configuration (no env vars / compatibility concerns):
const DEFAULT_INACTIVE_DAYS = 7;
const RUN_ON_STARTUP = true; // run once immediately on service start

async function getAllStaleUserUuids(days: number = DEFAULT_INACTIVE_DAYS): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const users = await prisma.user.findMany({
      where: {
        is_gm: false,
        last_online_date: { lt: cutoff },
      },
      select: { uuid: true },
    });

    for (const u of users) set.add(u.uuid);
  } catch (e: any) {
    console.error('[clearRoomsWithStaleUsers] 预加载过期用户失败:', e?.message ?? String(e));
  }

  return set;
}

async function clearRoomsWithStaleUsers(days: number = DEFAULT_INACTIVE_DAYS) {
  console.log(`[clearRoomsWithStaleUsers] start run (days=${days})`);
  const rooms = await getAllRooms<BattleRoom>();
  const staleSet = await getAllStaleUserUuids(days);

  // Helper: remove both battle info and room keys for a given room
  async function removeRoomAndBattle(roomUuid: string, battleUuid?: string) {
    try {
      if (battleUuid) {
        console.log(`[clearRoomsWithStaleUsers] removing battle ${battleUuid} for room ${roomUuid}`);
        await removeBattleInfoFromRedis(battleUuid);
      }
    } catch (e: any) {
      console.error(`[clearRoomsWithStaleUsers] failed to remove battle ${battleUuid} for room ${roomUuid}:`, e?.message ?? String(e));
    }

    try {
      await removeRoomKey(roomUuid);
      const roomKey = getRoomKey(roomUuid);
      await redisClient.del(roomKey);
      console.log(`[clearRoomsWithStaleUsers] removed room ${roomUuid}`);
    } catch (e: any) {
      console.error(`[clearRoomsWithStaleUsers] failed to remove room ${roomUuid}:`, e?.message ?? String(e));
    }
  }

  // Helper: kick stale members from a room (uses gm=true to bypass checks)
  async function kickStaleMembersFromRoom(room: BattleRoom, staleMembers: string[]) {
    for (const staleMember of staleMembers) {
      try {
        await kickUserFromRoom(room.ownerId, staleMember, room.uuid, true);
        console.log(`[clearRoomsWithStaleUsers] kicked stale user ${staleMember} from room ${room.uuid}`);
      } catch (e: any) {
        console.error(`[clearRoomsWithStaleUsers] failed to kick user ${staleMember} from room ${room.uuid}:`, e?.message ?? String(e));
        // 兜底：删除该用户的 USER_ROOM_ 映射，避免残留
        try {
          const key = getUserRoomKey(staleMember);
          await redisClient.del(key);
          console.log(`[clearRoomsWithStaleUsers] cleaned USER_ROOM_${staleMember}`);
        } catch (er: any) {
          console.error(`[clearRoomsWithStaleUsers] failed to cleanup USER_ROOM_${staleMember}:`, er?.message ?? String(er));
        }
      }
    }
  }

  for (const room of rooms) {
    try {
      // 1) 初次检查：房间为空则直接删除房间与战斗
      if (!room.memberIds || room.memberIds.length === 0) {
        console.log(`[clearRoomsWithStaleUsers] room ${room.uuid} is empty, removing`);
        await removeRoomAndBattle(room.uuid, room.battleUuid);
        continue;
      }

      // 2) 检查并踢出超过阈值未上线的玩家
      const staleMembers = (room.memberIds || []).filter(m => staleSet.has(m));
      if (staleMembers.length > 0) {
        console.log(`[clearRoomsWithStaleUsers] room ${room.uuid} has stale members: ${staleMembers.join(',')}`);
        await kickStaleMembersFromRoom(room, staleMembers);
      }

      // 3) 最后再检查一次：若房间已无活跃玩家，则清理房间与战斗
      const latestRoom = await getRoomById<BattleRoom>(room.uuid);
      if (!latestRoom || (latestRoom.memberIds?.length ?? 0) === 0) {
        console.log(`[clearRoomsWithStaleUsers] after cleanup room ${room.uuid} has no active members, removing`);
        await removeRoomAndBattle(room.uuid, room.battleUuid);
      }
    } catch (e: any) {
      console.error(`[clearRoomsWithStaleUsers] error while processing room ${room.uuid}:`, e?.message ?? String(e));
    }
  }

  console.log(`[clearRoomsWithStaleUsers] run completed.`);
}

function msUntilNextMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

let shuttingDown = false;
async function mainLoop() {
  try {
    if (RUN_ON_STARTUP) {
      await clearRoomsWithStaleUsers(DEFAULT_INACTIVE_DAYS);
    }

    while (!shuttingDown) {
      const waitMs = msUntilNextMidnight();
      console.log(`[clearRoomsWithStaleUsers] sleeping ${Math.round(waitMs / 1000)}s until next midnight`);
      await sleep(waitMs + 1000); // small buffer
      if (shuttingDown) break;
      await clearRoomsWithStaleUsers(DEFAULT_INACTIVE_DAYS);
    }
  } catch (err: any) {
    console.error('[clearRoomsWithStaleUsers] fatal error in mainLoop:', err?.message ?? String(err));
  } finally {
    try {
      await prisma.$disconnect();
    } catch (e) {}
    if (!shuttingDown) process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('clearRoomsWithStaleUsers received SIGINT, shutting down');
  shuttingDown = true;
  // let loop exit gracefully
});
process.on('SIGTERM', async () => {
  console.log('clearRoomsWithStaleUsers received SIGTERM, shutting down');
  shuttingDown = true;
});

mainLoop();
