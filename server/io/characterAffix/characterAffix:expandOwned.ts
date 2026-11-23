// 扩展词条“持有上限”（maxOwned）+1
// - 校验自己角色
// - 按共享配置计算消耗，校验库存并扣除
// - 在数据库表 UserSlotExpansion 中递增 extraAffixMaxOwned
// - 回传新上限与当前数量
import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { getCharacterAffixLimits } from "~/server/utils/game/affixLimit";
import { prisma } from "~/server/utils/game/db";
import { withUniqueLock } from "~/server/utils/lock";
import { convertItemCountInfoToResourceRequirement } from "~/shared/utils/game/requirementCheck";
import { checkResourceRequirementInDB, decreaseItemCount, increaseItemCount } from "~/server/utils/game/characterInventory";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { CHARACTER_AFFIX_MAX_OWNED_DEFAULT, CHARACTER_AFFIX_OWNED_EXPANSION_MAX, CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_MAX_USABLE, CHARACTER_AFFIX_OWNED_EXPANSION_SCHEMES, type AffixOwnedExpansionSchemeId } from "~/shared/data/characterAffixConstants";
import { getCharacterAffixOwnedExpansionRequirement } from "~/shared/utils/characterAffixOwnedExpansion";

// 不再使用 Redis 托管上限增量，统一改为数据库持久化

type Payload = { characterUuid: string; schemeId?: 'schemeA' | 'schemeB' };

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<Payload>
) {
  const { user, data: payload } = data;
  try {
    const characterUuid = String(payload?.characterUuid || '').trim();
    if (!characterUuid || characterUuid !== user.uuid) {
      throw new Error('无效的角色标识');
    }

    // Use distributed lock per-character to avoid concurrent expansions that may overshoot caps
    await withUniqueLock(`char-affix:${characterUuid}`, async () => {
      // 当前上限
      const limits = await getCharacterAffixLimits(user.uuid);
      const currentOwnedLimit = limits.maxOwned;

      if (currentOwnedLimit >= CHARACTER_AFFIX_OWNED_EXPANSION_MAX) {
        throw new Error(`已达持有上限扩展上限（${CHARACTER_AFFIX_OWNED_EXPANSION_MAX}）`);
      }

      const nextOwnedLimit = currentOwnedLimit + 1;

      // Read per-scheme usage so we can compute per-scheme requirements and enforce caps
      const existingRow = await prisma.userSlotExpansion.findUnique({ where: { userUuid: user.uuid }, select: { affixOwnedSchemeUsage_schemeA: true, affixOwnedSchemeUsage_schemeB: true } });
      const scheme = (payload?.schemeId as AffixOwnedExpansionSchemeId) || 'schemeA';
      const schemeUsageForThisScheme = Number((existingRow as any)?.[`affixOwnedSchemeUsage_${scheme}`] ?? 0);

      // Enforce per-scheme cap strictly on server side
      const cap = CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_MAX_USABLE[scheme];
      if (cap !== 'infinity' && schemeUsageForThisScheme >= (cap as number)) {
        throw new Error('所选方案的可用次数已用尽');
      }

      const requirement = getCharacterAffixOwnedExpansionRequirement(currentOwnedLimit, payload?.schemeId, schemeUsageForThisScheme);

      // 事务校验与扣费 + 扩容写入（同一事务保证一致性）
      await prisma.$transaction(async (tx) => {
        const enough = await checkResourceRequirementInDB(user.uuid, requirement, tx);
        if (!enough) throw new Error('资源不足，无法扩展祝福持有上限');

        // 将需求转换为 ItemCountInfo 以复用扣减逻辑
        const dec: Record<string, { count: number }> = {};
        for (const r of requirement) dec[r.id] = { count: r.count } as any;
        await decreaseItemCount(user.uuid, dec, {
          actionName: `扩展词条持有上限 (${currentOwnedLimit} → ${nextOwnedLimit})`,
          type: ModifyItemCountType.Other,
          showModifyInfo: true,
          sendModifyEvent: true,
        }, tx);
        await invalidateInventoryCache(user.uuid);

        // 递增数据库中的扩展量（若不存在记录则创建）
        const existing = await (tx as any).userSlotExpansion.findUnique({ where: { userUuid: user.uuid } });
        const field = `affixOwnedSchemeUsage_${scheme}`;
        if (existing) {
          // Only increment the per-scheme usage counter. Do NOT increment the legacy
          // aggregate extraAffixMaxOwned here to avoid double-counting. The overall
          // effective maxOwned is computed as sum(per-scheme) + extraAffixMaxOwned.
          await (tx as any).userSlotExpansion.update({
            where: { userUuid: user.uuid },
            data: {
              [field]: { increment: 1 },
            } as any,
          });
        } else {
          const data: any = { userUuid: user.uuid, extraAffixMaxActive: 0, extraAffixMaxOwned: 0 };
          data[field] = 1;
          await (tx as any).userSlotExpansion.create({ data });
        }
      });
    });

    // 返回新上限与当前数量
    const [owned, active] = await Promise.all([
      prisma.characterAffix.count({ where: { userUuid: user.uuid, characterUuid } }),
      prisma.characterAffix.count({ where: { userUuid: user.uuid, characterUuid, state: 'ACTIVE' as any } }),
    ]);

    // 重新计算上限（来源于数据库），以确保与并发/其他来源 Bonus 一致
    const newLimits = await getCharacterAffixLimits(user.uuid);

    // read per-scheme usage counters so we can return schemeUsage/schemeRemaining
    const row = await prisma.userSlotExpansion.findUnique({ where: { userUuid: user.uuid }, select: { affixOwnedSchemeUsage_schemeA: true, affixOwnedSchemeUsage_schemeB: true, extraAffixMaxOwned: true } });
    const schemeRemaining: Record<string, number | 'infinity'> = {};
    const schemeUsage: Record<string, number> = {};
    for (const s of CHARACTER_AFFIX_OWNED_EXPANSION_SCHEMES) {
      const id = s.id as AffixOwnedExpansionSchemeId;
      const used = Number((row as any)?.[`affixOwnedSchemeUsage_${id}`] ?? 0);
      schemeUsage[id] = used;
      const cap = CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_MAX_USABLE[id];
      if (cap === 'infinity') schemeRemaining[id] = 'infinity';
      else schemeRemaining[id] = Math.max(0, (cap as number) - used);
    }

    emitEventToUser(user, 'characterAffix:expandOwned:success', {
      maxOwned: newLimits.maxOwned,
      maxActive: newLimits.maxActive,
      owned,
      active,
      schemeUsage,
      schemeRemaining,
    });
  } catch (err: any) {
    emitEventToUser(user, 'characterAffix:expandOwned:error', { message: err?.message || String(err) });
  }
}
