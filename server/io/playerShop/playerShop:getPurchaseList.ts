import type { Socket, DefaultEventsMap } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getPurchaseList } from "~/server/utils/game/playerShop";
import type { GetShopPurchaseListQuery } from "~/shared/types/playerShop";

export async function ioGetPlayerShopPurchaseList(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<GetShopPurchaseListQuery>
) {
  const userUuid = data.user.uuid;
  try {
    const res = await getPurchaseList(userUuid, data.data);
    emitEventToUser(userUuid, "playerShop:purchaseList:success", res);
  } catch (e: any) {
    emitEventToUser(userUuid, "playerShop:purchaseList:error", { message: e.message });
  }
}
