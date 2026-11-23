import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getRoomById, notifyAllRoomMembersToUpdateRoom, setUserReadyStatus, updateRoom } from "~/server/utils/game/room";
import { BattleRoom } from "~/shared/types/battleRoom";
import { ItemCountInfo } from "~/shared/types/gameInventory";
import { safeJsonParse } from "~/shared/utils";

export async function handleReorderRoomMember(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string; newMemberUuids: string[] }>
) {
  try {
    const userId = data.user.uuid;
    const { roomId, newMemberUuids } = data.data;
    const room = await getRoomById<BattleRoom>(roomId);

    if (room) {
      // 如果全员准备就绪
      room.memberIds = newMemberUuids;

      await updateRoom(room.uuid, room);
      notifyAllRoomMembersToUpdateRoom(room)
    }

  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:reorder:error", { message: e.message || "设置准备状态失败" });
  }
}

export async function handleGetRoomBattleReward(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string; }>
) {
  try {
    const requestUserId = data.user.uuid;
    const roomId = data.data.roomId;

    const room = await getRoomById<BattleRoom>(roomId);

    if (!room?.memberIds.includes(requestUserId)) {
      throw new Error("您不在该房间内，无法查看奖励");
    }

    if (!room.publicBattleLoot) {
      throw new Error("房主设置了不公开战利品信息");
    }

    const battleRewardRedisKey = `battle:rewardInfo:${roomId}`;

    const lastRewardDataRaw = await redisClient.get(battleRewardRedisKey);

    const lastRewardData: Record<string, ItemCountInfo> = safeJsonParse(lastRewardDataRaw);

    emitEventToUser(data.user, "battleRoom:rewardInfo:success", { data: lastRewardData });
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:rewardInfo:error", { message: e.message || "获取失败" });
  }
}

export async function handleResetSelfBattleReward(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string; }>
) {
  const requestUserId = data.user.uuid;
  const roomId = data.data.roomId;

  if (!requestUserId || !roomId) {
    emitEventToUser(data.user, "battleRoom:resetSelfBattleRewardInfo:error", { message: "重置失败", });
    return;
  }

  await withUniqueLock("resetSelfBattleReward:" + requestUserId, async () => {
    try {
      const room = await getRoomById<BattleRoom>(roomId);

      if (!room?.memberIds.includes(requestUserId)) {
        throw new Error("您不在该房间内");
      }

      if (!room.publicBattleLoot) {
        throw new Error("房主设置了不公开战利品信息");
      }

      const battleRewardRedisKey = `battle:rewardInfo:${roomId}`;

      const lastRewardDataRaw = await redisClient.get(battleRewardRedisKey);

      const lastRewardData: Record<string, ItemCountInfo> =
        safeJsonParse(lastRewardDataRaw);

      if (lastRewardData[requestUserId]) {
        delete lastRewardData[requestUserId];
      }

      if (!Object.keys(lastRewardData).length) {
        await redisClient.del(battleRewardRedisKey);
      } else {
        await redisClient.set(
          battleRewardRedisKey,
          JSON.stringify(lastRewardData)
        );
      }

      emitEventToUser(
        data.user,
        "battleRoom:resetSelfBattleRewardInfo:success"
      );
    } catch (e: any) {
      emitEventToUser(data.user, "battleRoom:resetSelfBattleRewardInfo:error", {
        message: e.message || "重置失败",
      });
    }
  });

}