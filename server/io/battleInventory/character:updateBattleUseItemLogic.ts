import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import {
  upsertBattleInventoryItem,
  getBattleInventoryAsUnitInfo,
  refillBattleInventoryItem,
  updateBattleInventoryItemLogic,
} from "~/server/utils/game/battleInventory";
import { GameFullBattleLogic } from "~/shared/types/skill";
import { AllBattlePhase } from "~/shared/types/battle";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ resourceId: string; logic: GameFullBattleLogic; useWhen?: AllBattlePhase[] }>
) {
  const userUuid = data.user.uuid;
  const { resourceId, logic, useWhen } = data.data;

  if (!resourceId) {
    emitEventToUser(data.user, "character:updateBattleUseItemLogic:fail", {
      message: "物品ID无效",
    });
    return;
  }

  await withUniqueLock(
    `characterBattleInventoryModify:${userUuid}`,
    async () => {
      try {
        await updateBattleInventoryItemLogic(userUuid, resourceId, logic, useWhen);
        const inventory = await getBattleInventoryAsUnitInfo(userUuid);
        emitEventToUser(
          data.user,
          "character:updateBattleUseItemLogic:success",
          inventory
        );
      } catch (e: any) {
        emitEventToUser(
          data.user,
          "character:updateBattleUseItemLogic:fail",
          { message: e.message || "物品使用逻辑设置失败" }
        );
      }
    }
  );
}
