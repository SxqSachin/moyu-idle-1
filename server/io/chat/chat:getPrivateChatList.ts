import { DefaultEventsMap, Socket } from "socket.io"
import { PrismaClient } from "~/generated/prisma"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import type { ChatMessage } from "~/shared/types/chat"
import { prisma } from "~/server/utils/game/db"
import { safeJsonParse } from "~/shared/utils"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ receiverUuid: string }>
) {
  try {
    let receiverUuid = data.data.receiverUuid
    let selfUuid = data.user.uuid

    if (!receiverUuid) {
      emitEventToUser(data.user.uuid, "chat:getPrivateChatList:error", { message: "接收者不能为空" })
      return
    }

    let key = `chat:private:${[selfUuid, receiverUuid].sort().join('-')}`;

    // 优先从 Redis 取
    // const redisList: string[] = [];//await redisClient.lRange(key, 0, -1)
    // let list: ChatMessage[] = []
    // if (redisList && redisList.length > 0) {
    //   list = redisList.map(item => JSON.parse(item))
    // } else {
      // Redis 没有则查数据库并回填
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 改为7天前
      // 分成两条查询分别命中 sender/receiver 复合索引，再内存合并按时间排序截断
      const [outgoing, incoming] = await Promise.all([
        prisma.chatMessage.findMany({
          where: {
            created_at: { gte: since },
            is_deleted: false,
            sender: selfUuid,
            receiver_id: receiverUuid,
          },
          orderBy: { created_at: "asc" },
          take: 200,
        }),
        prisma.chatMessage.findMany({
          where: {
            created_at: { gte: since },
            is_deleted: false,
            sender: receiverUuid,
            receiver_id: selfUuid,
          },
          orderBy: { created_at: "asc" },
          take: 200,
        })
      ])

      const merged = [...outgoing, ...incoming]
        .filter(msg => !msg.receiver_id?.startsWith("room:"))
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
        .slice(0, 200)
        .map(msg => ({
          id: msg.id,
          sender: msg.sender,
          sender_name: msg.sender_name,
          receiver_id: msg.receiver_id ?? undefined,
          content: msg.content,
          created_At: msg.created_at.toISOString(),
          is_revoked: msg.is_revoked ?? false,
          is_deleted: msg.is_deleted ?? false,
          extra: msg.extra ?? undefined,
          extra2: safeJsonParse(msg.extra2) ?? undefined,
        }))
      // 回填 Redis
      // if (list.length > 0) {
      //   await redisClient.del(key)
      //   await redisClient.rPush(key, list.map(i => JSON.stringify(i)))
      //   await redisClient.expire(key, 7 * 24 * 60 * 60) // 改为7天
      // }
    // }

    emitEventToUser(data.user.uuid, "chat:getPrivateChatList:success", { list: merged })
  } catch (err: any) {
    emitEventToUser(data.user.uuid, "chat:getPrivateChatList:error", { message: err.message })
  }
}