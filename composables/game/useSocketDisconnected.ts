export const useSocketDisconnected = () => {
  return useState<boolean>('socketDisconnected', () => {
    return false
  })
}