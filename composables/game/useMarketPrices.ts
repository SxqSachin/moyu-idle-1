import { ref } from 'vue'

// Shape of market price data: assume { [resourceId: string]: { min: number, max: number } }
// The server endpoint returns { code, msg, data } where data is this mapping.

const pricesByResourceId = ref<Record<string, { 
    "itemId": string,
    "sellOrders": {
        "minPrice": number,
        "minPriceCount": number,
        "totalCount": number,
        "orderCount": number
    },
    "buyOrders": {
        "maxPrice": number,
        "maxPriceCount": number,
        "totalCount": number,
        "orderCount": number 
    },
    "lastUpdateTime": number
}>>({})
let initialized = false
let refreshTimer: NodeJS.Timeout | null = null

async function fetchPrices() {
  try {
    const res = await $fetch<{ code: number; msg: string; data: any }>(
      '/api/game/market/price',
      { method: 'GET' }
    )

    if (res && res.data?.items) {
      pricesByResourceId.value = res.data.items || {}
    }
  } catch (e) {
    console.error('fetch market prices failed', e)
  }
}

function init() {
  if (initialized) return
  initialized = true
  // client-only guard; Nuxt injects process.client
  if (typeof window === 'undefined') return

  // initial fetch
  fetchPrices()

  // 30 minutes refresh
  refreshTimer = setInterval(() => {
    fetchPrices()
  }, 15 * 60 * 1000)
}

function dispose() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  initialized = false
}

function getMinPrice(resourceId: string | undefined | null): number | undefined {
  if (!resourceId) return undefined
  const p = pricesByResourceId.value[resourceId]
  return p?.sellOrders?.minPrice
}

function getMaxBuyerOrderPrice(resourceId: string | undefined | null): number | undefined {
  if (!resourceId) return undefined
  const p = pricesByResourceId.value[resourceId]
  return p?.buyOrders?.maxPrice
}

export function useMarketPrices() {
  return {
    pricesByResourceId,
    init,
    dispose,
    fetchPrices,
    getMinPrice,
    getMaxBuyerOrderPrice,
  }
}
