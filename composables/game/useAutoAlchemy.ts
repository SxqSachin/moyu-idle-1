import { onMounted, onUnmounted, computed } from 'vue'
import { waitUtilConnected } from '~/api/game/socket/socket'
import {
  emitCreateAutoAlchemy,
  emitGetCurrentAutoAlchemy,
  emitCancelAutoAlchemy,
  onCreateAutoAlchemyFail,
  onCreateAutoAlchemySuccess,
  onAutoAlchemyError,
  onAutoAlchemyFinished,
  onAutoAlchemyProgress,
  onAutoAlchemyCancelled,
  onGetCurrentAutoAlchemyFail,
  onGetCurrentAutoAlchemySuccess,
} from '~/api/game/socket/alchemy'
import type { ItemCountInfo } from '~/shared/types/gameInventory'
import type { FuncAction } from '~/shared/types'

// 声明全局通知（项目中已全局注入 ElementPlus 的 ElNotification）
// 避免 TS 报错，这里声明为 any；在运行期由全局注入
declare const ElNotification: any

export type AutoAlchemyStatus = 'PENDING' | 'PROCESSING' | 'FINISHED' | 'ERROR' | 'CANCELLED'

export type AutoAlchemyRecord = {
  uuid: string
  recipeId: string
  recipeIndex: number
  targetTimes: number
  doneTimes: number
  status: AutoAlchemyStatus
  allUsedItems: ItemCountInfo
  allRewardItems: ItemCountInfo
  lastError?: string
  createdAt: string
  updatedAt: string
}

export const useAutoAlchemy = () => {
  // 统一的全局状态（跨组件共享）
  const currentAuto = useState<AutoAlchemyRecord | null>('autoAlchemy:current', () => null)
  const doingAuto = useState<boolean>('autoAlchemy:doing', () => false)
  const autoTimes = useState<number>('autoAlchemy:autoTimes', () => 10)
  const maxAutoTimes = 1000

  // 事件解绑句柄
  let offList: FuncAction[] = []

  const autoStatusLabel = computed(() => {
    if (!currentAuto.value) return '无任务'
    switch (currentAuto.value.status) {
      case 'PENDING':
      case 'PROCESSING':
        return '进行中'
      case 'FINISHED':
        return '已完成'
      case 'ERROR':
        return '错误'
      case 'CANCELLED':
        return '已取消'
      default:
        return currentAuto.value.status
    }
  })

  const refreshCurrent = () => {
    emitGetCurrentAutoAlchemy()
  }

  const createAutoAlchemy = (input: ItemCountInfo, times: number) => {
    if (doingAuto.value) return
    doingAuto.value = true
    emitCreateAutoAlchemy(input, times)
  }

  const registerListeners = () => {
    // 避免重复注册：若已存在解绑函数，先解绑
    if (offList.length) {
      offList.forEach(fn => fn?.())
      offList = []
    }

    offList.push(
      onCreateAutoAlchemySuccess(() => {
        doingAuto.value = false
        ElNotification?.({ title: '自动炼金已创建', type: 'success' })
        refreshCurrent()
      }),
      onCreateAutoAlchemyFail((data) => {
        doingAuto.value = false
        ElNotification?.({ title: '创建失败', message: data.msg, type: 'error' })
      }),
      onAutoAlchemyProgress((data) => {
        if (!currentAuto.value || currentAuto.value.uuid !== data.uuid) return
        currentAuto.value.doneTimes = data.doneTimes
        currentAuto.value.targetTimes = data.targetTimes
        currentAuto.value.allRewardItems ||= {}
        for (const k in data.lastReward) {
          const c = data.lastReward[k]
          if (!c) continue
          if (!currentAuto.value.allRewardItems[k]) currentAuto.value.allRewardItems[k] = { count: 0 }
          currentAuto.value.allRewardItems[k].count += c.count
        }
        currentAuto.value.status = 'PROCESSING'
      }),
      onAutoAlchemyFinished((data) => {
        if (!currentAuto.value || currentAuto.value.uuid !== data.uuid) return
        currentAuto.value.doneTimes = data.doneTimes
        currentAuto.value.allRewardItems = data.allRewardItems
        currentAuto.value.allUsedItems = data.allUsedItems
        currentAuto.value.status = 'FINISHED'
        ElNotification?.({ title: '自动炼金完成', type: 'success' })
      }),
      onAutoAlchemyError((data) => {
        if (!currentAuto.value || currentAuto.value.uuid !== data.uuid) return
        currentAuto.value.status = 'ERROR'
        currentAuto.value.lastError = data.msg
        ElNotification?.({ title: '自动炼金出错', message: data.msg, type: 'error' })
      }),
      onGetCurrentAutoAlchemySuccess((data) => {
        const normalize = (r: any): AutoAlchemyRecord => ({
          ...r,
          status: (['PENDING','PROCESSING','FINISHED','ERROR','CANCELLED'].includes(r?.status) ? r.status : 'ERROR') as AutoAlchemyStatus,
        })
        currentAuto.value = data.current ? normalize(data.current) : null
      }),
      onGetCurrentAutoAlchemyFail((data) => {
        console.warn('获取当前自动炼金失败', data.msg)
      }),
      onAutoAlchemyCancelled((data) => {
        if (!data.ok) {
          ElNotification?.({ title: '取消失败', message: data.msg, type: 'error' })
          return
        }
        if (currentAuto.value && currentAuto.value.uuid === data.uuid) {
          currentAuto.value = null
        }
        ElNotification?.({ title: '已取消炼金', type: 'info' })
      })
    )
  }

  onMounted(async () => {
    // 仅在客户端注册 socket 监听
    // 等待 socket 连接就绪再发起首次查询
    await waitUtilConnected()
    registerListeners()
    refreshCurrent()
  })

  onUnmounted(() => {
    // 清理监听，避免重复注册
    offList.forEach(fn => fn?.())
    offList = []
  })

  return {
    // state
    currentAuto,
    doingAuto,
    autoTimes,
    maxAutoTimes,
    autoStatusLabel,
    // actions
    createAutoAlchemy,
    refreshCurrent,
    cancelAutoAlchemy: (uuid?: string) => emitCancelAutoAlchemy(uuid ?? currentAuto.value?.uuid),
  }
}