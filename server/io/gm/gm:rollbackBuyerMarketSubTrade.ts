import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { decreaseItemCount, increaseItemCount } from "~/server/utils/game/characterInventory";
import { enqueueToHarvestBox } from "~/server/utils/game/harvestBox";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { invalidateBuyerMarketCache } from "~/server/utils/game/buyerMarket";

/**
 * GM rollback a single seller sub-trade for BuyerMarket
 * data: { tradeUuid: string, sellerIndex: number, bearer: string }
 * Behavior:
 * - Remove purchased resource from buyer
 * - Deduct payment from seller
 * - Return resource to seller (via harvest box)
 * - Decrement done_resource_count and reopen if needed
 * - Mark seller_info entry rolledBack
 */
export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ tradeUuid: string; sellerIndex: number; bearer: string }>
) {
  const userUuid = data.user.uuid;
  const { tradeUuid, sellerIndex } = data.data;

  const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
  if (!gmUser || !gmUser.is_gm) {
    emitEventToUser(data.user, "gm:rollbackBuyerMarketSubTrade:fail", { message: "无权限" });
    return;
  }

  if (!tradeUuid || typeof sellerIndex !== 'number' || sellerIndex < 0) {
    emitEventToUser(data.user, "gm:rollbackBuyerMarketSubTrade:fail", { message: "tradeUuid / sellerIndex required" });
    return;
  }

  try {
    const order = await prisma.buyerMarket.findUnique({ where: { trade_uuid: tradeUuid } } as any);
    if (!order) {
      emitEventToUser(data.user, "gm:rollbackBuyerMarketSubTrade:fail", { message: "BuyerMarket order not found" });
      return;
    }

    let sellerInfo: any[] = [];
    try { sellerInfo = JSON.parse((order as any).seller_info || '[]'); } catch { sellerInfo = []; }
    if (!Array.isArray(sellerInfo) || sellerIndex >= sellerInfo.length) {
      emitEventToUser(data.user, "gm:rollbackBuyerMarketSubTrade:fail", { message: "seller entry not found" });
      return;
    }

    const entry = sellerInfo[sellerIndex];
    if (!entry || !entry.seller || !entry.count) {
      emitEventToUser(data.user, "gm:rollbackBuyerMarketSubTrade:fail", { message: "invalid seller entry" });
      return;
    }
    if (entry.rolledBack) {
      emitEventToUser(data.user, "gm:rollbackBuyerMarketSubTrade:fail", { message: "this sub-trade has already been rolled back" });
      return;
    }

    const sellerUuid = entry.seller as string;
    const count = Number(entry.count);
    if (!sellerUuid || !count || count <= 0) {
      emitEventToUser(data.user, "gm:rollbackBuyerMarketSubTrade:fail", { message: "invalid seller entry data" });
      return;
    }

    const requireResourceId = order.require_resource_id as string;
    const payResourceId = order.pay_resource_id as string;
    const payPerUnit = Number(order.pay_per_unit);
    const totalAmount = Math.round(payPerUnit * count);

    await prisma.$transaction(async (tx) => {
      const latest = await tx.buyerMarket.findUnique({ where: { trade_uuid: tradeUuid } } as any);
      if (!latest) throw new Error('BuyerMarket order not found in tx');

      // 1) 从买家扣除已获得资源
      await decreaseItemCount(latest.buyer, { [requireResourceId]: { count } }, {
        actionName: `求购回滚-扣回资源 ${requireResourceId}x${count}`,
        showModifyInfo: true,
        type: ModifyItemCountType.Market,
        sendModifyEvent: true,
      }, tx);
      await invalidateInventoryCache(latest.buyer);

      // 2) 从卖家扣除已获得支付资源
      await decreaseItemCount(sellerUuid, { [payResourceId]: { count: totalAmount } }, {
        actionName: `求购回滚-扣回资金 ${totalAmount}`,
        showModifyInfo: true,
        type: ModifyItemCountType.Market,
        sendModifyEvent: true,
      }, tx);
      await invalidateInventoryCache(sellerUuid);

      // 3) 买家资金退款（加入收件箱，便于领取）
      await enqueueToHarvestBox(latest.buyer, { [payResourceId]: { count: totalAmount } }, {
        title: `求购回滚-退回资金 ${totalAmount}`,
        source: 'GM',
        sourceId: userUuid,
      }, tx as any);

      // 4) 将资源退回卖家（通过收件箱）
      await enqueueToHarvestBox(sellerUuid, { [requireResourceId]: { count } }, {
        title: `求购回滚-退回物品 ${requireResourceId}x${count}`,
        source: 'GM',
        sourceId: userUuid,
      }, tx as any);

      // 5) 更新求购订单计数与 seller_info
      const newSellerInfo = Array.isArray(sellerInfo) ? [...sellerInfo] : [];
      newSellerInfo[sellerIndex] = {
        ...newSellerInfo[sellerIndex],
        rolledBack: true,
        rollbackBy: userUuid,
        rollbackTime: new Date().toISOString(),
      };

      await tx.buyerMarket.update({
        where: { trade_uuid: tradeUuid },
        data: {
        //   done_resource_count: newDone,
        //   is_closed: newDone >= Number(latest.require_resource_count),
          seller_info: JSON.stringify(newSellerInfo),
        },
      });
    });

    await invalidateBuyerMarketCache(requireResourceId);

    emitEventToUser(data.user, "gm:rollbackBuyerMarketSubTrade:success", { tradeUuid, sellerIndex, seller: sellerUuid, count, totalAmount });
  } catch (err: any) {
    console.error("gm rollback BuyerMarket sub-trade error", err);
    emitEventToUser(data.user, "gm:rollbackBuyerMarketSubTrade:fail", { message: err.message ?? String(err) });
  }
}
