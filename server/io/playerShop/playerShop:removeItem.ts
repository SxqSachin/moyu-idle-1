import type { Socket, DefaultEventsMap } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { withUniqueLock } from "~/server/utils/lock";
import { removeItemFromShop } from "~/server/utils/game/playerShop";
import type { RemoveItemFromShopPayload } from "~/shared/types/playerShop";
import { dispatchInventoryInfoToClient } from "~/server/utils/game/characterInventory";

export async function ioRemoveItemFromShop(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<RemoveItemFromShopPayload>
) {
  const userUuid = data.user.uuid;
  await withUniqueLock(`playerShop:removeItem:${userUuid}:${data.data.itemUuid}`, async () => {
    try {
      const res = await removeItemFromShop(userUuid, data.data);
      emitEventToUser(userUuid, "playerShop:removeItem:success", res);
    } catch (e: any) {
      emitEventToUser(userUuid, "playerShop:removeItem:error", { message: e.message });
    }
  });
}
