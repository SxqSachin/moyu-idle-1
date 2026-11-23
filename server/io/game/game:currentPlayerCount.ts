import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { redisClient } from "~/server/utils/index"

/**
 * 获取当前 socket.io 中有效房间（room）的总数量
 * 以及有任务队列在执行的玩家数量（从 redis 读取）
 */
export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<null>
) {
    // try {
    //     // 从 redis 读取统计数据
    //     const redisData = await redisClient.GET("CURRENT_PLAYER_COUNT")
    //     let roomCount = 0
    //     let playerWithTaskCount = 0

    //     if (redisData) {
    //         const parsed = JSON.parse(redisData)
    //         roomCount = parsed.roomCount ?? 0
    //         playerWithTaskCount = parsed.playerWithTaskCount ?? 0
    //     }

    //     socket.emit("game:currentPlayerCount:success", {
    //         roomCount,
    //         playerWithTaskCount
    //     })
    // } catch (err: any) {
    //     socket.emit("game:currentPlayerCount:error", {
    //         message: err.message
    //     })
    // }
}