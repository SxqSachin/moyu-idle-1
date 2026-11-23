import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { leaveBattle, getBattleRoomById, removeBattleInfoFromRedis, dispatchBattleEndEventToRoomByRoomId } from "~/server/utils/game/battle";
import { leaveRoom, notifyAllRoomMembersToUpdateRoom, updateRoom, } from "~/server/utils/game/room";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string }>
) {
  const userUuid = data.user.uuid;
  const roomId = data.data.roomId;

  try {
    let roomInfo = await getBattleRoomById(roomId);

    if (!roomInfo) {
      emitEventToUser(userUuid, "battle:stopBattle:error", { message: "房间不存在" });
      return;
    }

    let battleUuid = roomInfo.battleUuid;

    if (!battleUuid) {
      emitEventToUser(userUuid, "battle:stopBattle:error", { message: "战斗信息不存在" });
      return;
    }

    // 删除战斗信息
    await removeBattleInfoFromRedis(battleUuid);
    // 更新所有玩家的战斗状态
    for (const member of roomInfo.memberIds) {
      emitEventToUser(member, "battle:end:success");
    }

    // 如果战斗信息不存在，则更新房间信息
    roomInfo.status = 'waiting';
    roomInfo.battleUuid = undefined;
    roomInfo.currentRepeat = 0;

    // 将自己的状态设置为未准备
    if (!roomInfo.readyMap) {
      roomInfo.readyMap = {};
    }
    roomInfo.readyMap[userUuid] = false;

    await updateRoom(roomId, roomInfo);

    notifyAllRoomMembersToUpdateRoom(roomInfo);

    emitEventToUser(userUuid, "battle:stopBattle:success");
  } catch (e: any) {
    emitEventToUser(userUuid, "battle:stopBattle:error", { message: e.message || "结束战斗失败" });
  }
}