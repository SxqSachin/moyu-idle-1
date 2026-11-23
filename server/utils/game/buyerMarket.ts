import { BuyerMarket, PrismaClient } from "~/generated/prisma";
import { ListToBuyerMarketInfo, RemoveFromBuyerMarketResult, SellToBuyerMarketInfo, MarkerTransactionInfo, BuyerMarketTradeInfo } from "~/shared/types/buyerMarket";
import { v4 as uuidv4 } from "uuid";
import { decreaseItemCount, getItemInfo, increaseItemCount } from "./characterInventory";
import { AllGameResourceID } from "~/shared/types/gameResource";
import { prisma } from "./db";
import { BASE_MAX_BUYER_TRANSACTION_COUNT, BUYER_MARKET_FEE, BUYER_MARKET_RESALE_COOLDOWN_SECONDS, getBuyerMarketResaleCooldownSecondsRedisKey, getMarketResaleCooldownSecondsRedisKey, MAX_BUYER_COUNT_IF_UNVERIFIED_EMAIL, MAX_BUYER_PRICE_IF_UNVERIFIED_EMAIL, RESALE_COOLDOWN_SECONDS, SPECIAL_ITEM_20251202 } from "~/shared/data/constant";
import { getMarketListingLimits } from "~/server/utils/game/marketLimit";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { formatNumber, formatTime, randomNumberInFullColseRange, safeJsonParse } from "~/shared/utils";
import { AccountPlayType } from "~/shared/types/account";
import { allGameResource } from "~/shared/data/allGameResources";

// 缓存key生成方法
function getBuyerMarketTransactionListCacheKey(resourceId: string) {
  return `buyerMarket:transaction:list:${resourceId}`;
}
function getBuyerMarketResourceIdsCacheKey() {
  return `buyerMarket:resource:ids`;
}

const BUYER_MARKET_CACHE_RESOURCE_SET_KEY = "buyerMarket:cache:resource:set";

// 买方市场调价节流与冷却配置（单资源）
const BUYER_PRICE_ADJUST_WINDOW_SECONDS = 30 * 60; // 30分钟窗口
const BUYER_PRICE_ADJUST_THRESHOLD = 2; // 窗口内允许的调价次数
const BUYER_PRICE_ADJUST_COOLDOWN_SECONDS = 60 * 60; // 触发后冷却60分钟

function getBuyerPriceAdjustCooldownKey(buyer: string, resourceId: string) {
  return `buyerMarket:price-adjust:cooldown:${buyer}:${resourceId}`;
}

function getBuyerPriceAdjustHistoryKey(buyer: string, resourceId: string) {
  return `buyerMarket:price-adjust:history:${buyer}:${resourceId}`;
}

async function enforceBuyerPriceAdjustCooldown(buyer: string, resourceId: string) {
  const cooldownKey = getBuyerPriceAdjustCooldownKey(buyer, resourceId);
  const ttl = await redisClient.ttl(cooldownKey);
  if (ttl && ttl > 0) {
    const minutes = Math.ceil(ttl / 60);
    throw new Error(`该资源求购调价过于频繁，请在${minutes}分钟后重试`);
  }

  const historyKey = getBuyerPriceAdjustHistoryKey(buyer, resourceId);
  const nowMs = Date.now();
  const windowStartMs = nowMs - BUYER_PRICE_ADJUST_WINDOW_SECONDS * 1000;

  // 清理窗口外记录 + 追加当前调价 + 统计窗口内数量
  const pipeline = redisClient.multi();
  pipeline.zRemRangeByScore(historyKey, 0, windowStartMs);
  pipeline.zAdd(historyKey, { score: nowMs, value: `${nowMs}` });
  pipeline.zCard(historyKey);
  pipeline.expire(historyKey, BUYER_PRICE_ADJUST_WINDOW_SECONDS);
  const results = await pipeline.exec();
  const rawCard = results?.[2];
  // 兼容 ioredis [[null,res], ...] 或 redis-mock [res,...]
  const count = Array.isArray(rawCard) ? (rawCard[1] ?? rawCard[0] ?? 0) : (rawCard ?? 0);

  if (count >= BUYER_PRICE_ADJUST_THRESHOLD) {
    await redisClient.set(cooldownKey, "1", {
      expiration: { type: "EX", value: BUYER_PRICE_ADJUST_COOLDOWN_SECONDS },
    });
  }
}

// 查询所有买方市场订单
export async function getBuyerMarketTransactionInfoList(resourceId: string): Promise<Omit<BuyerMarketTradeInfo, 'buyer'>[]> {
  const cacheKey = getBuyerMarketTransactionListCacheKey(resourceId);
  const cache = await redisClient.get(cacheKey);
  if (cache) {
    return JSON.parse(cache);
  }

  const orders = await prisma.buyerMarket.findMany({
    where: {
      is_closed: false,
      require_resource_id: resourceId,
    },
    // Higher price first; for same price, earlier create_time first
    orderBy: [
      { pay_per_unit: "desc" },
      { create_time: "asc" },
    ],
  });

  const result = orders.map(order => ({
    id: order.id,
    tradeUuid: order.trade_uuid,
    buyer: order.buyer,
    requireResourceId: order.require_resource_id as AllGameResourceID,
    requireResourceCount: order.require_resource_count,
    doneResourceCount: order.done_resource_count,
    payResourceId: order.pay_resource_id as AllGameResourceID,
    payPerUnit: order.pay_per_unit.toNumber(),
    isClosed: order.is_closed,
    createTime: order.create_time,
    closeTime: order.close_time ?? undefined,
  })) ?? [];

  await redisClient.set(cacheKey, JSON.stringify(result), {
    expiration: {
      type: 'EX',
      value: 60 * 15 // 缓存10分钟
    }
  });
  await redisClient.SADD(BUYER_MARKET_CACHE_RESOURCE_SET_KEY, resourceId);

  return result;
}

export async function getAllBuyerMarketResourceIds(): Promise<string[]> {
  const cacheKey = getBuyerMarketResourceIdsCacheKey();
  const cache = await redisClient.get(cacheKey);
  if (cache) {
    return JSON.parse(cache);
  }

  const orders = await prisma.buyerMarket.findMany({
    where: {
      is_closed: false
    },
    select: {
      require_resource_id: true
    }
  });
  const idSet = new Set<string>();
  for (const order of orders) {
    idSet.add(order.require_resource_id);
  }
  const result = Array.from(idSet);

  await redisClient.set(cacheKey, JSON.stringify(result), {
    expiration: {
      type: 'EX',
      value: 60 * 15 // 缓存10分钟
    }
  });

  return result;
}

export async function invalidateBuyerMarketCache(resourceId?: string) {
  const resourceIds: string[] = await redisClient.SMEMBERS(BUYER_MARKET_CACHE_RESOURCE_SET_KEY);
  if (resourceIds && resourceIds.length > 0) {
    const keys = resourceIds.map(id => getBuyerMarketTransactionListCacheKey(id));
    if (keys.length > 0) {
      for(const key of keys) {
        await redisClient.del(key);
      }
    }
    await redisClient.del(BUYER_MARKET_CACHE_RESOURCE_SET_KEY);
  }
  await redisClient.del(getBuyerMarketResourceIdsCacheKey());
  if (resourceId) {
    await redisClient.del(getBuyerMarketTransactionListCacheKey(resourceId));
  }
}

// 买方市场上架（发起求购）
export async function listToBuyerMarket(info: ListToBuyerMarketInfo, buyer: string): Promise<BuyerMarketTradeInfo> {
  if (info.payPerUnit > 10000000000) {
    throw new Error("Max cost is 10000000000");
  }

  // 检查购买后转售冷却：若用户在该资源上处于购买后冷却，则禁止对该资源发起求购
  const resaleKey = getMarketResaleCooldownSecondsRedisKey(buyer, info.payResourceId);
  const inCooldown = await redisClient.get(resaleKey);
  if (inCooldown) {
    throw new Error(`${allGameResource[info.payResourceId].name}在购买后${RESALE_COOLDOWN_SECONDS / 60}分钟内不可用于发起求购`);
  }

  // 上架频率检查
  const listIntervalKey = `buyerMarket:list:interval:${buyer}`;
  const now = Math.floor(Date.now() / 1000);

  const lastListTime = await redisClient.get(listIntervalKey);
  if (lastListTime && now - parseInt(lastListTime) < 5) {
    throw new Error("上架操作过于频繁，请等待几秒后再试");
  }
  await redisClient.set(listIntervalKey, now.toString(), {
    expiration: {
      type: 'EX',
      value: 5
    }
  });

  const uuid = uuidv4();

  // 检查库存是否足够（支付资源）
  const totalPay = info.payPerUnit * info.requireResourceCount;
  const item = await getItemInfo(buyer, info.payResourceId);

  let fee = 0
  if (info.payResourceId == 'gold') {
    let totalPay = info.payPerUnit * info.requireResourceCount;

    fee = Math.ceil(totalPay * BUYER_MARKET_FEE); // 3%手续费
  }

  if (!item || item.count < (totalPay + fee)) {
    throw new Error("你没有足够数量的资源用于求购（支付资源+预扣市场税）");
  }

  if (info.payPerUnit <= 0 || info.requireResourceCount <= 0) {
    throw new Error("非法数量");
  }

  if (('' + info.payPerUnit).includes('8964')) {
    throw new Error("Illegal cost");
  }

  if (info.requireResourceId === "gold") {
    throw new Error("金币不能作为求购资源");
  }

  // 对金额与数量进行检查,必须为非负整数，不能包含非数字内容，否则报错
  if (info.requireResourceCount <= 0 || !Number.isInteger(info.requireResourceCount)) {
    throw new Error("非法求购数量");
  }
  if (info.payPerUnit <= 0 || !Number.isInteger(info.payPerUnit)) {
    throw new Error("非法支付单价");
  }

  let buyerUser = await prisma.user.findUnique({
    where: { uuid: buyer },
  })

  if (buyerUser?.is_banned) {
    throw new Error("You are banned from the market");
  }

  if (!buyerUser) {
    throw new Error("User not found");
  }

  if (buyerUser?.accountPlayType == AccountPlayType.IRON) {
    throw new Error("硬核模式无法使用市场功能")
  }

  if (!buyerUser.email_verified) {
    if (info.payResourceId != 'gold') {
      throw new Error(`未验证邮箱的账号，求购订单的支付资源只能使用金币`);
    }

    if (info.requireResourceCount > MAX_BUYER_COUNT_IF_UNVERIFIED_EMAIL) {
      throw new Error(`未验证邮箱的账号，求购订单的单次求购数量上限为${MAX_BUYER_COUNT_IF_UNVERIFIED_EMAIL}`);
    }

    if (info.payPerUnit > MAX_BUYER_PRICE_IF_UNVERIFIED_EMAIL) {
      throw new Error(`未验证邮箱的账号，求购订单的单价上限为${MAX_BUYER_PRICE_IF_UNVERIFIED_EMAIL}`);
    }
  }

  // 新账号36小时内无法上架商品
  const accountAgeMs = Date.now() - buyerUser.create_date.getTime();
  if (accountAgeMs < 36 * 3600 * 1000) {
    throw new Error("新账号创建36小时内无法进行市场求购操作");
  }

  // 检查此玩家是同ip被ban的账号
  const bannedUser = await prisma.user.findFirst({
    where: {
      last_online_ip: buyerUser?.last_online_ip,
      pwd: buyerUser?.pwd,
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
      seller: buyer,
      sell_resource_id: info.requireResourceId,
      is_closed: false,
    },
  });
  if (existingOrder) {
    throw new Error("存在未完成的上架订单，请先下架后再进行上架");
  }

  // 如果这个玩家对此物品有求购订单，则不允许再次上架
  const existingBuyOrder = await prisma.buyerMarket.findFirst({
    where: {
      buyer,
      require_resource_id: info.requireResourceId,
      is_closed: false,
    },
  });
  if (existingBuyOrder) {
    throw new Error("存在未完成的求购订单，请先取消订单后再进行上架");
  }

  // 单资源调价冷却：30分钟内调价达到阈值则触发60分钟冷却
  await enforceBuyerPriceAdjustCooldown(buyer, info.requireResourceId);

  // 检查当前用户的求购上限（支持扩展）
  // NOTE: 不在事务外做最终检查以避免并发竞态，事务内会再次检查一次并发安全的上限

  const sellRes = await prisma.$transaction(async (tx) => {
    // 在事务内重新计算扩展后的上限并检查当前未完成订单数，防止并发超发
    const limits = await getMarketListingLimits(buyer, tx);
    const maxBuyerTransactions = limits.maxBuyerTransactions;
    const existingOrdersCountTx = await tx.buyerMarket.count({
      where: {
        buyer,
        is_closed: false,
      },
    });
    if (existingOrdersCountTx >= limits.maxBuyerTransactions) {
      throw new Error(`已有${maxBuyerTransactions}条未完成的求购订单（含扩展），请先取消订单后再进行新的求购`);
    }
    await decreaseItemCount(
      buyer,
      {
        [info.payResourceId]: { count: totalPay },
      },
      {
        actionName: "求购冻结",
        showModifyInfo: true,
        type: ModifyItemCountType.Market,
      },
      tx
    );

    if (fee) {
      await decreaseItemCount(
        buyer,
        {
          [info.payResourceId]: { count: fee },
        },
        {
          actionName: "求购订单扣除手续费",
          showModifyInfo: true,
          type: ModifyItemCountType.Market,
        },
        tx
      );
    }
    await invalidateInventoryCache(buyer);

    let tradeInfo = await tx.buyerMarket.create({
      data: {
        trade_uuid: uuid,
        buyer,
        require_resource_id: info.requireResourceId,
        require_resource_count: info.requireResourceCount,
        done_resource_count: 0,
        pay_resource_id: info.payResourceId,
        pay_per_unit: info.payPerUnit,
        is_closed: false,
        create_time: new Date(),
        pre_deducted_market_tax: fee,
      },
    });

    await invalidateBuyerMarketCache(info.requireResourceId);

    // 参考上方格式
    // tradeLogger.info({
    //   userUuid: buyer,
    //   action: "listToBuyerMarket",
    //   buyerUuid: buyer,
    //   tradeUuid: tradeInfo.trade_uuid,
    //   requireResourceId: tradeInfo.require_resource_id as AllGameResourceID,
    //   requireResourceCount: tradeInfo.require_resource_count,
    //   payResourceId: tradeInfo.pay_resource_id as AllGameResourceID,
    //   payPerUnit: tradeInfo.pay_per_unit,
    // })

    return {
      id: tradeInfo.id,
      tradeUuid: tradeInfo.trade_uuid,
      buyer: tradeInfo.buyer,
      requireResourceId: tradeInfo.require_resource_id as AllGameResourceID,
      requireResourceCount: tradeInfo.require_resource_count,
      doneResourceCount: tradeInfo.done_resource_count,
      payResourceId: tradeInfo.pay_resource_id as AllGameResourceID,
      payPerUnit: tradeInfo.pay_per_unit.toNumber(),
      isClosed: tradeInfo.is_closed,
      createTime: tradeInfo.create_time,
      closeTime: tradeInfo.close_time ?? undefined,
    };
  });
  return sellRes;
  // 扣除支付资源
 
}

// 买方市场下架（撤销求购，返还剩余支付资源）
export async function removeFromBuyerMarket(tradeUuid: string, buyerUuid: string): Promise<RemoveFromBuyerMarketResult> {
  const order = await prisma.buyerMarket.findUnique({
    where: { trade_uuid: tradeUuid },
  });

  if (!order) {
    throw new Error("Buyer market order not found");
  }
  if (order.is_closed) {
    throw new Error("Order is already closed");
  }
  if (order.buyer !== buyerUuid) {
    throw new Error("你不是该订单的发起人");
  }


  let buyer = await prisma.user.findUnique({
    where: { uuid: order.buyer },
  })

  if (buyer?.is_banned) {
    throw new Error("You are banned from the market");
  }

  if (buyer?.accountPlayType == AccountPlayType.IRON) {
    throw new Error("硬核模式无法使用市场功能")
  }

  const remainCount = order.require_resource_count - order.done_resource_count;
  const remainPay = remainCount * order.pay_per_unit.toNumber();

  return await prisma.$transaction(async (tx) => {
    await tx.buyerMarket.update({
      where: { trade_uuid: tradeUuid },
      data: {
        is_closed: true,
        close_time: new Date(),
        pre_deducted_market_tax: 0,
      },
    });

    // 返还剩余支付资源
    if (remainPay > 0) {
      await increaseItemCount(
        order.buyer,
        {
          [order.pay_resource_id]: { count: remainPay },
        },
        {
          actionName: "求购订单 下架返还",
          showModifyInfo: true,
          type: ModifyItemCountType.Market,
        },
        tx
      );
    }

    if (order.pre_deducted_market_tax && order.pre_deducted_market_tax > 0) {
      // 返还预扣的市场税
      await increaseItemCount(
        order.buyer,
        {
          [order.pay_resource_id]: { count: order.pre_deducted_market_tax },
        },
        {
          actionName: "求购订单 返还预扣税",
          showModifyInfo: true,
          type: ModifyItemCountType.Market,
        },
        tx
      );
    }
    await invalidateInventoryCache(order.buyer);

    await invalidateBuyerMarketCache(order.require_resource_id);

    return {
      tradeUuid: tradeUuid,
      requireResourceId: order.require_resource_id as AllGameResourceID,
      doneResourceCount: order.done_resource_count,
      remainRequireCount: remainCount,
    };
  });
}

// 卖家卖出资源到买方市场
export async function sellToBuyerMarket(info: SellToBuyerMarketInfo): Promise<MarkerTransactionInfo> {
  // 加锁防止并发
  const lockKey = `buyerMarket:lock:${info.tradeUuid}`;
  const lockValue = `${info.sellerUuid}_${Date.now()}`;
  const lockExpire = 5000; // ms
  const acquired = await redisClient.set(lockKey, lockValue, { NX: true, PX: lockExpire });
  if (!acquired) {
    throw new Error("该求购单正在被交易，请稍后重试");
  }

  const order = await prisma.buyerMarket.findUnique({
    where: { trade_uuid: info.tradeUuid },
  });

  if (!order) {
    throw new Error("Buyer market order not found");
  }
  if (order.is_closed) {
    throw new Error("Order is closed");
  }

  // 检查卖家是否是该订单的卖家
  if (order.buyer === info.sellerUuid) {
    throw new Error("卖家不能出售自己发起的求购单");
  }

  // 对金额与数量进行检查,必须为非负整数，不能包含非数字内容，否则报错
  if (info.sellCount <= 0 || !Number.isInteger(info.sellCount)) {
    throw new Error("非法出售数量");
  }


  const remainCount = order.require_resource_count - order.done_resource_count;
  if (info.sellCount > remainCount) {
    throw new Error("超出剩余可出售数量");
  }
  if (info.sellCount <= 0) {
    throw new Error("非法出售数量");
  }

  let buyerUser = await prisma.user.findUnique({
    where: { uuid: order.buyer },
  })

  if (buyerUser?.is_banned) {
    throw new Error("Buyer is banned from the market");
  }

  let sellerUser = await prisma.user.findUnique({
    where: { uuid: info.sellerUuid },
  })

  if (sellerUser?.last_online_ip == buyerUser?.last_online_ip
    && sellerUser?.last_online_fp == buyerUser?.last_online_fp) {
    // throw new Error("交易失败(03)");
  }

  if (sellerUser?.last_online_ip == buyerUser?.last_online_ip
    && sellerUser?.pwd == buyerUser?.pwd
  ) {
    throw new Error("交易失败(04)");
  }

  if (buyerUser?.accountPlayType == AccountPlayType.IRON || sellerUser?.accountPlayType == AccountPlayType.IRON) {
    throw new Error("硬核模式无法使用市场功能")
  }

  if (!sellerUser?.email_verified) {
    if (order.pay_resource_id != 'gold') {
      throw new Error(`未验证邮箱的账号，只能出售资源到金币求购单`);
    }

    if (info.sellCount > MAX_BUYER_COUNT_IF_UNVERIFIED_EMAIL) {
      throw new Error(`未验证邮箱的账号，单次出售数量上限为${MAX_BUYER_COUNT_IF_UNVERIFIED_EMAIL}`);
    }

    if (order.pay_per_unit.toNumber() > MAX_BUYER_PRICE_IF_UNVERIFIED_EMAIL) {
      throw new Error(`未验证邮箱的账号，出售的单价上限为${MAX_BUYER_PRICE_IF_UNVERIFIED_EMAIL}`);
    }
  }


  if (SPECIAL_ITEM_20251202.includes(order.require_resource_id)) {
    const unlockDate = new Date('2025-12-01T10:00:00.000Z');
    if (new Date() < unlockDate) {
      throw new Error(`该资源在${formatTime(unlockDate)}后才可被出售`);
    }
  }
  if (SPECIAL_ITEM_20251202.includes(order.pay_resource_id)) {
    const unlockDate = new Date('2025-12-01T10:00:00.000Z');
    if (new Date() < unlockDate) {
      throw new Error(`该资源在${formatTime(unlockDate)}后才可被出售`);
    }
  }

  // 检查卖家库存
  const sellerItem = await getItemInfo(info.sellerUuid, order.require_resource_id as AllGameResourceID);
  if (!sellerItem || sellerItem.count < info.sellCount) {
    throw new Error("卖家库存不足");
  }

  const totalPay = info.sellCount * order.pay_per_unit.toNumber();

  let sellerPaid = false;
  let buyerReceived = false;
  let sellerReceived = false;

  const resource = allGameResource[order.require_resource_id];
  if (!resource || resource.hideInMarket) {
    throw new Error("该资源无法交易");
  }

  const sellTxRes = await prisma.$transaction(async (tx) => {
    try {
      // 卖家扣除资源
      await decreaseItemCount(
        info.sellerUuid,
        {
          [order.require_resource_id]: { count: info.sellCount },
        },
        {
          actionName: `卖出到求购市场 ${resource.name}x${info.sellCount}，单价${order.pay_per_unit.toNumber()}`,
          showModifyInfo: true,
          type: ModifyItemCountType.Market,
        },
        tx
      );
      await invalidateInventoryCache(info.sellerUuid);
      sellerPaid = true;

      // 买家获得资源
      await increaseItemCount(
        order.buyer,
        {
          [order.require_resource_id]: { count: info.sellCount },
        },
        {
          actionName: `求购市场获得资源 ${resource.name}x${formatNumber(info.sellCount)}，单价${formatNumber(order.pay_per_unit.toNumber())}`,
          showModifyInfo: true,
          type: ModifyItemCountType.Market,
        },
        tx
      );
      await invalidateInventoryCache(order.buyer);
      buyerReceived = true;

      // 卖家获得支付资源
      await increaseItemCount(
        info.sellerUuid,
        {
          [order.pay_resource_id]: { count: totalPay },
        },
        {
          actionName: `求购市场获得支付 ${resource.name}x${formatNumber(totalPay)}，单价${formatNumber(order.pay_per_unit.toNumber())}`,
          showModifyInfo: true,
          type: ModifyItemCountType.Market,
        },
        tx
      );
      await invalidateInventoryCache(info.sellerUuid);
      sellerReceived = true;

      // 更新订单
      const newDoneCount = order.done_resource_count + info.sellCount;
      const isClosed = newDoneCount >= order.require_resource_count;

      const newTransactionData: Partial<BuyerMarket> = {
        done_resource_count: newDoneCount,
        is_closed: isClosed,
      };
      if (isClosed) {
        newTransactionData.close_time = new Date();
      }

      // 如果有预扣税，根据交易数量，进行抵消
      let newPreDeductedMarketTax = order.pre_deducted_market_tax;
      if (newPreDeductedMarketTax && newPreDeductedMarketTax > 0) {
        // 按照求购数量，与此次交易数量，分割pre_deducted_market_tax，来计算本次抵消的税费

        let taxPerUnit = Math.ceil(
          newPreDeductedMarketTax / order.require_resource_count
        );
        let tax = Math.ceil(info.sellCount * taxPerUnit);

        newPreDeductedMarketTax -= tax;

        newTransactionData.pre_deducted_market_tax = newPreDeductedMarketTax;
      }

      let oriSellerInfo: any[] = safeJsonParse(order.seller_info, []) ?? [];
      if (!oriSellerInfo || !Array.isArray(oriSellerInfo)) {
        oriSellerInfo = [];
      }
      // 添加买家信息
      oriSellerInfo.push({
        seller: info.sellerUuid,
        count: info.sellCount,
        time: new Date(),
      });
      newTransactionData.seller_info = JSON.stringify(oriSellerInfo);

      const updatedOrder = await tx.buyerMarket.update({
        where: { trade_uuid: info.tradeUuid },
        data: newTransactionData,
      });

      await invalidateBuyerMarketCache(order.require_resource_id);

      // 记录交易日志
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
      // tradeLogger.info({
      //   userUuid: info.sellerUuid,
      //   action: "sellToBuyerMarket",
      //   tradeUuid: info.tradeUuid,
      //   sellerUuid: info.sellerUuid,
      //   buyerUuid: order.buyer,
      //   requireResourceId: order.require_resource_id as AllGameResourceID,
      //   requireResourceCount: order.require_resource_count,
      //   doneResourceCount: newDoneCount,
      //   payResourceId: order.pay_resource_id as AllGameResourceID,
      //   payPerUnit: order.pay_per_unit,
      //   sellCount: info.sellCount,
      // })

      // 标记购买者在该资源上的转售冷却
      const resaleKey = getBuyerMarketResaleCooldownSecondsRedisKey(order.buyer, order.require_resource_id);
      await redisClient.set(resaleKey, '1', {
        expiration: {
          type: 'EX',
          value: BUYER_MARKET_RESALE_COOLDOWN_SECONDS
        }
      });

      return {
        tradeUuid: info.tradeUuid,
        buyerUuid: order.buyer,
        sellerUuid: info.sellerUuid,
        tradeInfo: {
          id: updatedOrder.id,
          tradeUuid: updatedOrder.trade_uuid,
          buyer: updatedOrder.buyer,
          requireResourceId:
          updatedOrder.require_resource_id as AllGameResourceID,
          requireResourceCount: updatedOrder.require_resource_count,
          doneResourceCount: updatedOrder.done_resource_count,
          payResourceId: updatedOrder.pay_resource_id as AllGameResourceID,
          payPerUnit: updatedOrder.pay_per_unit.toNumber(),
          isClosed: updatedOrder.is_closed,
          createTime: updatedOrder.create_time,
          closeTime: updatedOrder.close_time ?? undefined,
        },
        sellCount: info.sellCount,
      };
    } catch (err) {
      // 补偿逻辑
      // if (sellerPaid) {
      //   await increaseItemCount(
      //     info.sellerUuid,
      //     {
      //       [order.require_resource_id]: { count: info.sellCount },
      //     },
      //     {
      //       actionName: "买方市场失败返还",
      //       showModifyInfo: true,
      //       type: ModifyItemCountType.Market,
      //     }
      //   );
      // }
      // if (buyerReceived) {
      //   await decreaseItemCount(
      //     order.buyer,
      //     {
      //       [order.require_resource_id]: { count: info.sellCount },
      //     },
      //     {
      //       actionName: "买方市场失败扣回",
      //       showModifyInfo: true,
      //       type: ModifyItemCountType.Market,
      //     }
      //   );
      // }
      // if (sellerReceived) {
      //   await decreaseItemCount(
      //     info.sellerUuid,
      //     {
      //       [order.pay_resource_id]: { count: totalPay },
      //     },
      //     {
      //       actionName: "买方市场失败扣回",
      //       showModifyInfo: true,
      //       type: ModifyItemCountType.Market,
      //     }
      //   );
      // }
      throw err;
    } finally {
      // 只释放自己的锁
      const currentValue = await redisClient.get(lockKey);
      if (currentValue === lockValue) {
        await redisClient.del(lockKey);
      }
    }
  });

  // Record recent trade in Redis (by resource id with latest timestamp)
  try {
    const RECENT_TRADES_KEY = 'market:recent:resources';
    const now = Date.now();
    const resourceId = sellTxRes.tradeInfo.requireResourceId;
  try { await redisClient.zAdd(RECENT_TRADES_KEY, { score: now, value: resourceId }); } catch (e) { }
  try { await redisClient.zRemRangeByRank(RECENT_TRADES_KEY, 0, -1001); } catch (e) { }
  } catch (e) {
    // best-effort only
    console.warn('Failed to record recent buyer-market trade to redis', e);
  }

  return sellTxRes;
}

// 查询买方市场历史
export async function getBuyerMarketListHistoryByBuyer(buyerUuid: string) {
  const orders = await prisma.buyerMarket.findMany({
    where: { buyer: buyerUuid },
    orderBy: { create_time: "desc" },
  });

  return orders.map(order => ({
    // id: order.id,
    tradeUuid: order.trade_uuid,
    // buyer: order.buyer,
    requireResourceId: order.require_resource_id as AllGameResourceID,
    requireResourceCount: order.require_resource_count,
    doneResourceCount: order.done_resource_count,
    payResourceId: order.pay_resource_id as AllGameResourceID,
    payPerUnit: order.pay_per_unit.toNumber(),
    isClosed: order.is_closed,
    createTime: order.create_time,
    closeTime: order.close_time ?? undefined,
  }));
}