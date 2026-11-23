<template>
    <div
        v-if="currentAuto"
        class="auto-alchemy-process bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-2xl shadow-xl border border-blue-100 dark:border-gray-600 p-6 mb-6 backdrop-blur-sm"
    >
        <!-- Header -->
    <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gradient-to-br from-purple-200 to-indigo-200 rounded-xl flex items-center justify-center relative">
                    <span class="text-white text-lg">⚗️</span>
                    <div v-if="isProcessing" class="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse border border-white dark:border-gray-700"></div>
                </div>
                <div>
                    <h3 class="text-base font-bold text-gray-800 dark:text-gray-200 leading-5">炼金</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ headerSubtitle }}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <el-tag size="small" :type="statusTagType">{{ autoStatusLabel }}</el-tag>
                <el-button
                    v-if="isProcessing"
                    size="small"
                    type="danger"
                    plain
                    @click="onCancel"
                >取消</el-button>
            </div>
        </div>

        <!-- Progress -->
        <div class="flex items-center gap-3">
            <div class="min-w-[40px] text-xs text-gray-500 dark:text-gray-400">进度</div>
            <el-progress :percentage="percentage" style="width:180px" />
            <div class="text-xs font-medium text-gray-600 dark:text-gray-300">
                {{ currentAuto!.doneTimes }} / {{ currentAuto!.targetTimes }} 次
            </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-3 gap-2 mt-3">
            <div class="bg-white/70 dark:bg-gray-700/70 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600">
                <div class="text-[10px] text-gray-500 dark:text-gray-400">目标次数</div>
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ currentAuto!.targetTimes }}</div>
            </div>
            <div class="bg-white/70 dark:bg-gray-700/70 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600">
                <div class="text-[10px] text-gray-500 dark:text-gray-400">已完成</div>
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ currentAuto!.doneTimes }}</div>
            </div>
            <div class="bg-white/70 dark:bg-gray-700/70 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600">
                <div class="text-[10px] text-gray-500 dark:text-gray-400">状态</div>
                <div class="text-sm font-semibold" :class="{
                    'text-blue-600 dark:text-blue-400': isProcessing,
                    'text-green-600 dark:text-green-400': currentAuto!.status==='FINISHED',
                    'text-red-600 dark:text-red-400': currentAuto!.status==='ERROR',
                }">{{ autoStatusLabel }}</div>
            </div>
        </div>

        <!-- Rewards -->
        <div v-if="hasReward" class="mt-3">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">累计获得</div>
            <div class="flex flex-row flex-wrap items-center gap-1 p-2 bg-white/50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <GameCommonResourceIconAndName v-for="(c,id) in currentAuto!.allRewardItems" :key="id" :resource-id="id as any" :count="c?.count || 0" />
            </div>
        </div>

        <!-- Error banner -->
        <div v-if="currentAuto!.status==='ERROR' && currentAuto!.lastError" class="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50/70 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
            错误：{{ currentAuto!.lastError }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAutoAlchemy } from '~/composables/game/useAutoAlchemy'

const { currentAuto, autoStatusLabel, cancelAutoAlchemy } = useAutoAlchemy()

const onCancel = () => {
    ElMessageBox.confirm('确认取消当前自动炼金？已完成的进度会保留，未完成部分将不再执行。', '取消自动炼金', {
        confirmButtonText: '确认',
        cancelButtonText: '再想想',
        type: 'warning'
    }).then(() => {
        cancelAutoAlchemy()
    }).catch(() => {})
}

const percentage = computed(() => {
	const v = currentAuto.value
	if (!v || !v.targetTimes) return 0
	return Math.min(100, Math.floor((v.doneTimes / v.targetTimes) * 100))
})

const statusTagType = computed(() => {
	const s = currentAuto.value?.status
	if (s === 'FINISHED') return 'success'
	if (s === 'ERROR') return 'danger'
	return 'info'
})

const hasReward = computed(() => !!currentAuto.value && Object.keys(currentAuto.value.allRewardItems || {}).length > 0)

const isProcessing = computed(() => currentAuto.value?.status === 'PENDING' || currentAuto.value?.status === 'PROCESSING')

const headerSubtitle = computed(() => {
  const s = currentAuto.value?.status
  if (s === 'FINISHED') return '已完成，等待领取历史'
  if (s === 'ERROR') return '发生错误，请检查材料或稍后重试'
  if (s === 'CANCELLED') return '任务已取消'
  return '后台搅拌进行中…'
})
</script>

<style scoped>
.auto-alchemy-process {
    transition: box-shadow .2s ease, transform .2s ease;
}
/* .auto-alchemy-process:hover {
    box-shadow: 0 8px 24px rgba(99, 102, 241, .18);
} */
</style>