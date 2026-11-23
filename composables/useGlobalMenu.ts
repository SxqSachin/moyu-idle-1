import { watch, ref } from 'vue'

/**
 * 全局菜单选中与延迟请求逻辑。
 * 语义：插件或任意位置可以调用 requestMenu('updateLog') 来请求首页切换；
 * 首页加载后 watchPendingMenu 会在合适时机（可加条件）执行并消费。
 */
export function usePendingMenu() {
  return useState<string | null>('pendingMenu', () => null)
}

/**
 * 请求切换菜单（幂等：会覆盖之前尚未消费的 pendingMenu）
 */
export function requestMenu(menu: string) {
  const pending = usePendingMenu()
  pending.value = menu
}

/**
 * 首页调用：监听 pendingMenu，当满足条件时进行消费。
 * condition: 可选，返回 true 时才真正切换。
 * onConsume: 实际执行（例如修改 currentSelectMenuIndex）
 */
export function watchPendingMenu(onConsume: (menu: string) => void, condition?: () => boolean) {
  const pending = usePendingMenu()

  const tryConsume = () => {
    const m = pending.value
    if (!m) return
    if (condition && !condition()) return
    onConsume(m)
    pending.value = null
  }

  // 监听 pending 本身（包括首次 immediate 场景）
  watch(pending, () => {
    tryConsume()
  }, { immediate: true })

  // 如果有 condition，再单独监听 condition 的结果变化（例如 gameInited 后变 true）
  if (condition) {
    watch(() => condition(), () => {
      tryConsume()
    })
  }
}
