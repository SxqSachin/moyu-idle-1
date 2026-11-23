import type { GameUserUniqueFlag } from "~/shared/types/gameEffect"

export const useUniqueFlag = () => {
  return useState<GameUserUniqueFlag[]>('uniqueFlag', () => [])
}

export const useDecorate9UnlockFlag = () => {
  const state = useUniqueFlag();

  const unlocked =  state.value.find(f => f.key == 'unlock_9' && f.type == 'decorate_unlock');

  return { unlocked: !!unlocked }
}