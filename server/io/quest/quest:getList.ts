import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { getQuestList, } from "~/server/utils/game/quest";
import { emitEventToUser } from "..";

// 获取任务列表
export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<null>
) {
  const user = data.user;

  try {
    const quests = await getQuestList(user.uuid, true);
    emitEventToUser(user, "quest:list:success", quests);
  } catch (err: any) {
    emitEventToUser(user, "quest:list:error", { message: err.message });
  }
}