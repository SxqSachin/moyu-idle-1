import type { AllUnitStatusType, CharacterStatusInfo } from "~/shared/types/characterInfo"
import { allCharacterStatus } from "~/shared/data/allCharacterStatus"

export const useCharacterStatusInfo = () => {
  return useState<CharacterStatusInfo>('characterStatusInfo', () => {
    // 初始化所有属性为0
    const status: CharacterStatusInfo = {} as CharacterStatusInfo
    Object.keys(allCharacterStatus).forEach(key => {
      status[key as AllUnitStatusType] = {
        level: 1,
        currentExp: 0
      }
    })
    return status
  })
}