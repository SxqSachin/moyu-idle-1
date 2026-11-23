import type { DefaultEventsMap, Socket } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { createWorldBossConfig, listWorldBossConfigs } from "~/server/utils/game/worldBoss";
import type { CreateWorldBossBattleConfigInput, WorldBossConfigWithState } from "~/shared/types/worldBoss";

// 仅更新配置，不重置状态
export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, never>,
  data: GameSocketData<CreateWorldBossBattleConfigInput>,
): Promise<void> {
  try {
    const gmUser = await prisma.user.findUnique({ where: { uuid: data.user.uuid } });
    if (!gmUser?.is_gm) {
      emitEventToUser(data.user, "gm:worldBossConfig:updateOnly:fail", { message: "无权限" });
      return;
    }

    const config = await createWorldBossConfig(data.data);
    emitEventToUser(data.user, "gm:worldBossConfig:updateOnly:success", config);

    const list: WorldBossConfigWithState[] = await listWorldBossConfigs();
    emitEventToUser(data.user, "gm:worldBossConfig:list:success", { list });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    emitEventToUser(data.user, "gm:worldBossConfig:updateOnly:fail", { message });
  }
}
