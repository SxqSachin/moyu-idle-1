<template>
  <el-scrollbar height="520px">
    <el-empty v-if="!pendingRequests.length" description="暂无好友请求" />
    <div v-else class="divide-y divide-gray-100">
      <div v-for="req in pendingRequests" :key="req.id"
        class="flex items-center justify-between py-2 px-1 hover:bg-gray-50 transition">
        <GameUserAvatarAndName :uuid="req.fromUserUuid"></GameUserAvatarAndName>
        <div class="flex gap-2">
          <el-button size="small" type="success" @click="accept(req.id)">接受</el-button>
          <el-button size="small" type="danger" @click="reject(req.id)">拒绝</el-button>
        </div>
      </div>
    </div>
  </el-scrollbar>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { emitGetFriendRequests, emitAcceptFriendRequest, emitRejectFriendRequest, onAcceptFriendRequestSuccess, onAcceptFriendRequestFail, onRejectFriendRequestSuccess, onRejectFriendRequestFail } from '~/api/game/socket/friend'
import { waitUtilConnected } from '~/api/game/socket/socket'
import type { FuncAction } from '~/shared/types'
import { useFriendRequest } from '~/composables/game/useFriendRequest'

const requests = useFriendRequest();
let off2: FuncAction
let off3: FuncAction
let off4: FuncAction
let off5: FuncAction

const pendingRequests = computed(() => requests.value.filter(r => r.status === 'PENDING'))

function refresh() {
  emitGetFriendRequests()
}
function accept(id: number) {
  emitAcceptFriendRequest(id)
}
function reject(id: number) {
  emitRejectFriendRequest(id)
}

onMounted(async () => {
  await waitUtilConnected()
  refresh()
  off2 = onAcceptFriendRequestSuccess(() => {
    refresh()
  })
  off3 = onAcceptFriendRequestFail(() => {
    refresh()
  })
  off4 = onRejectFriendRequestSuccess(() => {
    refresh()
  })
  off5 = onRejectFriendRequestFail(() => {
    refresh()
  })
})

onUnmounted(() => {
    off2?.()
    off3?.()
    off4?.()
    off5?.()
})

defineExpose({ refresh })
</script>