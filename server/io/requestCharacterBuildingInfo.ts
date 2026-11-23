import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { CharacterBuildingInfo } from "~/shared/types/building"
import { dispatchCharacterBuildingInfoToClient } from "../utils/game/building"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<CharacterBuildingInfo>) {
    dispatchCharacterBuildingInfoToClient(data.user.uuid)
}