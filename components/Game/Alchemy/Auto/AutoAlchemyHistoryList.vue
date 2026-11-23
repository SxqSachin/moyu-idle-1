<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-row items-center gap-3">
      <el-button size="small" @click="refresh" :loading="loading">刷新</el-button>
      <span class="text-xs text-gray-500">最近 {{ limit }} 条</span>
    </div>

    <div v-if="!loading && !list.length" class="text-xs text-gray-400 px-1 py-2">暂无历史记录</div>

    <transition-group name="fade" tag="div" class="flex flex-col gap-3">
      <el-card v-for="rec in list" :key="rec.uuid" class="history-card" shadow="hover" body-class="p-3">
        <div class="flex flex-row justify-between items-start gap-2">
          <div class="flex flex-col gap-1 flex-1 min-w-0">
            <div class="flex flex-row items-center gap-2 flex-wrap">
              <GameCommonResourceIconAndName :resource-id="rec.recipeId" :count="rec.doneTimes" />
              <el-tag size="small" :type="statusType(rec.status)">{{ statusLabel(rec.status) }}</el-tag>
              <span class="text-xs text-gray-400">{{ formatTime(rec.updatedAt) }}</span>
            </div>
            <div class="text-xs text-gray-500 flex flex-row flex-wrap gap-3">
              <span>进度 {{ rec.doneTimes }}/{{ rec.targetTimes }}</span>
              <span v-if="rec.lastError" class="text-red-400">错误: {{ rec.lastError }}</span>
            </div>
            <div class="flex flex-row flex-wrap items-center gap-1 mt-1" v-if="Object.keys(rec.allRewardItems||{}).length">
              <span class="text-xs text-gray-500">获得</span>
              <GameCommonResourceIconAndName
                v-for="(c,id) in rec.allRewardItems" :key="id" :resource-id="id" :count="c?.count || 0" />
            </div>
            <div class="flex flex-row flex-wrap items-center gap-1" v-if="Object.keys(rec.allUsedItems||{}).length">
              <span class="text-xs text-gray-500">消耗</span>
              <GameCommonResourceIconAndName
                v-for="(c,id) in rec.allUsedItems" :key="id" :resource-id="id" :count="c?.count || 0" />
            </div>
          </div>
        </div>
      </el-card>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { emitGetAutoAlchemyHistory, onGetAutoAlchemyHistorySuccess, onGetAutoAlchemyHistoryFail } from '~/api/game/socket/alchemy'
import type { ItemCountInfo } from '~/shared/types/gameInventory'
import { waitUtilConnected } from '~/api/game/socket/socket'

interface AutoAlchemyHistoryItem {
  uuid: string;
  recipeId: string;
  recipeIndex: number;
  targetTimes: number;
  doneTimes: number;
  status: string;
  allUsedItems: ItemCountInfo;
  allRewardItems: ItemCountInfo;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

const props = withDefaults(defineProps<{ limit?: number }>(), { limit: 30 })

const list = ref<AutoAlchemyHistoryItem[]>([])
const loading = ref(false)
const limit = computed(() => props.limit)
let offOk: any; let offFail: any

const statusLabel = (s: string) => {
  switch(s) {
    case 'FINISHED': return '完成'
    case 'ERROR': return '错误'
    case 'CANCELLED': return '取消'
    case 'PENDING': return '排队'
    case 'PROCESSING': return '进行'
    default: return s
  }
}
const statusType = (s: string) => s === 'FINISHED' ? 'success' : (s === 'ERROR' ? 'danger' : (s === 'CANCELLED' ? 'warning' : 'info'))

const formatTime = (t: string | Date) => {
  const d = new Date(t)
  const pad = (n: number) => n.toString().padStart(2,'0')
  return `${d.getMonth()+1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const refresh = async () => {
  loading.value = true
  emitGetAutoAlchemyHistory(limit.value)
}

onMounted(async () => {
  await waitUtilConnected()
  offOk = onGetAutoAlchemyHistorySuccess(data => {
    list.value = data.list
    loading.value = false
  })
  offFail = onGetAutoAlchemyHistoryFail(data => {
    loading.value = false
    ElNotification({ title: '获取历史失败', message: data.msg, type: 'error' })
  })
  refresh()
})

onUnmounted(() => { offOk?.(); offFail?.(); })

// 暴露刷新方法给父组件
defineExpose({ refresh })
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: all .2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
.history-card { padding: 0; }
</style>
