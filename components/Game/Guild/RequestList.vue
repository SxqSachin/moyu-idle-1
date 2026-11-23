<template>
  <el-card>
    <div class="flex items-center font-bold text-lg mb-2 gap-2">
      <span>入会申请</span>
    </div>
    <el-scrollbar height="420px">
      <el-empty v-if="!requestPlayers.length" description="暂无入会申请">
        <el-button type="primary" @click="refresh" :loading="loadingList">刷新</el-button>
      </el-empty>
      <div v-else class="divide-y divide-gray-100">
        <div v-for="req in requestPlayers" :key="req.userUuid"
          class="flex items-center justify-between py-2 px-1 hover:bg-gray-50 transition">
          <GameUserAvatarAndName @click="showPlayerInfo(req.userUuid)" :uuid="req.userUuid">
          </GameUserAvatarAndName>
          <div class="flex gap-2">
            <el-button size="small" type="success" @click="approve(req)">同意</el-button>
            <el-button size="small" type="danger" @click="reject(req)">拒绝</el-button>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </el-card>
    <el-dialog v-model="playerInfoDialogVisible" align-center width="420px" :show-close="true"
        :close-on-click-modal="true" destroy-on-close>
        <template #header>
            <span>玩家信息</span>
        </template>

        <GameCharacterInfo :character-uuid="currentSelectPlayerUuid!"></GameCharacterInfo>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { emitGetGuildJoinRequests, onGetGuildJoinRequests, emitHandleJoinRequest, onHandleJoinRequestSuccess, onHandleJoinRequestFail } from '~/api/game/socket/guild'
import { waitUtilConnected } from '~/api/game/socket/socket'
import type { FuncAction } from '~/shared/types'

type PlayerRequest = {
  createdAt: Date,
  message: string | null
  status: string
  userUuid: string
}

const props = defineProps<{ guildUuid: string }>()
const requests = ref<
  {
    guildUuid: string;
    requests: PlayerRequest[]
  }>()

const requestPlayers = computed(() => {
  if (!requests.value || !requests.value.requests) {
    return []
  }
  return requests.value.requests.filter(req => {
    return req.status === "PENDING"
  }).map(req => ({
    userUuid: req.userUuid,
    createdAt: req.createdAt,
    message: req.message,
    status: req.status
  }))
})

let off: FuncAction
let off1: FuncAction
let off2: FuncAction

let loadingList = ref(false)
function refresh() {
  loadingList.value = true
  emitGetGuildJoinRequests(props.guildUuid)
}
function approve(req: PlayerRequest) {
  emitHandleJoinRequest(props.guildUuid, req.userUuid, true)
}
function reject(req: PlayerRequest) {
  emitHandleJoinRequest(props.guildUuid, req.userUuid, false)
}

const currentSelectPlayerUuid = ref("");
const playerInfoDialogVisible = ref(false);
function showPlayerInfo(uuid: string) {
  currentSelectPlayerUuid.value = uuid;
  playerInfoDialogVisible.value = true;
}

onMounted(async () => {
  await waitUtilConnected();
  refresh()

  off = onGetGuildJoinRequests((args) => {
    requests.value = args

    loadingList.value = false
  })

  off1 = onHandleJoinRequestSuccess((args) => {
    if (args.approve) {
      ElNotification({
        title: "已同意入会申请",
        type: "success",
        duration: 1800,
      })
    } else {
      ElNotification({
        title: "已拒绝入会申请",
        type: "error",
        duration: 1800,
      })
    }

    refresh()
  })
  off2 = onHandleJoinRequestFail((args) => {
    ElNotification({
      title: `入会申请处理失败: ${args.message}`,
      type: "error",
      duration: 1800,
    })

    refresh()
  })
})
onUnmounted(() => {
  off?.()
  off1?.()
  off2?.()
})
</script>