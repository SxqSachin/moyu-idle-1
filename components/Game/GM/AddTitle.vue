<template>
  <div class="p-6 max-w-md mx-auto bg-white rounded shadow space-y-6">
    <el-form :model="form" label-width="80px" @submit.prevent="onSubmit">
      <el-form-item label="玩家UUID">
        <el-input v-model="form.targetName" placeholder="请输入玩家UUID" clearable />
      </el-form-item>
      <el-form-item label="称号">
        <el-select v-model="form.title" placeholder="请选择称号" filterable>
          <template v-for="availableTitle of allTitles">
            <el-option :value="availableTitle.value" :label="availableTitle.name" class="h-full!">
              <div class="flex flex-col items-start mb-2">
                <div>{{ availableTitle.name }}</div>
                <div class="text-xs text-gray-300">{{ availableTitle.description }}</div>
              </div>
            </el-option>
          </template>
        </el-select>
      </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="onSubmit">添加</el-button>
        </el-form-item>
    </el-form>
    <el-alert v-if="successMsg" type="success" :closable="false" show-icon class="mt-2" :title="successMsg" />
    <el-alert v-if="errorMsg" type="error" :closable="false" show-icon class="mt-2" :title="errorMsg" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { onGmAddInventorySuccess, onGmAddInventoryFail, emitGmAddTitle, onGmAddTitleSuccess, onGmAddTitleFail } from "~/api/game/socket/gm"
import type { FuncAction } from "~/shared/types"
import { waitUtilConnected } from "~/api/game/socket/socket"
import { allTitles } from "~/shared/data/allTitle"

const form = ref({
  targetName: "",
  title: "",
})

const successMsg = ref("")
const errorMsg = ref("")

const onSubmit = () => {
  successMsg.value = ""
  errorMsg.value = ""
  if (!form.value.targetName || !form.value.title) {
    errorMsg.value = "请填写完整信息"
    return
  }
  emitGmAddTitle(form.value.targetName, form.value.title)
}

let unbind1: FuncAction
let unbind2: FuncAction
onMounted(async () => {
  await waitUtilConnected()

  unbind1 = onGmAddTitleSuccess(() => {
    successMsg.value = "添加成功"
  })
  unbind2 = onGmAddTitleFail((err) => {
    errorMsg.value = err.message || "添加失败"
  })
})

onUnmounted(() => {
  unbind1?.()
  unbind2?.()
})

</script>