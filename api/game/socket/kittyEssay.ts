import type { KittyEssayInfo } from "~/shared/types/kittyEssayInfo"
import { emitEventToServer, registerSocketEventListener } from "./socket"

export const emitGetKittyEssay = (kittyUuid: string, page: number = 1, pageSize: number = 20) => {
    emitEventToServer("kitty:getAllEssay", { kittyUuid, page, pageSize })
}

export type KittyEssayPaged = { items: KittyEssayInfo[]; total: number; page: number; pageSize: number }
export const onGetKittyAllEssaySuccess = registerSocketEventListener<KittyEssayPaged>("kitty:getAllEssay:success")
export const onGetKittyAllEssayError = registerSocketEventListener<{message: string}>("kitty:getAllEssay:error")
