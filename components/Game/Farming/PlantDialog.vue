<template>
  <el-dialog v-model="innerOpen" title="播种" width="400px" :close-on-click-modal="false" align-center
    class="cute-action-dialog p-0" body-class="bg-white dark:bg-gray-800" append-to-body @close="onCancel">
    <!-- 顶部可爱猫咪装饰，保持与 ActionCard 弹窗一致 -->
    <div class="absolute -top-9 left-4 z-10 pointer-events-none">
      <img :src="dialogKitty" alt="cute cat" class="w-28 h-28 object-contain drop-shadow-lg" />
      <div
        class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-12 h-2 bg-black/10 dark:bg-white/10 rounded-full blur-sm">
      </div>
    </div>

    <div class="relative z-1 space-y-4">
      <!-- 选择种子（隐藏田地编号） -->
      <div class="flex items-center gap-3">
        <div class="w-20 shrink-0 text-sm text-gray-500 dark:text-gray-400">种子</div>
        <el-select v-model="seedId" filterable placeholder="请选择种子" class="flex-1 !w-auto">
          <el-option v-for="opt in seedOptions" :key="opt.value" :label="opt.label" :value="opt.value">
            <GameCommonSimpleResourceIconAndName :resource-id="opt.value">
              <template v-if="inventory[opt.value]?.count ">
                ({{ inventory[opt.value]?.count }})
              </template>
              <template v-else>
                <span class="text-gray-400">(无库存)</span>
              </template>
            </GameCommonSimpleResourceIconAndName>
          </el-option>
        </el-select>
      </div>

      <!-- 分隔线，贴齐 ActionCard 弹窗风格 -->
      <div v-if="currentCrop" class="border-t border-gray-200 dark:border-gray-600 my-3"></div>

      <!-- 内容采用 ActionCardInfo 风格：紧凑标签段 -->
      <div v-if="currentCrop" class="space-y-4 text-sm">

        <div v-if="currentCrop.farmingPlantLevelRequired" class="flex items-start gap-3">
          <div class="w-20 shrink-0 text-sm text-gray-500 dark:text-gray-400">需求</div>
          <div class="flex-1 text-gray-600 dark:text-gray-300 space-x-3">
            <span v-if="currentCrop.farmingPlantLevelRequired"
              :class="playerFarmingPlantLevel < thisSeedRequiredFarmingPlantLevel ? 'text-red-600' : 'text-green-600'">
              种植等级 ≥ {{ thisSeedRequiredFarmingPlantLevel }}（当前 {{ playerFarmingPlantLevel }}）
            </span>
          </div>
        </div>

        <!-- 需求（可施肥信息） -->
        <div v-if="currentCrop.fertilizable" class="flex items-start gap-3">
          <div class="w-20 shrink-0 text-gray-500 dark:text-gray-400">是否可施肥</div>
          <span class="text-gray-600 dark:text-gray-300">是</span>
        </div>

        <!-- 肥料选择 -->
        <div v-if="allowedFertilizers.length" class="flex items-start gap-3">
          <div class="w-20 shrink-0 text-sm text-gray-500 dark:text-gray-400">肥料</div>
          <div class="flex-1">
            <div class="flex flex-col gap-2">
              <div v-for="f in allowedFertilizers" :key="f.id" :class="[
                  'rounded-lg px-3 py-2 border bg-white dark:bg-gray-800 transition-colors duration-150',
                  (fertStacksMap[f.id] || 0) > 0 ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'
                ]">
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <div class="truncate text-gray-600 dark:text-gray-100">{{ f.name || f.id }}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">最多叠加：{{ f.maxStacks ?? 1 }}</div>
                  </div>
                  <el-input-number v-model="fertStacksMap[f.id]" :min="0" :max="f.maxStacks || 1" :step="1" 
                    :controls="false" class="!w-20" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 施肥效果预览：显示叠加后的合并结果 -->
        <div class="flex items-start gap-3" v-if="selectedFertEffects.length">
          <div class="w-20 shrink-0 text-sm text-gray-500 dark:text-gray-400">效果</div>
          <div class="flex-1 space-y-2 text-gray-600 dark:text-gray-300">
            <!-- 合并后的效果条目 -->
            <div class="space-y-1 text-xs">
              <div v-if="effectAgg.durationSecs > 0 || effectAgg.durationPercent > 0">
                <span class="text-gray-500 dark:text-gray-400">成熟时长</span>
                <span>
                  <template v-if="effectAgg.durationSecs > 0">-{{ effectAgg.durationSecs }}s</template>
                  <template v-if="effectAgg.durationSecs > 0 && effectAgg.durationPercent > 0"> · </template>
                  <template v-if="effectAgg.durationPercent > 0">-{{ Math.round(effectAgg.durationPercent * 100) }}%</template>
                </span>
              </div>

              <div v-if="effectAgg.mutationPP !== 0 || effectAgg.mutationMul !== 1">
                <span class="text-gray-500 dark:text-gray-400">变异概率</span>
                <span>
                  <template v-if="effectAgg.mutationPP !== 0">
                    {{ effectAgg.mutationPP > 0 ? '+' : '' }}{{ (effectAgg.mutationPP ?? 0) * 10 }}%
                  </template>
                  <template v-if="effectAgg.mutationPP !== 0 && effectAgg.mutationMul !== 1"> · </template>
                  <template v-if="effectAgg.mutationMul !== 1">×{{ effectAgg.mutationMul }}</template>
                </span>
              </div>

              <div v-if="effectAgg.yieldFlat !== 0 || effectAgg.yieldPercent !== 0">
                <span class="text-gray-500 dark:text-gray-400">产量</span>
                <span>
                  <template v-if="effectAgg.yieldFlat !== 0">{{ effectAgg.yieldFlat > 0 ? '+' : '' }}{{ effectAgg.yieldFlat }}</template>
                  <template v-if="effectAgg.yieldFlat !== 0 && effectAgg.yieldPercent !== 0"> · </template>
                  <template v-if="effectAgg.yieldPercent !== 0">{{ effectAgg.yieldPercent > 0 ? '+' : '' }}{{ Math.round(effectAgg.yieldPercent * 100) }}%</template>
                </span>
              </div>

              <div v-if="effectAgg.probTotal > 0">
                <span class="text-gray-500 dark:text-gray-400">概率调整</span>
                <span>
                  共 {{ effectAgg.probTotal }} 条
                  <template v-if="effectAgg.probAll"> · 全部 {{ effectAgg.probAll }}</template>
                  <template v-if="effectAgg.probNormal"> · 普通 {{ effectAgg.probNormal }}</template>
                  <template v-if="effectAgg.probMutation"> · 变异 {{ effectAgg.probMutation }}</template>
                  <template v-if="effectAgg.probById"> · 指定目标 {{ effectAgg.probById }}</template>
                  <template v-if="effectAgg.probPP !== 0"> · 百分点合计 {{ effectAgg.probPP > 0 ? '+' : '' }}{{ Math.round(effectAgg.probPP * 100) }}</template>
                  <template v-if="effectAgg.probMul !== 1"> · 乘数 ×{{ effectAgg.probMul }}</template>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div class="w-20 shrink-0 text-gray-500 dark:text-gray-400">成熟时间</div>
          <div class="flex-1 text-gray-600 dark:text-gray-300">
            <span class="text-gray-600 dark:text-gray-100">{{ finalGrowDuration }}</span>
          </div>
        </div>

        <div class="flex items-start gap-3" v-if="currentCrop.farmingPlantExpGainWhenHarvest ">
          <div class="w-20 shrink-0 text-gray-500 dark:text-gray-400">经验</div>
          <div class="flex-1 text-gray-600 dark:text-gray-300">
            <div v-if="mergedYields.length" class="space-y-1">
              <div class="text-gray-600 dark:text-gray-100">
                {{ allCharacterStatus.farmingPlant.icon }}种植经验 +{{ currentCrop.farmingPlantExpGainWhenHarvest }}
              </div>
            </div>
            <div v-else class="text-gray-400 text-xs">暂无</div>
          </div>
        </div>

        <!-- 资源消耗 -->
        <div class="flex items-start gap-3">
          <div class="w-20 shrink-0 text-gray-500 dark:text-gray-400">产出</div>
          <div class="flex-1 text-gray-600 dark:text-gray-300">
            <div v-if="mergedYields.length" class="space-y-1">
              <div v-for="(y, idx) in mergedYields" :key="idx" class="flex items-center">
                <GameCommonResourceIconAndName :resource-id="y.id">
                  :{{ generateRewardStr(y) }}
                </GameCommonResourceIconAndName>
              </div>
            </div>
            <div v-else class="text-gray-400 text-xs">暂无</div>
          </div>
        </div>

        <!-- 资源消耗 -->
        <div class="flex items-start gap-3">
          <div class="w-20 shrink-0 text-gray-500 dark:text-gray-400">消耗</div>
          <div class="flex-1 text-gray-600 dark:text-gray-300">
            <div v-if="preview.cost.length" class="space-y-1">
              <div v-for="(c, idx) in preview.cost" :key="idx" class="flex items-center">
                <GameCommonResourceIconAndName :resource-id="c.id" :count="c.count" :show-inventory-count="true" />
              </div>
            </div>
            <div v-else class="text-gray-400">无</div>
          </div>
        </div>

        <!-- "获得"信息已并入效果预览中的“最终产出”展示，避免重复 -->
      </div>
    </div>

    <el-divider></el-divider>
    <div class="flex gap-2 w-full">
      <el-button class="w-full" type="primary" :disabled="!seedId" @click="onSubmit">确认</el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { allFarmingData, allFertilizer } from '~/shared/data/allFarmingData'
// 引入原始定义以获取作物 name 和 plantCost（SeedPlantingConfig中不包含）
import farmingDefs from '~/assets/resource/allFarmingDefinitions.json'
import type { WeightedYield, FertilizerEffect } from '~/shared/types/farming'
import { formatDuration } from '~/shared/utils';
import { computeFarmingOutcome } from '~/shared/utils/game/farmingOutcome';
import { useInventory } from '~/composables/game/useInventory';
import { useCharacterStatusInfo } from '~/composables/game/useCharacterStatusInfo';
import dialogKitty from '~/assets/images/dialog_kitty_1.png'
import { allGameActionMainType } from '~/shared/data/allGameActions';
import { allCharacterStatus } from '~/shared/data/allCharacterStatus';

const inventory = useInventory();
const characterStatus = useCharacterStatusInfo();

const props = defineProps<{ open: boolean, plotIndex: number | null }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'submit', p: { plotIndex: number, seedId: string, growthSecondsRequired?: number, fertilizers?: { id: string, stacks?: number }[] }): void
}>()

const innerOpen = ref(false)
watch(() => props.open, v => innerOpen.value = v)
watch(innerOpen, v => emit('update:open', v))

const seedId = ref<string>('')
const plotIndex = computed(() => props.plotIndex)

// 构造种子选项，尝试显示 name，否则 fallback id
const cropsArray = computed(() => (farmingDefs.crops ?? []))
const seedOptions = computed(() => {
  return (cropsArray.value).map(c => ({
    value: c.seedId,
    label: c.name ? `${c.name}` : c.seedId,
  }))
})

const currentCrop = computed(() => {
  const id = seedId.value as any
  return (farmingDefs.crops ?? []).find(c => c.seedId === id)
})

const allowedFertilizers = computed(() => {
  const cfg = allFarmingData[seedId.value as any]
  const ids = cfg?.fertilizerIds ?? []
  return ids
    .map(id => allFertilizer[id as any])
    .filter(Boolean) as any[]
})

// 记录每种肥料的叠加层数
const fertStacksMap = ref<Record<string, number>>({})
watch(seedId, () => { fertStacksMap.value = {} })


// 根据所选肥料计算效果
const selectedFertEffects = computed(() => {
  const effects: FertilizerEffect[] = []
  const entries = Object.entries(fertStacksMap.value)
  for (const [fid, stacks] of entries) {
    const f = allFertilizer[fid as any]
    if (!f || !f.effects?.length) continue
    const max = f.maxStacks ?? 1
    const s = Math.min(Math.max(0, stacks || 0), max)
    for (let i = 0; i < s; i++) effects.push(...f.effects)
  }
  return effects
})

// 将相同效果进行合并，展示叠加后的汇总结果
const effectAgg = computed(() => {
  // 持续时间
  let durationSecs = 0
  let durationMult = 1 // 叠加百分比：乘法 (1 - p)

  // 变异概率
  let mutationPP = 0 // 百分点增量的总和（0~1）
  let mutationMul = 1 // 乘法叠加

  // 产量
  let yieldFlat = 0
  let yieldPercentMult = 1 // 乘法叠加 (1 + p)

  // 概率调整统计（非严格合并，仅用于概览）
  let probTotal = 0
  let probNormal = 0
  let probMutation = 0
  let probAll = 0
  let probById = 0
  let probPP = 0
  let probMul = 1

  for (const e of selectedFertEffects.value) {
    if (e.type === 'shortenDuration') {
      if (typeof e.seconds === 'number') durationSecs += e.seconds
      if (typeof e.percent === 'number') durationMult *= (1 - e.percent)
    } else if (e.type === 'increaseMutationChance' || e.type === 'adjustMutationChance') {
      if (typeof e.percentPoint === 'number') mutationPP += e.percentPoint
      if ((e as any).multiply && typeof (e as any).multiply === 'number') mutationMul *= (e as any).multiply
    } else if (e.type === 'increaseYield') {
      if (typeof e.flat === 'number') yieldFlat += e.flat
      if (typeof e.percent === 'number') yieldPercentMult *= (1 + e.percent)
    } else if (e.type === 'adjustYieldProbability') {
      probTotal += 1
      const scope = e.scope ?? 'all'
      if (scope === 'normal') probNormal += 1
      else if (scope === 'mutation') probMutation += 1
      else probAll += 1
      if (e.selector === 'BY_ID' && e.id) probById += 1
      if (typeof e.percentPoint === 'number') probPP += e.percentPoint
      if (typeof e.multiply === 'number') probMul *= e.multiply
    }
  }

  const durationPercent = 1 - durationMult
  const yieldPercent = yieldPercentMult - 1

  return {
    durationSecs,
    durationPercent,
    mutationPP,
    mutationMul,
    yieldFlat,
    yieldPercent,
    probTotal,
    probNormal,
    probMutation,
    probAll,
    probById,
    probPP,
    probMul,
  }
})

// 使用 shared 计算函数，确保前后端完全一致
const mergedYields = computed<WeightedYield[]>(() => {
  if (!seedId.value) return []
  const ferts = Object.entries(fertStacksMap.value)
    .filter(([, s]) => (s || 0) > 0)
    .map(([id, stacks]) => ({ id, stacks }))
  try {
    return computeFarmingOutcome(seedId.value, ferts).expectedYield
  } catch {
    return []
  }
})

const preview = computed(() => {
  // 统一使用 shared 计算
  const ferts = Object.entries(fertStacksMap.value)
    .filter(([, s]) => (s || 0) > 0)
    .map(([id, stacks]) => ({ id, stacks }))
  let finalGrowthSeconds = currentCrop.value?.baseGrowthSeconds ?? 0
  let finalMutationChance = currentCrop.value?.baseMutationChance ?? 0
  if (seedId.value) {
    try {
      const outcome = computeFarmingOutcome(seedId.value, ferts)
      finalGrowthSeconds = outcome.finalGrowthSeconds
      finalMutationChance = outcome.finalMutationChance
    } catch {}
  }

  // 成本：
  // - 作物 plantCost
  // - 肥料 cost * 叠加次数
  // - 肥料本体等量消耗（与后端保持一致）
  const costMap: Record<string, number> = {}
  const addCost = (id: string, count: number) => {
    if (!id || !count) return
    costMap[id] = (costMap[id] || 0) + count
  }
  const plantCost = (currentCrop.value as any)?.plantCost as { id: string, count: number }[] | undefined
  if (plantCost?.length) {
    for (const c of plantCost) addCost(c.id, c.count)
  }
  const entries = Object.entries(fertStacksMap.value)
  for (const [fid, stacks] of entries) {
    const f = allFertilizer[fid as any]
    const max = f?.maxStacks ?? 1
    const s = Math.min(Math.max(0, stacks || 0), max)
    if (s <= 0) continue
    // 肥料本体自耗
    addCost(fid, s)
    // 肥料额外 cost（按层数累加）
    if (f?.cost?.length) {
      for (const c of f.cost) addCost(c.id, c.count * s)
    }
  }
  const costs = Object.entries(costMap).map(([id, count]) => ({ id, count }))

  return {
    finalGrowthSeconds,
    finalMutationChance,
    cost: costs,
  }
})

function onCancel() {
  innerOpen.value = false
}

function onSubmit() {
  if (plotIndex.value == null) return
  if (!seedId.value) return
  const fertilizers = Object.entries(fertStacksMap.value)
    .filter(([, s]) => (s || 0) > 0)
    .map(([id, stacks]) => ({ id, stacks }))
  emit('submit', {
    plotIndex: plotIndex.value,
    seedId: seedId.value,
    fertilizers: fertilizers.length ? fertilizers : undefined,
  })
}

function generateRewardStr(y: any) {
  const percent = y.percent;
  let percentStr = ''

  if (percent == ~~percent) {
    percentStr = `${percent * 100}%`
  } else {
    percentStr = `${(percent * 100).toFixed(2)}%`
  }

  if (y.count) {
    return ` ${y.count} (${percentStr})`
  }

  return ` ${y.range.min} - ${y.range.max} (${percentStr})`
}

const finalGrowDuration = computed(() => {
  return formatDuration(preview.value.finalGrowthSeconds * 1000)
})

const thisSeedRequiredFarmingPlantLevel = computed(() => {
  return currentCrop.value?.farmingPlantLevelRequired ?? 0
})
const playerFarmingPlantLevel = computed(() => {
  return characterStatus.value.farmingPlant.final ?? 0
})

</script>
