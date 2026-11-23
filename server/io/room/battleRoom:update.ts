import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { createBattleRoom, getBattleRoomById, updateBattleRoomInfo } from "~/server/utils/game/battle";
import { getRoomById, joinRoom } from "~/server/utils/game/room";
import { AllBattleAreaID } from "~/shared/types/battle";
import { UpdateBattleRoomInput } from "~/shared/types/battleRoom";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<UpdateBattleRoomInput & {roomId: string}>,
) {
  try {
    const { roomId, ...rest } = data.data;
    const userId = data.user.uuid;

    // 获取房间，校验权限
    const battleRoom = await getBattleRoomById(roomId);
    if (!battleRoom) throw new Error("房间不存在");
    if (battleRoom.ownerId !== userId) throw new Error("只有房主可以修改房间信息");

    // 更新房间信息
    const updatedRoom = await updateBattleRoomInfo(roomId, rest);

    // emitEventToUser(data.user, "battleRoom:update:success", updatedRoom);
    // 通知房间内所有成员（可选，需有广播逻辑）
    for (const memberId of updatedRoom!.memberIds) {
      emitEventToUser(memberId, "battleRoom:update:success", updatedRoom);
    }
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:update:error", { message: e.message || "房间信息修改失败" });
  }
}