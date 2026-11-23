import { DefaultEventsMap, Socket } from "socket.io"
import { emitEventToUser } from "../"
import { getTaskQueueInRedis, reorderTaskQueue } from "../../utils/game/taskQueue"
import { GameSocketData } from "~/shared/types/socket"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<number[]>) {
    const userUuid = data.user.uuid
    const newOrder = data.data

    // 验证输入数据
    if (!Array.isArray(newOrder) || newOrder.length === 0) {
        emitEventToUser(userUuid, "task:reorder:failed", {
            message: "无效的排序数据"
        })
        return
    }

    await withUniqueLock('task:reorder:' + userUuid, async () => {
        try {
            // 获取当前任务队列
            const currentTaskQueue = await getTaskQueueInRedis(userUuid)
            
            if (currentTaskQueue.length === 0) {
                emitEventToUser(userUuid, "task:reorder:failed", {
                    message: "队列为空，无法排序"
                })
                return
            }

            if (currentTaskQueue.length === 1) {
                emitEventToUser(userUuid, "task:reorder:failed", {
                    message: "只有执行中的任务，无法排序"
                })
                return
            }

            // 验证排序索引的有效性
            const maxIndex = currentTaskQueue.length - 1
            const hasInvalidIndex = newOrder.some(index => index < 1 || index > maxIndex)
            
            if (hasInvalidIndex) {
                emitEventToUser(userUuid, "task:reorder:failed", {
                    message: "排序索引超出范围"
                })
                return
            }

            // 检查是否包含所有等待任务的索引（除了第一个执行中的任务）
            const waitingTaskIndexes = Array.from({ length: currentTaskQueue.length - 1 }, (_, i) => i + 1)
            const sortedNewOrder = [...newOrder].sort((a, b) => a - b)
            const sortedWaitingIndexes = [...waitingTaskIndexes].sort((a, b) => a - b)
            
            if (JSON.stringify(sortedNewOrder) !== JSON.stringify(sortedWaitingIndexes)) {
                emitEventToUser(userUuid, "task:reorder:failed", {
                    message: "排序索引不完整或重复"
                })
                return
            }

            // 执行重排序
            await reorderTaskQueue(userUuid, newOrder)

            // 获取重排序后的队列并发送给客户端
            const updatedTaskQueue = await getTaskQueueInRedis(userUuid)
            emitEventToUser(userUuid, "dispatchTaskQueueToClient", updatedTaskQueue)
            
            // 发送成功通知
            emitEventToUser(userUuid, "task:reorder:success", {
                message: "队列排序已更新"
            })

        } catch (error) {
            emitEventToUser(userUuid, "task:reorder:failed", {
                message: error instanceof Error ? error.message : "排序操作失败，请重试"
            })
        }
    })
}