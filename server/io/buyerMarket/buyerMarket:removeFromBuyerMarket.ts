import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { RemoveFromBuyerMarketResult } from "~/shared/types/buyerMarket";
import { removeFromBuyerMarket } from "../../utils/game/buyerMarket";
import { emitEventToUser } from "..";
import { dispatchInventoryInfoToClient } from "~/server/utils/game/characterInventory";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ tradeUuid: string }>
) {
  try {
    if (!data.data.tradeUuid) {
      throw new Error("Trade UUID is required.");
    }

    await withUniqueLock("buyerMarket:action:" + data.user.uuid, async () => {
      const result: RemoveFromBuyerMarketResult = await removeFromBuyerMarket(data.data.tradeUuid, data.user.uuid);
      emitEventToUser(data.user, "buyerMarket:removeFromBuyerMarket:success", result);
      dispatchInventoryInfoToClient(data.user.uuid);
    });

  } catch (err: any) {
    emitEventToUser(data.user, "buyerMarket:removeFromBuyerMarket:error", { message: err.message });
  }
}