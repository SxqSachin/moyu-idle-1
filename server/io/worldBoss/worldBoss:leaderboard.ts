import type { DefaultEventsMap, Socket } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { redisClient } from "~/server/utils";
import { getGlobalBossState } from "~/server/utils/game/worldBoss";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, never>,
  data: GameSocketData<{ bossId: string; worldBossBattleUuid?: string; battleUuid?: string; limit?: number }>,
): Promise<void> {
  try {
    const { bossId, worldBossBattleUuid, battleUuid, limit } = data.data || {};
    if (!bossId) throw new Error("bossId is required");

    const where: any = { bossId };
    const theUuid = worldBossBattleUuid || battleUuid;
    if (theUuid) where.uuid = theUuid;

    const cacheKey = `worldBoss:leaderboard:${bossId}:${theUuid || 'all'}`;

    // try cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const list = JSON.parse(cached);
      emitEventToUser(data.user, "worldBoss:leaderboard:success", { list, queryUuid: theUuid });
      return;
    }

    const rows = await prisma.worldBossDamageRecord.findMany({
      where,
      orderBy: { totalDamage: 'desc' },
      // take: limit ?? 50,
    });

    const list = rows.map((r) => ({
      uuid: r.uuid,
      roomId: r.roomId,
      playerUuids: (() => {
        try { return JSON.parse(r.playerUuids || '[]') } catch { return [] }
      })(),
      totalDamage: r.totalDamage.toString(),
      createdAt: r.createdAt.getTime(),
    }));

    // determine ttl: if this is the current global battle and it's still battling -> 5 minutes, else 1 hour
    let ttl = 60 * 60; // default 1 hour
    try {
      const state = await getGlobalBossState(bossId);
      if (state && theUuid && state.uuid === theUuid && state.status === 'battling') {
        ttl = 5 * 60;
      }
    } catch (e) {
      // ignore and keep default ttl
    }

    try {
      await redisClient.set(cacheKey, JSON.stringify(list), { EX: ttl });
    } catch (e) {
      // ignore cache errors
    }

    emitEventToUser(data.user, "worldBoss:leaderboard:success", { list, queryUuid: theUuid });
  } catch (e) {
    const message = e instanceof Error ? e.message : "获取排行榜失败";
    emitEventToUser(data.user, "worldBoss:leaderboard:fail", { message });
  }
}
