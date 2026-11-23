import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";

const checkGmAction = async (userUuid: string, bearer: string) => {
  const required = process.env.GM_ACTION_BEARER;
  if (!required || bearer !== required) return false;
  const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
  if (!gmUser || !gmUser.is_gm) return false;
  return true;
};

export async function gmServiceUsagePreview(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ targetUserName: string; serviceKey: string; bearer: string }>
) {
  const userUuid = data.user.uuid;
  const { targetUserName, serviceKey, bearer } = data.data;

  const isGm = await checkGmAction(userUuid, bearer);
  if (!isGm) {
    emitEventToUser(userUuid, "gm:serviceUsage:preview:fail", { message: "操作失败" });
    return;
  }

  const targetUser = await prisma.user.findFirst({
    select: { uuid: true, name: true, sponsor_points: true },
    where: { name: targetUserName },
  });
  if (!targetUser) {
    emitEventToUser(userUuid, "gm:serviceUsage:preview:fail", { message: "目标用户不存在" });
    return;
  }

  const usage = await prisma.userServiceUsage.findUnique({
    where: { user_service_unique: { userUuid: targetUser.uuid, serviceKey } },
  });
  const usedCount = usage?.usedCount ?? 0;
  const available = Math.floor((targetUser.sponsor_points || 0) / 100000) - usedCount;

  emitEventToUser(userUuid, "gm:serviceUsage:preview:success", {
    user: { uuid: targetUser.uuid, name: targetUser.name },
    serviceKey,
    usedCount,
    available: available < 0 ? 0 : available,
    lastUsedAt: usage?.lastUsedAt ?? null,
  });
}

export async function gmServiceUsageSet(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ targetUserName: string; serviceKey: string; usedCount: number; bearer: string }>
) {
  const userUuid = data.user.uuid;
  const { targetUserName, serviceKey, usedCount, bearer } = data.data;

  const isGm = await checkGmAction(userUuid, bearer);
  if (!isGm) {
    emitEventToUser(userUuid, "gm:serviceUsage:set:fail", { message: "操作失败" });
    return;
  }

  const targetUser = await prisma.user.findFirst({ where: { name: targetUserName } });
  if (!targetUser) {
    emitEventToUser(userUuid, "gm:serviceUsage:set:fail", { message: "目标用户不存在" });
    return;
  }

  const now = new Date();
  try {
    const updated = await prisma.userServiceUsage.upsert({
      where: { user_service_unique: { userUuid: targetUser.uuid, serviceKey } },
      update: { usedCount, lastUsedAt: now },
      create: { userUuid: targetUser.uuid, serviceKey, usedCount, lastUsedAt: now },
    });

    emitEventToUser(userUuid, "gm:serviceUsage:set:success", {
      user: { uuid: targetUser.uuid, name: targetUser.name },
      serviceKey,
      usedCount: updated.usedCount,
      lastUsedAt: updated.lastUsedAt,
    });
  } catch (e: any) {
    emitEventToUser(userUuid, "gm:serviceUsage:set:fail", { message: e?.message || "操作失败" });
  }
}
