import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { getKitty, getKittyTaskQueueInRedis, removeKittyTaskByIndex } from "~/server/utils/game/kitty"
import { scheduleKittyImmediate, unscheduleKitty } from "~/server/utils/game/kittySchedule"
import { returnTaskUsedResource } from "~/server/utils/game/task"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ kittyUuid: string, index: number }>
) {
  try {
    const { kittyUuid, index } = data.data
    const kitty = await getKitty(kittyUuid)
    if (!kitty) {
      emitEventToUser(data.user, "kitty:removeTask:error", { message: "小猫咪不存在" })
      return
    }

    const removed = await removeKittyTaskByIndex(kittyUuid, index)
    if (!removed) {
      emitEventToUser(data.user, "kitty:removeTask:error", { message: "未找到该任务" })
      return
    }

    if (removed.hasDeductFirstTaskResource) {
      await returnTaskUsedResource(kitty.owner, removed, true)
    }
    // 如果删除的不是首任务，不需要额外操作；如果删除首任务会在工具层已调度。这里兜底：首任务仍存在则立即调度，否则取消。
    const latestQueue = await getKittyTaskQueueInRedis(kittyUuid)
    if (latestQueue.length === 0) {
      await unscheduleKitty(kittyUuid)
    } else {
      await scheduleKittyImmediate(kittyUuid)
    }

    const taskQueue = await getKittyTaskQueueInRedis(kittyUuid)
    emitEventToUser(data.user, "kitty:removeTask:success", { kittyUuid, taskQueue })
  } catch (e: any) {
    emitEventToUser(data.user, "kitty:removeTask:error", { message: e.message || "移除任务失败" })
  }
}