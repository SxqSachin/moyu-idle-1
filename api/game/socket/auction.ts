// ...existing code...

import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";
import type {
  AuctionListQuery,
  Paginated,
  AuctionDTO,
  AuctionCreateInput,
  AuctionBidInput,
  AuctionBidDTO,
  AuctionDepositInput,
  AuctionBidHistoryItem,
  AuctionSettlementResult,
  AuctionDetailDTO,
} from "~/shared/types/auction";

/**
 * 前端 -> 后端：拍卖相关 socket 接口封装
 * 规范与 referrer.ts 一致：emitEventToServer(...) 发事件，registerSocketEventListener(...) 订阅返回事件
 *
 * 注：所有 emit 函数只负责触发事件，实际回调结果通过对应的 onXxxSuccess/onXxxFail 监听。
 */

/* -------- 查询相关 -------- */
export function emitGetAuctionList(query?: AuctionListQuery) {
  emitEventToServer("auction:list", { query });
}
export const onGetAuctionListSuccess = registerSocketEventListener<Paginated<AuctionDetailDTO>>(
  "auction:list:success"
);
export const onGetAuctionListFail = registerSocketEventListener<{ message: string }>("auction:list:fail");

export function emitGetAuctionDetail(uuid: string) {
  emitEventToServer("auction:detail", { uuid });
}
export const onGetAuctionDetailSuccess = registerSocketEventListener<{ auction: AuctionDetailDTO }>(
  "auction:detail:success"
);
export const onGetAuctionDetailFail = registerSocketEventListener<{ message: string }>("auction:detail:fail");

// 获取即将成交的拍卖（不分页，2 小时内结束）
export function emitGetUpcomingAuctions() {
  emitEventToServer("auction:upcoming", {});
}
export const onGetUpcomingAuctionsSuccess = registerSocketEventListener<{ items: AuctionDetailDTO[] }>(
  "auction:upcoming:success"
);
export const onGetUpcomingAuctionsFail = registerSocketEventListener<{ message: string }>(
  "auction:upcoming:fail"
);

/* -------- 创建 / 操作 -------- */
export function emitCreateAuction(input: AuctionCreateInput) {
  emitEventToServer("auction:create", { input });
}
export const onCreateAuctionSuccess = registerSocketEventListener<{ auction: AuctionDTO }>(
  "auction:create:success"
);
export const onCreateAuctionFail = registerSocketEventListener<{ message: string }>("auction:create:fail");

/* 缴纳保证金 */
export function emitDepositForAuction(input: Omit<AuctionDepositInput, 'userUuid'>) {
  emitEventToServer("auction:deposit", { input });
}
export const onDepositForAuctionSuccess = registerSocketEventListener<{ auctionUuid: string }>(
  "auction:deposit:success"
);
export const onDepositForAuctionFail = registerSocketEventListener<{ message: string }>("auction:deposit:fail");

/* 出价 */
export function emitPlaceBid(input: AuctionBidInput) {
  emitEventToServer("auction:bid", { input });
}
export const onPlaceBidSuccess = registerSocketEventListener<{ bid: AuctionBidDTO }>("auction:bid:success");
export const onPlaceBidFail = registerSocketEventListener<{ message: string }>("auction:bid:fail");

/* -------- 历史 / 管理操作 -------- */
/* 获取出价历史 */
export function emitGetBidHistory(auctionUuid: string) {
  emitEventToServer("auction:history", { auctionUuid });
}
export const onGetBidHistorySuccess = registerSocketEventListener<{ history: AuctionBidHistoryItem[] }>(
  "auction:history:success"
);
export const onGetBidHistoryFail = registerSocketEventListener<{ message: string }>("auction:history:fail");

/* 结算（管理员或后端触发） */
export function emitSettleAuction(auctionUuid: string) {
  emitEventToServer("auction:settle", { auctionUuid });
}
export const onSettleAuctionSuccess = registerSocketEventListener<{ result: AuctionSettlementResult }>(
  "auction:settle:success"
);
export const onSettleAuctionFail = registerSocketEventListener<{ message: string }>("auction:settle:fail");

/* 取消拍卖 */
export function emitCancelAuction(auctionUuid: string) {
  emitEventToServer("auction:cancel", { auctionUuid });
}
export const onCancelAuctionSuccess = registerSocketEventListener<{ auctionUuid: string }>(
  "auction:cancel:success"
);
export const onCancelAuctionFail = registerSocketEventListener<{ message: string }>("auction:cancel:fail");

// ...existing code...