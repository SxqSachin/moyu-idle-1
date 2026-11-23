<template>
  <el-dialog v-model="innerOpen" title="开垦田地" width="320px" :close-on-click-modal="false">
    <div class="space-y-3">
      <div class="text-sm text-gray-600">将开垦 田地 #{{ plotIndex }}</div>
      <div>
        <div class="text-sm text-gray-600 mb-1">需要资源</div>
          <div class="text-sm text-gray-700 flex flex-row flex-wrap gap-2 mt-2">
              <template v-if="scaledRequirement.length" v-for="r in scaledRequirement" :key="r.id">
                  <div class="w-auto">
                    <GameCommonResourceIconAndName :resource-id="r.id" :count="r.count" :show-inventory-count="true" />
                  </div>
              </template>
              <template v-else>
                <div class="text-sm text-gray-500">无需资源</div>
              </template>
              <div v-if="(plotIndex ?? 0) >= 6" class="w-full text-[11px] text-gray-400 leading-tight">
                * 第 6 块之后新增的田地解锁成本不再继续增加
              </div>
            <!-- <li >{{ r.id }} × {{ r.count }}</li> -->
          </div>
      </div>
    </div>

    <template #footer>
      <div class="flex gap-2 justify-end">
        <el-button @click="onCancel">取消</el-button>
        <el-button type="primary" @click="onConfirm">确认</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { ResourceRequirement } from '~/shared/types/gameAction'

const props = defineProps<{ open: boolean; plotIndex: number | null; requirement: ResourceRequirement[] }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'confirm', payload: { plotIndex: number }): void
}>()

const innerOpen = ref(false)
watch(() => props.open, v => innerOpen.value = v)
watch(innerOpen, v => emit('update:open', v))

const plotIndex = computed(() => props.plotIndex)
const requirement = computed(() => props.requirement)

/**
 * Mirror server-side scaling (updated):
 * multiplier = clamp(plotIndex, 0, 5)
 * 第 0~5 块按索引线性增加, 之后保持与第 6 块(索引5)一致
 */
const scaledRequirement = computed(() => {
  const idx = Number(plotIndex.value ?? 0)
  const multiplier = Math.min(5, Math.max(0, idx))
  const base = requirement.value || []
  return (base || []).map(r => ({
    ...r,
    count: Math.max(0, Math.floor((r.count ?? 0) * multiplier))
  })).filter(r => (r.count ?? 0) > 0)
})

function onCancel() {
  innerOpen.value = false
}

function onConfirm() {
  if (plotIndex.value == null) return
  emit('confirm', { plotIndex: plotIndex.value })
}
</script>
