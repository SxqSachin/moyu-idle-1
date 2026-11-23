import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { AllBattleSkillId, GameBattleSkill, GameCharacterBattleSkillInfo } from "~/shared/types/skill";
import { safeJsonParse } from "~/shared/utils";
import { getUserEquipment } from "~/server/utils/game/equipment";
import { getEquipmentActuralId, getEquipmentLevel } from "~/shared/utils/game/equipment";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";

/** 查询拍卖列表 */
export async function handleUpdateDominationSealSkill(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ skills: AllBattleSkillId[] }>
) {
  const userUuid = data.user.uuid;

  await withUniqueLock("dominationSealSkill:update:" + userUuid, async () => {
    try {
      const skills = data.data.skills;

      for(const skillId of skills) {
        if (skillId == 'dominationSealSkill') {
          throw new Error("无法统御“统御“");
        }

        const skillConf: GameBattleSkill = allGameBattleSkills[skillId];
        if (!skillConf) {
          throw new Error(`技能不存在：${skillId}`);
        }
        if (skillConf.passive) {
          throw new Error(`技能不可为被动技能：${skillConf.name}`);
        }
      }

      await prisma.$transaction(async (tx) => {
        const equipment = await getUserEquipment(userUuid, 'battle', tx)

        let equipmentId = ''
        const hasDominationSeal = Object.values(equipment).some((eqId) => {
          const actualId = getEquipmentActuralId(eqId ?? '')

          if (actualId == 'domination_seal') {
            equipmentId = eqId ?? ''
            return true;
          }
        })
        if (!hasDominationSeal) {
            throw new Error("当前未佩戴“统御印记”");
        }

        const equipmentLevel = getEquipmentLevel(equipmentId);
        const skillLimitList = [0, 0, 0, 1, 1, 2];
        const skillLimit = skillLimitList[equipmentLevel] ?? 0

        // skills的长度必须小于equipmentLevel - 2
        if (skills.length > skillLimit) {
            throw new Error("统御技能数量超过上限");
        }

        let currentSkillInfo = await tx.characterSkillInfo.findUnique({
          where: {
            character_user_skill_unique: {
              character_uuid: userUuid,
              user_uuid: userUuid,
              skill_id: "dominationSealSkill",
            },
          },
        })

        if (!currentSkillInfo) {
          const dominationSealSkillInfo = {
            dominationSealSkills: skills,
          };
          await tx.characterSkillInfo.create({
            data: {
              character_uuid: userUuid,
              user_uuid: userUuid,
              skill_id: "dominationSealSkill",
              level: equipmentLevel,
              exp: 0,
              extra: JSON.stringify(dominationSealSkillInfo),
            },
          });
        } else {
          let currentExtra: GameCharacterBattleSkillInfo['extra'] = safeJsonParse(currentSkillInfo.extra, {});
          if (!currentExtra) {
            currentExtra = {};
          }
          currentExtra.dominationSealSkills = skills;

          await tx.characterSkillInfo.update({
            where: {
              character_user_skill_unique: {
                character_uuid: userUuid,
                user_uuid: userUuid,
                skill_id: "dominationSealSkill",
              },
            },
            data: {
              extra: JSON.stringify(currentExtra),
            },
          });
        }


        emitEventToUser(userUuid, "dominationSealSkill:update:success", {
          skills,
        });
      });
    } catch (e: any) {
      emitEventToUser(userUuid, "dominationSealSkill:update:failed", {
        message: e.message,
      });
    }
  });
}

export async function handleGetDominationSealSkill(
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
                skill_id: 'dominationSealSkill'
            }
        }
    });

    const extra: GameCharacterBattleSkillInfo['extra'] = safeJsonParse(res?.extra, {}) ?? {}

    const skills = extra.dominationSealSkills ?? []

    emitEventToUser(userUuid, "dominationSealSkill:get:success", {skills});
  } catch (e: any) {
    emitEventToUser(userUuid, "dominationSealSkill:get:failed", { message: e.message});
  }
}

