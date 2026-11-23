import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { dispatchTargetCharacterStatusInfo, getCharacterStatusInfo } from "../utils/game/characterStatus"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<string>) {
    const statusInfo = await getCharacterStatusInfo(data.data)
    dispatchTargetCharacterStatusInfo(data.user.uuid, statusInfo)
}