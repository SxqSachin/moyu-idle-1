import type { BattleRoom } from "~/shared/types/battleRoom"
import type { KittyExpeditionTeamInGame } from "~/shared/types/kittyExpedition"

export const useMyKittyExpeditionInfo = () => {
  return useState<{
    [kittyUuid: string]: KittyExpeditionTeamInGame | null
  }>('myKittyExpeditionInfo', () => {
    return {}
  })
}