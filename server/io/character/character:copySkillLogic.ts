import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getAllCharacterSkills, getCharacterSkill, updateCharacterSkillLogic } from "~/server/utils/game/characterSkill";
import { AllBattleSkillId, GameBattleLogic } from "~/shared/types/skill";
import { prisma } from "~/server/utils/game/db";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";
import { getBattleRoomByUserId } from "~/server/utils/game/battle";

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ playerUuid: string }>
) {
    let self = data.user.uuid;

    if (!data.data.playerUuid) {
        emitEventToUser(data.user, "character:copySkillLogic:fail", { message: "玩家UUID不能为空" });
        return;
    }

    if (data.data.playerUuid === self) {
        emitEventToUser(data.user, "character:copySkillLogic:fail", { message: "不能复制自己的技能配置" });
        return;
    }

    let battleRoom = await getBattleRoomByUserId(self);
    if (battleRoom && (battleRoom?.status != 'waiting' || !!battleRoom.battleUuid)) {
        emitEventToUser(data.user, "character:copySkillLogic:fail", { message: "只能在非战斗状态下复制技能配置" });
        return;
    }

    let targetPlayerSkillInfo = await getAllCharacterSkills(data.data.playerUuid);
    let selfSkillInfo = await getAllCharacterSkills(self);

    let targetPlayerEnabledSkill = targetPlayerSkillInfo.filter(skill => skill.enabled);

    
    // 检查对方拥有的技能自己是否都拥有
    // 把没有的技能列出来
    let missingSkills: AllBattleSkillId[] = [];
    for (const skill of targetPlayerEnabledSkill) {
        if (!selfSkillInfo.some(s => s.skillId === skill.skillId)) {
            missingSkills.push(allGameBattleSkills[skill.skillId].id);
        }
    }
    missingSkills = missingSkills.filter(skillId => !!skillId && !!allGameBattleSkills[skillId]);

    if (missingSkills.length > 0) {
        emitEventToUser(data.user, "character:copySkillLogic:fail", { message: `你尚未学习以下技能`, missingSkills: missingSkills });
        return;
    }

    // 禁用自己所有技能
    await prisma.characterSkillInfo.updateMany({
        where: {
            character_uuid: self,
            user_uuid: self,
        },
        data: {
            enabled: false
        }
    });

    targetPlayerSkillInfo = targetPlayerSkillInfo.filter(skill => skill.enabled);
    // 禁用自己所有技能
    for (const skill of targetPlayerSkillInfo) {
        let selfSkillInfo = await getCharacterSkill(self, skill.skillId);

        if (!selfSkillInfo) {
            continue
        }

        await prisma.characterSkillInfo.updateMany({
          where: {
            character_uuid: self,
            user_uuid: self,
            skill_id: skill.skillId,
          },
          data: {
            enabled: true,
            order: skill.order,
          },
        });

        await updateCharacterSkillLogic(self, skill.skillId, skill.logic)
    }

    emitEventToUser(data.user, "character:copySkillLogic:success")
}