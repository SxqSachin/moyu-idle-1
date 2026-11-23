import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { CharacterStatusInfo } from "~/shared/types/characterInfo"
import { dispatchCharacterStatusInfo, getCharacterStatusInfo } from "../utils/game/characterStatus"
import { updateCharacterStatusInfo } from "../utils/game/character"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<CharacterStatusInfo>) {
    let statusInfo = await updateCharacterStatusInfo(data.user.uuid)

    // const statusInfo = await getCharacterStatusInfo(data.user.uuid)
    dispatchCharacterStatusInfo(data.user.uuid, statusInfo)
}