import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getBattleRoomById, updateBattleRoomInfo } from "~/server/utils/game/battle";
import { getRoomById, updateRoom } from "~/server/utils/game/room";
import { NormalBattleRoom, type AutoWorldBossBattleConf } from "~/shared/types/battleRoom";
import { getWorldBossConfigById } from "~/server/utils/game/worldBoss";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string; autoWorldBossBattleConf: AutoWorldBossBattleConf }>,
) {
  try {
    const { roomId, autoWorldBossBattleConf } = data.data;
    const userId = data.user.uuid;

    const room = await getRoomById<NormalBattleRoom>(roomId);
    if (!room) throw new Error("房间不存在");

    if (room.type !== "battle") throw new Error("仅战斗房间支持此操作");

    const bRoom = room;

    // 只允许普通房间配置此项
    if (bRoom.battleType !== "normal") {
      throw new Error("仅普通房间允许配置自动加入“大麻烦”战斗");
    }

    if (bRoom.ownerId !== userId) {
      throw new Error("只有房主可以修改此设置");
    }

    // 校验数据
    if (!autoWorldBossBattleConf || typeof autoWorldBossBattleConf.type !== "string") {
      throw new Error("无效的配置");
    }

    if (autoWorldBossBattleConf.type === "switch") {
      const bossId = autoWorldBossBattleConf.config?.bossId;
      if (!bossId) throw new Error("需要提供“大麻烦”ID");
      const cfg = await getWorldBossConfigById(bossId);
      if (!cfg) throw new Error("未找到对应的“大麻烦”");

      if (cfg.endAt) {
        const endAt = new Date(cfg.endAt).getTime();
        if (Date.now() > endAt) {
            throw new Error("该“大麻烦”已结束，无法设置自动加入");
        }
      }

      const state = await getGlobalBossState(bossId);
      if (!state) {
        throw new Error("该“大麻烦”当前不可加入，无法设置自动加入");
      }
      if (state.currentHp <= 0) {
        throw new Error("该“大麻烦”已被击败，无法设置自动加入");
      }
    }

    // set and persist
    bRoom.autoWorldBossBattleConf = autoWorldBossBattleConf;

    await updateRoom(roomId, bRoom);

    // 广播给房间内所有成员
    emitEventToUser(userId, "battleRoom:setAutoWorldBossBattleConf:success", bRoom);
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:setAutoWorldBossBattleConf:error", { message: e.message || "设置失败" });
  }
}
