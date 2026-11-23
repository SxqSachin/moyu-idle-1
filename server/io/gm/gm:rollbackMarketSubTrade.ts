import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { increaseItemCount, decreaseItemCount } from "~/server/utils/game/characterInventory";
import { invalidateMarketCache } from "~/server/utils/game/market";
import { enqueueToHarvestBox } from "~/server/utils/game/harvestBox";
import { ModifyItemCountType } from "~/shared/types/gameInventory";

/**
 * GM rollback a single sub-trade (entry in Market.buyer_info)
 * data: { tradeUuid: string, buyerIndex: number, bearer: string }
 * - buyerIndex: required, the index in the buyer_info array (0-based)
 * Behavior:
 * - Refund buyer's payment
 * - Remove purchased items from buyer and return them to seller
 * - Deduct the same payment from seller
 * - Decrement selled_resource_count and reopen the order if needed
 * - Mark the buyer_info entry with `rolledBack: true` and record rollback metadata
 */
export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ tradeUuid: string; buyerIndex: number; bearer: string }>
) {
    const userUuid = data.user.uuid;
    const { tradeUuid, buyerIndex } = data.data;

    // basic permission check: require GM flag on the requester
    const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
    if (!gmUser || !gmUser.is_gm) {
        emitEventToUser(data.user, "gm:rollbackMarketSubTrade:fail", { message: "无权限" });
        return;
    }

    if (!tradeUuid) {
        emitEventToUser(data.user, "gm:rollbackMarketSubTrade:fail", { message: "tradeUuid required" });
        return;
    }

    if (typeof buyerIndex !== 'number' || buyerIndex < 0) {
        emitEventToUser(data.user, "gm:rollbackMarketSubTrade:fail", { message: "buyerIndex required" });
        return;
    }

    try {
        const marketOrder = await prisma.market.findUnique({ where: { trade_uuid: tradeUuid } });
        if (!marketOrder) {
            emitEventToUser(data.user, "gm:rollbackMarketSubTrade:fail", { message: "Market order not found" });
            return;
        }

        const resourceId = marketOrder.sell_resource_id;
        const costResourceId = marketOrder.cost_resource_id;
        const costPerUnit = marketOrder.cost_per_unit.toNumber();

        let buyerInfo: any[] = [];
        try {
            buyerInfo = JSON.parse(marketOrder.buyer_info || '[]');
        } catch (e) {
            buyerInfo = [];
        }

        if (!Array.isArray(buyerInfo) || buyerIndex >= buyerInfo.length) {
            emitEventToUser(data.user, "gm:rollbackMarketSubTrade:fail", { message: "buyer entry not found" });
            return;
        }

        const entry = buyerInfo[buyerIndex];
        if (!entry || !entry.buyer || !entry.count) {
            emitEventToUser(data.user, "gm:rollbackMarketSubTrade:fail", { message: "invalid buyer entry" });
            return;
        }

        if (entry.rolledBack) {
            emitEventToUser(data.user, "gm:rollbackMarketSubTrade:fail", { message: "this sub-trade has already been rolled back" });
            return;
        }

        const buyerUuid = entry.buyer;
        const count = Number(entry.count);
        if (!buyerUuid || !count || count <= 0) {
            emitEventToUser(data.user, "gm:rollbackMarketSubTrade:fail", { message: "invalid buyer entry data" });
            return;
        }

        const totalAmount = Math.round(costPerUnit * count);

        // perform rollback in transaction
        await prisma.$transaction(async (tx) => {
            // re-fetch order inside tx
            const latest = await tx.market.findUnique({ where: { trade_uuid: tradeUuid } });
            if (!latest) throw new Error('Market order not found in tx');

            // 不回收至订单池：不修改 selled_resource_count / sell_resource_count，不重开订单

            // 1) remove items from buyer (gm force)
            await decreaseItemCount(buyerUuid, { [resourceId]: { count } }, {
                actionName: `交易回滚-收回物品 ${resourceId}x${count}`,
                showModifyInfo: true,
                type: ModifyItemCountType.Market,
                sendModifyEvent: true,
            }, tx);
            await invalidateInventoryCache(buyerUuid);

            // 2) refund buyer -> put refund into buyer's harvest box (so player can claim)
            await enqueueToHarvestBox(buyerUuid, { [costResourceId]: { count: totalAmount } }, {
                title: `交易回滚-退回资金 ${totalAmount}`,
                source: 'GM',
                sourceId: userUuid,
            }, tx as any);

            // 3) deduct seller funds (gm force)
            await decreaseItemCount(latest.seller, { [costResourceId]: { count: totalAmount } }, {
                actionName: `交易回滚-扣除收入 ${totalAmount}`,
                showModifyInfo: true,
                type: ModifyItemCountType.Market,
                sendModifyEvent: true,
            }, tx);
            await invalidateInventoryCache(latest.seller);

            // 4) 将物品退回卖家（通过收件箱），订单不增加可售库存
            await enqueueToHarvestBox(latest.seller, { [resourceId]: { count } }, {
                title: `交易回滚-退回物品 ${resourceId}x${count}`,
                source: 'GM',
                sourceId: userUuid,
            }, tx as any);

            // 5) update market order buyer_info and selled count
            const nBuyerInfo = Array.isArray(buyerInfo) ? [...buyerInfo] : [];
            nBuyerInfo[buyerIndex] = {
                ...nBuyerInfo[buyerIndex],
                rolledBack: true,
                rollbackBy: userUuid,
                rollbackTime: new Date().toISOString(),
            };

            await tx.market.update({
                where: { trade_uuid: tradeUuid },
                data: {
                    buyer_info: JSON.stringify(nBuyerInfo),
                    // 不修改 selled_resource_count / sell_resource_count / is_closed
                    // 如需统计准确售出量，请在消费侧过滤 buyer_info 中 rolledBack=true
                } as any,
            });
        });

        // invalidate cache
        await invalidateMarketCache(resourceId);

        emitEventToUser(data.user, "gm:rollbackMarketSubTrade:success", { tradeUuid, buyerIndex, buyer: buyerUuid, count, totalAmount });
    } catch (err: any) {
        console.error("gm rollback sub-trade error", err);
        emitEventToUser(data.user, "gm:rollbackMarketSubTrade:fail", { message: err.message ?? String(err) });
    }
}
