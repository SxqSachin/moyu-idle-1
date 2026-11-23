import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { CharacterEquipmentOutfitInGame, CharacterEquipmentType, CharacterEquipmentInfo, CharacterSkillOutFitInGame } from "~/shared/types/characterInfo";

// 创建配装方案
export function emitCreateOutfit(name: string, type: CharacterEquipmentType, equipment: CharacterEquipmentInfo, actionIdList: string[]) {
  emitEventToServer("outfit:create", { name, type, equipment, actionIdList });
}
export const onCreateOutfitSuccess = registerSocketEventListener<{ outfit: CharacterEquipmentOutfitInGame }>("outfit:create:success");
export const onCreateOutfitFail = registerSocketEventListener<{ message: string }>("outfit:create:fail");

// 应用配装方案
export function emitApplyOutfit(outfitUuid: string, type: CharacterEquipmentType) {
  emitEventToServer("outfit:apply", { outfitUuid, type });
}
export const onApplyOutfitSuccess = registerSocketEventListener<{ equipment: CharacterEquipmentInfo }>("outfit:apply:success");
export const onApplyOutfitFail = registerSocketEventListener<{ message: string }>("outfit:apply:fail");

// 修改配装方案
export function emitUpdateOutfit(outfitUuid: string, equipment: Partial<CharacterEquipmentInfo>, actionIdList: string[]) {
  emitEventToServer("outfit:update", { outfitUuid, equipment, actionIdList });
}
export const onUpdateOutfitSuccess = registerSocketEventListener<{ outfit: CharacterEquipmentOutfitInGame }>("outfit:update:success");
export const onUpdateOutfitFail = registerSocketEventListener<{ message: string }>("outfit:update:fail");

// 删除配装方案
export function emitDeleteOutfit(outfitUuid: string) {
  emitEventToServer("outfit:delete", { outfitUuid });
}
export const onDeleteOutfitSuccess = registerSocketEventListener<{ outfitUuid: string }>("outfit:delete:success");
export const onDeleteOutfitFail = registerSocketEventListener<{ message: string }>("outfit:delete:fail");

// 查询所有配装方案
export function emitGetAllOutfits(type?: CharacterEquipmentType) {
  emitEventToServer("outfit:getAll", { type });
}
export const onGetAllOutfitsSuccess = registerSocketEventListener<{ outfits: CharacterEquipmentOutfitInGame[] }>("outfit:list:success");
export const onGetAllOutfitsFail = registerSocketEventListener<{ message: string }>("outfit:list:fail");



export function emitGetAllSkillOutfit() {
  emitEventToServer("skillOutfit:list");
}
export const onGetAllSkillOutfitSuccess = registerSocketEventListener<{ outfits: CharacterSkillOutFitInGame[] }>("skillOutfit:list:success");
export const onGetAllSkillOutfitFail = registerSocketEventListener<{ message: string }>("skillOutfit:list:fail");

export function emitSaveCurrentSkillAsOutfit(name: string) {
  emitEventToServer("skillOutfit:saveCurrent", { name });
}
export const onSaveCurrentSkillAsOutfitSuccess = registerSocketEventListener<{ outfit: CharacterSkillOutFitInGame[] }>("skillOutfit:saveCurrent:success");
export const onSaveCurrentSkillAsOutfitFail = registerSocketEventListener<{ message: string }>("skillOutfit:saveCurrent:fail");

export function emitApplySkillOutfit(outfitUuid: string) {
  emitEventToServer("skillOutfit:apply", { outfitUuid });
}
export const onApplySkillOutfitSuccess = registerSocketEventListener<void>("skillOutfit:apply:success");
export const onApplySkillOutfitFail = registerSocketEventListener<{ message: string }>("skillOutfit:apply:fail");

export function emitDeleteSkillOutfit(outfitUuid: string) {
  emitEventToServer("skillOutfit:delete", { outfitUuid });
}
export const onDeleteSkillOutfitSuccess = registerSocketEventListener<{ outfit: CharacterSkillOutFitInGame[] }>("skillOutfit:delete:success");
export const onDeleteSkillOutfitFail = registerSocketEventListener<{ message: string }>("skillOutfit:delete:fail");