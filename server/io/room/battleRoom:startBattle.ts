import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getBattleRoomById, dispatchLatestBattleInfoToRoomByRoomId, prepareRoomDataToBattle, checkAndConsumeDenseFogResources, checkAndConsumeResourcesToEnterArea } from "~/server/utils/game/battle";
import { updateRoom } from "~/server/utils/game/room";
import { getGlobalBossState, initializeGlobalBossState } from "~/server/utils/game/worldBoss";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string }>,
) {
  try {
    const { roomId } = data.data;
    const userId = data.user.uuid;

    // 检查房间是否存在
    const battleRoom = await getBattleRoomById(roomId);

    if (!battleRoom) {
      emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "房间不存在" });
      return;
    }

    if (battleRoom.ownerId !== userId) {
      emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "只有房主才能启动战斗" });
      return;
    }

    const allReady = (battleRoom.memberIds || []).every(
      (uuid: string) => battleRoom.readyMap?.[uuid]
    );
    if (!allReady) {
      emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "所有成员都准备后才能开始战斗" });
      return;
    }

    if (battleRoom.battleType === "worldBoss") {
      const bossId = battleRoom.worldBossId;
      if (!bossId) {
        emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "缺少 worldBossId" });
        return;
      }
      const bossState = bossId ? await getGlobalBossState(bossId) : null;

      if (!bossState) {
        emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "“大麻烦”信息缺失，无法开始" });
        return;
      } else if (bossState.currentHp <= 0) {
        emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "这个“大麻烦”已被击败" });
        return;
      }

      const conf = await getWorldBossConfigById(bossId);
      if (conf?.startAt && Date.now() < conf.startAt) {
        emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "这个“大麻烦”还未进入活跃状态，无法进行战斗" });
        return;
      }

      if (conf?.endAt && Date.now() > conf.endAt) {
        emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "这个“大麻烦”已经完成了破坏，无法进行战斗" });
        return;
      }
    }

    let denseFogModeResourceConsumeResult = await checkAndConsumeDenseFogResources(battleRoom)

    if (!denseFogModeResourceConsumeResult) {
      emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "进入副本失败" });
      return;
    }

    let enterAreaResourceConsumeResult = await checkAndConsumeResourcesToEnterArea(battleRoom);
    if (!enterAreaResourceConsumeResult) {
      emitEventToUser(data.user, "battleRoom:startBattle:error", { message: "进入区域失败" });
      return;
    }

    // 启动战斗
    const newBattleRoom = await prepareRoomDataToBattle(roomId);
    newBattleRoom.currentRepeat = 0

    await updateRoom(battleRoom.uuid, newBattleRoom);

    for(const member of newBattleRoom.memberIds) {
      // 通知用户战斗开始
      emitEventToUser(member, "battleRoom:startBattle:success", newBattleRoom);
    }
    dispatchLatestBattleInfoToRoomByRoomId(roomId);
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:startBattle:error", { message: e.message || "战斗开始失败" });
  }
}