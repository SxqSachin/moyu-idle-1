import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { clearUserRoomUuid, getUserRoomOld, getUserRoomUuid, setUserRoomUuid } from "~/server/utils/game/room";
import { applyRoomBeginnerInfo, getBattleRoomById } from "~/server/utils/game/battle";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<undefined>
) {
  try {
    const userId = data.user.uuid;
    let roomId = await getUserRoomUuid(userId);
    if (!roomId) {
      // 兼容旧数据
      const oldUserRoom = await getUserRoomOld(userId);

      // 更新为新数据结构
      if (oldUserRoom) {
        roomId = oldUserRoom.uuid;

        await setUserRoomUuid(userId, roomId);

      } else {
        emitEventToUser(data.user, "battleRoom:getCurrentRoom:success", null);
        return;
      }
    }

    let room = await getBattleRoomById(roomId);


    if (!room) {
      await clearUserRoomUuid(userId);
      emitEventToUser(data.user, "battleRoom:getCurrentRoom:success", null);
      return;
    }

    await applyRoomBeginnerInfo(room)

    emitEventToUser(data.user, "battleRoom:getCurrentRoom:success", room);
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:getCurrentRoom:error", { message: e.message || "获取当前房间失败" });
  }
}