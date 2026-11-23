import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { createBattleRoom } from "~/server/utils/game/battle";
import { getRoomById, joinRoom } from "~/server/utils/game/room";
import { AllBattleAreaID } from "~/shared/types/battle";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ name: string, area: AllBattleAreaID, isPublic: boolean }>,
) {
  try {
    // 创建后自动加入房间
    await joinRoom(userId, battleRoom.uuid);
    const fullRoom = await getRoomById(battleRoom.uuid);

    emitEventToUser(data.user, "battleRoom:create:success", fullRoom);
    emitEventToUser(data.user, "battleRoom:join:success", fullRoom);
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:create:error", { message: e.message || "创建战斗房间失败" });
  }
}