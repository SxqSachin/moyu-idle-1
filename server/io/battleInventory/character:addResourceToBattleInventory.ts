import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import {
  upsertBattleInventoryItem,
  getBattleInventoryAsUnitInfo,
} from "~/server/utils/game/battleInventory";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ resourceId: string; count: number }>
) {
  const userUuid = data.user.uuid;
  const { resourceId, count } = data.data;

  if (!resourceId || !count || count <= 0) {
    emitEventToUser(data.user, "character:addResourceToBattleInventory:fail", {
      message: "物品ID或数量无效",
    });
    return;
  }

  await withUniqueLock(
    `characterBattleInventoryModify:${userUuid}`,
    async () => {
      try {
        await upsertBattleInventoryItem(userUuid, resourceId, count);
        const inventory = await getBattleInventoryAsUnitInfo(userUuid);
        emitEventToUser(
          data.user,
          "character:addResourceToBattleInventory:success",
          inventory
        );
      } catch (e: any) {
        emitEventToUser(
          data.user,
          "character:addResourceToBattleInventory:fail",
          { message: e.message || "添加物品到战斗物品袋失败" }
        );
      }
    }
  );
}
