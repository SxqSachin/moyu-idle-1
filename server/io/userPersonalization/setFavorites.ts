import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { setFavorites, getUserPersonalization } from "~/server/utils/userPersonalization";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ favorites: unknown }>
) {
  const userUuid = data.user.uuid;
  try {
    await setFavorites(userUuid, data.data?.favorites ?? []);
    const p = await getUserPersonalization(userUuid);
    emitEventToUser(userUuid, "userPersonalization:setFavorites:success", p);
  } catch (err: any) {
    emitEventToUser(userUuid, "userPersonalization:error", { message: err?.message || "unknown" });
  }
}
