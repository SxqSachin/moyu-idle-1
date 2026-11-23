import { prisma } from "../utils/prisma";
import { allGameResource } from "~/shared/data/allGameResources";
import fs from 'fs/promises';
import path from 'path';

const INTERVAL = 15 * 60 * 1000; // 15分钟，单位毫秒

const outPath = path.resolve(__dirname, "../../../../assets/data/market.json");

interface MarketPriceInfo {
  itemId: string;
  sellOrders: {
    minPrice: number;          // 最低售价
    minPriceCount: number;     // 最低价对应的数量（该最低价下剩余数量合计）
    totalCount: number;        // 总剩余售卖数量
    orderCount: number;        // 售卖订单数
  } | null;
  buyOrders: {
    maxPrice: number;          // 最高求购价
    maxPriceCount: number;     // 最高价对应的数量（该最高价下剩余数量合计）
    totalCount: number;        // 总剩余求购数量
    orderCount: number;        // 求购订单数
  } | null;
  lastUpdateTime: number;      // 最后更新时间戳
}

interface MarketData {
  items: { [itemId: string]: MarketPriceInfo };
  lastUpdateTime: number;
  totalItems: number;
}

async function runTask() {
  try {
    console.log('开始更新市场价格数据...');
    const start = Date.now();
    
    const marketData: MarketData = {
      items: {},
      lastUpdateTime: Date.now(),
      totalItems: 0
    };

    // 一次性分组获取售卖订单：按物品 + 单价
    const sellGroups = await prisma.market.groupBy({
      by: ['sell_resource_id', 'cost_per_unit'],
      where: { is_closed: false },
      _sum: { sell_resource_count: true, selled_resource_count: true },
      _count: { id: true }
    });

    // 一次性分组获取求购订单：按物品 + 单价
    const buyGroups = await prisma.buyerMarket.groupBy({
      by: ['require_resource_id', 'pay_per_unit'],
      where: { is_closed: false },
      _sum: { require_resource_count: true, done_resource_count: true },
      _count: { id: true }
    });

    // 构建售卖映射
    const sellMap: Record<string, {
      groups: typeof sellGroups,
      totalRemaining: number,
      orderCount: number,
      minPrice: number | null,
      minPriceRemaining: number
    }> = {}

    for (const g of sellGroups) {
      const itemId = g.sell_resource_id as string
      const resource = allGameResource[itemId]
      if (!resource || resource.hideInMarket || resource.userBuyCostSponsorPoint) continue
      const remaining = (g._sum.sell_resource_count || 0) - (g._sum.selled_resource_count || 0)
      if (!sellMap[itemId]) {
        sellMap[itemId] = { groups: [], totalRemaining: 0, orderCount: 0, minPrice: null, minPriceRemaining: 0 }
      }
      sellMap[itemId].groups.push(g)
      sellMap[itemId].totalRemaining += remaining
      sellMap[itemId].orderCount += g._count.id
      const price = Number(g.cost_per_unit)
      if (remaining > 0) {
        if (sellMap[itemId].minPrice === null || price < sellMap[itemId].minPrice) {
          sellMap[itemId].minPrice = price
          sellMap[itemId].minPriceRemaining = remaining
        } else if (price === sellMap[itemId].minPrice) {
          sellMap[itemId].minPriceRemaining += remaining
        }
      }
    }

    // 构建求购映射
    const buyMap: Record<string, {
      groups: typeof buyGroups,
      totalRemaining: number,
      orderCount: number,
      maxPrice: number | null,
      maxPriceRemaining: number
    }> = {}
    for (const g of buyGroups) {
      const itemId = g.require_resource_id as string
      const resource = allGameResource[itemId]
      if (!resource || resource.hideInMarket || resource.userBuyCostSponsorPoint) continue
      const remaining = (g._sum.require_resource_count || 0) - (g._sum.done_resource_count || 0)
      if (!buyMap[itemId]) {
        buyMap[itemId] = { groups: [], totalRemaining: 0, orderCount: 0, maxPrice: null, maxPriceRemaining: 0 }
      }
      buyMap[itemId].groups.push(g)
      buyMap[itemId].totalRemaining += remaining
      buyMap[itemId].orderCount += g._count.id
      const price = Number(g.pay_per_unit)
      if (remaining > 0) {
        if (buyMap[itemId].maxPrice === null || price > buyMap[itemId].maxPrice) {
          buyMap[itemId].maxPrice = price
          buyMap[itemId].maxPriceRemaining = remaining
        } else if (price === buyMap[itemId].maxPrice) {
          buyMap[itemId].maxPriceRemaining += remaining
        }
      }
    }

    // 合并两个映射生成最终 items
    const allItemIds = new Set<string>([...Object.keys(sellMap), ...Object.keys(buyMap)])
    for (const itemId of allItemIds) {
      const sellInfo = sellMap[itemId]
      const buyInfo = buyMap[itemId]
      const itemInfo: MarketPriceInfo = {
        itemId,
        sellOrders: sellInfo && sellInfo.minPrice !== null ? {
          minPrice: sellInfo.minPrice!,
          minPriceCount: sellInfo.minPriceRemaining,
          totalCount: sellInfo.totalRemaining,
          orderCount: sellInfo.orderCount
        } : null,
        buyOrders: buyInfo && buyInfo.maxPrice !== null ? {
          maxPrice: buyInfo.maxPrice!,
          maxPriceCount: buyInfo.maxPriceRemaining,
          totalCount: buyInfo.totalRemaining,
          orderCount: buyInfo.orderCount
        } : null,
        lastUpdateTime: Date.now()
      }
      marketData.items[itemId] = itemInfo
    }

    marketData.totalItems = Object.keys(marketData.items).length

    // 写入JSON文件
    await fs.writeFile(
      outPath,
      JSON.stringify(marketData, null, 2),
      'utf-8'
    );

    const durationMs = Date.now() - start
    console.log(`市场价格数据更新完成！耗时 ${durationMs} ms`);
    console.log(`- 物品数量(可买/可卖): ${marketData.totalItems}`);
    console.log(`- 有售卖订单的物品: ${Object.keys(sellMap).length}`);
    console.log(`- 有求购订单的物品: ${Object.keys(buyMap).length}`);
    console.log(`- 输出文件: ${outPath}`);
    const itemsWithBothOrders = Object.values(marketData.items).filter(item => item.sellOrders && item.buyOrders).length;
    console.log(`- 同时有买卖订单的物品: ${itemsWithBothOrders}`);

  } catch (error) {
    console.error('更新市场价格数据时发生错误:', error);
    
    // 记录详细错误信息
    if (error instanceof Error) {
      console.error('错误详情:', {
        message: error.message,
        stack: error.stack
      });
    }
  }
}

let running = true;
process.on('SIGINT', () => { 
  console.log('收到 SIGINT 信号，准备停止...');
  running = false; 
});
process.on('SIGTERM', () => { 
  console.log('收到 SIGTERM 信号，准备停止...');
  running = false; 
});

async function mainLoop() {
  console.log('市场价格api->json服务启动...');
  
  // 启动时立即执行一次
  await runTask();
  
  while (running) {
    // 随机正负10分钟浮动
    let thisTimeInterval = INTERVAL + (Math.random() * 20 - 10) * 60 * 1000;
    
    console.log(`下次更新将在 ${Math.round(thisTimeInterval / 1000 / 60)} 分钟后进行...`);

    if (running) {
      await new Promise(resolve => setTimeout(resolve, thisTimeInterval));
    }
    
    if (running) {
      await runTask();
    }
  }
  console.log('市场价格api->json服务已停止...');
}

await mainLoop();
process.exit(0);