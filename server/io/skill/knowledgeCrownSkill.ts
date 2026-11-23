import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { AllBattleSkillId, DamageType, GameBattleSkill, GameCharacterBattleSkillInfo } from "~/shared/types/skill";
import { safeJsonParse } from "~/shared/utils";
import { getUserEquipment } from "~/server/utils/game/equipment";
import { getEquipmentActuralId, getEquipmentLevel } from "~/shared/utils/game/equipment";
import { CharacterSkillInfo } from "~/generated/prisma";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";

/** 查询拍卖列表 */
export async function handleUpdateKnowledgeCrownSkill(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ skills: AllBattleSkillId[] }>
) {
  const userUuid = data.user.uuid;

  await withUniqueLock("knowledgeCrownSkill:update:" + userUuid, async () => {
    try {
      const skills = data.data.skills;

      if (!skills.length) {
        throw new Error("技能列表不能为空");
      }

      for(const skillId of skills) {
        if (skillId == 'knowledgeCrownSkill') {
          throw new Error("无法融入“集智“");
        }
        if (skillId == 'baseAttack') {
          throw new Error("无法融入“普通攻击“");
        }

        let skillConf = allGameBattleSkills[skillId] as GameBattleSkill;

        if (skillConf.passive) {
          throw new Error(`无法融合被动技能：”${skillConf.name}“`);
        }

        let damageType = skillConf.damageType
        const damageTypeArr = Array.isArray(damageType) ? damageType : [damageType]

        if (damageTypeArr.includes(DamageType.Physical)) {
          throw new Error(`无法融合物理伤害技能：”${skillConf.name}“`);
        }

        const skillInfo = await getCharacterSkill(userUuid, skillId)
        if (!skillInfo) {
          throw new Error(`无法融合尚未学习的技能：“${skillConf.name}”`);
        }

        if (!skillInfo.enabled) {
          throw new Error(`无法融合尚未启用的技能：“${skillConf.name}”`);
        }
      }

      await prisma.$transaction(async (tx) => {
        const equipment = await getUserEquipment(userUuid, 'battle', tx)

        const headEquipmentId = equipment.head;
        const headActualEquipmentId = getEquipmentActuralId(headEquipmentId ?? '')
        if (!headEquipmentId || headActualEquipmentId != 'knowledgeCrown') {
            throw new Error("当前未穿戴“知识冠冕”");
        }

        const equipmentLevel = getEquipmentLevel(headEquipmentId);
        const combineSkillLimitList = [0, 0, 2, 3, 3, 4];
        const combineSkillLimit = combineSkillLimitList[equipmentLevel] ?? 0

        // skills的长度必须小于equipmentLevel - 2
        if (skills.length > combineSkillLimit) {
            throw new Error("技能数量超过上限");
        }

        let currentSkillInfo = await tx.characterSkillInfo.findUnique({
          where: {
            character_user_skill_unique: {
              character_uuid: userUuid,
              user_uuid: userUuid,
              skill_id: "knowledgeCrownSkill",
            },
          },
        })

        if (!currentSkillInfo) {
          const knowledgeCrownSkillInfo = {
            knowledgeCrownSkills: skills,
          };
          await tx.characterSkillInfo.create({
            data: {
              character_uuid: userUuid,
              user_uuid: userUuid,
              skill_id: "knowledgeCrownSkill",
              level: equipmentLevel,
              exp: 0,
              extra: JSON.stringify(knowledgeCrownSkillInfo),
            },
          });
        } else {
          let currentExtra: GameCharacterBattleSkillInfo['extra'] = safeJsonParse(currentSkillInfo.extra, {});
          if (!currentExtra) {
            currentExtra = {};
          }
          currentExtra.knowledgeCrownSkills = skills;

          await tx.characterSkillInfo.update({
            where: {
              character_user_skill_unique: {
                character_uuid: userUuid,
                user_uuid: userUuid,
                skill_id: "knowledgeCrownSkill",
              },
            },
            data: {
              extra: JSON.stringify(currentExtra),
            },
          });
        }


        emitEventToUser(userUuid, "knowledgeCrownSkill:update:success", {
          skills,
        });
      });
    } catch (e: any) {
      emitEventToUser(userUuid, "knowledgeCrownSkill:update:failed", {
        message: e.message,
      });
    }
  });
}

export async function handleGetKnowledgeCrownSkill(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;
  try {
    let res = await prisma.characterSkillInfo.findUnique({
        select: {
            extra: true
        },
        where: {
            character_user_skill_unique: {
                character_uuid: userUuid,
                user_uuid: userUuid,
                skill_id: 'knowledgeCrownSkill'
            }
        }
    });

    const extra: GameCharacterBattleSkillInfo['extra'] = safeJsonParse(res?.extra, {}) ?? {}

    const skills = extra.knowledgeCrownSkills ?? []

    emitEventToUser(userUuid, "knowledgeCrownSkill:get:success", {skills});
  } catch (e: any) {
    emitEventToUser(userUuid, "knowledgeCrownSkill:get:failed", { message: e.message});
  }
}

