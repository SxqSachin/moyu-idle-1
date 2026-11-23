<template>
  <el-dialog v-model="visible" title="特性" width="600px">
    <!-- <div class="mb-4 flex items-center gap-3">
      <el-select v-model="selectedTraitIdToAdd" placeholder="选择特性添加" clearable style="min-width:240px">
        <el-option v-for="(t, id) in allTraits" :key="id" :label="t.name" :value="id"></el-option>
      </el-select>
      <el-button type="primary" @click="handleAddTrait" :disabled="!selectedTraitIdToAdd">添加特性</el-button>
    </div> -->

    <div class="grid grid-cols-1 gap-3">
      <div v-for="row in traitsForKitty" :key="row.traitId">
        <GameCatteryTraitsItem :row="row" :trait="allTraits[row.traitId]" :kit-traits="kitTraits" />
      </div>
      <div v-if="!traitsForKitty.length" class="text-gray-500">该猫咪暂未拥有任何特性</div>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useKittyTraits } from '~/composables/game/useKittyTraits'
import allKittyTraits from '~/shared/data/kittyTraits'
import GameCatteryTraitsItem from './TraitsItem.vue'

const props = defineProps<{ kittyUuid: string; modelValue: boolean }>()
const emit = defineEmits(['update:modelValue'])

const visible = ref(props.modelValue)
const selectedTraitIdToAdd = ref<string | null>(null)

const kitTraits = useKittyTraits()
const allTraits = allKittyTraits

watch(() => props.modelValue, (v) => (visible.value = v))
watch(visible, (v) => emit('update:modelValue', v))

const traitsForKitty = computed(() => kitTraits.state.value[props.kittyUuid] ?? [])

function handleAddTrait() {
  if (!selectedTraitIdToAdd.value) return
  kitTraits.addTrait(props.kittyUuid, selectedTraitIdToAdd.value)
  selectedTraitIdToAdd.value = null
}

// fetch when opening
watch(visible, (v) => {
  if (v) kitTraits.fetch(props.kittyUuid)
})
</script>

<style scoped></style>
