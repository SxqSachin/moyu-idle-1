import type { GameCharacterBattleSkillInfo } from "~/shared/types/skill"

export const useCharacterBattleSkills = () => {
  return useState<GameCharacterBattleSkillInfo[]>('characterBattleSkill', () => {
    return []
  })
}