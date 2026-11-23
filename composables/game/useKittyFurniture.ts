import type { UserKittyFurnitureInstance } from "~/shared/types/kittyFurniture"

export const useKittyFurniture = () => {
  return useState<UserKittyFurnitureInstance[]>('allKittyFurniture', () => {
    return []
  })
}