import type { allAvatarBorder, allBattleStyle, allChatBubbleStyle, allProfileStyle } from "../data/allStyle";

export type GameUserCustomStyle = {
  availableBattleCardStyles: (keyof typeof allBattleStyle | "")[];
  currentBattleCardStyle: (keyof typeof allBattleStyle | "");

  availableProfileStyles: (keyof typeof allProfileStyle | "")[];
  currentProfileStyle: (keyof typeof allProfileStyle | "");

  availableChatContentStyles: string[];
  currentChatContentStyle: string;
  availableChatNameStyles: string[];
  currentChatNameStyle: string;

  availableChatBubbleStyles: (keyof typeof allChatBubbleStyle | "")[];
  currentChatBubbleStyle: (keyof typeof allChatBubbleStyle | "");

  availableAvatarBorders:(keyof typeof allAvatarBorder | "")[];
  currentAvatarBorder: (keyof typeof allAvatarBorder | "");

  diyChatBubbleStyle?: {
    bgColor: string[];
    textColor: string[];
    textShadow: {color: string, blur: number}[];
  };
}