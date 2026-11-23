<template>
  <el-tabs v-model="activeKittyUuid" class="w-full">
    <el-tab-pane v-for="kitty in kitties" :key="kitty.uuid" :label="kitty.name" :name="kitty.uuid" lazy>
      <div v-if="allData[kitty.uuid]?.length" class="space-y-3 py-2">
        <div v-for="friend in allData[kitty.uuid]"
          :key="friend.kittyAUuid === kitty.uuid ? friend.kittyBUuid : friend.kittyAUuid"
          class="flex items-center justify-between gap-3 p-3 rounded bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
          <div>
            <GameCommonKittyInfo :uuid="friend.kittyAUuid === kitty.uuid ? friend.kittyBUuid : friend.kittyAUuid"
              :plain="true" />
            <span class="text-xs text-gray-500 dark:text-gray-400">
              亲密度：{{ friend.intimacy }}
            </span>
            <span class="text-xs text-gray-400 ml-auto">
              成为玩伴时间：{{ formatTimeToStr(friend.becomeFriendTime) }}
            </span>
          </div>

          <div>
            <el-button size="small" type="danger" plain @click="handleDeleteFriend(friend)">删除</el-button>
          </div>
        </div>
      </div>
      <div v-else class="text-gray-400 dark:text-gray-500 text-sm py-4 text-center">
        暂无玩伴
      </div>
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import type { FuncAction } from '~/shared/types';
import { useKittyInfo } from '~/composables/game/useKittyInfo';
import { waitUtilConnected } from '~/api/game/socket/socket';
import { clone, formatTimeToStr } from '~/shared/utils';
import type { KittyFriendshipInfo } from '~/shared/types/kittyFriend';
import { emitDeleteKittyFriend, emitGetKittyFriend, onDeleteKittyFriendError, onDeleteKittyFriendSuccess, onGetKittyAllFriendError, onGetKittyAllFriendSuccess } from '~/api/game/socket/kittyFriend';

// 响应式数据
const kitties = useKittyInfo()
const allData = ref<{[kittyUuid: string]: KittyFriendshipInfo[]}>({})
const activeKittyUuid = ref<string>('')


// 事件监听器清理函数
let off1 : FuncAction;
let off2 : FuncAction;
let off3 : FuncAction;
let off4 : FuncAction;
onMounted(async () => {
  await waitUtilConnected()

  activeKittyUuid.value = kitties.value[0]?.uuid || '';

  off1 = onGetKittyAllFriendSuccess((res)=> {
    let kittyAUuid = res[0]?.kittyAUuid
    let kittyBUuid = res[0]?.kittyBUuid

    if (kitties.value.some(kitty => kitty.uuid === kittyAUuid)) {
      allData.value[kittyAUuid] = clone(res)
    }
    if (kitties.value.some(kitty => kitty.uuid === kittyBUuid)) {
      allData.value[kittyBUuid] = clone(res)
    }
  })
  off2 = onGetKittyAllFriendError(err => {
    ElNotification({
      title: '获取猫咪玩伴失败',
      message: err.message,
      type: 'error',
    })
  })

  off3 = onDeleteKittyFriendSuccess((res) => {
    let kittyAUuid = res[0]?.kittyAUuid
    let kittyBUuid = res[0]?.kittyBUuid

    if (kitties.value.some(kitty => kitty.uuid === kittyAUuid)) {
      allData.value[kittyAUuid] = clone(res)
    }
    if (kitties.value.some(kitty => kitty.uuid === kittyBUuid)) {
      allData.value[kittyBUuid] = clone(res)
    }
    ElNotification({
      title: '删除猫咪玩伴成功',
      message: '已成功删除该猫咪玩伴',
      type: 'success',
    });
  });
  off4 = onDeleteKittyFriendError(err => {
    ElNotification({
      title: '删除猫咪玩伴失败',
      message: err.message,
      type: 'error',
    })
  })

  for(const kitty of kitties.value) {
    emitGetKittyFriend(kitty.uuid)
  }
})
onUnmounted(() => {
  off1?.()
  off2?.()
  off3?.()
  off4?.()
})

const handleDeleteFriend = (friend: KittyFriendshipInfo) => {
  ElMessageBox.confirm(
    '您确定要删除这个玩伴吗？小猫咪可能因此而不开心😔',
    '删除玩伴',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    emitDeleteKittyFriend(friend.id)
  }).catch(() => { })
  // Emit delete friend event
}

</script>
