import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { AllBattleSkillId, GameBattleSkill, GameCharacterBattleSkillInfo } from "~/shared/types/skill";
import { safeJsonParse } from "~/shared/utils";
import { getUserEquipment } from "~/server/utils/game/equipment";
import { getEquipmentActuralId, getEquipmentLevel } from "~/shared/utils/game/equipment";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";

/** 查询拍卖列表 */
export async function handleUpdateIntertwinedCatEyeGenesisEssenceStaffSkill(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ skills: AllBattleSkillId[] }>
) {
  const userUuid = data.user.uuid;

  await withUniqueLock("intertwinedCatEyeGenesisEssenceStaffSkill:update:" + userUuid, async () => {
    try {
      const skills = data.data.skills;
      const userSkills = await getAllCharacterSkills(userUuid)

      if (skills.length != 2) {
        throw new Error("技能数量必须为2");
      }

      for(const skillId of skills) {
        const skillConf: GameBattleSkill = allGameBattleSkills[skillId];
        if (!skillConf) {
          throw new Error(`技能不存在：${skillId}`);
        }
        if (skillConf.passive) {
          throw new Error(`技能不可为被动技能：${skillConf.name}`);
        }

        if (skillId == 'intertwinedCatEyeGenesisEssenceStaffSkill') {
          throw new Error("无法设置“交织“");
        }
        if (skillId == 'baseAttack') {
          throw new Error("无法设置“普通攻击“");
        }

        const skillInfo = userSkills.find((s) => s.skillId == skillId);
        if (!skillInfo) {
          throw new Error(`未习得技能：${skillConf.name}`);
        }

        if (!skillInfo.enabled) {
          throw new Error(`技能未启用：${skillConf.name}`);
        }
      }

      await prisma.$transaction(async (tx) => {
        const equipment = await getUserEquipment(userUuid, 'battle', tx)

        let equipmentId = ''
        const hasIntertwinedCatEyeGenesisEssenceStaff = Object.values(equipment).some((eqId) => {
          const actualId = getEquipmentActuralId(eqId ?? '')

          if (actualId == 'intertwinedCatEyeGenesisEssenceStaff') {
            equipmentId = eqId ?? ''
            return true;
          }
        })
        if (!hasIntertwinedCatEyeGenesisEssenceStaff) {
            throw new Error("当前未佩戴“棱彩交织法杖”");
        }

        const equipmentLevel = getEquipmentLevel(equipmentId);
        const skillLimitList = [2, 2, 2, 2, 2, 2];
        const skillLimit = skillLimitList[equipmentLevel] ?? 0

        // skills的长度必须小于equipmentLevel - 2
        if (skills.length > skillLimit) {
            throw new Error("技能数量超过上限");
        }

        let currentSkillInfo = await tx.characterSkillInfo.findUnique({
          where: {
            character_user_skill_unique: {
              character_uuid: userUuid,
              user_uuid: userUuid,
              skill_id: "intertwinedCatEyeGenesisEssenceStaffSkill",
            },
          },
        })

        if (!currentSkillInfo) {
          const intertwinedCatEyeGenesisEssenceStaffSkill = {
            intertwinedCatEyeGenesisEssenceStaffSkills: skills,
          };
          await tx.characterSkillInfo.create({
            data: {
              character_uuid: userUuid,
              user_uuid: userUuid,
              skill_id: "intertwinedCatEyeGenesisEssenceStaffSkill",
              level: equipmentLevel,
              exp: 0,
              extra: JSON.stringify(intertwinedCatEyeGenesisEssenceStaffSkill),
            },
          });
        } else {
          let currentExtra: GameCharacterBattleSkillInfo['extra'] = safeJsonParse(currentSkillInfo.extra, {});
          if (!currentExtra) {
            currentExtra = {};
          }
          currentExtra.intertwinedCatEyeGenesisEssenceStaffSkills = skills;

          await tx.characterSkillInfo.update({
            where: {
              character_user_skill_unique: {
                character_uuid: userUuid,
                user_uuid: userUuid,
                skill_id: "intertwinedCatEyeGenesisEssenceStaffSkill",
              },
            },
            data: {
              extra: JSON.stringify(currentExtra),
            },
          });
        }


        emitEventToUser(userUuid, "intertwinedCatEyeGenesisEssenceStaffSkill:update:success", {
          skills,
        });
      });
    } catch (e: any) {
      emitEventToUser(userUuid, "intertwinedCatEyeGenesisEssenceStaffSkill:update:failed", {
        message: e.message,
      });
    }
  });
}

export async function handleGetIntertwinedCatEyeGenesisEssenceStaffSkill(
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
                skill_id: 'intertwinedCatEyeGenesisEssenceStaffSkill'
            }
        }
    });

    const extra: GameCharacterBattleSkillInfo['extra'] = safeJsonParse(res?.extra, {}) ?? {}

    const skills = extra.intertwinedCatEyeGenesisEssenceStaffSkills ?? []

    emitEventToUser(userUuid, "intertwinedCatEyeGenesisEssenceStaffSkill:get:success", {skills});
  } catch (e: any) {
    emitEventToUser(userUuid, "intertwinedCatEyeGenesisEssenceStaffSkill:get:failed", { message: e.message});
  }
}

