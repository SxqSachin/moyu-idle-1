import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getUserPersonalization } from "~/server/utils/userPersonalization";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;
  try {
    const p = await getUserPersonalization(userUuid);
    emitEventToUser(userUuid, "userPersonalization:get:success", p);
  } catch (err: any) {
    emitEventToUser(userUuid, "userPersonalization:error", { message: err?.message || "unknown" });
  }
}
