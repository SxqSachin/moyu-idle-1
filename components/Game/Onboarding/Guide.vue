<template>
  <el-dialog
    v-model="visible"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    align-center
    width="560"
    class="onboarding-dialog"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <span class="text-xl">🎉 欢迎来到猫猫放置</span>
        <span class="text-sm text-gray-500">新手小贴士</span>
      </div>
    </template>

    <div class="space-y-3 text-gray-700 dark:text-gray-200">
      <p>这是你的第一个小镇之旅，下面是三个关键点：</p>
      <ul class="list-disc pl-5 space-y-1">
        <li>左侧菜单浏览“家园”、“市场”、“战斗”等功能。</li>
        <li>建议先完成“种植/采集”等入门任务，获得基础资源。</li>
        <li>右下角“聊天”可与其他玩家交流与提问。</li>
      </ul>
      <p class="text-xs text-gray-500">你可以在“游戏指南”中查看更完整的说明。</p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <el-button @click="onLater">稍后再说</el-button>
        <el-button type="primary" @click="onFinish">我知道了</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
const visible = ref(false)

onMounted(async () => {
  try {
    const res: any = await $fetch('/api/game/onboarding/status')
    if (res?.ok && res?.needGuide) {
      visible.value = true
    }
  } catch (e) {
    // 静默失败，不打扰正常流程
  }
})

const onFinish = async () => {
  try {
    await $fetch('/api/game/onboarding/mark-seen', { method: 'POST' })
  } catch {}
  visible.value = false
}

// 稍后再说：仅关闭本次弹窗，不写入“已完成”
const onLater = () => {
  visible.value = false
}
</script>

<style scoped>
.onboarding-dialog :deep(.el-dialog__header) {
  border-bottom: 1px solid var(--el-border-color-lighter);
}
</style>