import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";
import type { GameSocketData } from "~/shared/types/socket";
import type {
  BuyerMarketTradeInfo,
  ListToBuyerMarketInfo,
  RemoveFromBuyerMarketResult,
  SellToBuyerMarketInfo,
  MarkerTransactionInfo,
} from "~/shared/types/buyerMarket";

// 获取所有可交易资源列表
export function emitGetAllBuyerMarketTradeableResourceList() {
  emitEventToServer("buyerMarket:getAllTradeableResourceList", {});
}
export const onGetAllBuyerMarketTradeableResourceList = registerSocketEventListener<string[]>("buyerMarket:getAllTradeableResourceList:success");
export const onGetAllBuyerMarketTradeableResourceListError = registerSocketEventListener<{ message: string }>("buyerMarket:getAllTradeableResourceList:error");

// 获取买方市场交易列表
export function emitGetBuyerMarketTransactionList(resourceId: string) {
  emitEventToServer("buyerMarket:getTransactionList", { resourceId });
}
export const onGetBuyerMarketTransactionList = registerSocketEventListener<Omit<BuyerMarketTradeInfo, 'buyer'>[]>("buyerMarket:getTransactionList:success");
export const onGetBuyerMarketTransactionListError = registerSocketEventListener<{ message: string }>("buyerMarket:getTransactionList:error");

// 上架求购
export function emitListToBuyerMarket(info: ListToBuyerMarketInfo) {
  emitEventToServer("buyerMarket:listToBuyerMarket", info);
}
export const onListToBuyerMarketSuccess = registerSocketEventListener<BuyerMarketTradeInfo>("buyerMarket:listToBuyerMarket:success");
export const onListToBuyerMarketError = registerSocketEventListener<{ message: string }>("buyerMarket:listToBuyerMarket:error");

// 下架求购
export function emitRemoveFromBuyerMarket(tradeUuid: string) {
  emitEventToServer("buyerMarket:removeFromBuyerMarket", { tradeUuid });
}
export const onRemoveFromBuyerMarketSuccess = registerSocketEventListener<RemoveFromBuyerMarketResult>("buyerMarket:removeFromBuyerMarket:success");
export const onRemoveFromBuyerMarketError = registerSocketEventListener<{ message: string }>("buyerMarket:removeFromBuyerMarket:error");

// 卖出资源到买方市场
export function emitSellToBuyerMarket(info: Omit<SellToBuyerMarketInfo, 'sellerUuid'>) {
  emitEventToServer("buyerMarket:sellToBuyerMarket", info);
}
export const onSellToBuyerMarketSuccess = registerSocketEventListener<MarkerTransactionInfo>("buyerMarket:sellToBuyerMarket:success");
export const onSellToBuyerMarketError = registerSocketEventListener<{ message: string }>("buyerMarket:sellToBuyerMarket:error");

// 获取买方市场历史
export function emitGetBuyerMarketListHistory() {
  emitEventToServer("buyerMarket:listHistory", null);
}
export const onGetBuyerMarketListHistorySuccess = registerSocketEventListener<BuyerMarketTradeInfo[]>("buyerMarket:listHistory:success");
export const onGetBuyerMarketListHistoryError = registerSocketEventListener<{ message: string }>("buyerMarket:listHistory:error");