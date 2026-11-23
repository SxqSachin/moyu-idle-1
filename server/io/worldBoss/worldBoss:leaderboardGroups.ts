import type { DefaultEventsMap, Socket } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { redisClient } from "~/server/utils";
import { getGlobalBossState } from "~/server/utils/game/worldBoss";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, never>,
  data: GameSocketData<{ bossId: string }>,
): Promise<void> {
  try {
    const { bossId } = data.data || {};
    if (!bossId) throw new Error("bossId is required");

    const cacheKey = `worldBoss:leaderboard:groups:${bossId}`;

    // try cache first
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const list = JSON.parse(cached);
        emitEventToUser(data.user, "worldBoss:leaderboardGroups:success", { list });
        return;
      }
    } catch (e) {
      // ignore cache read errors
    }

    // group by battle uuid and compute total damage, min/max createdAt
    const groups = await prisma.worldBossDamageRecord.groupBy({
      by: ["uuid"],
      where: { bossId },
      _sum: { totalDamage: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
    });

    const list = groups.map((g) => ({
      uuid: g.uuid,
      totalDamage: (g._sum?.totalDamage ?? 0).toString(),
      minCreatedAt: g._min?.createdAt?.getTime() || 0,
      maxCreatedAt: g._max?.createdAt?.getTime() || 0,
    }));

    // cache groups per boss with ttl depending on whether current global battle is ongoing
    try {
      let ttl = 60 * 60; // 1 hour
      const state = await getGlobalBossState(bossId);
      if (state && state.status === 'battling') {
        ttl = 5 * 60; // 5 minutes
      }
      await redisClient.set(cacheKey, JSON.stringify(list), { EX: ttl });
    } catch (e) {
      // ignore cache errors
    }

    emitEventToUser(data.user, "worldBoss:leaderboardGroups:success", { list });
  } catch (e) {
    const message = e instanceof Error ? e.message : "获取排行榜分组失败";
    emitEventToUser(data.user, "worldBoss:leaderboardGroups:fail", { message });
  }
}
