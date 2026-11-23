import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { getRecentCompletedPricesByResource, getPriceStatsByResource } from "~/server/utils/game/newMarket";
import { MarketPriceData } from "~/shared/types/market";
import { getRecentTradedResourceIds } from "~/server/utils/game/newMarket";

// // 获取指定物品最近成交价格数据
// export async function handleGetRecentCompletedPrices(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ resourceId: string }>
// ) {
//   const userUuid = data.user.uuid;
//   const { resourceId } = data.data;

//   // 验证资源ID
//   if (!resourceId || typeof resourceId !== 'string') {
//     emitEventToUser(userUuid, "market:recentPrices:fail", { 
//       message: "资源ID不能为空" 
//     });
//     return;
//   }

//   try {
//     const priceData = await getRecentCompletedPricesByResource(resourceId);
//     emitEventToUser(userUuid, "market:recentPrices:success", { 
//       resourceId, 
//       data: priceData 
//     });
//   } catch (e: any) {
//     console.error(`获取物品 ${resourceId} 成交价格失败:`, e);
//     emitEventToUser(userUuid, "market:recentPrices:fail", { 
//       message: e.message || "获取成交价格失败" 
//     });
//   }
// }

// // 获取指定物品的价格统计数据
// export async function handleGetPriceStats(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ resourceId: string }>
// ) {
//   const userUuid = data.user.uuid;
//   const { resourceId } = data.data;

//   // 验证资源ID
//   if (!resourceId || typeof resourceId !== 'string') {
//     emitEventToUser(userUuid, "market:priceStats:fail", { 
//       message: "资源ID不能为空" 
//     });
//     return;
//   }

//   try {
//     const stats = await getPriceStatsByResource(resourceId);
//     emitEventToUser(userUuid, "market:priceStats:success", { 
//       resourceId, 
//       data: stats 
//     });
//   } catch (e: any) {
//     console.error(`获取物品 ${resourceId} 价格统计失败:`, e);
//     emitEventToUser(userUuid, "market:priceStats:fail", { 
//       message: e.message || "获取价格统计失败" 
//     });
//   }
// }

// 获取综合市场数据（包含最近成交价格和统计数据）
export async function handleGetMarketPriceData(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ resourceId: string }>
) {
  const userUuid = data.user.uuid;
  const { resourceId } = data.data;

  // 验证资源ID
  if (!resourceId || typeof resourceId !== 'string') {
    emitEventToUser(userUuid, "newMarket:priceData:fail", { 
      message: "资源ID不能为空" 
    });
    return;
  }

  try {
    // 并行获取成交价格和统计数据
    const [recentPrices] = await Promise.all([
      getRecentCompletedPricesByResource(resourceId),
      // getPriceStatsByResource(resourceId)
    ]);

    emitEventToUser(userUuid, "newMarket:priceData:success", {
      resourceId,
      data: {
        recentPrices,
        // priceStats,
      }
    });
  } catch (e: any) {
    console.error(`获取物品 ${resourceId} 市场数据失败:`, e);
    emitEventToUser(userUuid, "newMarket:priceData:fail", { 
      message: e.message || "获取市场数据失败" 
    });
  }
}

export async function handleGetBatchMarketPriceDataSimple(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ resourceIds: string[] }>
) {
  const userUuid = data.user.uuid;
  const { resourceIds } = data.data;

  // 验证资源ID数组
  if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
    emitEventToUser(userUuid, "newMarket:batchPriceData:fail", { 
      message: "资源ID列表不能为空" 
    });
    return;
  }

  if (resourceIds.length > 100) {
    emitEventToUser(userUuid, "newMarket:batchPriceData:fail", { 
      message: "单次查询的资源数量不能超过100个" 
    });
    return;
  }

  // 去重并过滤无效ID
  const validResourceIds = [...new Set(resourceIds)]
    .filter(id => id && typeof id === 'string' && id.trim() !== '')
    .map(id => id.trim());

  if (validResourceIds.length === 0) {
    emitEventToUser(userUuid, "newMarket:batchPriceData:fail", { 
      message: "没有有效的资源ID" 
    });
    return;
  }

  try {
    // 并行获取所有物品的成交价格数据，只保留成功的
    const batchPromises = validResourceIds.map(async (resourceId) => {
      try {
        const recentPrices = await getRecentCompletedPricesByResource(resourceId);
        return {
          resourceId,
          recentPrices,
        };
      } catch (error) {
        // 静默忽略单个物品的错误
        console.warn(`获取物品 ${resourceId} 数据失败，跳过`);
        return null;
      }
    });

    // 等待所有请求完成并过滤掉失败的
    const allResults = await Promise.all(batchPromises);
    const successResults = allResults.filter(result => result !== null);

    // 转换为以resourceId为键的对象
    const marketData: Record<string, MarketPriceData> = {};
    successResults.forEach(result => {
      if (result) {
        marketData[result.resourceId] = {
          recentPrices: result.recentPrices,
        };
      }
    });

    emitEventToUser(userUuid, "newMarket:batchPriceData:success", {
      totalRequested: validResourceIds.length,
      successCount: successResults.length,
      data: marketData
    });
  } catch (e: any) {
    console.error(`简化批量获取市场数据失败:`, e);
    emitEventToUser(userUuid, "newMarket:batchPriceData:fail", { 
      message: e.message || "批量获取市场数据失败" 
    });
  }
}

// 获取最近有成交记录的资源ID列表（用于首页快速展示）
export async function handleGetRecentTradedResources(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ limit?: number }>
) {
  const userUuid = data.user.uuid;
  const limit = Number(data.data?.limit ?? 20) || 20;

  try {
    const resourceIds = await getRecentTradedResourceIds(limit);
    emitEventToUser(userUuid, "newMarket:recentTradedResources:success", {
      resourceIds,
    });
  } catch (e: any) {
    console.error(`获取最近成交资源失败:`, e);
    emitEventToUser(userUuid, "newMarket:recentTradedResources:fail", {
      message: e.message || '获取失败'
    });
  }
}