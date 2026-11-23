<template>
  <div class="p-6 max-w-md mx-auto bg-white rounded shadow space-y-6">
    <el-form :model="form" label-width="100px" @submit.prevent="onSubmit">
      <el-form-item label="玩家名称">
        <el-input v-model="form.targetName" placeholder="请输入玩家名称" clearable />
      </el-form-item>

      <el-form-item label="操作类型">
        <el-radio-group v-model="form.operationType">
          <el-radio-button label="increase">增加赞助点</el-radio-button>
          <el-radio-button label="decrease">减少赞助点</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="数量">
        <el-input-number v-model="form.value" :min="1" :max="999999" placeholder="请输入变动数量" />
      </el-form-item>

      <el-form-item label="操作原因">
        <el-input v-model="form.reason" placeholder="请输入操作原因" clearable type="textarea" :rows="3" />
      </el-form-item>

      <el-form-item label="操作人">
        <el-input v-model="form.bearer" placeholder="请输入操作人标识" clearable />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="onPreviewInfo" :disabled="!isFormValid">
          查询信息
        </el-button>
        <el-popconfirm class="box-item" title="请确认信息正确" @confirm="onSubmit">
          <template #reference>
            <el-button type="primary" :loading="isLoading" :disabled="!isFormValid">
              {{ form.operationType === 'increase' ? '增加赞助点' : '减少赞助点' }}
            </el-button>
          </template>
        </el-popconfirm>
      </el-form-item>
    </el-form>

    <el-alert v-if="successMsg" type="success" :closable="false" show-icon class="mt-2" :title="successMsg" />

    <el-alert v-if="errorMsg" type="error" :closable="false" show-icon class="mt-2" :title="errorMsg" />
    <div v-if="previewInfo" class="flex flex-col">
      <div v-if="previewInfo.user" class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <span>目标用户:</span>
          <GameUserAvatarAndName :uuid="previewInfo.user.uuid"></GameUserAvatarAndName>
        </div>
        <div class="flex items-center gap-2">
          <span>当前积分:</span>
          <span>{{ formatNumber(previewInfo.user.sponsor_points) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span>历史积分:</span>
          <span>{{ formatNumber(previewInfo.user.max_sponsor_points) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span>此次调整后:</span>
          <span>{{formatNumber(previewInfo.user.sponsor_points)}} -> {{ formatNumber(previewInfo.user.sponsor_points + form.value) }}</span>
        </div>
      </div>
      <el-divider v-if="previewInfo.referrer"></el-divider>
      <div v-if="previewInfo.referrer" class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <span>推荐人:</span>
          <GameUserAvatarAndName :uuid="previewInfo.referrer.uuid"></GameUserAvatarAndName>
        </div>
        <div class="flex items-center gap-2">
          <span>当前积分:</span>
          <span>{{ formatNumber(previewInfo.referrer.sponsor_points) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span>历史积分:</span>
          <span>{{ formatNumber(previewInfo.referrer.max_sponsor_points) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span>此次调整后:</span>
          <span>{{formatNumber(previewInfo.referrer.sponsor_points)}} -> {{ formatNumber(previewInfo.referrer.sponsor_points + form.value * 0.1) }}</span>
        </div>
        <div>
           推荐人可以获得此次添加赞助点的10%
        </div>
      </div>

    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { 
  emitIncreaseSponsorPoint, 
  emitDecreaseSponsorPoint,
  onIncreaseSponsorPointSuccess,
  onDecreaseSponsorPointSuccess,
  onIncreaseSponsorPointFailed,
  onDecreaseSponsorPointFailed,
  emitPreviewSponsorPointModifyInfo,
  onPreviewSponsorPointModifyInfoSuccess,
  onPreviewSponsorPointModifyInfoFailed
} from "~/api/game/socket/gm"
import type { FuncAction } from "~/shared/types"
import { waitUtilConnected } from "~/api/game/socket/socket"
import { formatNumber } from "~/shared/utils"

const form = ref({
  targetName: "",
  operationType: "increase" as "increase" | "decrease",
  value: 1,
  reason: "",
  bearer: "",
})

const successMsg = ref("")
const errorMsg = ref("")
const isLoading = ref(false)

const previewInfo = ref<any>()

// 表单验证
const isFormValid = computed(() => {
  return !!(
    form.value.targetName.trim() && 
    form.value.value > 0 && 
    form.value.reason.trim() && 
    form.value.bearer.trim()
  )
})

const onSubmit = () => {
  if (!isFormValid.value) {
    errorMsg.value = "请填写完整信息"
    return
  }

  successMsg.value = ""
  errorMsg.value = ""
  isLoading.value = true

  try {
    if (form.value.operationType === 'increase') {
      emitIncreaseSponsorPoint(
        form.value.targetName,
        form.value.value,
        form.value.reason,
        form.value.bearer
      )
    } else if (form.value.operationType == 'decrease') {
      emitDecreaseSponsorPoint(
        form.value.targetName,
        form.value.value,
        form.value.reason,
        form.value.bearer
      )
    }
  } catch (error) {
    errorMsg.value = "操作失败: " + (error as Error).message
    isLoading.value = false
  }
}

const onPreviewInfo = () => {
  emitPreviewSponsorPointModifyInfo(
    form.value.targetName,
    form.value.value,
    form.value.reason,
    form.value.bearer
  )
}

let unbindIncrease: FuncAction
let unbindDecrease: FuncAction
let unbindIncreaseFail: FuncAction
let unbindDecreaseFail: FuncAction
let unbindPreviewSuccess: FuncAction
let unbindPreviewFailed: FuncAction

onMounted(async () => {
  await waitUtilConnected()

  // 监听增加赞助点成功
  unbindIncrease = onIncreaseSponsorPointSuccess((data) => {
    isLoading.value = false
    successMsg.value = `操作成功！当前赞助点余额: ${data.res}`
    
    // 3秒后自动清除成功消息
    setTimeout(() => {
      successMsg.value = ""
    }, 3000)
  })

  unbindIncreaseFail = onIncreaseSponsorPointFailed((data) => {
    isLoading.value = false
    errorMsg.value = "操作失败: " + (data.message || "未知错误")
  })

  // 监听减少赞助点成功
  unbindDecrease = onDecreaseSponsorPointSuccess((data) => {
    isLoading.value = false
    successMsg.value = `操作成功！当前赞助点余额: ${data.res}`
    
    // 3秒后自动清除成功消息
    setTimeout(() => {
      successMsg.value = ""
    }, 3000)
  })

  unbindDecreaseFail = onDecreaseSponsorPointFailed((data) => {
    isLoading.value = false
    errorMsg.value = "操作失败: " + (data.message || "未知错误")
  })

  unbindPreviewSuccess = onPreviewSponsorPointModifyInfoSuccess(data => {
    previewInfo.value = data.res
    successMsg.value = ""
    errorMsg.value = ""
  })
  unbindPreviewFailed = onPreviewSponsorPointModifyInfoFailed(data => {
    errorMsg.value = "操作失败: " + (data.message || "未知错误")
  })
})

onUnmounted(() => {
  unbindIncrease?.()
  unbindDecrease?.()
  unbindIncreaseFail?.()
  unbindDecreaseFail?.()
  
  unbindPreviewSuccess?.()
  unbindPreviewFailed?.()
})
</script>

<style scoped>
.el-radio-group {
  width: 100%;
}

.el-form-item {
  margin-bottom: 24px;
}

.el-input-number {
  width: 100%;
}
</style>