import type { PlayerProfileInfo } from "~/shared/types/characterInfo"
export const usePlayerProfile = () => {
  // @ts-ignore
  return useState<PlayerProfileInfo>('playerProfile', () => {
    return {
      name: "",
      avatar: "avatar_1",
      createDate: new Date(0)
    }
  })
}