import { redisClient } from "../utils/redis";
import { listWorldBossRoomListKeys, getRoomKey, getWorldBossRoomListKey, publishBattleRoomEvent } from "../utils/game/room";
import { mGetChunked } from "../utils/redisHelpers";
import type { Room } from "~/shared/types/room";

async function syncRoomKeys() {
  console.log('[syncRoomKeys] starting');

  try {
    // 1) clear ALL_ROOM_KEYS
    // await redisClient.del('ALL_ROOM_KEYS');
    // console.log('[syncRoomKeys] cleared ALL_ROOM_KEYS');

    // // 2) clear all WORLD_BOSS_ROOM_LIST_* keys
    const bossListKeys = await listWorldBossRoomListKeys();
    // for (const k of bossListKeys) {
    //   await redisClient.del(k);
    // }
    // console.log('[syncRoomKeys] cleared', bossListKeys.length, 'WORLD_BOSS_ROOM_LIST_* keys');

    // 3) scan all ROOM_* keys and build in-memory plan
    let cursor = '0';
    let totalScanned = 0;
    let totalInvalid = 0;
    const keysToDelete: string[] = [];
    const normalRoomKeys = new Set<string>(); // full redis key strings
    const bossRoomMap = new Map<string, Set<string>>(); // bossId -> set of room keys
    const normalRoomEventMap = new Map<string, Room>(); // uuid -> room for upsert
    const removedNormalRooms = new Map<string, Room>(); // uuid -> room for remove

    const BATCH = 100;
    const FETCH_CHUNK = Math.min(BATCH, 128);

    do {
      const { cursor: next, keys } = await redisClient.SCAN(cursor, { MATCH: 'ROOM_*', COUNT: BATCH });
      cursor = next;
      if (!Array.isArray(keys) || keys.length === 0) continue;

      // fetch values in chunks
      for (let i = 0; i < keys.length; i += FETCH_CHUNK) {
        const slice = keys.slice(i, i + FETCH_CHUNK);
        const vals = await mGetChunked(redisClient, slice, FETCH_CHUNK);

        for (let j = 0; j < slice.length; j++) {
          totalScanned++;
          const key = slice[j];
          const val = vals[j];

          if (!val) {
            keysToDelete.push(key);
            totalInvalid++;
            continue;
          }

          let room: Room | undefined;
          try {
            room = JSON.parse(val as string) as Room;
          } catch (e) {
            keysToDelete.push(key);
            totalInvalid++;
            continue;
          }

          if (!room || !room.uuid) {
            keysToDelete.push(key);
            totalInvalid++;
            continue;
          }

          if (!Array.isArray(room.memberIds) || room.memberIds.length === 0) {
            keysToDelete.push(key);
            totalInvalid++;
            if (room.uuid && room.type === 'battle' && (room as any).battleType !== 'worldBoss') {
              removedNormalRooms.set(room.uuid, room);
            }
            continue;
          }

          const roomKey = getRoomKey(room.uuid);
          if ((room as any).battleType === 'worldBoss' && (room as any).worldBossId) {
            const set = bossRoomMap.get((room as any).worldBossId as string) || new Set<string>();
            set.add(roomKey);
            bossRoomMap.set((room as any).worldBossId as string, set);
          } else {
            normalRoomKeys.add(roomKey);
            if (room.type === 'battle') {
              normalRoomEventMap.set(room.uuid, room);
            }
          }
        }
      }
    } while (cursor !== '0');

    // 4) apply changes in batches: delete invalid keys, clear ALL_ROOM_KEYS and WORLD_BOSS lists, then repopulate
    console.log('[syncRoomKeys] scan finished', { totalScanned, totalInvalid, normalRooms: normalRoomKeys.size, bossGroups: bossRoomMap.size });

    // delete invalid ROOM_* keys in chunks
    const CHUNK = 500;
    for (let i = 0; i < keysToDelete.length; i += CHUNK) {
      const slice = keysToDelete.slice(i, i + CHUNK);
      if (slice.length === 1) await redisClient.del(slice[0]);
      else if (slice.length > 1) await redisClient.del(slice);
    }

    // apply: append fresh full data; sets天然去重，无需清空 ALL_ROOM_KEYS
    const pipeline = redisClient.multi();

    if (normalRoomKeys.size > 0) {
      const arr = Array.from(normalRoomKeys);
      pipeline.sAdd('ALL_ROOM_KEYS', arr);
    }

    // boss 列表改用 set，重建避免老数据遗留
    if (bossListKeys.length > 0) pipeline.del(bossListKeys);
    for (const [bossId, set] of bossRoomMap.entries()) {
      const listKey = getWorldBossRoomListKey(bossId);
      if (set.size > 0) {
        const arr = Array.from(set);
        pipeline.sAdd(listKey, arr);
      }
    }

    await pipeline.exec();

    // 发布非 worldBoss 房间的变动事件
    for (const room of removedNormalRooms.values()) {
      await publishBattleRoomEvent(room, 'remove');
    }
    for (const room of normalRoomEventMap.values()) {
      await publishBattleRoomEvent(room, 'upsert');
    }

    console.log('[syncRoomKeys] apply finished');
  } catch (err) {
    console.error('[syncRoomKeys] error', err);
    process.exit(1);
  }

  process.exit(0);
}

await syncRoomKeys();
