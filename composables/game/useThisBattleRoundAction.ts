import type { BattleInfo, FullBattleAction } from "~/shared/types/battle"

export const useThisBattleRoundAction = () => {
  return useState<Pick<FullBattleAction, 'sourceUnitUuid'> | undefined>('thisBattleRoundAction', () => undefined)
}