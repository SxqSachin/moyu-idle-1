import type { Socket, DefaultEventsMap } from "socket.io";
import type { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getMyShops, getShopDetail, getPublicShops } from "~/server/utils/game/playerShop";
import type { GetMyShopsQuery, GetShopDetailQuery } from "~/shared/types/playerShop";
import type { GetPublicShopsQuery } from "~/shared/types/playerShop";

export async function ioGetMyShops(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<GetMyShopsQuery>
) {
  const userUuid = data.user.uuid;
  try {
    const shops = await getMyShops(userUuid, data.data || {});
    emitEventToUser(userUuid, "playerShop:my:success", { shops });
  } catch (e: any) {
    emitEventToUser(userUuid, "playerShop:my:error", { message: e.message });
  }
}

export async function ioGetShopDetail(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<GetShopDetailQuery>
) {
  const userUuid = data.user.uuid;
  try {
    const res = await getShopDetail(data.data.shopUuid, userUuid);
    emitEventToUser(userUuid, "playerShop:detail:success", res);
  } catch (e: any) {
    emitEventToUser(userUuid, "playerShop:detail:error", { message: e.message });
  }
}

export async function ioGetPublicShops(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<GetPublicShopsQuery>
) {
  try {
    const userUuid = (data as any).user?.uuid;
    const query = data.data || {} as GetPublicShopsQuery;
    // default exclude current user so list focuses on others
    const res = await getPublicShops({ ...query });
    emitEventToUser(userUuid, "playerShop:public:success", res);
  } catch (err: any) {
    emitEventToUser((data as any).user?.uuid, "playerShop:public:error", { message: err?.message || "failed" });
  }
}
