import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { getCharacterInfoByUuid } from "../../utils/game/character"
import type { PlayerInfo } from "~/shared/types/characterInfo"
import { getFirstTask } from "~/server/utils/game/taskQueue"
import { getAllKittyByOwner, getFirstKittyTask, getKitty } from "~/server/utils/game/kitty"
import { Kitty } from "~/shared/types/kitty"
import { AllGameActionID } from "~/shared/types/gameAction"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ characterUuid: string }>
) {
  try {
    const { characterUuid } = data.data
    const playerInfo: PlayerInfo | null = await getCharacterInfoByUuid(characterUuid)

    const firstAction = await getFirstTask(characterUuid)
    const kitties = await getAllKittyByOwner(characterUuid)

    const kittiesInfo: {kitty: Kitty, currentActionId: AllGameActionID}[] = [];
    for (const kitty of kitties) {
      kittiesInfo.push({
        kitty,
        currentActionId: (await getFirstKittyTask(kitty.uuid))?.actionId ?? ''
      })
    }

    emitEventToUser(data.user, "character:getInfo:success", {
      playerInfo,
      currentActionId: firstAction?.actionId,
      kittiesInfo,
    })
  } catch (err: any) {
    emitEventToUser(data.user, "character:getInfo:error", { message: err.message })
  }
}