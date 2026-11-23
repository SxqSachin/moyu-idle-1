import type { PrismaTx } from "~/shared/types/socket/db";
import { prisma } from "../prisma";
import type { LearnedSkillFlatItem } from "~/shared/types/skillTree";

/**
 * 列出某角色在所有技能树中已学习(等级>0)的节点及其等级。
 * 返回结构：{
 *   [treeId]: { nodeId: level, ... }
 * }
 * 说明：
 * - 仅包含已加点(>0)的节点；未出现的节点视为 0。
 * - 若某技能树完全未加点，则该 treeId 不会出现在结果中（保持精简）。
 * - 如果后续需要附带节点名称/描述，可在调用方根据 allSkillTrees[treeId].nodes 做二次映射。
 */
/** 扁平结构：[{treeId,nodeId,level}, ...] */
export async function listAllLearnedSkillTreeNodes(
  characterUuid: string,
  tx?: PrismaTx
): Promise<LearnedSkillFlatItem[]> {
  if (!tx) {
    tx = prisma;
  }
  const allocs = await tx.characterSkillTreeNodeAlloc.findMany({
    where: { characterUuid },
  });
  return allocs
    .filter((a) => a.level > 0)
    .map((a) => ({ treeId: a.treeId, nodeId: a.nodeId, level: a.level }));
}

export async function batchGetAllLearnedSkillTreeNodes(
  characterUuids: string[],
  tx?: PrismaTx
): Promise<Map<string, LearnedSkillFlatItem[]>> {
  if (!tx) {
    tx = prisma;
  }

  const allocs = await tx.characterSkillTreeNodeAlloc.findMany({
    where: { characterUuid: { in: characterUuids } },
  });

  const map = new Map<string, LearnedSkillFlatItem[]>();
  for (const a of allocs) {
    if (a.level <= 0) continue;
    if (!map.has(a.characterUuid)) {
      map.set(a.characterUuid, []);
    }
    map.get(a.characterUuid)!.push({
      treeId: a.treeId,
      nodeId: a.nodeId,
      level: a.level,
    });
  }
  return map;
}