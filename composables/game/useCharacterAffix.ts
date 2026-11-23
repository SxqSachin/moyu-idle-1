// 词条功能业务封装
// - 提供列表、抽取、更新状态、删除
// - 内部管理本地状态，统一展示消息（Element Plus）

import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import type { CharacterAffixInstance, CharacterAffixState } from '~/shared/types/affix'
import {
  emitCharacterAffixList,
  emitCharacterAffixRoll,
  emitCharacterAffixUpdateState,
  emitCharacterAffixRemove,
  onCharacterAffixListSuccess,
  onCharacterAffixListError,
  onCharacterAffixRollSuccess,
  onCharacterAffixRollError,
  onCharacterAffixUpdateStateSuccess,
  onCharacterAffixUpdateStateError,
  onCharacterAffixRemoveSuccess,
  onCharacterAffixRemoveError,
  emitCharacterAffixRemoveMany,
  onCharacterAffixRemoveManySuccess,
  onCharacterAffixRemoveManyError,
  emitCharacterAffixGetLimits,
  onCharacterAffixGetLimitsSuccess,
  onCharacterAffixGetLimitsError,
  emitCharacterAffixReroll,
  onCharacterAffixRerollSuccess,
  onCharacterAffixRerollError,
  emitCharacterAffixRerollUp,
  onCharacterAffixRerollUpSuccess,
  onCharacterAffixRerollUpError,
  emitCharacterAffixUpgradeRarity,
  onCharacterAffixUpgradeRaritySuccess,
  onCharacterAffixUpgradeRarityError,
  emitCharacterAffixExpandOwned,
  onCharacterAffixExpandOwnedSuccess,
  onCharacterAffixExpandOwnedError,
  emitCharacterAffixExpandActive,
  onCharacterAffixExpandActiveSuccess,
  onCharacterAffixExpandActiveError,
} from '@/api/game/socket/characterAffix'

export function useCharacterAffix() {
  const { user } = useUserSession()

  // 本地状态
  const list = ref<CharacterAffixInstance[]>([])
  const loading = ref(false)
  const error = ref('')
  const maxActive = ref(0)
  const maxOwned = ref(0)
  const schemeRemaining = ref<Record<string, number | 'infinity'> | null>(null)
  const schemeUsage = ref<Record<string, number> | null>(null)
  const schemeLimitMessage = ref<Record<string, string> | null>(null)
  const expanding = ref(false)

  // 监听器解绑句柄
  const disposers: Array<() => void> = []

  // 注册事件监听
  function ensureListeners() {
    if (disposers.length) return

    disposers.push(
      onCharacterAffixListSuccess(({ list: serverList }) => {
        list.value = serverList || []
      }),
      onCharacterAffixListError(({ message }) => {
        error.value = message || '获取词条列表失败'
        ElNotification({ type: 'error', title: '获取失败', message: error.value })
      }),

      onCharacterAffixRollSuccess(({ created }) => {
        if (created?.length) {
          // 新增在前，保持即时可见
          list.value = [...created, ...list.value]
          ElNotification({ type: 'success', title: '抽取成功', message: `新增 ${created.length} 条` })
        } else {
          ElMessage.info('未抽取到新词条')
        }
        // 抽取后刷新上限（如有动态加成变化）
        const uuid = user.value?.uuid
        if (uuid) emitCharacterAffixGetLimits(uuid)
      }),
      onCharacterAffixRollError(({ message }) => {
        ElNotification({ type: 'error', title: '抽取失败', message })
      }),

      onCharacterAffixUpdateStateSuccess(({ current }) => {
        if (current) {
          list.value = list.value.map((a) => (a.id === current.id ? current : a))
          ElMessage.success('状态已更新')
        }
      }),
      onCharacterAffixUpdateStateError(({ message }) => {
        ElNotification({ type: 'error', title: '更新失败', message })
      }),

      onCharacterAffixRemoveSuccess(({ ok }) => {
        if (ok) {
          // 无法从回包获知 id，这里在触发时内部自行维护 pendingRemoveId 更优
          // 为简化，在调用 remove 时直接移除本地项（见 remove 方法）
          ElMessage.success('已删除')
        }
      }),
      onCharacterAffixRemoveError(({ message }) => {
        ElNotification({ type: 'error', title: '删除失败', message })
      }),

      onCharacterAffixRemoveManySuccess(({ removedIds }) => {
        if (Array.isArray(removedIds) && removedIds.length) {
          ElMessage.success(`已删除 ${removedIds.length} 条`)
        } else {
          ElMessage.success('已删除')
        }
      }),
      onCharacterAffixRemoveManyError(({ message }) => {
        ElNotification({ type: 'error', title: '批量删除失败', message })
        // 为保证一致性，失败时建议刷新
        const uuid = user.value?.uuid
        if (uuid) emitCharacterAffixList(uuid)
      }),

      onCharacterAffixGetLimitsSuccess((payload: any) => {
        maxActive.value = payload.maxActive
        maxOwned.value = payload.maxOwned
        schemeRemaining.value = payload.schemeRemaining ?? null
        schemeUsage.value = payload.schemeUsage ?? null
        schemeLimitMessage.value = payload.schemeLimitMessage ?? null
      }),
      onCharacterAffixGetLimitsError(({ message }) => {
        // 轻提示即可
        if (message) console.warn('获取词条上限失败:', message)
      }),
      onCharacterAffixRerollSuccess(({ current }) => {
        if (current) {
          list.value = list.value.map((a) => (a.id === current.id ? current : a))
          ElMessage.success('重抽成功')
        }
      }),
      onCharacterAffixRerollError(({ message }) => {
        ElNotification({ type: 'error', title: '重抽失败', message })
      }),

      onCharacterAffixRerollUpSuccess(({ current }) => {
        if (current) {
          list.value = list.value.map((a) => (a.id === current.id ? current : a))
          ElMessage.success('进阶重随成功')
        }
      }),
      onCharacterAffixRerollUpError(({ message }) => {
        ElNotification({ type: 'error', title: '进阶重随失败', message })
      }),

      onCharacterAffixUpgradeRaritySuccess(({ current }) => {
        if (current) {
          list.value = list.value.map((a) => (a.id === current.id ? current : a))
          ElMessage.success('稀有度升级成功')
        }
      }),
      onCharacterAffixUpgradeRarityError(({ message }) => {
        ElNotification({ type: 'error', title: '稀有度升级失败', message })
      }),

      onCharacterAffixExpandOwnedSuccess((payload: any) => {
        maxActive.value = payload.maxActive
        maxOwned.value = payload.maxOwned
        // update per-scheme usage/remaining if server returned them so open popovers recompute correctly
        if (payload.schemeUsage) schemeUsage.value = payload.schemeUsage
        if (payload.schemeRemaining) schemeRemaining.value = payload.schemeRemaining
        if (payload.schemeLimitMessage) schemeLimitMessage.value = payload.schemeLimitMessage
        ElMessage.success('已扩展持有上限 +1')
        expanding.value = false
      }),
      onCharacterAffixExpandActiveSuccess((payload: any) => {
        // server returned new limits and counts
        maxActive.value = payload.maxActive
        maxOwned.value = payload.maxOwned
        // optional: refresh counts or other UI
        ElMessage.success('已扩展启用上限 +1')
        expanding.value = false
      }),
      onCharacterAffixExpandActiveError(({ message }) => {
        expanding.value = false
        ElNotification({ type: 'error', title: '扩容失败', message })
      }),
      onCharacterAffixExpandOwnedError(({ message }) => {
        expanding.value = false
        ElNotification({ type: 'error', title: '扩容失败', message })
      })
    )
  }

  // 动作
  async function fetchList() {
    try {
      loading.value = true
      ensureListeners()
      const uuid = user.value?.uuid
      if (!uuid) return
      emitCharacterAffixList(uuid)
      // 同步刷新上限信息
      emitCharacterAffixGetLimits(uuid)
    } finally {
      loading.value = false
    }
  }

  function roll(opt?: { poolId?: string; count?: number; seed?: string }) {
    ensureListeners()
    const uuid = user.value?.uuid
    if (!uuid) return
    emitCharacterAffixRoll({ characterUuid: uuid, ...opt })
  }

  function updateState(id: number, newState: CharacterAffixState, version?: number) {
    ensureListeners()
    const uuid = user.value?.uuid
    if (!uuid) return
    emitCharacterAffixUpdateState({ characterUuid: uuid, id, newState, version })
  }

  function remove(id: number) {
    ensureListeners()
    // 先乐观更新本地列表，失败会在 error 提示，之后可考虑回滚（这里简化处理）
    list.value = list.value.filter((a) => a.id !== id)
    const uuid = user.value?.uuid
    if (!uuid) return
    emitCharacterAffixRemove({ characterUuid: uuid, id })
  }

  function removeMany(ids: number[]) {
    ensureListeners()
    const uuid = user.value?.uuid
    if (!uuid || !Array.isArray(ids) || ids.length === 0) return
    // 乐观更新本地列表
    const toRemove = new Set(ids)
    list.value = list.value.filter((a) => !toRemove.has(a.id!))
    emitCharacterAffixRemoveMany({ characterUuid: uuid, ids })
  }

  function reroll(id: number, version?: number) {
    ensureListeners()
    const uuid = user.value?.uuid
    if (!uuid) return
    emitCharacterAffixReroll({ characterUuid: uuid, id, version })
  }

  function rerollUp(id: number, version?: number) {
    ensureListeners()
    const uuid = user.value?.uuid
    if (!uuid) return
    emitCharacterAffixRerollUp({ characterUuid: uuid, id, version })
  }

  function upgradeRarity(id: number, version?: number) {
    ensureListeners()
    const uuid = user.value?.uuid
    if (!uuid) return
    emitCharacterAffixUpgradeRarity({ characterUuid: uuid, id, version })
  }

  async function expandOwned(schemeId?: 'schemeA' | 'schemeB' | 'schemeC') {
    ensureListeners()
    const uuid = user.value?.uuid
    if (!uuid || expanding.value) return
    expanding.value = true
    emitCharacterAffixExpandOwned({ characterUuid: uuid, schemeId })
  }

  async function expandActive(schemeId?: 'schemeA' | 'schemeB') {
    ensureListeners()
    const uuid = user.value?.uuid
    if (!uuid || expanding.value) return
    expanding.value = true
    // This flow intentionally does NOT deduct resources - business logic hook is on server
    emitCharacterAffixExpandActive({ characterUuid: uuid, schemeId })
  }

  onMounted(() => {
    ensureListeners()
  })

  onBeforeUnmount(() => {
    while (disposers.length) {
      const off = disposers.pop()
      try { off && off() } catch {}
    }
  })

  return {
    list,
    loading,
    error,
    maxActive,
    maxOwned,
    schemeRemaining,
    schemeUsage,
    expanding,
    fetchList,
    roll,
    updateState,
    remove,
    removeMany,
    reroll,
    rerollUp,
    upgradeRarity,
    expandOwned,
    expandActive,
    schemeLimitMessage,
  }
}
