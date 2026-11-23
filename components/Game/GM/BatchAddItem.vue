<template>
  <div class="p-6 max-w-2xl mx-auto bg-white rounded shadow space-y-6">
    <el-form :model="form" label-width="120px" @submit.prevent="onSubmit">
      <!-- 物品列表 -->
      <el-form-item label="物品列表">
        <div class="w-full space-y-3">
          <div v-for="(item, index) in form.items" :key="index" 
               class="flex items-center gap-3 p-3 border rounded bg-gray-50">
            <div class="flex-1">
              <el-select v-model="item.itemId" placeholder="请选择物品" filterable class="w-full">
                <el-option v-for="option in itemOptions" :key="option.value" 
                          :label="option.label" :value="option.value">
                  <GameCommonSimpleResourceIconAndName :resource-id="option.value" />
                </el-option>
              </el-select>
            </div>
            <div class="w-32">
              <el-input-number v-model="item.count" :min="1" :max="999999" 
                              controls-position="right" class="w-full" />
            </div>
            <el-button type="danger" size="small" :icon="Delete" 
                      @click="removeItem(index)" :disabled="form.items.length === 1">
              删除
            </el-button>
          </div>
          
          <!-- 添加物品按钮 -->
          <el-button type="primary" :icon="Plus" @click="addItem" class="w-full">
            添加物品
          </el-button>
        </div>
      </el-form-item>

      <!-- 目标用户设置 -->
      <el-form-item label="目标用户">
        <el-radio-group v-model="targetType" class="w-full">
          <el-radio-button label="all">全部用户</el-radio-button>
          <el-radio-button label="specific">指定用户</el-radio-button>
        </el-radio-group>
        
        <!-- 指定用户UUID输入 -->
        <div v-if="targetType === 'specific'" class="mt-3">
          <el-input
            v-model="form.uuidList"
            type="textarea"
            :rows="3"
            placeholder="请输入用户UUID，多个UUID用英文逗号分隔&#10;例如：uuid1,uuid2,uuid3"
            class="w-full"
          />
          <div class="text-sm text-gray-500 mt-1">
            已输入 {{ validUuids.length }} 个UUID
          </div>
        </div>
      </el-form-item>

      <el-form-item label="至少活跃于" v-if="targetType === 'all'">
        <el-date-picker v-model="form.lastOnlineAfter" type="datetime" 
                       placeholder="选择最近登录时间" clearable class="w-full" />
      </el-form-item>
      
      <el-form-item label="事件名称">
        <el-input v-model="form.comment" placeholder="请输入事件名称" clearable />
      </el-form-item>

      <!-- 预览区域 -->
      <el-form-item label="发放预览">
        <div class="p-3 bg-gray-100 rounded text-sm">
          <div v-if="validItems.length > 0">
            <div class="font-medium mb-2">将发放以下物品：</div>
            <div v-for="item in validItems" :key="item.itemId" class="flex items-center gap-2 mb-1">
              <GameCommonSimpleResourceIconAndName :resource-id="item.itemId" />
              <span class="text-blue-600 font-medium">× {{ item.count }}</span>
            </div>
            <div class="mt-2 text-gray-600">
              共 {{ validItems.length }} 种物品
              <span v-if="targetType === 'specific'">，发放给 {{ validUuids.length }} 个指定用户</span>
              <span v-else>，发放给所有符合条件的用户</span>
            </div>
          </div>
          <div v-else class="text-gray-500">
            请至少配置一个有效的物品
          </div>
        </div>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="onSubmit" :loading="loading" 
                  :disabled="!canSubmit">
          批量发放 ({{ validItems.length }} 种物品)
        </el-button>
      </el-form-item>
    </el-form>

    <!-- 进度条 -->
    <el-progress v-if="progress.total > 0 && progress.current < progress.total"
      :percentage="Math.round((progress.current / progress.total) * 100)" class="mt-2"
      :status="progressError ? 'exception' : 'success'" :text-inside="true" :stroke-width="18">
      <template #default>
        <span>正在发放：{{ progress.current }}/{{ progress.total }}，当前：{{ progress.user }}</span>
      </template>
    </el-progress>

    <!-- 消息提示 -->
    <el-alert v-if="successMsg" type="success" :closable="false" show-icon class="mt-2" :title="successMsg" />
    <el-alert v-if="errorMsg" type="error" :closable="false" show-icon class="mt-2" :title="errorMsg" />
    <el-alert v-if="failList.length" type="warning" :closable="false" show-icon class="mt-2"
      :title="`失败：${failList.map(f => f.name).join('，')}`" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { Delete, Plus } from '@element-plus/icons-vue'
import { emitGmBatchAddInventory, onGmBatchAddInventoryProgress, onGmBatchAddInventoryResult, onGmBatchAddInventoryFail } from "~/api/game/socket/gm"
import type { ItemCountInfo } from "~/shared/types/gameInventory"
import type { FuncAction } from "~/shared/types"
import { waitUtilConnected } from "~/api/game/socket/socket"
import { allGameResourceWithInternal } from "~/shared/data/allGameResources"

// 物品选项
const itemOptions = Object.entries(allGameResourceWithInternal)
  .filter(([id, item]: [string, any]) => !item.isInternal)
  .map(([id, item]: [string, any]) => ({
    value: id,
    label: item.name || id
  }))

// 单个物品的接口
interface ItemConfig {
  itemId: string
  count: number
}

// 目标类型
const targetType = ref<'all' | 'specific'>('all')

// 表单数据
const form = ref({
  items: [{ itemId: "", count: 1 }] as ItemConfig[],
  comment: "",
  lastOnlineAfter: "",
  uuidList: "", // 新增：用户UUID列表字符串
})

// 状态
const loading = ref(false)
const successMsg = ref("")
const errorMsg = ref("")
const progress = ref({ current: 0, total: 0, user: "" })
const progressError = ref(false)
const failList = ref<{ name: string, reason: string }[]>([])

// 计算有效的物品配置
const validItems = computed(() => {
  return form.value.items.filter(item => item.itemId && item.count > 0)
})

// 计算有效的UUID列表
const validUuids = computed(() => {
  if (targetType.value !== 'specific' || !form.value.uuidList.trim()) {
    return []
  }
  
  return form.value.uuidList
    .split(',')
    .map(uuid => uuid.trim())
    .filter(uuid => uuid.length > 0)
})

// 计算是否可以提交
const canSubmit = computed(() => {
  if (validItems.value.length === 0) return false
  
  if (targetType.value === 'specific') {
    return validUuids.value.length > 0
  }
  
  return true
})

// 添加物品
const addItem = () => {
  form.value.items.push({ itemId: "", count: 1 })
}

// 删除物品
const removeItem = (index: number) => {
  if (form.value.items.length > 1) {
    form.value.items.splice(index, 1)
  }
}

// 提交表单
const onSubmit = () => {
  successMsg.value = ""
  errorMsg.value = ""
  failList.value = []
  progress.value = { current: 0, total: 0, user: "" }
  progressError.value = false

  // 验证表单
  if (validItems.value.length === 0) {
    errorMsg.value = "请至少配置一个有效的物品"
    return
  }

  // 验证目标用户
  if (targetType.value === 'specific' && validUuids.value.length === 0) {
    errorMsg.value = "请输入至少一个有效的用户UUID"
    return
  }

  // 检查是否有重复的物品
  const itemIds = validItems.value.map(item => item.itemId)
  const uniqueItemIds = [...new Set(itemIds)]
  if (itemIds.length !== uniqueItemIds.length) {
    errorMsg.value = "不能添加重复的物品"
    return
  }

  // 构建ItemCountInfo
  const items: ItemCountInfo = {}
  validItems.value.forEach(item => {
    items[item.itemId] = { count: item.count }
  })

  // 构建过滤条件
  const filter: {
    uuidList?: string[]
    lastOnlineAfter?: Date | null
  } = {}

  if (targetType.value === 'specific') {
    filter.uuidList = validUuids.value
  } else {
    filter.lastOnlineAfter = form.value.lastOnlineAfter ? new Date(form.value.lastOnlineAfter) : null
  }

  loading.value = true
  emitGmBatchAddInventory(items, form.value.comment, filter)
}

// Socket 事件监听
let unbind1: FuncAction
let unbind2: FuncAction
let unbind3: FuncAction

onMounted(async () => {
  await waitUtilConnected()

  unbind1 = onGmBatchAddInventoryProgress((data) => {
    progress.value = data
  })

  unbind2 = onGmBatchAddInventoryResult((data) => {
    loading.value = false
    if (data.success.length) {
      successMsg.value = `成功发放给${data.success.length}人，共${validItems.value.length}种物品`
    }
    if (data.fail.length) {
      failList.value = data.fail
      progressError.value = true
    }
  })

  unbind3 = onGmBatchAddInventoryFail((err) => {
    loading.value = false
    errorMsg.value = err.message || "批量发放失败"
    progressError.value = true
  })
})

onUnmounted(() => {
  unbind1?.()
  unbind2?.()
  unbind3?.()
})
</script>

<style scoped>
/* 你可以根据需要添加额外的样式 */
</style>