import type { Socket, DefaultEventsMap } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { withUniqueLock } from "~/server/utils/lock";
import { updatePlayerShopItem } from "~/server/utils/game/playerShop";
import type { UpdatePlayerShopItemPayload } from "~/shared/types/playerShop";

export async function ioUpdatePlayerShopItem(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<UpdatePlayerShopItemPayload>
) {
  const userUuid = data.user.uuid;
  await withUniqueLock(
    `playerShop:updateItem:${userUuid}:${data.data.itemUuid}`,
    async () => {
      try {
        const item = await updatePlayerShopItem(userUuid, data.data);
        emitEventToUser(userUuid, "playerShop:updateItem:success", { item });
      } catch (e: any) {
        emitEventToUser(userUuid, "playerShop:updateItem:error", { message: e.message });
      }
    }
  );
}
