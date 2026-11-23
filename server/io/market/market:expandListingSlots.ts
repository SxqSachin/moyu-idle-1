import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { prisma } from "~/server/utils/game/db";
import { checkResourceRequirementInDB, decreaseItemCount } from "~/server/utils/game/characterInventory";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { MARKET_LISTING_EXPANSION_MAX } from "~/shared/data/marketSlotConstants";
import { getMarketListingLimits } from "~/server/utils/game/marketLimit";
import { getMarketListingExpansionRequirement } from "~/shared/utils/marketListingExpansion";

type Payload = { type: 'seller' | 'buyer'; schemeId?: string };

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<Payload>
) {
  const { user, data: payload } = data;
  try {
    const type = payload?.type;
    if (!type || (type !== 'seller' && type !== 'buyer')) throw new Error('invalid type');

    // get current expansion count
    const limits = await getMarketListingLimits(user.uuid);
    const extraSeller = limits.extraSeller;
    const extraBuyer = limits.extraBuyer;

    const expansionsDone = type === 'seller' ? extraSeller : extraBuyer;

    if (expansionsDone >= MARKET_LISTING_EXPANSION_MAX) {
      throw new Error('已达扩展上限');
    }

  const requirement = getMarketListingExpansionRequirement(expansionsDone, payload?.schemeId as any);

    await prisma.$transaction(async (tx) => {
      const enough = await checkResourceRequirementInDB(user.uuid, requirement, tx);
      if (!enough) throw new Error('资源不足，无法扩展市场上架上限');

      const dec: Record<string, { count: number }> = {} as any;
      for (const r of requirement) dec[r.id] = { count: r.count } as any;

      await decreaseItemCount(user.uuid, dec, {
        actionName: `扩展市场上架上限 (${type})`,
        showModifyInfo: true,
        type: ModifyItemCountType.Other,
        sendModifyEvent: true,
      }, tx);
      await invalidateInventoryCache(user.uuid);

      const existing = await tx.userSlotExpansion.findUnique({ where: { userUuid: user.uuid } });
      if (existing) {
        await tx.userSlotExpansion.update({
          where: { userUuid: user.uuid },
          data: type === 'seller' ? { extraMarketMaxSellerTransactions: { increment: 1 } } : { extraMarketMaxBuyerTransactions: { increment: 1 } },
        });
      } else {
        await tx.userSlotExpansion.create({
          data: {
            userUuid: user.uuid,
            extraAffixMaxActive: 0,
            extraAffixMaxOwned: 0,
            extraMarketMaxSellerTransactions: type === 'seller' ? 1 : 0,
            extraMarketMaxBuyerTransactions: type === 'buyer' ? 1 : 0,
          }
        });
      }
    });

    // re-fetch and emit success
    const newLimits = await getMarketListingLimits(user.uuid);
    emitEventToUser(user, 'market:expandListingSlots:success', newLimits);
  } catch (err: any) {
    emitEventToUser(user, 'market:expandListingSlots:error', { message: err?.message || String(err) });
  }
}
