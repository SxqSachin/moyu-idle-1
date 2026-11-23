<template>
  <div class="flex gap-3">
    <el-button type="primary" @click="openBorrow = true">镜像列表</el-button>
    <el-button type="success" @click="openSaveDialog = true">照镜子</el-button>
    <el-button plain @click="openBorrowInfo = true">使用情况</el-button>

    <el-dialog v-model="openSaveDialog" title="照镜子" :width="isMobile ? 'auto' : '420px'" :destroy-on-close="true">
      <Save :guildUuid="guildUuid" @created="onCreated" @cancel="openSaveDialog = false" />
    </el-dialog>

    <el-dialog v-model="openBorrow" title="镜像列表" :width="isMobile ? 'auto' : '780px'" :destroy-on-close="true">
      <List :guild-uuid="guildUuid" @created="handleCreated" @close="openList = false" />
    </el-dialog>

    <el-dialog v-model="openBorrowInfo" title="镜像" :width="isMobile ? 'auto' : '580px'" :destroy-on-close="true">
      <BorrowInfo :guild-uuid="guildUuid" @close="openBorrowInfo = false" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import List from './List.vue'
import BorrowInfo from './CurrentBorrowInfo.vue'
import Save from './Save.vue'

const props = defineProps<{
  guildUuid: string
}>()

const openSaveDialog = ref(false)

const { isMobile } = useDevice()

const openList = ref(false)
const openBorrow = ref(false)
const openBorrowInfo = ref(false)

function handleCreated() {
  openList.value = false
}

function onCreated() {
  openSaveDialog.value = false
}
</script>