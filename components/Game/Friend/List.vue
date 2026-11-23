<template>
  <div class="flex flex-row justify-between">
    <GameFriendAdd @add="emits('refresh')" />
    <el-button @click="refresh">刷新</el-button>
  </div>

  <el-divider class="my-2! mt-4!"></el-divider>

  <el-scrollbar height="520px">
    <div v-if="!friends.length" class="text-gray-400 text-center py-8 select-none">
      暂无好友
    </div>
    <div v-else class="divide-y divide-gray-100">
      <div v-for="f in friends" :key="f.uuid"
        class="flex items-center justify-between py-2 px-1 hover:bg-gray-50 transition">
        <GameUserAvatarAndName @click="showPlayerInfo(f)" :uuid="f.uuid"></GameUserAvatarAndName>
        <div>
          <el-button size="small" type="success" @click="chat(f.name, f.uuid)">私聊</el-button>
          <el-button size="small" type="danger" @click="remove(f.uuid)">删除</el-button>
        </div>
      </div>
    </div>
  </el-scrollbar>

  <!-- 玩家信息弹窗 -->
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
import { ElMessageBox } from 'element-plus'
import { emitGetFriendList, onGetFriendList, emitRemoveFriend, onRemoveFriendSuccess, onRemoveFriendFail } from '~/api/game/socket/friend'
import { waitUtilConnected } from '~/api/game/socket/socket'
import type { FuncAction } from '~/shared/types'
import { UserFilled } from '@element-plus/icons-vue'


const emits = defineEmits(['refresh'])

const friends = ref<{name: string, uuid: string}[]>([])
let off: FuncAction
let off2: FuncAction
let off3: FuncAction

function refresh() {
  emitGetFriendList()
}
async function remove(uuid: string) {
  const target = friends.value.find(f => f.uuid === uuid)
  const name = target?.name || '该玩家'
  try {
    await ElMessageBox.confirm(
      `确认要删除好友【${name}】吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        autofocus: false,
      }
    )
  } catch { return } // 用户取消

  emitRemoveFriend(uuid)
  refresh()
}

// 弹窗相关
const playerInfoDialogVisible = ref(false);
const currentSelectPlayerUuid = ref<string | null>(null);

function showPlayerInfo(row: any) {
  currentSelectPlayerUuid.value = row.uuid || null;
  playerInfoDialogVisible.value = true;
}

function chat(name: string,uuid: string) {
  eventBus.emit('open-private-chat', { name, uuid })
}

onMounted(async () => {
  await waitUtilConnected()
  refresh()
  off = onGetFriendList(({ list }) => {
    friends.value = list
  })

  off2 = onRemoveFriendSuccess(() => {
    refresh()
  })
  off3 = onRemoveFriendFail(() => {
    refresh()
  })
})

onUnmounted(() => {
  off?.()
  off2?.()
  off3?.()
})

defineExpose({ refresh })
</script>