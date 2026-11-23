import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { MarketTradeInfo } from "~/shared/types/market"
import { emitEventToUser } from "..";
import { AllGameResourceID } from "~/shared/types/gameResource";
import { getAllUnifiedMarketResourceIds, getUnifiedMarketRowsByResource } from "~/server/utils/game/newMarket";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{resourceId: AllGameResourceID}>
) {
  try {
    const result = await getUnifiedMarketRowsByResource(data.data.resourceId, data.user.uuid);
    emitEventToUser(data.user, "newMarket:getUnifiedTransactionList:success", result);
  } catch (err: any) {
    emitEventToUser(data.user, "newMarket:getUnifiedTransactionList:error", { message: err.message });
  }
}