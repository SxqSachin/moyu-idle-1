<template>
    <!-- wrapper absolutely positioned -->
    <div :style="positionStyle" @mouseenter="emit('hover', meta.id)" @mouseleave="emit('hover', null)">
        <el-popover trigger="hover" placement="top" :width="260" :show-after="380" :hide-after="20">
            <template #reference>
                <el-card shadow="hover" :body-style="{ padding: '6px', textAlign: 'center' }" body-class="flex flex-col items-center justify-center h-18"
                    style="width:85px;cursor:default;" :class="cardClass">
                    <div class="text-[11px] font-semibold leading-[14px] whitespace-break">{{ meta.name }}</div>
                    <div class="text-[10px] opacity-75 mt-1">Lv {{ runtime.level }} / {{ runtime.maxLevel }}</div>
                    <!-- 预留固定高度的操作区域，消除按钮出现/消失造成的卡片高度浮动 -->
                    <div v-if="runtime.canAllocate" class="flex items-center justify-center mt-1">
                        <el-button size="small" type="success" class="!h-[16px] !leading-[16px] !py-[1px] !px-[7px]"
                            @click.stop="emit('allocate', runtime.nodeId)">+</el-button>
                    </div>
                </el-card>
            </template>
            <div style="font-size:12px;line-height:1.4;max-height:320px;overflow:auto;">
                <div style="font-weight:600;margin-bottom:4px;">{{ meta.name }} (Lv {{ runtime.level }}/{{ runtime.maxLevel }})</div>

                <template v-if="nextEffectLines.length && runtime.nextCost != null">
                    <div style="font-weight:500;margin:6px 0 2px;">消耗专精点: {{ runtime.nextCost }}</div>
                </template>

                <el-divider class="my-2!"></el-divider>

                <template v-if="currentEffectLines.length">
                    <div style="font-weight:500;margin-bottom:2px;">当前加成:</div>
                    <ul style="padding-left:16px;margin:2px 0 6px;">
                        <li v-for="l in currentEffectLines" :key="l.text" style="list-style:disc;"  v-html="l.text.replaceAll('\n', '<br/>')"></li>
                    </ul>
                </template>
                <template v-else>
                    <div style="opacity:.7;margin-bottom:6px;">尚未获得加成</div>
                </template>
                <template v-if="nextEffectLines.length && runtime.nextCost != null">
                    <div style="font-weight:500;margin:6px 0 2px;">效果: </div>
                    <ul style="padding-left:16px;margin:2px 0 6px;">
                        <li v-for="l in nextEffectLines" :key="'n-'+l.text" style="list-style:circle;" v-html="l.text.replaceAll('\n', '<br/>')"></li>
                    </ul>
                </template>
                <div v-if="displayUnmetReasons.length" style="color:#d97706;font-weight:500;margin-top:4px;">前置未满足:
                </div>
                <ul v-if="displayUnmetReasons.length" style="padding-left:16px;margin:4px 0;">
                    <li v-for="r in displayUnmetReasons" :key="r" style="list-style:disc;">{{ r }}</li>
                </ul>
            </div>
        </el-popover>
    </div>
</template>
<script setup lang="ts">
import { battleSkillTree, lifeSkillTree } from '~/shared/data/skillTrees'
import type { SkillTreeNode, SkillTreeNodeRuntimeInfo } from '~/shared/types/skillTree'
// 只展示当前等级最终效果：不再聚合历史等级描述
import { formatNextLevelDelta } from '~/shared/utils/skillTreeEffects'

interface Props {
  runtime: SkillTreeNodeRuntimeInfo
  meta: SkillTreeNode
  colWidth?: number
  rowHeight?: number
  offsetX?: number
  offsetY?: number
}
const props = withDefaults(defineProps<Props>(), { colWidth: 140, rowHeight: 120, offsetX: 0, offsetY: 0 })
const emit = defineEmits<{ allocate: [id: string]; hover: [id: string | null] }>()

const positionStyle = computed(() => {
  // 优先使用绝对像素坐标（ELK 新版）
  if ((props.meta as any).__xPx != null && (props.meta as any).__yPx != null) {
    return {
      position: 'absolute',
      left: ((props.meta as any).__xPx + props.offsetX) + 'px',
      top: ((props.meta as any).__yPx + props.offsetY) + 'px'
    } as Record<string,string>
  }
  // 其次使用旧 elk yAbs + 列宽换算 xOverride
  const effectiveX = (props.meta as any).__xOverride != null ? (props.meta as any).__xOverride : (props.meta.ui?.x || 0)
  const x = effectiveX * props.colWidth + props.offsetX
  if ((props.meta as any).__yAbs != null) {
    const yAbs = (props.meta as any).__yAbs as number
    return { position: 'absolute', left: x + 'px', top: (yAbs + props.offsetY) + 'px' } as Record<string,string>
  }
  // 最后 fallback 到 tier 行布局
  const yShift = (props.meta as any).__yShift || 0
  const y = (props.meta.tier - 1) * props.rowHeight + props.offsetY + yShift
  return { position: 'absolute', left: x + 'px', top: y + 'px' } as Record<string,string>
})

// 当前加成：显示当前等级定义的描述（作者已按 cumulative 编写）；若 level 超出 maxLevel 安全裁剪
const currentEffectLines = computed(() => {
  const lvl = props.runtime.level
  if (lvl <= 0) return [] as { text: string }[]
  const safeLevel = Math.min(lvl, props.meta.maxLevel)
  const def = props.meta.getLevelDef(safeLevel)
  const eff: any = def?.effects
  if (eff?.desc) return [{ text: eff.desc }]
  return []
})
// 下一等级效果：只展示下一等级的定义（若已满级则为空）
const nextEffectLines = computed(() => {
  const lvl = props.runtime.level
  if (lvl >= props.meta.maxLevel) return []
  const def = props.meta.getLevelDef(lvl + 1) // lvl 是已拥有等级，下一等级 index = lvl
  const eff = def?.effects
  if (eff?.desc) return [{ text: eff.desc }]
  return []
})

// 未满足前置中文化：将原因字符串中出现的节点 ID 替换为节点中文名称
const nodeNameMap: Record<string,string> = {}
;[...battleSkillTree.nodes, ...lifeSkillTree.nodes].forEach(n => { nodeNameMap[n.id] = n.name })
// 构建一次性正则（以避免逐个替换 O(N*M)）
const nodeIdRegex = (() => {
  const ids = Object.keys(nodeNameMap)
  if (!ids.length) return null
  // 转义正则特殊字符（节点ID当前只含字母下划线，理论上安全，这里稳妥处理）
  const esc = (s:string)=> s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  return new RegExp(`\\b(${ids.map(esc).join('|')})\\b`, 'g')
})()

const displayUnmetReasons = computed(() => {
    const reasons = props.runtime.unmetReasons || []
    if (!reasons.length) return [] as string[]
    if (!nodeIdRegex) return reasons
    return reasons.map(r => r.replace(nodeIdRegex, (m) => {
        return nodeNameMap[m] || m
    }))
})

// locked 判定：当前等级为 0 且存在未满足前置（或 runtime.canAllocate=false 且有 unmetReasons）
const isLocked = computed(() => props.runtime.level === 0 && (props.runtime.unmetReasons?.length || 0) > 0)
const cardClass = computed(() => ({ 'skill-node-locked': isLocked.value }))
</script>
<style scoped lang="scss">
.skill-node-locked { 
    background-color: #ececec;

    color: #777;

    @at-root .dark & {
        background-color: #555;

        color: #aaa;
    }
}
.skill-node-locked :deep(.el-button) { opacity: 0.4; pointer-events: none; }
</style>