import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import {
  emitSkillTreeSummary,
  emitSkillTreeAllocate,
  emitSkillTreeDeallocate,
  // emitSkillTreeEffects,
  emitSkillTreeReset,
  onSkillTreeSummarySuccess,
  onSkillTreeSummaryFail,
  onSkillTreeAllocateSuccess,
  onSkillTreeAllocateFail,
  // onSkillTreeDeallocateSuccess,
  // onSkillTreeDeallocateFail,
  // onSkillTreeEffectsSuccess,
  // onSkillTreeEffectsFail,
  onSkillTreeResetSuccess,
  onSkillTreeResetFail,
} from "~/api/game/socket/skillTree";
import { waitUtilConnected } from "~/api/game/socket/socket";
// 引入公共类型（不再重复声明 SkillTreeNodeRuntimeInfo）
import type {
  SkillTreeId,
  SkillTreeNodeRuntimeInfo,
  SkillTreeNode,
} from "~/shared/types/skillTree";
import {
  battleSkillTree,
  lifeSkillTree,
  allSkillTrees,
} from "~/shared/data/skillTrees";

/**
 * 技能树运行时节点信息（与后端返回保持一致，用于前端展示）
 */
// SkillTreeNodeRuntimeInfo 已在 shared/types/skillTree.ts 中定义，避免重复声明导致冲突

/** 技能树概要（summary）结构 */
// 与 shared/types 中精简版一致（重复定义为局部可控，可改为直接导入）
interface SkillTreeSummary {
  treeId: SkillTreeId;
  totalEarned: number;
  totalSpent: number;
  effectiveSpent: number;
  available: number;
  nodeLevels: Record<string, number>;
  unmetReasons?: Record<string, string[]>;
  /** 后端补充：各节点是否可加点（优先级高于前端本地推断）；仅当需要时返回 */
  canAllocate?: Record<string, boolean>;
  
  formulaEarned?: number;
  bonusEarned?: number;
}

/** 聚合后的效果结构（来自 skillTree:effects 接口） */
export interface AggregatedSkillTreeEffects {
  treeId: SkillTreeId;
  flat: Record<string, number>;
  percentAdd: Record<string, number>;
  percentMul: Record<string, number>;
  flags: string[];
}

// 已切换为真实 socket API 封装（见 ~/api/game/socket/skillTree.ts）

/**
 * useSkillTree 组合式函数：
 * - 负责管理技能树的 summary / effects / 错误状态
 * - 提供 allocate / deallocate / refresh 方法
 * - 事件命名与后端统一：skillTree:summary|allocate|deallocate|effects
 */
export function useSkillTree(treeId: SkillTreeId) {
  const isLoadingSummary = ref(false);
  const skillTreeSummary = ref<SkillTreeSummary | null>(null);
  const aggregatedEffects = ref<AggregatedSkillTreeEffects | null>(null);
  const lastErrorMessage = ref<string | null>(null);
  const selectedNodeId = ref<string | null>(null);

  /** 请求最新概要 */
  function requestSummary(opts?: { silent?: boolean }) {
    if (!opts?.silent) isLoadingSummary.value = true;
    emitSkillTreeSummary(treeId);
  }
  /** 请求聚合效果 */
  // function requestEffects() { emitSkillTreeEffects(treeId) }
  /** 加点 */
  function allocateNodeLevel(nodeId: string) {
    emitSkillTreeAllocate(treeId, nodeId);
  }
  /** 撤回 */
  // function deallocateNodeLevel(nodeId: string) {
  //   emitSkillTreeDeallocate(treeId, nodeId);
  // }
  /** 重置 */
  function resetSkillTree() {
    emitSkillTreeReset(treeId);
  }

  const sortedRuntimeNodes = computed(() => {
    if (!skillTreeSummary.value) return [];
    return Object.keys(skillTreeSummary.value.nodeLevels)
      .sort()
      .map((id) => ({
        nodeId: id,
        level: skillTreeSummary.value!.nodeLevels[id],
      }));
  });
  const availablePoints = computed(
    () => skillTreeSummary.value?.available ?? 0
  );

  // ----------------- 本地派生 runtime nodes -----------------
  // 目的：减少对后端返回冗余字段的依赖，未来后端可以仅返回 { levels: Record<nodeId, level>, totalEarned... }
  // 目前兼容现有 summary.nodes（完整形态），并在本地重新计算 investedCost / nextCost / maxLevel。

  function metaNodes(): Readonly<SkillTreeNode[]> {
    if (treeId === "battle") return battleSkillTree.nodes;
    if (treeId === "life") return lifeSkillTree.nodes;
    const t: any = (allSkillTrees as any)[treeId];
    return t?.nodes || [];
  }

  function computeInvestedCost(node: SkillTreeNode, level: number) {
    let sum = 0;
    for (let i = 0; i < level; i++) sum += node.getLevelDef(i).cost;
    return sum;
  }
  function computeNextCost(node: SkillTreeNode, level: number) {
    if (level >= node.maxLevel) return null;
    return node.getLevelDef(level).cost;
  }

  const runtimeNodes = computed<SkillTreeNodeRuntimeInfo[]>(() => {
    const meta = metaNodes();
    const summaryValue = skillTreeSummary.value;
    if (!summaryValue) return [];
    // 后端当前格式：summary.nodes 数组；未来可能精简为 { nodeLevels: Record<string,number>, unmetReasons?: Record<string,string[]> }
    // 尝试读取 levels map
    const levelMap = summaryValue.nodeLevels || {};
    const unmetReasonsMap = summaryValue.unmetReasons || {};
    const canAllocateMap = summaryValue.canAllocate || {};
    return meta.map((m) => {
      const level = levelMap[m.id] || 0;
      const investedCost = computeInvestedCost(m, level);
      const nextCost = computeNextCost(m, level);
      const unmetReasons = unmetReasonsMap[m.id] || [];
      // 如果后端提供 canAllocate 映射，优先使用；否则按本地逻辑推断
      let canAllocate: boolean;
      if (Object.prototype.hasOwnProperty.call(canAllocateMap, m.id)) {
        canAllocate = !!canAllocateMap[m.id];
      } else {
        canAllocate =
          nextCost != null &&
          unmetReasons.length === 0 &&
          availablePoints.value >= (nextCost || 0);
      }
      const canDeallocate = level > 0; // 仍未实现反向依赖（需要单独计算）
      return {
        nodeId: m.id,
        level,
        maxLevel: m.maxLevel,
        investedCost,
        nextCost,
        canAllocate,
        canDeallocate,
        unmetReasons,
      };
    });
  });

  const runtimeNodeMap = computed<Record<string, SkillTreeNodeRuntimeInfo>>(
    () => {
      const map: Record<string, SkillTreeNodeRuntimeInfo> = {};
      for (const r of runtimeNodes.value) map[r.nodeId] = r;
      return map;
    }
  );

  // ----------------- 事件处理（可替换为真实 socket.on） -----------------
  // socket 事件回调
  const unsubs: (() => void)[] = [];
  function bindSocketEvents() {
    unsubs.push(
      onSkillTreeSummarySuccess((p) => {
        if (p.treeId === treeId) {
          skillTreeSummary.value = p.summary;
          isLoadingSummary.value = false;
          lastErrorMessage.value = null;
        }
      }),
      onSkillTreeSummaryFail((p) => {
        if (!p.treeId || p.treeId === treeId) {
          lastErrorMessage.value = p.msg || "技能树加载失败";
          isLoadingSummary.value = false;
        }
      }),
      // onSkillTreeAllocateSuccess((p) => {
      //   if (p.treeId === treeId) {
      //     // skillTreeSummary.value = p.summary;
      //     requestSummary(); // 保持静默刷新
      //   }
      // }),
      onSkillTreeAllocateFail((p) => {
        if (!p.treeId || p.treeId === treeId) {
          lastErrorMessage.value = p.msg || "加点失败";
        }
      }),
      // onSkillTreeDeallocateSuccess((p)=>{ if(p.treeId===treeId){ skillTreeSummary.value=p.summary } }),
      // onSkillTreeDeallocateFail((p)=>{ if(!p.treeId || p.treeId===treeId){ lastErrorMessage.value=p.msg||'撤回失败' } }),
      // onSkillTreeEffectsSuccess((p)=>{ if(p.treeId===treeId){ aggregatedEffects.value=p.effects } }),
      // onSkillTreeEffectsFail((p)=>{ if(!p.treeId || p.treeId===treeId){ lastErrorMessage.value=p.msg||'效果获取失败' } }),
      onSkillTreeResetSuccess((p) => {
        if (p.treeId === treeId) {
          skillTreeSummary.value = p.summary;
          lastErrorMessage.value = null;
          requestSummary(); // 保持静默刷新
        }
      }),
      onSkillTreeResetFail((p) => {
        if (!p.treeId || p.treeId === treeId) {
          lastErrorMessage.value = p.msg || "重置失败";
        }
      })
    );
  }

  onMounted(async () => {
    await waitUtilConnected();
    bindSocketEvents();
    // requestSummary();
    // requestEffects()
  });
  onBeforeUnmount(() => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {
        /**/
      }
    });
  });

  return {
    // state
    isLoadingSummary,
    skillTreeSummary,
    aggregatedEffects,
    lastErrorMessage,
    selectedNodeId,
    // derived
    sortedRuntimeNodes,
    availablePoints,
    runtimeNodes,
    runtimeNodeMap,
    // actions
    requestSummary,
    // requestEffects,
    allocateNodeLevel,
    // deallocateNodeLevel,
    resetSkillTree,
    // learned skill nodes related功能请使用 useLearnedSkillNodes()
  };
}
