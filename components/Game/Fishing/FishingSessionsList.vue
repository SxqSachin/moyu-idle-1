<template>
  <div class="p-4 bg-white dark:bg-gray-800 rounded-md">
    <div class="flex items-center justify-between mb-3">
      <div class="text-lg font-medium">我的钓鱼记录</div>
      <el-button size="small" type="primary" @click="reload" :loading="loading">刷新</el-button>
    </div>

    <div v-if="error" class="text-sm text-red-500 mb-2">{{ error }}</div>

    <div v-if="loading" class="p-2">
      <el-skeleton :rows="3" animated />
    </div>

    <div v-else-if="!items.length" class="text-sm text-gray-500">暂无钓鱼记录</div>

    <el-collapse v-model="expanded" accordion>
      <el-collapse-item v-for="s in items" :key="s.uuid" :title="formatTitle(s)" :name="s.uuid" class="pl-2">
        <div class="p-2">
        <div class="text-xs text-gray-600 mb-2">
          开始: {{ formatTimeToStr(s.startAt) }}
          <span v-if="s.endAt"> · 结束: {{ formatTimeToStr(s.endAt) }}</span>
        </div>
        <div class="mb-2">
          <FishingCatchList :userUuid="s.userUuid" :sessionId="s.uuid" :ref="(el) => (catchRefs[s.uuid] = el)" />
        </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { emitGetMySessions, onGetMySessionsSuccess, onGetMySessionsFail } from '@/api/game/socket/fishing'
import FishingCatchList from './FishingCatchList.vue'
import { formatTimeToStr } from '~/shared/utils'
import { allFishPond } from '~/shared/data/allFishPond'

const items = ref<Array<any>>([])
const loading = ref(false)
const error = ref<string | null>(null)

// el-collapse model stores active names; we don't need strict control, use expanded as array
const expanded = ref<string | string[] | number | number[]>([])

// refs to child FishingCatchList components keyed by sessionId
const catchRefs: Record<string, any> = {}

function reload() {
  loading.value = true
  error.value = null
  emitGetMySessions()
}

onGetMySessionsSuccess((p: any) => {
  items.value = Array.isArray(p?.data) ? p.data : (p?.data || [])
  loading.value = false
})
onGetMySessionsFail((p: any) => {
  error.value = p?.message || '请求失败'
  items.value = []
  loading.value = false
})

onMounted(() => reload())

onBeforeUnmount(() => {
  // clear child refs
  for (const k of Object.keys(catchRefs)) delete catchRefs[k]
})

// 当展开新的面板时，尝试触发其内嵌 FishingCatchList 的 load()
watch(expanded, (v) => {
  const active = Array.isArray(v) ? v : (v ? [v] : [])
  for (const a of active) {
    const sid = String(a)
    try { catchRefs[sid]?.load?.() } catch (_) { /* ignore */ }
  }
})

const STATUS_MAP: Record<string, string> = {
  ONGOING: '钓鱼中',
  COMPLETED: '已结束',
}

function formatTitle(s: any) {
  const pond = (s.pondId && (allFishPond as any)[s.pondId])
  const pondName = pond ? pond.name : (s.pondId || '未知地点')
  const statusLabel = STATUS_MAP[s.status] || s.status || ''
  return `${pondName} · ${statusLabel} · ${formatTimeToStr(s.startAt)}`
}

defineProps({})
</script>

<style scoped>
</style>
