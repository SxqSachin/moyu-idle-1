<template>
  <el-popover placement="bottom" trigger="hover" :width="320" :show-after="200">
    <div class="text-base">
      <div class="flex items-center justify-between mb-2">
        <div class="font-medium">{{ title }}</div>
        <el-tag size="small" :type="effectTagType">{{ effectLabel }}</el-tag>
      </div>

      <div class="text-gray-600 text-sm mb-2">{{ descriptionText }}</div>

      <!-- <div v-if="tagsList.length" class="mb-2">
        <el-tag v-for="t in tagsList" :key="t" size="small" class="mr-1">{{ t }}</el-tag>
      </div> -->

      <div v-if="instance && instance.level != null" class="text-xs text-gray-500">
        等级: {{ instance.level }} / {{ traitDef?.maxLevel ?? '-' }}
      </div>
    </div>
    <template #reference>
      <el-tag size="small" :type="effectTagType" class="cursor-pointer">
        {{ title }}<span v-if="instance"> Lv{{ instance.level ?? 1 }}</span>
      </el-tag>
    </template>
  </el-popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import allKittyTraits from '~/shared/data/kittyTraits'
import type { KittyTraitInstance } from '~/shared/types/kitty'

const props = defineProps<{
  traitId: string
  instance?: KittyTraitInstance | null
}>()

const traitDef = computed(() => allKittyTraits[props.traitId])
const title = computed(() => traitDef.value?.name || props.traitId)
const descriptionText = computed(() => {
  const d = traitDef.value?.description
  if (!d) return ''
  if (typeof d === 'function') return d({ level: props.instance?.level })
  return d
})

const tagsList = computed(() => traitDef.value?.tags ?? [])

const effectLabel = computed(() => {
  const t = traitDef.value?.effectType
  if (!t) return '中性'
  if (t === 'buff') return '增益'
  if (t === 'debuff') return '减益'
  return '混合'
})

const effectTagType = computed(() => {
  const t = traitDef.value?.effectType
  if (t === 'buff') return 'success'
  if (t === 'debuff') return 'info'
  if (t === 'both') return 'warning'
  return 'info'
})
</script>
