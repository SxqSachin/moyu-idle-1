import type { Socket, DefaultEventsMap } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getPinnedShopEntries } from "~/server/utils/game/playerShop";
import { redisClient } from "~/server/utils";
import { MAX_GLOBAL_PINS } from "~/server/utils/game/playerShop";

export default async function ioGetPinned(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<null>
) {
  const userUuid = data?.user?.uuid;
  if (!userUuid || typeof userUuid !== "string") {
    emitEventToUser(userUuid ?? "unknown", "playerShop:getPinned:error", { message: "未认证的请求" });
    return;
  }

  try {
    const entries = await getPinnedShopEntries();
    // compute cooldown for this owner (seconds remaining)
    const cooldownKey = `playerShop:pinCooldown:${userUuid}`;
    let cooldownRemainingSec = 0;
    try {
      const ttl = await redisClient.ttl(cooldownKey);
      cooldownRemainingSec = Number.isFinite(ttl) ? ttl : 0;
      if (cooldownRemainingSec < 0) cooldownRemainingSec = 0;
    } catch (err) {
      cooldownRemainingSec = 0;
    }
    const currentPinnedCount = entries.length;
    const canPin = cooldownRemainingSec === 0 && currentPinnedCount < MAX_GLOBAL_PINS;
    emitEventToUser(userUuid, "playerShop:getPinned:success", { pinned: entries, cooldownRemainingSec, canPin, currentPinnedCount, maxGlobalPins: MAX_GLOBAL_PINS });
  } catch (e: any) {
    emitEventToUser(userUuid, "playerShop:getPinned:error", { message: e?.message || "获取置顶列表失败" });
  }
}
