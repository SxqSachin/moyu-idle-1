import type { DefaultEventsMap, Socket } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { resetGlobalBossState } from "~/server/utils/game/worldBoss";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, never>,
  data: GameSocketData<{ bossId: string }>,
): Promise<void> {
  try {
    const gmUser = await prisma.user.findUnique({ where: { uuid: data.user.uuid } });
    if (!gmUser?.is_gm) {
      emitEventToUser(data.user, "gm:worldBoss:reset:fail", { message: "无权限" });
      return;
    }

    if (!data.data?.bossId) {
      emitEventToUser(data.user, "gm:worldBoss:reset:fail", { message: "bossId不能为空" });
      return;
    }

    const state = await resetGlobalBossState(data.data.bossId);
    emitEventToUser(data.user, "gm:worldBoss:reset:success", { state });
  } catch (e) {
    const message = e instanceof Error ? e.message : "重置失败";
    emitEventToUser(data.user, "gm:worldBoss:reset:fail", { message });
  }
}
