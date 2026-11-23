<template>
  <el-card>
    <el-tabs>
      <el-tab-pane label="好友列表">

        <GameFriendList ref="friendList" @refresh="refreshAll" />
      </el-tab-pane>
      <el-tab-pane label="好友请求">
        <GameFriendRequestList ref="requestList" @action="refreshAll" />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="推荐" v-if="!ironcat">
        <GameFriendReferral></GameFriendReferral>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { useIronCat } from '~/composables/game/useIronCat'

const friendList = ref()
const requestList = ref()

const ironcat = useIronCat();

function refreshAll() {
  friendList.value?.refresh?.()
  requestList.value?.refresh?.()
}
</script>