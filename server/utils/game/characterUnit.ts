import { BaseBattleUnit, BaseUnitStatusInfo, BattleSkillCastLogicInfo, BattleSkillInfo } from "~/shared/types/unit";
import { getCharacterInfoByUuid, getUserLastOnlineIpAndFp } from "./character";
import { CharacterUnitInfo, User } from "~/generated/prisma";
import { prisma } from "./db";
import { CharacterStatusDetail, PlayerProfileInfo } from "~/shared/types/characterInfo";
import { ATTACK_PER_BATTLE_LEVEL, ATTACK_PER_STRENG_LEVEL, DEFENCE_PER_BATTLE_LEVEL } from "~/shared/data/constant";
import { getAllCharacterSkills } from "./characterSkill";
import { getUserEquipment } from "./equipment";
import { clone, safeJsonParse } from "~/shared/utils";
import { allGameResource } from "~/shared/data/allGameResources";
import { allSkillTreeNodeMap } from "~/shared/data/skillTrees";
import { listAllLearnedSkillTreeNodes } from "./skillTree"
import { iteratorUnitAffix } from "./battleAction";
import { affixDefinitionsById } from "~/shared/data/affix/definitions";

export const toBaseBattleUnit = (characterUnitInDB: CharacterUnitInfo): BaseBattleUnit => {

  let status = {
      strength: { level: characterUnitInDB.strength },
      dexterity: { level: characterUnitInDB.dexterity },
      intelligence: { level: characterUnitInDB.intelligence },
      stamina: { level: characterUnitInDB.stamina },
      attacking: { level: characterUnitInDB.attacking },
      defencing: { level: characterUnitInDB.defencing },
      otherStatus: safeJsonParse<any>(characterUnitInDB.otherStatus, {}),
    }

  return {
    uuid: characterUnitInDB.character_uuid, // 用户UUID
    id: characterUnitInDB.character_uuid,
    name: characterUnitInDB.name, // 如有角色名可替换
    hp: characterUnitInDB.current_hp,
    maxHp: characterUnitInDB.max_hp,
    mp: characterUnitInDB.current_mp,
    maxMp: characterUnitInDB.max_mp,
    tmpShield: 0, // 临时护盾，默认值为0
    // attack: characterUnitInDB.attacking,
    // defense: characterUnitInDB.defencing,
    level: characterUnitInDB.level,
    isPlayer: true,
    isPlayerUnit: true,
    canGetDropReward: true,
    canGetExpReward: true,
    canUseItem: true,

    description: "",

    status,
    baseStatus: clone(status),

    skills: characterUnitInDB.ability ? JSON.parse(characterUnitInDB.ability) : {},
    ai: characterUnitInDB.ai ? JSON.parse(characterUnitInDB.ai) : [],
    skillTreeNodes: characterUnitInDB.skillTreeNodes ? JSON.parse(characterUnitInDB.skillTreeNodes) : [],
    affix: characterUnitInDB.affix ? JSON.parse(characterUnitInDB.affix) : [],

    equipment: characterUnitInDB.equipment ? JSON.parse(characterUnitInDB.equipment) : {}, // 假设有装备信息
    inventory: characterUnitInDB.inventory ? JSON.parse(characterUnitInDB.inventory) : {}, // 假设有物品袋信息

    ip: characterUnitInDB.ip,
    fp: characterUnitInDB.fp || "",
  };
}

export const toCharacterUnitInDB = (unit: BaseBattleUnit, profile: User): Omit<CharacterUnitInfo, "id" | "user_uuid" | "character_uuid"> => {
  return {
    name: unit.name,
    current_hp: unit.hp,
    max_hp: unit.maxHp,
    current_mp: unit.mp,
    max_mp: unit.maxMp,
    attacking: 0, // unit.attack,
    defencing: 0, // unit.defense,
    level: unit.level,
    strength: unit.status.strength.level,
    dexterity: unit.status.dexterity.level,
    intelligence: unit.status.intelligence.level,
    stamina: unit.status.stamina.level,
    ability: JSON.stringify(unit.skills),
    otherStatus: JSON.stringify(unit.status.otherStatus || {}),
    ai: JSON.stringify(unit.ai),
    equipment: JSON.stringify(unit.equipment || {}), // 假设有装备信息
    inventory: JSON.stringify(unit.inventory || {}), // 假设有物品袋信息
    ip: unit.ip || "",
    fp: unit.fp || "",

    skillTreeNodes: JSON.stringify(unit.skillTreeNodes || []),
    affix: JSON.stringify(unit.affix || []),
  };
}


export const getAndUpdateCharacterUnitInfo = async (characterUuid: string): Promise<BaseBattleUnit> => {
  // const characterUnit = await prisma.characterUnitInfo.findFirst({
  //   where: {
  //     character_uuid: characterUuid
  //   }
  // })

  // if (!!characterUnit) {
  //   return toBaseBattleUnit(characterUnit)
  // }

  const defCharacterUnit = await convertCharacterToUnit(characterUuid)

  if (!defCharacterUnit) {
    throw new Error(`Character unit not found for UUID: ${characterUuid}`);
  }

  let characterUnitInfo = await upsertCharacterUnitInfo(characterUuid, defCharacterUnit)

  return characterUnitInfo
}

export const upsertCharacterUnitInfo = async (characterUuid: string, unitData: BaseBattleUnit): Promise<BaseBattleUnit> => {
  // 先查出原始数据
  const characterUnit = await prisma.characterUnitInfo.findFirst({
    where: { character_uuid: characterUuid }
  });

  const playerProfile = await prisma.user.findFirst({
    where: { uuid: characterUuid }
  });

  if (!playerProfile) {
    throw new Error(`Character Not Exist: ${characterUuid}`);
  }

  if (!characterUnit) {
    const info = toCharacterUnitInDB(unitData, playerProfile)

    unitData.uuid = characterUuid;
    unitData.id = characterUuid;

    await prisma.characterUnitInfo.create({
      data: {
        user_uuid: characterUuid,
        character_uuid: characterUuid,
        ...info
      }
    })

    return unitData
  }

  const baseBattleUnit = toBaseBattleUnit(characterUnit);

  // 合并原始数据和新数据
  const updatedUnit: BaseBattleUnit = {
    ...baseBattleUnit,
    ...unitData,
    status: {
      ...baseBattleUnit.status,
      ...(unitData.status || {})
    },
    skills: unitData.skills ?? baseBattleUnit.skills,
    ai: unitData.ai ?? baseBattleUnit.ai,
    inventory: unitData.inventory ?? baseBattleUnit.inventory,
    skillTreeNodes: unitData.skillTreeNodes ?? baseBattleUnit.skillTreeNodes,
  };

  const updatedInfo = toCharacterUnitInDB(updatedUnit, playerProfile);

  await prisma.characterUnitInfo.update({
    where: { character_uuid: characterUuid },
    data: updatedInfo
  });

  return updatedUnit
}

/**
 * 根据角色uuid获取战斗单位对象
 */
export const convertCharacterToUnit = async (characterUuid: string): Promise<BaseBattleUnit | null> => {
  const info = await getCharacterInfoByUuid(characterUuid);

  if (!info) {
    return null
  }

  const { status: statusInfo, base } = info

  const characterSkills = await getAllCharacterSkills(characterUuid);

  const equipment = await getUserEquipment(characterUuid, 'battle')

  const inventoryInfo = await getBattleInventoryAsUnitInfo(characterUuid);

  const skillTreeNode = await listAllLearnedSkillTreeNodes(characterUuid);

  let affix = await listCharacterAffixes(characterUuid, characterUuid);
  affix = affix.filter(a => a.state === 'ACTIVE');

  const skillObj: BattleSkillInfo = {}
  const logicObj: BattleSkillCastLogicInfo = {}

  for (const skill of characterSkills) {
    if (!skill.enabled) {
      continue;
    }

    skillObj[skill.skillId] = {
      level: skill.level,
      order: skill.order
    };
    if (skill.extra) {
      skillObj[skill.skillId]!.extra = skill.extra;
    }
    logicObj[skill.skillId] = skill.logic
  }

  if (!skillObj.baseAttack) {
    skillObj.baseAttack = {
      level: 1,
      order: 999
    }
  }

  const getStatusValue = (detail: CharacterStatusDetail) => {
    return detail.final ?? detail.level
  }

  const ipfp = await getUserLastOnlineIpAndFp(characterUuid)

  const stamina = { level: getStatusValue(statusInfo.stamina) }
  const intelligence = { level: getStatusValue(statusInfo.intelligence) }

  let otherStatusInfo: BaseUnitStatusInfo['otherStatus'] = {
    collecting: {level: getStatusValue(statusInfo.collecting)},
    mining: {level: getStatusValue(statusInfo.mining)},
    fishing: {level: getStatusValue(statusInfo.fishing)},
    farmingAnimal: {level: getStatusValue(statusInfo.farmingAnimal)},
    farmingPlant: {level: getStatusValue(statusInfo.farmingPlant)},
    cooking: {level: getStatusValue(statusInfo.cooking)},
    manufacturing: {level: getStatusValue(statusInfo.manufacturing)},
    forging: {level: getStatusValue(statusInfo.forging)},
    sewing: {level: getStatusValue(statusInfo.sewing)},
    trading: {level: getStatusValue(statusInfo.trading)},
    knowledge: {level: getStatusValue(statusInfo.knowledge)},
    exploring: {level: getStatusValue(statusInfo.exploring)},
    mysterious: {level: getStatusValue(statusInfo.mysterious)},
    enhance: {level: getStatusValue(statusInfo.enhance)},
    luck: {level: getStatusValue(statusInfo.luck)},
  }

  let hp = 50 + (stamina.level * 5);

  for(const equipmentId of Object.values(equipment)) {
    if (!equipmentId) {
      continue;
    }
    let equipment = allGameResource[equipmentId]

    for (const onEquip of equipment?.onEquip || []) {
      for(const statusEffect of onEquip.statusEffect || []) {
        // @ts-ignore
        if (statusEffect.status == 'hp') {
          hp += statusEffect.increase || 0;
          hp -= statusEffect.decrease || 0;
        }
      }
    }
  }

  for(const skillNode of skillTreeNode) {
    let nodeConf = allSkillTreeNodeMap[skillNode.nodeId];

    if (!nodeConf) {
      continue;
    }

    if (typeof nodeConf.businessBattleEffects?.hpModifyEffect == 'function') {
      const hpModifyEffects = nodeConf.businessBattleEffects?.hpModifyEffect(skillNode.level) || [];

      hp += hpModifyEffects.modifyNumber
    }
  }

  for(const affixInstance of affix) {
    const affixConf = affixDefinitionsById[affixInstance.affixId];
    if (!affixConf || typeof affixConf.effect.onModifyMaxHp !== 'function') {
      continue;
    }

    const modifyHp = affixConf.effect.onModifyMaxHp({
      characterStatus: statusInfo,
      effect: affixInstance.effect
    });

    hp += modifyHp.maxHp || 0;
  }

  let status = {
      strength: { level: getStatusValue(statusInfo.strength) },
      dexterity: { level: getStatusValue(statusInfo.dexterity) },
      intelligence: { level: getStatusValue(statusInfo.intelligence) },
      stamina: stamina,
      attacking: { level: getStatusValue(statusInfo.attacking) + Math.floor(statusInfo.battle.level * ATTACK_PER_BATTLE_LEVEL) + Math.floor(statusInfo.strength.level * ATTACK_PER_STRENG_LEVEL) },
      defencing: { level: getStatusValue(statusInfo.defencing) + Math.floor(statusInfo.battle.level * ATTACK_PER_BATTLE_LEVEL) },
      otherStatus: otherStatusInfo,
    }

  const unit: BaseBattleUnit = {
    uuid: characterUuid,
    id: characterUuid,
    name: base.name,
    maxHp: hp,
    hp: hp,
    mp: 50 + (intelligence.level * 5),
    maxMp: 50 + (intelligence.level * 5),
    tmpShield: 0, // 临时护盾，默认值为0
    // attack: getStatusValue(statusInfo.attacking) + Math.floor(statusInfo.battle.level * ATTACK_PER_BATTLE_LEVEL) + Math.floor(statusInfo.strength.level * ATTACK_PER_STRENG_LEVEL),
    // defense: getStatusValue(statusInfo.defencing) + Math.floor(statusInfo.battle.level * DEFENCE_PER_BATTLE_LEVEL),
    level: statusInfo.battle.level,

    isPlayer: true,
    canGetDropReward: true,
    canGetExpReward: true,
    canUseItem: true,
  
    // 是否是玩家单位
    isPlayerUnit: true,

    status,
    baseStatus: clone(status),

    skills: skillObj,
    ai: logicObj,
    equipment: equipment ?? {}, // 假设有装备信息
    ip: ipfp.ip,
    fp: ipfp.fp,
    inventory: inventoryInfo, // 假设有物品袋信息

    affix: affix,  // 角色词缀

    skillTreeNodes: skillTreeNode,  // 学习的技能树节点
    // 可根据需要补充其它属性
  };

  if (base.userState?.battle?.stateWhenStartEachBattle?.length) {
    unit.stateWhenStartEachBattle = base.userState.battle.stateWhenStartEachBattle
  }

  return unit
};