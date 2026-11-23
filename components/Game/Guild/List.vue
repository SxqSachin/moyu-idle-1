<template>
  <el-card>
    <div class="flex justify-between items-center mb-4">
      <span class="text-xl font-bold">公会列表</span>
      <div class="flex items-center gap-2">
        <el-input v-model="search" placeholder="搜索公会" class="w-64" clearable />
        <el-button @click="refreshList" :loading="loading">刷新</el-button>
      </div>
    </div>
    <el-table :data="filteredGuilds" class="w-full" stripe>
      <el-table-column prop="name" label="公会名称">
        <template #default="scope">
          <span class="text-blue-600 cursor-pointer hover:underline" @click="showGuildDetail(scope.row)">
            {{ scope.row.name }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="简介" />
      <el-table-column prop="level" label="等级" width="80" />
      <el-table-column v-if="!myGuild" label="操作" width="120">
        <template #default="scope">
          <el-button size="small" @click="onJoin(scope.row)" type="primary"
            :loading="loadingGuildId === scope.row.uuid">
            申请加入
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
  <el-dialog v-model="guildDetailDialogVisible" @close="currentGuild = null; otherGuildActiveTab = 'info'" title="公会详情" width="420px" align-center>
    <template v-if="currentGuild">
      <el-tabs v-model="otherGuildActiveTab">
        <el-tab-pane :lazy="true" label="公会信息" name="info">
          <GameGuildInfoReadonly :guild-uuid="currentGuild.uuid" :guild="currentGuild"></GameGuildInfoReadonly>
        </el-tab-pane>

        <el-tab-pane :lazy="true" label="成员列表" name="my">
          <GameGuildMemberList :guild-uuid="currentGuild.uuid" :readonly="true" />
        </el-tab-pane>
      </el-tabs>
    </template>
  </el-dialog>

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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { emitGetGuildList, emitRequestJoinGuild, onGetGuildList, onRequestJoinGuildSuccess, onRequestJoinGuildFail } from '~/api/game/socket/guild'
import { waitUtilConnected } from '~/api/game/socket/socket'
import type { FuncAction } from '~/shared/types'
import type { GameGuild } from '~/shared/types/guild'
import { useMyGuild } from '~/composables/game/useMyGuild'
import { useIronCat } from '~/composables/game/useIronCat'

const guilds = ref<GameGuild[]>([])
const search = ref('')
const loadingGuildId = ref<string | null>(null)
const loading = ref(false)
const myGuild = useMyGuild()
const ironCat = useIronCat();

const guildDetailDialogVisible = ref(false)
const currentGuild = ref<GameGuild | null>(null)

const otherGuildActiveTab = ref("info")

function showGuildDetail(guild: GameGuild) {
  currentGuild.value = guild
  guildDetailDialogVisible.value = true
}

let offGetList: FuncAction | undefined
let offJoinSuccess: FuncAction | undefined
let offJoinFail: FuncAction | undefined

function refreshList() {
  loading.value = true
  emitGetGuildList()
}

onMounted(async () => {
  await waitUtilConnected()
  refreshList()
  offGetList = onGetGuildList(({ list }) => {
    guilds.value = list
    loading.value = false
  })
  offJoinSuccess = onRequestJoinGuildSuccess(() => {
    loadingGuildId.value = null
    ElNotification({
      title: '申请已提交',
      message: '请耐心等待公会审核',
      type: 'success',
      duration: 1800,
    })
  })
  offJoinFail = onRequestJoinGuildFail((e) => {
    loadingGuildId.value = null
    ElNotification({
      title: '申请加入公会失败',
      message: e.message,
      type: 'error',
      duration: 1800,
    })
  })
})

onUnmounted(() => {
  offGetList?.()
  offJoinSuccess?.()
  offJoinFail?.()
})

const filteredGuilds = computed(() =>{
  let res = guilds.value.filter(g => g.name.includes(search.value) || (g.description ?? '').includes(search.value))

  if (ironCat.value) {
    res = res.filter(g => {
      return g.ironcat
    })
  }

  return res;
})

function onJoin(guild: GameGuild) {
  loadingGuildId.value = guild.uuid
  emitRequestJoinGuild(guild.uuid)
}

const currentSelectPlayerUuid = ref("");
const playerInfoDialogVisible = ref(false);
</script>