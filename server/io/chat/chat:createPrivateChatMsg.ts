import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { broadcastEvent, emitEventToUser } from ".."
import type { ChatMessage } from "~/shared/types/chat"
import { prisma } from "~/server/utils/game/db"
import { getEquipmentActuralId } from "~/shared/utils/game/equipment"
import { createChatMsg, sanitizeChatContent } from "~/server/utils/game/chat"
import { safeJsonParse } from "~/shared/utils"
import { checkSensitiveWords } from "~/server/utils/checkSensitiveWords"

// 简单的内容过滤函数
export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ toUser: string, content: string }>
) {
  const user = data.user
  let { toUser, content } = data.data

  if (!content || !user) {
    emitEventToUser(data.user.uuid, "chat:createComment:error", { message: "内容不能为空" })
    return
  }

  // 内容过滤与安全检查
  content = sanitizeChatContent(content)
  if (!content) {
    emitEventToUser(data.user.uuid, "chat:createComment:error", { message: "内容不合法" })
    return
  }

  if (await checkSensitiveWords(content)) {
    emitEventToUser(data.user.uuid, "sensitiveCheck:error", { message: "内容不合法" })
    return
  }


  try {
    let sender = await prisma.user.findUnique({
      where: {
        uuid: user.uuid
      }
    })

    let receiver = await prisma.user.findUnique({
      where: {
        uuid: toUser  
      }
    })

    if (!receiver || !sender) {
      emitEventToUser(data.user.uuid, "chat:createPrivateChatMsg:error", { message: "用户不存在" })
      return
    }

    // 检查发送者和接收者是否是好友关系
    const isFriend = await prisma.friendship.findMany({
      where: {
        OR: [
          { userA: user.uuid, userB: receiver.uuid },
          { userA: receiver.uuid, userB: user.uuid }
        ]
      }
    })

    if (!isFriend?.length) {
      emitEventToUser(data.user.uuid, "chat:createPrivateChatMsg:error", { message: "你们不是好友关系，无法发送私聊消息" })
      return
    }

    const msg = await createChatMsg(user.uuid, content, receiver.uuid, receiver.name)

    // 规范化广播消息类型
    const chatMsg: ChatMessage = {
      id: msg.id,
      sender: msg.sender,
      sender_name: msg.sender_name,
      receiver_id: msg.receiver_id!,
      receiver_name: msg.receiver_name!,
      content: msg.content,
      created_At: msg.created_at.toISOString(),
      is_revoked: msg.is_revoked ?? false,
      is_deleted: msg.is_deleted ?? false,
      extra: msg.extra ?? undefined,
      extraSFX: msg.extraSFX ?? undefined,
      extra2: safeJsonParse(msg.extra2) ?? undefined,
    }

    // 写入 Redis，保留最新200条，设置60分钟过期
    let key = `chat:private:${[user.uuid, receiver.uuid].sort().join('-')}`;
    await redisClient.rPush(key, JSON.stringify(chatMsg))
    await redisClient.expire(key, 7 * 24 * 60 * 60) // 改为7天
    await redisClient.lTrim(key, -200, -1)

    emitEventToUser(receiver.uuid, "chat:newPrivateChatMsg", {msg: chatMsg})
    emitEventToUser(sender.uuid, "chat:newPrivateChatMsg", {msg: chatMsg})
  } catch (err: any) {
    emitEventToUser(data.user.uuid, "chat:createPrivateChatMsg:error", { message: err.message })
  }
}