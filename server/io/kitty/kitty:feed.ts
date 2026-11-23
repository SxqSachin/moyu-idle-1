import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { feedKitty, getAllKittyByOwner } from "~/server/utils/game/kitty"
import { AllGameActionID } from "~/shared/types/gameAction"
import { AllGameResourceID } from "~/shared/types/gameResource"
import { dispatchInventoryUpdatedEventToClient } from "~/server/utils/game/characterInventory"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<{ kittyUuid: string, resourceId: AllGameResourceID, count: number }>) {
    try {
        const { kittyUuid, resourceId, count } = data.data
        const kitty = await feedKitty(kittyUuid, resourceId, count)

        emitEventToUser(data.user, "kitty:feed:success", kitty)

        dispatchInventoryUpdatedEventToClient(data.user.uuid)

        emitEventToUser(data.user, "kitty:update:success", kitty)
    } catch (e: any) {
        emitEventToUser(data.user, "kitty:feed:fail", { message: e.message })
    }
}