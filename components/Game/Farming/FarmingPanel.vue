<template>
  <div class="w-full">
    <!-- <GameFarmingToolbar @refresh="onRefresh" @create="onCreate" /> -->

    <div class="backdrop-blur-md rounded-xl border border-gray-200 shadow-sm p-2">
      <GameFarmingGrid :plots="plots" @unlock="onUnlock" @harvest="onHarvest" @toggleAuto="onToggleAuto"
      @shovel="onShovel"
        @plant="onOpenPlantDialog" />
    </div>

    <GameFarmingPlantDialog v-model:open="plantDialogOpen" :plotIndex="selectedPlotIndex" @submit="onPlantSubmit" />

    <GameFarmingUnlockDialog v-model:open="unlockDialogOpen" :plotIndex="unlockTargetPlotIndex"
      :requirement="unlockRequirement" @confirm="onUnlockConfirm" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useFarming } from '~/composables/game/useFarming'
import { FARM_PLOT_CREATE_RESOURCE_REQUIREMENT } from '~/shared/data/constant'

const { listPlots, unlockPlot, harvest, setAutoReplant, plots, createPlot, shovel } = useFarming()

const onRefresh = () => listPlots({})
const onCreate = async () => {
  await createPlot({})
  // 刷新列表，确保顺序和状态
  setTimeout(() => onRefresh(), 50)
}

onMounted(() => {
  onRefresh()
})

const plantDialogOpen = ref(false)
const selectedPlotIndex = ref<number | null>(null)

function onOpenPlantDialog(plotIndex: number) {
  selectedPlotIndex.value = plotIndex
  plantDialogOpen.value = true
}

function onPlantSubmit({ plotIndex, seedId, fertilizers }: { plotIndex: number, seedId: string, fertilizers?: { id: string, stacks?: number }[] }) {
  plantDialogOpen.value = false
  selectedPlotIndex.value = null
  // call composable
  const { plantPlot } = useFarming()
  plantPlot({ plotIndex, seedId, fertilizers })
}

function onUnlock(plotIndex: number) {
  unlockTargetPlotIndex.value = plotIndex
  unlockDialogOpen.value = true
}

function onHarvest(plotIndex: number) {
  harvest({ plotIndex })
}

function onToggleAuto(plotIndex: number, value: boolean) {
  setAutoReplant({ plotIndex, value })
}

async function onShovel(plotIndex: number) {
  try {
    await ElMessageBox.confirm(
      `确认清理 田地 #${plotIndex + 1} 的当前作物吗？\n此操作不可撤销，且不会返还任何资源。`,
      '确认清理作物',
      {
        type: 'warning',
        confirmButtonText: '清理',
        cancelButtonText: '取消',
        autofocus: false,
        distinguishCancelAndClose: true,
      }
    )
    shovel({ plotIndex })
  } catch {
    // 用户取消
  }
}

// Unlock dialog state
const unlockDialogOpen = ref(false)
const unlockTargetPlotIndex = ref<number | null>(null)
const unlockRequirement = computed(() => FARM_PLOT_CREATE_RESOURCE_REQUIREMENT)

function onUnlockConfirm({ plotIndex }: { plotIndex: number }) {
  unlockDialogOpen.value = false
  unlockTargetPlotIndex.value = null
  unlockPlot({ plotIndex })
}

</script>
