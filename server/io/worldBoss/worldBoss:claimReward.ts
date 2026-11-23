import type { DefaultEventsMap, Socket } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import type { ItemCountInfo } from "~/shared/types/gameInventory";
import type { BossUnitWithDrops } from "~/shared/types/worldBoss";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { getGlobalBossState, getWorldBossConfigById } from "~/server/utils/game/worldBoss";
import { rollWorldBossDropsForPlayerFromConfig } from "~/shared/utils/worldBossRewards";
import { enqueueToHarvestBox } from "~/server/utils/game/harvestBox";
import { HarvestBoxSource } from "~/generated/prisma";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, never>,
  data: GameSocketData<{ bossId: string; worldBossBattleUuid?: string }>
): Promise<void> {
  try {
    // 只有登录玩家才允许领取
    const userUuid = data.user?.uuid;
    if (!userUuid) throw new Error("未登录");

    const payload = data.data || {};
    const { bossId, worldBossBattleUuid } = payload;
    if (!bossId) throw new Error("bossId不能为空");

    await withUniqueLock(`worldBoss:claimReward:user:${userUuid}`, async () => {
      // 并发读取世界Boss状态与配置，避免重复 IO
      const [state, config] = await Promise.all([
        getGlobalBossState(bossId),
        getWorldBossConfigById(bossId),
      ]);

      // 状态校验：必须已击败且服务端已完成集中发奖
      if (!state || !config) throw new Error("“大麻烦”不存在");
      if (state.status !== "player_win") throw new Error("“大麻烦”尚未被击败");
      if (!state.dispatchedRewards) throw new Error("奖励尚未结算，请稍后");

      // 仅允许当前战斗实例的奖励被领取
      const currentBattleUuid = state.uuid;
      const requestedUuid = worldBossBattleUuid;
      if (requestedUuid && requestedUuid !== currentBattleUuid) {
        throw new Error("“大麻烦”已更新，请刷新后重试");
      }

      const exists = await prisma.worldBossRewardDistribution.findUnique({
        where: {
          uuid_player_unique: {
            uuid: currentBattleUuid,
            playerUuid: userUuid,
          },
        },
      });
      if (exists)
        throw new Error("你已经领取过奖励！（可能是参与过战斗或者曾经领取过）");

      // 以 ItemCountInfo 结构累积掉落（面向单玩家）
      const rewards: ItemCountInfo = rollWorldBossDropsForPlayerFromConfig(config, true);

      // 事务：记录领取流水 + 发放到收获箱
      await prisma.$transaction(async (tx) => {
        await tx.worldBossRewardDistribution.create({
          data: {
            uuid: currentBattleUuid,
            bossId,
            roomId: null,
            playerUuid: userUuid,
            rewards: JSON.stringify(rewards),
            processed: true,
            processedAt: new Date(),
          },
        });

        await enqueueToHarvestBox(
          userUuid,
          rewards,
          {
            title: "“大麻烦”击退奖励",
            source: HarvestBoxSource.Event,
          },
          tx
        );
      });

      emitEventToUser(data.user, "worldBoss:claimReward:success", {
        rewards,
        bossId,
        worldBossBattleUuid: currentBattleUuid,
      });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "领取奖励失败";
    emitEventToUser(data.user, "worldBoss:claimReward:fail", {
      message,
      bossId: data.data?.bossId,
    });
  }
}
