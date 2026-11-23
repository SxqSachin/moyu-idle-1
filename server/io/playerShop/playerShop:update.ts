import type { Socket, DefaultEventsMap } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { withUniqueLock } from "~/server/utils/lock";
import { updatePlayerShop } from "~/server/utils/game/playerShop";
import type { UpdatePlayerShopPayload } from "~/shared/types/playerShop";

export async function ioUpdatePlayerShop(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<UpdatePlayerShopPayload>
) {
  const userUuid = data.user.uuid;
  await withUniqueLock(`playerShop:update:${data.data.shopUuid}`, async () => {
    try {
      const shop = await updatePlayerShop(userUuid, data.data);
      emitEventToUser(userUuid, "playerShop:update:success", { shop });
    } catch (e: any) {
      emitEventToUser(userUuid, "playerShop:update:error", { message: e.message });
    }
  });
}
