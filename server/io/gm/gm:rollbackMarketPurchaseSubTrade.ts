import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { increaseItemCount, decreaseItemCount } from "~/server/utils/game/characterInventory";
import { invalidateMarketCache } from "~/server/utils/game/market";
import { enqueueToHarvestBox } from "~/server/utils/game/harvestBox";
import { ModifyItemCountType } from "~/shared/types/gameInventory";

/**
 * GM rollback a single sub-trade (purchase side)
 * data: { tradeUuid: string, buyerIndex: number, bearer: string }
 * Behavior is identical to gm:rollbackMarketSubTrade but exposed as a dedicated event
 * for purchase-oriented workflows.
 */
export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ tradeUuid: string; buyerIndex: number; bearer: string }>
) {
    const userUuid = data.user.uuid;
    const { tradeUuid, buyerIndex } = data.data;

    const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
    if (!gmUser || !gmUser.is_gm) {
        emitEventToUser(data.user, "gm:rollbackMarketPurchaseSubTrade:fail", { message: "无权限" });
        return;
    }

    if (!tradeUuid) {
        emitEventToUser(data.user, "gm:rollbackMarketPurchaseSubTrade:fail", { message: "tradeUuid required" });
        return;
    }

    if (typeof buyerIndex !== 'number' || buyerIndex < 0) {
        emitEventToUser(data.user, "gm:rollbackMarketPurchaseSubTrade:fail", { message: "buyerIndex required" });
        return;
    }

    try {
        const marketOrder = await prisma.market.findUnique({ where: { trade_uuid: tradeUuid } });
        if (!marketOrder) {
            emitEventToUser(data.user, "gm:rollbackMarketPurchaseSubTrade:fail", { message: "Market order not found" });
            return;
        }

        const resourceId = marketOrder.sell_resource_id;
        const costResourceId = marketOrder.cost_resource_id;
        const costPerUnit = marketOrder.cost_per_unit.toNumber();

        let buyerInfo: any[] = [];
        try {
            buyerInfo = JSON.parse(marketOrder.buyer_info || '[]');
        } catch {
            buyerInfo = [];
        }

        if (!Array.isArray(buyerInfo) || buyerIndex >= buyerInfo.length) {
            emitEventToUser(data.user, "gm:rollbackMarketPurchaseSubTrade:fail", { message: "buyer entry not found" });
            return;
        }

        const entry = buyerInfo[buyerIndex];
        if (!entry || !entry.buyer || !entry.count) {
            emitEventToUser(data.user, "gm:rollbackMarketPurchaseSubTrade:fail", { message: "invalid buyer entry" });
            return;
        }

        if (entry.rolledBack) {
            emitEventToUser(data.user, "gm:rollbackMarketPurchaseSubTrade:fail", { message: "this sub-trade has already been rolled back" });
            return;
        }

        const buyerUuid = entry.buyer;
        const count = Number(entry.count);
        if (!buyerUuid || !count || count <= 0) {
            emitEventToUser(data.user, "gm:rollbackMarketPurchaseSubTrade:fail", { message: "invalid buyer entry data" });
            return;
        }

        const totalAmount = Math.round(costPerUnit * count);

        await prisma.$transaction(async (tx) => {
            const latest = await tx.market.findUnique({ where: { trade_uuid: tradeUuid } });
            if (!latest) throw new Error('Market order not found in tx');

            await decreaseItemCount(buyerUuid, { [resourceId]: { count } }, {
                actionName: `交易回滚-收回物品 ${resourceId}x${count}`,
                showModifyInfo: true,
                type: ModifyItemCountType.Market,
                sendModifyEvent: true,
            }, tx);
            await invalidateInventoryCache(buyerUuid);

            await enqueueToHarvestBox(buyerUuid, { [costResourceId]: { count: totalAmount } }, {
                title: `交易回滚-退回资金 ${totalAmount}`,
                source: 'GM',
                sourceId: userUuid,
            }, tx as any);

            await decreaseItemCount(latest.seller, { [costResourceId]: { count: totalAmount } }, {
                actionName: `交易回滚-扣除收入 ${totalAmount}`,
                showModifyInfo: true,
                type: ModifyItemCountType.Market,
                sendModifyEvent: true,
            }, tx);
            await invalidateInventoryCache(latest.seller);

            await enqueueToHarvestBox(latest.seller, { [resourceId]: { count } }, {
                title: `交易回滚-退回物品 ${resourceId}x${count}`,
                source: 'GM',
                sourceId: userUuid,
            }, tx as any);

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
                } as any,
            });
        });

        await invalidateMarketCache(resourceId);

        emitEventToUser(data.user, "gm:rollbackMarketPurchaseSubTrade:success", { tradeUuid, buyerIndex, buyer: buyerUuid, count, totalAmount });
    } catch (err: any) {
        console.error("gm rollback purchase sub-trade error", err);
        emitEventToUser(data.user, "gm:rollbackMarketPurchaseSubTrade:fail", { message: err.message ?? String(err) });
    }
}
