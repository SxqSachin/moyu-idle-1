import type { DefaultEventsMap, Socket } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import type { CreateWorldBossBattleConfigInput, WorldBossConfigWithState } from "~/shared/types/worldBoss";
import { createWorldBossConfig, listWorldBossConfigs, resetGlobalBossState } from "~/server/utils/game/worldBoss";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, never>,
  data: GameSocketData<CreateWorldBossBattleConfigInput>,
): Promise<void> {
  try {
    const gmUser = await prisma.user.findUnique({ where: { uuid: data.user.uuid } });
    if (!gmUser?.is_gm) {
      emitEventToUser(data.user, "gm:worldBossConfig:create:fail", { message: "无权限" });
      return;
    }

    const config = await createWorldBossConfig(data.data);

    await resetGlobalBossState(config.id);

    emitEventToUser(data.user, "gm:worldBossConfig:create:success", config);

    const list: WorldBossConfigWithState[] = await listWorldBossConfigs();
    emitEventToUser(data.user, "gm:worldBossConfig:list:success", { list });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    emitEventToUser(data.user, "gm:worldBossConfig:create:fail", { message });
  }
}
