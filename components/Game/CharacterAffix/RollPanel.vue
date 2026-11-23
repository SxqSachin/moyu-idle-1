<template>
  <!-- 抽取面板，职责：发起抽取参数配置与提交 -->
  <el-card class="w-full rounded-lg border border-gray-200">
    <div class="flex flex-wrap items-center gap-3">
      <!-- <div class="flex flex-col">
        <span class="text-gray-600 text-sm mb-1">分类</span>
        <el-select v-model="poolId" class="min-w-[180px]" size="small">
          <el-option v-for="p in pools" :key="p.poolId" :label="p.name" :value="p.poolId" />
        </el-select>
      </div> -->
      <div class="flex flex-row items-center gap-2">
        <span class="text-gray-600 text-sm">数量</span>
        <el-input-number v-model="count" :min="0" :max="10" size="small" />
      </div>
      
      <!-- <div class="flex-1"></div> -->
      <!-- 概率公示（单次抽取理论值）：基于 entries.weight 与 rarityWeight 归一化 -->

      <!-- 当存在消耗时，将 Popover 绑定到“抽取”按钮上；无消耗则直接渲染按钮 -->
      <el-popover v-if="Object.keys(totalCost).length" placement="top" trigger="hover" :width="260">
        <div class="text-sm text-gray-600">
          <div class="font-medium mb-1">本次消耗</div>
          <div class="flex flex-row gap-2 flex-wrap">
          <GameCommonItemCountInfoIconAndName
            :item-count-info="totalCost"
            :show-count="true"
            :show-inventory-count="true"
          />
          </div>
        </div>
        <template #reference>
          <span>
            <el-button type="primary" size="small" :disabled="cooldownSec > 0" @click="onRoll">
              <template v-if="cooldownSec > 0">获取祝福 ({{ cooldownSec }}s)</template>
              <template v-else>获取祝福</template>
            </el-button>
          </span>
        </template>
      </el-popover>
      <el-button v-else type="primary" size="small" :disabled="cooldownSec > 0" @click="onRoll">
        <template v-if="cooldownSec > 0">获取祝福 ({{ cooldownSec }}s)</template>
        <template v-else>获取祝福</template>
      </el-button>

      <el-popover v-if="probListGrouped.length" placement="top" trigger="hover" :width="420">
        <div class="text-xs text-gray-600 max-h-96 overflow-auto">
          <div class="space-y-3">
            <div v-for="group in probListGrouped" :key="group.rarity" class="border-t first:border-t-0 pt-2 first:pt-0">
              <div class="flex items-center justify-between mb-1">
                <div class="font-medium">
                  {{ rarityLabelMap[group.rarity] || group.rarity }}
                </div>
                <div class="text-[11px] text-gray-500">小计：{{ (group.totalPercent * 100).toFixed(2) }}%</div>
              </div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                <div v-for="item in group.items" :key="item.affixId" class="flex items-center justify-between">
                  <span class="truncate">
                    <AffixName :affix-id="item.affixId" />
                  </span>
                  <span class="shrink-0 ml-2">{{ item.percentText }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <template #reference>
          <el-link type="primary" :underline="false" class="mr-2 text-sm">概率</el-link>
        </template>
      </el-popover>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { allAffixPools } from '~/shared/data/affix/pools'
import { CHARACTER_AFFIX_ROLL_COOLDOWN_SECONDS } from "~/shared/data/characterAffixConstants";
import { affixDefinitions } from '~/shared/data/affix/definitions'
import type { AffixRarity } from '~/shared/types/affix'
import AffixName from './AffixName.vue'

const emit = defineEmits<{ (e: 'roll', payload: { poolId?: string; count?: number }): void }>()

const pools = allAffixPools
const poolId = ref<string>(pools[0]?.poolId || 'default_character_pool')
const count = ref<number>(1)
const cooldownSec = ref(0)
let cdTimer: any = null

const currentPool = computed(() => pools.find(p => p.poolId === poolId.value))
const totalCost = computed(() => {
  const cost = currentPool.value?.rules?.costPerRoll || {}
  const n: Record<string, { count: number }> = {}
  if (!cost || !count.value) return n
  for (const [rid, info] of Object.entries(cost)) {
    if (!info?.count) continue
    n[rid] = { count: info.count * count.value }
  }
  return n
})

// 概率公示（单次抽取）：entry.weight * rarityWeight[rarity] 归一化
const probList = computed(() => {
  const p = currentPool.value
  if (!p) return [] as Array<{ affixId: string; name: string; percentText: string; rarity: AffixRarity; percent: number }>
  const rarityWeight = p.rules?.rarityWeight || {}
  const items = p.entries.map(e => {
    const def = affixDefinitions.find(d => d.affixId === e.affixId)
    const rarity = (def?.rarity || 'COMMON') as AffixRarity
    const base = e.weight ?? 1
    const rw = (rarityWeight as Partial<Record<AffixRarity, number>>)[rarity] ?? 1
    const w = Math.max(0, base * rw)
    return {
      affixId: e.affixId,
      name: def?.name || e.affixId,
      rarity,
      weight: w,
    }
  })
  const total = items.reduce((s, it) => s + it.weight, 0)
  if (total <= 0) return []
  return items
    .map(it => ({ affixId: it.affixId, name: it.name, rarity: it.rarity, percent: it.weight / total }))
    .sort((a, b) => b.percent - a.percent)
    .map(it => ({ affixId: it.affixId, name: it.name, rarity: it.rarity, percent: it.percent, percentText: (it.percent * 100).toFixed(2) + '%' }))
})

// 稀有度中文映射与排序
const rarityOrder: AffixRarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']
const rarityLabelMap: Record<AffixRarity, string> = {
  COMMON: '普通',
  UNCOMMON: '罕见',
  RARE: '稀有',
  EPIC: '史诗',
  LEGENDARY: '传说',
}

// 分组后的列表：按稀有度区块显示
const probListGrouped = computed(() => {
  const groups: Record<string, { rarity: AffixRarity; items: Array<{ affixId: string; percentText: string }>; totalPercent: number }> = {}
  for (const it of probList.value) {
    const key = it.rarity
    if (!groups[key]) groups[key] = { rarity: it.rarity, items: [], totalPercent: 0 }
    groups[key].items.push({ affixId: it.affixId, percentText: it.percentText })
    groups[key].totalPercent += it.percent
  }
  return Object.values(groups)
    .sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity))
    .map(g => ({ ...g, items: g.items }))
})

function onRoll() {
  if (cooldownSec.value > 0) return
  emit('roll', { poolId: poolId.value, count: count.value })
  cooldownSec.value = CHARACTER_AFFIX_ROLL_COOLDOWN_SECONDS
  if (cdTimer) clearInterval(cdTimer)
  cdTimer = setInterval(() => {
    cooldownSec.value -= 1
    if (cooldownSec.value <= 0) {
      cooldownSec.value = 0
      clearInterval(cdTimer)
      cdTimer = null
    }
  }, 1000)
}
</script>

<style scoped>
</style>
