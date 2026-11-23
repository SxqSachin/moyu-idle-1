import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getBattleRoomById, getBattleInfoFromRedis } from "~/server/utils/game/battle";
import { getRoomById, getRoomByUserId, notifyAllRoomMembersToUpdateRoom, updateRoom } from "~/server/utils/game/room";
import { BattleRoom } from "~/shared/types/battleRoom";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>,
) {
  try {

    const battleRoom = await getRoomByUserId<BattleRoom>(data.user.uuid)

    if (!battleRoom) {
      emitEventToUser(data.user, "battle:update:error", { message: "房间不存在" });
      return;
    }

    // 获取战斗信息
    if (!battleRoom.battleUuid) {
      emitEventToUser(data.user, "battle:update:success", null);

      // 如果战斗信息不存在，则更新房间信息
      battleRoom.status = 'waiting'
      await updateRoom(battleRoom.uuid, battleRoom)

      await notifyAllRoomMembersToUpdateRoom(battleRoom)

      return;
    }

    const battleInfo = await getBattleInfoFromRedis(battleRoom.battleUuid);
    emitEventToUser(data.user, "battle:update:success", battleInfo);
  } catch (e: any) {
    emitEventToUser(data.user, "battle:update:error", { message: e.message || "获取战斗信息失败" });
  }
}