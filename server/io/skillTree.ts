import { Socket, DefaultEventsMap } from 'socket.io';
import { GameSocketData } from '~/shared/types/socket';
import { allocateSkillTreeNode, getSkillTreeSummary, resetEntireSkillTree, listAllLearnedSkillTreeNodes } from '../utils/game/skillTree';
import { emitEventToUser } from '.';
import { SkillTreeId } from '~/shared/types/skillTree';

/** 校验 treeId 是否为允许的技能树 ID */
function validateTreeId(treeId: any): treeId is SkillTreeId {
  return treeId === 'battle' || treeId === 'life';
}

/**
 * skillTree:summary
 * 请求某技能树概要信息（含所有节点的当前等级、可操作状态、点数概况）
 */
export async function handleSkillTreeSummary(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ treeId: SkillTreeId; characterUuid?: string }>
) {
  const userUuid = data.user.uuid; // 用户唯一标识
  const characterUuid = data.data?.characterUuid ?? data.user.uuid; // 角色唯一标识（未传则用 userUuid 兼容单角色）
  try {
    const { treeId } = data.data || ({} as any);
    if (!validateTreeId(treeId)) throw new Error('treeId 非法');
    const summary = await getSkillTreeSummary(userUuid, characterUuid, treeId);
    emitEventToUser(userUuid, 'skillTree:summary:success', { treeId, summary });
  } catch (e: any) {
    emitEventToUser(userUuid, 'skillTree:summary:fail', { msg: e.message || '获取失败', treeId: (data.data as any)?.treeId });
  }
}

/**
 * skillTree:allocate
 * 为指定节点提升 1 级
 */
export async function handleSkillTreeAllocate(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ treeId: SkillTreeId; nodeId: string; characterUuid?: string }>
) {
  const userUuid = data.user.uuid;
  const characterUuid = data.data?.characterUuid ?? data.user.uuid;
  try {
    const { treeId, nodeId } = data.data || ({} as any);
    if (!validateTreeId(treeId)) throw new Error('treeId 非法');
    if (typeof nodeId !== 'string' || !nodeId) throw new Error('nodeId 非法');
    const { learned, hasEquipmentChange } = await allocateSkillTreeNode(userUuid, characterUuid, treeId, nodeId);

    // emitEventToUser(userUuid, 'skillTree:allocate:success', { treeId, nodeId });

    emitEventToUser(userUuid, 'skillTree:learned:success', { learned });

    const summary = await getSkillTreeSummary(userUuid, characterUuid, treeId);
    emitEventToUser(userUuid, 'skillTree:summary:success', { treeId, summary });

    if (hasEquipmentChange) {
      const res = await getUserEquipment(characterUuid, "battle")
      emitEventToUser(characterUuid, "character:getEquipment:battle:success", res)
    }
  } catch (e: any) {
    emitEventToUser(userUuid, 'skillTree:allocate:fail', { msg: e.message || '加点失败', treeId: (data.data as any)?.treeId, nodeId: (data.data as any)?.nodeId });
  }
}

/**
 * skillTree:deallocate
 * 撤回（降低）指定节点 1 级
 */
// export async function handleSkillTreeDeallocate(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ treeId: SkillTreeId; nodeId: string; characterUuid?: string }>
// ) {
//   const userUuid = data.user.uuid;
//   const characterUuid = data.data?.characterUuid ?? data.user.uuid;
//   try {
//     const { treeId, nodeId } = data.data || ({} as any);
//     if (!validateTreeId(treeId)) throw new Error('treeId 非法');
//     if (typeof nodeId !== 'string' || !nodeId) throw new Error('nodeId 非法');
//     const summary = await deallocateSkillTreeNode(userUuid, characterUuid, treeId, nodeId);
//     emitEventToUser(userUuid, 'skillTree:deallocate:success', { treeId, nodeId, summary });
//   } catch (e: any) {
//     emitEventToUser(userUuid, 'skillTree:deallocate:fail', { msg: e.message || '撤回失败', treeId: (data.data as any)?.treeId, nodeId: (data.data as any)?.nodeId });
//   }
// }

/**
 * skillTree:effects
 * 获取某技能树已激活节点的聚合效果（汇总 flat / 百分比 / flags）
 */
// export async function handleSkillTreeEffects(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ treeId: SkillTreeId; characterUuid?: string }>
// ) {
//   const userUuid = data.user.uuid;
//   const characterUuid = data.data?.characterUuid ?? data.user.uuid;
//   try {
//     const { treeId } = data.data || ({} as any);
//     if (!validateTreeId(treeId)) throw new Error('treeId 非法');
//     const effects = await getAggregatedSkillTreeEffects(userUuid, characterUuid, treeId);
//     emitEventToUser(userUuid, 'skillTree:effects:success', { treeId, effects });
//   } catch (e: any) {
//     emitEventToUser(userUuid, 'skillTree:effects:fail', { msg: e.message || '效果获取失败', treeId: (data.data as any)?.treeId });
//   }
// }

/**
 * skillTree:reset
 * 一次性回滚/清空技能树所有已加点：
 * - 不做依赖校验（直接清空分配表 + 调整 ledger.effectiveSpent = 0）
 * - 保留 totalEarned / totalSpent 历史值，只重置 effectiveSpent
 */
export async function handleSkillTreeReset(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ treeId: SkillTreeId; characterUuid?: string }>
) {
  const userUuid = data.user.uuid;
  const characterUuid = data.data?.characterUuid ?? data.user.uuid;
  try {
    const { treeId } = data.data || ({} as any);
    if (!validateTreeId(treeId)) throw new Error('treeId 非法');
    const summary = await resetEntireSkillTree(userUuid, characterUuid, treeId);
    emitEventToUser(userUuid, 'skillTree:reset:success', { treeId, summary });

    const learned = await listAllLearnedSkillTreeNodes(characterUuid);
    emitEventToUser(userUuid, 'skillTree:learned:success', { learned });

    const res = await getUserEquipment(characterUuid, "battle")
    emitEventToUser(characterUuid, "character:getEquipment:battle:success", res)
  } catch (e:any) {
    emitEventToUser(userUuid, 'skillTree:reset:fail', { msg: e.message || '重置失败', treeId: (data.data as any)?.treeId });
  }
}

/**
 * skillTree:learned
 * 返回角色在所有技能树中已学习(等级>0)的节点扁平列表 [{treeId,nodeId,level}, ...]
 */
export async function handleSkillTreeLearned(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ characterUuid?: string }>
) {
  const userUuid = data.user.uuid;
  const characterUuid = data.data?.characterUuid ?? data.user.uuid;
  try {
    const learned = await listAllLearnedSkillTreeNodes(characterUuid);
    emitEventToUser(userUuid, 'skillTree:learned:success', { learned });
  } catch (e:any) {
    emitEventToUser(userUuid, 'skillTree:learned:fail', { msg: e.message || '获取失败' });
  }
}
