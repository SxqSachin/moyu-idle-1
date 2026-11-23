import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import { returnOfferingFromBattleRoom, notifyAllRoomMembersToUpdateRoom } from "~/server/utils/game/room";
import type { GameSocketData } from "~/shared/types/socket";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string; specId: string }>,
) {
  try {
    const payload = data?.data;
    if (!payload || typeof payload !== "object") {
      emitEventToUser(data.user, "battleRoom:returnOffering:error", { message: "参数缺失" });
      return;
    }

    const { roomId, specId } = payload;

    if (typeof roomId !== "string" || !roomId.trim()) {
      emitEventToUser(data.user, "battleRoom:returnOffering:error", { message: "房间ID无效" });
      return;
    }
    if (typeof specId !== "string" || !specId.trim()) {
      emitEventToUser(data.user, "battleRoom:returnOffering:error", { message: "战斗契约ID无效" });
      return;
    }

    const userId = data.user.uuid;
    const updatedRoom = await returnOfferingFromBattleRoom({ roomId: roomId.trim(), userId, specId: specId.trim() });

    emitEventToUser(data.user, "battleRoom:returnOffering:success");
    notifyAllRoomMembersToUpdateRoom(updatedRoom);
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:returnOffering:error", { message: e?.message || "退还战斗契约失败" });
  }
}
