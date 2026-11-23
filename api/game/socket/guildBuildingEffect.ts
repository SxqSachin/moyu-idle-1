import type { AllGuildBuildingId } from "~/shared/types/guild";
import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { ItemCountInfo } from "~/shared/types/gameInventory";

export function emitGetWishingPoolEffect(guildUuid: string) {
  emitEventToServer("guildBuildingEffect:wishingPool", { guildUuid });
}
export const onGetWishingPoolEffectSuccess = registerSocketEventListener<{ guildUuid: string; luck: number; rewardInfo: ItemCountInfo }>("guildBuildingEffect:wishingPool:success");
export const onGetWishingPoolEffectFail = registerSocketEventListener<{ message: string }>("guildBuildingEffect:wishingPool:fail");

export function emitGetVitalityCatStatueEffect(guildUuid: string, type: 'hp' | 'mp' | 'all') {
  emitEventToServer("guildBuildingEffect:vitalityCatStatue", { guildUuid, type });
}
export const onGetVitalityCatStatueEffectSuccess = registerSocketEventListener<{ guildUuid: string; }>("guildBuildingEffect:vitalityCatStatue:success");
export const onGetVitalityCatStatueEffectFail = registerSocketEventListener<{ message: string }>("guildBuildingEffect:vitalityCatStatue:fail");


export function emitGetDenseFogLighthouseEffect(guildUuid: string, type: 'aggressive' | 'conservative' | 'alone') {
  emitEventToServer("guildBuildingEffect:denseFogLighthouse", { guildUuid, type });
}
export const onGetDenseFogLighthouseEffectSuccess = registerSocketEventListener<{ guildUuid: string; }>("guildBuildingEffect:denseFogLighthouse:success");
export const onGetDenseFogLighthouseEffectFail = registerSocketEventListener<{ message: string }>("guildBuildingEffect:denseFogLighthouse:fail");


export function emitGetGuildGrandBathhouseEffect(guildUuid: string, type: 'work' | 'battle') {
  emitEventToServer("guildBuildingEffect:guildGrandBathhouse", { guildUuid, type });
}
export const onGetGuildGrandBathhouseEffectSuccess = registerSocketEventListener<{ guildUuid: string; }>("guildBuildingEffect:guildGrandBathhouse:success");
export const onGetGuildGrandBathhouseEffectFail = registerSocketEventListener<{ message: string }>("guildBuildingEffect:guildGrandBathhouse:fail");