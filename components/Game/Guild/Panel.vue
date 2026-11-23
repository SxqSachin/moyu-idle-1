<template>
  <div>
    <el-tabs v-model="tab">
      <template v-if="myGuild">
        <el-tab-pane :lazy="true" label="公会信息" name="info">
          <GameGuildInfo :guild-uuid="myGuild.uuid"></GameGuildInfo>
        </el-tab-pane>

        <el-tab-pane :lazy="true" label="成员" name="my">
          <GameGuildMemberList :my-member-info="myGuildMemberInfo" :guild-uuid="myGuild.uuid" />
        </el-tab-pane>

        <el-tab-pane :lazy="true" label="仓库" name="inventory" v-if="myGuildMemberInfo">
          <GameGuildInventory :guild-uuid="myGuild.uuid" :my-member-info="myGuildMemberInfo" />
        </el-tab-pane>

        <el-tab-pane :lazy="true" label="建筑" name="building" v-if="myGuildMemberInfo">
          <GameGuildBuilding :guild-uuid="myGuild.uuid" :my-member-info="myGuildMemberInfo" />
        </el-tab-pane>

        <el-tab-pane :lazy="true" label="入会申请" name="request" v-if="isLeader || isOfficer">
          <GameGuildRequestList :guildUuid="myGuild.uuid" />
        </el-tab-pane>
      </template>
      <template v-else>
        <el-tab-pane :lazy="true" label="创建公会" name="create">
          <GameGuildCreate @create-success="refreshMyGuild"/>
        </el-tab-pane>
      </template>
      <el-tab-pane :lazy="true" label="公会列表" name="list">
        <GameGuildList />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, } from 'vue'
import { emitGetMyGuild, emitGetMyGuildMemberInfo, onGetMyGuildMemberInfoFailed, onGetMyGuildMemberInfoSuccess } from '~/api/game/socket/guild'
import { useMyGuild } from '~/composables/game/useMyGuild'
import type { FuncAction } from '~/shared/types'
import { GuildRole, type GuildMemberInfo } from '~/shared/types/guild'

const { user } = useUserSession()
const myGuild = useMyGuild()
const myGuildMemberInfo = ref<GuildMemberInfo>()

const tab = ref(myGuild.value ? 'info' : 'create')

const isLeader = computed(() => myGuild.value?.uuid == myGuildMemberInfo.value?.guildUuid && myGuildMemberInfo.value?.role === GuildRole.LEADER)
const isOfficer = computed(() => myGuild.value?.uuid == myGuildMemberInfo.value?.guildUuid && myGuildMemberInfo.value?.role === GuildRole.OFFICER)

let off1: FuncAction
let off2: FuncAction

watch(myGuild, (newGuild) => {
  if (newGuild?.uuid) {
    emitGetMyGuildMemberInfo(newGuild.uuid)
  }
})

onMounted(async () => {
  off1 = onGetMyGuildMemberInfoSuccess(({ guildUuid, member }) => {
    if (!!guildUuid && guildUuid == myGuild.value?.uuid) {
      myGuildMemberInfo.value = member
    }
  })

  off2 = onGetMyGuildMemberInfoFailed(({ message }) => {
    ElNotification.error({
      title: '获取公会成员信息失败',
      message: message || '获取失败',
    })
  })

  if (myGuild.value?.uuid) {
    emitGetMyGuildMemberInfo(myGuild.value.uuid)
  }
})
onUnmounted(() => {
  off1?.()
  off2?.()
})

function refreshMyGuild() {
  // 重新获取用户信息或guild信息

  emitGetMyGuild()
  tab.value = 'info'
}
</script>