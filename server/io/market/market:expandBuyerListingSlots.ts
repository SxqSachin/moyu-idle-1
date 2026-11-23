import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { prisma } from "~/server/utils/game/db";
import { withUniqueLock } from "~/server/utils/lock";
import { checkResourceRequirementInDB, decreaseItemCount } from "~/server/utils/game/characterInventory";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { MARKET_LISTING_EXPANSION_MAX } from "~/shared/data/marketSlotConstants";
import { getMarketListingLimits } from "~/server/utils/game/marketLimit";
import { getMarketListingExpansionRequirement } from "~/shared/utils/marketListingExpansion";
import { MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE } from '~/shared/data/marketSlotConstants';

type Payload = { schemeId?: string };

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<Payload>
) {
  const { user, data: payload } = data;
  try {
    // get current expansion limits including per-scheme usage
    const limits = await getMarketListingLimits(user.uuid) as any;
    const expansionsDone = limits.extraBuyer;
  const requestedScheme = (payload?.schemeId as any) || 'schemeA';
  // prefer per-role usage exposed by server
  const schemeUsageForThisScheme = Number((limits.schemeUsageBuyer?.[requestedScheme] ?? limits.schemeUsage?.[requestedScheme] ?? 0));

    // Wrap with lock per-user to avoid concurrent buyer expands
    await withUniqueLock(`market:expand:buyer:${user.uuid}`, async () => {
      if (expansionsDone >= MARKET_LISTING_EXPANSION_MAX) {
        throw new Error('已达扩展上限');
      }

      const cap = (MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE as any)[requestedScheme as any];
      if (cap !== 'infinity' && typeof cap === 'number' && schemeUsageForThisScheme >= (cap as number)) {
        throw new Error('所选方案的可用次数已用尽');
      }

      const requirement = getMarketListingExpansionRequirement(expansionsDone, 'buyer', payload?.schemeId as any, schemeUsageForThisScheme as any);

      await prisma.$transaction(async (tx) => {
        const enough = await checkResourceRequirementInDB(user.uuid, requirement, tx as any);
        if (!enough) throw new Error('资源不足，无法扩展市场求购上限');

        const dec: Record<string, { count: number }> = {} as any;
        for (const r of requirement) dec[r.id] = { count: r.count } as any;

        await decreaseItemCount(user.uuid, dec, {
          actionName: `扩展市场求购上限 (buyer)`,
          showModifyInfo: true,
          type: ModifyItemCountType.Other,
          sendModifyEvent: true,
        }, tx);
        await invalidateInventoryCache(user.uuid);

        const existing = await tx.userSlotExpansion.findUnique({ where: { userUuid: user.uuid } });
        const scheme = requestedScheme;
        const buyerField = `marketBuyerSchemeUsage_${scheme}`;

        if (existing) {
          await tx.userSlotExpansion.update({
            where: { userUuid: user.uuid },
            data: {
              // only increment per-scheme counter. Do NOT increment legacy aggregate
              // extraMarketMaxBuyerTransactions to avoid double-counting.
              [buyerField]: { increment: 1 },
            } as any,
          });
        } else {
          const data: any = {
            userUuid: user.uuid,
            extraAffixMaxActive: 0,
            extraAffixMaxOwned: 0,
            extraMarketMaxSellerTransactions: 0,
            extraMarketMaxBuyerTransactions: 0,
          };
          data[buyerField] = 1;
          await tx.userSlotExpansion.create({ data });
        }
      });
    });

    // re-fetch and emit success
    const newLimits = await getMarketListingLimits(user.uuid);
    emitEventToUser(user, 'market:expandBuyerListingSlots:success', newLimits);
  } catch (err: any) {
    emitEventToUser(user, 'market:expandBuyerListingSlots:error', { message: err?.message || String(err) });
  }
}
