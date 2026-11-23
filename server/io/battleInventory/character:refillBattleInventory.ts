import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import {
  upsertBattleInventoryItem,
  getBattleInventoryAsUnitInfo,
  refillBattleInventoryItem,
} from "~/server/utils/game/battleInventory";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ resourceId: string; count: number }>
) {
  const userUuid = data.user.uuid;
  const { resourceId, count } = data.data;

  if (!resourceId || !count || count <= 0) {
    emitEventToUser(data.user, "character:refillBattleInventory:fail", {
      message: "物品ID或数量无效",
    });
    return;
  }

  await withUniqueLock(
    `characterBattleInventoryModify:${userUuid}`,
    async () => {
      try {
        await refillBattleInventoryItem(userUuid, resourceId, count);
        const inventory = await getBattleInventoryAsUnitInfo(userUuid);
        emitEventToUser(
          data.user,
          "character:refillBattleInventory:success",
          inventory
        );
      } catch (e: any) {
        emitEventToUser(
          data.user,
          "character:refillBattleInventory:fail",
          { message: e.message || "补充物品到战斗物品袋失败" }
        );
      }
    }
  );
}
