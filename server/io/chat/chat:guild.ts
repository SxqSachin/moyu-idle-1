import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import type { ChatMessage } from "~/shared/types/chat"
import { prisma } from "~/server/utils/game/db"
import { createChatMsg, sanitizeChatContent } from "~/server/utils/game/chat"
import { safeJsonParse } from "~/shared/utils"
import { checkSensitiveWords } from "~/server/utils/checkSensitiveWords"

export async function createGuildChatMsg (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string, content: string }>
) {
  const user = data.user
  let { guildUuid, content } = data.data

  if (!content || !user || !guildUuid) {
    emitEventToUser(data.user.uuid, "chat:guild:error", { message: "内容或公会ID不能为空" })
    return
  }

  // 内容过滤与安全检查
  content = sanitizeChatContent(content)
  if (!content) {
    emitEventToUser(data.user.uuid, "chat:guild:error", { message: "内容不合法" })
    return
  }

  if (await checkSensitiveWords(content)) {
    emitEventToUser(data.user.uuid, "sensitiveCheck:error", { message: "内容不合法" })
    return
  }

  try {
    let guild = await prisma.guild.findUnique({
      where: { uuid: guildUuid }, 
    });

    if (!guild) {
      emitEventToUser(data.user.uuid, "chat:guild:error", { message: "公会不存在" })
      return
    }

    let allGuildMembers = await prisma.guildMember.findMany({
      where: { guildUuid },
      select: { userUuid: true }
    });

    // 如果用户不存在于公会成员当中，不允许发消息
    if (!allGuildMembers.some(member => member.userUuid === user.uuid)) {
      emitEventToUser(data.user.uuid, "chat:guild:error", { message: "你不在该公会内" })
      return
    }

    const msg = await createChatMsg(user.uuid, content, "guild:" + guild.uuid, guild.name)

    // 规范化消息
    const chatMsg: ChatMessage = {
      id: msg.id,
      sender: msg.sender,
      sender_name: msg.sender_name,
      content: msg.content,
      created_At: msg.created_at.toISOString(),
      is_revoked: msg.is_revoked ?? false,
      is_deleted: msg.is_deleted ?? false,

      receiver_id: "guild:" + guild.uuid,
      receiver_name: guild.name,

      extra: msg.extra ?? undefined,
      extraSFX: msg.extraSFX ?? undefined,
      extra2: safeJsonParse(msg.extra2) ?? undefined,
    }

    // 写入 Redis，保留最新200条，设置7天过期
    let key = `chat:guild:${guild.uuid}`
    await redisClient.rPush(key, JSON.stringify(chatMsg))
    await redisClient.expire(key, 7 * 24 * 60 * 60)
    await redisClient.lTrim(key, -200, -1)

    // 广播到房间所有成员（假设有房间成员列表，或用 socket.io 的房间功能）
    // 推荐用 socket.io 的房间功能

    for(const member of allGuildMembers ?? []) {
        // 也推送给自己
        emitEventToUser(member.userUuid, "chat:newGuildChatMsg", { msg: chatMsg })
    }
  } catch (err: any) {
    emitEventToUser(data.user.uuid, "chat:guild:error", { message: err.message })
  }
}

export async function getGuildChatList (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string }>
) {
  try {
    const { guildUuid } = data.data
    const selfUuid = data.user.uuid

    if (!guildUuid) {
      emitEventToUser(selfUuid, "chat:geGuildChatList:error", { message: "公会ID不能为空" })
      return
    }

    let key = `chat:guild:${guildUuid}`

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
          receiver_id: "guild:" + guildUuid,
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

    emitEventToUser(selfUuid, "chat:getGuildChatList:success", { list })
  } catch (err: any) {
    emitEventToUser(data.user.uuid, "chat:getGuildChatList:error", { message: err.message })
  }
}