import type { DefaultEventsMap, Socket } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { listWorldBossConfigs } from "~/server/utils/game/worldBoss";
import type { WorldBossConfigWithState } from "~/shared/types/worldBoss";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, never>,
  data: GameSocketData<void>,
): Promise<void> {
  try {
    const gmUser = await prisma.user.findUnique({ where: { uuid: data.user.uuid } });
    if (!gmUser?.is_gm) {
      emitEventToUser(data.user, "gm:worldBossConfig:list:fail", { message: "无权限" });
      return;
    }

    const list: WorldBossConfigWithState[] = await listWorldBossConfigs(true);
    emitEventToUser(data.user, "gm:worldBossConfig:list:success", { list });
  } catch (e) {
    const message = e instanceof Error ? e.message : "查询失败";
    emitEventToUser(data.user, "gm:worldBossConfig:list:fail", { message });
  }
}
