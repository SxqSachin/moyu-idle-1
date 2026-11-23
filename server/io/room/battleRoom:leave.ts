import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { clearUserRoomUuid, leaveRoom, notifyAllRoomMembersToUpdateRoom, setUserRoomCooldown } from "~/server/utils/game/room";
import { withUniqueLock } from "~/server/utils/lock";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<undefined>
) {
  const userId = data.user.uuid;
  try {
    // 与 join 复用同一把锁，避免离开/加入并发导致双房间
    const lockKey = `battleRoom:user:${userId}`;
    await withUniqueLock(lockKey, async () => {
      const res = await leaveRoom(userId);
      emitEventToUser(data.user, "battleRoom:leave:success", { roomId: res.uuid });

      // 设置15秒冷却，期间禁止加入/创建房间
      await setUserRoomCooldown(userId);

      if (res) {
        notifyAllRoomMembersToUpdateRoom(res);
      }

      return res;
    }, { expireSec: 5 });
  } catch (e: any) {
    // 离开房间失败，也需要清理房间状态
    await clearUserRoomUuid(userId);

    emitEventToUser(userId, "battle:leaveBattle:success");
    emitEventToUser(userId, "battle:update:success", null);

    emitEventToUser(data.user, "battleRoom:leave:error", { message: e.message || "离开房间失败" });
  }
}