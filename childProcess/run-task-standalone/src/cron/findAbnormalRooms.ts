import { redisClient } from "../utils/redis";
import type { Room } from "~/shared/types/room";

interface DuplicateUserEntry {
  userId: string;
  roomCount: number;
  rooms: string[];
}

interface AbnormalRoomEntry {
  roomUuid: string;
  status?: Room["status"];
  type?: Room["type"];
  memberCount: number;
  duplicateMembers: string[];
  allMembers: string[];
  isEmpty: boolean;
  lastUpdateAt?: number;
  createdAt?: number;
}

async function scanRoomKeys(pattern = "ROOM_*"): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const res = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 1000 } as any);
    // Some clients return [nextCursor, keys]; others an object. Normalize.
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

async function loadAllRoomsFromRedis(): Promise<Room[]> {
  const keys = await scanRoomKeys("ROOM_*");
  if (keys.length === 0) return [];
  const values = await redisClient.mGet(keys);
  const rooms: Room[] = [];
  for (let i = 0; i < keys.length; i++) {
    const raw = values[i];
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      // Basic sanity: must have uuid and memberIds
      if (parsed && typeof parsed.uuid === "string") {
        rooms.push(parsed as Room);
      }
    } catch {
      // skip invalid JSON
    }
  }
  return rooms;
}

async function findAbnormalRooms() {
  console.log("[findAbnormalRooms] start");
  const rooms = await loadAllRoomsFromRedis();
  console.log(`[findAbnormalRooms] loaded ${rooms.length} rooms`);

  const roomIndex = new Map<string, Room>();
  for (const r of rooms) roomIndex.set(r.uuid, r);

  // Build user -> rooms index
  const userRooms = new Map<string, Set<string>>();
  for (const room of rooms) {
    const memberIds = Array.from(new Set(room.memberIds || []));
    for (const userId of memberIds) {
      const set = userRooms.get(userId) ?? new Set<string>();
      set.add(room.uuid);
      userRooms.set(userId, set);
    }
  }

  // Users that appear in more than one room
  const duplicateUsers: DuplicateUserEntry[] = [];
  for (const [userId, roomSet] of userRooms.entries()) {
    if (roomSet.size <= 1) continue;
    duplicateUsers.push({
      userId,
      roomCount: roomSet.size,
      rooms: Array.from(roomSet),
    });
  }
  duplicateUsers.sort((a, b) => b.roomCount - a.roomCount);

  // Map rooms that have at least one duplicate user
  const roomsWithDuplicateUsers = new Map<string, Set<string>>();
  for (const dup of duplicateUsers) {
    for (const roomUuid of dup.rooms) {
      const set = roomsWithDuplicateUsers.get(roomUuid) ?? new Set<string>();
      set.add(dup.userId);
      roomsWithDuplicateUsers.set(roomUuid, set);
    }
  }

  // Build abnormal room report: empty rooms or rooms with duplicate members
  const abnormalRooms: AbnormalRoomEntry[] = [];
  for (const [uuid, room] of roomIndex.entries()) {
    const members = Array.from(new Set(room.memberIds || []));
    const duplicateMembers = Array.from(roomsWithDuplicateUsers.get(uuid) ?? new Set<string>());
    const isEmpty = members.length === 0;
    if (!isEmpty && duplicateMembers.length === 0) continue; // only collect abnormal

    abnormalRooms.push({
      roomUuid: uuid,
      status: room.status,
      type: room.type,
      memberCount: members.length,
      duplicateMembers,
      allMembers: members,
      isEmpty,
      lastUpdateAt: room.lastUpdateAt,
      createdAt: (room as any).createdAt,
    });
  }

  abnormalRooms.sort((a, b) => {
    // Prefer rooms with more duplicate members, then more members, then newest update
    const dupDiff = b.duplicateMembers.length - a.duplicateMembers.length;
    if (dupDiff !== 0) return dupDiff;
    const memDiff = b.memberCount - a.memberCount;
    if (memDiff !== 0) return memDiff;
    const aT = a.lastUpdateAt || a.createdAt || 0;
    const bT = b.lastUpdateAt || b.createdAt || 0;
    return bT - aT;
  });

  const emptyRoomCount = abnormalRooms.filter(r => r.isEmpty).length;
  const report = {
    timestamp: Date.now(),
    totalRooms: rooms.length,
    duplicateUserCount: duplicateUsers.length,
    roomsWithDuplicateUsers: roomsWithDuplicateUsers.size,
    emptyRoomCount,
    duplicateUsers,
    rooms: abnormalRooms,
  };

  console.log("[findAbnormalRooms] REPORT START");
  console.log(JSON.stringify(report, null, 2));
  console.log("[findAbnormalRooms] REPORT END");

  return report;
}

await findAbnormalRooms();
process.exit(0);
