import type { Socket, DefaultEventsMap } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { withUniqueLock } from "~/server/utils/lock";
import { createPlayerShop } from "~/server/utils/game/playerShop";
import type { CreatePlayerShopPayload } from "~/shared/types/playerShop";

export async function ioCreatePlayerShop(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<CreatePlayerShopPayload>
) {
  const userUuid = data.user.uuid;
  await withUniqueLock(`playerShop:create:${userUuid}`, async () => {
    try {
      const res = await createPlayerShop(userUuid, data.data);
      emitEventToUser(userUuid, "playerShop:create:success", { shop: res });
    } catch (e: any) {
      emitEventToUser(userUuid, "playerShop:create:error", { message: e.message });
    }
  });
}
