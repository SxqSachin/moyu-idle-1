import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";

/**
 * 返回与指定用户相关的 BuyerMarket 求购记录（buyer=用户）
 * data: { targetUuid: string, bearer?: string, page?: number, take?: number }
 */
export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ targetUuid: string; bearer?: string; page?: number; take?: number }>
) {
  const userUuid = data.user.uuid;
  const { targetUuid } = data.data;
  console.log('[GM] gm:getUserBuyerMarketList called by', userUuid, 'target=', targetUuid)

  const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
  if (!gmUser || !gmUser.is_gm) {
    emitEventToUser(data.user, "gm:getUserBuyerMarketList:fail", { message: "无权限" });
    return;
  }

  if (!targetUuid) {
    emitEventToUser(data.user, "gm:getUserBuyerMarketList:fail", { message: "targetUuid required" });
    return;
  }

  try {
    let targetUserUuid = targetUuid;
    const maybeUser = await prisma.user.findUnique({ where: { uuid: targetUuid } });
    if (!maybeUser) {
      const byName = await prisma.user.findFirst({ where: { name: targetUuid } });
      if (byName) {
        targetUserUuid = byName.uuid;
      } else {
        emitEventToUser(data.user, "gm:getUserBuyerMarketList:fail", { message: "target user not found" });
        return;
      }
    }

    const page = Math.max(1, Number(data.data.page || 1));
    const take = Math.max(1, Math.min(200, Number(data.data.take || 50)));

    const candidate = await prisma.buyerMarket.findMany({
      where: { 
        OR: [
          { buyer: targetUserUuid },
          { seller_info: { contains: targetUserUuid } }
        ]
        },
      orderBy: { create_time: 'desc' as any },
    });

    const total = candidate.length;
    const start = (page - 1) * take;
    const pageData = candidate.slice(start, start + take);

    const res = pageData.map((order: any) => {
      let sellerInfo: any[] = [];
      try { sellerInfo = JSON.parse(order.seller_info || '[]'); } catch { sellerInfo = []; }
      return {
      id: order.id,
      tradeUuid: order.trade_uuid,
      buyer: order.buyer,
      requireResourceId: order.require_resource_id,
      requireResourceCount: order.require_resource_count,
      doneResourceCount: order.done_resource_count,
      payResourceId: order.pay_resource_id,
      payPerUnit: Number(order.pay_per_unit),
      isClosed: order.is_closed,
      createTime: order.create_time,
      closeTime: order.close_time ?? undefined,
        sellerInfo,
      };
    });

    emitEventToUser(data.user, "gm:getUserBuyerMarketList:success", { targetUuid: targetUserUuid, list: res, page, take, total });
  } catch (err: any) {
    emitEventToUser(data.user, "gm:getUserBuyerMarketList:fail", { message: err.message ?? String(err) });
  }
}