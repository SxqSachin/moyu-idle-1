import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { checkExpertExpired, getUserTalentCats } from "~/server/utils/game/tarven";
import allTalentCat from "~/shared/data/allTalentCat";
import { updateTalentCatCache } from "~/childProcess/run-task-standalone/src/utils/game/tarven";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<undefined>
) {
  try {
    const userUuid = data.user.uuid;

    await checkExpertExpired(userUuid);

    const records = await getUserTalentCats(userUuid);

    // 补充猫咪专家详细信息
    const result = records.map((r: any) => ({
      ...r,
      cat: allTalentCat.find(c => c.id === r.type) || null,
    }));

    emitEventToUser(data.user, "tavern:getMyExperts:success", result);
  } catch (e: any) {
    emitEventToUser(data.user, "tavern:getMyExperts:error", { message: e.message || "获取猫咪专家列表失败" });
  }
}