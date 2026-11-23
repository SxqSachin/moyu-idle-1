import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getUserTalentCats, getUserWorkingTalentCats, pauseTalentCat, resumeTalentCat } from "~/server/utils/game/tarven";
import allTalentCat from "~/shared/data/allTalentCat";

// 暂停专家
export async function handlePauseTalentCat(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ catId: string }>
) {
  const userUuid = data.user.uuid;
  const { catId } = data.data;

  try {
    const updatedRecord = await pauseTalentCat(userUuid, catId);
    emitEventToUser(userUuid, "tavern:pause:success", { 
      catId, 
      record: updatedRecord 
    });

    const records = await getUserTalentCats(userUuid);
    // 补充猫咪专家详细信息
    const result = records.map((r: any) => ({
      ...r,
      cat: allTalentCat.find(c => c.id === r.type) || null,
    }));

    emitEventToUser(data.user, "tavern:getMyExperts:success", result);

  } catch (e: any) {
    emitEventToUser(userUuid, "tavern:pause:fail", { 
      message: e.message || "暂停专家失败" 
    });
  }
}

// 恢复专家
export async function handleResumeTalentCat(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ catId: string }>
) {
  const userUuid = data.user.uuid;
  const { catId } = data.data;

  try {
    const updatedRecord = await resumeTalentCat(userUuid, catId);
    emitEventToUser(userUuid, "tavern:resume:success", { 
      catId, 
      record: updatedRecord 
    });

    const records = await getUserTalentCats(userUuid);
    // 补充猫咪专家详细信息
    const result = records.map((r: any) => ({
      ...r,
      cat: allTalentCat.find(c => c.id === r.type) || null,
    }));

    emitEventToUser(data.user, "tavern:getMyExperts:success", result);
  } catch (e: any) {
    emitEventToUser(userUuid, "tavern:resume:fail", { 
      message: e.message || "恢复专家失败" 
    });
  }
}