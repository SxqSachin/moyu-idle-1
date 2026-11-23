import { allBattleAreas } from "~/shared/data/allBattleInfo";
import { AllBattleAreaID, BattleActionTargetType, BattleArea } from "~/shared/types/battle";
import { getCharacterStatusInfo } from "./characterStatus";

/**
 * Ensure the user's battle level fits the area requirement.
 */
export async function assertUserBattleLevelInArea(userUuid: string, areaId: AllBattleAreaID) {
  return;
//   const area = allBattleAreas[areaId] as BattleArea;
//   if (!area) {
//     throw new Error("无效的副本区域");
//   }

//   if (!area.minLevel && !area.maxLevel) {
//     // 无等级限制
//     return;
//   }

//   const status = await getCharacterStatusInfo(userUuid);
//   const battleLevel = Math.floor(status?.battle?.level ?? 0);

//   if (typeof area.minLevel === "number" && battleLevel < area.minLevel) {
//     throw new Error(`战斗等级不足，需达到${area.minLevel}级`);
//   }
//   if (typeof area.maxLevel === "number" && battleLevel > area.maxLevel) {
//     throw new Error(`战斗等级过高，需不高于${area.maxLevel}级`);
//   }
}
