import { prisma } from "~/server/utils/game/db";

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  const user = session?.user as { uuid?: string } | undefined;

  if (!user?.uuid) {
    return { ok: false, message: "未登录或会话失效" };
  }

  const query = getQuery(event);
  const serviceKey = (query.serviceKey as string) || "";
  if (!serviceKey) {
    return { ok: false, message: "缺少 serviceKey" };
  }

  const dbUser = await prisma.user.findUnique({
    where: { uuid: user.uuid },
    select: { max_sponsor_points: true },
  });
  if (!dbUser) {
    return { ok: false, message: "用户不存在" };
  }

  const usage = await prisma.userServiceUsage.findUnique({
    where: { user_service_unique: { userUuid: user.uuid, serviceKey } },
  });

  const usedCount = usage?.usedCount ?? 0;
  const totalQuota = Math.min(3, Math.floor((dbUser.max_sponsor_points || 0) / 100000));
  let available = totalQuota - usedCount;
  if (available < 0) available = 0;


  return {
    ok: true,
    data: {
      serviceKey,
      usedCount,
      available: available < 0 ? 0 : available,
      lastUsedAt: usage?.lastUsedAt ?? null,
    },
  };
});
