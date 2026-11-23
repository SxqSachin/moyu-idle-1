import { prisma } from "./db";
import { withUniqueLock } from "../../utils/lock";
import { allSkillTreeNodeMap, allSkillTrees } from "~/shared/data/skillTrees";
import type {
  SkillTreeNode,
  SkillTreeRequirement,
  SkillTreeId,
  SkillTreeNodeRuntimeInfo,
  SkillTreeSummary,
  AggregatedSkillTreeEffects,
  AggregatedBusinessEffects,
  LearnedSkillFlatItem,
} from "~/shared/types/skillTree";
import { PrismaTx } from "~/shared/types/socket/db";
import { updateActionDuration } from "./character";
import { allWorkStatus } from "~/shared/data/allCharacterStatus";
import { clone } from "~/shared/utils";
import { CharacterSkillTreePointLedger } from "~/generated/prisma";
import { emitEventToUser } from "~/server/io";
import { GameBroadcastKind, UserSkillTreeUpdateMessage } from "~/shared/types/broadcast";

/**
 * 技能树核心逻辑
 * 设计要点：
 * 1. totalEarned（可获得点数）是动态计算并写回 ledger（账本）
 * 2. totalSpent 为历史累计消耗（只增不减）
 * 3. effectiveSpent 为当前实际占用（可随撤回减少）
 * 4. available = totalEarned - effectiveSpent
 * 5. 回滚仅影响 effectiveSpent，保证可审计与数据一致性
 * 6. 并发：通过 withUniqueLock + 数据库事务避免并发竞争（防止超发或重复返还）
 * 后续：战斗层读取 getAggregatedSkillTreeEffects(...).flags 后，使用 buildSkillMechanics(flags) 生成机制运行时。
 */

// ------------------- Types -------------------

/**
 * Business Effects 设计说明：
 * 背景：希望业务模块（行动耗时 / 战斗属性等）无需维护“节点ID -> 业务加成”映射常量表。
 * 做法：在节点定义中可选提供 businessEffects(): provider。
 * provider 返回的对象中，键为业务效果名称，值为 (level:number)=>R 的函数；R 可为：
 *  - number: 聚合器以加总方式累计；
 *  - any[] : 聚合器 concat 后在特定键（如 actionDurationModify）上进行二次归并；
 * 扩展：未来可加入对象深度合并模式（例如 {stat:..., value:...}），只需在此聚合函数里添加处理逻辑。
 * 节点作者只需关注“本节点给业务的最终结果”；聚合层自动按当前加点 level 调用并整合。
 */

// ------------------- Earned Points Formula (placeholder) -------------------
// 可按平衡策划随时调整：
// battle: 基于战斗相关状态与四维属性的等级和 / 10 + 基础 5
// life: 基于生活系状态等级和 / 20 + 基础 5
/**
 * 计算某角色在某技能树下“应当拥有”的总可获得点数
 * 当前实现：battle 根据战斗相关与四维属性等级总和 /10
 * life   根据生活系技能等级总和 /20
 * 可根据平衡需求随时调整公式
 */
async function computeFormulaEarned(
  userUuid: string,
  characterUuid: string,
  treeId: SkillTreeId
): Promise<number> {
  const status = await getCharacterStatusInfo(userUuid);
  // 战斗系树（包含专精）统一按战斗公式：battle + 四维属性总和 / 10
  if (treeId === "battle") {
    const battle = status.battle.level; // parse((status as any).battle)?.level || 0;

    return Math.floor(battle / 7); // 简化: 每累计7级给1点
  } else {
    const fields = clone(allWorkStatus).filter(s => {
        return s != 'trading' && s != 'enhance' && s != 'luck'
    })

    let total = 0;
    for (const f of fields) {
        const statusLevel = status[f].level;
        total += statusLevel
    }
    return Math.floor(total / 15);
  }
}

// ------------------- Helpers -------------------
/** 计算节点当前等级已经累计投入的总成本 */
function investedCost(node: SkillTreeNode, currentLevel: number): number {
  let sum = 0;
  for (let i = 0; i < currentLevel; i++) sum += node.getLevelDef(i).cost;
  return sum;
}

/** 取得节点升到“下一等级”所需的增量点数（满级返回 null） */
function nextLevelCost(
  node: SkillTreeNode,
  currentLevel: number
): number | null {
  if (currentLevel >= node.maxLevel) return null;
  return node.getLevelDef(currentLevel).cost;
}

/**
 * 校验前置条件，返回未满足的原因列表
 * 仅在尝试升到“下一等级”时调用
 */
function checkPrerequisites(
  prereqs: SkillTreeRequirement[] | undefined,
  context: {
    nodeLevels: Record<string, number>;
    pointsSpent: number;
    attributes: Record<string, number>; // strength/intelligence... from CharacterUnitInfo
    statusLevels: Record<string, number>; // life/battle status JSON level
    currentNode?: SkillTreeNode; // 当前被检查节点定义（用于互斥判断）
    allNodes?: Readonly<SkillTreeNode[]>; // 整棵树（用于互斥展示名称，可选）
  }
): string[] {
  // unmet reasons
  if (!prereqs || prereqs.length === 0) return [];
  const reasons: string[] = [];
  for (const p of prereqs) {
    switch (p.type) {
      case "nodeLevel": {
        const lv = context.nodeLevels[p.nodeId] || 0;
        if (lv < p.level) reasons.push(`需要节点 ${p.nodeId} 等级≥${p.level}`);
        break;
      }
      case "skillPointsSpent": {
        if (context.pointsSpent < p.value)
          reasons.push(`需要已花费点数≥${p.value}`);
        break;
      }
      case "attribute": {
        const v = context.attributes[p.key] || 0;
        if (v < p.value) reasons.push(`需要属性 ${p.key} ≥${p.value}`);
        break;
      }
      case "status": {
        const lv = context.statusLevels[p.key] || 0;
        if (lv < p.value) reasons.push(`需要状态 ${p.key} 等级≥${p.value}`);
        break;
      }
      case "flag": {
        // flag requirement placeholder (could check aggregated flags if provided)
        break;
      }
      case "notWith": {
        const otherLv = context.nodeLevels[p.nodeId] || 0;
        if (otherLv > 0) reasons.push(`与节点 ${p.nodeId} 互斥`);
        break;
      }
    }
  }
  // 互斥：如果当前节点声明 mutuallyExclusiveWith，则检查是否已投资任何互斥节点
  if (
    context.currentNode?.mutuallyExclusiveWith &&
    context.currentNode.mutuallyExclusiveWith.length
  ) {
    for (const exId of context.currentNode.mutuallyExclusiveWith) {
      if ((context.nodeLevels[exId] || 0) > 0) {
        // 可选：查名称
        const name = context.allNodes?.find((n) => n.id === exId)?.name || exId;
        reasons.push(`与已解锁的互斥节点【${name}】冲突`);
      }
    }
  }
  return reasons;
}

/** 读取角色基础属性（力量/敏捷/智力/体力等） */
async function loadCharacterAttributes(
  userUuid: string,
  characterUuid: string
): Promise<Record<string, number>> {
  const unit = await prisma.characterUnitInfo.findUnique({
    where: { character_uuid: characterUuid },
  });
  if (!unit) return {};
  return {
    strength: (unit as any).strength || 0,
    dexterity: (unit as any).dexterity || 0,
    intelligence: (unit as any).intelligence || 0,
    stamina: (unit as any).stamina || 0,
    // 未来可以加入攻击/防御等
  };
}

/** 读取角色各状态等级（解析 JSON 列 level 字段） */
async function loadStatusLevels(
  userUuid: string
): Promise<Record<string, number>> {
  const st = await prisma.characterStatus.findUnique({
    where: { user_uuid: userUuid },
  });
  if (!st) return {};
  const parse = (s?: string) => {
    try {
      return s ? JSON.parse(s) : undefined;
    } catch {
      return undefined;
    }
  };
  const map: Record<string, number> = {};
  const keys = Object.keys(st);
  for (const k of keys) {
    // @ts-ignore dynamic
    const obj = parse(st[k]);
    if (obj && typeof obj.level === "number") map[k] = obj.level;
  }
  return map;
}

// ------------------- Public API -------------------
/**
 * 获取技能树概要（会：
 * 1. 确保 ledger 存在
 * 2. 重新计算 totalEarned 并写回
 * 3. 计算每个节点的当前等级、下一等级花费、可操作标志
 */
export async function getSkillTreeSummary(
  userUuid: string,
  characterUuid: string,
  treeId: SkillTreeId
): Promise<SkillTreeSummary> {
  const tree = allSkillTrees[treeId];
  if (!tree) throw new Error("未知的技能树");
  const formulaEarned = await computeFormulaEarned(
    userUuid,
    characterUuid,
    treeId
  );

  // ledger：用 upsert 避免并发重复插入导致 gap 锁/死锁
  let ledgerRow: CharacterSkillTreePointLedger | null = await prisma.characterSkillTreePointLedger.upsert({
    where: {
      char_tree_point_unique: { characterUuid, treeId },
    },
    update: {},
    create: {
      userUuid,
      characterUuid,
      treeId,
      totalEarned: 0,
      totalSpent: 0,
      effectiveSpent: 0,
      bonusEarned: 0,
      formulaEarned: 0,
    },
  });

  const totalEarned = formulaEarned + ledgerRow.bonusEarned;

  // 如果 earned 变化，可选择直接覆盖（或增量：这里直接覆盖 totalEarned）
  if (ledgerRow.totalEarned !== totalEarned) {
    await prisma.characterSkillTreePointLedger.updateMany({
      where: { characterUuid, treeId },
      data: { totalEarned, formulaEarned },
    });
    ledgerRow = await prisma.characterSkillTreePointLedger.findFirst({
      where: { characterUuid, treeId },
    });
  }

  const allocs = await prisma.characterSkillTreeNodeAlloc.findMany({
    where: { characterUuid, treeId },
  });
  const levelMap: Record<string, number> = {};
  for (const a of allocs) levelMap[a.nodeId] = a.level;

  const available = Math.max(
    0,
    ledgerRow!.totalEarned - ledgerRow!.effectiveSpent
  );
  // 精简：仅返回已学习节点（等级>0）的映射；如果没有，则 nodeLevels 为空对象（可由上层选择不返回该字段）
  const learnedEntries = Object.entries(levelMap).filter(([, lv]) => lv > 0);
  const nodeLevels: Record<string, number> = {};
  const canAllocateMap: Record<string, boolean> = {};
  const unmetReasonsMap: Record<string, string[]> = {};
  // 需要计算 canAllocate 时，需要重跑前置校验（只对还没满级节点）
  // 这里为了节省不再计算 investedCost 等，不影响判定
  for (const n of tree.nodes) {
    const currentLevel = levelMap[n.id] || 0;
    if (currentLevel >= n.maxLevel) continue; // 满级不可加
    const nextCost = nextLevelCost(n, currentLevel);
    if (nextCost == null) continue;
    const unmet = checkPrerequisites(
      n.getRequires ? n.getRequires(currentLevel + 1) : undefined,
      {
        nodeLevels: levelMap,
        pointsSpent: ledgerRow!.effectiveSpent,
        attributes: {}, // 精简：不做属性/状态复杂计算（可按需恢复）
        statusLevels: {},
        currentNode: n,
        allNodes: tree.nodes,
      }
    );
    if (unmet.length) {
      unmetReasonsMap[n.id] = unmet;
    }
    canAllocateMap[n.id] = unmet.length === 0 && available >= nextCost;
  }
  for (const [id, lv] of learnedEntries) nodeLevels[id] = lv;
  return {
    treeId,
    totalEarned: ledgerRow!.totalEarned,
    totalSpent: ledgerRow!.totalSpent,
    effectiveSpent: ledgerRow!.effectiveSpent,
    available,
    nodeLevels,
    canAllocate: canAllocateMap,
    unmetReasons: Object.keys(unmetReasonsMap).length
      ? unmetReasonsMap
      : undefined,

    formulaEarned: ledgerRow?.formulaEarned,
    bonusEarned: ledgerRow?.bonusEarned,
  }
}

/**
 * 加点：
 * 1. 锁定 (skillTree:characterUuid:treeId)
 * 2. 事务内校验前置、点数、等级上限
 * 3. 更新节点等级与 ledger（totalSpent / effectiveSpent）
 */
export async function allocateSkillTreeNode(
  userUuid: string,
  characterUuid: string,
  treeId: SkillTreeId,
  nodeId: string
) {
  const lockKey = `skillTree:${characterUuid}:${treeId}`;

  let hasEquipmentChange = false;

  let res = await withUniqueLock(lockKey, async () => {
    return prisma.$transaction(async (tx) => {
      const tree = allSkillTrees[treeId];
      if (!tree) throw new Error("未知的技能树");
      const node = tree.nodes.find((n: SkillTreeNode) => n.id === nodeId);
      if (!node) throw new Error("未知的节点");

      // ledger row（upsert 避免重复插入冲突）
      let ledgerRow: CharacterSkillTreePointLedger | null = await tx.characterSkillTreePointLedger.upsert({
        where: { char_tree_point_unique: { characterUuid, treeId } },
        update: {},
        create: {
          userUuid,
          characterUuid,
          treeId,
          totalEarned: 0,
          totalSpent: 0,
          effectiveSpent: 0,
          bonusEarned: 0,
          formulaEarned: 0,
        },
      });
      const formulaEarned = await computeFormulaEarned(
        userUuid,
        characterUuid,
        treeId
      );
      const totalEarned = formulaEarned + ledgerRow.bonusEarned;

      if (ledgerRow.totalEarned !== totalEarned) {
        await tx.characterSkillTreePointLedger.updateMany({
          where: { characterUuid, treeId },
          data: { totalEarned },
        });
        ledgerRow = await tx.characterSkillTreePointLedger.findFirst({
          where: { characterUuid, treeId },
        });
        if (!ledgerRow) throw new Error("账本更新失败");
      }

      // current level
      let alloc = await tx.characterSkillTreeNodeAlloc.findFirst({
        where: { characterUuid, treeId, nodeId },
      });
      const currentLevel = alloc?.level || 0;
      if (currentLevel >= node.maxLevel) throw new Error("已达最大等级");
      const cost = nextLevelCost(node, currentLevel)!;
      if (cost <= 0) throw new Error("配置错误：本级 cost 必须为正");

      const attributes = await loadCharacterAttributes(userUuid, characterUuid);
      const statusLevels = await loadStatusLevels(userUuid);
      // 重新加载所有 allocations (用于前置校验)
      const allNodeAllocs = await tx.characterSkillTreeNodeAlloc.findMany({
        where: { characterUuid, treeId },
      });
      const levelMap: Record<string, number> = {};
      for (const allocItem of allNodeAllocs)
        levelMap[allocItem.nodeId] = allocItem.level;
      levelMap[nodeId] = currentLevel; // 确保当前节点等级写入进行校验
      const unmetReasons = checkPrerequisites(
        node.getRequires ? node.getRequires(currentLevel + 1) : undefined,
        {
          nodeLevels: levelMap,
          pointsSpent: ledgerRow!.effectiveSpent,
          attributes,
          statusLevels,
          currentNode: node,
          allNodes: tree.nodes,
        }
      );
      if (unmetReasons.length) throw new Error(unmetReasons[0]);

      const available = Math.max(
        0,
        ledgerRow!.totalEarned - ledgerRow!.effectiveSpent
      );
      if (available < cost) throw new Error("可用点数不足");

      // apply
      if (alloc) {
        await tx.characterSkillTreeNodeAlloc.updateMany({
          where: { characterUuid, treeId, nodeId },
          data: { level: currentLevel + 1 },
        });
      } else {
        await tx.characterSkillTreeNodeAlloc.create({
          data: { userUuid, characterUuid, treeId, nodeId, level: 1 },
        });
      }
      const newTotalSpent = ledgerRow!.totalSpent + cost;
      const newEffectiveSpent = ledgerRow!.effectiveSpent + cost;
      if (newEffectiveSpent < 0) throw new Error("内部错误：effectiveSpent<0");
      if (newEffectiveSpent > totalEarned)
        throw new Error("内部错误：effectiveSpent 超出 totalEarned");

      if (treeId == 'life') {
        const [_, __, statusInfo] = await Promise.all([
          tx.characterSkillTreePointLedger.updateMany({
            where: { characterUuid, treeId },
            data: { totalSpent: newTotalSpent, effectiveSpent: newEffectiveSpent },
          }),
          updateActionDuration(characterUuid, tx),
          updateCharacterStatusInfo(characterUuid, tx),
        ])
        dispatchCharacterStatusInfo(characterUuid, statusInfo)
      } else if (treeId == 'battle') {
        const [_, statusInfo] = await Promise.all([
          tx.characterSkillTreePointLedger.updateMany({
            where: { characterUuid, treeId },
            data: { totalSpent: newTotalSpent, effectiveSpent: newEffectiveSpent },
          }),
          updateCharacterStatusInfo(characterUuid, tx),
        ])
        dispatchCharacterStatusInfo(characterUuid, statusInfo)
      }

      // 卸下所有因节点加点而被禁用的装备槽位
      if (node.disableBattleEquipSlot?.length) {
        for(const slot of node.disableBattleEquipSlot) {
          await unequipItem(characterUuid, slot, 'battle', tx)
        }
        hasEquipmentChange = true;
      }

      // 直接构造当前树的已学习节点列表，避免额外查询
      const learned: LearnedSkillFlatItem[] = [];
      for (const [nid, lv] of Object.entries(levelMap)) {
        if (lv > 0) learned.push({ treeId, nodeId: nid, level: lv });
      }
      // 当前节点已升级一级，写入最新等级
      const newLevel = currentLevel + 1;
      if (newLevel > 0) {
        const exists = learned.find((l) => l.nodeId === nodeId);
        if (exists) exists.level = newLevel;
        else learned.push({ treeId, nodeId, level: newLevel });
      }

      return { learned, hasEquipmentChange } as const;
    });
  });

  await publishGameBroadcast<UserSkillTreeUpdateMessage>({
    kind: GameBroadcastKind.USER_SKILL_TREE_UPDATED,
    userUuid: userUuid,
  });

  return res;
}

/**
 * 撤回：
 * 1. 校验节点存在且当前等级>0
 * 2. 校验无其它节点依赖当前等级（依赖的 requiredLevel >= 当前等级）
 * 3. 降级并返还 effectiveSpent 的最后一级成本
 * 4. totalSpent 不回退
 */
// export async function deallocateSkillTreeNode(userUuid: string, characterUuid: string, treeId: SkillTreeId, nodeId: string) {
//   const lockKey = `skillTree:${characterUuid}:${treeId}`;
//   return withUniqueLock(lockKey, async () => {
//     return prisma.$transaction(async (tx) => {
//       const tree = allSkillTrees[treeId];
//       if (!tree) throw new Error('未知的技能树');
//   const node = tree.nodes.find((n: SkillTreeNode) => n.id === nodeId);
//       if (!node) throw new Error('未知的节点');

//     const ledgerRow = await tx.characterSkillTreePointLedger.findFirst({ where: { characterUuid, treeId } });
//     if (!ledgerRow) throw new Error('点数账本不存在');

//   const alloc = await tx.characterSkillTreeNodeAlloc.findFirst({ where: { characterUuid, treeId, nodeId } });
//       if (!alloc || alloc.level <= 0) throw new Error('当前未加点');
//       const currentLevel = alloc.level;

//       // 依赖校验：任何节点要求此节点 level >= currentLevel 的，且其自身 level >0，禁止降级
//       const reverseDep = buildReverseDependencyMap(tree);
//       if (reverseDep[nodeId]) {
//         for (const dep of reverseDep[nodeId]) {
//           const depAlloc = await tx.characterSkillTreeNodeAlloc.findFirst({ where: { characterUuid, treeId, nodeId: dep.dependentId } });
//           if (depAlloc && depAlloc.level > 0 && dep.requiredLevel >= currentLevel) {
//             throw new Error('存在依赖该等级的节点，无法撤回');
//           }
//         }
//       }

//       // 返还当前等级的成本（最后一级）
//   const refundCost = node.getLevelDef(currentLevel - 1).cost;
//       const newLevel = currentLevel - 1;
//       if (newLevel === 0) {
//         // 可以选择删除记录，保持简单：更新为0（也可删除）
//         await tx.characterSkillTreeNodeAlloc.updateMany({ where: { characterUuid, treeId, nodeId }, data: { level: newLevel } });
//       } else {
//         await tx.characterSkillTreeNodeAlloc.updateMany({ where: { characterUuid, treeId, nodeId }, data: { level: newLevel } });
//       }
//   const newEffective = Math.max(0, ledgerRow.effectiveSpent - refundCost);
//   if (refundCost <= 0) throw new Error('配置错误：refundCost<=0');
//   if (newEffective < 0) throw new Error('内部错误：effectiveSpent<0');
//   // 注意：totalSpent 不回退，保持历史统计单调递增
//   await tx.characterSkillTreePointLedger.updateMany({ where: { characterUuid, treeId }, data: { effectiveSpent: newEffective } });

//       return getSkillTreeSummary(userUuid, characterUuid, treeId);
//     });
//   });
// }

// ------------------- Effects Aggregation -------------------
// Stat aggregation deprecated (StatEffect now only desc). Keep no-op merge for backward callers.
// function mergeEffectsInto(_acc: AggregatedSkillTreeEffects, _effects: any[]) { /* no-op */ }

// export async function getAggregatedSkillTreeEffects(userUuid: string, characterUuid: string, treeId: SkillTreeId): Promise<AggregatedSkillTreeEffects> {
//   const tree = allSkillTrees[treeId];
//   if (!tree) throw new Error('未知的技能树');
//   // 获取当前 summary（含最新 earned/levels 校准）
//   const summary = await getSkillTreeSummary(userUuid, characterUuid, treeId);
//   // 构建 levelMap 以便定位哪些等级的效果生效
//   const allocs = await prisma.characterSkillTreeNodeAlloc.findMany({ where: { characterUuid, treeId } });
//   const levelMap: Record<string, number> = {};
//   for (const a of allocs) levelMap[a.nodeId] = a.level;

//   const agg: AggregatedSkillTreeEffects = { treeId, flat: {}, percentAdd: {}, percentMul: {}, flags: [] };
//   for (const node of tree.nodes) {
//     const lv = levelMap[node.id] || 0;
//     if (lv <= 0) continue;
//     // Numeric/stat effects removed; nothing to aggregate per level.
//   }
//   return agg;
// }

/**
 * 聚合“业务效果” (businessEffects) ：
 * 规则：
 *  - 对已加点节点（level>0），若存在 node.businessEffects()，则取得 provider 对象 provider。
 *  - 遍历 provider 的键：
 *      * 若 provider[key] 是函数，调用 fn(level) 得到结果 R。
 *      * 若 R 为 number -> numbers[key] += R
 *      * 若 R 为数组  -> arrays[key] = (arrays[key] || []).concat(R)
 *  - 其它类型暂忽略（可后续扩展：对象深度 merge 等）
 *  - 返回统一结构，供业务层（如 updateAllActionDuration / 战斗属性构建）快速消费。
 */
// export async function getAggregatedSkillTreeBusinessEffects(userUuid: string, characterUuid: string, treeId: SkillTreeId): Promise<AggregatedBusinessEffects> {
//   const tree = allSkillTrees[treeId];
//   if (!tree) throw new Error('未知的技能树');
//   // 确保等级信息最新
//   await getSkillTreeSummary(userUuid, characterUuid, treeId);
//   const allocs = await prisma.characterSkillTreeNodeAlloc.findMany({ where: { characterUuid, treeId } });
//   const levelMap: Record<string, number> = {};
//   for (const a of allocs) levelMap[a.nodeId] = a.level;

//   const agg: AggregatedBusinessEffects = { treeId, numbers: {}, arrays: {}, flags: [] };
//   for (const node of tree.nodes) {
//     const lv = levelMap[node.id] || 0;
//     if (lv <= 0) continue;
//     if (!node.businessEffects) continue;
//     let provider: any;
//     try { provider = node.businessEffects(1); } catch { continue; }
//     if (!provider) continue;
//     // New contract: provider returns plain object with optional fields:
//     // { numbers?: Record<string,number>, arrays?: Record<string,any[]>, flags?: string[] }
//     // If legacy map-of-functions detected, keep fallback.
//     if (provider.numbers || provider.arrays || provider.flags) {
//       if (provider.numbers) {
//         for (const k of Object.keys(provider.numbers)) {
//           const v = provider.numbers[k];
//           if (typeof v === 'number' && !Number.isNaN(v)) agg.numbers[k] = (agg.numbers[k] || 0) + v * lv; // scale by level
//         }
//       }
//       if (provider.arrays) {
//         for (const k of Object.keys(provider.arrays)) {
//           const arr = provider.arrays[k];
//           if (Array.isArray(arr)) agg.arrays[k] = (agg.arrays[k] || []).concat(arr);
//         }
//       }
//       if (provider.flags) {
//         for (const f of provider.flags) if (!agg.flags!.includes(f)) agg.flags!.push(f);
//       }
//     } else {
//       // Legacy fallback: treat each function value as (level)=>number|array
//       for (const key of Object.keys(provider)) {
//         const val = provider[key];
//         if (typeof val === 'function') {
//           let r: any; try { r = val(lv); } catch { continue; }
//           if (typeof r === 'number') {
//             agg.numbers[key] = (agg.numbers[key] || 0) + r;
//           } else if (Array.isArray(r)) {
//             agg.arrays[key] = (agg.arrays[key] || []).concat(r);
//           }
//         }
//       }
//     }
//   }

//   // 针对 actionDurationModify 可进一步合并同 actionId 的 modify
//   if (agg.arrays.actionDurationModify) {
//     const merged: { [actionId: string]: number } = {};
//     for (const item of agg.arrays.actionDurationModify) {
//       if (!item || typeof item !== 'object') continue;
//       const { actionId, modify } = item as { actionId: string; modify: number };
//       if (!actionId || typeof modify !== 'number') continue;
//       merged[actionId] = (merged[actionId] || 0) + modify;
//     }
//     agg.arrays.actionDurationModify = Object.entries(merged).map(([actionId, modify]) => ({ actionId, modify }));
//   }

//   return agg;
// }

/**
 * resetEntireSkillTree
 * 一次性清空某角色在指定技能树上的所有加点：
 * - 删除/清零 nodeAlloc 记录（这里直接删除更干净）
 * - effectiveSpent 重置为 0（totalSpent / totalEarned 保留）
 * - 返回最新 summary（会自动重新计算 available = totalEarned - 0）
 * 并发安全：沿用与 allocate/deallocate 相同的锁 key
 */
export async function resetEntireSkillTree(
  userUuid: string,
  characterUuid: string,
  treeId: SkillTreeId
) {
  const lockKey = `skillTree:${characterUuid}:${treeId}`;
  const res = await withUniqueLock(lockKey, async () => {
    await prisma.$transaction(async (tx) => {
      const tree = allSkillTrees[treeId];
      if (!tree) throw new Error("未知的技能树");

      const allSkillTreeNodes = await tx.characterSkillTreeNodeAlloc.findMany({
        where: { characterUuid, treeId },
      });

      // 卸下所有因节点加点而被启用的装备槽位
      for (const allocNodeInfo of allSkillTreeNodes) {
        const nodeId = allocNodeInfo.nodeId;
        const node = allSkillTreeNodeMap[nodeId];

        if (node.enableBattleEquipSlot?.length) {
          for (const slot of node.enableBattleEquipSlot) {
            await unequipItem(characterUuid, slot, "battle", tx);
          }
        }
      }

      // 确保 ledger 存在
      await tx.characterSkillTreePointLedger.upsert({
        where: { char_tree_point_unique: { characterUuid, treeId } },
        update: {},
        create: {
          userUuid,
          characterUuid,
          treeId,
          totalEarned: 0,
          totalSpent: 0,
          effectiveSpent: 0,
          bonusEarned: 0,
          formulaEarned: 0,
        },
      });

      // 删除所有已加点记录
      await tx.characterSkillTreeNodeAlloc.deleteMany({
        where: { characterUuid, treeId },
      });
      // effectiveSpent 清零（保留 totalSpent 作为历史统计）
      await tx.characterSkillTreePointLedger.updateMany({
        where: { characterUuid, treeId },
        data: { effectiveSpent: 0 },
      });

      await updateActionDuration(characterUuid, tx)
      const statusInfo = await updateCharacterStatusInfo(characterUuid, tx)
      dispatchCharacterStatusInfo(characterUuid, statusInfo)

    });

    // 返回最新 summary（内部会重新计算 totalEarned 并写回 ledger）
    const summary = await getSkillTreeSummary(
      userUuid,
      characterUuid,
      treeId
    );
    return summary;
  });

  await publishGameBroadcast<UserSkillTreeUpdateMessage>({
    kind: GameBroadcastKind.USER_SKILL_TREE_UPDATED,
    userUuid: userUuid,
  });

  return res;
}

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


export async function awardSkillTreePoints(
  userUuid: string,
  characterUuid: string,
  treeId: SkillTreeId,
  delta: number,
) {
  // 目前阶段只支持正向发放（增加奖励点），不处理扣除逻辑。
  // 若未来需要支持扣除，需要：
  // 1. 设计玩家已投入但 total 将下降的补偿策略（自动回退 or 转换为 bonus）
  // 2. 添加操作来源记录（以便审计）
  // 3. 可能新增强制扣除标志（GM 用）
  if (delta === 0) return;
  if (delta < 0) {
    throw new Error("当前版本不支持扣除技能点（delta<0）");
  }
  return withUniqueLock(`skillTree:${characterUuid}:${treeId}`, async () => {
    await prisma.$transaction(async (tx) => {
      let ledger = await tx.characterSkillTreePointLedger.upsert({
        where: { char_tree_point_unique: { characterUuid, treeId } },
        update: {},
        create: {
          userUuid,
          characterUuid,
          treeId,
          formulaEarned: 0,
          bonusEarned: 0,
          totalEarned: 0,
          totalSpent: 0,
          effectiveSpent: 0,
        },
      });

      // 重新计算当前公式产出，确保使用最新状态（防止旧数据或未回填）
      const formulaEarnedNow = await computeFormulaEarned(
        userUuid,
        characterUuid,
        treeId
      );

      // 兼容旧数据：如果 totalEarned != formulaEarned + bonusEarned，则把差值视为历史 bonus 回填
      if (
        ledger.totalEarned !==
        ledger.formulaEarned + ledger.bonusEarned
      ) {
        const diff =
          ledger.totalEarned -
          (ledger.formulaEarned + ledger.bonusEarned);
        if (diff !== 0) {
          ledger = await tx.characterSkillTreePointLedger.update({
            where: { id: ledger.id },
            data: {
              bonusEarned: ledger.bonusEarned + diff,
            },
          });
        }
      }

      // 如果旧的 formulaEarned 字段落后（例如最初为 0），直接覆盖为最新公式值。
      // 若覆盖后导致 (newFormula + bonus) < effectiveSpent，说明公式回落，需要把差额转换为额外 bonus 以保证玩家现有投入不被“挤压”。
      if (ledger.formulaEarned !== formulaEarnedNow) {
        let adjustedBonus = ledger.bonusEarned;
        const projectedTotal = formulaEarnedNow + adjustedBonus;
        if (projectedTotal < ledger.effectiveSpent) {
          adjustedBonus += ledger.effectiveSpent - projectedTotal; // 补齐
        }
        ledger = await tx.characterSkillTreePointLedger.update({
          where: { id: ledger.id },
          data: {
            formulaEarned: formulaEarnedNow,
            bonusEarned: adjustedBonus,
            totalEarned: formulaEarnedNow + adjustedBonus,
          },
        });
      }

      // 正向 / 负向调整 bonus
      const newBonus = ledger.bonusEarned + delta;
      if (newBonus < 0) throw new Error("bonusEarned < 0 不合法");
      const newTotalEarned = ledger.formulaEarned + newBonus;

      // 仅当新 total 低于已占用时应该报错（只能出现在 delta < 0 或公式下降）
      if (newTotalEarned < ledger.effectiveSpent) {
        throw new Error("扣除后可用点数不足（与已分配冲突）");
      }

      ledger = await tx.characterSkillTreePointLedger.update({
        where: { id: ledger.id },
        data: {
          bonusEarned: newBonus,
          totalEarned: newTotalEarned,
        },
      });
    });
    return getSkillTreeSummary(userUuid, characterUuid, treeId); // 返回新 summary
  });
}