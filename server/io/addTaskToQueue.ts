import { DefaultEventsMap, Socket } from "socket.io"
import { emitEventToUser} from "."
import { GameTask } from "~/shared/types/gameTask"

import { addTaskToQueueInRedis, getTaskQueueInRedis } from "../utils/game/taskQueue"
import { scheduleUserImmediate } from "../utils/game/schedule"
import { GameSocketData } from "~/shared/types/socket"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<GameTask>) {
    await withUniqueLock("addTaskToQueue:" + data.user.uuid, async () => {
        const userUuid = data.user.uuid

        try {
            const before = await getTaskQueueInRedis(userUuid)
            await addTaskToQueueInRedis(userUuid, data.data)

            if (before.length === 0) {
                // 新建队列：立即调度（冗余保护，taskQueue 内也会做一次）
                await scheduleUserImmediate(userUuid)
            }

            const taskQueue = await getTaskQueueInRedis(userUuid)

            emitEventToUser(data.user, "dispatchTaskQueueToClient", taskQueue)
        } catch(e: any) {
            emitEventToUser(data.user, "addTaskToQueue:fail", {message: e.message})
        }
    })
}