import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getAllCharacterSkills, updateCharacterSkillLogic } from "~/server/utils/game/characterSkill";
import { GameBattleLogic } from "~/shared/types/skill";

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ skillId: string, logic: GameBattleLogic[] }>
) {
    const user = data.user;
    const { skillId, logic } = data.data;

    try {
        await updateCharacterSkillLogic(user.uuid, skillId, logic);

        emitEventToUser(user.uuid, "character:updateSkillCastLogic:success");

        const skillInfo = await getAllCharacterSkills(data.user.uuid)
        emitEventToUser(data.user, "character:getSkills:success", skillInfo)
    } catch (err: any) {
        emitEventToUser(user.uuid, "character:updateSkillCastLogic:error", {
            message: err.message
        });
    }
}