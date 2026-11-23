export const useIsBeginner = () => {
  return useState<boolean>('isBeginner', () => false)
}