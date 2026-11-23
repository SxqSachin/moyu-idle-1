
import { allGameEnemies } from "@/shared/data/allGameEnemy";
import type { AllGameEnemyID, Enemy } from "@/shared/types/emeny";
import { v4 } from "uuid";
import type { BaseBattleUnit } from "~/shared/types/unit";
import { clone } from "~/shared/utils";


/**
 * 根据敌人ID获取敌人对象的深拷贝
 * @param enemyId 敌人ID
 * @returns 敌人对象的副本
 */
export function generateEnemyById(enemyId: AllGameEnemyID): Enemy | undefined {
  const enemy = allGameEnemies[enemyId] as unknown as Enemy;
  if (!enemy) return undefined;


  let newEnemy = clone(enemy) as Enemy;

  newEnemy.baseStatus = newEnemy.status
  newEnemy.baseStatus.otherStatus = {}

  newEnemy.isPlayer = false;
  newEnemy.canGetDropReward = false;
  newEnemy.canGetExpReward = false;

  newEnemy.isPlayerUnit = false;
  newEnemy.isEnvironmentUnit = true;

  newEnemy.uuid = v4(); // 生成新的UUID

  return newEnemy as Enemy;
}

export function generateUnitById(enemyId: AllGameEnemyID): BaseBattleUnit | undefined {
  const enemy = allGameEnemies[enemyId];
  if (!enemy) return undefined;

  // @ts-ignore
  let newUnit = clone(enemy) as BaseBattleUnit;

  newUnit.baseStatus = newUnit.status
  newUnit.baseStatus.otherStatus = {}

  newUnit.isPlayer = false;
  newUnit.canGetDropReward = false;
  newUnit.canGetExpReward = false;

  newUnit.isPlayerUnit = false;
  newUnit.isEnvironmentUnit = true;

  newUnit.uuid = v4(); // 生成新的UUID

  return newUnit;
}