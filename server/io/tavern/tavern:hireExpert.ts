import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { recruitTalentCat } from "~/server/utils/game/tarven";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ catId: string; hours: number }>
) {
  try {
    const userId = data.user.uuid;
    const { catId, hours } = data.data;

    const record = await recruitTalentCat(userId, catId, hours);

    emitEventToUser(data.user, "tavern:hireExpert:success", record);
  } catch (e: any) {
    emitEventToUser(data.user, "tavern:hireExpert:error", { message: e.message || "招募猫咪专家失败" });
  }
}