import type { GameUserCustomStyle } from "~/shared/types/style"

export const useUserStyle = () => {
  return useState<GameUserCustomStyle>('userCustomStyle', () => {
    return {
      availableBattleCardStyles: [],
      currentBattleCardStyle: "",
      availableChatContentStyles: [],
      currentChatContentStyle: "",
      availableChatNameStyles: [],
      currentChatNameStyle: "",
      availableProfileStyles: [],
      currentProfileStyle: "",
      availableChatBubbleStyles: [],
      currentChatBubbleStyle: "",

      availableAvatarBorders: [],
      currentAvatarBorder: "",

      diyChatBubbleStyle: {
        bgColor: [],
        textColor: [],
        textShadow: [],
      }
    }
  })
}