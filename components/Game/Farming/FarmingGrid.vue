<template>
  <div>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
      <!-- Render actual plots (existing ones) -->
      <GameFarmingPlotCard v-for="p in visiblePlots" :key="`real-${p.id}`" :plot="p"
      @shovel="$emit('shovel', p.plotIndex)"
        @unlock="$emit('unlock', p.plotIndex)" @harvest="$emit('harvest', p.plotIndex)"
        @toggleAuto="$emit('toggleAuto', p.plotIndex, $event)" @plant="$emit('plant', p.plotIndex)" />

      <!-- Fill up to 8 slots with locked placeholders using next indices -->
      <div v-for="placeholder in placeholders" :key="`ph-${placeholder}`"
        class="group relative rounded-lg border border-dashed opacity-40 hover:opacity-100 p-3 flex flex-col gap-2 items-center justify-center text-center hover:border-gray-400 transition-opacity">
        <div class="text-sm font-medium text-gray-600">荒地 #{{ placeholder + 1 }}</div>
        <div class="text-xs text-gray-400">未解锁</div>
        <el-button type="primary" plain size="small" class="!px-3 w-full mt-2"
          @click="$emit('unlock', placeholder)">开垦</el-button>
      </div>
    </div>
  </div>

</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BASE_MAX_FARM_PLOTS_PER_USER } from '~/shared/data/constant';
import type { FarmPlotDTO } from '~/shared/types/farming'
const props = defineProps<{ plots: FarmPlotDTO[] }>()
const emit = defineEmits<{
  (e: 'unlock', plotIndex: number): void
  (e: 'harvest', plotIndex: number): void
  (e: 'toggleAuto', plotIndex: number, value: boolean): void
  (e: 'plant', plotIndex: number): void
  (e: 'shovel', plotIndex: number): void
}>()

// Visible plots limited to indices 0..7
const visiblePlots = computed(() => {
  return [...props.plots]
    .filter(p => p.plotIndex >= 0 && p.plotIndex < BASE_MAX_FARM_PLOTS_PER_USER)
    .sort((a, b) => a.plotIndex - b.plotIndex)
})

// We want to always show exactly 8 slots. Compute missing indices in 0..7
const placeholders = computed(() => {
  const indices = new Set(visiblePlots.value.map(p => p.plotIndex))
  const arr: number[] = []
  for (let i = 0; i < BASE_MAX_FARM_PLOTS_PER_USER; i++) {
    if (!indices.has(i)) arr.push(i)
  }
  return arr
})
</script>
