import { markUserNotificationRead } from "~/server/utils/game/tmpNotification";

export default defineEventHandler(async (event) => {
  const { notificationId } = await readBody(event);
  const user = await getUserSession(event);

  // @ts-ignore
  const uuid = user.user?.uuid;
  if (!uuid || !notificationId) {
    return { success: false, message: "参数错误" };
  }

  await markUserNotificationRead(notificationId, uuid);

  return { success: true };
});