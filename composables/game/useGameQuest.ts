import type { Quest } from "~/shared/types/quest"

export const useGameQuest = () => {
  return useState<Quest[]>('quest', () => [])
}