import { type CharacterInventory } from "~/shared/types/gameInventory"

export const useIronCat = () => {
  return useState<boolean>('ironCat', () => {
    return false
  })
}