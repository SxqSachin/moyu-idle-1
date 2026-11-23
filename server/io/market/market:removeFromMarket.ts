import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { RemoveFromMarketResult } from "~/shared/types/market";
import { removeFromMarket } from "../../utils/game/market";
import { emitEventToUser } from "..";
import { dispatchInventoryInfoToClient } from "~/server/utils/game/characterInventory";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ tradeUuid: string }>
) {
  try {
    // 交易人检查
    if (!data.data.tradeUuid) {
      throw new Error("Trade UUID is required.");
    }

    await withUniqueLock(`market:action:${data.data.tradeUuid}`, async () => {
      const result: RemoveFromMarketResult = await removeFromMarket(data.data.tradeUuid, data.user.uuid);
      emitEventToUser(data.user, "market:removeFromMarket:success", result)

      dispatchInventoryInfoToClient(data.user.uuid)
    })
  } catch (err: any) {
    emitEventToUser(data.user, "market:removeFromMarket:error", { message: err.message });
  }
}