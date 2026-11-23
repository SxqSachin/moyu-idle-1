import { prisma } from "../prisma";
import type {
  AuctionCreateInput,
  AuctionDTO,
  AuctionBidInput,
  AuctionBidDTO,
  AuctionDepositInput,
  AuctionListQuery,
  AuctionSettlementResult,
  AuctionState,
  AuctionTargetType,
  AuctionDetailDTO,
} from "~/shared/types/auction";
import { increaseItemCount, decreaseItemCount, getItemInfo, getItemCount, dispatchInventoryModify, invalidateInventoryCache } from "./characterInventory";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { emitEventToUser } from "~/server/io";
import { type PrismaTx } from "~/shared/types/socket/db";
import { type Auction } from "~/generated/prisma";
import { AUCTION_MAX_AMOUNT } from "~/shared/data/constant";

/* 辅助：number <-> BigInt 转换 */
const toBigInt = (v?: number | null): bigint | null => (v == null ? null : BigInt(Math.floor(v)));
const toBigIntReq = (v: number): bigint => BigInt(Math.floor(v));
const fromBigInt = (b?: bigint | null): number | null => (b == null ? null : Number(b));

/* 将 DB 行映射为 AuctionDTO */
const mapAuctionRowToDTO = (row: Auction): AuctionDTO => {
  return {
    id: row.id,
    uuid: row.uuid,
    isAdminAction: !!row.is_admin_action,
    creator: row.creator,
    targetType: row.target_type as AuctionTargetType,
    targetId: row.target_id,
    targetCount: Number(row.target_count ?? 1),
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    state: row.state as AuctionState,
    startPrice: fromBigInt(row.start_price) ?? 0,
    reservePrice: fromBigInt(row.reserve_price),
    buyoutPrice: fromBigInt(row.buyout_price),
    minIncrement: fromBigInt(row.min_increment) ?? 1,
    startAt: row.start_at,
    endAt: row.end_at,
    extensionSeconds: row.extension_seconds ?? null,
    extendedUntil: row.extended_until ?? null,
    depositRequired: fromBigInt(row.deposit_required),
    depositToken: row.deposit_token ?? null,
    winner: row.winner ?? null,
    finalPrice: fromBigInt(row.final_price),
    extra: row.extra ? JSON.parse(row.extra) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
export const getAuctionByUuid = async (uuid: string): Promise<AuctionDetailDTO | null> => {
  const row = await prisma.auction.findUnique({ where: { uuid } });
  if (!row) return null;
  let dto = mapAuctionRowToDTO(row);

  let currentMaxPrice = await prisma.auctionBid.findFirst({
    where: { auction_uuid: uuid },
    orderBy: { amount: "desc" },
  });

  let res: AuctionDetailDTO = {
    ...dto,
    currentMaxPrice: currentMaxPrice ? fromBigInt(currentMaxPrice.amount) : 0,
    currentMaxPriceUserUuid: currentMaxPrice ? currentMaxPrice.bidder : null,
  }

  return res;
};

/**
 * 内部结算逻辑（在事务 tx 中调用）
 * - 设定赢家、转移物品、退款未中标出价与保证金
 * - tx 必须是 prisma 事务客户端
 */
const settleAuctionInternal = async (tx: PrismaTx, auctionUuid: string): Promise<AuctionSettlementResult> => {
  // 1) 读取拍卖与最高出价
  const auction = await tx.auction.findUnique({ where: { uuid: auctionUuid } });
  if (!auction) throw new Error("拍卖不存在");

  const highest = await tx.auctionBid.findFirst({
    where: { auction_uuid: auctionUuid, refunded: false },
    orderBy: { amount: "desc" },
  });

  if (!highest) {
    // 无人出价：直接标记结束
    await tx.auction.update({ where: { uuid: auctionUuid }, data: { state: "ENDED" } });

    if (auction.target_type == 'ITEM' && auction.target_id) {
      let count = Number(auction.target_count);

      if (count) {
        await increaseItemCount(
          auction.creator,
          { [auction.target_id]: { count } },
          {
            type: ModifyItemCountType.Auction,
            showModifyInfo: true,
            actionName: "拍卖被取消 - 物品返还",
          },
          tx
        );
        await invalidateInventoryCache(auction.creator);
        dispatchInventoryModify(auction.creator, {
          [auction.target_id]: { count }
        })
      }
    }

    return {
      auctionUuid,
      winner: null,
      finalPrice: null,
      refundedDeposits: [],
      transferredMetadata: null,
      settledAt: new Date(),
    };
  }

  // 2) 写入结算信息（SETTLED）
  await tx.auction.update({
    where: { uuid: auctionUuid },
    data: {
      state: "SETTLED",
      winner: highest.bidder,
      final_price: highest.amount,
    },
  });

  const winner = highest.bidder;
  const finalPrice = fromBigInt(highest.amount) ?? 0;

  // 3) 转移物品（若 target_type === "ITEM"）
  let transferredMetadata: any = null;
  try {
    if (auction.target_type === "ITEM") {
      const itemId = auction.target_id;
      const count = Number(auction.target_count);

      await increaseItemCount(
        winner,
        { [itemId]: { count } },
        {
          type: ModifyItemCountType.Auction,
          showModifyInfo: true,
          actionName: "拍卖售出 - 增加赢家库存",
        },
        tx
      );
      await invalidateInventoryCache(winner);
      dispatchInventoryModify(highest.bidder, {
        [itemId]: { count }
      })

      if (auction.deposit_token) {
        await increaseItemCount(
          auction.creator,
          { [auction.deposit_token]: { count: finalPrice } },
          {
            type: ModifyItemCountType.Auction,
            showModifyInfo: true,
            actionName: "拍卖物品成功售出",
          },
          tx
        );
        await invalidateInventoryCache(auction.creator);
        dispatchInventoryModify(auction.creator, {
          [itemId]: { count }
        })
      }

      transferredMetadata = { itemId, count };
    } else {
      // 其它类型：将 metadata 直接作为已转移的快照保存（具体交由业务线处理）
      transferredMetadata = auction.metadata ? JSON.parse(auction.metadata) : null;
    }
  } catch (e) {
    // 物品转移出错：记录到 auction.extra 并抛出
    const prevExtra = auction.extra ? JSON.parse(auction.extra) : {};
    const newExtra = { ...prevExtra, transferError: String(e) };
    await tx.auction.update({ where: { uuid: auctionUuid }, data: { extra: JSON.stringify(newExtra) } });
    throw e;
  }

  // 4) 退款：退还其它未退款的出价
  const otherBids = await tx.auctionBid.findMany({
    where: { auction_uuid: auctionUuid, refunded: false, bidder: { not: winner } },
  });

  const refundedDeposits: Array<{ userUuid: string; amount: number; token?: string | null }> = [];

  for (const b of otherBids) {
    await tx.auctionBid.update({ where: { id: b.id }, data: { refunded: true } });

    const amt = fromBigInt(b.amount) ?? 0;
    if (amt > 0) {
      const payToken = auction.deposit_token ?? "gold";

      await increaseItemCount(
        b.bidder,
        { [payToken]: { count: amt } },
        {
          type: ModifyItemCountType.Auction,
          showModifyInfo: true,
          actionName: "拍卖失败 - 出价返还",
        },
        tx
      );
      await invalidateInventoryCache(b.bidder);
      dispatchInventoryModify(b.bidder, {
        [payToken]: { count: amt },
      });

      refundedDeposits.push({ userUuid: b.bidder, amount: amt, token: payToken });
    }
  }

  return {
    auctionUuid,
    winner,
    finalPrice,
    refundedDeposits,
    transferredMetadata,
    settledAt: new Date(),
  } as AuctionSettlementResult;
};

/**
 * 对外结算接口（会开启新事务）
 */
export const settleAuction = async (auctionUuid: string) => {
  return await prisma.$transaction(async (tx) => {
    // 先把拍卖置为 ENDED（触发结算逻辑会把其设为 SETTLED）
    await tx.auction.update({ where: { uuid: auctionUuid }, data: { state: "ENDED" } });
    return await settleAuctionInternal(tx, auctionUuid);
  });
};