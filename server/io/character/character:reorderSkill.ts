import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { reorderCharacterSkills } from "~/server/utils/game/characterSkill"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ uuid: string; skillOrder: string[] }>
) {
  try {
    const characterUuid = data.data?.uuid ?? data.user.uuid
    const skillOrder = data.data?.skillOrder
    if (!Array.isArray(skillOrder) || skillOrder.length === 0) {
      throw new Error("技能顺序参数无效")
    }
    const skillInfo = await reorderCharacterSkills(characterUuid, skillOrder)
    emitEventToUser(data.user, "character:reorderSkill:success", skillInfo)
  } catch (err: any) {
    emitEventToUser(data.user, "character:reorderSkill:error", { message: err.message })
  }
}