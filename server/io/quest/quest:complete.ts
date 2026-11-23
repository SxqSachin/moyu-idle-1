import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { completeAllDoneQuest, completeQuest, getQuestList, } from "~/server/utils/game/quest";
import { emitEventToUser } from "..";
import { dispatchInventoryUpdatedEventToClient } from "~/server/utils/game/characterInventory";

// 完成任务
export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ questId: string }>
) {
  const user = data.user;
  const { questId } = data.data;

  try {
    await withUniqueLock("questComplete:" + user.uuid, async () => {
      const quest = await completeQuest(questId);
      emitEventToUser(user, "quest:complete:success", quest);

      const quests = await getQuestList(user.uuid);
      emitEventToUser(user, "quest:list:success", quests);

      // dispatchInventoryUpdatedEventToClient(user.uuid)
    })
  } catch (err: any) {
    emitEventToUser(user, "quest:complete:error", { message: err.message });
  }
}

export async function handleCompleteAllDoneQuest(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const user = data.user;

  await withUniqueLock("questComplete:all:" + user.uuid, async () => {
    try {
      const quest = await completeAllDoneQuest(user.uuid);
      emitEventToUser(user, "quest:completeAll:success", quest);

      const quests = await getQuestList(user.uuid);
      emitEventToUser(user, "quest:list:success", quests);

      // dispatchInventoryUpdatedEventToClient(user.uuid)
    } catch (err: any) {
      emitEventToUser(user, "quest:completeAll:error", {
        message: err.message,
      });
    }
  });
}