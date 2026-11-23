import type { Socket, DefaultEventsMap } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { buyFromShop } from "~/server/utils/game/playerShop";
import type { BuyFromShopPayload } from "~/shared/types/playerShop";
import { dispatchInventoryInfoToClient } from "~/server/utils/game/characterInventory";

export async function ioBuyFromPlayerShop(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<BuyFromShopPayload>
) {
  const userUuid = data.user.uuid;
  try {
    const res = await buyFromShop(userUuid, data.data);
    emitEventToUser(userUuid, "playerShop:buy:success", res);
    // 更新买家与卖家背包
    dispatchInventoryInfoToClient(userUuid);
    dispatchInventoryInfoToClient(res.sellerUuid);
  } catch (e: any) {
    emitEventToUser(userUuid, "playerShop:buy:error", { message: e.message });
  }
}
