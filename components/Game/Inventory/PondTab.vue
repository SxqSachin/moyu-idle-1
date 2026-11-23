<template>
  <div class="inventory-pond-tab">
    <div class="flex flex-col gap-3 mb-4">
      <div class="flex flex-wrap gap-2 items-center">
        <div class="flex flex-row items-center gap-2">
          <div>
            <el-button type="primary" plain size="small" :disabled="confirming" @click="toggleBulkMode">
              {{ bulkMode ? '退出批量出售' : '批量出售' }}
            </el-button>
            <el-button v-if="bulkMode" size="small" plain :disabled="filteredIds.length === 0 || confirming" @click="toggleSelectAll">
              {{ isAllSelected ? '取消全选' : '全选筛选结果' }}
            </el-button>
          </div>

          <div v-if="bulkMode && selectedIds.size > 0"
            class="text-sm text-gray-600 dark:text-gray-300 ml-auto flex items-center gap-3">
            <span class="text-sm">已选 {{ selectedIds.size }} 条</span>
            <el-button type="success" size="small" :disabled="confirming" @click="openConfirmDialog">确认出售</el-button>
          </div>
        </div>

        <el-select v-model="filterSpecies" clearable placeholder="按品种筛选" class="w-40">
          <el-option v-for="opt in speciesOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-select v-model="filterQuality" clearable placeholder="按品质筛选" class="w-32">
          <el-option v-for="q in qualityOptions" :key="q.value" :label="q.label" :value="q.value" />
        </el-select>

      </div>
      <div v-if="bulkMode" class="text-xs text-gray-400 dark:text-gray-500">全选仅作用于当前筛选结果</div>
    </div>

    <div v-if="groups.length === 0" class="mt-6">
      <div class="text-center py-12 text-gray-400 dark:text-gray-500">
        <div class="text-5xl mb-3">🐟</div>
        <div class="text-sm">目前还没有鱼获，去钓鱼试试吧</div>
      </div>
    </div>

    <template v-for="group in groups" :key="group.fishId">
      <div class="group-block">
        <div class="group-header">
          <div class="group-title">{{ getFishName(group.fishId) }} <span class="count">({{ group.items.length }})</span>
          </div>
        </div>

        <transition-group name="fade" tag="div"
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div v-for="item in visibleItems(group.items)" :key="item.id"
            class="fade-item">
            <FishingCatchItem
              :fish="item"
              :bulk-mode="bulkMode"
              :checked="selectedIds.has(item.id)"
              @toggle-check="(checked) => onToggleCheck(item.id, checked)"
              @sold="onItemSold"
            />
          </div>
        </transition-group>

        <div v-if="group.items.length > 3 && !filterSpecies" class="mt-3 flex">
          <button @click.prevent="toggleExpand(group.fishId)"
            class="ml-auto inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition">
            <span v-if="!expanded.has(group.fishId)">展开更多（{{ group.items.length - 3 }}）</span>
            <span v-else>收起</span>
          </button>
        </div>
      </div>
    </template>

    <el-dialog v-model="showConfirm" title="确认批量出售" width="520px">
      <div class="space-y-2 text-sm text-gray-700 dark:text-gray-200">
        <div>共选择 {{ selectionPreview.receipts.length }} 条鱼获，总价：<span class="font-semibold text-green-600 dark:text-green-400">{{ formatNumber(selectionPreview.totalAmount) }}</span> 金币</div>
        <div class="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2 space-y-2">
          <div v-for="item in selectionBreakdown" :key="item.receipt.caughtFishId" class="text-xs">
            <div class="flex justify-between items-center">
              <div class="truncate mr-2">{{ getFishName(item.receipt.fishId) }}</div>
              <div class="text-gray-500 dark:text-gray-400">{{ item.breakdown.total }} 金币</div>
            </div>
            <div class="grid grid-cols-2 gap-1 text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              <div>基础价：{{ item.breakdown.basePrice }}</div>
              <div>品质：+{{ item.breakdown.qualityBonus }}（{{ qualityStrMap[item.receipt.quality ?? 0] || '普通' }}）</div>
              <div>长度：+{{ item.breakdown.lengthBonus }}</div>
              <div>重量：+{{ item.breakdown.weightBonus }}</div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showConfirm = false">取消</el-button>
          <el-button type="primary" :loading="confirming" :disabled="confirming || confirmCooldown" @click="confirmBatchSell">确认出售</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { waitUtilConnected as waitUtilSocketConnected } from '~/api/game/socket/socket'
import { emitGetMyCatches, onGetMyCatchesSuccess, onGetMyCatchesFail } from '~/api/game/socket/fishing'
import type { CaughtFishDTO, SellCaughtFishReceipt } from '~/shared/types/fishing'
import { allFishSpecies, type AllFishSpeciesID } from '~/shared/data/allFishSpecies'
import FishingCatchItem from '../Fishing/FishingCatchItem.vue'
import type { FuncAction } from '~/shared/types'
import useFishing from '~/composables/game/useFishing'
import { formatNumber, ObjectKeysTyped } from '~/shared/utils'

// 本地缓存的鱼获列表
const catches = ref<CaughtFishDTO[]>([])
const bulkMode = ref(false)
const selectedIds = ref<Set<number>>(new Set())
const filterSpecies = ref<AllFishSpeciesID | ''>('')
const filterQuality = ref<number | null>(null)
const showConfirm = ref(false)
const confirming = ref(false)
const confirmCooldown = ref(false)
const selectionPreview = ref<{ receipts: SellCaughtFishReceipt[]; totalAmount: number }>({ receipts: [], totalAmount: 0 })
const selectionBreakdown = computed(() => selectionPreview.value.receipts.map((r) => {
  const breakdown = getCaughtFishSellBreakdown({
    id: r.caughtFishId,
    fishId: r.fishId,
    length: r.length,
    weight: r.weight ?? 0,
    quality: r.quality ?? 0,
    userUuid: '',
    sessionId: '',
    pondId: '',
    caughtAt: new Date(),
    createdAt: new Date(),
  } as CaughtFishDTO)
  return { receipt: r, breakdown }
}))

const qualityStrMap: Record<number, string> = {
  0: '普通',
  1: '优质',
  2: '精良',
  3: '稀有',
  4: '传奇',
}

const qualityOptions = [
  { label: `${qualityStrMap[0]}及以下`, value: 1 },
  { label: `${qualityStrMap[1]}及以下`, value: 2 },
  { label: `${qualityStrMap[2]}及以下`, value: 3 },
  { label: `${qualityStrMap[3]}及以下`, value: 4 },
  { label: `${qualityStrMap[4]}及以下`, value: 5 },
]

const speciesOptions = ObjectKeysTyped(allFishSpecies).filter(f => {
  return !allFishSpecies[f].asResource
}).map((k) => ({
  label: allFishSpecies[k]?.name || k,
  value: k,
}))

const { calculateCaughtFishSellValue, buildBatchSellPreview, sellCaughtFishBatch, getCaughtFishSellBreakdown } = useFishing()

const listenerList: FuncAction[] = []

onMounted(async () => {
  await waitUtilSocketConnected()
  emitGetMyCatches()

  listenerList.push(
    onGetMyCatchesSuccess((payload: { data?: unknown }) => {
      // payload.data 期望是一个鱼获数组
      const data = payload.data
      if (Array.isArray(data)) {
        catches.value = data as CaughtFishDTO[]
      } else {
        catches.value = []
      }
    }),
    onGetMyCatchesFail((err: unknown) => {
      // 请求失败时清空本地数据以保证一致性
      catches.value = []
    })
  )
})

onBeforeUnmount(() => {
  for (const listener of listenerList) {
    listener?.()
  }
})

/**
 * 处理某条鱼获被出售的回调。
 * 优先尝试从事件负载中解析出被售鱼获的 id，做乐观删除并播放淡出动画，
 * 动画结束后再向服务器重新请求列表以保证最终一致性。
 */
function onItemSold(payload: {caughtFishId: number}) {
  // 尝试解析可能的 id 字段（支持多种协议形态）
  let fishId = payload.caughtFishId

  if (fishId) {
    catches.value = catches.value.filter(c => String(c.id) !== String(fishId))
    // 立即显示成功提示（若有金额则展示），然后在动画结束后刷新列表以确保一致性
    ElMessage.success('出售成功')
    setTimeout(() => {
       emitGetMyCatches()
    }, 350)
    return
  }

  ElMessage.success('出售完成')
  emitGetMyCatches()
}

const filteredCatches = computed(() => {
  return catches.value.filter((c) => {
    if (filterSpecies.value && c.fishId !== filterSpecies.value) return false
    if (filterQuality.value !== null && (c.quality ?? 0) >= filterQuality.value) return false
    return true
  })
})

watch([filterSpecies, filterQuality], () => {
  selectedIds.value = new Set()
})

const filteredIds = computed(() => filteredCatches.value.map((c) => c.id))

const isAllSelected = computed(() => {
  if (filteredIds.value.length === 0) return false
  return filteredIds.value.every((id) => selectedIds.value.has(id))
})

function toggleBulkMode() {
  bulkMode.value = !bulkMode.value
  if (!bulkMode.value) {
    selectedIds.value = new Set()
  }
}

function toggleSelectAll() {
  const next = new Set<number>(selectedIds.value)
  if (isAllSelected.value) {
    for (const id of filteredIds.value) next.delete(id)
  } else {
    for (const id of filteredIds.value) next.add(id)
  }
  selectedIds.value = next
}

function onToggleCheck(id: number, checked: boolean) {
  const next = new Set<number>(selectedIds.value)
  if (checked) next.add(id)
  else next.delete(id)
  selectedIds.value = next
}

function visibleItems(items: CaughtFishDTO[]) {
  if (!items || items.length === 0) return []
  if (bulkMode.value) return items
  if (filterSpecies.value) return items
  const fishId = items[0]?.fishId as AllFishSpeciesID | undefined
  if (fishId && expanded.value.has(fishId)) return items
  return items.slice(0, 4)
}

function openConfirmDialog() {
  if (confirming.value) return
  if (selectedIds.value.size === 0) return
  const selected = filteredCatches.value.filter((c) => selectedIds.value.has(c.id))
  if (selected.length === 0) {
    ElNotification({ title: '没有可出售的鱼获', message: '请重新选择', type: 'warning', duration: 1500 })
    selectedIds.value = new Set()
    return
  }
  selectionPreview.value = buildBatchSellPreview(selected)
  showConfirm.value = true
}

async function confirmBatchSell() {
  if (confirming.value || confirmCooldown.value) return
  if (selectedIds.value.size === 0) return
  confirming.value = true
  confirmCooldown.value = true
  try {
    const ids = Array.from(selectedIds.value).filter((id) => Number.isInteger(id) && id > 0)
    if (ids.length === 0) {
      ElNotification({ title: '无效的选择', message: '请重新选择鱼获', type: 'warning', duration: 1500 })
      selectedIds.value = new Set()
      return
    }

    const selected = filteredCatches.value.filter((c) => ids.includes(c.id))
    if (selected.length !== ids.length) {
      ElNotification({ title: '列表已更新', message: '部分鱼获已不存在，已刷新列表', type: 'info', duration: 1500 })
      emitGetMyCatches()
      selectedIds.value = new Set()
      return
    }

    const res = await sellCaughtFishBatch(ids)
    // 乐观清理本地
    catches.value = catches.value.filter((c) => !selectedIds.value.has(c.id))
    selectedIds.value = new Set()
    showConfirm.value = false
    ElMessage.success(`出售成功，获得 ${res.totalAmount} 金币`)
    // 保险起见刷新
    emitGetMyCatches()
  } catch (e) {
    ElNotification({ title: '批量出售失败', message: e instanceof Error ? e.message : String(e), type: 'error', duration: 1800 })
  } finally {
    confirming.value = false
    setTimeout(() => {
      confirmCooldown.value = false
    }, 3000)
  }
}

const groups = computed(() => {
  const map = new Map<AllFishSpeciesID, CaughtFishDTO[]>()
  for (const c of catches.value) {
    const fishId = c.fishId as AllFishSpeciesID
    if (!map.has(fishId)) map.set(fishId, [])
    map.get(fishId)!.push(c)
  }

  // convert to array and sort items inside each group by caughtAt desc
  // sort by quality (if available) desc, then by caughtAt desc
  // 计算鱼获的品质评分（优先使用 quality，其次尝试 rank/grade/rarity/score）
  function getQuality(v?: CaughtFishDTO | null) {
    if (!v) return 0
    const candidates = [v.quality]
    for (const c of candidates) {
      if (c === undefined || c === null) continue
      const n = Number(c)
      if (Number.isFinite(n)) return n
    }
    return 0
  }

  // Build groups following the order of keys in `allFishSpecies`
  // 按 `allFishSpecies` 的 key 顺序组织分组，保证分组顺序稳定
  const keysInOrder = Object.keys(allFishSpecies) as AllFishSpeciesID[]
  const arr: { fishId: AllFishSpeciesID; items: CaughtFishDTO[] }[] = []

  for (const k of keysInOrder) {
    if (!map.has(k)) continue
    const items = map.get(k)!.slice()
    items.sort((a, b) => {
      const q = getQuality(b) - getQuality(a)
      if (q !== 0) return q
      return (new Date(b.caughtAt || b.createdAt || 0).getTime()) - (new Date(a.caughtAt || a.createdAt || 0).getTime())
    })
    arr.push({ fishId: k, items })
  }

  // Append fishIds that exist in catches but are not defined in allFishSpecies
  for (const [fishId, items] of map.entries()) {
    if ((keysInOrder as string[]).includes(String(fishId))) continue
    const cloned = items.slice()
    cloned.sort((a, b) => {
      const q = getQuality(b) - getQuality(a)
      if (q !== 0) return q
      return (new Date(b.caughtAt || b.createdAt || 0).getTime()) - (new Date(a.caughtAt || a.createdAt || 0).getTime())
    })
    arr.push({ fishId: fishId as AllFishSpeciesID, items: cloned })
  }

  // 应用筛选：过滤掉组内不符合条件的条目，并移除空组
  const filteredGroups = arr
    .map((g) => {
      const filteredItems = g.items.filter((c) => {
        if (filterSpecies.value && c.fishId !== filterSpecies.value) return false
        if (filterQuality.value !== null && (c.quality ?? 0) >= filterQuality.value) return false
        return true
      })
      return { ...g, items: filteredItems }
    })
    .filter((g) => g.items.length > 0)

  return filteredGroups
})

// expanded groups state (show all items for a fishId)
const expanded = ref<Set<AllFishSpeciesID>>(new Set())

function toggleExpand(fishId: AllFishSpeciesID) {
  const s = new Set(expanded.value)
  if (s.has(fishId)) s.delete(fishId)
  else s.add(fishId)
  expanded.value = s
}

function getFishName(fishId: AllFishSpeciesID) {
  if (!fishId) return '未知鱼类'
  return allFishSpecies[fishId]?.name || '未知鱼类'
}
</script>

<style scoped>
/* 列表项淡出动画（出售时使用） */
.fade-leave-active {
  transition: opacity 0.35s ease;
}

.fade-leave-to {
  opacity: 0;
}

.fade-enter-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
}

.fade-item {
  display: block;
}
</style>
