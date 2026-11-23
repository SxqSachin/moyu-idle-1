<template>
  <div class="p-6 max-w-md mx-auto bg-white rounded shadow space-y-6">
    <el-form :model="form" label-width="80px" @submit.prevent="onSubmit">
      <el-form-item label="玩家用户名">
        <el-input v-model="form.targetName" placeholder="请输入玩家用户名" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="danger" @click="onSubmit" :loading="loading">移除用户房间</el-button>
      </el-form-item>
    </el-form>
    <el-alert v-if="successMsg" type="success" :closable="false" show-icon class="mt-2" :title="successMsg" />
    <el-alert v-if="errorMsg" type="error" :closable="false" show-icon class="mt-2" :title="errorMsg" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import { emitGmRemoveUserRoom, onGmRemoveUserRoomSuccess, onGmRemoveUserRoomFail } from "~/api/game/socket/gm"
import { waitUtilConnected } from "~/api/game/socket/socket"
import type { FuncAction } from "~/shared/types"

const form = ref({
  targetName: "",
})

const loading = ref(false)
const successMsg = ref("")
const errorMsg = ref("")

const onSubmit = () => {
  successMsg.value = ""
  errorMsg.value = ""
  if (!form.value.targetName) {
    errorMsg.value = "请输入玩家用户名"
    return
  }
  loading.value = true
  emitGmRemoveUserRoom(form.value.targetName)
}

let unbind1: FuncAction
let unbind2: FuncAction
onMounted(async () => {
  await waitUtilConnected()
  unbind1 = onGmRemoveUserRoomSuccess(() => {
    loading.value = false
    successMsg.value = "移除用户房间成功"
  })
  unbind2 = onGmRemoveUserRoomFail((err) => {
    loading.value = false
    errorMsg.value = err.message || "移除失败"
  })
})

onUnmounted(() => {
  unbind1?.()
  unbind2?.()
})
</script>