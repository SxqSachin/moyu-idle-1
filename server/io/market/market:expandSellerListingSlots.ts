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
    const expansionsDone = limits.extraSeller;

    // Determine requested scheme and its per-scheme usage
  const requestedScheme = (payload?.schemeId as any) || 'schemeA';
  // prefer per-role usage exposed by server
  const schemeUsageForThisScheme = Number((limits.schemeUsageSeller?.[requestedScheme] ?? limits.schemeUsage?.[requestedScheme] ?? 0));

    // Wrap expansion logic in a per-user lock to prevent concurrent expands
    await withUniqueLock(`market:expand:seller:${user.uuid}`, async () => {
      // Enforce global cap
      if (expansionsDone >= MARKET_LISTING_EXPANSION_MAX) {
        throw new Error('已达扩展上限');
      }

      // Enforce per-scheme cap strictly on server side
      const cap = (MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE as any)[requestedScheme as any];
      if (cap !== 'infinity' && typeof cap === 'number' && schemeUsageForThisScheme >= (cap as number)) {
        throw new Error('所选方案的可用次数已用尽');
      }

      const requirement = getMarketListingExpansionRequirement(expansionsDone, 'seller', payload?.schemeId as any, schemeUsageForThisScheme as any);

      await prisma.$transaction(async (tx) => {
        const enough = await checkResourceRequirementInDB(user.uuid, requirement, tx as any);
        if (!enough) throw new Error('资源不足，无法扩展市场上架上限');

        const dec: Record<string, { count: number }> = {} as any;
        for (const r of requirement) dec[r.id] = { count: r.count } as any;

        await decreaseItemCount(user.uuid, dec, {
          actionName: `扩展市场上架上限 (seller)`,
          showModifyInfo: true,
          type: ModifyItemCountType.Other,
          sendModifyEvent: true,
        }, tx);
        await invalidateInventoryCache(user.uuid);

        const existing = await tx.userSlotExpansion.findUnique({ where: { userUuid: user.uuid } });
        const scheme = requestedScheme;
        // map scheme to db field names
        const sellerField = `marketSellerSchemeUsage_${scheme}`;

        if (existing) {
          // increment per-scheme usage and keep aggregate in sync
          await tx.userSlotExpansion.update({
            where: { userUuid: user.uuid },
            data: {
              // only increment the per-scheme usage. Do NOT increment the legacy aggregate
              // field here (extraMarketMaxSellerTransactions) because the aggregate used by
              // getMarketListingLimits is computed as per-scheme-sum + legacy. Incrementing
              // both would double-count the expansion.
              [sellerField]: { increment: 1 },
            } as any,
          });
        } else {
          // create with default zeros and set the per-scheme field + aggregate
          const data: any = {
            userUuid: user.uuid,
            extraAffixMaxActive: 0,
            extraAffixMaxOwned: 0,
            // keep legacy aggregates at 0 for new rows; per-scheme counters represent
            // actual expansions going forward
            extraMarketMaxSellerTransactions: 0,
            extraMarketMaxBuyerTransactions: 0,
          };
          data[sellerField] = 1;
          await tx.userSlotExpansion.create({ data });
        }
      });
    });

    // re-fetch and emit success
    const newLimits = await getMarketListingLimits(user.uuid);
    emitEventToUser(user, 'market:expandSellerListingSlots:success', newLimits);
  } catch (err: any) {
    emitEventToUser(user, 'market:expandSellerListingSlots:error', { message: err?.message || String(err) });
  }
}
