// 扩展词条“启用上限”（maxActive）+1
// - 不再消耗资源；业务方可在 TODO 位置加入自定义验证/计费逻辑
// - 递增数据库中的 extraAffixMaxActive 字段（若不存在则创建）
// - 返回新的上限与当前数量
import { DefaultEventsMap, Socket } from "socket.io";
import { emitEventToUser } from "..";
import type { GameSocketData } from "~/shared/types/socket";
import { getCharacterAffixLimits } from "~/server/utils/game/affixLimit";
import { prisma } from "~/server/utils/game/db";
import { CHARACTER_AFFIX_ACTIVE_EXPANSION_MAX, CHARACTER_AFFIX_INCREASE_ACTIVE_RESOURCE_REQUIREMENT, CHARACTER_AFFIX_INCREASE_ACTIVE_STATUS_REQUIREMENT, CHARACTER_AFFIX_MAX_ACTIVE_DEFAULT } from "~/shared/data/characterAffixConstants";
import { ResourceRequirement } from "~/shared/types/gameAction";
import { ObjectKeysTyped } from "~/shared/utils";
import { allCharacterStatus } from "~/shared/data/allCharacterStatus";
import { convertReseourceRequirementToItemModify, convertReseourceRequirementToItemModifyReadonly } from "~/shared/utils/game/requirementCheck";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { decreaseCharacterStatusLevel } from "~/server/utils/game/characterStatus";

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

    // TODO: 在这里插入业务方自定义的校验/计费/权限逻辑
    // 例如：检查用户是否已经通过某个付费流程、检查管理员授权、记录审计等
    // 如果不允许扩展，请抛出错误以阻止后续写入。

    // 事务：直接递增 extraAffixMaxActive（不消耗资源）
    await prisma.$transaction(async (tx) => {
      const limits = await getCharacterAffixLimits(user.uuid, tx);
      const currentActiveLimit= limits.maxActive;  
      const nextActiveLimit = currentActiveLimit + 1;
      if (currentActiveLimit >= CHARACTER_AFFIX_ACTIVE_EXPANSION_MAX) {
        throw new Error(`已达启用上限扩展上限（${CHARACTER_AFFIX_ACTIVE_EXPANSION_MAX}）`);
      }

      const enough = await checkResourceRequirementInDB(user.uuid, CHARACTER_AFFIX_INCREASE_ACTIVE_RESOURCE_REQUIREMENT as ResourceRequirement[], tx);
      if (!enough) throw new Error('资源不足，无法扩展祝福启用上限');

      const characterStatus = await getCharacterStatusInfo(user.uuid, tx, true);

      for(const status of ObjectKeysTyped(CHARACTER_AFFIX_INCREASE_ACTIVE_STATUS_REQUIREMENT)) {
        const charLevel = characterStatus[status].level || 0;
        const requiredLevel = CHARACTER_AFFIX_INCREASE_ACTIVE_STATUS_REQUIREMENT[status];
        if (requiredLevel  && charLevel < requiredLevel) {
          throw new Error(`角色${allCharacterStatus[status].name}等级不足，无法扩展祝福启用上限（需要${requiredLevel}级，当前${charLevel}级）`);
        }
      }

      const req = convertReseourceRequirementToItemModifyReadonly(CHARACTER_AFFIX_INCREASE_ACTIVE_RESOURCE_REQUIREMENT);
      await decreaseItemCount(user.uuid, req, {
        actionName: `扩展词条启用上限 ${currentActiveLimit} -> ${nextActiveLimit}`,
        type: ModifyItemCountType.Other,
        showModifyInfo: true,
        sendModifyEvent: true,
      }, tx);
      await invalidateInventoryCache(user.uuid);

      for(const status of ObjectKeysTyped(CHARACTER_AFFIX_INCREASE_ACTIVE_STATUS_REQUIREMENT)) {
        const requiredLevel = CHARACTER_AFFIX_INCREASE_ACTIVE_STATUS_REQUIREMENT[status];
        if (requiredLevel) {
          await decreaseCharacterStatusLevel(user.uuid, status, requiredLevel, tx)
        }
      }

      const existing = await tx.userSlotExpansion.findUnique({ where: { userUuid: user.uuid } });
      if (existing) {
        await tx.userSlotExpansion.update({ where: { userUuid: user.uuid }, data: { extraAffixMaxActive: { increment: 1 } } as any });
      } else {
        const data: any = { userUuid: user.uuid, extraAffixMaxActive: 1, extraAffixMaxOwned: 0 };
        await tx.userSlotExpansion.create({ data });
      }
    });

    // 返回新上限与当前数量
    const [owned, active] = await Promise.all([
      prisma.characterAffix.count({ where: { userUuid: user.uuid, characterUuid } }),
      prisma.characterAffix.count({ where: { userUuid: user.uuid, characterUuid, state: 'ACTIVE' as any } }),
    ]);

    const newLimits = await getCharacterAffixLimits(user.uuid);

    const latestStatus = await getCharacterStatusInfo(user.uuid, undefined, true);
    dispatchCharacterStatusInfo(user.uuid, latestStatus);

    emitEventToUser(user, 'characterAffix:expandActive:success', {
      maxActive: newLimits.maxActive,
      maxOwned: newLimits.maxOwned,
      owned,
      active,
    });
  } catch (err: any) {
    emitEventToUser(user, 'characterAffix:expandActive:error', { message: err?.message || String(err) });
  }
}
