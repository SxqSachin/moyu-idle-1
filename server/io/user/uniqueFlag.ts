import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { getAllUserUniqueFlags } from "~/server/utils/game/uniqueFlag";

export async function uniqueFlag_all(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;
  try {
    const result = await getAllUserUniqueFlags(userUuid);
    emitEventToUser(userUuid, "uniqueFlag:all:success", { flags: result });
  } catch (e: any) {
    emitEventToUser(userUuid, "uniqueFlag:all:fail", { message: e.message });
  }
}