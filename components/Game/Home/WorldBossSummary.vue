<template>
  <div
    v-if="availableBossList?.length"
    class="world-boss-summary bg-gradient-to-br from-white via-amber-50/40 to-red-50/30 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-2xl shadow-xl border border-amber-100 dark:border-gray-600 p-6 mb-6 backdrop-blur-sm"
  >
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-300 to-red-300 flex items-center justify-center text-white text-lg shadow-inner">
            👿
        </div>
        <div>
          <div class="text-base font-bold text-gray-800 dark:text-gray-100 leading-5">大麻烦预警</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">威胁猫猫村的大坏蛋们！</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <el-button size="small" @click="refresh" :loading="loading" plain>刷新</el-button>
        <el-button size="small" type="primary" @click="goBattle">前往挑战</el-button>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <div v-for="boss in availableBossList" :key="boss.id" class="boss-card">
        <div class="flex justify-between items-center mb-1">
          <div class="font-semibold text-gray-800 dark:text-gray-100 text-sm">{{ boss.name }}</div>
          <!-- <el-tag size="small" :type="boss.state === 'battling' ? 'danger' : 'info'">版本 {{ boss.version }}</el-tag> -->
        </div>
        <div class="text-xs text-gray-600 dark:text-gray-300 mb-1">
          {{ statusLine(boss) }}
        </div>
        <div class="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300 mb-1">
          <span>进度</span>
          <el-progress :percentage="hpPercent(boss)" :stroke-width="8" color="#67c23a"  style="flex:1" :show-text="false" />
          <span class="text-[10px] text-gray-500 dark:text-gray-400">{{ hpText(boss) }}</span>
        </div>
        <div class="text-[11px] text-gray-500 dark:text-gray-400 flex gap-2 flex-wrap">
          <span v-if="boss.startAt">开始 {{ formatTime(boss.startAt) }}</span>
          <span v-if="boss.endAt">结束 {{ formatTime(boss.endAt) }}</span>
          <span v-if="!boss.startAt && !boss.endAt">持续开放</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorldBoss } from '~/composables/game/useWorldBoss'
import type { WorldBossConfigWithState } from '~/shared/types/worldBoss'

const { availableBossList, loading, refresh } = useWorldBoss()
const router = useRouter()
const route = useRoute()

const statusLine = (boss: WorldBossConfigWithState) => {
  const now = Date.now()
  if (boss.startAt && now < boss.startAt) {
    return `${formatTime(boss.startAt)}正式进攻猫猫村！`
  }
  return '正在破坏猫猫村！'
}

const formatTime = (ts: number) => {
  const d = new Date(ts)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  const hh = `${d.getHours()}`.padStart(2, '0')
  const mm = `${d.getMinutes()}`.padStart(2, '0')
  return `${m}-${day} ${hh}:${mm}`
}

const hpPercent = (boss: WorldBossConfigWithState) => {
  const total = boss.globalState?.totalHp || 0
  const curr = boss.globalState?.currentHp || 0
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round((curr / total) * 100)))
}

const hpText = (boss: WorldBossConfigWithState) => {
  const total = boss.globalState?.totalHp || 0
  const curr = boss.globalState?.currentHp || 0
  if (!total) return '未知'
  return `${curr.toLocaleString()} / ${total.toLocaleString()}`
}

const goBattle = () => {
  const newQuery = { ...route.query, tab: 'battle', battleTab: 'worldBoss' }
  router.replace({ query: newQuery })
}
</script>

<style scoped lang="scss">
.world-boss-summary {
  transition: box-shadow .2s ease, transform .2s ease;
}

.boss-card {
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(253, 230, 138, 0.6);
    border-radius: 12px;
    padding: 10px 12px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
    transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;

    @at-root .dark & {
        background: linear-gradient(135deg, #1f2937 0%, #0f172a 100%);
        border-color: #4b5563;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
    }
}

.boss-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(0,0,0,0.08);
  border-color: rgba(248, 113, 113, 0.6);
}

:global(.dark) .boss-card {
  background: rgba(55,65,81,0.7);
  border-color: #4b5563;
  box-shadow: 0 6px 16px rgba(0,0,0,0.25);
}

:global(.dark) .boss-card:hover {
  border-color: #f87171;
}
</style>
