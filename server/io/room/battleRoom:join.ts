import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { joinRoom, notifyAllRoomMembersToUpdateRoom, getRoomById, isUserRoomInCooldown } from "~/server/utils/game/room";
import { withUniqueLock } from "~/server/utils/lock";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string }>
) {
  const key = `battleRoom:user:${data.user.uuid}`;
  await withUniqueLock(key, async () => {
    try {
      const userId = data.user.uuid;
      const inCooldown = await isUserRoomInCooldown(userId);
      if (inCooldown) {
        throw new Error("离开房间后15秒内不可加入房间");
      }
      const { roomId } = data.data;
      await joinRoom(userId, roomId);
      const room = await getRoomById(roomId);
      emitEventToUser(data.user, "battleRoom:join:success", room);

      if (room) {
          notifyAllRoomMembersToUpdateRoom(room)
      }
    } catch (e: any) {
      emitEventToUser(data.user, "battleRoom:join:error", { message: e.message || "加入房间失败" });
    }
  })
}