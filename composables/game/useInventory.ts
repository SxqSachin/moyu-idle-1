import { type CharacterInventory } from "~/shared/types/gameInventory"

export const useInventory = () => {
  return useState<CharacterInventory>('inventory', () => {
    return {}
  })
}