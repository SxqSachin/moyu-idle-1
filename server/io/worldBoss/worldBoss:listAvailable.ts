import type { DefaultEventsMap, Socket } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { listWorldBossConfigs } from "~/server/utils/game/worldBoss";
import { prisma } from "~/server/utils/game/db";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, never>,
  data: GameSocketData<void>,
): Promise<void> {
  try {
    const list = await listWorldBossConfigs();

    const userUuid = data.user?.uuid;
    // 批量补充当前玩家是否已领取奖励（按场次 UUID 判断），避免 N 次 DB 查询
    const battleUuidList = list
      .map((boss) => boss.globalState?.uuid)
      .filter((uuid): uuid is string => Boolean(uuid));

    let claimedSet = new Set<string>();
    if (userUuid && battleUuidList.length) {
      const claimedRows = await prisma.worldBossRewardDistribution.findMany({
        where: {
          playerUuid: userUuid,
          uuid: { in: battleUuidList },
        },
        select: { uuid: true },
      });
      claimedSet = new Set(claimedRows.map((row) => row.uuid));
    }

    const listWithClaim = list.map((boss) => {
      const battleUuid = boss.globalState?.uuid;
      const hasClaimedReward = Boolean(battleUuid && claimedSet.has(battleUuid));
      return { ...boss, hasClaimedReward };
    });

    emitEventToUser(data.user, "worldBoss:listAvailable:success", { list: listWithClaim });
  } catch (e) {
    const message = e instanceof Error ? e.message : "获取Boss战列表失败";
    emitEventToUser(data.user, "worldBoss:listAvailable:fail", { message });
  }
}
