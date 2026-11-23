import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getRoomById, notifyAllRoomMembersToUpdateRoom, setUserReadyStatus, updateRoom } from "~/server/utils/game/room";
import { BattleRoom } from "~/shared/types/battleRoom";
import { checkAndConsumeDenseFogResources, checkAndConsumeResourcesToEnterArea } from "~/server/utils/game/battle";
import { getGlobalBossState, initializeGlobalBossState } from "~/server/utils/game/worldBoss";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string; ready: boolean }>
) {
  try {
    const userId = data.user.uuid;
    const { roomId, ready } = data.data;
    await setUserReadyStatus(userId, roomId, ready);
    const room = await getRoomById<BattleRoom>(roomId);
    // emitEventToUser(data.user, "battleRoom:updateReadyState:success", room);

    if (room) {
      // 如果全员准备就绪
      const allReady = (room.memberIds || []).every(
        (uuid: string) => room.readyMap?.[uuid]
      );

      if (allReady && room.autoStartBattle) {

        if (room.battleType === "worldBoss") {
          const bossId = room.worldBossId;
          const bossState = bossId ? await getGlobalBossState(bossId) : null;
          if (!bossId || !bossState) {
            await setUserReadyStatus(userId, roomId, false);
            emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "“大麻烦”信息缺失，无法开始" });
            return;
          }
          if (bossState.currentHp <= 0) {
            await setUserReadyStatus(userId, roomId, false);
            emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "这个“大麻烦”已被击败" });
            return;
          }

          const conf = await getWorldBossConfigById(bossId);
          if (conf?.startAt && Date.now() < conf.startAt) {
            await setUserReadyStatus(userId, roomId, false);
            emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "这个“大麻烦”还未进入活跃状态，无法进行战斗" });
            return;
          }

          if (conf?.endAt && Date.now() > conf.endAt) {
            await setUserReadyStatus(userId, roomId, false);
            emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "这个“大麻烦”已经完成了破坏，无法进行战斗" });
            return;
          }
        }

        let denseFogModeResourceConsumeResult = await checkAndConsumeDenseFogResources(room)

        if (!denseFogModeResourceConsumeResult) {
            await setUserReadyStatus(userId, roomId, false);
          emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "进入副本失败" });
          return;
        }

        let enterAreaResourceConsumeResult = await checkAndConsumeResourcesToEnterArea(room);
        if (!enterAreaResourceConsumeResult) {
          await setUserReadyStatus(userId, roomId, false);
          emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "进入区域失败" });
          return;
        }

        room.status = 'waiting_for_autostart';
        room.waitingForAutoStartTime = Date.now() + 1000 * 4; // 设置自动开始时间为4s后
      } else {
        room.status = 'waiting';
        room.waitingForAutoStartTime = undefined; // 重置自动开始时间
      }

      await updateRoom(room.uuid, room);
      notifyAllRoomMembersToUpdateRoom(room)
    }

  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:updateReadyState:error", { message: e.message || "设置准备状态失败" });
  }
}