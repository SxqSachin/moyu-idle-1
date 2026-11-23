import type { CharacterBuildingInfo } from "~/shared/types/building"

export const useCharacterBuildingInfo = () => {
  return useState<CharacterBuildingInfo>('building', () => {
    return {}
  })
}