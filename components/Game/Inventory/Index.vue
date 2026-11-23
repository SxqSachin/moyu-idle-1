<template>
  <div>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="库存" name="full">
        <GameInventoryFull
          @show-in-market="(p) => emit('show-in-market', p)" />
      </el-tab-pane>
        <el-tab-pane :lazy="true" label="池塘" name="pond">
          <PondTab />
        </el-tab-pane>
      <el-tab-pane :lazy="true" label="库存变动记录" name="modify">
        <GameInventoryModifyInfo />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PondTab from '~/components/Game/Inventory/PondTab.vue'

const emit = defineEmits<{
    (e: 'show-in-market', payload: { itemId: string }): void
}>()

const activeTab = ref('full')
</script>