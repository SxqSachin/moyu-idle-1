import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";

/**
 * 返回与指定用户相关的 market 交易记录（seller=用户 或 buyer_info 包含用户）
 * data: { targetUuid: string, bearer: string }
 */
export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ targetUuid: string; bearer?: string; page?: number; take?: number; filterType?: 'all' | 'listing' | 'purchase' }>
) {
  const userUuid = data.user.uuid;
  const { targetUuid, } = data.data;
  console.log('[GM] gm:getUserTransactionList called by', userUuid, 'target=', targetUuid)

  // 基础权限检查：仅 GM 可用
  const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
  if (!gmUser || !gmUser.is_gm) {
    emitEventToUser(data.user, "gm:getUserTransactionList:fail", { message: "无权限" });
    return;
  }

  if (!targetUuid) {
    emitEventToUser(data.user, "gm:getUserTransactionList:fail", { message: "targetUuid required" });
    return;
  }

  try {
    // 支持传入用户名（name）或 UUID。如果传入的不是现有 UUID，则尝试按 name 查找
    let targetUserUuid = targetUuid;
    const maybeUser = await prisma.user.findUnique({ where: { uuid: targetUuid } });
    if (!maybeUser) {
      const byName = await prisma.user.findFirst({ where: { name: targetUuid } });
      if (byName) {
        targetUserUuid = byName.uuid;
      } else {
        emitEventToUser(data.user, "gm:getUserTransactionList:fail", { message: "target user not found" });
        return;
      }
    }

    console.log('[GM] resolved targetUserUuid=', targetUserUuid)

    // 支持分页参数
    const page = Math.max(1, Number(data.data.page || 1));
    const take = Math.max(1, Math.min(200, Number(data.data.take || 50)));

    const filterType = (data.data.filterType || 'all');
    let whereClause: any;
    if (filterType === 'listing') {
      whereClause = { seller: targetUserUuid };
    } else if (filterType === 'purchase') {
      whereClause = { buyer_info: { contains: targetUserUuid } as any };
    } else {
      whereClause = {
        OR: [
          { seller: targetUserUuid },
          { buyer_info: { contains: targetUserUuid } as any }
        ]
      };
    }

    // 为减少扫描量：按条件筛选并按时间排序
    const candidateOrders = await prisma.market.findMany({
      where: whereClause,
      orderBy: { create_time: 'desc' },
    });

    const total = candidateOrders.length;
    const start = (page - 1) * take;
    const pageOrders = candidateOrders.slice(start, start + take);

    const res = pageOrders.map(order => {
      let buyerInfo: any[] = [];
      try { buyerInfo = JSON.parse(order.buyer_info || '[]'); } catch { buyerInfo = []; }
      return {
        id: order.id,
        tradeUuid: order.trade_uuid,
        seller: order.seller,
        sellResourceId: order.sell_resource_id,
        sellResourceCount: order.sell_resource_count,
        selledResourceCount: order.selled_resource_count,
        costResourceId: order.cost_resource_id,
        costPerUnit: order.cost_per_unit.toNumber(),
        buyerInfo,
        isClosed: order.is_closed,
        createTime: order.create_time,
        closeTime: order.close_time ?? undefined,
      }
    })

    emitEventToUser(data.user, "gm:getUserTransactionList:success", { targetUuid: targetUserUuid, list: res, page, take, total, filterType });
  } catch (err: any) {
    emitEventToUser(data.user, "gm:getUserTransactionList:fail", { message: err.message ?? String(err) });
  }
}
