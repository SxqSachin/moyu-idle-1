import type { CharacterEquipmentInfo, } from "~/shared/types/characterInfo"

export const useCharacterEquipment= () => {
  return useState<CharacterEquipmentInfo>('characterEquipmentInfo', () => {
    return {}
  })
}

export const useCharacterWorkEquipment= () => {
  return useState<CharacterEquipmentInfo>('characterWorkEquipmentInfo', () => {
    return {}
  })
}