import type { GameUserCustomStyle } from "~/shared/types/style"

export const useUserStyleStore = () => {
  return useState<Record<string, GameUserCustomStyle>>('userCustomStyleStore', () => {
    return { }
  })
}