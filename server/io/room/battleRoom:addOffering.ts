import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { addOfferingToBattleRoom, notifyAllRoomMembersToUpdateRoom } from "~/server/utils/game/room";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string; specId: string; count?: number; resourceId?: string }>,
) {
  try {
    const payload = data?.data;
    if (!payload || typeof payload !== "object") {
      emitEventToUser(data.user, "battleRoom:addOffering:error", { message: "参数缺失" });
      return;
    }

    const { roomId, specId, count, resourceId } = payload;

    if (typeof roomId !== "string" || !roomId.trim()) {
      emitEventToUser(data.user, "battleRoom:addOffering:error", { message: "房间ID无效" });
      return;
    }
    if (typeof specId !== "string" || !specId.trim()) {
      emitEventToUser(data.user, "battleRoom:addOffering:error", { message: "战斗契约ID无效" });
      return;
    }
    if (count !== undefined) {
      const parsed = Number(count);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        emitEventToUser(data.user, "battleRoom:addOffering:error", { message: "战斗契约数量必须为正数" });
        return;
      }
    }
    if (resourceId !== undefined && typeof resourceId !== "string") {
      emitEventToUser(data.user, "battleRoom:addOffering:error", { message: "战斗契约素材无效" });
      return;
    }

    const userId = data.user.uuid;

    const updatedRoom = await addOfferingToBattleRoom({ roomId: roomId.trim(), userId, specId: specId.trim(), count, resourceId });

    emitEventToUser(data.user, "battleRoom:addOffering:success");
    notifyAllRoomMembersToUpdateRoom(updatedRoom);
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:addOffering:error", { message: e.message || "添加战斗契约失败" });
  }
}
