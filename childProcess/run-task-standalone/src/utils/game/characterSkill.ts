import type { CharacterSkillInfo } from "~/generated/prisma"
import { Prisma } from "~/generated/prisma"
import { prisma } from "../prisma"
import { levelExpTable } from "~/shared/data/levelExpTable"
import type { AllBattleSkillId, GameBattleLogic, GameCharacterBattleSkillInfo } from "~/shared/types/skill"
import type { PrismaTx } from "~/shared/types/socket/db"
import type { Sql } from "@prisma/client/runtime/library"
import { dbExecuteWithRetry } from "../dbUtils"

const toCharacterSkillInfo = (skillInDB: CharacterSkillInfo): GameCharacterBattleSkillInfo => {
    return {
        skillId: skillInDB.skill_id as AllBattleSkillId,
        level: skillInDB.level,
        exp: skillInDB.exp,
        enabled: skillInDB.enabled,
        logic: JSON.parse(skillInDB.logic || "[]"),
        order: skillInDB.order || 0,
        extra: JSON.parse(skillInDB.extra || "{}"),
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
export const getAllCharacterSkills = async (characterUuid: string) => {
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
    expGain: number,
    tx?: PrismaTx
): Promise<void> => {
  if (!tx) {
    tx = prisma;
  }

  const exist = await tx.characterSkillInfo.findUnique({
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

  await tx.$executeRaw(query)
}

// 批量为多个用户的多条技能增加经验，单条 SQL 插入/更新
export const batchIncreaseCharacterSkillExp = async (
  info: Record<string, {
    skillId: AllBattleSkillId
    increaseExp: number
  }[]>,
  tx?: PrismaTx
): Promise<void> => {
  const userUuids = Object.keys(info)
  if (!userUuids.length) return
  if (!tx) {
    tx = prisma
  }

  // 合并同一用户、同一技能的多次增量
  const mergedByUser = new Map<string, Map<string, number>>()
  for (const [userUuid, list] of Object.entries(info)) {
    if (!list?.length) continue
    const skillMap = mergedByUser.get(userUuid) ?? new Map<string, number>()
    for (const { skillId, increaseExp } of list) {
      if (!increaseExp) continue
      skillMap.set(skillId, (skillMap.get(skillId) ?? 0) + increaseExp)
    }
    if (skillMap.size) mergedByUser.set(userUuid, skillMap)
  }

  if (!mergedByUser.size) return

  const skillIds = new Set<string>()
  for (const skills of mergedByUser.values()) {
    for (const skillId of skills.keys()) {
      skillIds.add(skillId)
    }
  }

  const existing = await tx.characterSkillInfo.findMany({
    where: {
      character_uuid: { in: Array.from(mergedByUser.keys()) },
      skill_id: { in: Array.from(skillIds) },
    },
  })

  const existingMap = new Map<string, CharacterSkillInfo>()
  for (const row of existing) {
    existingMap.set(`${row.character_uuid}::${row.skill_id}`, row)
  }

  const values: Sql[] = []
  for (const [userUuid, skillMap] of mergedByUser.entries()) {
    for (const [skillId, expGain] of skillMap.entries()) {
      const existingRow = existingMap.get(`${userUuid}::${skillId}`)
      const baseLevel = existingRow?.level ?? 1
      const baseExp = existingRow?.exp ?? 0
      const { level, exp } = checkSkillLevelUpgrade(baseLevel, baseExp + expGain)

      values.push(Prisma.sql`(${userUuid}, ${userUuid}, ${skillId}, ${level}, ${exp})`)
    }
  }

  if (!values.length) return

  await dbExecuteWithRetry(async () => {
    const query = Prisma.sql`
    INSERT INTO CharacterSkillInfo (user_uuid, character_uuid, skill_id, level, exp)
    VALUES ${Prisma.join(values, ", ")}
    ON DUPLICATE KEY UPDATE
      level = IF(available, VALUES(level), level),
      exp = IF(available, VALUES(exp), exp)
  `;

    await tx.$executeRaw(query);
  }, 'batchIncreaseCharacterSkillExp-' + Date.now());
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
  logic: GameBattleLogic[]
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