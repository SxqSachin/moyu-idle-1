import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { ListToMarketInfo } from "~/shared/types/market"
import { listToMarket } from "../../utils/game/market";
import { emitEventToUser } from "..";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<ListToMarketInfo>
) {
  const user = data.user;
  const info = data.data;

  await withUniqueLock(`market:action:${user.uuid}`, async () => {
    try {
      const result = await listToMarket(info, user.uuid);
      emitEventToUser(data.user, "market:listToMarket:success", result);
    } catch (err: any) {
      emitEventToUser(data.user, "market:listToMarket:error", { message: err.message });
    }
  });
}