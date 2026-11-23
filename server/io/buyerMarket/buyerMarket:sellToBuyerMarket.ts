import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { SellToBuyerMarketInfo } from "~/shared/types/buyerMarket";
import { sellToBuyerMarket } from "../../utils/game/buyerMarket";
import { emitEventToUser } from "..";
import { dispatchInventoryInfoToClient } from "~/server/utils/game/characterInventory";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<SellToBuyerMarketInfo>
) {
  if (!!data.data.sellerUuid && data.data.sellerUuid !== data.user.uuid) {
    emitEventToUser(data.user, "buyerMarket:sellToBuyerMarket:error", { message: "You cannot sell for another user." });
    return;
  }

  data.data.sellerUuid = data.user.uuid; // Ensure sellerUuid is set to user's uuid
  try {

    await withUniqueLock("buyerMarket:action:" + data.user.uuid, async () => {
      const result = await sellToBuyerMarket(data.data);
      emitEventToUser(data.user, "buyerMarket:sellToBuyerMarket:success", result);
      dispatchInventoryInfoToClient(data.user.uuid);
    })
  } catch (err: any) {
    emitEventToUser(data.user, "buyerMarket:sellToBuyerMarket:error", { message: err.message });
  }
}