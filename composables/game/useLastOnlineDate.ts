export const useLastOnlineDate = () => {
  return useState<Date>('lastOnlineDate', () => new Date())
}