<template>
  <div class="flex flex-row gap-2 items-center">
    <el-input v-model="uuid" placeholder="输入用户名" style="width: 160px;" />
    <el-button type="primary" @click="addFriend" :loading="loading">添加好友</el-button>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { emitSendFriendRequest } from '~/api/game/socket/friend'

const uuid = ref('')
const loading = ref(false)

function addFriend(e: Event) {
  if (!uuid.value) return
  if (!e.isTrusted) return
  loading.value = true
  emitSendFriendRequest(uuid.value)
  setTimeout(() => loading.value = false, 1000)
}
</script>