import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { MarketTradeInfo } from "~/shared/types/market"
import { getTransactionInfoList, } from "../../utils/game/market";
import { emitEventToUser } from "..";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{resourceId: string}>
) {
  try {
    if (!data.data || !data.data.resourceId) {
      emitEventToUser(data.user, "market:getTransactionList:error", { message: "资源ID不能为空" });
      return;
    }
    const result = await getTransactionInfoList(data.data.resourceId);
    emitEventToUser(data.user, "market:getTransactionList:success", result);
  } catch (err: any) {
    emitEventToUser(data.user, "market:getTransactionList:error", { message: err.message });
  }
}