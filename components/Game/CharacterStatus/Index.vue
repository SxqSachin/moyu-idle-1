<script setup lang="ts">
import { GameCharacterEquipment } from '#components';

const activeTab = ref('status')

const device = useDevice()
const isMobile = computed(() => device.isMobile)
</script>


<template>
  <!-- PC端布局 -->
  <div v-if="!isMobile" class="hidden md:flex flex-row gap-4">
    <GameCharacterStatusInfo class="w-1/2" />
    <div class="w-1/2">
      <GameCharacterEquipment />
    </div>
  </div>

  <!-- 移动端Tab布局 -->
  <div v-if="isMobile" class="md:hidden">
    <el-tabs v-model="activeTab" stretch>
      <el-tab-pane label="状态" name="status">
        <GameCharacterStatusInfo />
      </el-tab-pane>
      <el-tab-pane label="装备" name="equipment">
        <GameCharacterEquipment />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>