import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { getCharacterGameState, getPlayerProfileInfo } from "../../utils/game/character"
import type { PlayerInfo, PlayerProfileInfo } from "~/shared/types/characterInfo"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{uuid: string}>
) {

  const targetUuid = data.data.uuid ?? data.user.uuid;

  try {
    const gameState = await getCharacterGameState(targetUuid) 
    emitEventToUser(data.user, "character:getGameState:success", { gameState });
  } catch (err: any) {
    emitEventToUser(data.user, "character:getGameState:error", { message: err.message })
  }
}