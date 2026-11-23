import type { MarketPriceData, UnifiedMarketRow } from "~/shared/types/market";
import { emitEventToServer, registerSocketEventListener } from "./socket";

// 获取所有可交易资源列表
export function emitGetUnifiedTradeableResourceList() {
  emitEventToServer("newMarket:getAllTradeableResourceList", {});
}
export const onGetUnifiedTradeableResourceList = registerSocketEventListener<any>("newMarket:getAllTradeableResourceList:success");
export const onGetUnifiedTradeableResourceListError = registerSocketEventListener<{ message: string }>("newMarket:getAllTradeableResourceList:error");

export function emitGetUnifiedTransactionList(resourceId: string) {
  emitEventToServer("newMarket:getUnifiedTransactionList", { resourceId });
}
export const onGetUnifiedTransactionList = registerSocketEventListener<UnifiedMarketRow[]>("newMarket:getUnifiedTransactionList:success");
export const onGetUnifiedTransactionListError = registerSocketEventListener<{ message: string }>("newMarket:getUnifiedTransactionList:error");

export function emitGetUnifiedTransactionHistory(args?: {
  page?: number;
  pageSize?: number;
  type?: "sell" | "buy" | "all";
  status?: "open" | "closed" | "all";
  resourceId?: string;
  resourceIds?: string[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  emitEventToServer("newMarket:getUnifiedTransactionHistory", args ?? {});
}
export const onGetUnifiedTransactionHistory = registerSocketEventListener<{
  items: UnifiedMarketRow[];
  total: number;
  totalSell: number;
  totalBuy: number;
  openSellCount: number;
  openBuyCount: number;
  page: number;
  pageSize: number;
  type: "sell" | "buy" | "all";
}>("newMarket:getUnifiedTransactionHistory:success");
export const onGetUnifiedTransactionHistoryError = registerSocketEventListener<{ message: string }>("newMarket:getUnifiedTransactionHistory:error");

export const emitGetMarketPriceData = (resourceId: string) => {
  emitEventToServer("newMarket:priceData", { resourceId });
}
export const onGetMarketPriceDataSuccess = registerSocketEventListener<{
  resourceId: string;
  data: MarketPriceData
}>("newMarket:priceData:success");
export const onGetMarketPriceDataError = registerSocketEventListener<{ message: string }>("newMarket:priceData:fail");

export const emitBatchGetMarketPriceData = (resourceIds: string[]) => {
  emitEventToServer("newMarket:batchPriceData", { resourceIds });
}
export const onBatchGetMarketPriceDataSuccess = registerSocketEventListener<{
  data: Record<string, MarketPriceData>
}>("newMarket:batchPriceData:success");
export const onBatchGetMarketPriceDataError = registerSocketEventListener<{ message: string }>("newMarket:batchPriceData:fail");

// 获取最近有成交记录的资源ID列表（用于首页展示）
export const emitGetRecentTradedResources = (limit?: number) => {
  emitEventToServer("newMarket:getRecentTradedResources", { limit });
}
export const onGetRecentTradedResourcesSuccess = registerSocketEventListener<{ resourceIds: string[] }>("newMarket:recentTradedResources:success");
export const onGetRecentTradedResourcesError = registerSocketEventListener<{ message: string }>("newMarket:recentTradedResources:fail");