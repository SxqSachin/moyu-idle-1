import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { renewTalentCat } from "~/server/utils/game/tarven";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ catId: string; hours: number }>
) {
  try {
    const userId = data.user.uuid;
    const { catId, hours } = data.data;

    const record = await renewTalentCat(userId, catId, hours);

    emitEventToUser(data.user, "tavern:renewExpert:success", record);
  } catch (e: any) {
    emitEventToUser(data.user, "tavern:renewExpert:error", { message: e.message || "续约猫咪专家失败" });
  }
}