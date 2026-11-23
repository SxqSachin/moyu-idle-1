import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { kickUserFromRoom, getRoomById, notifyAllRoomMembersToUpdateRoom } from "~/server/utils/game/room";
import { withUniqueLock } from "~/server/utils/lock";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string, targetUserId: string }>
) {
  try {
    const ownerId = data.user.uuid;
    const { roomId, targetUserId } = data.data;
    const lockKey = `battleRoom:${roomId}:kick`;

    await withUniqueLock(lockKey, async () => {
      await kickUserFromRoom(ownerId, targetUserId, roomId);
      // 通知被踢用户
      emitEventToUser({ uuid: targetUserId } as any, "battleRoom:kick", { roomId });
      // 通知房主操作成功
      const room = await getRoomById(roomId);
      emitEventToUser(data.user, "battleRoom:kick:success", room);

      if (room) {
        notifyAllRoomMembersToUpdateRoom(room);
      }
    }, { expireSec: 5 });
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:kick:error", { message: e.message || "踢出房间失败" });
  }
}