import type { FTChatMessageMeta } from "~/shared/types/chatMsgType"
import type { GameTask } from "~/shared/types/gameTask"

export const useFTCurrentChatMsg = () => {
  return useState<FTChatMessageMeta | null>('ftChatMsgMeta', () => null)
}