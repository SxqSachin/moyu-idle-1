import type { CharacterEquipmentInfo, } from "~/shared/types/characterInfo"
import type { UserProfile } from "~/shared/types/profile"

export const useUserProfileInfo = () => {
  return useState<Record<string, UserProfile>>('userProfile', () => {
    return {}
  })
}