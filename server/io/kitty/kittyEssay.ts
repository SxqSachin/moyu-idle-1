import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import { getKitty, getKittyTaskQueueInRedis, removeKittyTaskByIndex } from "~/server/utils/game/kitty"
import { returnTaskUsedResource } from "~/server/utils/game/task"
import { getKittyEssaysByKitty } from "~/server/utils/game/kittyEssay"

export async function ioGetKittyAllEssay (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ kittyUuid: string, page?: number, pageSize?: number }>
) {
  try {
    const { kittyUuid, page = 1, pageSize = 20 } = data.data
    const userUuid = data.user.uuid

    if (!kittyUuid) {
      emitEventToUser(data.user, "kitty:getAllEssay:error", { message: "猫咪ID不能为空" })
      return
    }

    const kitty = await getKitty(kittyUuid)
    if (!kitty) {
      emitEventToUser(data.user, "kitty:getAllEssay:error", { message: "小猫咪不存在" })
      return
    }

    if (kitty.owner != userUuid) {
      emitEventToUser(data.user, "kitty:getAllEssay:error", { message: "您没有权限查看该小猫咪的日志" })
      return
    }

    // 支持服务端分页：如果 `getKittyEssaysByKitty` 支持参数则传入，否则在内存中切片
    const all = await getKittyEssaysByKitty(kittyUuid, { page, pageSize })
    const items = Array.isArray(all) ? all.slice((page-1)*pageSize, (page)*pageSize) : (all?.items || [])
    const total = Array.isArray(all) ? all.length : (all?.total ?? items.length)
    emitEventToUser(data.user, "kitty:getAllEssay:success", { items, total, page, pageSize } )
  } catch (e: any) {
    emitEventToUser(data.user, "kitty:getAllEssay:error", { message: e.message || "获取日志失败" })
  }
}