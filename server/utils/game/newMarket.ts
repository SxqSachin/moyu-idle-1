import { Prisma } from "@prisma/client";
import { getTransactionInfoList, getAllMarketResourceIds, getMarketListHistoryBySeller } from "./market";
import { getBuyerMarketTransactionInfoList, getAllBuyerMarketResourceIds, getBuyerMarketListHistoryByBuyer } from "./buyerMarket";
import type { BuyTradeRecord, MarketPriceData, MarketTradeInfo, SellTradeRecord, UnifiedMarketRow } from "~/shared/types/market";
import type { BuyerMarketTradeInfo } from "~/shared/types/buyerMarket";
import { prisma } from "./db";
import { redisClient } from '@/server/utils/index'
import { safeJsonParse } from "~/shared/utils";

/**
 * 查询某资源的所有市场挂单（卖方+买方），合并为统一结构
 */
export async function getUnifiedMarketRowsByResource(resourceId: string, requestUserUuid: string): Promise<UnifiedMarketRow[]> {
  // 并行查询
  const [sellList, buyList] = await Promise.all([
    getTransactionInfoList(resourceId),
    getBuyerMarketTransactionInfoList(resourceId),
  ]);
  const unified: UnifiedMarketRow[] = [
    // @ts-expect-error no buyer
    ...sellList.map((item: MarketTradeInfo) => { 
      let res = {...item, type: "sell" as const }

      if (res.seller != requestUserUuid) {
        // @ts-ignore
        delete res.seller;
      }

      return res;
    }),
    // @ts-expect-error no buyer
    ...buyList.map((item: BuyerMarketTradeInfo) => {
      let res = {
        ...item, type: "buy" as const
      }

      if (res.buyer != requestUserUuid) {
        // @ts-ignore
        delete res.buyer;
      }

      return res
    }),
  ];
  return unified;
}

/**
 * 查询所有有市场挂单的资源ID（卖方+买方，去重）
 */
export async function getAllUnifiedMarketResourceIds(): Promise<string[]> {
  const [sellIds, buyIds] = await Promise.all([
    getAllMarketResourceIds(),
    getAllBuyerMarketResourceIds(),
  ]);
  return Array.from(new Set([...sellIds, ...buyIds]));
}

/**
 * 查询某用户的所有市场历史（卖方+买方）
 */
type HistoryPageOpt = { page?: number; pageSize?: number };

export async function getUnifiedMarketHistoryByUser(
  userUuid: string,
  opt?: HistoryPageOpt & {
    type?: "sell" | "buy" | "all";
    status?: "open" | "closed" | "all";
    resourceId?: string;
    resourceIds?: string[];
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }
): Promise<{
  items: UnifiedMarketRow[];
  total: number;
  totalSell: number;
  totalBuy: number;
  openSellCount: number;
  openBuyCount: number;
  page: number;
  pageSize: number;
  type: "sell" | "buy" | "all";
}> {
  const page = Number.isFinite(opt?.page) ? Math.max(1, Math.floor(opt!.page!)) : 1;
  const pageSize = Number.isFinite(opt?.pageSize)
    ? Math.max(1, Math.min(100, Math.floor(opt!.pageSize!)))
    : 50;
  const offset = (page - 1) * pageSize;
  const type = opt?.type === "buy" ? "buy" : opt?.type === "all" ? "all" : "sell";
  const status = opt?.status === "open" || opt?.status === "closed" ? opt.status : "all";
  const resourceId = typeof opt?.resourceId === "string" && opt.resourceId.trim().length
    ? opt.resourceId.trim()
    : undefined;
  const resourceIds = Array.isArray(opt?.resourceIds)
    ? opt!.resourceIds!.filter((id) => typeof id === "string" && id.trim().length).map((id) => id.trim())
    : undefined;
  const sortOrder = opt?.sortOrder === "asc" ? "asc" : "desc";

  const sellSortMap: Record<string, keyof any> = {
    createTime: "create_time",
    closeTime: "close_time",
    costPerUnit: "cost_per_unit",
    sellResourceCount: "sell_resource_count",
    selledResourceCount: "selled_resource_count",
    revenue: "revenue", // special handled
  };
  const buySortMap: Record<string, keyof any> = {
    createTime: "create_time",
    closeTime: "close_time",
    payPerUnit: "pay_per_unit",
    requireResourceCount: "require_resource_count",
    doneResourceCount: "done_resource_count",
  };

  const sellSortBy = sellSortMap[opt?.sortBy ?? ""] || "create_time";
  const buySortBy = buySortMap[opt?.sortBy ?? ""] || "create_time";

  const baseSellWhere: any = { seller: userUuid };
  const baseBuyWhere: any = { buyer: userUuid };
  if (status !== "all") {
    baseSellWhere.is_closed = status === "closed";
    baseBuyWhere.is_closed = status === "closed";
  }
  if (resourceIds?.length) {
    baseSellWhere.sell_resource_id = { in: resourceIds };
    baseBuyWhere.require_resource_id = { in: resourceIds };
  } else if (resourceId) {
    baseSellWhere.sell_resource_id = resourceId;
    baseBuyWhere.require_resource_id = resourceId;
  }

  const [totalSell, totalBuy, openSellCount, openBuyCount] = await Promise.all([
    prisma.market.count({ where: baseSellWhere }),
    prisma.buyerMarket.count({ where: baseBuyWhere }),
    prisma.market.count({ where: { seller: userUuid, is_closed: false } }),
    prisma.buyerMarket.count({ where: { buyer: userUuid, is_closed: false } }),
  ]);

  const items: UnifiedMarketRow[] = [];

  const shouldQuerySell = type === "sell" || type === "all";
  const shouldQueryBuy = type === "buy" || type === "all";

  if (shouldQuerySell) {
    const sellOrderBy = (() => {
      const dir = sortOrder === "asc" ? "asc" : "desc";
      if (sellSortBy === "create_time") return [{ create_time: dir }];
      if (sellSortBy === "close_time") return [{ close_time: dir }, { create_time: "desc" as const }];
      if (sellSortBy === "cost_per_unit") return [{ cost_per_unit: dir }, { create_time: "desc" as const }];
      if (sellSortBy === "sell_resource_count") return [{ sell_resource_count: dir }, { create_time: "desc" as const }];
      if (sellSortBy === "selled_resource_count") return [{ selled_resource_count: dir }, { create_time: "desc" as const }];
      if (sellSortBy === "revenue") {
        // Prisma 不支持直接按计算列排序，这里退化为成本单价与已售数量的复合排序，保证稳定性再按创建时间降序兜底。
        return [
          { cost_per_unit: dir },
          { selled_resource_count: dir },
          { create_time: "desc" as const },
        ];
      }
      return [{ create_time: "desc" as const }];
    })();

    const sellRows = await prisma.market.findMany({
      where: baseSellWhere,
      orderBy: sellOrderBy as any,
      skip: offset,
      take: pageSize,
      select: {
        id: true,
        trade_uuid: true,
        sell_resource_id: true,
        sell_resource_count: true,
        selled_resource_count: true,
        cost_resource_id: true,
        cost_per_unit: true,
        is_closed: true,
        create_time: true,
        close_time: true,
      },
    });

    for (const order of sellRows) {
      items.push({
        id: order.id,
        tradeUuid: order.trade_uuid,
        sellResourceId: order.sell_resource_id,
        sellResourceCount: order.sell_resource_count,
        selledResourceCount: order.selled_resource_count,
        costResourceId: order.cost_resource_id,
        costPerUnit:
          typeof order.cost_per_unit?.toNumber === "function"
            ? order.cost_per_unit.toNumber()
            : Number(order.cost_per_unit ?? 0),
        isClosed: !!order.is_closed,
        createTime: order.create_time,
        closeTime: order.close_time ?? undefined,
        type: "sell" as const,
        seller: userUuid,
        buyerInfo: [] as any,
      });
    }
  }

  if (shouldQueryBuy) {
    const buyOrderBy = { [buySortBy]: sortOrder } as any;
    const buyHistory = await prisma.buyerMarket.findMany({
      where: baseBuyWhere,
      orderBy: buyOrderBy,
      skip: offset,
      take: pageSize,
      select: {
        id: true,
        trade_uuid: true,
        require_resource_id: true,
        require_resource_count: true,
        done_resource_count: true,
        pay_resource_id: true,
        pay_per_unit: true,
        is_closed: true,
        create_time: true,
        close_time: true,
      },
    });

    for (const order of buyHistory) {
      items.push({
        id: order.id,
        tradeUuid: order.trade_uuid,
        requireResourceId: order.require_resource_id,
        requireResourceCount: order.require_resource_count,
        doneResourceCount: order.done_resource_count,
        payResourceId: order.pay_resource_id,
        payPerUnit:
          typeof order.pay_per_unit?.toNumber === "function"
            ? order.pay_per_unit.toNumber()
            : Number(order.pay_per_unit ?? 0),
        isClosed: order.is_closed,
        createTime: order.create_time,
        closeTime: order.close_time ?? undefined,
        type: "buy" as const,
        buyer: userUuid,
        // sellerInfo: [] as any,
      });
    }
  }

  return {
    items,
    total: type === "sell" ? totalSell : type === "buy" ? totalBuy : totalSell + totalBuy,
    totalSell,
    totalBuy,
    openSellCount,
    openBuyCount,
    page,
    pageSize,
    type,
  };
}

export async function getRecentCompletedPricesByResource(resourceId: string): Promise<MarketPriceData['recentPrices']> {
  try {
    // 并行查询卖单和买单的成交记录
    const [completedSellOrders] = await Promise.all([
      // 查询卖单：至少成交1单的订单
      prisma.market.findMany({
        where: {
          sell_resource_id: resourceId,
          selled_resource_count: {
            gt: 0 // 至少成交1单
          }
        },
        select: {
          cost_per_unit: true,
          selled_resource_count: true,
          buyer_info: true, // JSON 数组，包含每笔交易信息
        },
        orderBy: {
          create_time: 'desc' // 按创建时间降序
        },
        take: 50 // 取更多数据，因为要从中提取单笔交易
      }),

      // 查询买单：至少成交1单的订单
      // prisma.buyerMarket.findMany({
      //   where: {
      //     require_resource_id: resourceId,
      //     done_resource_count: {
      //       gt: 0 // 至少成交1单
      //     }
      //   },
      //   select: {
      //     pay_per_unit: true,
      //     done_resource_count: true,
      //     seller_info: true, // JSON 数组，包含每笔交易信息
      //   },
      //   orderBy: {
      //     create_time: 'desc' // 按创建时间降序
      //   },
      //   take: 50 // 取更多数据，因为要从中提取单笔交易
      // })
    ]);

    // 处理卖单数据，提取每笔真实交易
    const sellTrades: MarketPriceData['recentPrices']['sellOrders'] = []

    for (const order of completedSellOrders) {
        const buyerInfo: SellTradeRecord[] = Array.isArray(order.buyer_info)
          ? order.buyer_info
          : safeJsonParse(order.buyer_info, [])
        
        // 从 buyer_info 中提取每笔交易
        for (const trade of buyerInfo as SellTradeRecord[]) {
          sellTrades.push({
            costPerUnit: order.cost_per_unit.toNumber(),
            count: trade.count,
            date: new Date(trade.time)
          });
        }
    }

    // 处理买单数据，提取每笔真实交易
    const buyTrades: MarketPriceData['recentPrices']['buyOrders'] = []
    // for (const order of completedBuyOrders) {
    //     const sellerInfo = Array.isArray(order.seller_info) 
    //     ? order.seller_info 
    //     : safeJsonParse(order.seller_info, [])
        
    //     // 从 seller_info 中提取每笔交易
    //     for (const trade of sellerInfo as BuyTradeRecord[]) {
    //       buyTrades.push({
    //         payPerUnit: order.pay_per_unit,
    //         count: trade.count,
    //         date: new Date(trade.time)
    //       });
    //     }
    // }

    // 按时间排序，保留全部成交记录供玩家监督
    const recentSellTrades = sellTrades
      .sort((a, b) => b.date.getTime() - a.date.getTime())

    const recentBuyTrades = buyTrades
      .sort((a, b) => b.date.getTime() - a.date.getTime())

    return {
      sellOrders: recentSellTrades,
      buyOrders: recentBuyTrades,
    };

  } catch (error) {
    console.error(`获取物品 ${resourceId} 的成交价格失败:`, error);
    throw new Error(`Failed to get completed prices for resource: ${resourceId}`);
  }
}

/*
 * 获取指定物品的简化价格统计
 * @param resourceId 物品ID
 * @returns 价格统计数据
 */
export async function getPriceStatsByResource(resourceId: string): Promise<{
  sellPrices: {
    latest: number | null;      // 最新成交价
    average: number | null;     // 平均成交价
    min: number | null;         // 最低成交价
    max: number | null;         // 最高成交价
    count: number;              // 成交订单数
  };
  buyPrices: {
    latest: number | null;      // 最新成交价
    average: number | null;     // 平均成交价
    min: number | null;         // 最低成交价
    max: number | null;         // 最高成交价
    count: number;              // 成交订单数
  };
}> {
  try {
    const priceData = await getRecentCompletedPricesByResource(resourceId);

    // 计算卖单价格统计
    const sellPrices = priceData.sellOrders.map(order => order.costPerUnit);
    const buyPrices = priceData.buyOrders.map(order => order.payPerUnit);

    return {
      sellPrices: {
        latest: sellPrices.length > 0 ? sellPrices[0] : null,
        average: sellPrices.length > 0 ? 
          Math.round(sellPrices.reduce((sum, price) => sum + price, 0) / sellPrices.length) : null,
        min: sellPrices.length > 0 ? Math.min(...sellPrices) : null,
        max: sellPrices.length > 0 ? Math.max(...sellPrices) : null,
        count: sellPrices.length
      },
      buyPrices: {
        latest: buyPrices.length > 0 ? buyPrices[0] : null,
        average: buyPrices.length > 0 ? 
          Math.round(buyPrices.reduce((sum, price) => sum + price, 0) / buyPrices.length) : null,
        min: buyPrices.length > 0 ? Math.min(...buyPrices) : null,
        max: buyPrices.length > 0 ? Math.max(...buyPrices) : null,
        count: buyPrices.length
      }
    };

  } catch (error) {
    console.error(`获取物品 ${resourceId} 的价格统计失败:`, error);
    throw new Error(`Failed to get price stats for resource: ${resourceId}`);
  }
}

/**
 * 获取最近有成交记录的资源ID列表（按时间降序，去重）
 * 该接口用于首页显示最近发生交易的商品列表
 */
export async function getRecentTradedResourceIds(limit = 20): Promise<string[]> {
  const RECENT_TRADES_KEY = 'market:recent:resources';
  try {
    // Try to read per-resource latest-trade zset (descending)
    const recentRaw = await redisClient.zRange(RECENT_TRADES_KEY, 0, Math.max(0, limit - 1), { REV: true });
    const recent = Array.isArray(recentRaw) ? recentRaw as string[] : [];
    if (recent.length > 0) {
      return recent.slice(0, limit);
    }
  } catch (e) {
    // silent fallback to DB
    console.warn('getRecentTradedResourceIds: redis read failed, fallback to db', e);
  }

  // Fallback: scan DB for recent trades (existing slower implementation)
  try {
    // 查询卖方已成交的订单，按最近成交时间/关闭时间排序
    const sellOrders = await prisma.market.findMany({
      where: { selled_resource_count: { gt: 0 } },
      select: { sell_resource_id: true, close_time: true, create_time: true, id: true },
      orderBy: { close_time: 'desc' },
      take: Math.max(limit * 3, 50),
    });

    const ids: string[] = [];
    for (const o of sellOrders) {
      if (!ids.includes(o.sell_resource_id)) {
        ids.push(o.sell_resource_id);
        if (ids.length >= limit) break;
      }
    }

    if (ids.length < limit) {
      // 补充买方市场的成交资源（如果存在）
      const buyerOrders = await prisma.buyerMarket.findMany({
        where: { done_resource_count: { gt: 0 } },
        select: { require_resource_id: true, close_time: true, create_time: true },
        orderBy: { close_time: 'desc' },
        take: Math.max(limit * 3, 50),
      });

      for (const o of buyerOrders) {
        if (!ids.includes(o.require_resource_id)) {
          ids.push(o.require_resource_id);
          if (ids.length >= limit) break;
        }
      }
    }

    return ids.slice(0, limit);
  } catch (e) {
    console.error(`getRecentTradedResourceIds error:`, e);
    throw e;
  }
}