import type { Guild } from "~/generated/prisma"
import type { CharacterEquipmentInfo, } from "~/shared/types/characterInfo"
import type { Kitty } from "~/shared/types/kitty"
import type { UserProfile } from "~/shared/types/profile"
import type { BaseVillageBuildingInfo } from "~/shared/types/village/building"

export const useNormalVillageBaseBuildingInfo = () => {
  return useState<BaseVillageBuildingInfo[]>('normalVillageBaseBuildingInfo', () => {
    return []
  })
}