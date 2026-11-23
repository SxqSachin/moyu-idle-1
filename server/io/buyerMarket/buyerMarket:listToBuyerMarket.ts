import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { ListToBuyerMarketInfo } from "~/shared/types/buyerMarket";
import { listToBuyerMarket } from "../../utils/game/buyerMarket";
import { emitEventToUser } from "..";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ListToBuyerMarketInfo>
) {
  const user = data.user;
  const info = data.data;

  try {
    await withUniqueLock("buyerMarket:action:" + data.user.uuid, async () => {
      const result = await listToBuyerMarket(info, user.uuid);
      emitEventToUser(data.user, "buyerMarket:listToBuyerMarket:success", result);
    });
  } catch (err: any) {
    emitEventToUser(data.user, "buyerMarket:listToBuyerMarket:error", { message: err.message });
  }
}