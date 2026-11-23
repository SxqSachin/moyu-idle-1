import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { generateQuestParam, quickCreateActionQuest, quickGenerateActionQuest, rerollQuest, updateQuestListCache } from "~/server/utils/game/quest";
import { emitEventToUser } from "..";
import { decreaseItemCount, getInventoryInfo } from "~/server/utils/game/characterInventory";
import { QUEST_REROLL_GOLD_COST_PRE } from "~/shared/data/constant";
import { prisma } from "~/server/utils/game/db";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { GameBroadcastKind, UserQuestUpdateMessage } from "~/shared/types/broadcast";

// 重新随机任务
export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ questUuid: string }>
) {
  const user = data.user;
  const { questUuid } = data.data;

  const thisQuest = await prisma.quest.findUnique({ select: { uuid: true, executor: true, }, where: { uuid: questUuid, executor: user.uuid } });
  if (!thisQuest) {
    emitEventToUser(user, "quest:delete:error", { message: "任务不存在或已被删除" });
    return;
  }

  try {
    await prisma.quest.delete({
      where: { uuid: questUuid }
    })

    await updateQuestListCache(thisQuest.executor); // 立即刷新缓存

    await publishGameBroadcast<UserQuestUpdateMessage>({
      kind: GameBroadcastKind.USER_QUEST_UPDATED,
      userUuid: user.uuid,
    })

    emitEventToUser(user, "quest:delete:success");
  } catch (err: any) {
    emitEventToUser(user, "quest:delete:error", { message: err.message });
  }
}