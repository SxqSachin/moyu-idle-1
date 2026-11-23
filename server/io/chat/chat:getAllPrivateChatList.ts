import { DefaultEventsMap, Socket } from "socket.io"
import { PrismaClient } from "~/generated/prisma"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from ".."
import type { ChatMessage } from "~/shared/types/chat"
import { prisma } from "~/server/utils/game/db"
import { safeJsonParse } from "~/shared/utils"

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  try {
    let selfuuid = data.user.uuid

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 改为7天前
    const [outgoing, incoming] = await Promise.all([
      prisma.chatMessage.findMany({
        where: {
          created_at: { gte: since },
          is_deleted: false,
          sender: selfuuid,
          receiver_id: { not: null },
        },
        orderBy: { created_at: "asc" },
        take: 200,
      }),
      prisma.chatMessage.findMany({
        where: {
          created_at: { gte: since },
          is_deleted: false,
          receiver_id: selfuuid,
        },
        orderBy: { created_at: "asc" },
        take: 200,
      }),
    ])

    const list = [...outgoing, ...incoming]
      .filter((msg) => !msg.receiver_id?.startsWith("room:"))
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .slice(0, 200)
      .map((msg) => ({
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
      }));

    emitEventToUser(data.user.uuid, "chat:getAllPrivateChatList:success", {
      list,
    });
  } catch (err: any) {
    emitEventToUser(data.user.uuid, "chat:getAllPrivateChatList:error", {
      message: err.message,
    });
  }
}