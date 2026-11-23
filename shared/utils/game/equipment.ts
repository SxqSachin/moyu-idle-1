import type { WorkEquipmentTriggerInfo } from "~/shared/types/battle"
import { CharacterEquipmentPart, type CharacterEquipmentInfo } from "~/shared/types/characterInfo"
import type { AllGameResourceID, GameResource } from "~/shared/types/gameResource"
import type { BaseBattleUnit } from "~/shared/types/unit"
import { ObjectKeysTyped } from ".."
import { allGameResource } from "~/shared/data/allGameResources"
import { allWorkEquipmentTriggerData } from "~/server/data/allWorkEquipmentTriggerData"

export function parseEquimentPartToString(part?: CharacterEquipmentPart) {
    switch (part) {
        case CharacterEquipmentPart.leftHand:
            return '左手'
        case CharacterEquipmentPart.leftHand2:
            return '左手2'

        case CharacterEquipmentPart.rightHand:
            return '右手'
        case CharacterEquipmentPart.rightHand2:
            return '右手2'

        case CharacterEquipmentPart.head:
            return '头部'
        case CharacterEquipmentPart.body:
            return '身体'
        case CharacterEquipmentPart.arm:
            return '手臂'
        case CharacterEquipmentPart.leg:
            return '腿部'
        case CharacterEquipmentPart.foot:
            return '鞋子'
        case CharacterEquipmentPart.cloak:
            return '背部' // 新增披风装备
        case CharacterEquipmentPart.decorate1:
        case CharacterEquipmentPart.decorate2:
        case CharacterEquipmentPart.decorate3:
        case CharacterEquipmentPart.decorate4:
        case CharacterEquipmentPart.decorate5:
        case CharacterEquipmentPart.decorate6:
        case CharacterEquipmentPart.decorate7:
        case CharacterEquipmentPart.decorate8:
        case CharacterEquipmentPart.decorate9:
            return '饰品'
    }
}

// runtime cache for parsed equipment actual ids to avoid repeated string split
const resourceActualIdCache = new Map<string, string>();

export const getResourceActuralId = (equipmentId: string): string => {
  if (!equipmentId) return "";

  // fast path: cached
  const cached = resourceActualIdCache.get(equipmentId);
  if (typeof cached === 'string') return cached;

  const idPart = equipmentId.split("+")[0];
  if (!idPart) {
    resourceActualIdCache.set(equipmentId, "");
    return "";
  }
  // 返回解析后的实际ID
  resourceActualIdCache.set(equipmentId, idPart);
  return idPart;
}

export const getEquipmentActuralId = (equipmentId: string): string => {
  return getResourceActuralId(equipmentId);
}

// runtime cache for parsed equipment levels to avoid repeated parseInt calls
const equipmentLevelCache = new Map<string, number>();

export const getEquipmentLevel = (equipmentId: string): number => {
  // fast path: cached
  const cached = equipmentLevelCache.get(equipmentId);
  if (typeof cached === 'number') return cached;

  const levelPart = equipmentId.split("+")[1];
  const levelInt = parseInt(levelPart as string, 10);

  // treat NaN and non-positive values as 0 (preserve previous behavior)
  if (isNaN(levelInt) || levelInt <= 0) {
    equipmentLevelCache.set(equipmentId, 0);
    return 0;
  }

  equipmentLevelCache.set(equipmentId, levelInt);
  return levelInt;
}

export const getUnitEquipmentLevel = (
  unit: BaseBattleUnit,
  equipmentId: string
): number => {
  if (!unit.equipment || !equipmentId) return 0;

  let level = 0;

  Object.values(unit.equipment).forEach((equipment) => {
    if ((equipment ?? "").includes(equipmentId)) {
      level = getEquipmentLevel(equipment);
    }
  });

  return level;
};

export function hasEquipment(unit: BaseBattleUnit, itemId: AllGameResourceID): boolean {
  if (!unit.equipment || !itemId) return false;

  itemId = itemId.split('+')[0]

  return Object.values(unit.equipment).some((equipment) => {
    return (equipment ?? "").includes(itemId)
  });
}


type IteratorWorkEquipmentBreakCallback = (opt: {
    equipmentId: string;
    equipmentInfo: GameResource;
    rawEquipmentId: string;
    equipmentLevel: number;
    equipmentTrigger?: WorkEquipmentTriggerInfo
  }) => boolean | undefined | void
export function iteratorWorkEquipment(
  workEquipment: CharacterEquipmentInfo,
  breakCallback: IteratorWorkEquipmentBreakCallback,
): void {
  if (!workEquipment || !Object.keys(workEquipment).length) {
    return;
  }

  for (const part of ObjectKeysTyped(workEquipment ?? {})) {
    let equipmentId = workEquipment?.[part];
    if (!equipmentId) {
      continue;
    }

    let equipmentInfo = allGameResource[equipmentId];
    if (!equipmentInfo) {
      continue;
    }

    const rawEquipmentId = getEquipmentActuralId(equipmentId);

    const equipmentTrigger = allWorkEquipmentTriggerData[rawEquipmentId];

    const equipmentLevel = getEquipmentLevel(equipmentId);

    let cRes = breakCallback({ equipmentInfo, equipmentId, rawEquipmentId, equipmentLevel, equipmentTrigger });

    if (cRes && typeof cRes === "boolean") {
      break;
    }
  }
}