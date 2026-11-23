import type { Market, } from "~/generated/prisma";
import type { BuyFromMarketInfo, ListToMarketInfo, MarkerTransactionInfo, MarketTradeInfo, RemoveFromMarketResult } from "~/shared/types/market";
import { v4 as uuidv4 } from "uuid";
import { decreaseItemCount, getInventoryInfo, getItemInfo, increaseItemCount, invalidateInventoryCache } from "./characterInventory";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import { increaseCharacterStatusExp } from "./characterStatus";
import { BANNED_RESOURCE_IN_MARKET, BATCH_BUY_EVENT_LIMIT, BATCH_BUY_EVENT_WINDOW, BUY_MAX_COUNT, BUY_MIN_INTERVAL, BUY_WINDOW, BUYER_MARKET_RESALE_COOLDOWN_SECONDS, getBuyerMarketResaleCooldownSecondsRedisKey, getMarketResaleCooldownSecondsRedisKey, LIST_MIN_INTERVAL, MIN_LISTING_FEE, RESALE_COOLDOWN_SECONDS, SELLER_MARKET_FEE, TRADING_EXP_PER_GOLD_IN_MARKET } from "~/shared/data/constant";
import { prisma } from "../prisma";
import { redisClient } from "../redis";
import { allGameResource } from "~/shared/data/allGameResources";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { randomNumberInFullColseRange, safeJsonParse } from "~/shared/utils";
import { AccountPlayType } from "~/shared/types/account";

// 缓存key生成方法
function getMarketTransactionListCacheKey(resourceId: string) {
  return `market:transaction:list:${resourceId}`;
}
function getMarketResourceIdsCacheKey() {
  return `market:resource:ids`;
}

// 用于记录所有已缓存的resourceId，方便批量失效
const MARKET_CACHE_RESOURCE_SET_KEY = "market:cache:resource:set";

export async function getTransactionInfoList(resourceId: string): Promise<Omit<MarketTradeInfo, 'buyerInfo'>[]> {
  const cacheKey = getMarketTransactionListCacheKey(resourceId);
  const cache = await redisClient.get(cacheKey);
  if (cache) {
    return JSON.parse(cache);
  }

  const orders = await prisma.market.findMany({
    where: {
      is_closed: false,
      sell_resource_id: resourceId,
    },
    orderBy: { cost_per_unit: "asc" },
  });

  const result = orders.map(order => ({
    id: order.id,
    tradeUuid: order.trade_uuid,
    seller: order.seller,
    sellResourceId: order.sell_resource_id as AllGameResourceID,
    sellResourceCount: order.sell_resource_count,
    selledResourceCount: order.selled_resource_count,
    costResourceId: order.cost_resource_id as AllGameResourceID,
    costPerUnit: order.cost_per_unit.toNumber(),
    isClosed: order.is_closed,
    createTime: order.create_time,
    closeTime: order.close_time ?? undefined,
    isPayListingFee: order.pay_listing_fee ?? false,
  }));

  await redisClient.set(cacheKey, JSON.stringify(result), {
    expiration: {
      type: 'EX',
      value: 30 // 缓存30秒
    }
  });
  // 记录已缓存的resourceId
  await redisClient.SADD(MARKET_CACHE_RESOURCE_SET_KEY, resourceId);

  return result;
}

export async function getAllMarketResourceIds(): Promise<string[]> {
  const cacheKey = getMarketResourceIdsCacheKey();
  const cache = await redisClient.get(cacheKey);
  if (cache) {
    return JSON.parse(cache);
  }

  const orders = await prisma.market.findMany({
    where: {
      is_closed: false
    },
    select: {
      sell_resource_id: true
    }
  });
  const idSet = new Set<string>();
  for (const order of orders) {
    idSet.add(order.sell_resource_id);
  }
  const result = Array.from(idSet);

  await redisClient.set(cacheKey, JSON.stringify(result), {
    expiration: {
      type: 'EX',
      value: 30 // 缓存30秒
    }
  });

  return result;
}

/**
 * 返回当前市场中未关闭订单数超过 minOrders 的资源 id 列表。
 * 直接使用 SQL GROUP BY ... HAVING 来在数据库层面完成聚合，避免将所有订单拉到应用层。
 *
 * @param minOrders 最小未关闭订单数量阈值（默认为 6）
 */
export async function getHotMarketResourceIds(minOrders = 6): Promise<string[]> {
  // 使用 prisma.groupBy 在数据库层进行聚合查询
  const groups = await prisma.market.groupBy({
    by: ['sell_resource_id'],
    where: { is_closed: false },
    _count: {
      sell_resource_id: true,
    },
  });

  // 过滤出 count > minOrders
  const hot = groups.filter(g => (g._count?.sell_resource_id ?? 0) > minOrders).map(g => g.sell_resource_id);
  return hot;
}

export async function invalidateMarketCache(resourceId?: string) {
  // 删除所有已缓存的resourceId对应的市场列表缓存
  const resourceIds: string[] = await redisClient.SMEMBERS(MARKET_CACHE_RESOURCE_SET_KEY);
  if (resourceIds && resourceIds.length > 0) {
    const keys = resourceIds.map(id => getMarketTransactionListCacheKey(id));
    if (keys.length > 0) {
      for(const key of keys) {
        await redisClient.del(key);
      }
    }
    await redisClient.del(MARKET_CACHE_RESOURCE_SET_KEY);
  }
  // 删除资源ID列表缓存
  await redisClient.del(getMarketResourceIdsCacheKey());
  // 如果传入resourceId，单独删除
  if (resourceId) {
    await redisClient.del(getMarketTransactionListCacheKey(resourceId));
  }
}

// gm专用上架，跳过了很多检查
export async function gmListToMarket(info: ListToMarketInfo, seller: string): Promise<MarketTradeInfo> {
  const uuid = uuidv4();

  if (BANNED_RESOURCE_IN_MARKET.includes(info.sellResourceId)) {
    throw new Error("Illegal sell resource id");
  }

  if (('' + info.costPerUnit).includes('8964')) {
    throw new Error("Illegal cost");
  }

  // if (!BANNED_RESOURCE_IN_MARKET.includes(info.costResourceId)) {
  //   throw new Error("Illegal resource id");
  // }

  if (info.costPerUnit <= 0) {
    throw new Error("Illegal cost resource cost");
  }

  if (info.costPerUnit > 10000000000) {
    throw new Error("Max cost is 10000000000");
  }

  if (info.sellResourceCount <= 0) {
    throw new Error("Illegal resource sell count");
  }

  if (info.sellResourceCount > 10000000) {
    throw new Error("Max sell price is 10000000");
  }

  if (allGameResource[info.sellResourceId].hideInMarket) {
    throw new Error("该资源无法上架");
  }

  // 对数量和价格进行检查，必须为非负数整数，不包含非数字内容，否则报错
  if (typeof info.sellResourceCount !== 'number' || isNaN(info.sellResourceCount) || !Number.isInteger(info.sellResourceCount) || info.sellResourceCount < 0) {
    throw new Error("Invalid sell resource count");
  }
  if (typeof info.costPerUnit !== 'number' || isNaN(info.costPerUnit) || !Number.isInteger(info.costPerUnit) || info.costPerUnit < 0) {
    throw new Error("Invalid cost per unit");
  }

  // 如果库存数量不是正整数,也报错
  if (info.sellResourceCount <= 0 || !Number.isInteger(info.sellResourceCount)) {
    throw new Error("Invalid sell resource count");
  }

  let sellerUser = await prisma.user.findUnique({
    where: { uuid: seller },
  })

  if (!sellerUser) {
    throw new Error("User not found");
  }

  if (sellerUser?.is_banned) {
    throw new Error("You are banned from the market");
  }

  if (sellerUser?.accountPlayType == AccountPlayType.IRON) {
    throw new Error("硬核模式无法使用市场功能")
  }

  let tradeInfo = await prisma.market.create({
    data: {
      trade_uuid: uuid,
      seller,
      sell_resource_id: info.sellResourceId,
      sell_resource_count: info.sellResourceCount,
      selled_resource_count: 0,
      cost_resource_id: info.costResourceId,
      cost_per_unit: info.costPerUnit,
      is_closed: false,
      create_time: new Date(),
      // pay_listing_fee: true
      // buyer_info 可选，按需添加
    },
  });

  // 缓存失效
  await invalidateMarketCache(info.sellResourceId);

  return {
    id: tradeInfo.id,
    tradeUuid: tradeInfo.trade_uuid,
    seller: tradeInfo.seller,
    sellResourceId: tradeInfo.sell_resource_id as AllGameResourceID,
    sellResourceCount: tradeInfo.sell_resource_count,
    selledResourceCount: tradeInfo.selled_resource_count,
    costResourceId: tradeInfo.cost_resource_id as AllGameResourceID,
    costPerUnit: tradeInfo.cost_per_unit.toNumber(),
    buyerInfo: [],
    isClosed: tradeInfo.is_closed,
    createTime: tradeInfo.create_time,
    closeTime: tradeInfo.close_time ?? undefined,
  };
}

export async function gmBuyFromMarket(info: BuyFromMarketInfo) {
  // 对金额与数量进行检查，必须为非负数整数，不包含非数字内容，否则报错
  if (typeof info.buyCount !== 'number' || isNaN(info.buyCount) || !Number.isInteger(info.buyCount) || info.buyCount < 0) {
    throw new Error("Invalid buy count");
  }

  // ----------- 加锁开始 -----------
  const lockKey = `market:lock:${info.tradeUuid}`;
  const lockValue = `${info.buyerUuid}_${Date.now()}`;
  const lockExpire = 5000; // ms
  const acquired = await redisClient.set(lockKey, lockValue, { NX: true, PX: lockExpire });
  if (!acquired) {
    throw new Error("该资源正在被购买，请稍后重试");
  }
  // ----------- 加锁结束 -----------


  // 1. 查找订单
  const marketOrder = await prisma.market.findUnique({
    where: { trade_uuid: info.tradeUuid },
  });

  if (!marketOrder) {
    throw new Error("Market order not found");
  }
  if (marketOrder.is_closed) {
    throw new Error("Market order is closed");
  }

  const remainCount = marketOrder.sell_resource_count - marketOrder.selled_resource_count;
  if (info.buyCount > remainCount) {
    throw new Error("Not enough resource left to buy");
  }

  if (BANNED_RESOURCE_IN_MARKET.includes(marketOrder.sell_resource_id as any)) {
    throw new Error("Illegal sell resource id");
  }

  if (info.buyCount > 1000000) {
    throw new Error("Max buy count is 1000000");
  }

  if (info.buyCount <= 0) {
    throw new Error("Illegal buy count");
  }

  // 检查购买的数量是否为整数
  if (typeof info.buyCount !== 'number' || isNaN(info.buyCount) || !Number.isInteger(info.buyCount) || info.buyCount < 0) {
    throw new Error("Invalid buy count");
  }

  let sellerUser = await prisma.user.findUnique({
    where: { uuid: marketOrder.seller},
  })

  if (sellerUser?.is_banned) {
    throw new Error("Seller is banned from the market");
  }

  let buyerUser = await prisma.user.findUnique({
    where: { uuid: info.buyerUuid },
  })

  // 2. 检查买家是否有足够的支付资源
  const totalCost = marketOrder.cost_per_unit.toNumber() * info.buyCount;

  // 边界检查和补偿机制
  let buyerPaid = false;
  let sellerReceived = false;
  let buyerReceived = false;

  try {
    let latestOrder = await prisma.market.findUnique({
      where: { trade_uuid: info.tradeUuid },
    });

    if (!latestOrder || latestOrder?.is_closed) {
      throw new Error("Market order is already closed");
    }

    const thisResource = allGameResource[latestOrder.sell_resource_id];
    if (!thisResource || thisResource.hideInMarket) {
      throw new Error("该资源无法交易");
    }

    let buyRes = await prisma.$transaction(async (tx) => {
      // 4. 卖家获得支付资源
      await increaseItemCount(marketOrder.seller, {
        [marketOrder.cost_resource_id]: { count: totalCost }
      }, {
        actionName: `市场交易收入 ${thisResource.name}x${info.buyCount}，单价${latestOrder.cost_per_unit}`,
        showModifyInfo: true,
        type: ModifyItemCountType.Market,
      }, tx);
      sellerReceived = true;

      // 5. 卖家扣除成交市场税
      let fee = Math.ceil(totalCost * SELLER_MARKET_FEE);
      fee = Math.max(fee, MIN_LISTING_FEE);
      // 1金币的订单，不收税
      if (totalCost == 1) {
        fee = 0
      }
      await decreaseItemCount(marketOrder.seller, {
        [marketOrder.cost_resource_id]: { count: fee }
      }, {
        actionName: `订单成交手续费 ${SELLER_MARKET_FEE * 100}%，出售${thisResource.name}x${info.buyCount}，单价${latestOrder.cost_per_unit}`,
        showModifyInfo: true,
        type: ModifyItemCountType.Market,
      }, tx);

      await invalidateInventoryCache(marketOrder.seller);

      // 6. 更新订单
      const newSelledCount = marketOrder.selled_resource_count + info.buyCount;
      const isClosed = newSelledCount >= marketOrder.sell_resource_count;

      const newTransactionData: Partial<Market> = {
        selled_resource_count: newSelledCount,
        is_closed: isClosed,
      }
      if (isClosed) {
        newTransactionData.close_time = new Date()
      }

      let oriBuyerInfo: any[] = safeJsonParse(marketOrder.buyer_info, []) ?? [];
      if (!oriBuyerInfo || !Array.isArray(oriBuyerInfo)) {
        oriBuyerInfo = [];
      }
      // 添加买家信息
      oriBuyerInfo.push({
        buyer: info.buyerUuid,
        count: info.buyCount,
        time: new Date(),
      });
      newTransactionData.buyer_info = JSON.stringify(oriBuyerInfo);

      const updatedOrder = await tx.market.update({
        where: { trade_uuid: info.tradeUuid },
        data: newTransactionData
      });

      // 给予双方交易经验
      await increaseCharacterStatusExp(updatedOrder.seller, [
        {
          status: 'trading',
          increaseExp: totalCost * TRADING_EXP_PER_GOLD_IN_MARKET
        }
      ])

      if (marketOrder) {
        await invalidateMarketCache(marketOrder.sell_resource_id);
      }
    })

    // tradeLogger.info({
    //   userUuid: marketOrder.seller,
    //   action: "buyFromMarket",
    //   tradeUuid: info.tradeUuid,
    //   sellerUuid: marketOrder.seller,
    //   buyerUuid: info.buyerUuid,
    //   sellResourceId: marketOrder.sell_resource_id as AllGameResourceID,
    //   sellResourceCount: marketOrder.sell_resource_count,
    //   selledResourceCount: updatedOrder.selled_resource_count,
    //   costResourceId: marketOrder.cost_resource_id as AllGameResourceID,
    //   costPerUnit: marketOrder.cost_per_unit,
    //   buyCount: info.buyCount,
    // });

  } catch (err) {
    throw err;
  } finally {
    // 只释放自己的锁
    const currentValue = await redisClient.get(lockKey);
    if (currentValue === lockValue) {
      await redisClient.del(lockKey);
    }
  }
}

export async function getMarketListHistoryBySeller(sellerUuid: string) {
  const orders = await prisma.market.findMany({
    where: { seller: sellerUuid },
    orderBy: { create_time: "desc" },
  });

  return orders.map(order => ({
    id: order.id,
    tradeUuid: order.trade_uuid,
    seller: order.seller,
    sellResourceId: order.sell_resource_id as AllGameResourceID,
    sellResourceCount: order.sell_resource_count,
    selledResourceCount: order.selled_resource_count,
    costResourceId: order.cost_resource_id as AllGameResourceID,
    costPerUnit: order.cost_per_unit,
    isClosed: order.is_closed,
    createTime: order.create_time,
    closeTime: order.close_time ?? undefined,
    isPayListingFee: order.pay_listing_fee ?? false,
  }));
}
// ...existing code...