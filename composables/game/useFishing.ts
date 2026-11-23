import { ref, onUnmounted } from 'vue'
import { ElNotification } from 'element-plus'
import {
  emitStartFishing,
  emitGetMyActiveSession,
  emitGetMyBaitAreas,
  emitGetBaitAreas,
  emitEndFishing,
  onStartFishingSuccess,
  onStartFishingFail,
  onNearbyFishingPlayers,
  onGetBaitAreasSuccess,
  onGetBaitAreasFail,
  onGetMyBaitAreasSuccess,
  onGetMyBaitAreasFail,
  onGetMyActiveSession,
  onGetMyActiveSessionFail,
  onEndFishingSuccess,
  onEndFishingFail,
  emitSellCaughtFishBatch,
  onSellCaughtFishBatchSuccess,
  onSellCaughtFishBatchFail,
} from '~/api/game/socket/fishing'
import {
  type FishingSessionDTO,
  type ActiveSession,
  type NearbyPlayer,
  type CaughtFishDTO,
  type BatchSellCaughtFishSuccessPayload,
  type SellCaughtFishReceipt,
  type FishingBaitAreaDTO,
  type NearbyBaitAreaDTO,
} from '~/shared/types/fishing'
import { allFishSpecies, type AllFishSpeciesID } from '~/shared/data/allFishSpecies'

export function useFishing() {
  const nearbyPlayers = ref<NearbyPlayer[]>([])
  const hasActiveSession = ref(false)
  const myFullSession = ref<FishingSessionDTO | null>(null)
  const myActiveSession = ref<ActiveSession | null>(null)
  const baitAreasNearby = ref<NearbyBaitAreaDTO[]>([])
  const myBaitAreas = ref<FishingBaitAreaDTO[]>([])

  const unsubs: Array<() => void> = []

  // 注册监听并记录取消函数
  unsubs.push(onStartFishingSuccess((data) => {
    if (data?.active) {
      hasActiveSession.value = true
      myActiveSession.value = data.active
    }
    if (data?.nearbyPlayers) {
      const players = data.nearbyPlayers.map(p => ({ ...p, isSelf: p.userUuid === data.active?.userUuid }))
      nearbyPlayers.value = players
    }
  }))

  unsubs.push(onStartFishingFail((err) => {
    if (process.client) ElNotification({ title: '开始垂钓失败', message: err?.message || String(err), type: 'error', duration: 1500 })
  }))

  unsubs.push(onNearbyFishingPlayers((payload) => {
    if (payload?.players) nearbyPlayers.value = payload.players
  }))

  unsubs.push(onGetBaitAreasSuccess((payload) => {
    if (!payload) return
    baitAreasNearby.value = payload.nearby ?? []
    myBaitAreas.value = payload.mine ?? []
  }))

  unsubs.push(onGetBaitAreasFail((err) => {
    if (process.client) ElNotification({ title: '获取打窝信息失败', message: err?.message || String(err), type: 'error', duration: 1500 })
  }))

  unsubs.push(onGetMyBaitAreasSuccess((payload) => {
    if (!payload) return
    myBaitAreas.value = payload.mine ?? []
  }))

  unsubs.push(onGetMyBaitAreasFail((err) => {
    if (process.client) ElNotification({ title: '获取我的打窝失败', message: err?.message || String(err), type: 'error', duration: 1500 })
  }))

  unsubs.push(onGetMyActiveSession((payload) => {
    if (payload?.active) {
      hasActiveSession.value = true
      myActiveSession.value = payload.active ?? null

      myFullSession.value = payload.session;
    } else {
      hasActiveSession.value = false
      myActiveSession.value = null

      myFullSession.value = payload.session;
    }


    if (payload?.nearbyPlayers) {
      const players = payload.nearbyPlayers.map(p => ({ ...p, isSelf: p.userUuid === payload.active?.userUuid }))
      nearbyPlayers.value = players
    }
  }))

  unsubs.push(onGetMyActiveSessionFail((err) => {
    if (process.client) ElNotification({ title: '获取活跃会话失败', message: err?.message || String(err), type: 'error', duration: 1500 })
  }))

  unsubs.push(onEndFishingSuccess((payload) => {
    // 清理本地活跃状态并移除自身标记
    hasActiveSession.value = false
    myActiveSession.value = null
    nearbyPlayers.value = []
    // 清理其他玩家的 bait areas，保留自己的 bait areas
    baitAreasNearby.value = []
  }))

  unsubs.push(onEndFishingFail((err) => {
    if (process.client) ElNotification({ title: '结束钓鱼失败', message: err?.message || String(err), type: 'error', duration: 1500 })
  }))

  onUnmounted(() => {
    for (const u of unsubs) {
      try { u() } catch (e) { /* ignore */ }
    }
  })

  function startFishing(payload: { pointX: number; pointY: number; pondId?: string | null; characterUuid?: string | null; toolConfig?: Record<string, unknown> | null }) {
    emitStartFishing(payload)
  }

  function getMyActiveSession() {
    emitGetMyActiveSession()
  }

  function getBaitAreas(point: { pointX: number; pointY: number }) {
    if (!point || typeof point.pointX !== 'number' || typeof point.pointY !== 'number') return
    try {
      emitGetBaitAreas({ pointX: point.pointX, pointY: point.pointY })
    } catch (e) {
      if (process.client) ElNotification({ title: '获取打窝失败', message: String(e), type: 'error', duration: 1500 })
    }
  }

  function getMyBaitAreas() {
    try {
      emitGetMyBaitAreas()
    } catch (e) {
      if (process.client) ElNotification({ title: '获取我的打窝失败', message: String(e), type: 'error', duration: 1500 })
    }
  }

  function endFishing() {
    emitEndFishing()
  }

  // 计算单条鱼获的出售金额（与后端保持一致）
  function calculateCaughtFishSellValue(fish: CaughtFishDTO): number {
    const species = allFishSpecies[fish.fishId as AllFishSpeciesID]
    const base = species?.shopBaseRecallPrice ?? 0
    const lengthBonus = (species?.extraPriceForEachLength ?? 0) * (fish.length ?? 0)
    const weightBonus = (species?.extraPriceForEachWeight ?? 0) * (fish.weight ?? 0)
    const qualityBonus = (species?.extraPriceForEachQuality ?? 0) * (fish.quality ?? 0)

    return Math.max(0, Math.floor(base + lengthBonus + weightBonus + qualityBonus))
  }

  function getCaughtFishSellBreakdown(fish: CaughtFishDTO): {
    basePrice: number
    lengthBonus: number
    weightBonus: number
    qualityBonus: number
    total: number
  } {
    const species = allFishSpecies[fish.fishId as AllFishSpeciesID]
    const basePrice = +(species?.shopBaseRecallPrice ?? 0).toFixed(2)
    const lengthBonus = +( ((species?.extraPriceForEachLength ?? 0) * (fish.length ?? 0)).toFixed(2) )
    const weightBonus = +( ((species?.extraPriceForEachWeight ?? 0) * (fish.weight ?? 0)).toFixed(2) )
    const qualityBonus = +( ((species?.extraPriceForEachQuality ?? 0) * (fish.quality ?? 0)).toFixed(2) )
    const total = Math.max(0, Math.floor(basePrice + lengthBonus + weightBonus + qualityBonus))

    return { basePrice, lengthBonus, weightBonus, qualityBonus, total }
  }

  function buildBatchSellPreview(fishes: CaughtFishDTO[]): { receipts: SellCaughtFishReceipt[]; totalAmount: number } {
    const receipts: SellCaughtFishReceipt[] = []
    let totalAmount = 0

    for (const fish of fishes) {
      const amount = calculateCaughtFishSellValue(fish)
      receipts.push({
        caughtFishId: fish.id,
        fishId: fish.fishId as AllFishSpeciesID,
        length: fish.length ?? 0,
        weight: fish.weight ?? null,
        quality: fish.quality ?? null,
        amount,
      })
      totalAmount += amount
    }

    return { receipts, totalAmount }
  }

  function sellCaughtFishBatch(caughtFishIds: number[]): Promise<BatchSellCaughtFishSuccessPayload> {
    if (!Array.isArray(caughtFishIds) || caughtFishIds.length === 0) {
      return Promise.reject(new Error('没有可出售的鱼获'))
    }

    return new Promise((resolve, reject) => {
      const offSuccess = onSellCaughtFishBatchSuccess((payload) => {
        offSuccess()
        offFail()
        resolve(payload)
      })

      const offFail = onSellCaughtFishBatchFail((payload) => {
        offSuccess()
        offFail()
        reject(new Error(payload?.message || '批量出售失败'))
      })

      try {
        emitSellCaughtFishBatch({ caughtFishIds })
      } catch (e) {
        offSuccess()
        offFail()
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  }

  return {
    nearbyPlayers,
    hasActiveSession,
    myActiveSession,
    myFullSession,
    baitAreasNearby,
    myBaitAreas,
    startFishing,
    getMyActiveSession,
    getBaitAreas,
    getMyBaitAreas,
    endFishing,
    calculateCaughtFishSellValue,
    getCaughtFishSellBreakdown,
    buildBatchSellPreview,
    sellCaughtFishBatch,
  }
}

export default useFishing
