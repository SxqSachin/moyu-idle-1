<template>
  <div>
    <div class="flex flex-col gap-2">
      <div class="text-sm text-gray-700 dark:text-gray-200 flex flex-row gap-2 items-center">
        <span> 品种： </span>
        <GameFishingCatchPreview :fish="fish"></GameFishingCatchPreview>
      </div>
      <div class="text-sm text-gray-700 dark:text-gray-200 flex flex-row gap-4 items-center">
        <div> 
          <span>长度：</span><span class="font-medium">{{ fish.length }}</span> cm
        </div>
        <div>
          <span>重量：</span><span class="font-medium">{{ fish.weight }}</span> kg
        </div>
      </div>

    </div>

    <div class="border-t my-3"></div>

    <div class="flex flex-col gap-2">
    <div class="text-sm text-gray-600 dark:text-gray-300">
      <span class="mr-2">基础价格:</span>
      <GameCommonResourceIconAndName resource-id="gold" :count="basePrice"></GameCommonResourceIconAndName>
    </div>
    <div class="text-sm text-gray-600 dark:text-gray-300">
      <span class="mr-2">长度加成:</span>
      <GameCommonResourceIconAndName resource-id="gold" :count="lengthBonus"></GameCommonResourceIconAndName>
    </div>
    <div class="text-sm text-gray-600 dark:text-gray-300">
      <span class="mr-2">重量加成:</span>
      <GameCommonResourceIconAndName resource-id="gold" :count="weightBonus"></GameCommonResourceIconAndName>
    </div>
    <div class="text-sm text-gray-600 dark:text-gray-300">
      <span class="mr-2">品质加成:</span>
      <GameCommonResourceIconAndName resource-id="gold" :count="qualityBonus"></GameCommonResourceIconAndName>
    </div>

    </div>

    <div class="mt-3 font-semibold">
      <span class="mr-2">合计:</span>
      <GameCommonResourceIconAndName resource-id="gold" :count="totalPrice"></GameCommonResourceIconAndName>
    </div>

    <div class="flex justify-end space-x-2 mt-4">
      <el-button type="default" @click="onClose">取消</el-button>

      <template v-if="fish && (fish.quality ?? 0) > 3">
        <el-popconfirm
          title="确定出售这条高品相鱼吗？"
          confirm-button-text="确定"
          cancel-button-text="取消"
          @confirm="onConfirm"
        >
          <template #reference>
            <el-button type="primary">确认出售</el-button>
          </template>
        </el-popconfirm>
      </template>

      <template v-else>
        <el-button type="primary" @click="onConfirm">确认出售</el-button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { CaughtFishDTO } from '~/shared/types/fishing'
import { allFishSpecies, type AllFishSpeciesID } from '~/shared/data/allFishSpecies'
import { emitSellCaughtFish, onSellCaughtFishSuccess, onSellCaughtFishFail } from '~/api/game/socket/fishing'
import { formatNumber } from '~/shared/utils'
import type { } from '#components'

const props = defineProps<{ fish: CaughtFishDTO }>()
const emit = defineEmits(['close', 'sold'])

const fish = computed(() => props.fish)
const species = computed(() => fish.value ? allFishSpecies[fish.value.fishId as AllFishSpeciesID] : undefined)

const basePrice = computed(() => species.value?.shopBaseRecallPrice ?? 0)
const lengthBonus = computed(() => (species.value?.extraPriceForEachLength ?? 0) * (fish.value?.length ?? 0))
const weightBonus = computed(() => (species.value?.extraPriceForEachWeight ?? 0) * (fish.value?.weight ?? 0))
const qualityBonus = computed(() => (species.value?.extraPriceForEachQuality ?? 0) * ((fish.value?.quality ?? 0)))
const totalPrice = computed(() => Math.max(0, Math.floor(basePrice.value + lengthBonus.value + weightBonus.value + qualityBonus.value)))

function onClose() {
  emit('close')
}

function onConfirm() {
  if (!fish.value) return
  emitSellCaughtFish({ caughtFishId: fish.value.id })
}

let unsubSuccess: (() => void) | null = null
let unsubFail: (() => void) | null = null

onMounted(() => {
  unsubSuccess = onSellCaughtFishSuccess((payload: any) => {
    emit('sold', payload)
    // parent is responsible for hiding the dialog
  })
  unsubFail = onSellCaughtFishFail((payload: any) => {
    // forward failure as close so parent can react
    emit('close')
  })
})

onUnmounted(() => {
  if (typeof unsubSuccess === 'function') unsubSuccess()
  if (typeof unsubFail === 'function') unsubFail()
})

function formatPrice(amount: number): string {
  return formatNumber(amount)
}
</script>

<style scoped>
.btn {
  padding: 6px 12px;
  border-radius: 6px
}

.btn-primary {
  background: #2563eb;
  color: white
}
</style>
