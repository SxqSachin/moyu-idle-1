// 获取当前角色的词条上限与当前数量（只读）
// 校验点：仅允许操作自己的角色
import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { getCharacterAffixLimits } from "~/server/utils/game/affixLimit";
import { CHARACTER_AFFIX_OWNED_EXPANSION_SCHEMES, CHARACTER_AFFIX_OWNED_EXPANSION_SCHEME_MAX_USABLE, type AffixOwnedExpansionSchemeId, getCharacterAffixSchemeLimitMessage } from '~/shared/data/characterAffixConstants'
import { prisma } from "~/server/utils/game/db";

type Payload = {
  characterUuid: string
}

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

    const limits = await getCharacterAffixLimits(user.uuid);
    // read per-scheme usage counters so client can show remaining per-scheme
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
    const schemeLimitMessage: Record<string, string> = {};
    for (const s of CHARACTER_AFFIX_OWNED_EXPANSION_SCHEMES) {
      const id = s.id as AffixOwnedExpansionSchemeId;
      schemeLimitMessage[id] = getCharacterAffixSchemeLimitMessage(id) || '';
    }
    const [owned, active] = await Promise.all([
      prisma.characterAffix.count({ where: { userUuid: user.uuid, characterUuid } }),
      prisma.characterAffix.count({ where: { userUuid: user.uuid, characterUuid, state: 'ACTIVE' as any } }),
    ]);

    emitEventToUser(user, "characterAffix:getLimits:success", {
      maxActive: limits.maxActive,
      maxOwned: limits.maxOwned,
      owned,
      active,
      schemeRemaining,
      schemeUsage,
      schemeLimitMessage,
    });
  } catch (err: any) {
    emitEventToUser(user, "characterAffix:getLimits:error", { message: err?.message || String(err) });
  }
}
