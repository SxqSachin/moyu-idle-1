import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import {
  getBattleInventoryAsUnitInfo,
  removeFromBattleInventoryItem,
} from "~/server/utils/game/battleInventory";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ resourceId: string }>
) {
  const userUuid = data.user.uuid;
  const { resourceId } = data.data;

  if (!resourceId) {
    emitEventToUser(data.user, "character:removeResourceFromBattleInventory:fail", {
      message: "物品ID无效",
    });
    return;
  }

  await withUniqueLock(
    `characterBattleInventoryModify:${userUuid}`,
    async () => {
      try {
        await removeFromBattleInventoryItem(userUuid, resourceId);
        const inventory = await getBattleInventoryAsUnitInfo(userUuid);
        emitEventToUser(
          data.user,
          "character:removeResourceFromBattleInventory:success",
          inventory
        );
      } catch (e: any) {
        emitEventToUser(
          data.user,
          "character:removeResourceFromBattleInventory:fail",
          { message: e.message || "从战斗物品袋移除物品失败" }
        );
      }
    }
  );
}
