import type { GameTask } from "~/shared/types/gameTask"

export const useTaskQueue = () => {
  return useState<GameTask[]>('taskQueue', () => [])
}