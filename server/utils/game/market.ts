import { Market, } from "~/generated/prisma";
import { BuyFromMarketInfo, ListToMarketInfo, MarkerTransactionInfo, MarketTradeInfo, RemoveFromMarketResult } from "~/shared/types/market";
import { v4 as uuidv4 } from "uuid";
import { decreaseItemCount, getInventoryInfo, getItemInfo, increaseItemCount } from "./characterInventory";
import { AllGameResourceID } from "~/shared/types/gameResource";
import { increaseCharacterStatusExp } from "./characterStatus";
import { BANNED_RESOURCE_IN_MARKET, BASE_MAX_SELLER_TRANSACTION_COUNT, BATCH_BUY_EVENT_LIMIT, BATCH_BUY_EVENT_WINDOW, BUY_MAX_COUNT, BUY_MIN_INTERVAL, BUY_WINDOW, BUYER_MARKET_RESALE_COOLDOWN_SECONDS, getBuyerMarketResaleCooldownSecondsRedisKey, getMarketResaleCooldownSecondsRedisKey, LIST_MIN_INTERVAL, MAX_SELLER_COUNT_IF_UNVERIFIED_EMAIL, MAX_SELLER_PRICE_IF_UNVERIFIED_EMAIL, MIN_LISTING_FEE, RESALE_COOLDOWN_SECONDS, SELLER_MARKET_FEE, SPECIAL_ITEM_20251202, TRADING_EXP_PER_GOLD_IN_MARKET } from "~/shared/data/constant";
import { getMarketListingLimits } from "~/server/utils/game/marketLimit";
import { prisma } from "./db";
import { allGameResource } from "~/shared/data/allGameResources";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { formatNumber, formatTime, formatTimeToStr, randomNumberInFullColseRange, safeJsonParse } from "~/shared/utils";
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

// 调价节流与冷却配置（单资源）
const PRICE_ADJUST_WINDOW_SECONDS = 30 * 60; // 30分钟窗口
const PRICE_ADJUST_THRESHOLD = 2; // 窗口内允许的调价次数
const PRICE_ADJUST_COOLDOWN_SECONDS = 60 * 60; // 触发后冷却60分钟

function getPriceAdjustCooldownKey(seller: string, resourceId: string) {
  return `market:price-adjust:cooldown:${seller}:${resourceId}`;
}

function getPriceAdjustHistoryKey(seller: string, resourceId: string) {
  return `market:price-adjust:history:${seller}:${resourceId}`;
}

async function enforcePriceAdjustCooldown(seller: string, resourceId: string) {
  const cooldownKey = getPriceAdjustCooldownKey(seller, resourceId);
  const ttl = await redisClient.ttl(cooldownKey);
  console.log('ttl', ttl)
  if (ttl && ttl > 0) {
    const minutes = Math.ceil(ttl / 60);
    throw new Error(`该资源调价过于频繁，请在${minutes}分钟后重试`);
  }

  const historyKey = getPriceAdjustHistoryKey(seller, resourceId);
  const nowMs = Date.now();
  const windowStartMs = nowMs - PRICE_ADJUST_WINDOW_SECONDS * 1000;

  // 清理窗口外记录 + 追加当前调价 + 取窗口内计数，全部在事务外完成
  const pipeline = redisClient.multi()
  pipeline.zRemRangeByScore(historyKey, 0, windowStartMs);
  pipeline.zAdd(historyKey, { score: nowMs, value: `${nowMs}` });
  pipeline.zCard(historyKey);
  pipeline.expire(historyKey, PRICE_ADJUST_WINDOW_SECONDS);
  const results = await pipeline.exec();
  const rawCard = results[2];
  // 兼容 ioredis 返回 [[null,res], ...] 或者 redis-mock 返回 [res,...]
  const count = Array.isArray(rawCard) ? (rawCard[1] ?? rawCard[0] ?? 0) : (rawCard ?? 0);

  if (count >= PRICE_ADJUST_THRESHOLD) {
    await redisClient.set(cooldownKey, "1", {
      expiration: { type: "EX", value: PRICE_ADJUST_COOLDOWN_SECONDS },
    });
  }
}

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
    // Lower price first; for same price, earlier create_time first
    orderBy: [
      { cost_per_unit: "asc" },
      { create_time: "asc" },
    ],
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
      value: 60 * 15 // 缓存10分钟
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
      value: 60 * 15, // 缓存10分钟
    }
  });

  return result;
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

export async function removeFromMarket(tradeUuid: string, actionUuid: string): Promise<RemoveFromMarketResult> {
  // 查找订单
  const marketOrder = await prisma.market.findUnique({
    where: { trade_uuid: tradeUuid },
  });

  if (!marketOrder) {
    throw new Error("Market order not found");
  }
  if (marketOrder.is_closed) {
    throw new Error("Market order is already closed");
  }

  // 上架后的5s内 无法下架
  const now = Date.now();
  const listedTime = marketOrder.create_time.getTime();
  if (now - listedTime < 10 * 1000) {
    throw new Error("上架后的10秒内无法下架，请稍后再试");
  }

  // 检查卖家是否是当前用户
  if (marketOrder.seller !== actionUuid) {
    throw new Error("You are not the seller of this market order");
  }

  let seller = await prisma.user.findUnique({
    where: { uuid: marketOrder.seller },
  })

  if (seller?.is_banned) {
    throw new Error("You are banned from the market");
  }

  if (seller?.accountPlayType == AccountPlayType.IRON) {
    throw new Error("硬核模式无法使用市场功能")
  }

  // 计算剩余未出售资源数量
  const remainCount = marketOrder.sell_resource_count - marketOrder.selled_resource_count;

  // 缓存失效
  await invalidateMarketCache(marketOrder.sell_resource_id);

  // 如果有剩余未出售资源，返还给卖家
  if (remainCount > 0) {
    await prisma.$transaction(async (tx) => {
      let latestOrder = await tx.market.findUnique({
        where: { trade_uuid: tradeUuid },
      })
      if (!latestOrder?.is_closed) {
        await increaseItemCount(marketOrder.seller, {
          [marketOrder.sell_resource_id]: { count: remainCount }
        }, {
          actionName: "市场订单下架",
          showModifyInfo: true,
          type: ModifyItemCountType.Market,
        }, tx);
        await invalidateInventoryCache(marketOrder.seller);
      }
      // 关闭订单
      await tx.market.update({
        where: { trade_uuid: tradeUuid },
        data: {
          is_closed: true,
          close_time: new Date(),
        },
      });
    })
  }

  return {
    tradeUuid: tradeUuid,
    sellResourceId: marketOrder.sell_resource_id as AllGameResourceID,
    sellResourceCount: marketOrder.sell_resource_count,
    remainResourceCount: remainCount,
  };
}


export async function listToMarket(info: ListToMarketInfo, seller: string): Promise<MarketTradeInfo> {
  // 上架频率检查
  const listIntervalKey = `market:list:interval:${seller}`;
  const now = Math.floor(Date.now() / 1000);

  const lastListTime = await redisClient.get(listIntervalKey);
  if (lastListTime && now - parseInt(lastListTime) < LIST_MIN_INTERVAL) {
    throw new Error("上架操作过于频繁，请等待几秒后再试");
  }
  await redisClient.set(listIntervalKey, now.toString(), {
    expiration: {
      type: 'EX',
      value: LIST_MIN_INTERVAL
    }
  });

  // 检查是否处于求购后转售冷却期
  const buyerMarketResaleKey = getBuyerMarketResaleCooldownSecondsRedisKey(seller, info.sellResourceId);
  const buyerMarketInCooldown = await redisClient.get(buyerMarketResaleKey);
  if (buyerMarketInCooldown) {
    throw new Error(`该资源在求购成功后的${BUYER_MARKET_RESALE_COOLDOWN_SECONDS / 60}分钟内不能用于上架`);
  }

  // 检查是否处于购买后转售冷却期
  const resaleKey = getMarketResaleCooldownSecondsRedisKey(seller, info.sellResourceId);
  const inCooldown = await redisClient.get(resaleKey);
  if (inCooldown) {
    throw new Error(`该资源在购买后的${RESALE_COOLDOWN_SECONDS / 60}分钟内不能用于上架`);
  }

  // 检查当前用户的上架上限（支持扩展）
  const limits = await getMarketListingLimits(seller);
  const existingOrdersCount = await prisma.market.count({
    where: {
      seller,
      is_closed: false,
    },
  });
  if (existingOrdersCount >= limits.maxSellerTransactions) {
    throw new Error(`已有${limits.maxSellerTransactions}条未完成的上架订单（含扩展），请先取消订单后再进行新的上架`);
  }

  const uuid = uuidv4();
  
  // 检查库存是否足够
  const item = await getItemInfo(seller, info.sellResourceId);

  if (!item || item.count < info.sellResourceCount) {
    throw new Error("Not enough resource in inventory to list");
  }

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

  if (!sellerUser.email_verified) {
    if (info.sellResourceCount > MAX_SELLER_COUNT_IF_UNVERIFIED_EMAIL) {
      throw new Error(`未验证邮箱的账号，上架订单的商品数量不能超过${MAX_SELLER_COUNT_IF_UNVERIFIED_EMAIL}个`);
    }
    if (info.costPerUnit > MAX_SELLER_PRICE_IF_UNVERIFIED_EMAIL) {
      throw new Error(`未验证邮箱的账号，上架订单的单价不能超过${MAX_SELLER_PRICE_IF_UNVERIFIED_EMAIL}金币`);
    }
  }

  // 新账号36小时内无法上架商品
  const accountAgeMs = Date.now() - sellerUser.create_date.getTime();
  if (accountAgeMs < 36 * 3600 * 1000) {
    throw new Error("新账号创建36小时内无法进行市场上架操作");
  }

  // 检查此玩家是同ip被ban的账号
  const bannedUser = await prisma.user.findFirst({
    where: {
      last_online_ip: sellerUser?.last_online_ip,
      pwd: sellerUser?.pwd,
      is_banned: true,
    },
  });
  if (bannedUser) {
    if (randomNumberInFullColseRange(0, 1) < 0.5) {
      throw new Error("请稍后重试")
    }
  }

  // 如果这个玩家已经对此物品进行过一次上架操作，则不允许再次上架
  const existingOrder = await prisma.market.findFirst({
    where: {
      seller,
      sell_resource_id: info.sellResourceId,
      cost_per_unit: {
        not: info.costPerUnit, // 允许同一物品不同价格上架
      },
      is_closed: false,
    },
  });
  if (existingOrder) {
    throw new Error("存在不同价格的上架订单，请先下架后再进行上架");
  }

  // 如果这个玩家对此物品有求购订单，则不允许再次上架
  const existingBuyOrder = await prisma.buyerMarket.findFirst({
    where: {
      buyer: seller,
      require_resource_id: info.sellResourceId,
      is_closed: false,
    },
  });
  if (existingBuyOrder) {
    throw new Error("存在未完成的求购订单，请先取消订单后再进行上架");
  }

  // 单资源调价冷却：30分钟内调价达到阈值，则触发60分钟冷却
  await enforcePriceAdjustCooldown(seller, info.sellResourceId);

  let inventory = await getInventoryInfoPreferCache(seller)

  // 库存不足，无法上架
  if (!inventory || !inventory[info.sellResourceId] || (inventory[info.sellResourceId]?.count ?? 0) < info.sellResourceCount) {
    throw new Error("库存不足，无法上架");
  }

  // let listingFee = Math.floor(info.sellResourceCount * info.costPerUnit * MARKET_LISTING_FEE_PERCENT);
  // listingFee = Math.max(listingFee, MIN_LISTING_FEE);

  // if ((inventory['gold']?.count ?? 0) < listingFee) {
  //   throw new Error("手续费不足，无法上架");
  // }

  // await decreaseItemCount(seller, {
  //   [info.costResourceId]: { count: listingFee }
  // }, {
  //   actionName: "市场上架手续费",
  //   showModifyInfo: true
  // });

  // 扣除库存并创建订单放到事务中，避免并发超限
  const tradeInfo = await prisma.$transaction(async (tx) => {
    // re-check limits inside tx
    const limitsTx = await getMarketListingLimits(seller);
    const existingOrdersCountTx = await (tx as any).market.count({ where: { seller, is_closed: false } });
    if (existingOrdersCountTx >= limitsTx.maxSellerTransactions) {
      throw new Error(`已有${limitsTx.maxSellerTransactions}条未完成的上架订单（含扩展），请先取消订单后再进行新的上架`);
    }

    await decreaseItemCount(seller, {
      [info.sellResourceId]: { count: info.sellResourceCount }
    }, {
      actionName: "市场上架资源",
      showModifyInfo: true,
      type: ModifyItemCountType.Market,
    }, tx as any);
    await invalidateInventoryCache(seller);

    const created = await (tx as any).market.create({
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
      }
    });

    return created;
  });

  // tradeLogger.info({
  //   userUuid: seller,
  //   action: "listToMarket",
  //   tradeUuid: tradeInfo.trade_uuid,
  //   sellerUuid: tradeInfo.seller,
  //   sellResourceId: tradeInfo.sell_resource_id as AllGameResourceID,
  //   sellResourceCount: tradeInfo.sell_resource_count,
  //   costResourceId: tradeInfo.cost_resource_id as AllGameResourceID,
  //   costPerUnit: tradeInfo.cost_per_unit,
  // })

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

export async function buyFromMarket(info: BuyFromMarketInfo): Promise<MarkerTransactionInfo> {
  const intervalKey = `market:buy:interval:${info.buyerUuid}`;
  const countKey = `market:buy:count:${info.buyerUuid}`;
  const now = Math.floor(Date.now() / 1000);

  const lastBuyTime = await redisClient.get(intervalKey);
  if (lastBuyTime && now - parseInt(lastBuyTime) < BUY_MIN_INTERVAL) {
    throw new Error("操作过于频繁，请稍后再试");
  }
  await redisClient.set(intervalKey, now.toString(), {
    expiration: {
      type: 'EX',
      value: BUY_MIN_INTERVAL // 设置过期时间为最小间隔
    }
  });

  // 检查短时间内购买次数
  const buyCount = await redisClient.incr(countKey);
  if (buyCount === 1) {
    await redisClient.expire(countKey, BUY_WINDOW);
  }
  if (buyCount > BUY_MAX_COUNT) {
    throw new Error("操作过于频繁，请稍后再试");
  }

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

  const thisResourceId = marketOrder.sell_resource_id;
  const resource = allGameResource[thisResourceId];

  if (!resource || resource.hideInMarket) {
    throw new Error("该资源无法购买");
  }

  const remainCount = marketOrder.sell_resource_count - marketOrder.selled_resource_count;
  if (info.buyCount > remainCount) {
    throw new Error("Not enough resource left to buy");
  }

  if (BANNED_RESOURCE_IN_MARKET.includes(marketOrder.sell_resource_id as any)) {
    throw new Error("Illegal sell resource id");
  }

  if (info.buyCount > 10000000) {
    throw new Error("Max buy count is 10000000");
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

  if (sellerUser?.last_online_ip == buyerUser?.last_online_ip
    && sellerUser?.last_online_fp == buyerUser?.last_online_fp) {
    throw new Error("交易失败(01)");
  }
  if (sellerUser?.last_online_ip == buyerUser?.last_online_ip
    && sellerUser?.pwd == buyerUser?.pwd
  ) {
    throw new Error("交易失败(02)");
  }

  if (sellerUser?.accountPlayType == AccountPlayType.IRON || buyerUser?.accountPlayType == AccountPlayType.IRON) {
    throw new Error("硬核模式无法使用市场功能")
  }

  if (!buyerUser?.email_verified) {
    if (marketOrder.cost_per_unit.toNumber() > MAX_SELLER_PRICE_IF_UNVERIFIED_EMAIL) {
      throw new Error(`未验证邮箱的账号，单次购买的物品单价不能超过${MAX_SELLER_PRICE_IF_UNVERIFIED_EMAIL}金币`);
    }
    if (info.buyCount > MAX_SELLER_COUNT_IF_UNVERIFIED_EMAIL) {
      throw new Error(`未验证邮箱的账号，单次购买的物品数量不能超过${MAX_SELLER_COUNT_IF_UNVERIFIED_EMAIL}个`);
    }
  }

  // 2. 检查买家是否有足够的支付资源
  const totalCost = marketOrder.cost_per_unit.toNumber() * info.buyCount;
  const buyerCostItem = await getItemInfo(info.buyerUuid, marketOrder.cost_resource_id as AllGameResourceID);
  if (!buyerCostItem || buyerCostItem.count < totalCost) {
    throw new Error("Buyer does not have enough resources to pay");
  }

  if (SPECIAL_ITEM_20251202.includes(marketOrder.sell_resource_id)) {
    const unlockDate = new Date('2025-12-01T10:00:00.000Z');
    if (new Date() < unlockDate) {
      throw new Error(`该资源在${formatTime(unlockDate)}后才可购买`);
    }
  }

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

    let buyRes = await prisma.$transaction(async (tx) => {
      // 3. 买家扣除支付资源
      await decreaseItemCount(
        info.buyerUuid,
        {
          [latestOrder.cost_resource_id]: { count: totalCost },
        },
        {
          actionName: `市场购买资源 ${resource.name}x${formatNumber(info.buyCount)}，单价${formatNumber(latestOrder.cost_per_unit.toNumber())}`,
          showModifyInfo: true,
          type: ModifyItemCountType.Market,
        },
        tx
      );
      buyerPaid = true;


      // 4. 卖家获得支付资源
      await increaseItemCount(
        marketOrder.seller,
        {
          [marketOrder.cost_resource_id]: { count: totalCost },
        },
        {
          actionName: `市场交易收入 ${resource.name}x${formatNumber(info.buyCount)}，单价${formatNumber(latestOrder.cost_per_unit.toNumber())}`,
          showModifyInfo: true,
          type: ModifyItemCountType.Market,
        },
        tx
      );
      sellerReceived = true;

      // 5. 卖家扣除成交市场税
      let fee = Math.ceil(totalCost * SELLER_MARKET_FEE);
      fee = Math.max(fee, MIN_LISTING_FEE);
      // 1金币的订单，不收税
      if (totalCost == 1) {
        fee = 0;
      }
      await decreaseItemCount(
        marketOrder.seller,
        {
          [marketOrder.cost_resource_id]: { count: fee },
        },
        {
          actionName: `订单成交手续费 ${SELLER_MARKET_FEE * 100}%，出售${
            resource.name
          }x${formatNumber(info.buyCount)}，单价${formatNumber(latestOrder.cost_per_unit.toNumber())}`,
          showModifyInfo: true,
          type: ModifyItemCountType.Market,
        },
        tx
      );

      // 5. 买家获得购买的资源
      await increaseItemCount(
        info.buyerUuid,
        {
          [marketOrder.sell_resource_id]: { count: info.buyCount },
        },
        {
          actionName: `市场购买资源 ${resource.name}x${formatNumber(info.buyCount)}，单价${formatNumber(latestOrder.cost_per_unit.toNumber())}`,
          showModifyInfo: true,
          type: ModifyItemCountType.Market,
        },
        tx
      );
      buyerReceived = true;

      await invalidateInventoryCache(info.buyerUuid);
      await invalidateInventoryCache(marketOrder.seller);

      // 6. 更新订单
      const newSelledCount = marketOrder.selled_resource_count + info.buyCount;
      const isClosed = newSelledCount >= marketOrder.sell_resource_count;

      const newTransactionData: Partial<Market> = {
        selled_resource_count: newSelledCount,
        is_closed: isClosed,
      };
      if (isClosed) {
        newTransactionData.close_time = new Date();
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
        data: newTransactionData,
      });

      // 给予双方交易经验
      await increaseCharacterStatusExp(updatedOrder.seller, [
        {
          status: "trading",
          increaseExp: totalCost * TRADING_EXP_PER_GOLD_IN_MARKET,
        },
      ]);
      await increaseCharacterStatusExp(info.buyerUuid, [
        {
          status: "trading",
          increaseExp: totalCost * TRADING_EXP_PER_GOLD_IN_MARKET,
        },
      ]);

      if (marketOrder) {
        await invalidateMarketCache(marketOrder.sell_resource_id);
      }

      const resourceBuyKey = `market:buy:resource:count:${info.buyerUuid}:${marketOrder.sell_resource_id}`;
      const resourceBuyCount = await redisClient.incr(resourceBuyKey);
      await redisClient.expire(resourceBuyKey, BATCH_BUY_EVENT_WINDOW);

      const SWEEP_THRESHOLD = Math.max(1, BATCH_BUY_EVENT_LIMIT - 1); // 达到阈值视为扫货行为
      console.log(SWEEP_THRESHOLD, resourceBuyCount);
      if (resourceBuyCount >= SWEEP_THRESHOLD) {
        const resaleKey = getMarketResaleCooldownSecondsRedisKey(
          info.buyerUuid,
          marketOrder.sell_resource_id
        );
        await redisClient.set(resaleKey, "1", {
          expiration: {
            type: "EX",
            value: RESALE_COOLDOWN_SECONDS,
          },
        });
      }

      return {
        tradeUuid: info.tradeUuid,
        sellerUuid: marketOrder.seller,
        buyerUuid: info.buyerUuid,
        tradeInfo: {
          id: updatedOrder.id,
          tradeUuid: updatedOrder.trade_uuid,
          seller: updatedOrder.seller,
          sellResourceId: updatedOrder.sell_resource_id as AllGameResourceID,
          sellResourceCount: updatedOrder.sell_resource_count,
          selledResourceCount: updatedOrder.selled_resource_count,
          costResourceId: updatedOrder.cost_resource_id as AllGameResourceID,
          costPerUnit: updatedOrder.cost_per_unit.toNumber(),
          buyerInfo: [],
          isClosed: updatedOrder.is_closed,
          createTime: updatedOrder.create_time,
          closeTime: updatedOrder.close_time ?? undefined,
        },
        buyCount: info.buyCount,
      };
    });

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

    // Record recent trade in Redis (by resource id with latest timestamp)
    try {
      const RECENT_TRADES_KEY = "market:recent:resources";
      const now = Date.now();
      const resourceId = buyRes.tradeInfo.sellResourceId;
      // Store latest timestamp for this resource (will update score if exists)
      try {
        await redisClient.zAdd(RECENT_TRADES_KEY, {
          score: now,
          value: resourceId,
        });
      } catch (e) {}
      // Trim to keep storage bounded (keep latest 1000 resources)
      try {
        await redisClient.zRemRangeByRank(RECENT_TRADES_KEY, 0, -1001);
      } catch (e) {}
    } catch (e) {
      // best-effort only
      console.warn("Failed to record recent trade to redis", e);
    }

    return buyRes;
  } catch (err) {
    // 补偿逻辑
    // 如果买家已扣除支付资源，则返还
    // if (buyerPaid) {
    //   await increaseItemCount(info.buyerUuid, {
    //     [marketOrder.cost_resource_id]: { count: totalCost }
    //   }, {
    //     actionName: "市场购买失败返还",
    //     showModifyInfo: true,
    //     type: ModifyItemCountType.Market,
    //   });
    // }
    // // 如果卖家已收到支付资源，则扣回
    // if (sellerReceived) {
    //   await decreaseItemCount(marketOrder.seller, {
    //     [marketOrder.cost_resource_id]: { count: totalCost }
    //   }, {
    //     actionName: "市场购买失败扣回",
    //     showModifyInfo: true,
    //     type: ModifyItemCountType.Market,
    //   });
    // }
    // // 如果买家已收到物品，则扣回
    // if (buyerReceived) {
    //   await decreaseItemCount(info.buyerUuid, {
    //     [marketOrder.sell_resource_id]: { count: info.buyCount }
    //   }, {
    //     actionName: "市场购买失败扣回",
    //     showModifyInfo: true,
    //     type: ModifyItemCountType.Market,
    //   });
    // }

    tradeLogger.error({
      userUuid: info.buyerUuid,
      action: "buyFromMarket",
      tradeUuid: info.tradeUuid,
      error: (err as any).message ?? "",
      sellResourceId: marketOrder.sell_resource_id as AllGameResourceID,
      sellResourceCount: marketOrder.sell_resource_count,
      costResourceId: marketOrder.cost_resource_id as AllGameResourceID,
      costPerUnit: marketOrder.cost_per_unit,
      buyCount: info.buyCount,
    });

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
    // id: order.id,
    tradeUuid: order.trade_uuid,
    // seller: order.seller,
    sellResourceId: order.sell_resource_id as AllGameResourceID,
    sellResourceCount: order.sell_resource_count,
    selledResourceCount: order.selled_resource_count,
    costResourceId: order.cost_resource_id as AllGameResourceID,
    costPerUnit: order.cost_per_unit,
    isClosed: order.is_closed,
    createTime: order.create_time,
    closeTime: order.close_time ?? undefined,
    // isPayListingFee: order.pay_listing_fee ?? false,
  }));
}
// ...existing code...