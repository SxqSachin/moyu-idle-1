import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { prisma } from "~/server/utils/game/db";
import { BASE_MAX_PLAYER_SHOP_ITEM_SLOT } from "~/shared/data/constant";
import {
  PLAYER_SHOP_EXPANSION_SCHEMES,
  PLAYER_SHOP_EXPANSION_SCHEME_MAX_USABLE,
  type PlayerShopExpansionSchemeId,
} from "~/shared/data/playerShopSlotConstants";
import { getPlayerShopSchemeLimitMessage } from "~/shared/data/playerShopSlotConstants";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<null>
) {
  const { user } = data;
  try {
    const row = await prisma.userSlotExpansion.findUnique({ where: { userUuid: user.uuid } });
    // compute aggregate extra from per-scheme usage + legacy field
    const perDefault = Number(row?.playerShopSchemeUsage_default ?? 0);
    const perFast = Number(row?.playerShopSchemeUsage_fast ?? 0);
    const extra = perDefault + perFast + Number(row?.extraPlayerShopItemSlots ?? 0);
    const maxSlots = BASE_MAX_PLAYER_SHOP_ITEM_SLOT + extra;

    // compute allowed schemes by inspecting per-scheme usage and also expose remaining/usage
    const allowed: string[] = [];
    const schemeUsage: Record<string, number> = {};
    const schemeRemaining: Record<string, number | 'infinity'> = {};
    const schemeLimitMessage: Record<string, string> = {};
    for (const sRaw of PLAYER_SHOP_EXPANSION_SCHEMES.map(s => s.id)) {
      const s = sRaw as PlayerShopExpansionSchemeId;
      const cap = PLAYER_SHOP_EXPANSION_SCHEME_MAX_USABLE[s];
      const used = Number((row as any)?.[`playerShopSchemeUsage_${s}`] ?? 0);
      schemeUsage[s] = used;
      // populate server-side user-facing hint for this scheme (may be empty)
      schemeLimitMessage[s] = getPlayerShopSchemeLimitMessage(s) || '';
      if (cap === 'infinity') {
        allowed.push(s);
        schemeRemaining[s] = 'infinity';
        // schemeLimitMessage[s] = getPlayerShopSchemeLimitMessage(s) || '';
        continue;
      }
      if (typeof cap === 'number') {
        if (used < cap) allowed.push(s);
        schemeRemaining[s] = Math.max(0, cap - used);
        // schemeLimitMessage[s] = getPlayerShopSchemeLimitMessage(s) || '';
      }
    }

    emitEventToUser(user, 'playerShop:getListingLimits:success', { base: BASE_MAX_PLAYER_SHOP_ITEM_SLOT, extra, maxSlots, allowedSchemes: allowed, schemeUsage, schemeRemaining, schemeLimitMessage });
  } catch (err: any) {
    emitEventToUser(user, 'playerShop:getListingLimits:error', { message: err?.message || String(err) });
  }
}
