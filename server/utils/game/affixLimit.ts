import { CHARACTER_AFFIX_MAX_ACTIVE_DEFAULT, CHARACTER_AFFIX_MAX_OWNED_DEFAULT } from "~/shared/data/characterAffixConstants";
import { prisma } from "~/server/utils/game/db";
import { PrismaTx } from "~/shared/types/socket/db";

export type CharacterAffixLimits = {
  maxActive: number;
  maxOwned: number;
}

/**
 * 获取玩家词条上限（可被其它业务提升）
 * - 默认值来自常量
 * - 额外增量来自数据库表 UserSlotExpansion.extraAffixMaxActive / extraAffixMaxOwned
 */
export async function getCharacterAffixLimits(userUuid: string, tx?: PrismaTx): Promise<CharacterAffixLimits> {
  if (!tx) {
    tx = prisma;
  }

  let maxActive = CHARACTER_AFFIX_MAX_ACTIVE_DEFAULT;
  let maxOwned = CHARACTER_AFFIX_MAX_OWNED_DEFAULT;

  try {
    // 读取数据库中的额外增量（若不存在则视为 0）
    const row = await tx.userSlotExpansion.findUnique({
      where: { userUuid },
      select: {
        extraAffixMaxActive: true,
        extraAffixMaxOwned: true,
        affixOwnedSchemeUsage_schemeA: true,
        affixOwnedSchemeUsage_schemeB: true,
      },
    });
    const activeBonus = Number(row?.extraAffixMaxActive ?? 0);
    // Owned bonus: prefer sum of per-scheme usage counters + legacy aggregate
    const ownedBonusFromSchemes = Number(row?.affixOwnedSchemeUsage_schemeA ?? 0) + Number(row?.affixOwnedSchemeUsage_schemeB ?? 0);
    const ownedBonusLegacy = Number(row?.extraAffixMaxOwned ?? 0);
    const ownedBonus = ownedBonusFromSchemes + ownedBonusLegacy;
    if (Number.isFinite(activeBonus)) maxActive += Math.floor(activeBonus);
    if (Number.isFinite(ownedBonus)) maxOwned += Math.floor(ownedBonus);
  } catch (_) {
    // ignore db failure, fallback to defaults
  }

  if (!Number.isFinite(maxActive)) maxActive = CHARACTER_AFFIX_MAX_ACTIVE_DEFAULT;
  if (!Number.isFinite(maxOwned)) maxOwned = CHARACTER_AFFIX_MAX_OWNED_DEFAULT;

  return {
    maxActive: Math.max(0, Math.floor(maxActive)),
    maxOwned: Math.max(0, Math.floor(maxOwned)),
  };
}
