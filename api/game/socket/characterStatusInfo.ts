import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket"
import type { GameSocketData } from "~/shared/types/socket";
import type { CharacterStatusInfo } from "~/shared/types/characterInfo";

// 请求自己的角色状态信息
export function emitRequestCharacterStatusInfo() {
    emitEventToServer("requestCharacterStatusInfo")
}

// 监听自己的角色状态信息下发
export const onDispatchCharacterStatusInfo = registerSocketEventListener<CharacterStatusInfo>("dispatchCharacterStatusInfo")

// 监听角色状态升级
export const onCharacterStatusLevelUpgrade = registerSocketEventListener<Partial<CharacterStatusInfo>>("characterStatusLevelUpgrade")

// 请求目标角色状态信息
export function emitRequestTargetCharacterStatusInfo(uuid: string) {
    emitEventToServer("requestTargetCharacterStatusInfo", { uuid })
}

// 监听目标角色状态信息下发
export const onDispatchTargetCharacterStatusInfo = registerSocketEventListener<CharacterStatusInfo>("targetCharacterStatusInfo")