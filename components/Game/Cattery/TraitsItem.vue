<template>
  <el-card class="w-full">
    <div class="flex items-start gap-3">
      <div class="flex-1">
        <div class="font-bold">{{ trait.name }}</div>
        <div class="text-sm text-gray-500">{{ displayDescription }}</div>
        <div class="text-xs text-gray-400 mt-2">等级: {{ row.level }} 经验: {{ row.currentExp }}</div>
      </div>
      <div class="flex flex-col gap-2">
        <!-- <el-input-number v-model="addExpCount" :min="1" :max="9999" size="small"></el-input-number>
        <el-button size="small" type="primary" @click="handleAddExp">加经验</el-button> -->
        <el-popover placement="bottom" width="280" trigger="click">
          <template #reference>
            <el-button size="small" type="danger">移除</el-button>
          </template>
          <div class="flex flex-col gap-2">
            <div class="text-sm font-medium mb-2">移除该特性需要资源</div>
            <div class="w-fit">
              <GameCommonItemCountInfoIconAndName :item-count-info="REMOVE_KITTY_TRAIT_RESOURCE_REQUIREMENT" :show-count="true" :show-inventory-count="true"></GameCommonItemCountInfoIconAndName>
            </div>
            <el-button class="mt-2" size="small" type="primary" @click="handleRemove">确认移除</el-button>
          </div>
        </el-popover>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, toRef, computed } from 'vue'
import type { KittyTraitRow } from '~/api/game/socket/kittyTraits'
import type { KittyTrait } from '~/shared/types/kitty'
import ResourceIconAndName from '~/components/Game/Common/ResourceIconAndName.vue'
import { REMOVE_KITTY_TRAIT_RESOURCE_REQUIREMENT } from '~/shared/data/constant';

const props = defineProps<{ row: KittyTraitRow; trait: KittyTrait; kitTraits?: any }>()

const row = toRef(props, 'row')
const trait = toRef(props, 'trait')

const addExpCount = ref(10)
// use the parent's kitTraits instance if provided to avoid registering listeners in many child items
const parentKitTraits = toRef(props as any, 'kitTraits')

const displayDescription = computed(() => {
  const d = trait.value.description as any
  try {
    if (typeof d === 'function') {
      return d({ level: row.value.level })
    }
    return d ?? ''
  } catch (e) {
    return String(d ?? '')
  }
})

function handleAddExp() {
  const kt = parentKitTraits.value ?? null
  if (kt && typeof kt.addExp === 'function') {
    kt.addExp(row.value.kittyUuid, row.value.traitId, addExpCount.value)
  }
}

function handleRemove() {
  const kt = parentKitTraits.value ?? null
  if (kt && typeof kt.removeTrait === 'function') {
    kt.removeTrait(row.value.kittyUuid, row.value.traitId)
  }
}
</script>

<style scoped>
</style>
