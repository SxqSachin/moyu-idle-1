<template>
  <span class="inline-flex items-center">
    <el-popover placement="top" trigger="hover" :width="320" :show-after="300">
      <div class="text-xs leading-5 text-gray-700">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-medium text-gray-800">{{ title }}</span>
          <el-tag :type="rarityTagType || undefined" size="small">{{ rarityText }}</el-tag>
        </div>
        <div v-if="description" class="text-gray-500 mb-2">{{ description }}</div>

        <div class="space-y-1">
          <div v-for="row in effectRows" :key="row.id" class="flex items-center">
            <span class="shrink-0 text-gray-500 truncate" :title="row.label">
              {{ row.label }}
              <span class="mx-1 text-gray-400">:</span>
            </span>
            <span class="font-medium">{{ row.displayValue }}</span>
            <span v-if="!hasInstance && row.rangeText" class="ml-2 text-[11px] text-gray-500">({{ row.rangeText }})</span>
          </div>
        </div>
      </div>
      <template #reference>
        <span class="truncate" :title="title" :class="{
          'text-md': titleSize == 'small'
        }">{{ title }}</span>
      </template>
    </el-popover>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CharacterAffixInstance, AffixRarity, RangeOrFixed } from '~/shared/types/affix'
import { affixDefinitions } from '~/shared/data/affix/definitions'
import { isNumericRange } from '~/shared/types/affix'

const props = defineProps<{
  affixId: string
  instance?: Pick<CharacterAffixInstance, 'affixId' | 'rarity' | 'effect'> | null
  titleSize?: 'large' | 'small'
}>()

const def = computed(() => affixDefinitions.find(d => d.affixId === props.affixId))
const hasInstance = computed(() => !!props.instance && props.instance.affixId === props.affixId)
const title = computed(() => def.value?.name || props.affixId)
const description = computed(() => def.value?.description || '')

const rarity = computed<AffixRarity>(() => (props.instance?.rarity as AffixRarity) || (def.value?.rarity as AffixRarity) || 'COMMON')
const rarityTagType = computed<'' | 'success' | 'warning' | 'info' | 'danger'>(() => {
  switch (rarity.value) {
    case 'COMMON': return 'info'
    case 'UNCOMMON': return ''
    case 'RARE': return 'success'
    case 'EPIC': return 'warning'
    case 'LEGENDARY': return 'danger'
    default: return ''
  }
})
const rarityText = computed(() => {
  switch (rarity.value) {
    case 'COMMON': return '普通'
    case 'UNCOMMON': return '罕见'
    case 'RARE': return '稀有'
    case 'EPIC': return '史诗'
    case 'LEGENDARY': return '传说'
    default: return rarity.value
  }
})

type EffectRow = { id: string; label: string; displayValue: string; rangeText: string }
const keyLabelMap: Record<string, string> = {
  strength: '力量', dexterity: '敏捷', intelligence: '智力', stamina: '体质',
  amount: '数值', percent: '百分比', perLuck: '每点幸运加成'
}
const statusLabelMap: Record<string, string> = {
  collecting: '收集', mining: '采矿', fishing: '钓鱼', farmingAnimal: '畜牧', farmingPlant: '种植',
  cooking: '烹饪', manufacturing: '制造', forging: '锻造', sewing: '缝制', trading: '交易', knowledge: '学识',
  exploring: '探索', mysterious: '神秘', enhance: '强化', luck: '幸运', battle: '战斗',
  strength: '力量', dexterity: '敏捷', intelligence: '智力', stamina: '耐力', attacking: '攻击', defencing: '防御',
}

const effectRows = computed<EffectRow[]>(() => {
  const rows: EffectRow[] = []
  const d = def.value
  if (!d) return rows

  // 优先使用实例值；若无实例，则按模板展示范围
  const tpl = d.effect as any
  const eff = (props.instance?.effect as any) || undefined

    // statusEffect 优先
    const instStatus = Array.isArray(eff?.statusEffect) ? eff.statusEffect as any[] : []
    const tplStatus = Array.isArray(tpl?.statusEffect) ? tpl.statusEffect as any[] : []

    if (tplStatus.length) {
      for (let j = 0; j < tplStatus.length; j++) {
        const tplSe = tplStatus[j]
        const label = statusLabelMap[tplSe.status] || tplSe.status
        const hasInc = typeof eff?.statusEffect?.[j]?.increase === 'number'
        const hasDec = typeof eff?.statusEffect?.[j]?.decrease === 'number'
        const val = hasInc ? `+${eff.statusEffect[j].increase}` : hasDec ? `-${eff.statusEffect[j].decrease}` : ''
        let rangeText = ''
        const v = (tplSe.increase ?? tplSe.decrease) as RangeOrFixed | undefined
        if (!hasInstance.value && v != null) {
          if (typeof v === 'number') {
            rangeText = `${v}`
          } else if (isNumericRange(v)) {
            const min = Math.min(v.min, v.max)
            const max = Math.max(v.min, v.max)
            rangeText = `${min}~${max}`
          }
        }
        rows.push({ id: `${tpl?.key || 'tpl'}-se-${j}`, label, displayValue: val || '0', rangeText })
      }
    } else {
  const payload = (eff?.custom ?? eff?.payload)
  const tplPayload = (tpl?.custom ?? tpl?.payload) as Record<string, any> | undefined
    const appendRow = (propKey: string, currentVal: any, tplVal?: any, labelOverride?: string) => {
      const isPercent = /percent/i.test(propKey)
      const fmt = (v: any) => isPercent ? `${v}%` : `${v}`
      // 兼容 { value, name } 模式的模板
      const rangeSource = (tplVal && typeof tplVal === 'object' && 'value' in tplVal) ? tplVal.value : tplVal
      const label = labelOverride || keyLabelMap[propKey] || (tplVal?.name) || propKey
      const valueText = hasInstance.value && currentVal != null ? fmt(currentVal) : ''
      let rangeText = ''
      if (!hasInstance.value && rangeSource != null) {
        if (typeof rangeSource === 'number') {
          rangeText = fmt(rangeSource)
        } else if (isNumericRange(rangeSource)) {
          const min = Math.min(rangeSource.min, rangeSource.max)
          const max = Math.max(rangeSource.min, rangeSource.max)
          rangeText = `${fmt(min)}~${fmt(max)}`
        }
      }
      rows.push({ id: `${tpl?.key || 'tpl'}-${propKey}`, label, displayValue: valueText || (rangeText ? '' : '0'), rangeText })
    }

    if (payload != null && typeof payload === 'object' && !Array.isArray(payload)) {
      const obj = payload as Record<string, any>
      for (const k of Object.keys(tplPayload || obj)) {
        const t = tplPayload?.[k]
        const label = (t && typeof t === 'object' && 'name' in t) ? t.name : undefined
        appendRow(k, obj[k], t, label)
      }
    } else if (tplPayload && typeof tplPayload === 'object' && !Array.isArray(tplPayload)) {
      // 无实例或实例非对象，但模板是对象：逐项展示模板区间
      for (const k of Object.keys(tplPayload)) {
        const t = tplPayload[k]
        const label = (t && typeof t === 'object' && 'name' in t) ? (t as any).name : undefined
        appendRow(k, undefined, t, label)
      }
    } else {
      const rawTplVal = (tpl?.custom ?? tpl?.payload) as any
      const label = (rawTplVal && typeof rawTplVal === 'object' && 'name' in rawTplVal) ? rawTplVal.name : undefined
      const tplVal = (rawTplVal && typeof rawTplVal === 'object' && 'value' in rawTplVal) ? rawTplVal.value : rawTplVal
      appendRow('value', payload, tplVal, label)
    }
    }

  return rows
})
</script>

<style scoped>
</style>
