import type { BattleInfo } from "~/shared/types/battle"

export const useBattleInfo = () => {
  return useState<BattleInfo | undefined>('battleInfo', () => {
    return undefined
  })
}