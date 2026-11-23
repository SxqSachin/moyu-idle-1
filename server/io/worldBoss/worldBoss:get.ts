import type { DefaultEventsMap, Socket } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getWorldBossConfigById, getGlobalBossState } from "~/server/utils/game/worldBoss";
import { prisma } from "~/server/utils/game/db";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, never>,
  data: GameSocketData<{ bossId: string }>,
): Promise<void> {
  try {
    const bossId = data.data?.bossId;
    if (!bossId) throw new Error("bossId不能为空");

    const [config, state] = await Promise.all([
      getWorldBossConfigById(bossId),
      getGlobalBossState(bossId),
    ]);

    if (!config) throw new Error("未找到对应的“大麻烦”配置");

    if (config.hidden) throw new Error("未找到对应的“大麻烦”配置");

    const merged = {
      ...config,
      state: state?.status ?? config.state,
      globalState: state || undefined,
    };

    const userUuid = data.user?.uuid;
    const battleUuid = state?.uuid;
    let hasClaimedReward = false;
    if (userUuid && battleUuid) {
      const claimed = await prisma.worldBossRewardDistribution.findUnique({
        where: { uuid_player_unique: { uuid: battleUuid, playerUuid: userUuid } },
        select: { id: true },
      });
      hasClaimedReward = Boolean(claimed);
    }

    emitEventToUser(data.user, "worldBoss:get:success", { boss: { ...merged, hasClaimedReward } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "获取Boss失败";
    emitEventToUser(data.user, "worldBoss:get:fail", { message, bossId: data.data?.bossId });
  }
}