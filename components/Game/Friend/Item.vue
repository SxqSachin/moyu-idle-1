<template>
  <el-list-item>
    <span>{{ uuid }}</span>
    <el-button type="danger" size="small" @click="remove">删除</el-button>
  </el-list-item>
</template>
<script setup lang="ts">
import { emitRemoveFriend } from '~/api/game/socket/friend'
const props = defineProps<{ uuid: string }>()
const emit = defineEmits(['removed'])

function remove() {
  emitRemoveFriend(props.uuid)
  emit('removed')
}
</script>