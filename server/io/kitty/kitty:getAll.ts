import { DefaultEventsMap, Socket } from "socket.io"
import { getTaskQueueInRedis } from "../../utils/game/taskQueue"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { getAllKittyByOwner } from "~/server/utils/game/kitty"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<string>) {
    const user = data.user
    const kittyList = await getAllKittyByOwner(data.data ?? user.uuid)

    emitEventToUser(data.user, "kitty:getAll:success", kittyList)
}