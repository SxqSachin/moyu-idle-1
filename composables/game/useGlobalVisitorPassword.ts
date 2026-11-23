import { type CharacterInventory } from "~/shared/types/gameInventory"

export const useGlobalVisitorPassword = () => {
  return useState<string>('visitorPassword', () => {
    return ""
  })
}