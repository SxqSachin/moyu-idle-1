import { DefaultEventsMap, Socket } from "socket.io"
import { emitEventToUser } from "../"
import { getKitty, getKittyTaskQueueInRedis, reorderKittyTaskQueue, dispatchLatestKittyTaskQueueToClient } from "../../utils/game/kitty"
import { scheduleKittyImmediate } from "~/server/utils/game/kittySchedule"
import { GameSocketData } from "~/shared/types/socket"

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<{ kittyUuid: string, newOrder: number[] }>) {
    const userUuid = data.user.uuid
    const { kittyUuid, newOrder } = data.data

    // 验证输入数据
    if (!kittyUuid || !Array.isArray(newOrder) || newOrder.length === 0) {
        emitEventToUser(userUuid, "kitty:reorder:failed", {
            message: "无效的排序数据"
        })
        return
    }

    await withUniqueLock('kitty:reorder:' + kittyUuid, async () => {
        try {
            // 验证猫咪是否存在且属于当前用户
            const kitty = await getKitty(kittyUuid)
            if (!kitty) {
                emitEventToUser(userUuid, "kitty:reorder:failed", {
                    message: "小猫咪不存在"
                })
                return
            }

            if (kitty.owner !== userUuid) {
                emitEventToUser(userUuid, "kitty:reorder:failed", {
                    message: "无权操作此小猫咪"
                })
                return
            }

            // 获取当前任务队列
            const currentTaskQueue = await getKittyTaskQueueInRedis(kittyUuid)
            
            if (currentTaskQueue.length === 0) {
                emitEventToUser(userUuid, "kitty:reorder:failed", {
                    message: "队列为空，无法排序"
                })
                return
            }

            if (currentTaskQueue.length === 1) {
                emitEventToUser(userUuid, "kitty:reorder:failed", {
                    message: "只有执行中的任务，无法排序"
                })
                return
            }

            // 验证排序索引的有效性
            const maxIndex = currentTaskQueue.length - 1
            const hasInvalidIndex = newOrder.some(index => index < 1 || index > maxIndex)
            
            if (hasInvalidIndex) {
                emitEventToUser(userUuid, "kitty:reorder:failed", {
                    message: "排序索引超出范围"
                })
                return
            }

            // 检查是否包含所有等待任务的索引（除了第一个执行中的任务）
            const waitingTaskIndexes = Array.from({ length: currentTaskQueue.length - 1 }, (_, i) => i + 1)
            const sortedNewOrder = [...newOrder].sort((a, b) => a - b)
            const sortedWaitingIndexes = [...waitingTaskIndexes].sort((a, b) => a - b)
            
            if (JSON.stringify(sortedNewOrder) !== JSON.stringify(sortedWaitingIndexes)) {
                emitEventToUser(userUuid, "kitty:reorder:failed", {
                    message: "排序索引不完整或重复"
                })
                return
            }

            // 执行重排序
            await reorderKittyTaskQueue(kittyUuid, newOrder)

            // 获取重排序后的队列并发送给客户端
            const updatedTaskQueue = await getKittyTaskQueueInRedis(kittyUuid)
            await dispatchLatestKittyTaskQueueToClient(kittyUuid, userUuid, updatedTaskQueue)
            // 重排不改变首任务执行状态，但为了减少等待，立即调度一次以便及时结算（尤其是首任务已完成时间点刚好满足条件）。
            await scheduleKittyImmediate(kittyUuid)
            
            // 发送成功通知
            emitEventToUser(userUuid, "kitty:reorder:success", {
                message: "小猫咪任务队列排序已更新",
                kittyUuid
            })

        } catch (error) {
            console.error('Kitty task reorder error:', error)
            emitEventToUser(userUuid, "kitty:reorder:failed", {
                message: error instanceof Error ? error.message : "排序操作失败，请重试"
            })
        }
    })
}