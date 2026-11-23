import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { updateAllActionDuration, updateAllActionResourceRequirement } from "~/server/utils/game/character"

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<void>
) {
    const user = data.user

    try {
        const latestAllActionDurationDetail = await updateAllActionResourceRequirement(user.uuid)

        emitEventToUser(user, "character:updateActionResourceRequirement:success", latestAllActionDurationDetail)
    } catch (err: any) {
        emitEventToUser(user, "character:updateActionResourceRequirement:error", { 
            message: err.message 
        })
    }
}