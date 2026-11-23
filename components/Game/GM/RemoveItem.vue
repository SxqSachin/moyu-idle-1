<template>
  <div class="p-6 max-w-md mx-auto bg-white rounded shadow space-y-6">
    <el-form :model="form" label-width="80px" @submit.prevent="onSubmit">
      <el-form-item label="玩家UUID">
        <el-input v-model="form.targetName" placeholder="请输入玩家UUID" clearable />
      </el-form-item>
      <el-form-item label="物品">
        <el-select v-model="form.itemId" placeholder="请选择物品" filterable>
          <el-option v-for="item in itemOptions" :key="item.value" :label="item.label" :value="item.value">
            <GameCommonSimpleResourceIconAndName :resource-id="item.value"></GameCommonSimpleResourceIconAndName>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="数量">
        <el-input-number v-model="form.count" :min="1" />
      </el-form-item>
      <el-form-item label="事件名称">
        <el-input v-model="form.comment" placeholder="" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSubmit">添加物品</el-button>
      </el-form-item>
    </el-form>
    <el-alert v-if="successMsg" type="success" :closable="false" show-icon class="mt-2" :title="successMsg" />
    <el-alert v-if="errorMsg" type="error" :closable="false" show-icon class="mt-2" :title="errorMsg" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { emitGmRemoveInventory, onGmRemoveInventorySuccess, onGmRemoveInventoryFail } from "~/api/game/socket/gm"
import type { ItemCountInfo } from "~/shared/types/gameInventory"
import allGameResource from "~/assets/resource/allGameResource.json"
import type { FuncAction } from "~/shared/types"
import { waitUtilConnected } from "~/api/game/socket/socket"
import { allGameResourceWithInternal } from "~/shared/data/allGameResources"

// 动态生成物品选项
const itemOptions = Object.values(allGameResourceWithInternal).map((item: any) => ({
  value: item.id,
  label: item.name
}))

const form = ref({
  targetName: "",
  itemId: "",
  count: 1,
  comment: "",
})

const successMsg = ref("")
const errorMsg = ref("")

const onSubmit = () => {
  successMsg.value = ""
  errorMsg.value = ""
  if (!form.value.targetName || !form.value.itemId || !form.value.count) {
    errorMsg.value = "请填写完整信息"
    return
  }
  const items: ItemCountInfo = {
    [form.value.itemId]: { count: form.value.count }
  }
  emitGmRemoveInventory(form.value.targetName, items, form.value.comment)
}

let unbind1: FuncAction
let unbind2: FuncAction
onMounted(async () => {
  await waitUtilConnected()

  unbind1 = onGmRemoveInventorySuccess(() => {
    successMsg.value = "移除成功"
  })
  unbind2 = onGmRemoveInventoryFail((err) => {
    errorMsg.value = err.message || "移除失败"
  })
})

onUnmounted(() => {
  unbind1?.()
  unbind2?.()
})

</script>