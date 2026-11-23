<template>
  <el-tabs v-model="activeKittyUuid" class="w-full">
    <el-tab-pane v-for="kitty in kitties" :key="kitty.uuid" :label="kitty.name" :name="kitty.uuid" :lazy="true">
    </el-tab-pane>

    <template v-for="kitty in kitties" :key="kitty.uuid">
      <div v-if="activeKittyUuid == kitty.uuid">
        <KittyEssayPanel :kitty-uuid="kitty.uuid" />
      </div>
    </template>
  </el-tabs>
</template>

<script setup lang="ts">
import type { FuncAction } from '~/shared/types';
import { useKittyInfo } from '~/composables/game/useKittyInfo';
import { waitUtilConnected } from '~/api/game/socket/socket';
import { formatTimeToStr } from '~/shared/utils';
import KittyEssayPanel from './KittyEssayPanel.vue'

// 响应式数据
const kitties = useKittyInfo()
const activeKittyUuid = ref<string>('')

// 事件监听器清理函数
onMounted(async () => {
  await waitUtilConnected()

  activeKittyUuid.value = kitties.value[0]?.uuid || '';
})
onUnmounted(() => {
})

function onKittyTagClick(uuid?: string) {
  // 可跳转或弹窗展示猫咪信息
  // 例如 emit('showKittyInfo', uuid)
  // 或 router.push(`/kitty/${uuid}`)
  // 这里留空，按需实现
}
</script>
