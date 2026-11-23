import type { BattleRoom } from "~/shared/types/battleRoom"

export const useCurrentBattleRoom = () => {
  return useState<BattleRoom | null>('currentBattleRoom', () => {
    return null
  })
}