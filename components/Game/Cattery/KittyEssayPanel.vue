<template>
  <el-card class="mb-4" shadow="hover" :body-style="{ padding: '1rem' }">
    <div v-if="items.length" class="space-y-2">
      <div v-for="essay in items" :key="essay.uuid"
        class="flex flex-col md:flex-row md:items-center md:gap-2 p-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
        <div class="flex flex-col md:flex-row items-start gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1 md:mb-0">
          <div class="flex flex-row gap-2">
            <span>{{ formatTimeToStr(essay.createdAt) }}</span>
            <span v-if="essay.mood !== undefined" class="flex items-center gap-1">
              <el-icon>
                <Icon name="material-symbols:mood-outline-rounded" />
              </el-icon>
              <span>{{ essay.mood }}</span>
            </span>
          </div>
          <el-divider class="hidden! md:inline-block!" direction="vertical"></el-divider>
          <span>
            <span v-if="essay.action == 'delete_friend'" class="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">结束一段关系</span>
            <span v-else-if="essay.action == 'idle'" class="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">摸鱼</span>
            <span v-else-if="essay.action == 'kittyMoodModify'" class="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">心情变化</span>
            <span v-else-if="essay.action == 'play_with_friend'" class="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">和玩伴玩耍</span>
            <span v-else-if="essay.action == 'work_with_friend'" class="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">和玩伴一起工作</span>
            <template v-else-if="essay.action">
              正在：
              <span class="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                <GameCommonActionNameAndIcon :only-name="true" :action-id="essay.action" />
              </span>
            </template>
          </span>
        </div>
        <el-divider class="hidden! md:inline-block!" direction="vertical"></el-divider>
        <div class="text-xs text-gray-700 dark:text-gray-200 leading-relaxed flex-1 mt-2 md:mt-0">
          <template v-for="(part, idx) in parseEssayContent(essay.content)" :key="idx">
            <template v-if="part.type === 'text'">{{ part.value }}</template>
            <template v-else-if="part.type === 'kittyTag'">
              <GameCommonKittyInfo :uuid="part.uuid!" />
            </template>
          </template>
        </div>
        <div class="flex gap-2 mt-2 md:mt-0">
          <template v-for="(item, id) of getReward(essay)" :key="id">
            <GameCommonResourceIconAndName :resource-id="id" :count="item?.count" size="xs" />
          </template>
        </div>
      </div>
      <div v-if="total > pageSize" class="flex justify-center mt-4">
        <el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize" v-model:current-page="page" size="small" />
      </div>
    </div>
    <div v-else class="text-gray-400 dark:text-gray-500 text-sm py-4 text-center">暂无随笔记录</div>
  </el-card>
  <el-alert v-if="errorMsg" type="error" :title="errorMsg" show-icon class="mb-2" />
</template>

<script setup lang="ts">
import type { KittyEssayInfo } from '~/shared/types/kittyEssayInfo'
import type { ItemCountInfo } from '~/shared/types/gameInventory'
import { emitGetKittyEssay, onGetKittyAllEssayError, onGetKittyAllEssaySuccess } from '~/api/game/socket/kittyEssay'
import { formatTimeToStr, safeJsonParse } from '~/shared/utils'

const props = defineProps<{ kittyUuid: string, defaultPageSize?: number }>()

const device = useDevice()
const pageSize = ref(props.defaultPageSize ?? (device.isMobile ? 5 : 20))
const page = ref(1)
const total = ref(0)
const items = ref<KittyEssayInfo[]>([])
const errorMsg = ref('')

let offSuccess: any
let offError: any

function fetch() {
  emitGetKittyEssay(props.kittyUuid, page.value, pageSize.value)
}

onMounted(() => {
  offSuccess = onGetKittyAllEssaySuccess((res) => {
    // 只接收当前kitty的数据（前端简单过滤，服务端按 kittyUuid 区分更佳）
    items.value = res.items
    total.value = res.total
    page.value = res.page
    pageSize.value = res.pageSize
    errorMsg.value = ''
  })
  offError = onGetKittyAllEssayError((err) => {
    errorMsg.value = err.message || '获取猫咪随笔失败'
  })
  fetch()
})

watch(page, () => fetch())

onUnmounted(() => { offSuccess?.(); offError?.() })

function getReward(essay: KittyEssayInfo): ItemCountInfo {
  if (!essay.extra) return {}
  const extra = safeJsonParse(essay.extra) as any
  return extra?.reward || {}
}

function parseEssayContent(content: string) {
  const regex = /\[([^\{\}\[\]]+)\{([^\{\}\[\]]+)\}\]/g
  const result: Array<{ type: 'text' | 'kittyTag', value?: string, name?: string, uuid?: string }> = []
  let lastIndex = 0
  let match
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) { result.push({ type: 'text', value: content.slice(lastIndex, match.index) }) }
    result.push({ type: 'kittyTag', name: match[1], uuid: match[2] })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < content.length) { result.push({ type: 'text', value: content.slice(lastIndex) }) }
  return result
}
</script>
