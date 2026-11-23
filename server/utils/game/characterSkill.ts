import { CharacterSkillInfo, Prisma } from "~/generated/prisma"
import type { Sql } from "@prisma/client/runtime/library"
import { prisma } from "./db"
import { levelExpTable } from "~/shared/data/levelExpTable"
import { AllBattleSkillId, GameBattleLogic, GameCharacterBattleSkillInfo, GameFullBattleLogic } from "~/shared/types/skill"
import { safeJsonParse } from "~/shared/utils"
import { PrismaTx } from "~/shared/types/socket/db"

const toCharacterSkillInfo = (skillInDB: CharacterSkillInfo): GameCharacterBattleSkillInfo => {
    return {
        skillId: skillInDB.skill_id as AllBattleSkillId,
        level: skillInDB.level,
        exp: skillInDB.exp,
        enabled: skillInDB.enabled,
        logic: safeJsonParse(skillInDB.logic, []) ?? [],
        order: skillInDB.order || 0,
        extra: safeJsonParse(skillInDB.extra, {}) ?? {},
        available: skillInDB.available,
    }
}

// 检查技能升级
function checkSkillLevelUpgrade(level: number, exp: number) {
    let curLevel = level
    let curExp = exp
    while (curLevel < levelExpTable.length - 1 && curExp >= levelExpTable[curLevel]) {
        curExp -= levelExpTable[curLevel]
        curLevel += 1
    }
    return { level: curLevel, exp: curExp }
}

// 获取角色所有技能
export const getAllCharacterSkills = async (characterUuid: string, tx?: PrismaTx) => {
  if (!tx) {
    tx = prisma;
  }
  if (!characterUuid) {
    return []
  }
    let res = await prisma.characterSkillInfo.findMany({
        where: {
            character_uuid: characterUuid,
            available: true,
        },
        orderBy: {
            order: "asc"
        }
    })

    if (!res.find(skill => skill.skill_id == 'baseAttack')) {
      await increaseCharacterSkillExp(characterUuid, 'baseAttack', 1)
      res = await prisma.characterSkillInfo.findMany({
        where: {
          character_uuid: characterUuid
        },
        orderBy: {
          order: "asc"
        }
      })
      await prisma.characterSkillInfo.update({
        where: {
          character_user_skill_unique: {
            user_uuid: characterUuid,
            character_uuid: characterUuid,
            skill_id: 'baseAttack'
          },
        },
        data: {
          order: 999,
        },
      })
    }

    return res.map(toCharacterSkillInfo)
}

// 获取角色单个技能
export const getCharacterSkill = async (characterUuid: string, skillId: string) => {
    let res = await prisma.characterSkillInfo.findUnique({
        where: {
          character_user_skill_unique: {
            user_uuid: characterUuid,
            character_uuid: characterUuid,
            skill_id: skillId
          },
          available: true,
        }
    })

    if (!res) {
        return undefined
    }

    return toCharacterSkillInfo(res)
}

// 增加或更新角色技能经验，并自动升级
export const increaseCharacterSkillExp = async (
    characterUuid: string,
    skillId: string,
    expGain: number
): Promise<void> => {
  const exist = await prisma.characterSkillInfo.findUnique({
    where: {
      character_user_skill_unique: {
        user_uuid: characterUuid,
        character_uuid: characterUuid,
        skill_id: skillId
      },
      available: true,
    }
  })

  const currentLevel = exist?.level ?? 1
  const currentExp = exist?.exp ?? 0
  const { level: newLevel, exp: newExp } = checkSkillLevelUpgrade(currentLevel, currentExp + expGain)

  const query = Prisma.sql`
    INSERT INTO CharacterSkillInfo (user_uuid, character_uuid, skill_id, level, exp)
    VALUES (${characterUuid}, ${characterUuid}, ${skillId}, ${newLevel}, ${newExp})
    ON DUPLICATE KEY UPDATE
      level = IF(available, VALUES(level), level),
      exp = IF(available, VALUES(exp), exp)
  `

  await prisma.$executeRaw(query)
}

type SkillExpGain = {
  skillId: AllBattleSkillId;
  expGain: number;
}

// 设置角色技能等级（如升级时调用）
export const setCharacterSkillLevel = async (
    characterUuid: string,
    skillId: string,
    level: number
) => {
    return prisma.characterSkillInfo.update({
        where: {
          character_user_skill_unique: {
            user_uuid: characterUuid,
            character_uuid: characterUuid,
            skill_id: skillId
          },
          available: true,
        },
        data: {
            level
        }
    })
}


/**
 * 更新角色某个技能的自动释放逻辑
 * @param characterUuid 角色uuid
 * @param skillId 技能id
 * @param logic 新的自动释放逻辑数组
 */
export const updateCharacterSkillLogic = async (
  characterUuid: string,
  skillId: string,
  logic: GameFullBattleLogic
) => {
  await prisma.characterSkillInfo.update({
    where: {
          character_user_skill_unique: {
            user_uuid: characterUuid,
            character_uuid: characterUuid,
            skill_id: skillId
          },
    },
    data: {
      logic: JSON.stringify(logic ?? [])
    }
  });
};


/**
 * 重新调整角色技能顺序
 * @param characterUuid 角色uuid
 * @param skillOrderList 技能id数组，按新顺序排列
 * @returns 更新后的所有技能信息
 */
export const reorderCharacterSkills = async (
  characterUuid: string,
  skillOrderList: string[]
) => {
  // 依次更新每个技能的 order 字段
  await Promise.all(
    skillOrderList.map((skillId, idx) =>
      prisma.characterSkillInfo.update({
        where: {
          character_user_skill_unique: {
            user_uuid: characterUuid,
            character_uuid: characterUuid,
            skill_id: skillId
          },
        },
        data: {
          order: idx,
        },
      })
    )
  );
  // 返回最新顺序的技能
  const skills = await prisma.characterSkillInfo.findMany({
    where: { character_uuid: characterUuid },
    orderBy: { order: "asc" },
  });
  return skills.map(toCharacterSkillInfo);
};