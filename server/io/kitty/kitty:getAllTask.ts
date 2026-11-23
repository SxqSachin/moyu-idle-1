import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { getKitty, getKittyTaskQueueInRedis } from "~/server/utils/game/kitty"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ kittyUuid: string }>
) {
  try {
    const { kittyUuid } = data.data
    const kitty = await getKitty(kittyUuid)
    if (!kitty) {
      emitEventToUser(data.user, "kitty:getAllTask:error", { message: "小猫咪不存在" })
      return
    }

    const taskQueue = await getKittyTaskQueueInRedis(kittyUuid)
    emitEventToUser(data.user, "kitty:getAllTask:success", { kittyUuid, taskQueue })
  } catch (e: any) {
    emitEventToUser(data.user, "kitty:getAllTask:error", { message: e.message || "获取任务失败" })
  }
}