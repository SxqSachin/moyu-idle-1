import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { addKittyTaskToQueueInRedis, getKitty, getKittyTaskQueueInRedis } from "~/server/utils/game/kitty"
import { scheduleKittyImmediate } from "~/server/utils/game/kittySchedule"
import type { GameTask } from "~/shared/types/gameTask"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ kittyUuid: string, task: GameTask }>
) {
  try {
    const { kittyUuid, task } = data.data
    const kitty = await getKitty(kittyUuid)
    if (!kitty) {
      emitEventToUser(data.user, "kitty:addTask:error", { message: "小猫咪不存在" })
      return
    }

  await addKittyTaskToQueueInRedis(kittyUuid, task)
  await scheduleKittyImmediate(kittyUuid)
    const taskQueue = await getKittyTaskQueueInRedis(kittyUuid)
    emitEventToUser(data.user, "kitty:addTask:success", { kittyUuid, taskQueue })
  } catch (e: any) {
    emitEventToUser(data.user, "kitty:addTask:error", { message: e.message || "指派任务失败" })
  }
}