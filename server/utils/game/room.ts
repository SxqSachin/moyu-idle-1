import { v4 as uuidv4 } from "uuid";
import type { Room } from "@/shared/types/room";
import { io } from "~/server/plugins/socket.io";
import { emitEventToUser } from "~/server/io";
import { leaveBattle } from "./battle";
import { isUserInBattle } from "./battle";
import { isAllIronCatOrNot } from "./account";
import { BattleRoom, WorldBossBattleRoom } from "~/shared/types/battleRoom";
import { allBattleRoomOffering } from "~/shared/data/allBattleRoomOffering";
import { BATTLE_ROOM_MAX_OFFERINGS } from "~/shared/data/constant";
import { allGameResource } from "~/shared/data/allGameResources";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import type { BattleRoomOfferingStack } from "~/shared/types/battleRoomOffering";
import { decreaseItemCount, increaseItemCount } from "./characterInventory";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { withUniqueLock } from "~/server/utils/lock";
import { HarvestBoxSource } from "~/generated/prisma";
import { assertUserBattleLevelInArea } from "./battleArea";

const BATTLE_ROOM_EVENT_CHANNEL = "BATTLE_ROOM_EVENT";
const BATTLE_ROOM_LEAVE_CHANNEL = "BATTLE_ROOM_LEAVE";
const USER_ROOM_COOLDOWN_PREFIX = "battleRoom:user:cooldown:";

async function publishBattleRoomEvent(room: Room, type: "upsert" | "remove") {
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

async function publishBattleRoomLeave(roomId: string, userId: string) {
  try {
    const payload = JSON.stringify({ roomId, userId, ts: Date.now() });
    await redisClient.publish(BATTLE_ROOM_LEAVE_CHANNEL, payload);
  } catch (e) {
    console.error("[publishBattleRoomLeave] failed", e);
  }
}

const REDIS_ROOM_PREFIX = "ROOM_";
export const getRoomKey = (roomId: string): string => {
  return `${REDIS_ROOM_PREFIX}${roomId}`;
};


export async function getUserRoomOld(userId: string): Promise<Room | undefined> {
  const prefix = "USER_ROOM_";

  const room = await redisClient.get(`${prefix}${userId}`);

  if (!room) return undefined;

  // 使用这个方法，为这个key添加1小时ttl
  await redisClient.expire(`${prefix}${userId}`, 3600);

  return JSON.parse(room)
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

// 新增：用于维护所有房间key的集合
const ALL_ROOM_KEYS = "ALL_ROOM_KEYS";
async function addRoomKey(roomId: string) {
  await redisClient.SADD(ALL_ROOM_KEYS, getRoomKey(roomId));
}
async function removeRoomKey(roomId: string) {
  await redisClient.SREM(ALL_ROOM_KEYS, getRoomKey(roomId));
}

// 世界Boss房间：按 bossId 维护独立的 set（无序、去重）
const WORLD_BOSS_ROOM_LIST_PREFIX = "WORLD_BOSS_ROOM_LIST_";
export const getWorldBossRoomListKey = (worldBossId: string): string => `${WORLD_BOSS_ROOM_LIST_PREFIX}${worldBossId}`;

const isWorldBossBattleRoom = (room: Room): room is BattleRoom & { worldBossId: string } => {
  return (room as BattleRoom)?.type === "battle" && (room as BattleRoom)?.battleType === "worldBoss" && !!(room as any).worldBossId;
};

export async function addWorldBossRoomKey(room: Room) {
  if (!isWorldBossBattleRoom(room)) return;
  const listKey = getWorldBossRoomListKey(room.worldBossId);
  const roomKey = getRoomKey(room.uuid);
  // set 去重
  await redisClient.SREM(listKey, roomKey);
  await redisClient.SADD(listKey, roomKey);
}

export async function removeWorldBossRoomKey(room: Room) {
  // if (!isWorldBossBattleRoom(room)) return;
  const listKey = getWorldBossRoomListKey((room as WorldBossBattleRoom).worldBossId);
  await redisClient.SREM(listKey, getRoomKey(room.uuid));
}

/**
 * 创建一个房间并保存到 Redis
 * @param ownerId 房主用户ID
 * @param roomFactory 房间工厂函数，返回自定义房间对象
 * @returns 创建的房间对象
 */
export async function createRoom<T extends Room>(
  ownerId: string,
  roomFactory: (id: string, ownerId: string) => T
): Promise<T> {
  // 新增：创建房间前检查用户是否处于战斗或已在其他房间
  const inBattle = await isUserInBattle(ownerId);
  if (inBattle) {
    throw new Error("你当前正在战斗中，无法创建房间");
  }

  // 创建房间前检查用户是否已在其他房间
  const joinedRoomUuid = await getUserRoomUuid(ownerId);
  if (joinedRoomUuid) {
    throw new Error("你已在其他房间，不能重复创建");
  }

  const uuid = uuidv4();
  const key = getRoomKey(uuid);

  const room = roomFactory(uuid, ownerId);
  await redisClient.set(key, JSON.stringify(room));

  if (room.type == 'battle') {
    let bRoom = room as unknown as BattleRoom

    if (bRoom.battleType == 'normal') {
      await addRoomKey(uuid); // 新增：加入房间集合
      await publishBattleRoomEvent(room, "upsert");
    } else {
      // 若为世界Boss房间，写入独立的 boss 列表供专用进程调度
      await addWorldBossRoomKey(room);
    }
  } else {
    await addRoomKey(uuid); // 新增：加入房间集合
  }

  // 记录房主所在房间（及其他成员，如果 roomFactory 预填了 memberIds）
  await batchSetUserRoomUuid([ownerId, ...room.memberIds], uuid);
  return room;
}

/**
 * 通过房间ID获取房间对象
 * @param roomId 房间ID
 * @returns Room对象或undefined
 */
export async function getRoomById<T extends Room>(roomId: string): Promise<T | undefined> {
  const key = getRoomKey(roomId);
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
export async function getAllRooms<T extends Room>(): Promise<T[]> {
  const keys: string[] = await redisClient.SMEMBERS(ALL_ROOM_KEYS);
  if (keys.length === 0) return [];
  const roomsData = await redisClient.mGet(keys);
  return roomsData
    .filter(Boolean)
    .map(data => JSON.parse(data as string) as T);
}

/**
 * 更新房间数据并同步所有成员的 UserRoom 数据
 * @param roomId 房间ID
 * @param newRoom 最新的房间对象
 */
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

// joinRoom 方法中，加入房间后同步所有成员的 UserRoom 数据
export async function joinRoom(userId: string, roomId: string): Promise<void> {
  const room = await getRoomById<Room>(roomId);
  if (!room) throw new Error("房间不存在");

  // 检查是否已在其他房间
  const joinedRoomUuid = await getUserRoomUuid(userId);
  if (joinedRoomUuid) {
    if (joinedRoomUuid !== roomId) {
      throw new Error("你已在其他房间");
    }
  }

  // 已在房间则直接返回
  if (room.memberIds.includes(userId)) {
    return;
  }

  let accountCheckRes = await isAllIronCatOrNot([userId, room.ownerId, ...room.memberIds])
  if (!accountCheckRes) {
    throw new Error("你无法加入此类型房间")
  }

  if (room.type === "battle") {
    const battleRoom = room as BattleRoom;
    if ((battleRoom.battleType ?? "normal") === "normal") {
      await assertUserBattleLevelInArea(userId, battleRoom.area!);
    }
  }

  // 检查房间状态
  if (room.status !== "waiting") {
    throw new Error("房间已开始或已结束");
  }

  // 检查人数
  if (room.memberIds.length >= room.maxMembers) {
    throw new Error("房间已满");
  }

  // 加入房间
  room.memberIds.push(userId);

  await updateRoom(room.uuid, room)
}

// leaveRoom 方法中，离开房间后同步所有成员的 UserRoom 数据
export async function leaveRoom(userId: string): Promise<Room> {
  const roomId = await getUserRoomUuid(userId);
  if (!roomId) throw new Error("你未加入任何房间");

  let latestRoom = await getRoomById<Room>(roomId);
  if (!latestRoom) {
    await removeRoomKey(roomId); // 房间不存在时移除key
    throw new Error("房间不存在");
  }

  // 检查用户是否在房间成员列表中
  if (!latestRoom.memberIds.includes(userId)) {
    await clearUserRoomUuid(userId);
    throw new Error("你并未在该房间中");
  }

  // 退还该玩家提交的所有契约
  try {
    latestRoom = await returnAllOfferingsFromBattleRoom({
      roomId: latestRoom.uuid,
      userId,
    })
  } catch (e) {
    console.error("[leaveRoom] returnAllOfferingsFromBattleRoom failed", e);
  }

  // 移除成员
  latestRoom.memberIds = latestRoom.memberIds.filter(id => id !== userId);

  // // 3. 从 readyMap 中移除
  if (latestRoom.readyMap) {
    delete latestRoom.readyMap[userId];
  }

  // 房主离开房间后，如果房间还有其他成员，则将房主转移给第一个成员
  if (latestRoom.ownerId === userId && latestRoom.memberIds.length > 0) {
    latestRoom.ownerId = latestRoom.memberIds[0]; // 将第一个成员设为新房主
  }

  // 尝试离开战斗
  await leaveBattle(userId, roomId)

  // 先删除用户房间信息
  await clearUserRoomUuid(userId);

  await updateRoom(roomId, latestRoom);

  // 发布离开房间事件，通知所有战斗调度分片做一次快速校验/处理
  await publishBattleRoomLeave(roomId, userId);

  await setUserRoomCooldown(userId);

  return latestRoom
}


// kickUserFromRoom 方法中，踢出成员后同步所有成员的 UserRoom 数据
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

/**
 * 更新玩家的准备状态
 * @param userId 玩家ID
 * @param roomId 房间uuid
 * @param ready 是否准备
 */
export async function setUserReadyStatus(
  userId: string,
  roomId: string,
  ready: boolean
): Promise<void> {
  const room = await getRoomById<Room>(roomId);
  if (!room) throw new Error("房间不存在");

  // 检查房间状态
  if (room.status !== "waiting") {
    throw new Error("房间已开始或已结束，无法更改准备状态");
  }

  // 检查玩家是否在房间
  if (!room.memberIds.includes(userId)) {
    throw new Error("你不在该房间中");
  }

  // 检查readyMap是否存在
  if (!room.readyMap) {
    room.readyMap = {};
  }

  room.readyMap[userId] = ready;

  await updateRoom(roomId, room);
}

/**
 * 向战斗房间添加战斗契约堆栈
 */
export async function addOfferingToBattleRoom(params: {
  roomId: string;
  userId: string;
  specId: string;
  count?: number;
  resourceId?: string;
}): Promise<BattleRoom> {
  const { roomId, userId, specId, resourceId } = params;

  if (typeof roomId !== "string" || !roomId.trim()) {
    throw new Error("房间ID无效");
  }
  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("用户ID无效");
  }
  if (typeof specId !== "string" || !specId.trim()) {
    throw new Error("战斗契约ID无效");
  }

  const rawCount = params.count ?? 1;
  const parsedCount = Number(rawCount);
  if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
    throw new Error("媒介数量必须为正数");
  }
  const count = Math.min(100000, Math.max(1, Math.floor(parsedCount)));

  let resourceToConsume: AllGameResourceID | null = null;

  const lockKey = `battleRoom:${roomId}:offering`;

  return await withUniqueLock(lockKey, async () => {
    const room = await getRoomById<BattleRoom>(roomId);
    if (!room) throw new Error("房间不存在");
    if (!room.memberIds.includes(userId)) throw new Error("你不在该房间");
    if (room.status !== "waiting") throw new Error("仅在等待阶段可添加战斗契约");

    const spec = allBattleRoomOffering[specId];
    if (!spec) throw new Error("战斗契约不存在");
    const stackable = spec.stackable ?? true;

    if (spec.kind.type === "alchemyTag") {
      if (typeof resourceId !== "string" || !resourceId.trim()) {
        throw new Error("需要指定战斗契约素材");
      }
      const resource = allGameResource[resourceId as AllGameResourceID];
      if (!resource) throw new Error("战斗契约素材不存在");
      if (!resource.alchemyTag?.includes(spec.kind.tagId)) {
        throw new Error("媒介素材与战斗契约不匹配");
      }
      resourceToConsume = resource.id as AllGameResourceID;
    } else if (spec.kind.type === "resource") {
      resourceToConsume = spec.kind.resourceId as AllGameResourceID;
      if (resourceId && resourceId !== spec.kind.resourceId) {
        throw new Error("媒介素材与战斗契约不匹配");
      }
    }

    const offerings: BattleRoomOfferingStack[] = room.offerings || [];
    const roomExisted = offerings.find((o) => o.specId === specId);

    if (!stackable && roomExisted) {
      if (roomExisted.fromUserUuid !== userId) {
        throw new Error("该战斗契约不可叠加，房间中已存在");
      }
    }

    if (!roomExisted && offerings.length >= BATTLE_ROOM_MAX_OFFERINGS) {
      throw new Error(`房间最多可拥有 ${BATTLE_ROOM_MAX_OFFERINGS} 个战斗契约`);
    }

    if (resourceToConsume) {
      const hasEnoughResource = await checkResourceRequirementInDB(userId, [
        {
          id: resourceToConsume,
          count: count,
        }
      ]);

      if (!hasEnoughResource) {
        throw new Error("你的素材不足，无法添加战斗契约");
      }

      await decreaseItemCount(
        userId,
        {
          [resourceToConsume]: { count },
        },
        {
          actionName: "战斗 - 添加战斗契约",
          showModifyInfo: true,
          sendModifyEvent: true,
          type: ModifyItemCountType.ActionUse,
        }
      );
    }

    const existed = offerings.find((o) => o.specId === specId && o.fromUserUuid === userId);

    if (existed) {
      existed.count += count;
      existed.consumedCount = existed.consumedCount ?? 0;
      existed.nextConsumeInTurns = existed.nextConsumeInTurns ?? 0;
      // existed.nextConsumeInTurns = 0;
    } else {
      offerings.push({
        specId,
        count,
        fromUserUuid: userId,
        resourceId: resourceToConsume || undefined,
        consumedCount: 0,
        nextConsumeInTurns: 0,
      });
    }

    room.offerings = offerings;

    await updateRoom(roomId, room);
    return room;
  }, { expireSec: 5 });
}

/**
 * 退还房间中的战斗契约（仅房主或提交者可退还剩余数量）
 */
export async function returnOfferingFromBattleRoom(params: {
  roomId: string;
  userId: string;
  specId: string;
}): Promise<BattleRoom> {
  const { roomId, userId, specId } = params;

  if (!roomId?.trim()) throw new Error("房间ID无效");
  if (!userId?.trim()) throw new Error("用户ID无效");
  if (!specId?.trim()) throw new Error("战斗契约ID无效");

  const lockKey = `battleRoom:${roomId}:offering`;

  return await withUniqueLock(lockKey, async () => {
    const room = await getRoomById<BattleRoom>(roomId);
    if (!room) throw new Error("房间不存在");
    if (room.status !== "waiting") throw new Error("仅在等待阶段可退还战斗契约");

    const offerings = room.offerings || [];
    const idx = offerings.findIndex((o) => o.specId === specId);
    if (idx === -1) throw new Error("该战斗契约不存在");

    const stack = offerings[idx];
    const isOwner = room.ownerId === userId;
    const isSubmitter = stack.fromUserUuid === userId;
    if (!isOwner && !isSubmitter) throw new Error("你无权退还该战斗契约");

    const refundCount = Math.max(0, stack.count || 0);
    const refundToUser = stack.fromUserUuid || userId;

    const spec = allBattleRoomOffering[specId];
    const resourceId = stack.resourceId
      || (spec?.kind.type === "resource" ? spec.kind.resourceId as AllGameResourceID : undefined);

    if (refundCount > 0) {
      if (!resourceId) {
        throw new Error("无法确定退还的媒介素材");
      }

      await enqueueToHarvestBox(refundToUser, {
        [resourceId]: { count: refundCount },
      }, {
        title: "战斗 - 退还战斗契约",
        source: HarvestBoxSource.Auto
      });
    }

    offerings.splice(idx, 1);
    room.offerings = offerings;

    await updateRoom(roomId, room);
    return room;
  }, { expireSec: 5 });
}

/**
 * 退还指定玩家在房间内提交的所有战斗契约
 */
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
  if (room.status !== "waiting")
    throw new Error("仅在等待阶段可退还战斗契约");

  return await withUniqueLock(
    lockKey,
    async () => {
      return prisma.$transaction(async (tx) => {
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
          await enqueueToHarvestBox(refundToUser, {
            [resourceId]: { count: refundCount },
          }, {
            title: "战斗 - 退还战斗契约",
            source: HarvestBoxSource.Auto
          });
        }

        room.offerings = offerings.filter((o) => o.fromUserUuid !== userId);
        await updateRoom(roomId, room);
        return room;
      });
    },
    { expireSec: 5 }
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

export async function notifyAllRoomMembersToUpdateRoomById(roomId: string) {
  const room = await getRoomById(roomId)
  for (const memberId of room?.memberIds ?? []) {
    emitEventToUser(memberId, "battleRoom:update", room);
  }
}



const USER_VIEW_ROOM_PREFIX = "USER_VIEW_ROOM_";
const getUserViewRoomKey = (userId: string) => `${USER_VIEW_ROOM_PREFIX}${userId}`;

export async function joinViewRoom(userId: string, roomId: string): Promise<void> {
  const userRoomKey = getUserViewRoomKey(userId);
  const viewRoomUuid = await redisClient.get(userRoomKey);

  if (!!viewRoomUuid) {
    // 如果用户已在观战房间，则直接返回
    if (viewRoomUuid === roomId) {
      throw new Error("你已在该观战房间");
    } else {
      await leaveViewRoom(userId);
    }
  }

  const room = await getRoomById<Room>(roomId);
  if (!room) throw new Error("房间不存在");

  // 检查房间状态
  if (room.status !== "battling") {
    throw new Error("房间未开始战斗");
  }

  // 已在房间则直接返回
  if (room.viewerMemberUuids.includes(userId)) {
    return;
  }

  // 加入房间
  room.viewerMemberUuids.push(userId);
  await updateRoom(room.uuid, room)


  await redisClient.set(getUserViewRoomKey(userId), roomId);
}

export async function leaveViewRoom(userId: string): Promise<void> {
  const userRoomKey = getUserViewRoomKey(userId);
  const viewRoomUuid = await redisClient.get(userRoomKey);
  if (!viewRoomUuid) {
    return 
  }

  // 先删除用户房间信息
  await redisClient.del(userRoomKey);

  const room = await getRoomById<Room>(viewRoomUuid);
  if (!room) {
    return;
  }

  // 检查用户是否在房间成员列表中
  if (!room.viewerMemberUuids.includes(userId)) {
    return;
  }

  room.viewerMemberUuids = room.viewerMemberUuids.filter(id => id !== userId);

  await updateRoom(room.uuid, room)
}

export async function setUserRoomCooldown(userId: string, seconds: number = 15) {
  await redisClient.setEx(`${USER_ROOM_COOLDOWN_PREFIX}${userId}`, seconds, "1");
}

export async function isUserRoomInCooldown(userId: string): Promise<boolean> {
  const exists = await redisClient.exists(`${USER_ROOM_COOLDOWN_PREFIX}${userId}`);
  return !!exists;
}