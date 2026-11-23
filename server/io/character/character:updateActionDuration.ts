import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { updateAllActionDuration } from "~/server/utils/game/character"

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<void>
) {
    const user = data.user

    try {
        const latestAllActionDurationDetail = await updateActionDuration(user.uuid)

        // emitEventToUser(user, "character:updateActionDuration:success", latestAllActionDurationDetail)
    } catch (err: any) {
        emitEventToUser(user, "character:updateActionDuration:error", { 
            message: err.message 
        })
    }
}