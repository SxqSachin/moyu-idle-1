<template>
  <div class="p-6 max-w-md mx-auto bg-white rounded shadow space-y-6">
    <el-form :model="form" label-width="80px" @submit.prevent="onSubmit">
      <el-form-item label="标题">
        <el-input v-model="form.title" placeholder="请输入通知标题" clearable />
      </el-form-item>
      <el-form-item label="内容">
        <el-input v-model="form.content" type="textarea" :rows="4" placeholder="请输入通知内容" clearable />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="form.type" placeholder="请选择类型">
          <el-option label="信息" value="info" />
          <el-option label="成功" value="success" />
          <el-option label="警告" value="warning" />
          <el-option label="错误" value="error" />
        </el-select>
      </el-form-item>
      <el-form-item label="时长(ms)">
        <el-input-number v-model="form.duration" :min="1000" :max="60000" :step="1000" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSubmit" :loading="loading">批量发送</el-button>
      </el-form-item>
    </el-form>
    <el-progress
      v-if="progress.total > 0 && progress.current < progress.total"
      :percentage="Math.round((progress.current / progress.total) * 100)"
      class="mt-2"
      :status="progressError ? 'exception' : 'success'"
      :text-inside="true"
      :stroke-width="18"
    >
      <template #default>
        <span>正在发送：{{ progress.current }}/{{ progress.total }}，当前：{{ progress.user }}</span>
      </template>
    </el-progress>
    <el-alert
      v-if="successMsg"
      type="success"
      :closable="false"
      show-icon
      class="mt-2"
      :title="successMsg"
    />
    <el-alert
      v-if="errorMsg"
      type="error"
      :closable="false"
      show-icon
      class="mt-2"
      :title="errorMsg"
    />
    <el-alert
      v-if="failList.length"
      type="warning"
      :closable="false"
      show-icon
      class="mt-2"
      :title="`失败：${failList.map(f=>f.name).join('，')}`"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { emitGmBatchSendNotice, onGmBatchSendNoticeProgress, onGmBatchSendNoticeResult, onGmBatchSendNoticeFail } from "~/api/game/socket/gm"

const form = ref({
  title: "",
  content: "",
  type: "info",
  duration: 4000,
})

const loading = ref(false)
const successMsg = ref("")
const errorMsg = ref("")
const progress = ref({ current: 0, total: 0, user: "" })
const progressError = ref(false)
const failList = ref<{ name: string, reason: string }[]>([])

const onSubmit = () => {
  successMsg.value = ""
  errorMsg.value = ""
  failList.value = []
  progress.value = { current: 0, total: 0, user: "" }
  progressError.value = false
  if (!form.value.title || !form.value.content) {
    errorMsg.value = "请填写标题和内容"
    return
  }
  loading.value = true
  emitGmBatchSendNotice(form.value.title, form.value.content, form.value.type, form.value.duration)
}

onGmBatchSendNoticeProgress((data) => {
  progress.value = data
})

onGmBatchSendNoticeResult((data) => {
  loading.value = false
  if (data.success.length) {
    successMsg.value = `成功发送给${data.success.length}人`
  }
  if (data.fail.length) {
    failList.value = data.fail
    progressError.value = true
  }
})

onGmBatchSendNoticeFail((err) => {
  loading.value = false
  errorMsg.value = err.message || "批量发送失败"
  progressError.value = true
})
</script>