import type { Socket, DefaultEventsMap } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { pinShop, getPinnedShopUuids } from "~/server/utils/game/playerShop";

export async function ioPinPlayerShop(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ shopUuid: string }>
) {
  // 严格校验输入
  const userUuid = data?.user?.uuid;
  if (!userUuid || typeof userUuid !== "string") {
    // 无效的 socket 请求，直接返回错误
    emitEventToUser(userUuid ?? "unknown", "playerShop:pin:error", { message: "未认证的请求" });
    return;
  }
  const shopUuid = data?.data?.shopUuid;
  if (!shopUuid || typeof shopUuid !== "string") {
    emitEventToUser(userUuid, "playerShop:pin:error", { message: "缺少或无效的 shopUuid 参数" });
    return;
  }

  try {
    // 确保店铺存在且归当前用户所有
    const shop = await prisma.playerShop.findUnique({ where: { uuid: shopUuid } });
    if (!shop) {
      emitEventToUser(userUuid, "playerShop:pin:error", { message: "店铺不存在" });
      return;
    }
    if (shop.owner !== userUuid) {
      emitEventToUser(userUuid, "playerShop:pin:error", { message: "无权置顶该店铺" });
      return;
    }

    const expiresAt = await pinShop(userUuid, shop.uuid);
    const pinnedList = await getPinnedShopUuids();
    emitEventToUser(userUuid, "playerShop:pin:success", { shopUuid: shop.uuid, expiresAt, pinned: pinnedList });
  } catch (e: any) {
    emitEventToUser(userUuid, "playerShop:pin:error", { message: e?.message || "置顶失败" });
  }
}
