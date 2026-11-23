import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { GameResourceTradeEvent } from "~/shared/types/gameResource";
import { buyFromSponsorShop, exchangeSponsorPointPack, getSponsorPoints } from "~/server/utils/game/sponsorPoint";

export async function ioBuyFromSponsorShop(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ buyInfo: GameResourceTradeEvent }>
) {
  const userUuid = data.user.uuid;
  let buyInfo = data.data.buyInfo

  if (!userUuid || !buyInfo?.id || !buyInfo?.count) {
    emitEventToUser(userUuid, "sponsorShop:buy:fail", { message: "参数错误" });
    return;
  }

  await withUniqueLock("buyFromSponsorShop:" + userUuid, async () => {
    try {
      const result = await buyFromSponsorShop(userUuid, buyInfo);
      emitEventToUser(userUuid, "sponsorShop:buy:success", { result: result });

      const points = await getUserSponsorPointInfo(userUuid);
      emitEventToUser(userUuid, "sponsorPoint:get:success", points);
    } catch (e: any) {
      emitEventToUser(userUuid, "sponsorShop:buy:fail", { message: e.message });
    }
  })
}

export async function ioExchangeSponsorPointPack(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ count: number }>
) {
  const userUuid = data.user.uuid;
  let count = data.data.count

  if (!count || !Number.isInteger(count) || count < 0) {
    emitEventToUser(userUuid, "shop:exchangeSponsorPointPack:fail", { message: "参数错误" });
  }

  await withUniqueLock("exchangeSponsorPointPack:" + userUuid, async () => {
    try {
      await exchangeSponsorPointPack(userUuid, count);

      emitEventToUser(userUuid, "shop:exchangeSponsorPointPack:success", {});

      const points = await getUserSponsorPointInfo(userUuid);
      emitEventToUser(userUuid, "sponsorPoint:get:success", points);
    } catch (e: any) {
      emitEventToUser(userUuid, "shop:exchangeSponsorPointPack:fail", { message: e.message });
    }
  })
}