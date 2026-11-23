
import { allGameEnemies } from "@/shared/data/allGameEnemy";
import type { AllGameEnemyID, Enemy } from "@/shared/types/emeny";
import { v4 } from "uuid";
import { BaseBattleUnit } from "~/shared/types/unit";
import { clone } from "~/shared/utils";



/**
 * 根据敌人ID获取敌人对象的深拷贝
 * @param enemyId 敌人ID
 * @returns 敌人对象的副本
 */
export function generateEnemyById(enemyId: AllGameEnemyID): Enemy | undefined {
  const enemy = allGameEnemies[enemyId];
  if (!enemy) return undefined;

  let newEnemy = clone(enemy) as Partial<Enemy>;

  newEnemy.isPlayer = false;

  newEnemy.uuid = v4(); // 生成新的UUID

  return newEnemy as Enemy;
}

export function generateUnitById(enemyId: AllGameEnemyID): BaseBattleUnit | undefined {
  const enemy = allGameEnemies[enemyId];
  if (!enemy) return undefined;

  // @ts-ignore
  let newUnit = clone(enemy) as BaseBattleUnit;

  newUnit.isPlayer = false; // 确保 isPlayer 为 false

  newUnit.uuid = v4(); // 生成新的UUID

  return newUnit;
}