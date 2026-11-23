import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { generateQuestParam, quickCreateActionQuest, quickGenerateActionQuest, rerollQuest } from "~/server/utils/game/quest";
import { emitEventToUser } from "..";
import { decreaseItemCount, getInventoryInfo } from "~/server/utils/game/characterInventory";
import { QUEST_REROLL_GOLD_COST_PRE } from "~/shared/data/constant";
import { prisma } from "~/server/utils/game/db";
import { ModifyItemCountType } from "~/shared/types/gameInventory";

// 重新随机任务
export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ questUuid: string }>
) {
  const user = data.user;
  const { questUuid } = data.data;

  await withUniqueLock("questReroll:" + user.uuid, async () => {
    const thisQuest = await prisma.quest.findUnique({ where: { uuid: questUuid } });
    if (!thisQuest) {
      emitEventToUser(user, "quest:reroll:error", { message: "任务不存在或已被删除" });
      return;
    }

    // 检查库存中是否有足量金币
    const inventory = await getInventoryInfoPreferCache(user.uuid);
    const gold = inventory.gold?.count ?? 0;
    const rerollCost = QUEST_REROLL_GOLD_COST_PRE * (1 + thisQuest.rerollCount);

    if (gold < rerollCost) {
      emitEventToUser(user, "quest:reroll:error", { message: "金币不足，无法重随任务" });
      return;
    }

    const param = generateQuestParam(user.uuid)

    try {
      let newQuest = await quickGenerateActionQuest(param);
      newQuest = await rerollQuest(questUuid, newQuest);

      decreaseItemCount(user.uuid, { gold: { count: rerollCost } }, {
        actionName: "重随任务",
        showModifyInfo: true,
        type: ModifyItemCountType.Other
      });

      emitEventToUser(user, "quest:reroll:success", { newQuest });
    } catch (err: any) {
      emitEventToUser(user, "quest:reroll:error", { message: err.message });
    }
  })
}