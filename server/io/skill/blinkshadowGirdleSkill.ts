import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { AllBattleSkillId, GameBattleSkill, GameCharacterBattleSkillInfo } from "~/shared/types/skill";
import { safeJsonParse } from "~/shared/utils";
import { getUserEquipment } from "~/server/utils/game/equipment";
import { getEquipmentActuralId, getEquipmentLevel } from "~/shared/utils/game/equipment";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";

/** 查询拍卖列表 */
export async function handleUpdateBlinkshadowGirdleSkill(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ skills: AllBattleSkillId[] }>
) {
  const userUuid = data.user.uuid;

  await withUniqueLock("blinkshadowGirdleSkill:update:" + userUuid, async () => {
    try {
      const skills = data.data.skills;
      const userSkills = await getAllCharacterSkills(userUuid)

      for(const skillId of skills) {
        const skillConf: GameBattleSkill = allGameBattleSkills[skillId];
        if (!skillConf) {
          throw new Error(`技能不存在：${skillId}`);
        }
        if (skillConf.passive) {
          throw new Error(`技能不可为被动技能：${skillConf.name}`);
        }

        if (skillId == 'blinkshadowGirdleSkill') {
          throw new Error("无法设置“瞬影“");
        }
        if (skillId == 'baseAttack') {
          throw new Error("无法设置“普通攻击“");
        }

        if (skillConf.targetCount >= 10 || skillConf.target == 'all_enemy') {
          throw new Error("无法设置群体伤害技能")
        }

        const skillInfo = userSkills.find((s) => s.skillId == skillId);
        if (!skillInfo) {
          throw new Error(`未习得技能：${skillConf.name}`);
        }

        if (!skillInfo.enabled) {
          throw new Error(`技能未启用：${skillConf.name}`);
        }
      }

      if (skills.length != 1) {
        throw new Error("技能数量必须为1");
      }

      await prisma.$transaction(async (tx) => {
        const equipment = await getUserEquipment(userUuid, 'battle', tx)

        let equipmentId = ''
        const hasEquipment = Object.values(equipment).some((eqId) => {
          const actualId = getEquipmentActuralId(eqId ?? '')

          if (actualId == 'blinkshadowGirdle') {
            equipmentId = eqId ?? ''
            return true;
          }
        })
        if (!hasEquipment) {
            throw new Error("当前未佩戴“瞬影护符”");
        }

        const equipmentLevel = getEquipmentLevel(equipmentId);

        let currentSkillInfo = await tx.characterSkillInfo.findUnique({
          where: {
            character_user_skill_unique: {
              character_uuid: userUuid,
              user_uuid: userUuid,
              skill_id: "blinkshadowGirdleSkill",
            },
          },
        })

        if (!currentSkillInfo) {
          const blinkshadowGirdleSkill = {
            blinkshadowGirdleSkills: skills,
          };
          await tx.characterSkillInfo.create({
            data: {
              character_uuid: userUuid,
              user_uuid: userUuid,
              skill_id: "blinkshadowGirdleSkill",
              level: equipmentLevel,
              exp: 0,
              extra: JSON.stringify(blinkshadowGirdleSkill),
            },
          });
        } else {
          let currentExtra: GameCharacterBattleSkillInfo['extra'] = safeJsonParse(currentSkillInfo.extra, {});
          if (!currentExtra) {
            currentExtra = {};
          }
          currentExtra.blinkshadowGirdleSkills = skills;

          await tx.characterSkillInfo.update({
            where: {
              character_user_skill_unique: {
                character_uuid: userUuid,
                user_uuid: userUuid,
                skill_id: "blinkshadowGirdleSkill",
              },
            },
            data: {
              extra: JSON.stringify(currentExtra),
            },
          });
        }


        emitEventToUser(userUuid, "blinkshadowGirdleSkill:update:success", {
          skills,
        });
      });
    } catch (e: any) {
      emitEventToUser(userUuid, "blinkshadowGirdleSkill:update:failed", {
        message: e.message,
      });
    }
  });
}

export async function handleGetBlinkshadowGirdleSkill(
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
                skill_id: 'blinkshadowGirdleSkill'
            }
        }
    });

    const extra: GameCharacterBattleSkillInfo['extra'] = safeJsonParse(res?.extra, {}) ?? {}

    const skills = extra.blinkshadowGirdleSkills ?? []

    emitEventToUser(userUuid, "blinkshadowGirdleSkill:get:success", {skills});
  } catch (e: any) {
    emitEventToUser(userUuid, "blinkshadowGirdleSkill:get:failed", { message: e.message});
  }
}

