import { DefaultEventsMap, Socket } from "socket.io"
import { PrismaClient } from "~/generated/prisma"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import type { ChatMessage } from "~/shared/types/chat"
import { prisma } from "~/server/utils/game/db"
import { safeJsonParse } from "~/shared/utils"
import { getBlockedPublicChatSet } from "~/server/utils/game/chat"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<null>
) {
  try {
    // 优先从 Redis 取
    const redisList = await redisClient.lRange("chat:public", 0, -1)
    let list: ChatMessage[] = []
    if (redisList && redisList.length > 0) {
      list = redisList.map(item => JSON.parse(item))
    } else {
      // Redis 没有则查数据库并回填
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 改为7天前
      const dbList = await prisma.chatMessage.findMany({
        where: {
          created_at: { gte: since },
          receiver_id: null,
          is_deleted: false,
        },
        orderBy: { created_at: "asc" },
        take: 200,
      })
      list = dbList.map(msg => ({
        id: msg.id,
        sender: msg.sender,
        sender_name: msg.sender_name,
        receiver_id: msg.receiver_id ?? undefined,
        content: msg.content,
        created_At: msg.created_at.toISOString(),
        is_revoked: msg.is_revoked ?? false,
        is_deleted: msg.is_deleted ?? false,
        extra: msg.extra ?? undefined,
        extra2:safeJsonParse(msg.extra2) ?? undefined,
      }))
      // 回填 Redis
      if (list.length > 0) {
        await redisClient.del("chat:public")
        await redisClient.rPush("chat:public", list.map(i => JSON.stringify(i)))
        await redisClient.expire("chat:public", 7 * 24 * 60 * 60) // 改为7天
      }
    }

    // 使用数据库 UserBlock (含缓存) 获取屏蔽集合
  const blocked = await getBlockedPublicChatSet(data.user.uuid);
    if (blocked.size) {
      list = list.filter(m => !blocked.has(m.sender));
    }

    emitEventToUser(data.user.uuid, "chat:getChatList:success", { list })
  } catch (err: any) {
    emitEventToUser(data.user.uuid, "chat:getChatList:error", { message: err.message })
  }
}