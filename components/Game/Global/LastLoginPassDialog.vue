<template>
    <el-dialog v-model="showLastLoginPassDialog" v-if="queuePausedTime.paused" :width="isMobile ? 'auto' : 480">
        <template #title>
            <div class="text-lg font-bold">欢迎回来！</div>
        </template>
        <div class="text-base flex flex-col space-y-2">
            <div>
                您最近的在线时间是：<span class="font-mono">{{ displayLastOnline }}</span>
            </div>

            <div>
                最大离线时长：{{ MAX_OFFLINE_HOUR }} 小时
            </div>

            <div>
                {{ queuePausedTime.text }}
            </div>
        </div>
        <template #footer>
            <el-button type="primary" @click="showLastLoginPassDialog = false">知道了</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="tsx">
import { ref, computed, onMounted, watch } from 'vue'
import { useLastOnlineDate } from '~/composables/game/useLastOnlineDate';
import { MAX_OFFLINE_HOUR } from '~/shared/data/constant';
import { formatTime } from '~/shared/utils';

const { isMobile } = useDevice()

const lastOnlineDate = useLastOnlineDate()

const showLastLoginPassDialog = ref(false)

/**
 * Normalize various stored formats to a valid Date or null.
 * - Accepts Date, timestamp in ms, timestamp in seconds, numeric string.
 */
const toDate = (v: unknown): Date | null => {
  if (!v && v !== 0) return null
  if (v instanceof Date) return v
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
  if (!Number.isNaN(n)) {
    // heuristics: if less than 1e12 assume seconds, otherwise milliseconds
    return new Date(n < 1e12 ? n * 1000 : n)
  }
  const parsed = new Date(String(v))
  return isNaN(parsed.getTime()) ? null : parsed
}

const displayLastOnline = computed(() => {
  const d = toDate(lastOnlineDate.value)
  return d ? formatTime(d) : '未知'
})

const queuePausedTime = computed(() => {
  const lastDate = toDate(lastOnlineDate.value)
  if (!lastDate) {
    return {
      paused: false,
      text: '未知',
      ms: 0,
      hours: 0,
      days: 0,
    }
  }

  const now = new Date()
  const diffMs = now.getTime() - lastDate.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  // 超过阈值的暂停时长（小时、小数）
  const pausedMs = Math.max(0, diffMs - MAX_OFFLINE_HOUR * 60 * 60 * 1000)
  const pausedHours = pausedMs / (1000 * 60 * 60)

  // 天、小时、分钟、秒
  const days = Math.floor(pausedMs / (1000 * 60 * 60 * 24))
  const remAfterDays = pausedMs - days * 24 * 60 * 60 * 1000
  const hh = Math.floor(remAfterDays / (1000 * 60 * 60))
  const mm = Math.floor((remAfterDays % (1000 * 60 * 60)) / (1000 * 60))
  const ss = Math.floor((remAfterDays % (1000 * 60)) / 1000)

  // 构造显示文本：只有 days >= 1 时显示天数
  let timeParts: string[] = []
  if (days >= 1) {
    timeParts.push(`${days} 天`)
  }
  if (hh > 0 || days >= 1) {
    timeParts.push(`${hh} 小时`)
  }
  timeParts.push(`${mm} 分钟`)

  const text = pausedMs > 0
    ? `已暂停 ${timeParts.join(' ')}`
    : `未暂停（离线 ${Math.floor(diffHours)} 小时，阈值 ${MAX_OFFLINE_HOUR} 小时）`

  return {
    paused: pausedMs > 0,
    text,
    ms: pausedMs,
    hours: pausedHours,
    days,
  }
})

onMounted(() => {
  // 仅当队列确实被暂停时显示弹窗
  showLastLoginPassDialog.value = queuePausedTime.value.paused
})

// 如果 lastOnlineDate 变更，动态决定是否显示弹窗
watch(lastOnlineDate, () => {
  showLastLoginPassDialog.value = queuePausedTime.value.paused
})
</script>

<style scoped>
/* small spacing tweaks */
</style>
// ...existing code...