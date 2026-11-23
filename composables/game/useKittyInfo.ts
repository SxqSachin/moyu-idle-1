import type { Kitty } from "~/shared/types/kitty"

export const useKittyInfo = () => {
  return useState<Kitty[]>('kitty', () => [])
}