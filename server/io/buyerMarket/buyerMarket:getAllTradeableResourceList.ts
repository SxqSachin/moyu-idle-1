import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { getAllBuyerMarketResourceIds } from "../../utils/game/buyerMarket";
import { emitEventToUser } from "..";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  try {
    const result = await getAllBuyerMarketResourceIds();
    emitEventToUser(data.user, "buyerMarket:getAllTradeableResourceList:success", result);
  } catch (err: any) {
    emitEventToUser(data.user, "buyerMarket:getAllTradeableResourceList:error", { message: err.message });
  }
}