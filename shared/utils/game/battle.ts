import type { allBattleState } from "~/shared/data/allBattleState";
import type { BattleArea, BattleInfo } from "~/shared/types/battle";
import type { DamageType } from "~/shared/types/skill";
import type { BaseBattleUnit } from "~/shared/types/unit";
import { clone } from "..";
import type { AllGameEnemyID } from "~/shared/types/emeny";
import type { BattleState } from "~/shared/types/BattleState";

export const isDamageType = (
  skillDamageType: DamageType | DamageType[],
  check: DamageType
): boolean => {
  if (Array.isArray(skillDamageType)) {
    return skillDamageType.includes(check);
  }
  return skillDamageType === check;
};

/**
 * 获取当前单位所在分组ID
 */
export function getUnitGroupId(
  groups: Record<string, string[]>,
  unitId: string
): string | undefined {
  return Object.keys(groups).find((groupId) =>
    groups[groupId].includes(unitId)
  );
}

export function getAllUnit(battleInfo: BattleInfo): BaseBattleUnit[] {
  return battleInfo.members;
}

/**
 * 获取敌方单位列表
 */
export function getAliveEnemyUnits(
  battleInfo: BattleInfo,
  currentGroupId: string
): BaseBattleUnit[] {
  const { groups, members } = battleInfo;
  const enemyGroupIds = Object.keys(groups).filter(
    (id) => id !== currentGroupId
  );
  const enemyIds = enemyGroupIds.flatMap((id) => groups[id]);
  return members.filter((u) => enemyIds.includes(u.uuid) && u.hp > 0);
}

/**
 * 获取己方单位列表
 */
export function getAliveAllyUnits(
  battleInfo: BattleInfo,
  currentGroupId: string
): BaseBattleUnit[] {
  return getAllyUnits(battleInfo, currentGroupId).filter((u) => u.hp > 0);
}
export function getEnemyUnits(
  battleInfo: BattleInfo,
  currentGroupId: string
): BaseBattleUnit[] {
  const { groups, members } = battleInfo;
  const enemyGroupIds = Object.keys(groups).filter(
    (id) => id !== currentGroupId
  );
  const enemyIds = enemyGroupIds.flatMap((id) => groups[id]);
  return members.filter((u) => enemyIds.includes(u.uuid));
}

/**
 * 获取己方单位列表
 */
export function getEnemyUnitsByUnit(
  battleInfo: BattleInfo,
  unit: BaseBattleUnit
): BaseBattleUnit[] {
  const { groups, members } = battleInfo;

  let unitGroupId = getUnitGroupId(groups, unit.uuid);

  if (!unitGroupId) {
    return [];
  }

  return getEnemyUnits(battleInfo, unitGroupId);
}
export function getAllyUnitsByUnit(
  battleInfo: BattleInfo,
  unit: BaseBattleUnit
): BaseBattleUnit[] {
  const { groups, members } = battleInfo;

  let unitGroupId = getUnitGroupId(groups, unit.uuid);

  if (!unitGroupId) {
    return [];
  }

  return getAllyUnits(battleInfo, unitGroupId);
}
export function getAllyUnits(
  battleInfo: BattleInfo,
  currentGroupId: string
): BaseBattleUnit[] {
  const { groups, members } = battleInfo;
  const allyIds = groups[currentGroupId] ?? [];
  return members
    .filter((u) => allyIds.includes(u.uuid))
    .filter((u) => {
      // 被孤立的单位，不会被选为友军
      if (hasState(u, "solitude")) {
        return false;
      }

      return true;
    });
}

export function hasState(
  unit: BaseBattleUnit,
  stateId: keyof typeof allBattleState
): boolean {
  return (
    !!unit.state &&
    !!unit.state[stateId] &&
    unit.state[stateId].remainingDuration > 0
  );
}

export const getBaseInfoFromBattleInfo = (
  currentUnit: BaseBattleUnit,
  battleInfo: BattleInfo
) => {
  let info = getInfoFromBattleInfo(currentUnit, battleInfo);

  if (!info) {
    return
  }

  return {
    allies: info.allyUnits ?? [],
    allAllies: info.allAllyUnit ?? [],
    enemies: info.enemyUnits ?? [],
    allEnemies: info.allEnemies ?? [],
  };
}

export const getInfoFromBattleInfo = (
  currentUnit: BaseBattleUnit,
  battleInfo: BattleInfo
) => {
  const currentUnitUuid = currentUnit.uuid;
  const currentGroupId = getUnitGroupId(battleInfo.groups, currentUnitUuid);

  if (!currentGroupId) {
    return null;
  }

  const unitMap: Record<string, BaseBattleUnit> = {};
  for (const unit of battleInfo.members) {
    unitMap[unit.uuid] = unit;
  }

  const isFluster = !!currentUnit.state?.fluster;
  const isTaunted = !!currentUnit.state?.taunt;
  const isConfusion = hasState(currentUnit, 'confusion');

  let allAllyUnit: BaseBattleUnit[] = getAllyUnits(battleInfo, currentGroupId);
  let allEnemies: BaseBattleUnit[] = getEnemyUnits(battleInfo, currentGroupId);

  // 不包含被放逐的单位
  allAllyUnit = getAvailableUnitCollection(allAllyUnit, {
    includeDead: true,
    includeSneak: true,
  });
  allEnemies = getAvailableUnitCollection(allEnemies, {
    includeDead: true,
    includeSneak: true,
  });

  if (isTaunted) {
    allAllyUnit = getAllyUnits(battleInfo, currentGroupId);
    let tauntSource = unitMap[currentUnit.state?.taunt?.addBy ?? ""]; //   battleInfo.members.find(unit => unit.uuid == currentUnit.state?.taunt?.addBy)
    if (tauntSource) {
      allEnemies = [tauntSource];
    } else {
      allEnemies = getEnemyUnits(battleInfo, currentGroupId);
    }
  }

  // 被混淆的话，会把敌人视为友军，友军视为敌人
  if (isConfusion) {
    const mixedAllAlly = clone(allAllyUnit)
    const mixedAllEnemy = clone(allEnemies)
    allAllyUnit = mixedAllEnemy;
    allEnemies = mixedAllAlly;
  }

  // 慌乱优先于嘲讽
  if (isFluster) {
    allAllyUnit = getAllUnit(battleInfo);
    allEnemies = getAllUnit(battleInfo);
  }

  const allyUnits = allAllyUnit.filter((u) => u.hp > 0);
  const enemyUnits = allEnemies.filter((u) => u.hp > 0);

  return {
    currentUnitUuid,
    currentGroupId,
    unitMap,
    allAllyUnit,
    allEnemies,
    allyUnits,
    enemyUnits
  }
};

export const findUnitInBattle = (battleInfo: BattleInfo, unitUuid: string): BaseBattleUnit | undefined => {
  return battleInfo.members.find((unit) => unit.uuid === unitUuid);
};


export function getUnitTurnOrder(battleInfo: BattleInfo, unitUuid: string): number {
  return battleInfo.turnOrder.indexOf(unitUuid);
}
export function getUnitTurnLastOrder(battleInfo: BattleInfo, unitUuid: string): number {
  return battleInfo.turnOrder.lastIndexOf(unitUuid);
}

export function moveUnitTurnOrder(
  battleInfo: BattleInfo,
  unitUuid: string,
  newIndex: number
): void {
  const currentIndex = battleInfo.turnOrder.indexOf(unitUuid);
  if (currentIndex === -1) return; // 如果单位不在回合顺序中，直接返回

  // newIndex 不能小于0或大于当前回合顺序长度 
  if (newIndex < 0) newIndex = 0;
  if (newIndex > battleInfo.turnOrder.length) newIndex = battleInfo.turnOrder.length

  // 从当前索引移除单位
  battleInfo.turnOrder.splice(currentIndex, 1);

  // 将单位插入到新的索引位置
  battleInfo.turnOrder.splice(newIndex, 0, unitUuid);
}

export function pushUnitTurnOrder(
  battleInfo: BattleInfo,
  unitUuid: string,
  push: number
): void {
  // 如果单位不在回合顺序中，直接返回
  if (!battleInfo.turnOrder.includes(unitUuid)) return;

  const currentIndex = battleInfo.turnOrder.indexOf(unitUuid);
  if (currentIndex === -1) return; // 如果单位不在回合顺序中，直接返回

  // 将单位移动到新的索引位置
  moveUnitTurnOrder(battleInfo, unitUuid, currentIndex + push);
}

export function addUnitExtraTurn(battleInfo: BattleInfo, unit: BaseBattleUnit, index: number) {
  battleInfo.turnOrder.splice(index, 0, unit.uuid);

  if (!unit.tmpOncePreBattleExtraTurnIndexList) {
    unit.tmpOncePreBattleExtraTurnIndexList= [];
  }

  unit.tmpOncePreBattleExtraTurnIndexList.push(index);
  unit.tmpOncePreBattleExtraTurnIndexList = [...new Set(unit.tmpOncePreBattleExtraTurnIndexList)]

  if (!battleInfo.thisBattleTmpOnceExtraTurnIndexList) {
    battleInfo.thisBattleTmpOnceExtraTurnIndexList = [];
  }
  battleInfo.thisBattleTmpOnceExtraTurnIndexList.push(index)
  battleInfo.thisBattleTmpOnceExtraTurnIndexList = [...new Set(battleInfo.thisBattleTmpOnceExtraTurnIndexList)]
}
export function addUnitExtraTurnAfter(battleInfo: BattleInfo, unit: BaseBattleUnit, afterUnitUuid: string) {
  const currentIndex = battleInfo.turnOrder.indexOf(afterUnitUuid);
  if (currentIndex === -1) return;

  addUnitExtraTurn(battleInfo, unit, currentIndex + 1);
}

export const getAvailableUnitCollection = (unitCollection: BaseBattleUnit[], opt?: {
  includeSneak?: boolean;
  includeDead?: boolean;
  includeBanished?: boolean;
}) => {
  return unitCollection.filter((unit) => {
    if (unit.state?.sneak && !opt?.includeSneak) {
      return false
    }

    if (unit.hp <= 0 && !opt?.includeDead) {
      return false;
    }

    if (unit.state?.banished && !opt?.includeBanished) {
      return false;
    }

    return true;
  })
}

export const getMainStatusInfo = (unit: BaseBattleUnit, base: boolean = false): {
  status: 'strength' | 'dexterity' | 'intelligence',
  value: number
  info: {
    strength: number,
    dexterity: number,
    intelligence: number
  }
} => {
  let mainStatus: "strength" | "dexterity" | "intelligence" = "strength";
  let mainStatusValue = 0;

  let targetStrength = unit.status.strength.level ?? 0;
  let targetDexterity = unit.status.dexterity.level ?? 0;
  let targetIntelligence = unit.status.intelligence.level ?? 0;

  if (base) {
    targetStrength = unit.baseStatus.strength.level ?? 0;
    targetDexterity = unit.baseStatus.dexterity.level ?? 0;
    targetIntelligence = unit.baseStatus.intelligence.level ?? 0;
  }

  // 判断目标当前最高属性
  if (
    targetStrength >= targetDexterity &&
    targetStrength >= targetIntelligence
  ) {
    mainStatus = "strength";
    mainStatusValue = targetStrength;
  } else if (
    targetDexterity >= targetStrength &&
    targetDexterity >= targetIntelligence
  ) {
    mainStatus = "dexterity";
    mainStatusValue = targetDexterity;
  } else {
    mainStatus = "intelligence";
    mainStatusValue = targetIntelligence;
  }

  return {
    status: mainStatus,
    value: mainStatusValue,
    info: {
      strength: targetStrength,
      dexterity: targetDexterity,
      intelligence: targetIntelligence
    }
  };
}

export const getAllEnemyIdInBattleArea = (battleArea: BattleArea) => {
  let allEnemyInArea = [
    ...Object.values(battleArea.enemyPool).map((v) => v.id),
    ...(battleArea.specialBattles ?? []).map((v) =>
      v.enemies.map((e: any) => e.id)
    ),
  ].flat() as AllGameEnemyID[];

  return [...new Set(allEnemyInArea)];
};