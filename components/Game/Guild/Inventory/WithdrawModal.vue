<template>
  <el-dialog v-model="visibleLocal" title="提取物品" width="600px" @close="onClose">
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <el-input v-model="search" placeholder="搜索物品名称" class="flex-1" />
        <el-select v-model="category" placeholder="选择分类" style="width: 160px">
          <el-option label="全部分类" value="all" />
          <template v-for="(catInfo, catKey) in allGameResourceCategoryInfo" :key="catKey">
            <el-option v-if="catKey != GameResourceCategory.Custom" :label="catInfo.name" :value="catKey" />
          </template>
        </el-select>
      </div>

      <div class="max-h-96 overflow-y-auto">
        <template v-if="filteredList.length">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div v-for="item in filteredList" :key="item.itemId" class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div class="flex items-center justify-between gap-3">
                <GameCommonResourceIconAndName :resource-id="item.itemId" :count="personalBalances[item.itemId] || 0" />
                <el-input-number v-model="amounts[item.itemId]" :min="0" :max="personalBalances[item.itemId] || 0" :step="1" step-strictly />
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="text-center py-8 text-gray-400">
            <div class="text-2xl mb-2">📦</div>
            <div class="text-sm">暂无可提取的物品</div>
          </div>
        </template>
      </div>

      <div>
        <label class="block text-sm font-medium mb-2">备注（可选）</label>
        <el-input v-model="reason" placeholder="可选填" maxlength="48" show-word-limit />
      </div>
    </div>

    <template #footer>
      <div class="flex gap-2">
        <el-button @click="onClose">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="lastPending" @click="onSubmit">确认提取</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElNotification } from 'element-plus'
import { allGameResource, allGameResourceCategoryInfo } from '~/shared/data/allGameResources'
import { GameResourceCategory } from '~/shared/types/gameResource'
import type { GuildInventoryItem } from '~/shared/types/guild'
import { emitPersonalWithdrawFromGuildInventory, onPersonalWithdrawFromGuildInventorySuccess, onPersonalWithdrawFromGuildInventoryFail, emitGetUserPersonalBalances, onGetUserPersonalBalancesSuccess, onGetUserPersonalBalancesFail } from '~/api/game/socket/guildInventory'
import { waitUtilConnected } from '~/api/game/socket/socket'

const props = defineProps<{ guildUuid: string; inventory: GuildInventoryItem[]; visible: boolean }>()
const emits = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'refetch'): void }>()

const visibleLocal = ref(props.visible)
watch(() => props.visible, v => { visibleLocal.value = v })
watch(visibleLocal, v => emits('update:visible', v))

const search = ref('')
const category = ref<'all' | GameResourceCategory>('all')
const reason = ref('')
const submitting = ref(false)
const amounts = ref<Record<string, number>>({})
// 额外限制：若上一次提取还未完成，则不允许再次提交
const lastPending = ref(false)

const personalBalances = ref<Record<string, number>>({})

const filteredList = computed(() => {
  // 仅展示个人余额 > 0 的物品
  let list = props.inventory.filter(i => (personalBalances.value[i.itemId] ?? 0) > 0)
  if (category.value !== 'all') {
    list = list.filter(i => allGameResource[i.itemId]?.category?.includes(category.value))
  }
  if (search.value) {
    list = list.filter(i => allGameResource[i.itemId]?.name.includes(search.value))
  }
  return list
})

function reset() {
  search.value = ''
  category.value = 'all'
  reason.value = ''
  submitting.value = false
  amounts.value = {}
  // 不重置 lastPending，确保跨打开仍然限制，直到真正完成或失败
}

function onClose() {
  visibleLocal.value = false
  reset()
}

function validate(): { ok: boolean; msg?: string } {
  const entries = Object.entries(amounts.value).filter(([_, v]) => (v ?? 0) > 0)
  if (!entries.length) return { ok: false, msg: '请选择要提取的物品' }
  for (const [itemId, amt] of entries) {
    if (!Number.isInteger(amt)) return { ok: false, msg: '提取数量必须为整数' }
    if (amt <= 0) return { ok: false, msg: '提取数量必须大于0' }
    if (amt > 10000000) return { ok: false, msg: '提取数量不能超过10000000' }
  }
  return { ok: true }
}

function onSubmit() {
  if (lastPending.value) {
    ElNotification.warning({ title: '无法提交', message: '上一笔提取尚未完成，请稍后再试' })
    return
  }
  const v = validate()
  if (!v.ok) {
    ElNotification.error({ title: '提交失败', message: v.msg })
    return
  }
  submitting.value = true
  lastPending.value = true
  // 构造聚合对象一次性提交
  const payload: Record<string, { count: number }> = {}
  for (const [itemId, amt] of Object.entries(amounts.value)) {
    if ((amt ?? 0) > 0) payload[itemId] = { count: amt }
  }
  ;(async () => {
    await waitUtilConnected()
    try {
      // 仅发送请求，成功/失败由 socket 事件回调统一处理，避免重复提示
      await emitPersonalWithdrawFromGuildInventory(props.guildUuid, payload, reason.value || undefined)
      // 设置一个超时兜底，防止服务端无响应时卡住
      const timeoutMs = 10000
      setTimeout(() => {
        if (submitting.value) {
          submitting.value = false
          ElNotification.warning({ title: '提取结果未知', message: '服务端响应超时，请稍后在记录中确认' })
        }
        lastPending.value = false
      }, timeoutMs)
    } catch (err) {
      submitting.value = false
      lastPending.value = false
    }
  })()
}
// 监听注册与解绑
let offFns: Array<() => void> = []

onMounted(async () => {
  // 当弹窗显隐变化时，打开即拉取余额
  offFns.push(
    watch(visibleLocal, async (v) => {
      if (v) {
        await waitUtilConnected()
        emitGetUserPersonalBalances(props.guildUuid)
      }
    })
  )

  // 注册 socket 事件监听
  offFns.push(
    onGetUserPersonalBalancesSuccess(({ balances }) => {
      personalBalances.value = balances || {}
    }),
    onGetUserPersonalBalancesFail(({ message }) => {
      personalBalances.value = {}
      ElNotification.error({ title: '获取可提取余额失败', message })
    }),
    onPersonalWithdrawFromGuildInventorySuccess(() => {
      // 统一在成功事件中提示与收尾，避免与提交处重复提示
      if (submitting.value) {
        submitting.value = false
        lastPending.value = false
        ElNotification.success({ title: '提取成功' })
        emits('refetch')
        onClose()
      }
    }),
    onPersonalWithdrawFromGuildInventoryFail((payload) => {
      submitting.value = false
      lastPending.value = false
      ElNotification.error({ title: '提取失败', message: payload.message || '提取失败' })
    })
  )
})

onUnmounted(() => {
  offFns.forEach(fn => fn && fn())
  offFns = []
})
</script>

<style scoped>
</style>
