import type { GameTask } from "~/shared/types/gameTask"

export const useKittyTaskQueue = () => {
  return useState<Record<string, GameTask[]>>('kittyTaskQueue', () => ({}))
}