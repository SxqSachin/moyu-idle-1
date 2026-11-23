import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { getBuyerMarketTransactionInfoList } from "../../utils/game/buyerMarket";
import { emitEventToUser } from "..";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ resourceId: string }>
) {
  try {
    if (!data.data || !data.data.resourceId) {
      emitEventToUser(data.user, "buyerMarket:getTransactionList:error", { message: "资源ID不能为空" });
      return;
    }
    const result = await getBuyerMarketTransactionInfoList(data.data.resourceId);
    emitEventToUser(data.user, "buyerMarket:getTransactionList:success", result);
  } catch (err: any) {
    emitEventToUser(data.user, "buyerMarket:getTransactionList:error", { message: err.message });
  }
}