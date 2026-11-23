import { emitEventToServer, registerSocketEventListener } from "./socket";

// 赞助商店购买
export function emitBuyFromSponsorShop(buyInfo: { id: string; count: number }) {
  emitEventToServer("shop:buyFromSponsorShop", { buyInfo });
}
export const onBuyFromSponsorShopSuccess = registerSocketEventListener<{ result: any }>("sponsorShop:buy:success");
export const onBuyFromSponsorShopFail = registerSocketEventListener<{ message: string }>("sponsorShop:buy:fail");

export function emitExchangeSponsorPointPack(count: number) {
  emitEventToServer("shop:exchangeSponsorPointPack", { count });
}
export const onExchangeSponsorPointPackSuccess = registerSocketEventListener<{ result: any }>("shop:exchangeSponsorPointPack:success");
export const onExchangeSponsorPointPackFail = registerSocketEventListener<{ message: string }>("shop:exchangeSponsorPointPack:fail");