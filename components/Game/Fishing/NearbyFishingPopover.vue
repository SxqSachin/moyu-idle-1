<template>
  <component :is="shouldRenderPopover ? ElPopover : 'span'" v-bind="popoverProps" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
    <template v-if="shouldRenderPopover" #reference>
      <div class="cursor-pointer">
        <slot name="reference"></slot>
      </div>
    </template>
    <template v-if="!shouldRenderPopover">
      <div class="cursor-pointer">
        <slot name="reference"></slot>
      </div>
    </template>

    <template v-if="shouldRenderPopover">
      <div class="flex flex-col gap-2">
        <div>
          <GameUserAvatarAndName :uuid="info.userUuid"></GameUserAvatarAndName>
        </div>
        <template v-if="info.actorType == 'KITTY'">
          <div class="w-fit">
            <span> 小猫咪钓鱼： </span>
            <GameCommonKittyInfo :uuid="info.actorId"></GameCommonKittyInfo>
          </div>
        </template>

        <el-divider class="my-0!"></el-divider>

        <div class="text-xs text-gray-500">开始时间: {{ formatTimeToStr(startedAt) }}</div>
        <div>
          <div v-if="shouldRenderCatch">
            <FishingCatchList ref="catchRef" :userUuid="info.userUuid" :sessionId="info.sessionId" />
          </div>
        </div>
        <slot name="body"></slot>
      </div>
    </template>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NearbyPlayer } from '~/shared/types/fishing';
import { formatTimeToStr } from '~/shared/utils';
import FishingCatchList from './FishingCatchList.vue'

const props = defineProps<{ info: NearbyPlayer }>()
const info = props.info
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { ElPopover } from 'element-plus'
import type { } from '#components';

const catchRef = ref<any | null>(null)

const shouldRenderPopover = ref(false)
let hoverTimer: ReturnType<typeof setTimeout> | null = null

const popoverProps = computed(() => {
  if (!shouldRenderPopover.value) return {}
  return {
    placement: 'top',
    trigger: 'hover',
    transition: 'el-fade-in',
    showAfter: 120,
    width: 360,
  }
})

function handleMouseEnter() {
  if (shouldRenderPopover.value) return
  hoverTimer = setTimeout(() => { shouldRenderPopover.value = true }, 120)
}
function handleMouseLeave() {
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
}

const shouldRenderCatch = ref(false)
watch(shouldRenderPopover, async (v) => {
  if (v) {
    shouldRenderCatch.value = true
    await nextTick()
    catchRef.value?.load?.()
  } else {
    shouldRenderCatch.value = false
  }
})

onUnmounted(() => { if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null } })

const startedAt = computed(() => {
  if (!info.startedAt) return '—'
  return typeof info.startedAt === 'string' ? info.startedAt : info.startedAt.toISOString()
})
</script>

<style scoped>
</style>
