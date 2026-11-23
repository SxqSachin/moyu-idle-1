import type { MinMax } from ".";
import { allGameEnemies } from "../data/allGameEnemy";
import type { AllGameResourceID, AllGameResourceIDWithInternal } from "./gameResource";
import type { BaseBattleUnit } from "./unit";

export type ItemDrop = {
  id: AllGameResourceIDWithInternal;
  percent: number;    // 掉落概率（0~1）
  range: MinMax
}

export type Enemy = {
  uuid: string;

  expReward: number;

  drops?: ItemDrop[]; // 新增：掉落列表
} & BaseBattleUnit

export type AllGameEnemyID = keyof typeof allGameEnemies;
export type AllUnitID = keyof typeof allGameEnemies;

export const allGameUnit = allGameEnemies;