import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket"
import type { CharacterBuildingInfo } from "~/shared/types/building";

// 请求角色建筑信息
export function emitRequestCharacterBuildingInfo() {
    emitEventToServer("requestCharacterBuildingInfo")
}

// 监听角色建筑信息下发
export const onDispatchCharacterBuildingInfo = registerSocketEventListener<CharacterBuildingInfo>("dispatchCharacterBuildingInfo")