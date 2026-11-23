import type { BattleInfo } from "~/shared/types/battle"
import type { GameGuild } from "~/shared/types/guild"

export const useMyGuild = () => {
  return useState<GameGuild | null>('myGuild', () => {
    return null 
  })
}