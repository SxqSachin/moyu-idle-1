
<template>
  <div class="p-6 max-w-3xl mx-auto bg-white rounded shadow space-y-6">
    <el-form :model="form" label-width="120px" @submit.prevent="onSubmit" class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <el-input v-model="form.bearer" placeholder="bearer" clearable class="flex-1" />
        <el-button type="primary" :loading="loading" @click="fetchInfo">刷新</el-button>
      </div>

      <div class="text-sm">商品列表：</div>

      <div class="w-full space-y-3">
        <el-card v-for="(entry, idx) in entries" :key="idx">

          <div class="flex items-start gap-3">
            <div class="flex-1">
              <el-select v-model="entry.resourceId" placeholder="选择资源" filterable class="w-full">
                <template #label>
                  <GameCommonSimpleResourceIconAndName :resource-id="entry.resourceId" />
                </template>
                <el-option v-for="opt in resourceOptions" :key="opt.value" :label="opt.label" :value="opt.value">
                  <GameCommonSimpleResourceIconAndName :resource-id="opt.value" />
                </el-option>
              </el-select>
            </div>

            <div class="w-28 text-right">
              <el-button type="danger" size="small" :icon="Delete" @click="removeEntry(idx)"
                :disabled="entries.length===1">
                删除
              </el-button>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div class="text-sm text-gray-600 mb-2">数量 (min / max)</div>
              <div class="flex gap-2 items-center">
                <el-input-number v-model="entry.count.min" :min="0" :max="999999" class="w-1/2" :controls="false" />
                <span class="text-gray-400">/</span>
                <el-input-number v-model="entry.count.max" :min="0" :max="999999" class="w-1/2" :controls="false" />
              </div>
            </div>

            <div>
              <div class="text-sm text-gray-600 mb-2">价格 (min / max)</div>
              <div class="flex gap-2 items-center">
                <el-input-number v-model="entry.cost.min" :min="0" :max="9999999" class="w-1/2" :controls="false" />
                <span class="text-gray-400">/</span>
                <el-input-number v-model="entry.cost.max" :min="0" :max="9999999" class="w-1/2" :controls="false" />
              </div>
            </div>
          </div>
        </el-card>

        <el-button type="primary" :icon="Plus" @click="addEntry" class="w-full">添加补货项</el-button>
      </div>

      <el-form-item>
        <div class="flex items-center gap-3">
          <el-button type="success" @click="onSubmit" :loading="saving" :disabled="!canSubmit">保存并更新</el-button>
          <el-button @click="resetToFetched" :disabled="saving">重置为服务器数据</el-button>
          <div class="text-sm text-gray-500 ml-auto">共 {{ entries.length }} 项</div>
        </div>
      </el-form-item>
    </el-form>

    <div class="text-sm text-gray-600">
      注：隐藏在市场/商店的资源会被服务器端过滤，提交后以服务器存储为准。
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"
import { Delete, Plus } from '@element-plus/icons-vue'
import type { GMRestockMarketInput } from "~/shared/types/gm"
import { allGameResourceWithInternal, allGameResource } from "~/shared/data/allGameResources"
import {
  emitGetGMRestockMarketInfo,
  onGetGMRestockMarketInfoSuccess,
  emitUpdateGMRestockMarketInfo,
  onUpdateGMRestockMarketInfoSuccess,
  onGmCheckFail,
} from "~/api/game/socket/gm"
import { waitUtilConnected } from "~/api/game/socket/socket"
import type { FuncAction } from "~/shared/types"

const resourceOptions = Object.entries(allGameResource)
  .filter(([id, item]: [string, any]) => !item.hideInMarket && !item.hideInShop)
  .map(([id, item]: [string, any]) => ({ value: id, label: item.name || id }))

// local editable entry type (same shape as GMRestockMarketInput)
type Entry = GMRestockMarketInput

const form = ref({
  bearer: "",
})

const entries = ref<Entry[]>([
  { resourceId: "", count: { min: 1, max: 1 }, cost: { min: 1, max: 1 } }
])

const fetched = ref<Entry[]>([]) // server snapshot

const loading = ref(false)
const saving = ref(false)

const canSubmit = computed(() => {
  if (!form.value.bearer || form.value.bearer.trim() === "") return false
  if (entries.value.length === 0) return false
  for (const e of entries.value) {
    if (!e.resourceId) return false
    if (e.count.min == null || e.count.max == null) return false
    if (e.cost.min == null || e.cost.max == null) return false
    if (e.count.min > e.count.max) return false
    if (e.cost.min > e.cost.max) return false
  }
  return true
})

const addEntry = () => {
  entries.value.push({ resourceId: "", count: { min: 1, max: 1 }, cost: { min: 1, max: 1 } })
}

const removeEntry = (idx: number) => {
  if (entries.value.length > 1) {
    entries.value.splice(idx, 1)
  }
}

const resetToFetched = () => {
  entries.value = fetched.value.length ? JSON.parse(JSON.stringify(fetched.value)) : [{ resourceId: "", count: { min: 1, max: 1 }, cost: { min: 1, max: 1 } }]
}

const fetchInfo = async () => {
  if (!form.value.bearer || form.value.bearer.trim() === "") {
    return
  }
  loading.value = true
  emitGetGMRestockMarketInfo(form.value.bearer)
}

const onUpdateSuccess = (data: any) => {
  saving.value = false

  ElNotification.success("信息更新成功")

  // 触发重新拉取以确保与服务器一致
  fetchInfo()
}

const onFetchSuccess = (payload: { res?: GMRestockMarketInput[] } | any) => {
  loading.value = false
  const arr = Array.isArray(payload?.res) ? payload.res : (Array.isArray(payload) ? payload : [])
  fetched.value = arr.length ? JSON.parse(JSON.stringify(arr)) : []
  entries.value = fetched.value.length ? JSON.parse(JSON.stringify(fetched.value)) : [{ resourceId: "", count: { min: 1, max: 1 }, cost: { min: 1, max: 1 } }]

  ElNotification.success("信息获取成功")
}

const onSubmit = async () => {
  if (!canSubmit.value) {
    return
  }
  saving.value = true
  // deep clone to ensure plain object
  const payload: GMRestockMarketInput[] = entries.value.map(e => ({
    resourceId: e.resourceId,
    count: { min: Number(e.count.min), max: Number(e.count.max) },
    cost: { min: Number(e.cost.min), max: Number(e.cost.max) },
  }))
  emitUpdateGMRestockMarketInfo(payload, form.value.bearer)
}

// socket bindings
let un0: FuncAction | undefined
let un1: FuncAction | undefined
let un2: FuncAction | undefined

onMounted(async () => {
  await waitUtilConnected()

  un0 = onGmCheckFail((data) => {
    loading.value = false
    saving.value = false
    ElNotification.error(data.message)
  })

  un1 = onGetGMRestockMarketInfoSuccess((data) => {
    onFetchSuccess(data)
  })

  un2 = onUpdateGMRestockMarketInfoSuccess((data) => {
    onUpdateSuccess(data)
  })
})

onUnmounted(() => {
  un0?.()
  un1?.()
  un2?.()
})
</script>

<style scoped>
/* 可按需微调 */
</style>