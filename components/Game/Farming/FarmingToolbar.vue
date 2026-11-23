<template>
  <div class="flex items-center gap-2">
    <el-button type="warning" size="small" class="!px-4" @click="$emit('create')">
      新建田地
    </el-button>
    <el-button type="primary" size="small" class="!px-4" @click="$emit('refresh')">
      刷新
    </el-button>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ (e: 'refresh'): void; (e: 'create'): void }>()
</script>
