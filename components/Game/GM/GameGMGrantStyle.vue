<template>
  <el-card class="p-4">
    <div class="flex flex-col gap-4">
      <div class="text-lg font-semibold">为玩家解锁样式</div>

      <el-form :model="form" label-width="100px" class="w-full">
        <el-form-item label="目标用户名">
          <el-input v-model="form.targetName" placeholder="输入目标玩家名称" />
        </el-form-item>

        <el-form-item label="样式类型">
          <el-select v-model="form.styleType" placeholder="选择样式类型" @change="onTypeChange">
            <el-option label="战斗面板" value="battle" />
            <el-option label="个人卡片" value="profile" />
            <el-option label="聊天气泡" value="chatBubble" />
            <el-option label="头像框" value="avatarBorder" />
          </el-select>
        </el-form-item>

        <el-form-item label="样式ID">
          <el-select v-model="form.styleId" placeholder="选择样式ID">
            <el-option v-for="opt in styleOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <div class="flex items-center gap-3">
            <el-button type="primary" :loading="loading" @click="submit">解锁</el-button>
            <el-button type="default" @click="reset">重置</el-button>
          </div>
        </el-form-item>
      </el-form>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { emitGmGrantStyle, onGmGrantStyleSuccess, onGmGrantStyleFail } from '~/api/game/socket/gm'
import { allBattleStyle, allProfileStyle, allChatBubbleStyle, allAvatarBorder } from '~/shared/data/allStyle'

const form = ref({ targetName: '', styleType: 'profile' as 'battle' | 'profile' | 'chatBubble' | 'avatarBorder', styleId: '' })
const loading = ref(false)

const mapToOptions = (obj: Record<string, any>) => {
  return Object.keys(obj).map(k => ({ value: k, label: obj[k].name || String(k) }))
}

const styleOptions = computed(() => {
  switch (form.value.styleType) {
    case 'battle':
      return mapToOptions(allBattleStyle)
    case 'profile':
      return mapToOptions(allProfileStyle)
    case 'chatBubble':
      return mapToOptions(allChatBubbleStyle)
    case 'avatarBorder':
      return mapToOptions(allAvatarBorder)
    default:
      return []
  }
})

function onTypeChange() {
  form.value.styleId = ''
}

function reset() {
  form.value.targetName = ''
  form.value.styleType = 'profile'
  form.value.styleId = ''
}

let unbindSuccess: Function | undefined
let unbindFail: Function | undefined

onMounted(() => {
  unbindSuccess = onGmGrantStyleSuccess((data) => {
    loading.value = false
    ElNotification({ title: '成功', message: `为 ${form.value.targetName} 解锁 ${data.styleType}:${data.styleId}`, type: 'success' })
    reset()
  })
  unbindFail = onGmGrantStyleFail((err) => {
    loading.value = false
    ElNotification({ title: '失败', message: err.message ?? '操作失败', type: 'error' })
  })
})

onUnmounted(() => {
  unbindSuccess?.()
  unbindFail?.()
})

function submit() {
  if (!form.value.targetName) {
    ElNotification({ title: '提示', message: '请填写目标用户名', type: 'warning' })
    return
  }
  if (!form.value.styleId) {
    ElNotification({ title: '提示', message: '请选择样式ID', type: 'warning' })
    return
  }

  loading.value = true
  emitGmGrantStyle(form.value.targetName, form.value.styleType, form.value.styleId)
}
</script>

<style scoped>
/* Tailwind utilities used; keep component-specific overrides minimal */
</style>
