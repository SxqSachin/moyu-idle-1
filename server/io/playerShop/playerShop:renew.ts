import type { Socket, DefaultEventsMap } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { withUniqueLock } from "~/server/utils/lock";
import { renewPlayerShop } from "~/server/utils/game/playerShop";
import type { RenewPlayerShopPayload } from "~/shared/types/playerShop";

export async function ioRenewPlayerShop(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<RenewPlayerShopPayload>
) {
  const userUuid = data.user.uuid;
  await withUniqueLock(`playerShop:renew:${userUuid}:${data.data.shopUuid}`, async () => {
    try {
      const res = await renewPlayerShop(userUuid, data.data);
      emitEventToUser(userUuid, "playerShop:renew:success", { shop: res });
    } catch (e: any) {
      emitEventToUser(userUuid, "playerShop:renew:error", { message: e.message });
    }
  });
}
