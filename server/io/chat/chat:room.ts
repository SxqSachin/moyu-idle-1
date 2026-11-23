import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { broadcastEvent, emitEventToUser } from ".."
import type { ChatMessage } from "~/shared/types/chat"
import { prisma } from "~/server/utils/game/db"
import { getRoomById } from "~/server/utils/game/room"
import { getEquipmentActuralId } from "~/shared/utils/game/equipment"
import { createChatMsg, sanitizeChatContent } from "~/server/utils/game/chat"
import { safeJsonParse } from "~/shared/utils"
import { checkSensitiveWords } from "~/server/utils/checkSensitiveWords"

export async function createRoomChatMsg (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string, content: string }>
) {
  const user = data.user
  let { roomId, content } = data.data

  if (!content || !user || !roomId) {
    emitEventToUser(data.user.uuid, "chat:room:error", { message: "内容或房间ID不能为空" })
    return
  }

  // 内容过滤与安全检查
  content = sanitizeChatContent(content)
  if (!content) {
    emitEventToUser(data.user.uuid, "chat:room:error", { message: "内容不合法" })
    return
  }

  if (await checkSensitiveWords(content)) {
    emitEventToUser(data.user.uuid, "sensitiveCheck:error", { message: "内容不合法" })
    return
  }

  try {
    // 检查用户是否在房间成员列表中（可选，假设有 Room 表和成员列表）
    // const room = await prisma.room.findUnique({ where: { uuid: roomId } })
    // if (!room || !room.memberIds.includes(user.uuid)) {
    //   emitEventToUser(data.user.uuid, "chat:room:error", { message: "你不在该房间内" })
    //   return
    // }
    // 检查用户是否装备了冰之王冠
    let room = await getRoomById(roomId)

    if (!room) {
      emitEventToUser(data.user.uuid, "chat:room:error", { message: "房间不存在" })
      return
    }

    const msg = await createChatMsg(user.uuid, content, "room:" + room?.uuid, room?.name)

    // 规范化消息
    const chatMsg: ChatMessage = {
      id: msg.id,
      sender: msg.sender,
      sender_name: msg.sender_name,
      content: msg.content,
      created_At: msg.created_at.toISOString(),
      is_revoked: msg.is_revoked ?? false,
      is_deleted: msg.is_deleted ?? false,

      receiver_id: "room:" + room?.uuid,
      receiver_name: room?.name,

      extra: msg.extra ?? undefined,
      extraSFX: msg.extraSFX ?? undefined,
      extra2: safeJsonParse(msg.extra2) ?? undefined,
    }

    // 写入 Redis，保留最新200条，设置7天过期
    let key = `chat:room:${roomId}`
    await redisClient.rPush(key, JSON.stringify(chatMsg))
    await redisClient.expire(key, 7 * 24 * 60 * 60)
    await redisClient.lTrim(key, -200, -1)

    // 广播到房间所有成员（假设有房间成员列表，或用 socket.io 的房间功能）
    // 推荐用 socket.io 的房间功能

    for(const member of room?.memberIds ?? []) {
        // 也推送给自己
        emitEventToUser(member, "chat:newRoomChatMsg", { msg: chatMsg })
    }
  } catch (err: any) {
    emitEventToUser(data.user.uuid, "chat:room:error", { message: err.message })
  }
}

export async function getRoomChatList (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ roomId: string }>
) {
  try {
    const { roomId } = data.data
    const selfUuid = data.user.uuid

    if (!roomId) {
      emitEventToUser(selfUuid, "chat:getRoomChatList:error", { message: "房间ID不能为空" })
      return
    }

    let key = `chat:room:${roomId}`

    // 优先从 Redis 取
    const redisList = await redisClient.lRange(key, 0, -1)
    let list: ChatMessage[] = []
    if (redisList && redisList.length > 0) {
      list = redisList.map(item => JSON.parse(item))
    } else {
      // Redis 没有则查数据库并回填
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天前
      const dbList = await prisma.chatMessage.findMany({
        where: {
          created_at: { gte: since },
          is_deleted: false,
          receiver_id: "room:" + roomId,
        },
        orderBy: { created_at: "asc" },
        take: 200,
      })
      list = dbList.map(msg => ({
        id: msg.id,
        sender: msg.sender,
        sender_name: msg.sender_name,
        receiver_id: msg.receiver_id ?? undefined,
        receiver_name: msg.receiver_name ?? undefined,
        content: msg.content,
        created_At: msg.created_at.toISOString(),
        is_revoked: msg.is_revoked ?? false,
        is_deleted: msg.is_deleted ?? false,
        extra: msg.extra ?? undefined,
        extraSFX: msg.extraSFX ?? undefined,
        extra2:safeJsonParse(msg.extra2) ?? undefined,
      }))
      // 回填 Redis
      if (list.length > 0) {
        await redisClient.del(key)
        await redisClient.rPush(key, list.map(i => JSON.stringify(i)))
        await redisClient.expire(key, 7 * 24 * 60 * 60) // 7天
      }
    }

    emitEventToUser(selfUuid, "chat:getRoomChatList:success", { list })
  } catch (err: any) {
    emitEventToUser(data.user.uuid, "chat:getRoomChatList:error", { message: err.message })
  }
}