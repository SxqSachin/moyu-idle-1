import { emitEventToServer, registerSocketEventListener } from "../socket";

export function emitGetBattlePyreAltarBeginnerBless() {
  emitEventToServer("battlePyreAltar:getBattlePyreAltarBeginnerBless");
}
export const onGetBattlePyreAltarBeginnerBlessSuccess = registerSocketEventListener<void>("battlePyreAltar:getBattlePyreAltarBeginnerBless:success");
export const onGetBattlePyreAltarBeginnerBlessFail = registerSocketEventListener<{ message: string }>("battlePyreAltar:getBattlePyreAltarBeginnerBless:fail");

export function emitConsecrateBattlePyreAltar(times: number) {
  emitEventToServer("battlePyreAltar:consecrate", { times });
}
export const onConsecrateBattlePyreAltarSuccess = registerSocketEventListener<void>("battlePyreAltar:consecrate:success");
export const onConsecrateBattlePyreAltarFail = registerSocketEventListener<{ message: string }>("battlePyreAltar:consecrate:fail");

// Leaderboard API
export function emitGetBattlePyreAltarLeaderboard(limit?: number) {
  emitEventToServer("battlePyreAltar:leaderboard", { limit });
}
export type BattlePyreAltarLeaderboardItem = { rank: number; userUuid: string; activeSeconds: number };
export const onBattlePyreAltarLeaderboardSuccess = registerSocketEventListener<{ list: BattlePyreAltarLeaderboardItem[] }>(
  "battlePyreAltar:leaderboard:success"
);
export const onBattlePyreAltarLeaderboardFail = registerSocketEventListener<{ message: string }>(
  "battlePyreAltar:leaderboard:fail"
);

// Total leaderboard API
export function emitGetBattlePyreAltarTotalLeaderboard(limit?: number) {
  emitEventToServer("battlePyreAltar:leaderboard:total", { limit });
}
export type BattlePyreAltarTotalLeaderboardItem = { rank: number; userUuid: string; totalSeconds: number };
export const onBattlePyreAltarTotalLeaderboardSuccess = registerSocketEventListener<{ list: BattlePyreAltarTotalLeaderboardItem[] }>(
  "battlePyreAltar:leaderboard:total:success"
);
export const onBattlePyreAltarTotalLeaderboardFail = registerSocketEventListener<{ message: string }>(
  "battlePyreAltar:leaderboard:total:fail"
);


export function emitConsecrateCatVillageMonument(times: number) {
  emitEventToServer("catVillageMonument:consecrate", { times });
}
export const onConsecrateCatVillageMonumentSuccess = registerSocketEventListener<void>("catVillageMonument:consecrate:success");
export const onConsecrateCatVillageMonumentFail = registerSocketEventListener<{ message: string }>("catVillageMonument:consecrate:fail");

// Leaderboard API
export function emitGetCatVillageMonumentLeaderboard(limit?: number) {
  emitEventToServer("catVillageMonument:leaderboard", { limit });
}
export type CatVillageMonumentLeaderboardItem = { rank: number; userUuid: string; activeSeconds: number };
export const onCatVillageMonumentLeaderboardSuccess = registerSocketEventListener<{ list: CatVillageMonumentLeaderboardItem[] }>(
  "catVillageMonument:leaderboard:success"
);
export const onCatVillageMonumentLeaderboardFail = registerSocketEventListener<{ message: string }>(
  "catVillageMonument:leaderboard:fail"
);

// Total leaderboard API
export function emitGetCatVillageMonumentTotalLeaderboard(limit?: number) {
  emitEventToServer("catVillageMonument:leaderboard:total", { limit });
}
export type CatVillageMonumentTotalLeaderboardItem = { rank: number; userUuid: string; totalSeconds: number };
export const onCatVillageMonumentTotalLeaderboardSuccess = registerSocketEventListener<{ list: CatVillageMonumentTotalLeaderboardItem[] }>(
  "catVillageMonument:leaderboard:total:success"
);
export const onCatVillageMonumentTotalLeaderboardFail = registerSocketEventListener<{ message: string }>(
  "catVillageMonument:leaderboard:total:fail"
);