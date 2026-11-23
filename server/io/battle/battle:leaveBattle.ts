import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { leaveBattle, getBattleRoomById } from "~/server/utils/game/battle";
import { leaveRoom, notifyAllRoomMembersToUpdateRoom, updateRoom, } from "~/server/utils/game/room";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string }>
) {
  const userUuid = data.user.uuid;
  const roomId = data.data.roomId;

  try {
    await leaveBattle(userUuid, roomId);

    let latestRoom = await leaveRoom(userUuid)

    // 3. 确保状态一致性 - 双重检查
    const remainingRoom = await getBattleRoomById(roomId);
    if (remainingRoom && remainingRoom.memberIds.includes(userUuid)) {
      // 如果用户仍在房间中，强制移除
      remainingRoom.memberIds = remainingRoom.memberIds.filter(id => id !== userUuid);
      await updateRoom(roomId, remainingRoom);
      latestRoom = remainingRoom;
    }

    emitEventToUser(userUuid, "battle:leaveBattle:success");
    emitEventToUser(userUuid, "battle:update:success", null);
    emitEventToUser(data.user, "battleRoom:leave:success", { roomId });

    setTimeout(() => {
      emitEventToUser(userUuid, "battle:leaveBattle:success");
      emitEventToUser(userUuid, "battle:update:success", null);
    }, 1000)
  } catch (e: any) {
    try {
      await leaveRoom(userUuid);
      emitEventToUser(userUuid, "battle:leaveBattle:success");
      emitEventToUser(userUuid, "battle:update:success", null);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    emitEventToUser(userUuid, "battle:update:error", { message: e.message || "离开战斗失败" });
  }
}