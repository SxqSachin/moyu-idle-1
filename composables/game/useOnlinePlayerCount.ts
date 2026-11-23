import type { GameTask } from "~/shared/types/gameTask"

export const useOnlinePlayerCount = () => {
  return useState<number>('onlinePlayerCount', () => 0)
}