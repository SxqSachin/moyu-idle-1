import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import type { ChatMessage } from "~/shared/types/chat"
import { prisma } from "~/server/utils/game/db"
import { getEquipmentActuralId } from "~/shared/utils/game/equipment"
import { createChatMsg, sanitizeChatContent, broadcastPublicLikeChat } from "~/server/utils/game/chat"
import { safeJsonParse } from "~/shared/utils"
import { checkSensitiveWords } from "~/server/utils/checkSensitiveWords"


export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ content: string }>
) {
  const user = data.user
  let { content } = data.data

  if (!content || !user) {
    emitEventToUser(data.user.uuid, "chat:createComment:error", { message: "内容不能为空" })
    return
  }

  // 内容过滤与安全检查
  content = sanitizeChatContent(content)
  if (!content) {
    emitEventToUser(data.user.uuid, "chat:createComment:error", { message: "内容不合法(01)" })
    return
  }

  if (await checkSensitiveWords(content)) {
    emitEventToUser(data.user.uuid, "sensitiveCheck:error", { message: "内容不合法(02)" })
    return
  }

  try {
    const msg = await createChatMsg(user.uuid, content);

    // 规范化广播消息类型
    const chatMsg: ChatMessage = {
      id: msg.id,
      sender: msg.sender,
      sender_name: msg.sender_name,
      content: msg.content,
      created_At: msg.created_at.toISOString(),
      is_revoked: msg.is_revoked ?? false,
      is_deleted: msg.is_deleted ?? false,
      receiver_id: msg.receiver_id ?? undefined,
      extra: msg.extra ?? undefined,
      extraSFX: msg.extraSFX ?? undefined,
      extra2: safeJsonParse(msg.extra2) ?? undefined,
    }

    // 写入 Redis，保留最新200条，设置60分钟过期
    await redisClient.rPush("chat:public", JSON.stringify(chatMsg))
    await redisClient.expire("chat:public", 7 * 24 * 60 * 60) // 改为7天
    await redisClient.lTrim("chat:public", -200, -1)

    await broadcastPublicLikeChat('public', user.uuid, chatMsg)
  } catch (err: any) {
    emitEventToUser(data.user.uuid, "chat:createComment:error", { message: err.message })
  }
}