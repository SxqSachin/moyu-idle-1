import type { Guild } from "~/generated/prisma"
import type { CharacterEquipmentInfo, } from "~/shared/types/characterInfo"
import type { Kitty } from "~/shared/types/kitty"
import type { UserProfile } from "~/shared/types/profile"

export const useGuildProfileInfo = () => {
  return useState<Record<string, Partial<Guild>>>('guildProfile', () => {
    return {}
  })
}