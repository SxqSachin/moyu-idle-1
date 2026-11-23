<template>
  <el-select
    :model-value="modelValue"
    @update:model-value="onUpdate"
    :placeholder="placeholder"
    :filterable="filterable"
    :clearable="clearable"
    :disabled="disabled"
    class="w-full"
  >
    <el-option
      v-for="opt in options"
      :key="opt.value"
      :label="opt.label"
      :value="opt.value"
    >
      <div class="flex items-center gap-1">
        <GameCommonSimpleResourceIconAndName :resource-id="opt.value" :hide-name="true" :icon-size="12" />
        <span class="text-xs">{{ opt.label }}</span>
      </div>
    </el-option>
  </el-select>
  
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { GameCommonSimpleResourceIconAndName } from '#components'
import { allGameResourceWithInternal, allGameResourceCategoryInfo } from '~/shared/data/allGameResources'
import { GameResourceCategory } from '~/shared/types/gameResource'

interface Props {
  modelValue?: string | null
  onlyMoney?: boolean
  filterable?: boolean
  clearable?: boolean
  disabled?: boolean
  placeholder?: string
  includeHiddenInShop?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  onlyMoney: false,
  filterable: true,
  clearable: true,
  disabled: false,
  placeholder: '选择资源',
  includeHiddenInShop: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | null | undefined): void
}>()

function onUpdate(v: any) {
  emit('update:modelValue', v)
}

const options = computed(() => {
  const list = Object.values(allGameResourceWithInternal)
    .filter((res: any) => {
      if (!res || !res.id) return false
      // filter internal resources
      if (res.isInternal) return false
      // optional: hide items that should not appear in shop selectors
      if (
        !props.includeHiddenInShop &&
        res.category?.some((c: any) => {
          const key = c as keyof typeof allGameResourceCategoryInfo
          return allGameResourceCategoryInfo[key]?.hiddenInShop
        })
      ) {
        return false
      }
      // only money filter
      if (props.onlyMoney) {
        return res.category?.includes(GameResourceCategory.Currency)
      }
      return true
    })
    .map((res: any) => ({ value: res.id as string, label: res.name as string }))

  // Sort by label Pinyin-ish: keep simple locale compare
  return list.sort((a, b) => a.label.localeCompare(b.label))
})

</script>
