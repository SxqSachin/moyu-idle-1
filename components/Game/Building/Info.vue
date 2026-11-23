<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
    <template v-for="building in allGameBuilding" :key="building.id">
      <GameBuildingDetail 
        v-if="!building.hidden" 
        :building-id="building.id" 
        :building-detail="characterBuildingInfo[building.id]">
      </GameBuildingDetail>
    </template>
  </div>
</template>

<script setup lang="ts">
import { allGameBuilding } from '~/shared/data/allGameBuilding'
import { useCharacterBuildingInfo } from '~/composables/game/useCharacterBuildingInfo'
import { waitUtilConnected } from '~/api/game/socket/socket'
import type { FuncReturnVoid } from '~/shared/types'

const characterBuildingInfo = useCharacterBuildingInfo()

let func = ref<FuncReturnVoid>()

onMounted(async () => {
  await waitUtilConnected()

})

onUnmounted(() => {
  func.value?.()
})
</script>

<style scoped>
/* 可根据需要自定义样式 */
</style>