import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { MarketTradeInfo } from "~/shared/types/market"
import { emitEventToUser } from "..";
import { AllGameResourceID } from "~/shared/types/gameResource";
import { getAllUnifiedMarketResourceIds } from "~/server/utils/game/newMarket";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  try {
    const result = await getAllUnifiedMarketResourceIds();
    emitEventToUser(data.user, "newMarket:getAllTradeableResourceList:success", result);
  } catch (err: any) {
    emitEventToUser(data.user, "newMarket:getAllTradeableResourceList:error", { message: err.message });
  }
}