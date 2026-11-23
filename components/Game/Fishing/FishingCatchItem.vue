<template>
  <div class="relative flex flex-col bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3 shadow-sm hover:shadow-md transition">
    <div v-if="bulkMode" class="absolute right-2 top-2 z-10">
      <el-checkbox :model-value="checked" size="large" @change="onCheckboxChange" />
    </div>

    <GameFishingCatchPreview :fish="fish" />
    <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">长度: <span class="font-medium">{{ fish.length }}</span> cm · 重量: <span class="font-medium">{{ fish.weight }}</span> kg</div>
    <div class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ formatTime(fish.caughtAt) }}</div>
    <div v-if="!bulkMode" class="mt-3 flex justify-end">
      <el-button type="primary" size="small" @click="openSell">出售</el-button>
    </div>

    <el-dialog v-model="showSell" @close="showSell=false" width="520px" title="出售鱼获">
      <SellCaughtFishModal :fish="fish" @close="showSell=false" @sold="onSold" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { CaughtFishDTO } from '~/shared/types/fishing'
import type { CheckboxValueType } from 'element-plus'
import GameFishingCatchPreview from './FishingCatchPreview.vue'
import SellCaughtFishModal from './SellCaughtFishModal.vue'
import { formatTime } from '~/shared/utils';

const props = defineProps<{ fish: CaughtFishDTO; bulkMode?: boolean; checked?: boolean }>()
const emit = defineEmits<{
  (e: 'sold', payload: { caughtFishId: number }): void
  (e: 'toggle-check', value: boolean): void
}>()

const showSell = ref(false)
function openSell(){
  showSell.value = true
}
function onSold(payload: { caughtFishId: number }){
  emit('sold', payload)
  showSell.value = false
}

function onCheckboxChange(val: CheckboxValueType) {
  emit('toggle-check', Boolean(val))
}
</script>

<style scoped>
/* 保持样式与原来一致；如需调整在这里修改 */
</style>
