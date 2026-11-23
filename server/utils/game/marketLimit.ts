import { prisma } from "~/server/utils/game/db";
import {
  MARKET_BASE_SELLER,
  MARKET_BASE_BUYER,
  MARKET_LISTING_EXPANSION_SCHEMES,
  MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE,
  type MarketListingExpansionSchemeId,
} from "~/shared/data/marketSlotConstants";
import { getMarketSchemeLimitMessage } from "~/shared/data/marketSlotConstants";
import { PrismaTx } from "~/shared/types/socket/db";

export async function getMarketListingLimits(userUuid: string, tx?: PrismaTx) {
  if (!tx) {
    tx = prisma;
  }
  // read userSlotExpansion row
  const row = await tx.userSlotExpansion.findUnique({ where: { userUuid } });

  // compute aggregate extras as sum of per-scheme usage counters for backward compatibility
  const extraSeller = Number(row?.marketSellerSchemeUsage_schemeA ?? 0) + Number(row?.marketSellerSchemeUsage_schemeB ?? 0) + Number(row?.extraMarketMaxSellerTransactions ?? 0);
  const extraBuyer = Number(row?.marketBuyerSchemeUsage_schemeA ?? 0) + Number(row?.marketBuyerSchemeUsage_schemeB ?? 0) + Number(row?.extraMarketMaxBuyerTransactions ?? 0);

  // compute allowed schemes (server-side truth) by comparing each scheme's used count against its cap
  const sellerAllowed: string[] = [];
  const buyerAllowed: string[] = [];
  const schemeUsage: Record<string, number> = {};
  const schemeRemaining: Record<string, number | 'infinity'> = {};
  const schemeUsageSeller: Record<string, number> = {};
  const schemeUsageBuyer: Record<string, number> = {};
  const schemeRemainingSeller: Record<string, number | 'infinity'> = {};
  const schemeRemainingBuyer: Record<string, number | 'infinity'> = {};
  const schemeLimitMessage: Record<string, string> = {};
  for (const sRaw of MARKET_LISTING_EXPANSION_SCHEMES.map(s => s.id)) {
    const s = sRaw as MarketListingExpansionSchemeId;
    const cap = MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE[s];
    // read per-scheme usage from row (safe access)
    const sellerUsage = Number((row as any)?.[`marketSellerSchemeUsage_${s}`] ?? 0);
    const buyerUsage = Number((row as any)?.[`marketBuyerSchemeUsage_${s}`] ?? 0);
    // expose per-role usage
    schemeUsageSeller[s] = sellerUsage;
    schemeUsageBuyer[s] = buyerUsage;
    // legacy field: max across roles (kept for backward compatibility)
    schemeUsage[s] = Math.max(sellerUsage, buyerUsage);

    if (cap === 'infinity') {
      sellerAllowed.push(s);
      buyerAllowed.push(s);
      schemeRemaining[s] = 'infinity';
      schemeRemainingSeller[s] = 'infinity';
      schemeRemainingBuyer[s] = 'infinity';
      schemeLimitMessage[s] = getMarketSchemeLimitMessage(s) || '';
      continue;
    }
    if (typeof cap === 'number') {
      if (sellerUsage < cap) sellerAllowed.push(s);
      if (buyerUsage < cap) buyerAllowed.push(s);
      // expose remaining per-role and keep legacy max-based remaining for compatibility
      schemeRemainingSeller[s] = Math.max(0, cap - sellerUsage);
      schemeRemainingBuyer[s] = Math.max(0, cap - buyerUsage);
      schemeRemaining[s] = Math.max(0, cap - schemeUsage[s]);
      schemeLimitMessage[s] = getMarketSchemeLimitMessage(s) || '';
    }
  }

  return {
    maxSellerTransactions: MARKET_BASE_SELLER + extraSeller,
    maxBuyerTransactions: MARKET_BASE_BUYER + extraBuyer,
    extraSeller,
    extraBuyer,
    // arrays of scheme ids that are currently allowed for seller/buyer expansions
    allowedSellerSchemes: sellerAllowed,
    allowedBuyerSchemes: buyerAllowed,
    // role-specific usage/remaining
    schemeUsage,
    schemeRemaining,
    schemeUsageSeller,
    schemeUsageBuyer,
    schemeRemainingSeller,
    schemeRemainingBuyer,
    schemeLimitMessage,
  };
}

export default {};
