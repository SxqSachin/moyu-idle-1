import { prisma } from "~/server/utils/game/db";

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  const user = session?.user as { uuid?: string } | undefined;

  if (!user?.uuid) {
    return {
      ok: false,
      message: "未登录或会话失效",
      needGuide: false,
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { uuid: user.uuid },
    select: {
      has_seen_onboarding: true,
      is_new_user: true,
      option: true,
    },
  });

  if (!dbUser) {
    return { ok: false, message: "用户不存在", needGuide: false };
  }

  // 后向兼容：若新字段不可用时，退化为 option.needGuide !== false
  let fallbackNeedGuide = false;
  if (dbUser.option) {
    try {
      const opt = JSON.parse(dbUser.option || "{}");
      fallbackNeedGuide = opt.needGuide !== false; // 缺省认为需要引导
    } catch {
      fallbackNeedGuide = true;
    }
  } else {
    fallbackNeedGuide = true;
  }

  let needGuide: boolean;
  if (typeof dbUser.has_seen_onboarding === "boolean" && typeof dbUser.is_new_user === "boolean") {
    needGuide = !dbUser.has_seen_onboarding && dbUser.is_new_user;
  } else {
    needGuide = fallbackNeedGuide;
  }

  return { ok: true, needGuide };
});
