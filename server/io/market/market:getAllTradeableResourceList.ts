import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { MarketTradeInfo } from "~/shared/types/market"
import { getAllMarketResourceIds, getTransactionInfoList, } from "../../utils/game/market";
import { emitEventToUser } from "..";
import { AllGameResourceID } from "~/shared/types/gameResource";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  try {
    const result = await getAllMarketResourceIds();
    emitEventToUser(data.user, "market:getAllTradeableResourceList:success", result);
  } catch (err: any) {
    emitEventToUser(data.user, "market:getAllTradeableResourceList:error", { message: err.message });
  }
}