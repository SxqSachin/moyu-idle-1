import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";
import type { GameSocketData } from "~/shared/types/socket";
import type { 
  MarketTradeInfo, 
  ListToMarketInfo, 
  BuyFromMarketInfo, 
  RemoveFromMarketResult, 
  MarkerTransactionInfo 
} from "~/shared/types/market";

// 获取所有可交易资源列表
export function emitGetAllTradeableResourceList() {
  emitEventToServer("market:getAllTradeableResourceList", {});
}
export const onGetAllTradeableResourceList = registerSocketEventListener<string[]>("market:getAllTradeableResourceList:success");
export const onGetAllTradeableResourceListError = registerSocketEventListener<{ message: string }>("market:getAllTradeableResourceList:error");

// 获取市场交易列表
export function emitGetTransactionList(resourceId: string) {
  emitEventToServer("market:getTransactionList", { resourceId });
}
export const onGetTransactionList = registerSocketEventListener<Omit<MarketTradeInfo, 'buyerInfo' | 'seller'>[]>("market:getTransactionList:success");
export const onGetTransactionListError = registerSocketEventListener<{ message: string }>("market:getTransactionList:error");

// 上架物品
export function emitListToMarket(info: ListToMarketInfo) {
  emitEventToServer("market:listToMarket", info);
}
export const onListToMarketSuccess = registerSocketEventListener<MarketTradeInfo>("market:listToMarket:success");
export const onListToMarketError = registerSocketEventListener<{ message: string }>("market:listToMarket:error");

// 购买物品
export function emitBuyFromMarket(info: Omit<BuyFromMarketInfo, 'buyerUuid'>) {
  emitEventToServer("market:buyFromMarket", info);
}
export const onBuyFromMarketSuccess = registerSocketEventListener<MarkerTransactionInfo>("market:buyFromMarket:success");
export const onBuyFromMarketError = registerSocketEventListener<{ message: string }>("market:buyFromMarket:error");

// 下架物品
export function emitRemoveFromMarket(tradeUuid: string) {
  emitEventToServer("market:removeFromMarket", { tradeUuid });
}
export const onRemoveFromMarketSuccess = registerSocketEventListener<RemoveFromMarketResult>("market:removeFromMarket:success");
export const onRemoveFromMarketError = registerSocketEventListener<{ message: string }>("market:removeFromMarket:error");

// 获取市场历史
export const emitGetMarketListHistory = () => {
  emitEventToServer("market:getListHistory", null);
};
export const onGetMarketListHistorySuccess = registerSocketEventListener<MarketTradeInfo[]>("market:listHistory:success");
export const onGetMarketListHistoryError = registerSocketEventListener<{ message: string }>("market:listHistory:error");

// 获取当前市场上架上限
export const emitGetMarketListingLimits = () => {
  emitEventToServer("market:getListingLimits", null);
};
export const onGetMarketListingLimitsSuccess = registerSocketEventListener<any>("market:listingLimits:success");
export const onGetMarketListingLimitsError = registerSocketEventListener<{ message: string }>("market:listingLimits:error");

// 扩展市场上架/求购槽位
export const emitExpandSellerListingSlots = (payload: { schemeId?: string }) => {
  emitEventToServer("market:expandSellerListingSlots", payload);
};
export const onExpandSellerListingSlotsSuccess = registerSocketEventListener<any>("market:expandSellerListingSlots:success");
export const onExpandSellerListingSlotsError = registerSocketEventListener<{ message: string }>("market:expandSellerListingSlots:error");

export const emitExpandBuyerListingSlots = (payload: { schemeId?: string }) => {
  emitEventToServer("market:expandBuyerListingSlots", payload);
};
export const onExpandBuyerListingSlotsSuccess = registerSocketEventListener<any>("market:expandBuyerListingSlots:success");
export const onExpandBuyerListingSlotsError = registerSocketEventListener<{ message: string }>("market:expandBuyerListingSlots:error");