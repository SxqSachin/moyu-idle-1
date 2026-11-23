import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";
import type { GameSocketData } from "~/shared/types/socket";
import type { CharacterEquipActionInfo, CharacterEquipmentInfo, CharacterUnequipActionInfo } from "~/shared/types/characterInfo";

// 装备物品
export function emitEquipItem(info: CharacterEquipActionInfo) {
    emitEventToServer("effectAction:equipItem", info);
}

// 监听装备物品成功
export const onEquipItemSuccess = registerSocketEventListener<{ equipment: CharacterEquipmentInfo, info: CharacterEquipActionInfo }>("effectAction:equip:success");

// 监听装备物品失败
export const onEquipItemError = registerSocketEventListener<{ message: string }>("effectAction:equip:error");

// 卸下装备
export function emitUnequipItem(info: CharacterUnequipActionInfo) {
    emitEventToServer("effectAction:unequipItem", info);
}

// 监听卸下装备成功
export const onUnequipItemSuccess = registerSocketEventListener<CharacterEquipmentInfo>("effectAction:unequip:success");
export const onUnequipItemError = registerSocketEventListener<{message: string}>("effectAction:unequip:error");