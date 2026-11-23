import { DefaultEventsMap, Socket } from "socket.io"
import { getTaskQueueInRedis } from "../utils/game/taskQueue"
import { emitEventToUser } from "."
import { GameSocketData } from "~/shared/types/socket"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<any>) {
    const user = data.user
    const taskQueue = await getTaskQueueInRedis(user.uuid)

    emitEventToUser(user.uuid, "dispatchTaskQueueToClient", taskQueue)
}