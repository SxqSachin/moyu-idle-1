<template>
    <div class="recent-traded bg-white dark:bg-gray-800">
        <div class="flex items-center justify-between mb-2">
            <div class="font-medium">最近有交易的商品</div>
            <el-button size="small" type="text" @click="refresh">刷新</el-button>
        </div>

        <div v-if="loading" class="text-sm text-gray-500">加载中…</div>

        <div v-else class="flex gap-3 flex-wrap">
            <div v-for="id in resources" :key="id" class="cursor-pointer" @click="toDetail(id)">
                <GameCommonResourceIconAndName :resource-id="id" />
            </div>
            <div v-if="resources.length === 0" class="text-sm text-gray-500">暂无最近成交的商品</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { emitGetRecentTradedResources, onGetRecentTradedResourcesSuccess, onGetRecentTradedResourcesError } from '~/api/game/socket/unifiedMarket'
import { GameCommonResourceIconAndName } from '#components'

const resources = ref<string[]>([])
const loading = ref(true)

const emits = defineEmits<{
    (e: 'toResource', id: string ): void
}>()

let offSuccess: (() => void) | undefined
let offError: (() => void) | undefined

function refresh() {
  loading.value = true
  emitGetRecentTradedResources(20)
}

onMounted(() => {
  offSuccess = onGetRecentTradedResourcesSuccess((data) => {
    resources.value = data.resourceIds || []
    loading.value = false
  })
  offError = onGetRecentTradedResourcesError(() => {
    loading.value = false
  })

  // initial
  refresh()
})

onUnmounted(() => {
  offSuccess && offSuccess()
  offError && offError()
})

function toDetail(id: string) {
  // 跳转到市场详情：使用 query / hash 或者触发组件事件
  // 这里我们使用路由跳转到市场页面并携带 resource id
  // router.push({ path: '/', query: { marketResource: id } }).catch(() => {})
  emits('toResource', id)
}
</script>

<style scoped>
.recent-traded .el-button {
  padding: 0;
}
</style>
