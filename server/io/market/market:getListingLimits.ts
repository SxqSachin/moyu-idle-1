import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { getMarketListingLimits } from "~/server/utils/game/marketLimit";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<null>
) {
  const { user } = data;
  try {
    const limits = await getMarketListingLimits(user.uuid);
    emitEventToUser(user, 'market:listingLimits:success', limits);
  } catch (err: any) {
    emitEventToUser(user, 'market:listingLimits:error', { message: err?.message || String(err) });
  }
}
