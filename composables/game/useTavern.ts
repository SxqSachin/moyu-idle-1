import type { Tavern } from "~/generated/prisma"
import { defaultAllGameActionDurationDetail } from "~/shared/data/allGameActions"
import type { AllGameActionDurationDetail } from "~/shared/types/gameAction"
import { clone } from "~/shared/utils"

export const useTavern = () => {
  return useState<Tavern[]>('useTavern', () => {
    return []
  })
}

export const useWorkingTavern = () => {
  return useTavern().value.filter(tavern => tavern.state === 'WORKING')
}