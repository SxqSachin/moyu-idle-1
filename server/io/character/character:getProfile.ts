import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { getPlayerProfileInfo } from "../../utils/game/character"
import type { PlayerInfo, PlayerProfileInfo } from "~/shared/types/characterInfo"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{uuid: string}>
) {
  try {
    const profileInfo: PlayerProfileInfo | null = await getPlayerProfileInfo(data.user.uuid)
    emitEventToUser(data.user, "character:getProfile:success", profileInfo)
  } catch (err: any) {
    emitEventToUser(data.user, "character:getProfile:error", { message: err.message })
  }
}