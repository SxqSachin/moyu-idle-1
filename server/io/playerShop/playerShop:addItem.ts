import type { Socket, DefaultEventsMap } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { withUniqueLock } from "~/server/utils/lock";
import { addItemToShop } from "~/server/utils/game/playerShop";
import type { AddItemToShopPayload } from "~/shared/types/playerShop";
import { dispatchInventoryInfoToClient } from "~/server/utils/game/characterInventory";

export async function ioAddItemToShop(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<AddItemToShopPayload>
) {
  const userUuid = data.user.uuid;
  await withUniqueLock(`playerShop:addItem:${userUuid}:${data.data.shopUuid}`, async () => {
    try {
      const res = await addItemToShop(userUuid, data.data);
      emitEventToUser(userUuid, "playerShop:addItem:success", { item: res });
    //   dispatchInventoryInfoToClient(userUuid);
    } catch (e: any) {
      emitEventToUser(userUuid, "playerShop:addItem:error", { message: e.message });
    }
  });
}
