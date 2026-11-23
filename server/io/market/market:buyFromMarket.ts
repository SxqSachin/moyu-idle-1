import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { BuyFromMarketInfo } from "~/shared/types/market";
import { buyFromMarket } from "../../utils/game/market";
import { emitEventToUser } from "..";
import { dispatchInventoryInfoToClient } from "~/server/utils/game/characterInventory";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<BuyFromMarketInfo>
) {
  if (!!data.data.buyerUuid && data.data.buyerUuid !== data.user.uuid) {
    emitEventToUser(data.user, "market:buyFromMarket:error", { message: "You cannot buy this item for another user." });
    return
  }

  await withUniqueLock(`market:action:${data.data.tradeUuid}`, async () => {
    data.data.buyerUuid = data.user.uuid; // Ensure the buyerUuid is set to the user's UUID
    try {
      const result = await buyFromMarket(data.data);
      emitEventToUser(data.user, "market:buyFromMarket:success", result);

      dispatchInventoryInfoToClient(data.user.uuid)
    } catch (err: any) {
      emitEventToUser(data.user, "market:buyFromMarket:error", { message: err.message });
    }
  })
}