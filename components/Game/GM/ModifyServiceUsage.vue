<template>
  <div class="p-6 max-w-md mx-auto bg-white rounded shadow space-y-6">
    <el-form :model="form" label-width="100px" @submit.prevent>
      <el-form-item label="玩家名称">
        <el-input v-model="form.targetName" placeholder="请输入玩家名称" clearable />
      </el-form-item>

      <el-form-item label="服务Key">
        <el-input v-model="form.serviceKey" placeholder="如 custom_service_level_1" clearable />
      </el-form-item>

      <el-form-item label="设为次数">
        <el-input-number v-model="form.usedCount" :min="0" :max="999999" />
      </el-form-item>

      <el-form-item label="操作人">
        <el-input v-model="form.bearer" placeholder="请输入操作人标识" clearable />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="onPreview" :disabled="!isFormValidForPreview">查询状态</el-button>
        <el-popconfirm title="确认核销/设置使用次数？" @confirm="onSubmit">
          <template #reference>
            <el-button type="warning" :disabled="!isFormValidForSubmit">设置使用次数</el-button>
          </template>
        </el-popconfirm>
      </el-form-item>
    </el-form>

    <el-alert v-if="successMsg" type="success" :closable="false" show-icon class="mt-2" :title="successMsg" />
    <el-alert v-if="errorMsg" type="error" :closable="false" show-icon class="mt-2" :title="errorMsg" />

    <div v-if="preview" class="space-y-2">
      <div class="flex items-center gap-2">
        <span>目标用户:</span>
        <GameUserAvatarAndName :uuid="preview.user.uuid" />
      </div>
      <div class="flex items-center gap-2">
        <span>服务Key:</span>
        <span class="font-mono">{{ preview.serviceKey }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span>已使用次数:</span>
        <span class="text-blue-600">{{ preview.usedCount }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span>可用次数:</span>
        <span class="text-green-600">{{ preview.available }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span>最近使用:</span>
        <span>{{ preview.lastUsedAt ? formatDate(preview.lastUsedAt) : '—' }}</span>
      </div>
    </div>
  </div>
  
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  emitGmServiceUsagePreview,
  onGmServiceUsagePreviewSuccess,
  onGmServiceUsagePreviewFail,
  emitGmServiceUsageSet,
  onGmServiceUsageSetSuccess,
  onGmServiceUsageSetFail,
} from '~/api/game/socket/gm'
import type { FuncAction } from '~/shared/types'
import { waitUtilConnected } from '~/api/game/socket/socket'

const form = ref({
  targetName: '',
  serviceKey: 'custom_service_level_1',
  usedCount: 0,
  bearer: '',
})

const successMsg = ref('')
const errorMsg = ref('')
const preview = ref<any>()

const isFormValidForPreview = computed(() => {
  return !!(form.value.targetName.trim() && form.value.serviceKey.trim() && form.value.bearer.trim())
})
const isFormValidForSubmit = computed(() => {
  return !!(form.value.targetName.trim() && form.value.serviceKey.trim() && form.value.bearer.trim() && form.value.usedCount >= 0)
})

const onPreview = () => {
  successMsg.value = ''
  errorMsg.value = ''
  emitGmServiceUsagePreview(form.value.targetName, form.value.serviceKey, form.value.bearer)
}

const onSubmit = () => {
  successMsg.value = ''
  errorMsg.value = ''
  emitGmServiceUsageSet(form.value.targetName, form.value.serviceKey, form.value.usedCount, form.value.bearer)
}

function formatDate(s: string) {
  try { return new Date(s).toLocaleString() } catch { return s }
}

let unbind1: FuncAction
let unbind2: FuncAction
let unbind3: FuncAction
let unbind4: FuncAction

onMounted(async () => {
  await waitUtilConnected()
  unbind1 = onGmServiceUsagePreviewSuccess(d => { preview.value = d; })
  unbind2 = onGmServiceUsagePreviewFail(d => { errorMsg.value = d.message || '查询失败' })
  unbind3 = onGmServiceUsageSetSuccess(d => { successMsg.value = '设置成功'; preview.value = { ...preview.value, usedCount: d.usedCount, lastUsedAt: d.lastUsedAt } })
  unbind4 = onGmServiceUsageSetFail(d => { errorMsg.value = d.message || '设置失败' })
})

onUnmounted(() => {
  unbind1?.(); unbind2?.(); unbind3?.(); unbind4?.();
})
</script>

<style scoped>
.el-form-item { margin-bottom: 16px; }
</style>
