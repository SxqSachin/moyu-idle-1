import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket"
import type { CharacterInitData } from "~/shared/types/game"
import type { GameSocketData } from "~/shared/types/socket"

// 请求当前有效房间数量
export function emitGameCurrentPlayerCount() {
    emitEventToServer("game:currentPlayerCount")
}

// 监听房间数量返回
export const onGetGameCurrentPlayerCountSuccess = registerSocketEventListener<any>("game:currentPlayerCount:success")

// 监听房间数量错误
export const onGetGameCurrentPlayerCountError = registerSocketEventListener<{ message: string }>("game:currentPlayerCount:error")

export const onGetCharacterInitDataSuccess = registerSocketEventListener<{data: CharacterInitData}>("characterInitData")

export const onRateLimitTriggered = registerSocketEventListener<void>('rate_limited')
