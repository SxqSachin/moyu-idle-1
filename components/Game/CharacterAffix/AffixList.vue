<template>
  <!-- 词条列表：按启用状态分区块展示 -->
  <div class="space-y-4">
    <!-- 已启用 -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">已启用</div>
        <div class="text-xs text-gray-500">{{ activeAffixes.length }} 条</div>
      </div>
      <div class="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 items-stretch">
        <div v-for="a in activeAffixes" :key="a.id" :class="[
            'mb-2 break-inside-avoid rounded-md border-2 border-solid border-transparent transition-colors',
            selectable ? 'cursor-pointer' : '',
            selectable && isSelected(a.id!) ? 'border-red-500!' : ''
          ]" @click="selectable && onToggleSelect(a.id!)">
          <AffixItemCard :affix="a" :compact="!!selectable" :hide-delete="!!selectable"
            @update:state="(s) => $emit('update:state', a, s)" @remove="$emit('remove', a)" @reroll="$emit('reroll', a)"
            @reroll-up="$emit('reroll-up', a)" @upgrade-rarity="$emit('upgrade-rarity', a)" />
        </div>
        <div v-if="!activeAffixes.length" class="text-xs text-gray-400 col-span-full py-4 text-center">暂无已启用词条</div>
      </div>
    </div>

    <!-- 未启用 / 锁定 -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">未启用</div>
        <div class="text-xs text-gray-500">{{ inactiveAffixes.length }} 条</div>
      </div>
      <div class="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 items-stretch">
        <div v-for="a in inactiveAffixes" :key="a.id" :class="[
            'mb-2 break-inside-avoid opacity-80 rounded-md border-2 border-solid border-transparent transition-colors',
            selectable ? 'cursor-pointer' : '',
            selectable && isSelected(a.id!) ? 'border-red-500!' : ''
          ]" @click="selectable && onToggleSelect(a.id!)">
          <AffixItemCard :affix="a" :compact="!!selectable" :hide-delete="!!selectable"
            @update:state="(s) => $emit('update:state', a, s)" @remove="$emit('remove', a)" @reroll="$emit('reroll', a)"
            @reroll-up="$emit('reroll-up', a)" @upgrade-rarity="$emit('upgrade-rarity', a)" />
        </div>
        <div v-if="!inactiveAffixes.length" class="text-xs text-gray-400 col-span-full py-4 text-center">暂无未启用词条</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CharacterAffixInstance, CharacterAffixState } from '~/shared/types/affix'
import AffixItemCard from './AffixItemCard.vue'

const props = defineProps<{ affixes: CharacterAffixInstance[]; selectable?: boolean; selectedIds?: number[] }>()

const emit = defineEmits<{
  (e: 'update:state', item: CharacterAffixInstance, newState: CharacterAffixState): void
  (e: 'remove', item: CharacterAffixInstance): void
  (e: 'reroll', item: CharacterAffixInstance): void
  (e: 'reroll-up', item: CharacterAffixInstance): void
  (e: 'upgrade-rarity', item: CharacterAffixInstance): void
  (e: 'update:selectedIds', v: number[]): void
}>()

// 按状态分组：ACTIVE 放在“已启用”，其余（INACTIVE/LOCKED/未知）放在“未启用 / 锁定”
const activeAffixes = computed(() => (props.affixes || []).filter(a => a.state === 'ACTIVE'))
const inactiveAffixes = computed(() => (props.affixes || []).filter(a => a.state !== 'ACTIVE'))

function isSelected(id: number) {
  const set = new Set(props.selectedIds || [])
  return set.has(id)
}
function onToggleSelect(id: number) {
  const set = new Set(props.selectedIds || [])
  if (set.has(id)) set.delete(id); else set.add(id)
  emit('update:selectedIds', Array.from(set))
}
</script>

<style scoped>
</style>
