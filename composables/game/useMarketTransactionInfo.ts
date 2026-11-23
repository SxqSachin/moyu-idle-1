import type { CharacterBuildingInfo } from "~/shared/types/building"
import type { MarketTradeInfo } from "~/shared/types/market"

export const useMarketTransactionInfo = () => {
  return useState<Omit<MarketTradeInfo, 'buyerInfo'>[]>('marketTransactionInfo', () => {
    return []
  })
}