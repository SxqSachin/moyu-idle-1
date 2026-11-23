import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { setCategoryOrder, getUserPersonalization } from "~/server/utils/userPersonalization";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ order: unknown }>
) {
  const userUuid = data.user.uuid;
  try {
    await setCategoryOrder(userUuid, data.data?.order ?? []);
    const p = await getUserPersonalization(userUuid);
    emitEventToUser(userUuid, "userPersonalization:setCategoryOrder:success", p);
  } catch (err: any) {
    emitEventToUser(userUuid, "userPersonalization:error", { message: err?.message || "unknown" });
  }
}
