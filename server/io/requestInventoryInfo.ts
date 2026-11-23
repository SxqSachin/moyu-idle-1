import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { CharacterInventory } from "~/shared/types/gameInventory"
import { dispatchInventoryInfoToClient, } from "../utils/game/characterInventory"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<CharacterInventory>) {
    dispatchInventoryInfoToClient(data.user.uuid)
}