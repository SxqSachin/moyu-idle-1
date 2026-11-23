import type { CharacterEquipmentInfo, } from "~/shared/types/characterInfo"
import type { Kitty } from "~/shared/types/kitty"
import type { UserProfile } from "~/shared/types/profile"

export const useKittyProfileInfo = () => {
  return useState<Record<string, Kitty>>('kittyProfile', () => {
    return {}
  })
}