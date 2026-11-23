import type { SkillTreeId } from '~/shared/types/skillTree'
import { emitEventToServer, registerSocketEventListener } from './socket'

// ---------------- Emit APIs ----------------
export const emitSkillTreeSummary = (treeId: SkillTreeId, characterUuid?: string) => {
  emitEventToServer('skillTree:summary', { treeId, characterUuid })
}
export const emitSkillTreeAllocate = (treeId: SkillTreeId, nodeId: string, characterUuid?: string) => {
  emitEventToServer('skillTree:allocate', { treeId, nodeId, characterUuid })
}
export const emitSkillTreeDeallocate = (treeId: SkillTreeId, nodeId: string, characterUuid?: string) => {
  emitEventToServer('skillTree:deallocate', { treeId, nodeId, characterUuid })
}
// export const emitSkillTreeEffects = (treeId: SkillTreeId, characterUuid?: string) => {
//   emitEventToServer('skillTree:effects', { treeId, characterUuid })
// }
export const emitSkillTreeReset = (treeId: SkillTreeId, characterUuid?: string) => {
  emitEventToServer('skillTree:reset', { treeId, characterUuid })
}
export const emitSkillTreeLearned = (characterUuid?: string) => {
  emitEventToServer('skillTree:learned', { characterUuid })
}

// ---------------- Listener APIs ----------------
export const onSkillTreeSummarySuccess = registerSocketEventListener<{ treeId: SkillTreeId; summary: any }>('skillTree:summary:success')
export const onSkillTreeSummaryFail = registerSocketEventListener<{ treeId?: SkillTreeId; msg: string }>('skillTree:summary:fail')

export const onSkillTreeAllocateSuccess = registerSocketEventListener<{ treeId: SkillTreeId; nodeId: string; summary: any }>('skillTree:allocate:success')
export const onSkillTreeAllocateFail = registerSocketEventListener<{ treeId?: SkillTreeId; nodeId?: string; msg: string }>('skillTree:allocate:fail')

// export const onSkillTreeDeallocateSuccess = registerSocketEventListener<{ treeId: SkillTreeId; nodeId: string; summary: any }>('skillTree:deallocate:success')
// export const onSkillTreeDeallocateFail = registerSocketEventListener<{ treeId?: SkillTreeId; nodeId?: string; msg: string }>('skillTree:deallocate:fail')

// export const onSkillTreeEffectsSuccess = registerSocketEventListener<{ treeId: SkillTreeId; effects: any }>('skillTree:effects:success')
// export const onSkillTreeEffectsFail = registerSocketEventListener<{ treeId?: SkillTreeId; msg: string }>('skillTree:effects:fail')
export const onSkillTreeResetSuccess = registerSocketEventListener<{ treeId: SkillTreeId; summary: any }>('skillTree:reset:success')
export const onSkillTreeResetFail = registerSocketEventListener<{ treeId?: SkillTreeId; msg: string }>('skillTree:reset:fail')
export const onSkillTreeLearnedSuccess = registerSocketEventListener<{ learned: { treeId: SkillTreeId | string; nodeId: string; level: number }[] }>('skillTree:learned:success')
export const onSkillTreeLearnedFail = registerSocketEventListener<{ msg: string }>('skillTree:learned:fail')
