import type { Socket, DefaultEventsMap } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { unpinShop, getPinnedShopUuids } from "~/server/utils/game/playerShop";

export async function ioUnpinPlayerShop(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ shopUuid: string }>
) {
  // 严格校验输入
  const userUuid = data?.user?.uuid;
  if (!userUuid || typeof userUuid !== "string") {
    emitEventToUser(userUuid ?? "unknown", "playerShop:unpin:error", { message: "未认证的请求" });
    return;
  }
  const shopUuid = data?.data?.shopUuid;
  if (!shopUuid || typeof shopUuid !== "string") {
    emitEventToUser(userUuid, "playerShop:unpin:error", { message: "缺少或无效的 shopUuid 参数" });
    return;
  }

  try {
    const shop = await prisma.playerShop.findUnique({ where: { uuid: shopUuid } });
    if (!shop) {
      emitEventToUser(userUuid, "playerShop:unpin:error", { message: "店铺不存在" });
      return;
    }
    if (shop.owner !== userUuid) {
      emitEventToUser(userUuid, "playerShop:unpin:error", { message: "无权取消该店铺置顶" });
      return;
    }

    await unpinShop(shop.uuid);
    const pinnedList = await getPinnedShopUuids();
    emitEventToUser(userUuid, "playerShop:unpin:success", { shopUuid: shop.uuid, pinned: pinnedList });
  } catch (e: any) {
    emitEventToUser(userUuid, "playerShop:unpin:error", { message: e?.message || "取消置顶失败" });
  }
}
