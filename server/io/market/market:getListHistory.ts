import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";

// ...existing code...
import { getMarketListHistoryBySeller } from "~/server/utils/game/market";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<null>
) {
  const uuid = data?.user?.uuid
  if (!uuid) {
    emitEventToUser(data.user.uuid, "market:listHistory:error", { message: "Missing user uuid" })
    return;
  }

  try {
    const history = await getMarketListHistoryBySeller(uuid);
    emitEventToUser(data.user.uuid, "market:listHistory:success", history)
  } catch (err) {
    emitEventToUser(data.user.uuid, "market:listHistory:error", { message: err })
  }
}
// ...existing code...