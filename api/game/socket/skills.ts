import { emitEventToServer, registerSocketEventListener } from "./socket"
import type { GameBattleLogic, GameCharacterBattleSkillInfo, GameFullBattleLogic } from "~/shared/types/skill"

// 获取角色所有技能
export const emitGetCharacterBattleSkills = (characterUuid?: string) => {
    emitEventToServer("character:getSkills", { uuid: characterUuid })
}

// 监听获取技能成功
export const onGetCharacterBattleSkillsSuccess = registerSocketEventListener<GameCharacterBattleSkillInfo[]>("character:getSkills:success")

// 监听获取技能失败
export const onGetCharacterBattleSkillsError = registerSocketEventListener<{ message: string }>("character:getSkills:error")

// 你可以根据后端接口继续扩展 emit/in/on 方法，如升级技能、增加经验等


// 更新技能自动释放逻辑
export const emitUpdateSkillCastLogic = (skillId: string, logic: GameFullBattleLogic) => {
    emitEventToServer("character:updateSkillCastLogic", { skillId, logic })
}

// 监听自动释放逻辑更新成功
export const onUpdateSkillCastLogicSuccess = registerSocketEventListener<void>("character:updateSkillCastLogic:success")

// 监听自动释放逻辑更新失败
export const onUpdateSkillCastLogicError = registerSocketEventListener<{ message: string }>("character:updateSkillCastLogic:error")

// 更新技能自动释放逻辑
export const emitEnableSkill = (skillId: string) => {
    emitEventToServer("character:enableSkill", { skillId })
}
export const emitDisableSkill = (skillId: string) => {
    emitEventToServer("character:disableSkill", { skillId })
}

// 技能顺序调整
export const emitReorderCharacterSkills = (skillOrder: string[]) => {
    emitEventToServer("character:reorderSkill", { skillOrder })
}
export const onReorderCharacterSkillsSuccess = registerSocketEventListener<GameCharacterBattleSkillInfo[]>("character:reorderSkill:success")
export const onReorderCharacterSkillsError = registerSocketEventListener<{ message: string }>("character:reorderSkill:error")

// 技能顺序调整
export const emitCopySkillLogic = (playerUuid: string) => {
    emitEventToServer("character:copySkillLogic", { playerUuid })
}
export const onCopySkillLogicSuccess = registerSocketEventListener<void>("character:copySkillLogic:success")
export const onCopySkillLogicFail = registerSocketEventListener<{ message: string, missingSkills: string[] }>("character:copySkillLogic:fail")