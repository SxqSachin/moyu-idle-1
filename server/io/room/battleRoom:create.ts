import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { createBattleRoom } from "~/server/utils/game/battle";
import { getRoomById, isUserRoomInCooldown, joinRoom } from "~/server/utils/game/room";
import { AllBattleAreaID } from "~/shared/types/battle";
import { BattleRoom, CreateBattleRoomInput } from "~/shared/types/battleRoom";
import { MIN_BATTLE_ROUND } from "~/shared/data/constant";
import { isIronCat } from "~/server/utils/game/account";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<CreateBattleRoomInput>,
) {
  try {
    const userId = data.user.uuid;

    const inCooldown = await isUserRoomInCooldown(userId);
    if (inCooldown) {
      throw new Error("离开房间后15秒内不可创建房间");
    }

    const ironcat = await isIronCat(userId);

    const battleRoom = await createBattleRoom({
      ownerId: userId,
      ironcat,
      ...data.data,
    });

    // 创建后自动加入房间
    await joinRoom(userId, battleRoom.uuid);
    const fullRoom = await getRoomById(battleRoom.uuid);

    emitEventToUser(data.user, "battleRoom:create:success", fullRoom);
    emitEventToUser(data.user, "battleRoom:join:success", fullRoom);
  } catch (e: any) {
    emitEventToUser(data.user, "battleRoom:create:error", { message: e.message || "创建战斗房间失败" });
  }
}