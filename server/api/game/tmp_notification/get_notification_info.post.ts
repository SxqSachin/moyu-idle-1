import { isUserNotificationUnread } from "~/server/utils/game/tmpNotification";

export default defineEventHandler(async (event) => {
  const { notificationId } = await readBody(event);
  const user = await getUserSession(event);

  // @ts-ignore
  const uuid = user.user?.uuid;
  if (!uuid || !notificationId) {
    return { success: false, is_unread: false, message: "参数错误" };
  }

  const unread = await isUserNotificationUnread(notificationId, uuid);

  return {
    success: true,
    is_unread: !unread,
  };
});