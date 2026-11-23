import { prisma } from "~/server/utils/game/db";

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  const user = session?.user as { uuid?: string } | undefined;

  if (!user?.uuid) {
    return {
      ok: false,
      message: "未登录或会话失效",
    };
  }

  // 更新新字段，并兼容旧的 option.needGuide = false
  const dbUser = await prisma.user.findUnique({
    where: { uuid: user.uuid },
    select: { option: true },
  });

  let option: Record<string, any> = {};
  try {
    option = dbUser?.option ? JSON.parse(dbUser.option) : {};
  } catch {
    option = {};
  }
  option.needGuide = false;

  await prisma.user.update({
    where: { uuid: user.uuid },
    data: {
      has_seen_onboarding: true,
      is_new_user: false,
      option: JSON.stringify(option),
    },
  });

  return { ok: true };
});
