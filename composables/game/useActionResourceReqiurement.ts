import { defaultAllGameActionDurationDetail, defaultAllGameActionResourceRequirementDetail } from "~/shared/data/allGameActions"
import type { AllGameActionDurationDetail, AllGameActionResourceRequirementDetail } from "~/shared/types/gameAction"
import { clone } from "~/shared/utils"

export const useActionResourceReqiurement = () => {
  return useState<AllGameActionResourceRequirementDetail>('allGameActionResourceRequirementDetail', () => {
    return clone(defaultAllGameActionResourceRequirementDetail)
  })
}