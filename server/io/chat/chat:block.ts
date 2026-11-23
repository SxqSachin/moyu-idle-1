import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { refreshBlockCache, getBlockListCached, normalizeAndValidateTargetUuid, MAX_BLOCK_COUNT } from "~/server/utils/game/chat";

// 屏蔽某个玩家（不会再看到其公屏/铁猫公屏消息；不影响私聊是否可达，由前端自行控制）
// redis set key: chat:block:{selfUuid}  value members = 被屏蔽玩家uuid
export async function blockUserHandler(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ targetUuid: string }>
) {
  try {
    const self = data.user;
    let targetUuid: string;
    try {
      targetUuid = normalizeAndValidateTargetUuid(data.data?.targetUuid)
    } catch (e: any) {
      emitEventToUser(self.uuid, "chat:block:error", { message: e.message || 'targetUuid不合法' });
      return;
    }
    if (targetUuid === self.uuid) {
      emitEventToUser(self.uuid, "chat:block:error", { message: "不能屏蔽自己" });
      return;
    }

    // 目标玩家是否存在
    const [targetUser, currentCount] = await Promise.all([
      prisma.user.findUnique({ where: { uuid: targetUuid }, select: { uuid: true } }),
      prisma.userBlock.count({ where: { blockerUuid: self.uuid } })
    ])
    if (!targetUser) {
      emitEventToUser(self.uuid, "chat:block:error", { message: "目标玩家不存在" });
      return;
    }
    if (currentCount >= MAX_BLOCK_COUNT) {
      emitEventToUser(self.uuid, "chat:block:error", { message: `屏蔽数量已达上限(${MAX_BLOCK_COUNT})，请先解除部分屏蔽` });
      return;
    }

    // Upsert 逻辑：存在则更新 blockPublicChat=true，否则创建
    // 由于生成的复合唯一输入类型名可能与预期不一致，这里使用 findFirst + 分支，而非 upsert 复合 where。
    const existing = await prisma.userBlock.findFirst({ where: { blockerUuid: self.uuid, targetUuid } });
    if (existing) {
      if (existing.blockAll || existing.blockPublicChat) {
        emitEventToUser(self.uuid, "chat:block:success", { targetUuid, type: 'publicChat' });
        return;
      }
      await prisma.userBlock.update({ where: { id: existing.id }, data: { blockPublicChat: true } });
    } else {
      await prisma.userBlock.create({ data: { blockerUuid: self.uuid, targetUuid, blockPublicChat: true } });
    }

    await refreshBlockCache(self.uuid);
    emitEventToUser(self.uuid, "chat:block:success", { targetUuid, type: 'publicChat' });
  } catch (e: any) {
    emitEventToUser(data.user.uuid, "chat:block:error", { message: e.message });
  }
}

// 取消屏蔽
export async function unblockUserHandler(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ targetUuid: string }>
) {
  try {
    const self = data.user;
    let targetUuid: string;
    try {
      targetUuid = normalizeAndValidateTargetUuid(data.data?.targetUuid)
    } catch (e: any) {
      emitEventToUser(self.uuid, "chat:unblock:error", { message: e.message || 'targetUuid不合法' });
      return;
    }
    // 若存在记录：如果只屏蔽公屏则可以直接删除；若未来拓展其他屏蔽类型，这里可选择仅关闭 blockPublicChat
    const existing = await prisma.userBlock.findFirst({ where: { blockerUuid: self.uuid, targetUuid } });
    if (existing) {
      if (existing.blockPrivateChat || existing.blockGuildChat || existing.blockRoomChat || existing.blockBattleInvite || existing.blockTrade || existing.blockAll) {
        if (existing.blockPublicChat) {
          await prisma.userBlock.update({ where: { id: existing.id }, data: { blockPublicChat: false } });
        }
      } else {
        await prisma.userBlock.delete({ where: { id: existing.id } });
      }
    } else {
      // 幂等：没有记录直接返回成功
      emitEventToUser(self.uuid, "chat:unblock:success", { targetUuid, type: 'publicChat' });
      return;
    }
    await refreshBlockCache(self.uuid);
    emitEventToUser(self.uuid, "chat:unblock:success", { targetUuid, type: 'publicChat' });
  } catch (e: any) {
    emitEventToUser(data.user.uuid, "chat:unblock:error", { message: e.message });
  }
}

// 获取当前屏蔽列表
export async function getBlockListHandler(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<null>
) {
  try {
    const self = data.user;
    const list = await getBlockListCached(self.uuid);
    emitEventToUser(self.uuid, "chat:blockList:success", { list });
  } catch (e: any) {
    emitEventToUser(data.user.uuid, "chat:blockList:error", { message: e.message });
  }
}
