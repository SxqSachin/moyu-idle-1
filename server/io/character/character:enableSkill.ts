import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getAllCharacterSkills, updateCharacterSkillLogic } from "~/server/utils/game/characterSkill";
import { GameBattleLogic } from "~/shared/types/skill";
import { prisma } from "~/server/utils/game/db";

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ skillId: string, logic: GameBattleLogic[] }>
) {
    const userUuid = data.user.uuid;
    const { skillId, } = data.data;

    await prisma.characterSkillInfo.updateMany({
        where: {
            character_uuid: userUuid,
            user_uuid: userUuid,
            skill_id: skillId
        },
        data: {
            enabled: true
        }
    });

    const skillInfo = await getAllCharacterSkills(userUuid)
    emitEventToUser(data.user, "character:getSkills:success", skillInfo)
}