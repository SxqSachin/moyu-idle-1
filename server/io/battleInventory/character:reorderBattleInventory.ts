import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { reorderCharacterBattleInventory } from "~/server/utils/game/battleInventory"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ order: string[] }>
) {
  try {
    const characterUuid = data.user.uuid
    const inventoryOrder = data.data?.order
    if (!Array.isArray(inventoryOrder) || inventoryOrder.length === 0) {
      throw new Error("物品袋排序参数无效")
    }
    const skillInfo = await reorderCharacterBattleInventory(characterUuid, inventoryOrder)
    emitEventToUser(data.user, "character:reorderBattleInventory:success", skillInfo)
  } catch (err: any) {
    emitEventToUser(data.user, "character:reorderBattleInventory:error", { message: err.message })
  }
}