import type { AllGameEnemyID, Enemy } from "../types/emeny";
import allGameEnemyJson from "~/assets/resource/allGameEnemies.json"

/**
 * 所有游戏敌人数据
 */
export const allGameEnemies = allGameEnemyJson satisfies Record<string, Omit<Enemy, "uuid">>;

export const allGameEnemyIds = Object.keys(allGameEnemies) as AllGameEnemyID[];