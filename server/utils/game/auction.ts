import { prisma } from "./db";
import {
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
import { increaseItemCount, decreaseItemCount, getItemInfo, getItemCount, dispatchInventoryModify } from "./characterInventory";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { emitEventToUser } from "~/server/io";
import { PrismaTx } from "~/shared/types/socket/db";
import { Auction } from "~/generated/prisma";
import { AUCTION_BUYOUT_MAX_AMOUNT, AUCTION_CREATE_FEE, AUCTION_MAX_AMOUNT } from "~/shared/data/constant";
import { allGameResource } from "~/shared/data/allGameResources";
import { AccountPlayType } from "~/shared/types/account";
import { safeJsonParse } from "~/shared/utils";

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

/* -----------------------
   CRUD 基本方法
   ----------------------- */

/** 创建拍卖 */
export const createAuction = async (input: AuctionCreateInput): Promise<AuctionDTO> => {
  if (input.startPrice < 0) {
    throw new Error("起始价格必须大于等于 0");
  }

  if (input.startPrice > AUCTION_MAX_AMOUNT / 2) {
    throw new Error(`起始价格不能超过 ${AUCTION_MAX_AMOUNT / 2} 金币`);
  }

  // 判断是否为整数
  if (!Number.isInteger(input.startPrice)) {
    throw new Error("起始价格必须为整数");
  }
  if (input.reservePrice != null && !Number.isInteger(input.reservePrice)) {
    throw new Error("保留价格必须为整数");
  }
  if (input.buyoutPrice != null && !Number.isInteger(input.buyoutPrice)) {
    throw new Error("一口价必须为整数");
  }

  if (!!input.buyoutPrice ) {
    if (input.buyoutPrice > AUCTION_BUYOUT_MAX_AMOUNT) {
      throw new Error(`一口价不能超过 ${AUCTION_BUYOUT_MAX_AMOUNT} 金币`);
    }
    if (input.buyoutPrice < input.startPrice * 2) {
      throw new Error("一口价必须大于起始价格的两倍");
    }
  }

  if (input.minIncrement != null && !Number.isInteger(input.minIncrement)) {
    throw new Error("最小加价幅度必须为整数");
  }
  if (input.targetCount != null && !Number.isInteger(input.targetCount) && input.targetCount < 1) {
    throw new Error("目标数量必须为整数");
  }

  // 负数检查
  if (input.reservePrice != null && input.reservePrice < 0) {
    throw new Error("保留价格必须大于等于 0");
  }
  if (input.buyoutPrice != null && input.buyoutPrice < 0) {
    throw new Error("一口价必须大于等于 0");
  }
  if (input.minIncrement != null && input.minIncrement < 1) {
    throw new Error("最小加价幅度必须大于等于 1");
  }
  if (input.targetCount != null && input.targetCount < 1) {
    throw new Error("目标数量必须大于等于 1");
  }

  if (input.targetType == 'ITEM' && (!input.targetId || !allGameResource[input.targetId])) {
    throw new Error("所拍卖的资源无效");
  }

  let creator = await prisma.user.findUnique({ where: { uuid: input.creator } });

  if (!creator || creator.is_banned) {
    throw new Error("用户不存在或已被禁用");
  }

  if (creator?.accountPlayType == AccountPlayType.IRON) {
    throw new Error("你无法创建拍卖");
  }

  input.isAdminAction = creator.is_gm;

  // 默认2小时后结算
  if (!input.endAt) {
    input.endAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  }

  // 最大不超过8小时
  if (input.endAt) {
    const maxEndAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    if (input.endAt > maxEndAt) {
      throw new Error("结束时间不能超过8小时后");
    }
  }

  if (!creator.is_gm) {
    if (input.targetType !== "ITEM") {
      throw new Error("玩家只能拍卖物品");
    }
    if (input.metadata) {
      throw new Error("玩家只能填写基础信息");
    }

    if (input.extensionMinutes && (input.extensionMinutes < 1 || input.extensionMinutes > 30)) {
      throw new Error("延长期必须在 1 到 30 分钟之间");
    }

    let exist = await prisma.auction.count({
      where: {
        creator: input.creator,
        state: "OPEN",
      },
    });
    if (exist > 0) {
      throw new Error("目前你只能拥有1个拍卖订单");
    }
  }

  if (!creator.email_verified) {
    throw new Error("请先验证邮箱后再创建拍卖");
  }

  return await prisma.$transaction(async (tx) => {
    if (input.targetType === "ITEM") {
      let creatorInventoryCount = await getItemCount(
        input.creator,
        input.targetId,
        tx
      );
      if (creatorInventoryCount < input.targetCount) {
        throw new Error("库存不足，无法创建拍卖");
      }

      let goldCount = await getItemCount(input.creator, "gold", tx);
      if (goldCount < AUCTION_CREATE_FEE) {
        throw new Error("库存不足，无法支付手续费");
      }

      // 从卖家扣除物品
      await decreaseItemCount(
        input.creator,
        { 
          [input.targetId]: { count: input.targetCount } 
        },
        {
          type: ModifyItemCountType.Auction,
          showModifyInfo: true,
          actionName: "发起拍卖 - 物品扣除",
        },
        tx
      );
      await invalidateInventoryCache(input.creator);
      emitEventToUser(input.creator, "inventoryModify", {
        item: { id: input.targetId, count: -input.targetCount },
      });

      await decreaseItemCount(
        input.creator,
        { 
          gold: { count: AUCTION_CREATE_FEE } 
        },
        {
          type: ModifyItemCountType.Auction,
          showModifyInfo: true,
          actionName: "发起拍卖 - 手续费",
        },
        tx
      );
      await invalidateInventoryCache(input.creator);
      dispatchInventoryModify(input.creator, {
        gold: { count: -AUCTION_CREATE_FEE },
      });


    }

    const created = await prisma.auction.create({
      data: {
        is_admin_action: !!input.isAdminAction,
        creator: input.creator,
        target_type: input.targetType,
        target_id: input.targetId,
        target_count: toBigIntReq(input.targetCount),
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        state: "OPEN",
        start_price: toBigIntReq(input.startPrice),
        reserve_price:
          input.reservePrice != null ? toBigIntReq(input.reservePrice) : null,
        buyout_price:
          input.buyoutPrice != null ? toBigIntReq(input.buyoutPrice) : null,
        min_increment:
          input.minIncrement != null
            ? toBigIntReq(input.minIncrement)
            : BigInt(1),
        start_at: input.startAt ?? new Date(),
        end_at: input.endAt,
        extension_seconds: (input.extensionMinutes ?? 0) * 60,
        deposit_required:
          input.depositRequired != null
            ? toBigIntReq(input.depositRequired)
            : null,
        deposit_token: input.depositToken ?? "gold",
        extra: input.extra ? JSON.stringify(input.extra) : null,
      },
    });

    return mapAuctionRowToDTO(created);
  });

};

/** 根据 uuid 读取拍卖 */
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

/** 列表查询（分页、过滤、排序） */
export const listAuctions = async (query: AuctionListQuery, requestUserUuid: string) => {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where: any = {};
  if (query.state && query.state !== "ALL") where.state = query.state;
  if (query.targetType) where.target_type = query.targetType;
  if (query.creator) where.creator = query.creator;
  if (query.search) {
    where.OR = [
      { target_id: { contains: query.search } },
      // { creator: { contains: query.search } },
    ];
  }

  let requestUser = await prisma.user.findUnique({ where: { uuid: requestUserUuid } });
  if (!requestUser?.is_gm) {
    if (requestUser?.accountPlayType == AccountPlayType.IRON) {
      where.metadata = {
        contains: "iron_only" 
      }
    }
  }

  // const orderBy: any = {};
  // if (query.sortBy === "startPrice") orderBy.start_price = query.sortOrder === "asc" ? "asc" : "desc";
  // else if (query.sortBy === "createdAt") orderBy.created_at = query.sortOrder === "asc" ? "asc" : "desc";
  // else orderBy.end_at = query.sortOrder === "asc" ? "asc" : "desc";
  const [items, total] = await Promise.all([
    prisma.auction.findMany({
      select: {
        uuid: true,
      },
      where,
      orderBy: [
        { is_admin_action: "desc" }, // admin (true) 放前面
        { created_at: "desc" },      // 创建时间倒序
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auction.count({ where }),
  ]);

  const auctionDetailList = await Promise.all(items.map(item => getAuctionByUuid(item.uuid)));

  return {
    items: auctionDetailList,
    total,
    page,
    pageSize,
  };
};

/** 列出未来 `withinMs` 毫秒内将要结束（即将成交）的拍卖（不分页） */
export const listUpcomingAuctions = async (
  requestUserUuid: string,
  withinMs: number = 2 * 60 * 60 * 1000,
): Promise<AuctionDetailDTO[]> => {
  const now = new Date();
  const until = new Date(Date.now() + withinMs);

  const where: any = { state: 'OPEN', end_at: { gte: now, lte: until } };

  const requestUser = await prisma.user.findUnique({ where: { uuid: requestUserUuid } });
  if (!requestUser?.is_gm) {
    if (requestUser?.accountPlayType == AccountPlayType.IRON) {
      // For iron accounts, keep same metadata restriction as listAuctions
      where.metadata = { contains: 'iron_only' };
    }
  }

  const rows = await prisma.auction.findMany({
    select: { uuid: true },
    where,
    orderBy: [{ end_at: 'asc' }, { created_at: 'desc' }],
    take: 1000, // safeguard upper bound
  });

  const detailList = await Promise.all(rows.map(r => getAuctionByUuid(r.uuid)));
  // filter out nulls
  return detailList.filter((d): d is AuctionDetailDTO => d !== null);
};

/**
 * 出价（核心并发路径）
 * - 使用事务，调用 characterInventory 的扣款/返还
 * - 当前实现：记录 maxProxy，但不做自动代理竞价（可后续扩展）
 */
export const placeBid = async (input: AuctionBidInput): Promise<AuctionBidDTO> => {
  const bidderUuid = input.bidder;
  const thisTimeAmount = input.amount;

  if (!bidderUuid) {
    throw new Error("出价者不存在");
  }
  if (!thisTimeAmount || thisTimeAmount <= 0 || !Number.isInteger(thisTimeAmount)) {
    throw new Error("出价金额必须为正整数");
  }

  const bidder = await prisma.user.findUnique({ where: { uuid: bidderUuid } });
  if (!bidder || bidder.is_banned) {
    throw new Error("出价者不存在或已被禁用");
  }
  if (!bidder.email_verified) {
    throw new Error("请先验证邮箱后再出价");
  }
  // 新玩家前48小时内无法参与拍卖
  const accountAgeMs = Date.now() - bidder.create_date.getTime();
  if (accountAgeMs < 48 * 3600 * 1000) {
    throw new Error("新账号创建48小时内无法参与拍卖");
  }

  return await prisma.$transaction(async (tx) => {
    // 1) 检查拍卖
    const auction = await tx.auction.findUnique({ where: { uuid: input.auctionUuid } });
    if (!auction) throw new Error("此拍卖不存在");
    if (auction.state !== "OPEN") throw new Error("此拍卖非开放状态");
    const now = new Date();
    if (now >= auction.end_at) throw new Error("此拍卖已经结束");

    const minInc = auction.min_increment ?? BigInt(1);
    const payToken = auction.deposit_token ?? "gold";
    const buyoutPrice = auction.buyout_price;

    let isSameGameType = await isSameAccountPlayType(input.bidder, auction.creator);

    const meta = safeJsonParse<Record<string, any>>(auction.metadata, {})

    if (meta.iron_only) {
      if (isSameGameType.myAccountPlayType != AccountPlayType.IRON) {
        throw new Error("此拍卖仅限硬核猫猫参与");
      }
    } else {
      if (isSameGameType.myAccountPlayType != AccountPlayType.NORMAL) {
        throw new Error("此拍卖硬核猫猫无法参与");
      }
    }

    if (!payToken) {
      throw new Error("支付代币不存在");
    }

    // 2) 获取当前最高出价
    const highest = await tx.auctionBid.findFirst({
      where: { auction_uuid: input.auctionUuid },
      orderBy: { amount: "desc" },
    });

    const currentTop = highest ? highest.amount : auction.start_price;
    const requiredMin = currentTop + minInc;

    const amountBig = toBigIntReq(thisTimeAmount);
    if (amountBig < requiredMin) {
      throw new Error(`你的出价过低，当前最高价为${Number(currentTop)}，最低需${Number(requiredMin)}`);
    }

    // 3) 扣除出价资金（即时冻结）
    const bidderInventoryCount = await getItemCount(bidderUuid, payToken);
    if (bidderInventoryCount < thisTimeAmount) {
      throw new Error(`你的库存不足，无法出价`);
    }

    await decreaseItemCount(
      bidderUuid,
      { [payToken]: { count: thisTimeAmount } },
      {
        type: ModifyItemCountType.Auction,
        showModifyInfo: true,
        actionName: "拍卖出价扣款",
      },
      tx
    );
    await invalidateInventoryCache(bidderUuid);
    dispatchInventoryModify(input.bidder, {
      [payToken]: {count: -thisTimeAmount }
    })

    // 4) 写入出价记录
    const bidRow = await tx.auctionBid.create({
      data: {
        auction_uuid: input.auctionUuid,
        bidder: bidderUuid,
        amount: amountBig,
        max_proxy: 0, // input.maxProxy != null ? toBigIntReq(input.maxProxy) : BigInt(0),
        is_proxy: false, // !!input.isProxy,
        refunded: false,
        extra: input.extra ? JSON.stringify(input.extra) : null,
      },
    });

    // 5) 返还被超越的最高出价（如果存在）
    if (highest) {
      await tx.auctionBid.update({ where: { id: highest.id }, data: { refunded: true } });

      const prevAmt = fromBigInt(highest.amount) ?? 0;
      if (prevAmt > 0) {
        await increaseItemCount(
          highest.bidder,
          { [payToken]: { count: prevAmt } },
          {
            type: ModifyItemCountType.Auction,
            showModifyInfo: true,
            actionName: "拍卖被超出返还",
          },
          tx
        );
        await invalidateInventoryCache(highest.bidder);
        dispatchInventoryModify(highest.bidder, {
          [payToken]: { count: prevAmt }
        });
      }
    }

    // 6) 反延迟处理（anti-sniping）
    if ((auction.extension_seconds ?? 0) > 0) {
      const extSec = Number(auction.extension_seconds ?? 0);
      // 如果在拍卖结束前10分钟内出价，则延长拍卖结束时间
      const remainingMs = auction.end_at.getTime() - now.getTime();
      const triggerMs = 10 * 60 * 1000;
      if (remainingMs > 0 && remainingMs <= triggerMs) {
        const newEnd = new Date(auction.end_at.getTime() + extSec * 1000);
        await tx.auction.update({
          where: { uuid: auction.uuid },
          data: { end_at: newEnd, extended_until: newEnd },
        });
      }
    }

    // 7) 处理一口价（buyout）
    if (buyoutPrice != null && buyoutPrice > 0 && amountBig >= buyoutPrice) {
      // 立即结束并发起结算
      await tx.auction.update({
        where: { uuid: auction.uuid },
        data: {
          state: "ENDED",
          winner: input.bidder,
          final_price: amountBig,
        },
      });

      // 结算（在同一事务中进行）
      await settleAuctionInternal(tx, auction.uuid);
    }

    // 返回 DTO
    return {
      id: bidRow.id,
      auctionUuid: bidRow.auction_uuid,
      bidder: bidRow.bidder,
      amount: fromBigInt(bidRow.amount) ?? 0,
      maxProxy: fromBigInt(bidRow.max_proxy) ?? null,
      isProxy: bidRow.is_proxy,
      refunded: bidRow.refunded,
      extra: bidRow.extra ? JSON.parse(bidRow.extra) : null,
      createdAt: bidRow.created_at,
    } as AuctionBidDTO;
  });
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

/**
 * 取消拍卖（创建者或管理员调用）
 * - 退款所有未退款的出价与保证金
 */
export const cancelAuction = async (auctionUuid: string, byUserUuid: string) => {
  return await prisma.$transaction(async (tx) => {
    const auction = await tx.auction.findUnique({ where: { uuid: auctionUuid } });
    if (!auction) throw new Error("拍卖不存在");
    if (auction.state !== "OPEN") throw new Error("仅开放中的拍卖可取消");

    let actionUser = await prisma.user.findUnique({ where: { uuid: byUserUuid } });

    const bids = await tx.auctionBid.findMany({ where: { auction_uuid: auctionUuid, refunded: false } });

    if (!actionUser?.is_gm) {
      if (auction.creator != byUserUuid) {
        throw new Error("仅拍卖创建者可取消拍卖");
      }

      if (bids.length > 0) {
        throw new Error("已有出价的拍卖无法取消");
      }
    }

    // 标记取消
    await tx.auction.update({ where: { uuid: auctionUuid }, data: { state: "CANCELLED" } });

    if (auction.target_type === 'ITEM') {
      let count = Number(auction.target_count);
      let resourceId = auction.target_id

      if (count > 0) {
        await increaseItemCount(
          auction.creator,
          { [resourceId]: { count } },
          {
            type: ModifyItemCountType.Auction,
            showModifyInfo: true,
            actionName: "拍卖取消 - 返还拍卖物品",
          },
          tx
        );
        await invalidateInventoryCache(auction.creator);
        dispatchInventoryModify(auction.creator, {
          [resourceId]: { count },
        });
      }
    }

    // 退款未退款的出价
    // const payToken = auction.deposit_token ?? "gold";
    // for (const b of bids) {
    //   await tx.auctionBid.update({ where: { id: b.id }, data: { refunded: true } });
    //   const amt = fromBigInt(b.amount) ?? 0;
    //   if (amt > 0) {
    //     await increaseItemCount(
    //       b.bidder,
    //       { [payToken]: { count: amt } },
    //       {
    //         type: ModifyItemCountType.Auction,
    //         showModifyInfo: true,
    //         actionName: "拍卖取消 - 返还出价",
    //       },
    //       tx
    //     );
    //   }
    // }

    return { success: true };
  });
};