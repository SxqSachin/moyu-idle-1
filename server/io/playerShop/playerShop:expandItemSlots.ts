import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { prisma } from "~/server/utils/game/db";
import { withUniqueLock } from "~/server/utils/lock";
import { checkResourceRequirementInDB, decreaseItemCount } from "~/server/utils/game/characterInventory";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { PLAYER_SHOP_EXPANSION_MAX, PLAYER_SHOP_EXPANSION_SCHEME_MAX_USABLE, PLAYER_SHOP_EXPANSION_SCHEMES, type PlayerShopExpansionSchemeId } from "~/shared/data/playerShopSlotConstants";
import { BASE_MAX_PLAYER_SHOP_ITEM_SLOT } from "~/shared/data/constant";
import { getPlayerShopExpansionRequirement } from "~/shared/utils/playerShopExpansion";
import { emitEventToUser as emitToUser } from "..";

type Payload = { schemeId?: string };

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<Payload>
) {
  const { user, data: payload } = data;
  try {
    // Use distributed lock keyed by user to avoid concurrent playerShop expansions
    await withUniqueLock(`playerShop:expand:${user.uuid}`, async () => {
      // read current expansions for player shop
      const row = await prisma.userSlotExpansion.findUnique({ where: { userUuid: user.uuid } });
      // compute expansions done as aggregate of per-scheme usage + legacy aggregate
      const perDefault = Number(row?.playerShopSchemeUsage_default ?? 0);
      const perFast = Number(row?.playerShopSchemeUsage_fast ?? 0);
      const expansionsDone = perDefault + perFast + Number(row?.extraPlayerShopItemSlots ?? 0);

      if (expansionsDone >= PLAYER_SHOP_EXPANSION_MAX) {
        throw new Error('已达扩展上限');
      }

      const requestedScheme = (payload?.schemeId as any) || 'default';
      const schemeUsageForThisScheme = requestedScheme === 'default' ? perDefault : perFast;
      // enforce per-scheme cap
      const cap = PLAYER_SHOP_EXPANSION_SCHEME_MAX_USABLE[requestedScheme as PlayerShopExpansionSchemeId];
      if (cap !== 'infinity' && typeof cap === 'number' && schemeUsageForThisScheme >= cap) {
        throw new Error('所选方案的可用次数已用尽');
      }

      const requirement = getPlayerShopExpansionRequirement(expansionsDone, payload?.schemeId as any, schemeUsageForThisScheme as any);

      await prisma.$transaction(async (tx) => {
        const enough = await checkResourceRequirementInDB(user.uuid, requirement, tx as any);
        if (!enough) throw new Error('资源不足，无法扩展店铺货架槽位');

        const dec: Record<string, { count: number }> = {} as any;
        for (const r of requirement) dec[r.id] = { count: r.count } as any;

        await decreaseItemCount(user.uuid, dec, {
          actionName: `扩展店铺货架槽位`,
          showModifyInfo: true,
          type: ModifyItemCountType.Other,
          sendModifyEvent: true,
        }, tx);
        await invalidateInventoryCache(user.uuid);

        const existing = await (tx as any).userSlotExpansion.findUnique({ where: { userUuid: user.uuid } });
        const scheme = requestedScheme;
        const field = `playerShopSchemeUsage_${scheme}`;

        if (existing) {
          // Increment only the per-scheme usage counter. Do NOT increment
          // extraPlayerShopItemSlots here - that field is part of the legacy
          // aggregate and getPlayerShopListingLimits sums per-scheme counters +
          // legacy. Incrementing both would add two slots instead of one.
          await (tx as any).userSlotExpansion.update({
            where: { userUuid: user.uuid },
            data: {
              [field]: { increment: 1 },
            } as any,
          });
        } else {
          const data: any = {
            userUuid: user.uuid,
            extraAffixMaxActive: 0,
            extraAffixMaxOwned: 0,
            extraMarketMaxSellerTransactions: 0,
            extraMarketMaxBuyerTransactions: 0,
            // legacy aggregate kept at 0 for new rows
            extraPlayerShopItemSlots: 0,
          };
          data[field] = 1;
          await (tx as any).userSlotExpansion.create({ data });
        }
      });
    });

    // return fresh listing limits (same shape as getListingLimits) so client can update UI accurately
    const newRow = await prisma.userSlotExpansion.findUnique({ where: { userUuid: user.uuid } });
    const perDefaultNew = Number(newRow?.playerShopSchemeUsage_default ?? 0);
    const perFastNew = Number(newRow?.playerShopSchemeUsage_fast ?? 0);
    const extraNew = perDefaultNew + perFastNew + Number(newRow?.extraPlayerShopItemSlots ?? 0);
    const maxSlotsNew = BASE_MAX_PLAYER_SHOP_ITEM_SLOT + extraNew;

    // compute allowed & remaining
    const allowedNew: string[] = [];
    const schemeUsageNew: Record<string, number> = {};
    const schemeRemainingNew: Record<string, number | 'infinity'> = {};
    for (const sRaw of PLAYER_SHOP_EXPANSION_SCHEMES.map(s => s.id)) {
      const s = sRaw as PlayerShopExpansionSchemeId;
      const cap = PLAYER_SHOP_EXPANSION_SCHEME_MAX_USABLE[s];
      const used = Number((newRow as any)?.[`playerShopSchemeUsage_${s}`] ?? 0);
      schemeUsageNew[s] = used;
      if (cap === 'infinity') {
        allowedNew.push(s);
        schemeRemainingNew[s] = 'infinity';
        continue;
      }
      if (typeof cap === 'number') {
        if (used < cap) allowedNew.push(s);
        schemeRemainingNew[s] = Math.max(0, cap - used);
      }
    }

    emitToUser(user, 'playerShop:expandItemSlots:success', { base: BASE_MAX_PLAYER_SHOP_ITEM_SLOT, extra: extraNew, maxSlots: maxSlotsNew, allowedSchemes: allowedNew, schemeUsage: schemeUsageNew, schemeRemaining: schemeRemainingNew });
  } catch (err: any) {
    emitToUser(user, 'playerShop:expandItemSlots:error', { message: err?.message || String(err) });
  }
}
