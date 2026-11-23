import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { getAllCharacterSkills, } from "~/server/utils/game/characterSkill"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{uuid: string}>
) {
  try {
    const skillInfo = await getAllCharacterSkills(data.data?.uuid ?? data.user.uuid)
    emitEventToUser(data.user, "character:getSkills:success", skillInfo)
  } catch (err: any) {
    emitEventToUser(data.user, "character:getSkills:error", { message: err.message })
  }
}