export const useGameInited = () => {
  return useState<boolean>('gameInited', () => {
    return false
  })
}