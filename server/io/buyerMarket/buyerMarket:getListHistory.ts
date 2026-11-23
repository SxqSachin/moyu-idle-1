import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getBuyerMarketListHistoryByBuyer } from "~/server/utils/game/buyerMarket";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<null>
) {
  const uuid = data?.user?.uuid;
  if (!uuid) {
    emitEventToUser(data.user.uuid, "buyerMarket:listHistory:error", { message: "Missing user uuid" });
    return;
  }

  try {
    const history = await getBuyerMarketListHistoryByBuyer(uuid);
    emitEventToUser(data.user.uuid, "buyerMarket:listHistory:success", history);
  } catch (err) {
    emitEventToUser(data.user.uuid, "buyerMarket:listHistory:error", { message: err });
  }
}