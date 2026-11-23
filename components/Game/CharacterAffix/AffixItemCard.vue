<template>
  <!-- 单个词条卡片，职责单一：展示 + 操作按钮 -->
  <el-card shadow="hover" :body-style="{ padding: '10px' }" class="w-full flex flex-col rounded-md relative">
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <!-- 标题与标记 -->
        <div class="flex items-center gap-2 mb-1">
          <span class="font-medium text-gray-800 dark:text-gray-200 truncate flex items-center gap-1 text-sm sm:text-base" :title="title">
            <AffixName :affix-id="affixId" :instance="props.affix" />
            <!-- <el-popover v-if="!compact && description" placement="bottom" trigger="hover" :width="280">
              <div class="text-xs text-gray-600 leading-5">{{ description }}</div>
              <template #reference>
                <el-icon class="text-gray-400 cursor-help">
                  <Icon name="mdi:information-outline" />
                </el-icon>
              </template>
            </el-popover> -->
          </span>
        </div>
        <!-- 第二行放置稀有度与启用状态，避免与标题抢空间 -->
        <div class="flex items-center gap-2">
          <el-tag :type="rarityTagType || undefined" size="small">{{ rarityText }}</el-tag>
          <el-tooltip v-if="!isHideDelete && stateTagText" :content="stateToggleTip" placement="top">
            <el-tag size="small" effect="plain"
              :type="localState === 'ACTIVE' ? 'success' : (localState === 'LOCKED' ? 'warning' : 'info')"
              :class="[localState === 'LOCKED' ? 'cursor-not-allowed opacity-80' : 'cursor-pointer', 'select-none']"
              @click="onClickStateTag">
              {{ stateTagText }}
            </el-tag>
          </el-tooltip>
        </div>

        <!-- 词条数值（包含当前值与范围） -->
        <div class="mt-1 space-y-1">
          <div
            v-for="row in effectRows"
            :key="row.id"
            class="flex items-center text-xs text-gray-700 dark:text-gray-200 min-w-0"
          >
            <span class="text-gray-500 truncate flex-1 min-w-0" :title="row.label">
              {{ row.label }}
              <span class="mx-1 text-gray-400">:</span>
            </span>
            <span class="font-medium whitespace-nowrap">{{ row.displayValue }}</span>
            <span v-if="!compact && row.rangeText" class="ml-2 text-[11px] text-gray-500 whitespace-nowrap">({{ row.rangeText }})</span>
          </div>
        </div>

  <!-- 描述已移动到标题信息图标的 Popover 中，节省空间 -->
      </div>

      <!-- 操作区：右上角悬浮，不占用标题行宽度 -->
  <div v-if="!compact && !isHideDelete" class="absolute top-1 right-1">
        <el-dropdown trigger="click" @command="onCommand">
          <el-button text circle class="!p-1">
            <el-icon>
              <Icon name="material-symbols:more-horiz" class="text-gray-400 text-2xl" />
            </el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :command="{ type: 'viewCost' }">
                查看消耗
              </el-dropdown-item>
              <el-dropdown-item divided :command="{ type: 'reroll' }">
                <div class="flex items-center justify-between gap-2 w-full">
                  <span>重随数值</span>
                  <el-popover placement="left" trigger="hover" :width="240">
                    <div class="text-xs leading-5">
                      <div class="font-medium mb-1">重随数值消耗</div>
                      <div class="flex flex-row flex-wrap gap-2">
                        <GameCommonItemCountInfoIconAndName v-if="rerollCost && Object.keys(rerollCost).length"
                          :item-count-info="rerollCost" :show-count="true" :show-inventory-count="true" />
                        <div v-else class="text-gray-400">无消耗</div>
                      </div>
                    </div>
                    <template #reference>
                      <el-button link type="primary" size="small" @click.stop>查看</el-button>
                    </template>
                  </el-popover>
                </div>
              </el-dropdown-item>
              <el-dropdown-item :disabled="!canRerollUp" :command="{ type: 'rerollUp' }">
                <div class="flex items-center justify-between gap-2 w-full">
                  <span>
                    随机提升数值
                    <span v-if="!canRerollUp" class="text-xs text-gray-400 ml-1">{{ rerollUpDisabledReason }}</span>
                  </span>
                  <el-popover placement="left" trigger="hover" :width="240">
                    <div class="text-xs leading-5">
                      <div class="font-medium mb-1">随机提升数值消耗</div>
                      <div class="flex flex-row flex-wrap gap-2">
                        <GameCommonItemCountInfoIconAndName v-if="rerollUpCost && Object.keys(rerollUpCost).length"
                          :item-count-info="rerollUpCost" :show-count="true" :show-inventory-count="true" />
                        <div v-else class="text-gray-400">无消耗</div>
                      </div>
                      <div class="mt-1 text-[11px] text-gray-500">仅对区间数值生效，新值严格高于当前值</div>
                    </div>
                    <template #reference>
                      <el-button link type="primary" size="small" @click.stop>查看</el-button>
                    </template>
                  </el-popover>
                </div>
              </el-dropdown-item>
              <el-dropdown-item :disabled="!canUpgradeRarity" :command="{ type: 'upgradeRarity' }">
                <div class="flex items-center justify-between gap-2 w-full">
                  <span>
                    稀有度升级
                    <span v-if="!canUpgradeRarity" class="text-xs text-gray-400 ml-1">{{ upgradeDisabledReason }}</span>
                  </span>
                  <el-popover placement="left" trigger="hover" :width="240">
                    <div class="text-xs leading-5">
                      <div class="font-medium mb-1">稀有度升级消耗</div>
                      <div class="flex flex-row flex-wrap gap-2">
                        <GameCommonItemCountInfoIconAndName v-if="upgradeRarityCost && Object.keys(upgradeRarityCost).length"
                          :item-count-info="upgradeRarityCost" :show-count="true" :show-inventory-count="true" />
                        <div v-else class="text-gray-400">无消耗</div>
                      </div>
                      <div class="mt-1 text-[11px] text-gray-500">将该词条提升到下一稀有度，数值不低于新稀有度区间下限</div>
                    </div>
                    <template #reference>
                      <el-button link type="primary" size="small" @click.stop>查看</el-button>
                    </template>
                  </el-popover>
                </div>
              </el-dropdown-item>
              <el-dropdown-item divided :command="{ type: 'remove' }">
                <span class="text-red-500">删除</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </el-card>
  <!-- 消耗详情弹窗 -->
  <el-dialog v-model="showCostDialog" title="词条操作消耗" width="380px">
    <div class="space-y-3 text-sm">
      <div>
        <div class="font-medium mb-1">重随数值消耗</div>
        <div class="flex flex-row flex-wrap gap-2">
          <GameCommonItemCountInfoIconAndName v-if="rerollCost && Object.keys(rerollCost).length"
            :item-count-info="rerollCost" :show-count="true" :show-inventory-count="true" />
          <div v-else class="text-gray-400">无消耗</div>
        </div>
      </div>
      <div>
        <div class="font-medium mb-1">随机提升数值消耗</div>
        <div class="flex flex-row flex-wrap gap-2">
          <GameCommonItemCountInfoIconAndName v-if="rerollUpCost && Object.keys(rerollUpCost).length"
            :item-count-info="rerollUpCost" :show-count="true" :show-inventory-count="true" />
          <div v-else class="text-gray-400">无消耗</div>
        </div>
        <div class="mt-1 text-[11px] text-gray-500">仅对区间数值生效，新值严格高于当前值，且不超过上限</div>
      </div>
      <!-- <div>
        <div class="font-medium mb-1">稀有度升级消耗</div>
        <div class="flex flex-row flex-wrap gap-2">
          <GameCommonItemCountInfoIconAndName v-if="upgradeRarityCost && Object.keys(upgradeRarityCost).length"
            :item-count-info="upgradeRarityCost" :show-count="true" :show-inventory-count="true" />
          <div v-else class="text-gray-400">无消耗</div>
        </div>
        <div class="mt-1 text-[11px] text-gray-500">将该词条提升到下一稀有度，数值不低于新稀有度区间下限</div>
      </div> -->
    </div>
    <template #footer>
      <el-button @click="showCostDialog = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
// 展示与操作的最小卡片组件
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CharacterAffixInstance, CharacterAffixState, RangeOrFixed } from '~/shared/types/affix'
import { affixDefinitions } from '~/shared/data/affix/definitions'
import { isNumericRange } from '~/shared/types/affix'
import { allAffixPools } from '~/shared/data/affix/pools'
import type { AffixRarity } from '~/shared/types/affix'
import AffixName from './AffixName.vue'
import { parseSeriesBaseId, nextRarity as getNextRarity, seriesAffixIdForRarity } from '~/shared/data/affix/generators'

const props = defineProps<{
  affix: CharacterAffixInstance
  compact?: boolean
  // 删除界面隐藏：隐藏启用切换和更多操作按钮
  hideDelete?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:state', v: CharacterAffixState): void
  (e: 'remove'): void
  (e: 'reroll'): void
  (e: 'reroll-up'): void
  (e: 'upgrade-rarity'): void
}>()

// 从定义里拿到显示信息（名称/描述/标签）
const def = computed(() => affixDefinitions.find(d => d.affixId === props.affix.affixId))
const affixId = computed(() => props.affix.affixId)
const title = computed(() => def.value?.name || props.affix.affixId)
const description = computed(() => def.value?.description || '')
// 是否处于删除隐藏模式
const isHideDelete = computed(() => props.hideDelete === true)
// 移除基于稀有度的显示缩放：展示定义中的原始区间
function rawRange(v: any): { min?: number; max?: number } {
  if (v == null) return {}
  if (typeof v === 'number') return { min: v, max: v }
  if (isNumericRange(v)) {
    const min = Math.min(v.min, v.max)
    const max = Math.max(v.min, v.max)
    return { min, max }
  }
  return {}
}

// 小工具：安全判断对象
function isObjectRecord(x: unknown): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x)
}

// 统一获取模板与实例中可对比的结构
function getTplEff() {
  const d = def.value as any
  const inst = props.affix as any
  const tpl = d?.effect as any
  const eff = inst?.effect as any
  const tplSe = tpl?.statusEffect as any[] | undefined
  const seList = eff?.statusEffect as any[] | undefined
  const tplPayload = (tpl?.custom ?? tpl?.payload)
  const instPayload = (eff?.custom ?? eff?.payload)
  return { tpl, eff, tplSe, seList, tplPayload, instPayload }
}

// 遍历所有“带区间的数值对”（statusEffect 与 payload/custom），对每一项调用回调
function forEachRangedPair(cb: (info: {
  kind: 'status' | 'payload'
  key: string
  current: number
  min: number
  max: number
}) => void) {
  const { tplSe, seList, tplPayload, instPayload } = getTplEff()

  // statusEffect
  if (Array.isArray(tplSe) && Array.isArray(seList)) {
    for (const se of seList) {
      const match = tplSe.find((x) => x && x.status === se?.status)
      if (!match) continue
      const vr = (match.increase ?? match.decrease) as RangeOrFixed | undefined
      const { min, max } = rawRange(vr)
      if (min == null || max == null) continue
      const cur = typeof se?.increase === 'number' ? se.increase : (typeof se?.decrease === 'number' ? se.decrease : undefined)
      if (typeof cur === 'number') {
        cb({ kind: 'status', key: String(se.status), current: cur, min: Math.min(min, max), max: Math.max(min, max) })
      }
    }
  }

  // payload/custom
  if (instPayload !== undefined && tplPayload !== undefined) {
    // number 形式
    if (typeof instPayload === 'number') {
      const vr = isObjectRecord(tplPayload) && 'value' in tplPayload ? (tplPayload as any).value : tplPayload
      const { min, max } = rawRange(vr)
      if (min != null && max != null) {
        cb({ kind: 'payload', key: 'value', current: instPayload, min: Math.min(min, max), max: Math.max(min, max) })
      }
    }
    // 对象形式
    else if (isObjectRecord(instPayload)) {
      const tplObj = isObjectRecord(tplPayload) ? (tplPayload as Record<string, any>) : {}
      for (const k of Object.keys(instPayload)) {
        const src = tplObj[k]
        const vr = isObjectRecord(src) && 'value' in src ? src.value : src
        const { min, max } = rawRange(vr)
        if (min == null || max == null) continue
        const cur = (instPayload as any)[k]
        if (typeof cur === 'number') {
          cb({ kind: 'payload', key: k, current: cur, min: Math.min(min, max), max: Math.max(min, max) })
        }
      }
    }
  }
}

// 标签过多会显臃肿，暂不展示
// const tags = computed(() => def.value?.tags || [])

// 用于可读化的键名映射（仅覆盖常用；未命中则回退为原 key）
const keyLabelMap: Record<string, string> = {
  strength: '力量',
  dexterity: '敏捷',
  intelligence: '智力',
  stamina: '体质',
  amount: '数值',
  percent: '百分比',
  perLuck: '每点幸运加成',
}

// 基础状态名映射（AllBaseCharacterStatusType 的常见项）
const statusLabelMap: Record<string, string> = {
  collecting: '收集', mining: '采矿', fishing: '钓鱼', farmingAnimal: '畜牧', farmingPlant: '种植',
  cooking: '烹饪', manufacturing: '制造', forging: '锻造', sewing: '缝制', trading: '交易', knowledge: '学识',
  exploring: '探索', mysterious: '神秘', enhance: '强化', luck: '幸运', battle: '战斗',
  strength: '力量', dexterity: '敏捷', intelligence: '智力', stamina: '耐力', attacking: '攻击', defencing: '防御',
}

// 生成“数值展示行”：合并实例当前值 + 定义中的最小/最大值
type EffectRow = {
  id: string
  label: string
  displayValue: string
  rangeText: string
}

const effectRows = computed<EffectRow[]>(() => {
  const rows: EffectRow[] = []
  const inst = props.affix
  const d = def.value
  if (!d) return rows

  // 遍历实例效果数组
  {
    const eff = (inst.effect as any) || {}
    // 现有定义普遍仅包含单个 effect 模板项，且未包含 key 字段，直接取首项
    const tpl = d.effect as any

    // 优先：按新的 statusEffect 结构渲染
    const hasStatus = Array.isArray(eff.statusEffect) && eff.statusEffect.length > 0
    if (hasStatus) {
      for (let j = 0; j < eff.statusEffect.length; j++) {
        const se = eff.statusEffect[j] as any
        const label = statusLabelMap[se.status] || se.status
        const hasInc = typeof se.increase === 'number'
        const hasDec = typeof se.decrease === 'number'
        const value = hasInc ? `+${se.increase}` : hasDec ? `-${se.decrease}` : ''
        // 从模板取范围（如果是区间或固定数，显示 min~max；否则不显示）
        let rangeText = ''
        const tplSe = (tpl as any)?.statusEffect as any[] | undefined
        if (Array.isArray(tplSe)) {
          const match = tplSe.find(x => x.status === se.status)
          if (match) {
            const v = (match.increase ?? match.decrease) as RangeOrFixed | undefined
            const { min, max } = rawRange(v)
            if (min != null && max != null) rangeText = `${min}~${max}`
          }
        }
        rows.push({
          id: `${eff.key || 'eff'}-se-${j}`,
          label,
          displayValue: value || '0',
          rangeText,
        })
      }
    } else {

    // 根据 payload 结构生成条目
    const appendRow = (propKey: string, currentVal: any, tplVal?: any, labelOverride?: string) => {
      // 计算范围（使用定义原始区间），兼容 payload 模板形如 { value, name }
      const rangeSource = (tplVal && typeof tplVal === 'object' && 'value' in tplVal) ? tplVal.value : tplVal
      const { min, max } = rawRange(rangeSource)

      const isPercent = /percent/i.test(propKey)
      const fmt = (v: any) => isPercent ? `${v}%` : `${v}`

      const label = labelOverride || keyLabelMap[propKey] || (tplVal?.name) || propKey
      const valueText = fmt(currentVal)
      const rangeText = (min != null && max != null) ? `${fmt(min)}~${fmt(max)}` : '—'

      rows.push({
        id: `${eff.key || 'eff'}-${propKey}`,
        label,
        displayValue: valueText,
        rangeText,
      })
    }

    const rawInstVar = (eff as any)?.custom ?? ((eff as any)?.payload)
    const rawTplVar = (tpl as any)?.custom ?? ((tpl as any)?.payload)
    if (rawInstVar != null && typeof rawInstVar === 'object' && !Array.isArray(rawInstVar)) {
      const obj = rawInstVar as Record<string, any>
      const tplObj = rawTplVar as Record<string, any> | undefined
      for (const k of Object.keys(obj)) {
        const t = tplObj?.[k]
        const label = (t && typeof t === 'object' && 'name' in t) ? t.name : undefined
        appendRow(k, obj[k], t, label)
      }
    } else {
      // 纯数值 payload/custom（少见场景）
      const rawTplVal = rawTplVar as any
      const label = (rawTplVal && typeof rawTplVal === 'object' && 'name' in rawTplVal) ? rawTplVal.name : undefined
      const tplVal = (rawTplVal && typeof rawTplVal === 'object' && 'value' in rawTplVal) ? rawTplVal.value : rawTplVal
      const instVal = (typeof rawInstVar === 'number') ? rawInstVar : 0
      appendRow('value', instVal, tplVal, label)
    }
    }
  }
  return rows
})

// 稀有度映射为标签类型
const rarityTagType = computed<'' | 'success' | 'warning' | 'info' | 'danger'>(() => {
  switch (props.affix.rarity) {
    case 'COMMON': return 'info'
    case 'UNCOMMON': return 'success'
    case 'RARE': return ''
    case 'EPIC': return 'warning'
    case 'LEGENDARY': return 'danger'
    default: return ''
  }
})
const rarityText = computed(() => {
  switch (props.affix.rarity) {
    case 'COMMON': return '普通'
    case 'UNCOMMON': return '罕见'
    case 'RARE': return '稀有'
    case 'EPIC': return '史诗'
    case 'LEGENDARY': return '传说'
    default: return props.affix.rarity
  }
})

const stateTagText = computed(() => {
  switch (localState.value) {
    case 'ACTIVE': return '启用'
    case 'INACTIVE': return '禁用'
    case 'LOCKED': return '锁定'
    default: return ''
  }
})

const stateToggleTip = computed(() => {
  if (localState.value === 'LOCKED') return '已锁定，无法切换'
  return localState.value === 'ACTIVE' ? '点击切换为禁用' : '点击切换为启用'
})

const localState = ref<CharacterAffixState>(props.affix.state || 'ACTIVE')
watch(() => props.affix.state, v => { if (v) localState.value = v })

function onChangeState(v: CharacterAffixState) {
  emit('update:state', v)
}

function toggleState() {
  const next: CharacterAffixState = localState.value === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  emit('update:state', next)
}

function onClickStateTag() {
  if (localState.value === 'LOCKED') return
  toggleState()
}

function onCommand(cmd: any) {
  const type = cmd?.type
  switch (type) {
    case 'toggle':
      toggleState()
      break
    case 'viewCost':
      showCostDialog.value = true
      break
    case 'reroll':
      // 若当前词条所有可重随的数值均已达上限，则提示后再继续
      if (allAtMax.value) {
        ElMessageBox.confirm(
          '该词条当前所有可重随的数值均已达上限，重随数值可能降低数值，是否继续？',
          '提示',
          {
            type: 'warning',
            confirmButtonText: '继续重随',
            cancelButtonText: '取消',
            autofocus: false,
          }
        )
          .then(() => emit('reroll'))
          .catch(() => {})
      } else {
        emit('reroll')
      }
      break
    case 'rerollUp':
      if (!canRerollUp.value) {
        ElMessage.warning(rerollUpDisabledReason.value)
        return
      }
      emit('reroll-up')
      break
    case 'upgradeRarity':
      if (!canUpgradeRarity.value) {
        ElMessage.warning(upgradeDisabledReason.value)
        return
      }
      ElMessageBox.confirm(
        '将该词条提升到下一稀有度，升级后数值不会低于新稀有度的最小值，是否继续？',
        '确认升级',
        {
          type: 'warning',
          confirmButtonText: '确认升级',
          cancelButtonText: '取消',
          autofocus: false,
        }
      ).then(() => {
        emit('upgrade-rarity')
      }).catch(() => {})
      break
    case 'remove':
      ElMessageBox.confirm('确定删除该词条？', '删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        autofocus: false,
      }).then(() => {
        emit('remove')
      }).catch(() => { })
      break
  }
}

// 计算“重抽”所需消耗：与后端一致，取第一个包含该 affix 的池的对应稀有度消耗
const rerollCost = computed<Record<string, { count: number }> | null>(() => {
  const pool = allAffixPools.find(p => p.entries.some(e => e.affixId === props.affix.affixId))
  const map = pool?.rules?.rerollCostPerRarity as (Partial<Record<AffixRarity, Record<string, { count: number }>>> | undefined)
  return map?.[props.affix.rarity as AffixRarity] ?? null
})

const rerollUpCost = computed<Record<string, { count: number }> | null>(() => {
  const pool = allAffixPools.find(p => p.entries.some(e => e.affixId === props.affix.affixId))
  const mapUp = (pool?.rules as any)?.rerollUpCostPerRarity as (Partial<Record<AffixRarity, Record<string, { count: number }>>> | undefined)
  const map = pool?.rules?.rerollCostPerRarity as (Partial<Record<AffixRarity, Record<string, { count: number }>>> | undefined)
  return (mapUp?.[props.affix.rarity as AffixRarity]) ?? (map?.[props.affix.rarity as AffixRarity]) ?? null
})

// 稀有度升级消耗：从包含该词条的池的 rules.rarityUpgradeCostPerRarity 中读取（按当前稀有度键）
const upgradeRarityCost = computed<Record<string, { count: number }> | null>(() => {
  const pool = allAffixPools.find(p => p.entries.some(e => e.affixId === props.affix.affixId))
  const map = (pool?.rules as any)?.rarityUpgradeCostPerRarity as (Partial<Record<AffixRarity, Record<string, { count: number }>>> | undefined)
  return map?.[props.affix.rarity as AffixRarity] ?? null
})

const showCostDialog = ref(false)

// 进阶重随可用性：需要存在区间数值，且至少有一个未达上限
const canRerollUp = computed<boolean>(() => {
  let anyBelow = false
  let hasRange = false
  forEachRangedPair(({ current, max }) => {
    hasRange = true
    if (current < max) anyBelow = true
  })
  return hasRange && anyBelow
})

const rerollUpDisabledReason = computed<string>(() => {
  // 判定是否有区间
  let hasRange = false
  forEachRangedPair(() => { hasRange = true })
  if (!hasRange) return '仅支持含区间的数值'
  return '所有数值已达上限'
})

// 是否“所有可重随的数值均已达上限”（用于普通重抽的提示）
const allAtMax = computed<boolean>(() => {
  let hasRange = false
  let anyBelow = false
  forEachRangedPair(({ current, max }) => {
    hasRange = true
    if (current < max) anyBelow = true
  })
  return hasRange && !anyBelow
})

// 稀有度升级可用性与原因
const canUpgradeRarity = computed<boolean>(() => {
  const parsed = parseSeriesBaseId(props.affix.affixId)
  if (!parsed) return false
  const nxt = getNextRarity(parsed.rarity)
  if (!nxt) return false
  const targetId = seriesAffixIdForRarity(parsed.baseId, nxt)
  // 需要存在目标定义
  return !!affixDefinitions.find(d => d.affixId === targetId)
})

const upgradeDisabledReason = computed<string>(() => {
  const parsed = parseSeriesBaseId(props.affix.affixId)
  if (!parsed) return '非系列词条不可升级'
  const nxt = getNextRarity(parsed.rarity)
  if (!nxt) return '已是最高稀有度'
  const targetId = seriesAffixIdForRarity(parsed.baseId, nxt)
  if (!affixDefinitions.find(d => d.affixId === targetId)) return '缺少目标稀有度定义'
  return ''
})
</script>

<style scoped>
/** 仅使用 tailwind 原子类，避免 @apply **/
/* 描述最多展示两行，避免卡片过高 */
.desc {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
