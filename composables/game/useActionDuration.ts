import { defaultAllGameActionDurationDetail } from "~/shared/data/allGameActions"
import type { AllGameActionDurationDetail } from "~/shared/types/gameAction"
import { clone } from "~/shared/utils"

export const useActionDuration = () => {
  return useState<AllGameActionDurationDetail>('allActionDurationDetail', () => {
    return clone(defaultAllGameActionDurationDetail)
  })
}