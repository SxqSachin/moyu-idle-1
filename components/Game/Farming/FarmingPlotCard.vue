<template>
  <el-card body-class="group relative rounded-lg p-3 flex flex-col gap-2" shadow="hover">
    <div class="flex items-center justify-between">
      <div class="text-sm font-medium">田地 #{{ plot.plotIndex + 1 }}</div>
      <el-popover placement="top" width="320" v-if="autoReplantEnabled">
        <template #reference>
          <el-switch :model-value="plot.autoReplant" @change="onToggleAuto" active-color="#13ce66"
            inactive-color="#c0c4cc" active-text="补种" size="small" />
        </template>
        <div class="text-xs">
          开启后，作物成熟时，会自动进行收获。<br/>
          自动收获的产出为手动收获的80%（向上取整），收获的产出会被放入收获箱中。<br/>

          <br/>
          自动收获后，根据当前的种植情况（所使用的种子、施肥情况）进行补种<br/>
          当种子不足或所需的肥料不足时，则不会进行补种<br/>
        </div>
      </el-popover>
    </div>

    <div v-if="plot.state != 'EMPTY'" class="text-xs text-gray-500 dark:text-gray-400 mb-1">状态： <span
        :class="stateClass">{{ stateLabel }}</span> </div>
    <div v-if="plot.expectedHarvestAt" class="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400 ">
      <div v-if="plot.seedId">
        <span>作物：</span>
        <GameCommonSimpleResourceIconAndName :resource-id="plot.seedId" />
      </div>

      <div></div>

      <div>预计成熟时间：</div>
      <div>{{ formatTime(plot.expectedHarvestAt, { hideSecond: true }) }}</div>

      <!-- Progress bar during growing -->
      <div v-if="plot.state === 'GROWING'" class="w-full mt-2">
        <el-progress :percentage="numericPercentRef" :show-text="false" :stroke-width="8" />
        <div class="flex items-center justify-between text-xs text-gray-500 mt-1">
          <div>进度 {{ Math.floor(percent) }}%</div>
          <div>{{ remainingLabel }}</div>
        </div>
      </div>
    </div>

    <div class="flex-1 flex items-center justify-center py-2">
      <div v-if="plot.state === 'LOCKED'" class="text-xs text-gray-400">未解锁</div>
      <div v-else-if="plot.state === 'EMPTY'" class="text-xs text-gray-400">空地</div>
      <div v-else-if="plot.state === 'GROWING'" class="text-xs text-emerald-600">生长中</div>
      <div v-else-if="plot.state === 'READY'" class="text-xs text-amber-600">可收获</div>
      <div v-else class="text-xs text-gray-400">{{ plot.state }}</div>
    </div>

    <div class="flex gap-2">
      <el-button v-if="plot.state === 'LOCKED'" type="success" plain size="small" class="!px-3 w-full"
        @click="$emit('unlock')">解锁</el-button>

      <el-button v-else-if="plot.state === 'EMPTY'" type="primary" size="small" class="!px-3 w-full"
        @click="$emit('plant')">播种</el-button>

      <el-button v-else-if="plot.state === 'READY'" type="success" size="small" class="!px-3 w-full"
        @click="$emit('harvest')">收获</el-button>

      <!-- 清理作物按钮：在非 EMPTY/LOCKED 下允许 -->
      <el-button v-else-if="plot.state == 'GROWING'" type="warning" size="small" plain class="!px-3 w-full"
        @click="$emit('shovel')">清理作物</el-button>

      <el-button v-else type="info" size="small" class="!px-3 w-full" plain disabled>进行中</el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import type { hi } from 'element-plus/es/locale/index.mjs';
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useNormalVillageBaseBuildingInfo } from '~/composables/game/useNormalVillageBaseBuildingInfo';
import type { FarmPlotDTO } from '~/shared/types/farming'
import { formatTime, formatTimeToStr } from '~/shared/utils';

const props = defineProps<{ plot: FarmPlotDTO }>()
const emit = defineEmits<{
  (e: 'unlock'): void
  (e: 'harvest'): void
  (e: 'toggleAuto', value: boolean): void
  (e: 'plant'): void
  (e: 'shovel'): void
}>()

const stateLabel = computed(() => {
  switch (props.plot.state) {
    case 'LOCKED': return '未解锁'
    case 'EMPTY': return '空地'
    case 'GROWING': return '生长中'
    case 'READY': return '可收获'
    case 'WITHERED': return '枯萎'
    default: return props.plot.state
  }
})

const villageBuilding = useNormalVillageBaseBuildingInfo()
const autoReplantEnabled = computed(() => {
  return villageBuilding.value.some(b => {
    return b.type == 'kittyHomeServiceCenter' && b.level >= 2
  })
})

const stateClass = computed(() => {
  return {
    'text-gray-500': props.plot.state === 'EMPTY' || props.plot.state === 'LOCKED',
    'text-emerald-600': props.plot.state === 'GROWING',
    'text-amber-600': props.plot.state === 'READY',
  }
})

// Live clock to update progress on the client
const now = ref(Date.now())
let timer: number | null = null
onMounted(() => {
  // update every second
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 10000)
})
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})

const percent = computed(() => {
  try {
    // Prefer accumulated seconds if provided
    // if (typeof props.plot.growthSecondsRequired === 'number' && props.plot.growthSecondsRequired > 0) {
    //   const p = (props.plot.growthSecondsAccumulated / props.plot.growthSecondsRequired) * 100
    //   return Math.max(0, Math.min(100, p))
    // }

    if (props.plot.plantedAt && props.plot.expectedHarvestAt) {
      const planted = Date.parse(props.plot.plantedAt)
      const expected = Date.parse(props.plot.expectedHarvestAt)
      const totalMs = expected - planted
      if (totalMs <= 0) return 100
      const elapsedMs = now.value - planted
      const p = (elapsedMs / totalMs) * 100
      return Math.max(0, Math.min(100, p))
    }
  } catch (e) {
    // ignore and fallback
  }
  return 0
})

const remainingLabel = computed(() => {
  try {
    if (!props.plot.expectedHarvestAt) return ''
    const expected = Date.parse(props.plot.expectedHarvestAt)
    const diff = Math.max(0, Math.floor((expected - now.value) / 1000)) // seconds
    if (diff <= 0) return '即将成熟'
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60
    if (h > 0) return `剩余 ${h}小时${m}分钟`
    if (m > 0) return `剩余 ${m}分钟`
    return `剩余不到1分钟`
  } catch {
    return ''
  }
})

// Use a numeric ref updated from `percent` to ensure the template receives a concrete number
const numericPercentRef = ref<number>(0)
watch(percent, (v) => {
  numericPercentRef.value = Math.max(0, Math.min(100, Math.round(v)))
}, { immediate: true })

function onToggleAuto(val: string | number | boolean) {
  emit('toggleAuto', Boolean(val))
}

</script>
