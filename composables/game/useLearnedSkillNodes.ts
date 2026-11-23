import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { LearnedSkillFlatItem, SkillTreeId } from '~/shared/types/skillTree'
import { waitUtilConnected } from '~/api/game/socket/socket'
import { emitSkillTreeLearned, onSkillTreeLearnedSuccess, onSkillTreeLearnedFail } from '~/api/game/socket/skillTree'

// 全局缓存（所有实例共享）
const allLearned = ref<LearnedSkillFlatItem[]>([])
const isRequesting = ref(false)
const lastError = ref<string | null>(null)
let bound = false
const unsubs: (() => void)[] = []

function bindOnce() {
  if (bound) return
  bound = true
  unsubs.push(
    onSkillTreeLearnedSuccess(p => {
      allLearned.value = p.learned
      isRequesting.value = false
      lastError.value = null
    }),
    onSkillTreeLearnedFail(p => {
      lastError.value = p.msg || '获取已学习技能失败'
      isRequesting.value = false
    })
  )
}

export interface UseLearnedSkillNodesOptions {
  auto?: boolean // 组件挂载后是否自动请求
  characterUuid?: string
  treeIdFilter?: SkillTreeId | 'all'
  refreshOnMount?: boolean // 与 auto 合并：如果已有缓存也强制刷新
}

export function useLearnedSkillNodes(opts: UseLearnedSkillNodesOptions = {}) {
  const { auto = true, characterUuid, treeIdFilter = 'all', refreshOnMount = false } = opts

  function request() {
    if (isRequesting.value) return
    isRequesting.value = true
    emitSkillTreeLearned(characterUuid)
  }

  function getFiltered(): LearnedSkillFlatItem[] {
    if (treeIdFilter === 'all') return allLearned.value
    return allLearned.value.filter(l => l.treeId === treeIdFilter)
  }

  onMounted(async () => {
    await waitUtilConnected()
    bindOnce()
    if (auto) {
      if (refreshOnMount || allLearned.value.length === 0) request()
    }
  })

  onBeforeUnmount(() => {
    // 不卸载全局监听，保持缓存；如需卸载可提供 reset API
  })

  return {
    isRequesting,
    lastError,
    allLearned, // 原始完整列表
    learned: getFiltered(),
    request,
  }
}

// 可选的手动清空（未来需要时导出）
export function resetLearnedSkillNodesCache() {
  allLearned.value = []
  lastError.value = null
}
