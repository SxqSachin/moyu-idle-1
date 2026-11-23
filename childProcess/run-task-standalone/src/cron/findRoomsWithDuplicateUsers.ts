import { getRoomKey, removeRoomKey, removeWorldBossRoomKey, kickUserFromRoom } from "../utils/game/room";
import { redisClient } from "../utils/redis";
import { removeBattleInfoFromRedis } from "../utils/game/battle";
import type { Room } from "~/shared/types/room";
import type { BattleRoom } from "~/shared/types/battleRoom";

interface DuplicateUserEntry {
  userId: string;
  roomCount: number;
  rooms: string[];
}

interface RoomDuplicateEntry {
  roomUuid: string;
  status?: Room["status"];
  type?: Room["type"];
  memberCount: number;
  duplicateMembers: string[];
  allMembers: string[];
  lastUpdateAt?: number;
}
async function scanRoomKeys(pattern = "ROOM_*"): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const res = await (redisClient as any).scan(cursor, { MATCH: pattern, COUNT: 1000 });
    if (Array.isArray(res)) {
      cursor = res[0] as string;
      const batch = (res[1] as string[]) || [];
      keys.push(...batch);
    } else {
      const next = (res as any).cursor || (res as any)[0] || "0";
      const batch = (res as any).keys || (res as any)[1] || [];
      cursor = next;
      keys.push(...batch);
    }
  } while (cursor !== "0");
  return keys;
}

async function getUserRoomUuid(userId: string): Promise<string | undefined> {
  const roomId = await redisClient.hGet("USER_ROOM_HASH", userId);
  return roomId || undefined;
}

async function loadAllRoomsFromRedis(): Promise<Room[]> {
  const keys = await scanRoomKeys("ROOM_*");
  if (keys.length === 0) return [];
  let values: (string | null)[] = [];
  try {
    if (typeof (redisClient as any).mGet === "function") {
      values = await (redisClient as any).mGet(keys);
    } else {
      values = await Promise.all(keys.map((k) => redisClient.get(k)));
    }
  } catch {
    values = await Promise.all(keys.map((k) => redisClient.get(k)));
  }
  const rooms: Room[] = [];
  for (let i = 0; i < keys.length; i++) {
    const raw = values[i];
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.uuid === "string") {
        rooms.push(parsed as Room);
      }
    } catch {
      // skip invalid JSON
    }
  }
  return rooms;
}

async function findRoomsWithDuplicateUsers() {
  console.log("[findRoomsWithDuplicateUsers] start");
  const rooms = await loadAllRoomsFromRedis();
  console.log(`[findRoomsWithDuplicateUsers] loaded ${rooms.length} rooms`);

  const roomIndex = new Map<string, Room>();
  for (const r of rooms) roomIndex.set(r.uuid, r);

  const userRooms = new Map<string, Set<string>>();
  for (const room of rooms) {
    const memberIds = Array.from(new Set(room.memberIds || []));
    for (const userId of memberIds) {
      const set = userRooms.get(userId) ?? new Set<string>();
      set.add(room.uuid);
      userRooms.set(userId, set);
    }
  }

  const duplicateUsers: DuplicateUserEntry[] = [];
  for (const [userId, roomSet] of userRooms.entries()) {
    if (roomSet.size <= 1) continue;
    duplicateUsers.push({
      userId,
      roomCount: roomSet.size,
      rooms: Array.from(roomSet),
    });
  }

  const roomsWithDuplicateUsers = new Map<string, Set<string>>();
  for (const dup of duplicateUsers) {
    for (const roomUuid of dup.rooms) {
      const set = roomsWithDuplicateUsers.get(roomUuid) ?? new Set<string>();
      set.add(dup.userId);
      roomsWithDuplicateUsers.set(roomUuid, set);
    }
  }

  const roomReport: RoomDuplicateEntry[] = [];
  for (const [roomUuid, dupUsers] of roomsWithDuplicateUsers.entries()) {
    const room = roomIndex.get(roomUuid);
    roomReport.push({
      roomUuid,
      status: room?.status,
      type: room?.type,
      memberCount: room?.memberIds?.length ?? 0,
      duplicateMembers: Array.from(dupUsers),
      allMembers: room?.memberIds ?? [],
      lastUpdateAt: room?.lastUpdateAt,
    });
  }

  roomReport.sort((a, b) => b.duplicateMembers.length - a.duplicateMembers.length || b.memberCount - a.memberCount);
  duplicateUsers.sort((a, b) => b.roomCount - a.roomCount);

  const report = {
    timestamp: Date.now(),
    totalRooms: rooms.length,
    duplicateUserCount: duplicateUsers.length,
    roomsWithDuplicateUsers: roomReport.length,
    duplicateUsers,
    rooms: roomReport,
  };

  console.log("[findRoomsWithDuplicateUsers] REPORT START");
  console.log(JSON.stringify(report, null, 2));
  console.log("[findRoomsWithDuplicateUsers] REPORT END");
  const removedRooms = new Set<string>();
  await cleanupSingleUserDuplicates(roomIndex, duplicateUsers, removedRooms);
  await cleanupExactMemberOverlapRooms(roomIndex, removedRooms);
  await cleanupPartialUserOverlaps(roomIndex, removedRooms);
  return report;
}

async function cleanupSingleUserDuplicates(roomIndex: Map<string, Room>, duplicateUsers: DuplicateUserEntry[], removedRooms: Set<string>) {
  // 策略：从USER_ROOM_HASH获取该用户的房间，如果有则保留，否则取第一个 battling 状态房间作为保留，其余房间如果只有这个用户则解散（含战斗清理）
  let usersHandled = 0;
  let roomsDisbanded = 0;

  for (const dup of duplicateUsers) {
    const userRooms: Room[] = [];
    for (const roomUuid of dup.rooms) {
      if (removedRooms.has(roomUuid)) continue;
      const room = roomIndex.get(roomUuid);
      if (!room) continue;
      userRooms.push(room);
    }

    if (userRooms.length === 0) continue;

    // 从哈希表获取保留房间
    const hashRoomUuid = await getUserRoomUuid(dup.userId);
    let keepRoom: Room | undefined;
    if (hashRoomUuid) {
      keepRoom = userRooms.find(r => r.uuid === hashRoomUuid);
    }
    if (!keepRoom) {
      keepRoom = userRooms.find(r => r.status === "battling");
    }
    const keepUuid = keepRoom?.uuid;

    for (const room of userRooms) {
      if (keepUuid && room.uuid === keepUuid) continue; // 保留指定房间

      const uniqMembers = Array.from(new Set(room.memberIds || []));
      if (uniqMembers.length === 1 && uniqMembers[0] === dup.userId) {
        await disbandRoom(room, [dup.userId]);
        removedRooms.add(room.uuid);
        roomsDisbanded++;
      }
    }

    usersHandled++;
    console.log(`[cleanup] user ${dup.userId} keep ${keepUuid ?? "(none)"}`);
  }

  console.log(`[cleanup] completed. usersHandled=${usersHandled}, roomsDisbanded=${roomsDisbanded}`);
}

async function cleanupExactMemberOverlapRooms(roomIndex: Map<string, Room>, removedRooms: Set<string>) {
  // 策略：成员完全相同的房间，只保留第一个 battling 状态房间，其余解散
  const groups = new Map<string, Room[]>();

  const normalizeMembers = (room: Room) => Array.from(new Set(room.memberIds || [])).sort();

  for (const [uuid, room] of roomIndex.entries()) {
    if (removedRooms.has(uuid)) continue;
    const members = normalizeMembers(room);
    if (members.length === 0) continue;
    const key = members.join("|");
    const list = groups.get(key) ?? [];
    list.push(room);
    groups.set(key, list);
  }

  let groupsHandled = 0;
  let roomsDisbanded = 0;

  for (const [, rooms] of groups.entries()) {
    if (rooms.length <= 1) continue;
    const keep = rooms.find(r => r.status === "battling");
    if (!keep) continue; // 没有正在战斗的，暂不处理

    for (const room of rooms) {
      if (room.uuid === keep.uuid) continue;
      if (removedRooms.has(room.uuid)) continue;
      await disbandRoom(room, normalizeMembers(room));
      removedRooms.add(room.uuid);
      roomsDisbanded++;
    }

    groupsHandled++;
    console.log(`[cleanup-overlap] keep=${keep.uuid} disbanded=${rooms.length - 1}`);
  }

  console.log(`[cleanup-overlap] completed. groupsHandled=${groupsHandled}, roomsDisbanded=${roomsDisbanded}`);
}

async function cleanupPartialUserOverlaps(roomIndex: Map<string, Room>, removedRooms: Set<string>) {
  // 策略：从USER_ROOM_HASH获取该用户的房间，如果有则保留，否则保留battling状态的房间，其他房间用 leaveRoom 移除该用户
  const userRooms = new Map<string, Room[]>();

  for (const [uuid, room] of roomIndex.entries()) {
    if (removedRooms.has(uuid)) continue;
    const members = Array.from(new Set(room.memberIds || []));
    for (const uid of members) {
      const list = userRooms.get(uid) ?? [];
      list.push(room);
      userRooms.set(uid, list);
    }
  }

  let usersHandled = 0;
  let leaves = 0;

  for (const [uid, rooms] of userRooms.entries()) {
    if (rooms.length <= 1) continue;

    // 从哈希表获取保留房间
    const hashRoomUuid = await getUserRoomUuid(uid);
    let keep: Room | undefined;
    if (hashRoomUuid) {
      keep = rooms.find(r => r.uuid === hashRoomUuid);
    }
    if (!keep) {
      // 如果哈希表中没有，保留battling的
      keep = rooms.find(r => r.status === "battling");
      if (!keep) {
        // 如果都没有battling，保留lastUpdateAt最新的
        keep = rooms.sort((a, b) => (b.lastUpdateAt || 0) - (a.lastUpdateAt || 0))[0];
      }
    }

    const toLeave = rooms.filter(r => r.uuid !== keep.uuid);

    for (const room of toLeave) {
      if (removedRooms.has(room.uuid)) continue;
      try {
        await kickUserFromRoom(room.ownerId, uid, room.uuid, true);
        leaves++;
        console.log(`[cleanup-partial] user ${uid} kicked from room ${room.uuid}`);
      } catch (e) {
        console.warn(`[cleanup-partial] kickUserFromRoom failed for user ${uid} room ${room.uuid}:`, (e as any)?.message ?? e);
      }
    }

    usersHandled++;
    console.log(`[cleanup-partial] user ${uid} keep ${keep.uuid}, left ${toLeave.length}`);
  }

  console.log(`[cleanup-partial] completed. usersHandled=${usersHandled}, leaves=${leaves}`);
}

async function disbandRoom(room: Room, userIds?: string[]) {
  const roomKey = getRoomKey(room.uuid);
  try {
    await removeRoomKey(room.uuid);
  } catch (e) {
    console.warn(`[cleanup] removeRoomKey failed for ${room.uuid}:`, (e as any)?.message ?? e);
  }

  // 世界 Boss 房间需要同时移除专用集合
  try {
    await removeWorldBossRoomKey(room);
  } catch (e) {
    console.warn(`[cleanup] removeWorldBossRoomKey failed for ${room.uuid}:`, (e as any)?.message ?? e);
  }

  // 删除房间主数据
  try {
    await redisClient.del(roomKey);
  } catch (e) {
    console.warn(`[cleanup] del room key failed for ${room.uuid}:`, (e as any)?.message ?? e);
  }

  // 清理用户映射（谨慎：仅当指向该房间时删除）
  const targets = userIds && userIds.length > 0 ? userIds : Array.from(new Set(room.memberIds || []));
  for (const uid of targets) {
    try {
      const userRoomKey = `USER_ROOM_${uid}`;
      const mapped = await redisClient.get(userRoomKey);
      if (mapped) {
        try {
          const parsed = JSON.parse(mapped) as { uuid?: string };
          if (parsed?.uuid === room.uuid) {
            await redisClient.del(userRoomKey);
          }
        } catch {
          await redisClient.del(userRoomKey);
        }
      }
    } catch (e) {
      console.warn(`[cleanup] user mapping cleanup failed for ${uid} room ${room.uuid}:`, (e as any)?.message ?? e);
    }
  }

  // 清理战斗信息
  if (!!(room as BattleRoom).battleUuid) {
    try {
      await removeBattleInfoFromRedis((room as BattleRoom).battleUuid!);
    } catch (e) {
      console.warn(`[cleanup] removeBattleInfo failed for room ${room.uuid}:`, (e as any)?.message ?? e);
    }
  }

  console.log(`[cleanup] disbanded room ${room.uuid}`);
}

await findRoomsWithDuplicateUsers();
process.exit(0);