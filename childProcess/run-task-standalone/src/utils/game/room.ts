import { createTimingProbe } from "./timing";
import { v4 as uuidv4 } from "uuid";
import type { Room } from "@/shared/types/room";
import { redisClient } from "../redis"
import { prisma } from "../prisma"
import { safeUnlink, mGetChunked } from "../redisHelpers";
import type { BattleRoom, WorldBossBattleRoom } from "~/shared/types/battleRoom";
import { allBattleRoomOffering } from "~/shared/data/allBattleRoomOffering";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { HarvestBoxSource } from "~/generated/prisma";
import { enqueueToHarvestBox } from "./harvestBox";
import {withUniqueLock} from "../index"
import { emitEventToUser } from "./msgQueue";

const BATTLE_ROOM_EVENT_CHANNEL = "BATTLE_ROOM_EVENT";

export async function publishBattleRoomEvent(room: Room, type: "upsert" | "remove") {
  if (room.type !== "battle") return;
  const bRoom = room as BattleRoom;
  if (bRoom.battleType === "worldBoss" && type !== 'remove') return;
  try {
    const payload = JSON.stringify({
      type,
      roomId: room.uuid,
      status: room.status,
      battleType: bRoom.battleType,
      ts: Date.now(),
    });
    await redisClient.publish(BATTLE_ROOM_EVENT_CHANNEL, payload);
  } catch (e) {
    console.error("[publishBattleRoomEvent] failed", e);
  }
}

// 用户所在房间映射：HASH { userId -> roomUuid }
const USER_ROOM_HASH = "USER_ROOM_HASH";
export async function getUserRoomUuid(userId: string): Promise<string | undefined> {
  const roomId = await redisClient.hGet(USER_ROOM_HASH, userId);
  return roomId || undefined;
}
export async function setUserRoomUuid(userId: string, roomId: string) {
  await redisClient.hSet(USER_ROOM_HASH, userId, roomId);
}
export async function clearUserRoomUuid(userId: string) {
  await redisClient.hDel(USER_ROOM_HASH, userId);
}

export async function batchSetUserRoomUuid(userUudidList: string[], roomId: string) {
  userUudidList = Array.from(new Set(userUudidList)); // 去重
  const pipeline = redisClient.multi();
  for (const userId of userUudidList) {
    pipeline.hSet(USER_ROOM_HASH, userId, roomId);
  }
  await pipeline.exec();
}

export async function batchClearUserRoomUuid(userUudidList: string[]) {
  userUudidList = Array.from(new Set(userUudidList)); // 去重
  const pipeline = redisClient.multi();
  for (const userId of userUudidList) {
    pipeline.hDel(USER_ROOM_HASH, userId);
  }
  await pipeline.exec();
}

const REDIS_ROOM_PREFIX = "ROOM_";
export const getRoomKey = (roomId: string): string => {
  return `${REDIS_ROOM_PREFIX}${roomId}`;
};

const REDIS_USER_ROOM_PREFIX = "USER_ROOM_";
export const getUserRoomKey = (userId: string) => `${REDIS_USER_ROOM_PREFIX}${userId}`;

// 新增：用于维护所有房间key的集合
const ALL_ROOM_KEYS = "ALL_ROOM_KEYS";
export async function addRoomKey(roomId: string) {
  await redisClient.SADD(ALL_ROOM_KEYS, getRoomKey(roomId));
}
export async function removeRoomKey(roomId: string) {
  await redisClient.SREM(ALL_ROOM_KEYS, getRoomKey(roomId));
}

// 世界Boss房间：为每个 bossId 维护独立 set（去重，无序），专用调度进程使用
const WORLD_BOSS_ROOM_LIST_PREFIX = "WORLD_BOSS_ROOM_LIST_";
export const getWorldBossRoomListKey = (worldBossId: string): string => `${WORLD_BOSS_ROOM_LIST_PREFIX}${worldBossId}`;

const isWorldBossBattleRoom = (room: Room): room is BattleRoom & { worldBossId: string } => {
  return (room as BattleRoom)?.type === "battle" && (room as BattleRoom)?.battleType === "worldBoss" && !!(room as any).worldBossId;
};

export async function addWorldBossRoomKey(room: Room) {
  if (!isWorldBossBattleRoom(room)) return;
  const listKey = getWorldBossRoomListKey(room.worldBossId);
  const roomKey = getRoomKey(room.uuid);
  await redisClient.SREM(listKey, roomKey);
  await redisClient.SADD(listKey, roomKey);
}

export async function removeWorldBossRoomKey(room: Room) {
  // if (!isWorldBossBattleRoom(room)) return;
  const listKey = getWorldBossRoomListKey((room as WorldBossBattleRoom).worldBossId);
  await redisClient.SREM(listKey, getRoomKey(room.uuid));
}

export async function getWorldBossRoomKeys(worldBossId: string): Promise<string[]> {
  const key = getWorldBossRoomListKey(worldBossId);
  const members = await redisClient.SMEMBERS(key);
  // 返回不带前缀的 uuid，方便后续逻辑
  return (members ?? []).map(k => k.startsWith(REDIS_ROOM_PREFIX) ? k.slice(REDIS_ROOM_PREFIX.length) : k);
}

export async function listWorldBossRoomListKeys(): Promise<string[]> {
  const out: string[] = [];
  let cursor = '0';
  const COUNT = 200;
  const match = `${WORLD_BOSS_ROOM_LIST_PREFIX}*`;
  while (true) {
    const { cursor: next, keys } = await redisClient.SCAN(cursor, { MATCH: match, COUNT });
    if (Array.isArray(keys) && keys.length) out.push(...keys);
    cursor = next;
    if (cursor === '0') break;
  }
  return out;
}

/**
 * 通过房间ID获取房间对象
 * @param roomId 房间ID
 * @returns Room对象或undefined
 */
export async function getRoomById<T extends Room>(roomId: string): Promise<T | undefined> {
  let key = roomId;

  if (!key.startsWith(REDIS_ROOM_PREFIX)) {
    // 如果传入的roomId没有前缀，则添加前缀
    key = getRoomKey(roomId);
  }
  const data = await redisClient.get(key);
  if (!data) return undefined;
  return JSON.parse(data) as T;
}

/**
 * 根据用户uuid获取其所在房间uuid
 * @param userId 用户uuid
 * @returns 房间uuid或undefined
 */
export async function getRoomByUserId<T extends Room>(userId: string): Promise<T | undefined> {
  const roomId = await getUserRoomUuid(userId);
  if (!roomId) return undefined;
  return getRoomById<T>(roomId);
}

/**
 * 获取所有房间列表
 * @returns Room对象数组
 */

export async function getAllRoomKeys(): Promise<string[]> {
  // 优化：使用 SSCAN 分页迭代，避免一次性取出超大集合导致阻塞
  const out: string[] = [];
  let lCursor = '0';
  const COUNT = 500; // 每批次数量，可按压力调节
  while (true) {
    // node-redis v4: 返回 [nextCursor, members]
    const {cursor, members} = await redisClient.SSCAN(ALL_ROOM_KEYS, lCursor, { COUNT });
    if (Array.isArray(members) && members.length > 0) {
      out.push(...members);
    }
    lCursor = cursor;
    if (lCursor === '0') break;
  }
  return out.sort();
}

export async function getAllRooms<T extends Room>(): Promise<T[]> {
  const keys: string[] = await getAllRoomKeys();
  if (keys.length === 0) return [];
  const res: T[] = [];
  const BATCH = 500; // 分批 mGet，降低单次负载
  for (let i = 0; i < keys.length; i += BATCH) {
    const slice = keys.slice(i, i + BATCH);
    const roomsData = await redisClient.mGet(slice);
    res.push(
      ...roomsData
        .filter(Boolean)
        .map(data => JSON.parse(data as string) as T)
    );
  }
  return res;
}

export async function getRoomsByIds<T extends Room>(roomIds: string[]): Promise<T[]> {
  if (roomIds.length === 0) return [];
  const roomsData = await mGetChunked(redisClient, roomIds, 500);
  return roomsData
    .filter(Boolean)
    .map(data => JSON.parse(data as string) as T);
}

export async function updateRoom<T extends Room>(roomId: string, newRoom: T): Promise<void> {
  newRoom.name = newRoom.name.slice(0, 20);
  newRoom.lastUpdateAt = Date.now(); // 更新最后更新时间
  await redisClient.set(getRoomKey(roomId), JSON.stringify(newRoom));

  // 更新后0成员的房间，直接删除就行
  if (newRoom.memberIds.length === 0) {
    await removeRoom(roomId);

    return;
  }

  if (newRoom.type != 'battle') {
    throw new Error("目前只支持更新战斗房间")
  }

  if (newRoom.type == 'battle') {
    let bRoom = newRoom as unknown as BattleRoom
    if (bRoom.battleType == 'normal') {
      await removeWorldBossRoomKey(bRoom);

      // @ts-ignore
      delete bRoom.worldBossId
      // @ts-ignore
      delete bRoom.afterWin

      await addRoomKey(roomId); // 新增：加入房间集合

      await publishBattleRoomEvent(newRoom, "upsert");
    } else {
      await removeRoomKey(roomId);

      await publishBattleRoomEvent(newRoom, "remove");

      // 若为世界Boss房间，写入独立的 boss 列表供专用进程调度
      await addWorldBossRoomKey(newRoom);
    }
  }

  await batchSetUserRoomUuid(newRoom.memberIds, roomId);

  notifyAllRoomMembersToUpdateRoom(newRoom)
}

export async function removeRoom(roomId: string): Promise<void> {
  const room = await getRoomById<Room>(roomId);
  if (!room) return;

  // 删除房间数据
  await redisClient.del(getRoomKey(roomId));

  // 从房间ID集合中移除
  await removeRoomKey(roomId); // 删除房间时移除key
  await removeWorldBossRoomKey(room);

  // 发布房间删除事件
  await publishBattleRoomEvent(room, "remove");

  // 清理所有成员的 UserRoom 数据
  await batchClearUserRoomUuid(room.memberIds);

  // 如果是战斗房间，同时清理战斗
  if (room.type == 'battle') {
    let cRoom =  room as unknown as BattleRoom;
    const battleUuid = cRoom.battleUuid;
    if (battleUuid) {
      await removeBattleInfoFromRedis(battleUuid);
    }
  }
}

export async function kickUserFromRoom(
  ownerId: string,
  targetUserId: string,
  roomId: string,
  gm: boolean = false
): Promise<void> {
  let room = await getRoomById<Room>(roomId);
  if (!room) throw new Error("房间不存在");

  // 只有房主可以踢人
  if (!gm && room.ownerId !== ownerId) {
    throw new Error("只有房主可以踢人");
  }

  // 不能踢自己
  if (!gm && ownerId === targetUserId) {
    throw new Error("不能踢出自己");
  }

  // 检查目标用户是否在房间
  if (!gm && !room.memberIds.includes(targetUserId)) {
    throw new Error("该用户不在房间中");
  }

  // 退还该玩家提交的所有契约
  room = await returnAllOfferingsFromBattleRoom({
    roomId: room.uuid,
    userId: targetUserId,
  })

  // 移除成员
  room.memberIds = room.memberIds.filter(id => id !== targetUserId);
  if (room.readyMap) {
    delete room.readyMap[targetUserId];
  }

  // 删除该用户的 userRoomKey
  await clearUserRoomUuid(targetUserId);

  await updateRoom(roomId, room)
}

export async function returnAllOfferingsFromBattleRoom(params: {
  roomId: string;
  userId: string;
}): Promise<BattleRoom> {
  const { roomId, userId } = params;

  if (!roomId?.trim()) throw new Error("房间ID无效");
  if (!userId?.trim()) throw new Error("用户ID无效");

  const lockKey = `battleRoom:${roomId}:offering`;

  const room = await getRoomById<BattleRoom>(roomId);
  if (!room) throw new Error("房间不存在");
  // if (room.status !== "waiting")
  //   throw new Error("仅在等待阶段可退还战斗契约");

  return await withUniqueLock(
    lockKey,
    async () => {
      const offerings = room.offerings || [];
      const ownedStacks = offerings.filter((o) => o.fromUserUuid === userId);
      if (!ownedStacks.length) return room;

      for (const stack of ownedStacks) {
        const refundCount = Math.max(0, stack.count || 0);
        if (refundCount <= 0) continue;

        const spec = allBattleRoomOffering[stack.specId];
        const resourceId =
          stack.resourceId ||
          (spec?.kind.type === "resource"
            ? (spec.kind.resourceId as AllGameResourceID)
            : undefined);

        if (!resourceId) {
          // 没有确定媒介素材则跳过该条，避免抛出影响其他退还
          continue;
        }

        const refundToUser = stack.fromUserUuid || userId;
        await enqueueToHarvestBox(
          refundToUser,
          {
            [resourceId]: { count: refundCount },
          },
          {
            title: "战斗 - 退还战斗契约",
            source: HarvestBoxSource.Auto,
          },
        );
      }

      room.offerings = offerings.filter((o) => o.fromUserUuid !== userId);
      await updateRoom(roomId, room);
      return room;
    },
    { ttlSeconds: 5 },
  );
}

/**
 * 向房间内所有玩家发送房间信息更新通知
 * @param room Room对象
 * @param event 事件名，默认 "battleRoom:update"
 */
export function notifyAllRoomMembersToUpdateRoom(room: Room) {
  for (const memberId of room.memberIds) {
    emitEventToUser(memberId, "battleRoom:update", room);
  }
}