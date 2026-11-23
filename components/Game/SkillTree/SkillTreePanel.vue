<template>
  <div class="skill-tree-panel">
    <div class="toolbar flex items-center justify-between mb-[6px]">
      <h3 class="text-[13px] font-semibold">
        {{ title }}
        <small v-if="summary" class="opacity-70 ml-1 inline-flex gap-2 flex-wrap">
          <div>总技能点: {{ summary.totalEarned }} (等级奖励{{ summary.formulaEarned }} + 专精书{{ summary.bonusEarned }})</div>
          |
          <div>已使用: {{ summary.effectiveSpent }}</div>
          |
          <div>可用: {{ summary.available }}</div>
        </small>
      </h3>
      <div class="flex gap-2 items-center flex-wrap">
        <!-- <el-switch v-model="showDepsHighlight" active-text="高亮依赖" size="small" />
        <el-switch v-model="autoRelayout" active-text="自动布局" size="small" /> -->
        <!-- <el-button size="small" @click="runLayout" :loading="layoutLoading" plain>重新布局</el-button> -->
        <el-popconfirm :width="200" title="确认重置该技能树？已投入点数将全部回收" confirm-button-text="确认" cancel-button-text="取消"
          @confirm="resetTree">
          <template #reference>
            <el-button size="small" type="warning" plain>重置</el-button>
          </template>
        </el-popconfirm>
        <el-button size="small" @click="refresh" :loading="isLoadingSummary" plain>刷新</el-button>
      </div>
    </div>
    <div v-if="error" class="text-[#f87171] text-xs mb-1">{{ error }}</div>
    <div v-if="layoutError" class="text-[#fb923c] text-xs mb-1">布局错误: {{ layoutError }}</div>
    <!-- 去掉文字提示，改用 loading 遮罩避免高度闪烁 -->
    <!-- <div v-if="isLoadingSummary" class="text-xs opacity-70 mb-1">数据加载中...</div> -->
    <div v-if="!positionedNodes.length && !layoutLoading" class="text-xs opacity-70">暂无节点</div>
    <div class="canvas-wrapper" v-show="firstLayoutDone" v-loading="layoutLoading" element-loading-text="加载中"
      element-loading-background="rgba(255,255,255,0.72)">
      <!-- 强制显示滚动条: 使用自定义类 always-scrollbars -->
      <div class="canvas-scroll relative overflow-scroll max-h-[560px] border border-gray-300 dark:border-gray-600 rounded p-4" ref="scrollRef">
        <div class="canvas-inner relative mx-auto" :style="innerStyle">
          <svg :width="innerWidth" :height="innerHeight" style="position:absolute;left:0;top:0;pointer-events:none;">
            <defs>
              <marker id="arrow-tip" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 6 3 L 0 6 z" fill="#3b82f6" />
              </marker>
              <marker id="arrow-tip-active" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 6 3 L 0 6 z" fill="#f59e0b" />
              </marker>
            </defs>
            <!-- 使用 sortedEdges：保证高亮边后绘制不被覆盖 -->
            <path v-for="edge in sortedEdges" :key="edge.id" :d="edge.d" :stroke="edgeStroke(edge)" :stroke-width="edgeWidth(edge)" fill="none" stroke-linejoin="round" stroke-linecap="round" :marker-end="edgeMarker(edge)" />
          </svg>
          <SkillTreeNode v-for="n in positionedNodes" :key="n.meta.id" :meta="n.meta" :runtime="n.runtime"
            @allocate="allocate" @hover="onHover" />
        </div>
      </div>
    </div>
    <!-- 首次布局前的占位骨架（避免高度塌陷导致外层布局闪动） -->
    <div v-if="!firstLayoutDone" class="border border-[#2f2f2f] rounded min-h-[240px] relative"
      v-loading="layoutLoading" element-loading-text="加载中" element-loading-background="rgba(255,255,255,0.72)"></div>

    <!-- 总加成展示 -->
    <el-card v-if="totalEffectLines.length" shadow="never" :body-style="{ padding: '6px 8px' }" class="mb-[6px]">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="text-xs font-semibold">已获得效果: </div>
        <div class="flex gap-2 flex-wrap text-[11px] leading-[1.2]">
          <template v-for="l in totalEffectLines" :key="l.key">
             <el-tag size="small" class="!text-xs !p-2">{{ l.text }}</el-tag>
          </template>
        </div>
      </div>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { useSkillTree } from '~/composables/game/useSkillTree'
import { allSkillTrees, battleSkillTree, lifeSkillTree } from '~/shared/data/skillTrees'
import SkillTreeNode from './SkillTreeNode.vue'
// 使用 @dagrejs/dagre 进行有向层级布局
import dagre from '@dagrejs/dagre'
// computeNodeEffects 不再用于总加成展示，汇总仅需要当前等级描述
import type { SkillTreeId, SkillTreeNode as STNode, SkillTreeNodeRuntimeInfo } from '~/shared/types/skillTree'

interface Props { treeId: SkillTreeId; title?: string }
const props = defineProps<Props>()

// skill tree composable
const { isLoadingSummary, skillTreeSummary: summary, lastErrorMessage: error, allocateNodeLevel, requestSummary, resetSkillTree, runtimeNodeMap, runtimeNodes } = useSkillTree(props.treeId)

// allocate wrapper (保持静默刷新)
function allocate(id: string) {
  allocateNodeLevel(id)
  // setTimeout(() => requestSummary({ silent: true }), 30)
  // setTimeout(() => requestEffects(), 70)
}

// 基础常量（进一步缩窄节点宽度 100 -> 85 以提升密度）
const nodeWidth = 85
const nodeHeight = 84

// meta 源数据（保持引用稳定）
const metaNodes = computed(() => (props.treeId === 'battle' ? battleSkillTree.nodes : lifeSkillTree.nodes) as readonly STNode[])

// runtime map
// 直接使用组合返回的 runtimeNodeMap
const runtimeMap = runtimeNodeMap

function fallbackRuntime(id: string): SkillTreeNodeRuntimeInfo {
  return { nodeId: id, level: 0, maxLevel: 1, investedCost: 0, nextCost: null, canAllocate: false, canDeallocate: false, unmetReasons: [] }
}

// 布局状态
const layoutLoading = ref(false)
const layoutError = ref<string | null>(null)
const innerWidthPx = ref(0)
const innerHeightPx = ref(0)
// 父容器自适应放大：最小画布尺寸
const MIN_CANVAS_W = 1200
const MIN_CANVAS_H = 1200
// 保存基础（未缩放）坐标与尺寸
const baseLayoutCoords = ref<{ id: string; x: number; y: number }[]>([])
const baseSize = ref<{ w: number; h: number }>({ w: 0, h: 0 })
// 父容器尺寸
const containerW = ref<number>(0)
const containerH = ref<number>(0)

function measureContainer() {
  const el = scrollRef.value
  if (!el) return
  // clientWidth/Height 排除滚动条
  containerW.value = el.clientWidth
  containerH.value = el.clientHeight
}

function applyScaleFromContainer() {
  if (!baseSize.value.w || !baseSize.value.h) return
  measureContainer()
  const bw = baseSize.value.w
  const bh = baseSize.value.h
  // 目标参考：填满父容器，但允许比父容器更大（>= 最小值），只放大不缩小
  const targetW = Math.max(containerW.value, MIN_CANVAS_W)
  const targetH = Math.max(containerH.value, MIN_CANVAS_H)
  const scaleW = targetW / bw
  const scaleH = targetH / bh
  const scale = Math.max(1, Math.min(scaleW, scaleH))
  // 应用缩放
  layoutNodes.value = baseLayoutCoords.value.map(c => {
    const meta = (metaNodes.value as STNode[]).find(n => n.id === c.id)!
    return { ...(meta as any), __xPx: c.x * scale, __yPx: c.y * scale } as any
  })
  innerWidthPx.value = Math.max(bw * scale, MIN_CANVAS_W)
  innerHeightPx.value = Math.max(bh * scale, MIN_CANVAS_H)
}
// const autoRelayout = ref(true)
// const showDepsHighlight = ref(true)
// 承载带坐标的节点克隆，保证响应性
type PanelNode = STNode & { __xPx: number; __yPx: number }
const layoutNodes = ref<PanelNode[]>([])

// 自适应层压缩参数（后处理缩短大空隙）
const enableAdaptiveLayerCompaction = true
const maxAllowedLayerGap = 120 // px, 如果相邻层真实间距超过则回收
const targetLargeGap = 90 // 回收后的目标间距

// 运行布局：生成绝对像素 __xPx/__yPx，并进行可选层间距压缩
async function runLayout() {
  if (!import.meta.client) return
  layoutLoading.value = true
  layoutError.value = null
  try {
    // ==== 固定显式分支顺序 (Option A) ====
    // 需求：core_stamina → strength* → dex* → int* → hybrid*
    // 若未来新增分支未在列表中，则排在已知分支之后但在未标记之前
    const explicitBranchOrder = allSkillTrees[props.treeId].nodes.map(n => n.id);
    const branchPriority = (b?: string) => {
      if (!b) return 9998 // 未标记
      const idx = explicitBranchOrder.indexOf(b)
      return idx === -1 ? 9997 : idx // 未列出的已标记分支放在已知之后
    }
    const original = metaNodes.value as STNode[]
    const declIndex: Record<string, number> = {}
    original.forEach((n, i) => { declIndex[n.id] = i })
    const source = [...original]
    // .sort((a, b) => {
    //   const pa = branchPriority(a.ui?.branch)
    //   const pb = branchPriority(b.ui?.branch)
    //   if (pa !== pb) return pa - pb
    //   if (a.tier !== b.tier) return a.tier - b.tier
    //   const da = declIndex[a.id] - declIndex[b.id]
    //   if (da !== 0) return da
    //   return a.id.localeCompare(b.id)
    // })
    const list = source
    const nodesInput = list.map(n => ({ id: n.id, data: n, width: nodeWidth, height: nodeHeight }))
    const edgesInput = list.flatMap(n => {
      const reqs = n.getRequires ? (n.getRequires(1) || []) : []
      return reqs
        .filter(r => r.type === 'nodeLevel')
        .map((r: any) => ({ source: r.nodeId, target: n.id }))
    })
    const g = new dagre.graphlib.Graph({ multigraph: false })
    g.setGraph({
      nodesep: 35,
      ranksep: 45,
      align: 'UL',
      rankdir: 'TB',
      // edgesep: 125,
      // ranker: 'longest-path',
      // ranker: 'tight-tree',
      ranker: 'network-simplex',
    })
    g.setDefaultEdgeLabel(() => ({}))
    nodesInput.forEach(n => { g.setNode(n.id, { width: n.width, height: n.height }) })
    edgesInput.forEach(e => { g.setEdge(e.source, e.target) })
    dagre.layout(g)

    const coords: Record<string, { x: number, y: number, w: number, h: number }> = {}
    g.nodes().forEach((id: string) => {
      const node = g.node(id) as any
      coords[id] = { x: node?.x ?? 0, y: node?.y ?? 0, w: node?.width ?? nodeWidth, h: node?.height ?? nodeHeight }
    })
    const values = Object.values(coords)
    if (!values.length) {
      innerWidthPx.value = 0; innerHeightPx.value = 0
    } else {
      const minX = Math.min(...values.map(v => v.x))
      const minY = Math.min(...values.map(v => v.y))

      // -------- 层级压缩：根据 y 排序并计算层间空白 --------
      if (enableAdaptiveLayerCompaction) {
        // 1. 生成层分组：按原始 y 中心近似聚类（使用节点顶部 y）
        const nodesArr = Object.entries(coords).map(([id, c]) => ({ id, y: c.y, h: c.h }))
        nodesArr.sort((a, b) => a.y - b.y)
        const layers: { y: number; nodes: typeof nodesArr }[] = []
        const threshold = 40 // 认为属于同层的最大 y 差
        for (const n of nodesArr) {
          let layer = layers.find(l => Math.abs(l.y - n.y) < threshold)
          if (!layer) { layer = { y: n.y, nodes: [] as any }; layers.push(layer) }
          layer.nodes.push(n)
          // 动态调整层代表 y 为均值，减少漂移
          layer.y = layer.nodes.reduce((s, k) => s + k.y, 0) / layer.nodes.length
        }
        layers.sort((a, b) => a.y - b.y)
        // 2. 计算层间距并构建压缩偏移
        let cumulativeShift = 0
        for (let i = 1; i < layers.length; i++) {
          const prev = layers[i - 1]
          const cur = layers[i]
          const prevBottom = Math.max(...prev.nodes.map(n => coords[n.id].y + coords[n.id].h))
          const curTop = Math.min(...cur.nodes.map(n => coords[n.id].y))
          const gap = curTop - prevBottom
          if (gap > maxAllowedLayerGap) {
            const reduce = gap - targetLargeGap
            cumulativeShift += reduce
          }
          // 应用 shift 给当前层节点
          if (cumulativeShift > 0) {
            for (const nn of cur.nodes) {
              coords[nn.id].y -= cumulativeShift
            }
          }
        }
      }

      // 生成带坐标的克隆数组（不修改原始定义，保持可复用）
      // 基础未缩放尺寸（含 padding）
      const baseMaxX = Math.max(...values.map(v => (v.x - minX) + v.w)) + 16
      const baseMaxY = Math.max(...Object.values(coords).map(v => (v.y - minY) + v.h)) + 24
      baseSize.value = { w: baseMaxX, h: baseMaxY }
      // 记录基础坐标
      baseLayoutCoords.value = list.map(n => {
        const p = coords[n.id]
        if (!p) return { id: n.id, x: 0, y: 0 }
        return { id: n.id, x: p.x - minX, y: p.y - minY }
      })
      applyScaleFromContainer()
    }
    if (!values.length) layoutNodes.value = []
  } catch (e: any) {
    layoutError.value = e?.message || String(e)
  } finally {
    layoutLoading.value = false
  }
}

// 监听专精过滤变化自动布局（避免每次点数变动 summary 触发抖动）
// watch(specPredicate, () => { if (autoRelayout.value) runLayout() }, { immediate: true })

// 首次布局完成标记，防止首屏闪烁抖动
const firstLayoutDone = ref(false)
watch(layoutNodes, (val) => { if (val.length && !firstLayoutDone.value) firstLayoutDone.value = true })

// 展示节点：未完成首次布局前不渲染（避免从 fallback 坐标跳动）
const positionedNodes = computed(() => {
  if (!firstLayoutDone.value) return []
  return layoutNodes.value.map(meta => ({ meta, runtime: runtimeMap.value[meta.id] || fallbackRuntime(meta.id) }))
})

// Hover 交互
const hoverNodeId = ref<string | null>(null)
function onHover(id: string | null) { hoverNodeId.value = id }

// 边定义（使用父->子）
interface Edge { id: string; from: string; to: string; d: string }
const edges = computed<Edge[]>(() => {
  if (!layoutNodes.value.length) return []
  const present = new Set(layoutNodes.value.map(n => n.id))
  const result: Edge[] = []
  const STRAIGHT_THRESHOLD = 8
  const BUS_OFFSET = 22 // 父节点下方汇合线偏移
  const RADIUS = 6      // 拐角圆弧半径
  const TOP_INSET = 10   // 线条向下延伸(进入子节点)的像素，消除视觉空隙
  const BOTTOM_INSET = 10 // 线条向上延伸(进入父节点底部)的像素，消除视觉空隙

  // 预先把父->子需求整理，便于对每个父生成一条 bus 再分叉
  for (const parent of layoutNodes.value) {
    const parentReqChildren = layoutNodes.value.filter(ch => {
      const reqs = ch.getRequires ? (ch.getRequires(1) || []) : []
      return reqs.some(r => r.type === 'nodeLevel' && r.nodeId === parent.id)
    })
    if (!parentReqChildren.length) continue
  const parentBottomCenterX = (parent as any).__xPx + nodeWidth / 2
  // 让起点略微进入父节点边框，避免留白
  const parentBottomY = (parent as any).__yPx + nodeHeight - BOTTOM_INSET
    const busY = parentBottomY + BUS_OFFSET

    // 排序子节点，按 X 由左到右描绘分叉
    parentReqChildren.sort((a, b) => ((a as any).__xPx) - ((b as any).__xPx))

    for (const child of parentReqChildren) {
      if (!present.has(child.id)) continue
  const childTopCenterX = (child as any).__xPx + nodeWidth / 2
  // 将终点稍微下移，线条与卡片无缝衔接
  const childTopY = (child as any).__yPx + TOP_INSET

      const dx = childTopCenterX - parentBottomCenterX
      if (Math.abs(dx) <= STRAIGHT_THRESHOLD) {
        // 简单竖线 + 平滑过渡（直接一条线即可）
  const d = `M ${parentBottomCenterX} ${parentBottomY} L ${parentBottomCenterX} ${childTopY}`
        result.push({ id: parent.id + '->' + child.id, from: parent.id, to: child.id, d })
      } else {
        // 分两段：父到底部到 busY（竖线） -> bus 水平到子 X 上方 -> 下到子顶部
        // 在竖->横、横->竖转折处使用圆角 (通过两段直线+Q简化成一段曲线)
        const midVerticalEndY = busY - RADIUS
        const midHorizontalStartY = busY
        const childVerticalStartY = childTopY + RADIUS

        // 路径：下（直） -> 圆弧转向水平 -> 水平到子上方 -> 圆弧向下 -> 直线到子顶部
        const direction = dx > 0 ? 1 : -1
        const corner1CtrlX = parentBottomCenterX
        const corner1CtrlY = busY
        const corner1EndX = parentBottomCenterX + direction * RADIUS
        const corner1EndY = busY

        const corner2StartX = childTopCenterX - direction * RADIUS
        const corner2StartY = busY
        const corner2CtrlX = childTopCenterX
        const corner2CtrlY = busY

        const d = [
          // 竖直到底部靠近 bus
          `M ${parentBottomCenterX} ${parentBottomY}`,
          `L ${parentBottomCenterX} ${midVerticalEndY}`,
          // 第一圆角 Q
            `Q ${corner1CtrlX} ${corner1CtrlY} ${corner1EndX} ${corner1EndY}`,
          // 水平主干
          `L ${corner2StartX} ${busY}`,
          // 第二圆角 Q (转向下)
          `Q ${corner2CtrlX} ${corner2CtrlY} ${childTopCenterX} ${busY + RADIUS}`,
          // 竖直到节点顶部
          `L ${childTopCenterX} ${childTopY}`
        ].join(' ')
        result.push({ id: parent.id + '->' + child.id, from: parent.id, to: child.id, d })
      }
    }
  }
  return result
})

// 依赖索引映射用于高亮（父 -> 子关系, 以及反向）
const parentMap = computed<Record<string, string[]>>(() => {
  const m: Record<string, string[]> = {}
  for (const e of edges.value) { (m[e.to] ||= []).push(e.from) }
  return m
})
const childMap = computed<Record<string, string[]>>(() => {
  const m: Record<string, string[]> = {}
  for (const e of edges.value) { (m[e.from] ||= []).push(e.to) }
  return m
})

// 计算需要高亮的边：
// - 所有祖先路径（递归向上）
// - 仅下一层直接子节点的边
const highlightEdgeIds = computed<Set<string>>(() => {
  const h = hoverNodeId.value
  const set = new Set<string>()
  if (!h) return set
  // DFS 向上
  const stack = [h]
  const visited = new Set<string>([h])
  while (stack.length) {
    const cur = stack.pop()!
    const parents = parentMap.value[cur] || []
    for (const p of parents) {
      set.add(p + '->' + cur)
      if (!visited.has(p)) { visited.add(p); stack.push(p) }
    }
  }
  // 直接 children
  for (const c of (childMap.value[h] || [])) {
    set.add(h + '->' + c)
  }
  return set
})

// 对边进行排序：普通边先绘制，高亮边后绘制
const sortedEdges = computed<Edge[]>(() => {
  if (!hoverNodeId.value) return edges.value
  const hi = highlightEdgeIds.value
  return [...edges.value].sort((a, b) => {
    const da = hi.has(a.id) ? 1 : 0
    const db = hi.has(b.id) ? 1 : 0
    return da - db
  })
})

function edgeStroke(e: Edge) {
  // Hover 时优先判断高亮集合
  if (hoverNodeId.value && highlightEdgeIds.value.has(e.id)) return '#f59e0b'
  // 非高亮才考虑锁定灰色
  const toRuntime = runtimeMap.value[e.to]
  if (!hoverNodeId.value && toRuntime && toRuntime.level === 0 && (toRuntime.unmetReasons?.length || 0) > 0) {
    return '#ccc'
  }
  if (hoverNodeId.value && !highlightEdgeIds.value.has(e.id) && toRuntime && toRuntime.level === 0 && (toRuntime.unmetReasons?.length || 0) > 0) {
    // hover 状态下仍允许锁定边保持灰（区分未解锁路径），但不覆盖高亮
    return '#ccc'
  }
  // 默认颜色（无 hover 主色 / hover 次级）
  return hoverNodeId.value ? '#2563eb' : '#3b82f6'
}
function edgeWidth(e: Edge) { return highlightEdgeIds.value.has(e.id) ? 2 : 2 }
function edgeMarker(e: Edge) {
  if (highlightEdgeIds.value.has(e.id)) return 'url(#arrow-tip-active)'
  const toRuntime = runtimeMap.value[e.to]
  if (toRuntime && toRuntime.level === 0 && (toRuntime.unmetReasons?.length || 0) > 0) return ''
  return 'url(#arrow-tip)'
}

// 画布尺寸
const innerWidth = computed(() => innerWidthPx.value)
const innerHeight = computed(() => innerHeightPx.value)
const innerStyle = computed(() => ({ width: innerWidth.value + 'px', height: innerHeight.value + 'px' }))

// ---------------- 总加成聚合（每节点仅取当前等级描述，去重） ----------------
interface TotalEffectLine { key: string; text: string }
const totalEffectLines = computed<TotalEffectLine[]>(() => {
  if (!summary.value) return []
  const set = new Set<string>()
  for (const n of positionedNodes.value) {
    const lvl = n.runtime.level
    if (lvl <= 0) continue
    const def = n.meta.getLevelDef(lvl)
    const eff: any = def?.effects
    if (eff?.desc) set.add(eff.desc)
  }
  let idx = 0
  return Array.from(set).map(t => ({ key: 'e' + (idx++), text: t }))
})

// 刷新与重置
function refresh() { requestSummary(); }
async function resetTree() {
  resetSkillTree()
  // 等后端推送重置成功事件后 summary 会被替换，这里做一个延迟兜底刷新
  // setTimeout(() => refresh(), 300)
}

// 初次挂载触发一次数据加载
const scrollRef = ref<HTMLDivElement | null>(null)
onMounted(() => {
  refresh()
  runLayout()
  // 监听父容器尺寸变化
  if (typeof window !== 'undefined') {
    const ro = new ResizeObserver(() => {
      applyScaleFromContainer()
    })
    if (scrollRef.value) ro.observe(scrollRef.value)
    // 可选：窗口 resize 兜底
    window.addEventListener('resize', applyScaleFromContainer)
    onBeforeUnmount(() => {
      window.removeEventListener('resize', applyScaleFromContainer)
      if (scrollRef.value) ro.disconnect()
    })
  }
})
</script>
<style scoped>
/* 强制显示滚动条并自定义样式 */
.always-scrollbars {
  /* 覆盖 Tailwind 默认, 始终保留滚动条占位 */
  overflow: scroll;
  /* 与 overflow-scroll 类似，明确指定 */
  scrollbar-gutter: stable;
  /* 支持的浏览器减少布局抖动 */
}

/* WebKit 定制 */
.always-scrollbars::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.always-scrollbars::-webkit-scrollbar-track {
  background: #0f172a;
}

.always-scrollbars::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 6px;
}

.always-scrollbars::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>