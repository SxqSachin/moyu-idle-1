<template>
  <div class="p-6 max-w-md mx-auto bg-white rounded shadow space-y-6">
    <el-form :model="form" label-width="80px" @submit.prevent="onSubmit">
      <el-form-item label="玩家UUID">
        <el-input v-model="form.targetName" placeholder="请输入玩家UUID" clearable />
      </el-form-item>
      <el-form-item label="事件名称">
        <el-input v-model="form.reason" placeholder="" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="danger" @click="onSubmit">封禁</el-button>
      </el-form-item>
    </el-form>
    <el-alert v-if="successMsg" type="success" :closable="false" show-icon class="mt-2" :title="successMsg" />
    <el-alert v-if="errorMsg" type="error" :closable="false" show-icon class="mt-2" :title="errorMsg" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { emitGmAddInventory, onGmAddInventorySuccess, onGmAddInventoryFail, emitGmBanUser, onGmBanUserSuccess, onGmBanUserFail } from "~/api/game/socket/gm"
import type { ItemCountInfo } from "~/shared/types/gameInventory"
import type { FuncAction } from "~/shared/types"
import { waitUtilConnected } from "~/api/game/socket/socket"
import { allGameResourceWithInternal } from "~/shared/data/allGameResources"

const form = ref({
  targetName: "",
  reason: "",
})

const successMsg = ref("")
const errorMsg = ref("")

const onSubmit = () => {
  successMsg.value = ""
  errorMsg.value = ""
  if (!form.value.targetName || !form.value.reason) {
    errorMsg.value = "请填写完整信息"
    return
  }
  emitGmBanUser(form.value.targetName, form.value.reason)
}

let unbind1: FuncAction
let unbind2: FuncAction
onMounted(async () => {
  await waitUtilConnected()

  unbind1 = onGmBanUserSuccess(() => {
    successMsg.value = "成功"
  })
  unbind2 = onGmBanUserFail((msg) => {
    errorMsg.value = msg.message
  })
})

onUnmounted(() => {
  unbind1?.()
  unbind2?.()
})

</script>