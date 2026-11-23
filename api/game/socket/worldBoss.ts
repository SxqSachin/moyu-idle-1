import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { WorldBossConfigWithState, WorldBossSnapshot } from "~/shared/types/worldBoss";

export const emitWorldBossListAvailable = (): void => {
  emitEventToServer("worldBoss:listAvailable");
};

export const onWorldBossListAvailableSuccess = registerSocketEventListener<{ list: WorldBossConfigWithState[] }>("worldBoss:listAvailable:success");
export const onWorldBossListAvailableFail = registerSocketEventListener<{ message: string }>("worldBoss:listAvailable:fail");

export const emitWorldBossLeaderboard = (payload: { bossId: string; worldBossBattleUuid: string; limit?: number }) => {
  emitEventToServer("worldBoss:leaderboard", payload);
};

export const onWorldBossLeaderboardSuccess = registerSocketEventListener<{ list: { uuid: string; roomId: string; playerUuids: string[]; totalDamage: string; createdAt: number }[]; queryUuid?: string }>("worldBoss:leaderboard:success");
export const onWorldBossLeaderboardFail = registerSocketEventListener<{ message: string }>("worldBoss:leaderboard:fail");

export const emitWorldBossLeaderboardGroups = (payload: { bossId: string }) => {
  emitEventToServer("worldBoss:leaderboardGroups", payload);
};

export const onWorldBossLeaderboardGroupsSuccess = registerSocketEventListener<{ list: { uuid: string; totalDamage: string; minCreatedAt: number; maxCreatedAt: number }[] }>("worldBoss:leaderboardGroups:success");
export const onWorldBossLeaderboardGroupsFail = registerSocketEventListener<{ message: string }>("worldBoss:leaderboardGroups:fail");

export const emitWorldBossClaimReward = (payload: { bossId: string; worldBossBattleUuid?: string; }) => {
  emitEventToServer("worldBoss:claimReward", payload);
};

export const onWorldBossClaimRewardSuccess = registerSocketEventListener<{ bossId: string; worldBossBattleUuid?: string; rewards?: Record<string, { count: number }> }>("worldBoss:claimReward:success");
export const onWorldBossClaimRewardFail = registerSocketEventListener<{ message: string; bossId?: string }>("worldBoss:claimReward:fail");

export const emitWorldBossGet = (payload: { bossId: string }) => {
  emitEventToServer("worldBoss:get", payload);
};

export const onWorldBossGetSuccess = registerSocketEventListener<{ boss: WorldBossConfigWithState }>("worldBoss:get:success");
export const onWorldBossGetFail = registerSocketEventListener<{ message: string; bossId?: string }>("worldBoss:get:fail");
