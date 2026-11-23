import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { joinRoom, joinViewRoom, leaveViewRoom, notifyAllRoomMembersToUpdateRoom } from "~/server/utils/game/room";
import { getRoomById } from "~/server/utils/game/room";

export async function handleJoinViewBattleRoom(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string }>
) {
  try {
    const userId = data.user.uuid;
    const { roomId } = data.data;
    await joinViewRoom(userId, roomId);
    // const room = await getRoomById(roomId);
    emitEventToUser(data.user, "battleRoom:joinView:success");
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:joinView:error", { message: e.message || "观战失败" });
  }
}

export async function handleLeaveViewBattleRoom(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  try {
    const userId = data.user.uuid;
    await leaveViewRoom(userId);
    // const room = await getRoomById(roomId);
    emitEventToUser(data.user, "battleRoom:leaveView:success");
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:leaveView:error", { message: e.message || "离开观战房间失败" });
  }
}