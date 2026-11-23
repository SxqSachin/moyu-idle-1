import { ref, computed } from 'vue'
import {
  emitBlockUser,
  emitUnblockUser,
  emitGetBlockList,
  onBlockSuccess,
  onUnblockSuccess,
  onBlockError,
  onUnblockError,
  onGetBlockListSuccess,
  onGetBlockListError
} from '@/api/game/socket/chat'

interface BlockListRaw { all: string[]; public: string[] }

const _all = ref<string[]>([])
const _public = ref<string[]>([])
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const pending = ref<Set<string>>(new Set())

const UUID_REGEX = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/

function validateLocalUuid(raw: string): { ok: boolean; reason?: string; normalized?: string } {
  if (!raw) return { ok: false, reason: 'UUID不能为空' }
  const t = raw.trim()
  if (!t) return { ok: false, reason: 'UUID不能为空' }
  if (t.length > 64) return { ok: false, reason: 'UUID过长' }
  if (!UUID_REGEX.test(t)) return { ok: false, reason: 'UUID格式不正确' }
  return { ok: true, normalized: t.toLowerCase() }
}

let inited = false

function ensureInit() {
  if (inited) return
  inited = true

  onGetBlockListSuccess(({ list }) => {
    _all.value = list.all || []
    _public.value = list.public || []
    loading.value = false
  })
  onGetBlockListError(({ message }) => {
    errorMsg.value = message
    loading.value = false
  })

  onBlockSuccess(({ targetUuid }) => {
    if (!_all.value.includes(targetUuid) && !_public.value.includes(targetUuid)) {
      _public.value.push(targetUuid)
    }
  })
  onUnblockSuccess(({ targetUuid }) => {
    _all.value = _all.value.filter(u => u !== targetUuid)
    _public.value = _public.value.filter(u => u !== targetUuid)
  })

  onBlockError(({ message }) => { errorMsg.value = message })
  onUnblockError(({ message }) => { errorMsg.value = message })
}

export function useChatBlock() {
  ensureInit()

  function refresh() {
    loading.value = true
    emitGetBlockList()
  }

  function block(targetUuid: string) {
    const { ok, reason, normalized } = validateLocalUuid(targetUuid)
    if (!ok || !normalized) {
      errorMsg.value = reason || 'UUID不合法'
      return
    }
    if (mergedSet.value.has(normalized)) {
      errorMsg.value = '已屏蔽该玩家'
      return
    }
    if (pending.value.has(normalized)) {
      return
    }
    pending.value.add(normalized)
    emitBlockUser(normalized)
    // 简单超时清理，避免异常阻塞
    setTimeout(() => pending.value.delete(normalized), 8000)
  }

  function unblock(targetUuid: string) {
    const { ok, normalized } = validateLocalUuid(targetUuid)
    if (!ok || !normalized) return
    if (pending.value.has(normalized)) return
    pending.value.add(normalized)
    emitUnblockUser(normalized)
    setTimeout(() => pending.value.delete(normalized), 8000)
  }

  const mergedSet = computed(() => new Set([..._all.value, ..._public.value]))
  const totalCount = computed(() => mergedSet.value.size)

  return {
    all: _all,
    publicOnly: _public,
    mergedSet,
    totalCount,
    loading,
    errorMsg,
    refresh,
    block,
    unblock,
  }
}
