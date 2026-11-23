import type { AccountInfo } from "~/shared/types/account";

import { emitEventToServer, registerSocketEventListener } from "../socket";
import type { AllBattleSkillId, ChefSkillCombinationInfo, } from "~/shared/types/skill";

export const emitGetKnowledgeCrownSkills = () => {
  emitEventToServer("knowledgeCrownSkill:get");
};
export const onGetKnowledgeCrownSkillsSuccess = registerSocketEventListener<{ skills: AllBattleSkillId[] }>("knowledgeCrownSkill:get:success");
export const onGetKnowledgeCrownSkillsError = registerSocketEventListener<{ message: string }>("knowledgeCrownSkill:get:failed");

export const emitUpdateKnowledgeCrownSSkills = (skills: AllBattleSkillId[]) => {
  emitEventToServer("knowledgeCrownSkill:update", { skills });
};
export const onUpdateKnowledgeCrownSkillsSuccess = registerSocketEventListener("knowledgeCrownSkill:update:success");
export const onUpdateKnowledgeCrownSkillsError = registerSocketEventListener<{ message: string }>("knowledgeCrownSkill:update:failed");



export const emitGetDominationSealSkills = () => {
  emitEventToServer("dominationSealSkill:get");
};
export const onGetDominationSealSkillsSuccess = registerSocketEventListener<{ skills: AllBattleSkillId[] }>("dominationSealSkill:get:success");
export const onGetDominationSealSkillsError = registerSocketEventListener<{ message: string }>("dominationSealSkill:get:failed");

export const emitUpdateDominationSealSkills = (skills: AllBattleSkillId[]) => {
  emitEventToServer("dominationSealSkill:update", { skills });
};
export const onUpdateDominationSealSkillsSuccess = registerSocketEventListener("dominationSealSkill:update:success");
export const onUpdateDominationSealSkillsError = registerSocketEventListener<{ message: string }>("dominationSealSkill:update:failed");






// Emit: 获取组合
export const emitGetChefSkillCombination = () => {
  emitEventToServer('chefSkill:get');
};
export const onChefSkillGetSuccess = registerSocketEventListener<{info: ChefSkillCombinationInfo}>('chefSkill:get:success');
export const onChefSkillGetFailed = registerSocketEventListener<{ message: string }>('chefSkill:get:failed');

// Emit: 更新组合
export const emitUpdateChefSkillCombination = (info: ChefSkillCombinationInfo) => {
  emitEventToServer('chefSkill:update', {info});
};
export const onChefSkillUpdateSuccess = registerSocketEventListener<void>('chefSkill:update:success');
export const onChefSkillUpdateFailed = registerSocketEventListener<{ message: string }>('chefSkill:update:failed');


export const emitGetIntertwinedCatEyeGenesisEssenceStaffSkill = () => {
  emitEventToServer("intertwinedCatEyeGenesisEssenceStaffSkill:get");
};
export const onGetIntertwinedCatEyeGenesisEssenceStaffSkillSuccess = registerSocketEventListener<{ skills: AllBattleSkillId[] }>("intertwinedCatEyeGenesisEssenceStaffSkill:get:success");
export const onGetIntertwinedCatEyeGenesisEssenceStaffSkillError = registerSocketEventListener<{ message: string }>("intertwinedCatEyeGenesisEssenceStaffSkill:get:failed");
export const emitUpdateIntertwinedCatEyeGenesisEssenceStaffSkill = (skills: AllBattleSkillId[]) => {
  emitEventToServer("intertwinedCatEyeGenesisEssenceStaffSkill:update", { skills });
};
export const onUpdateIntertwinedCatEyeGenesisEssenceStaffSkillSuccess = registerSocketEventListener("intertwinedCatEyeGenesisEssenceStaffSkill:update:success");
export const onUpdateIntertwinedCatEyeGenesisEssenceStaffSkillError = registerSocketEventListener<{ message: string }>("intertwinedCatEyeGenesisEssenceStaffSkill:update:failed");


export const emitGetBlinkshadowGirdleSkill = () => {
  emitEventToServer("blinkshadowGirdleSkill:get");
};
export const onGetBlinkshadowGirdleSkillSuccess = registerSocketEventListener<{ skills: AllBattleSkillId[] }>("blinkshadowGirdleSkill:get:success");
export const onGetBlinkshadowGirdleSkillError = registerSocketEventListener<{ message: string }>("blinkshadowGirdleSkill:get:failed");
export const emitUpdateBlinkshadowGirdleSkill = (skills: AllBattleSkillId[]) => {
  emitEventToServer("blinkshadowGirdleSkill:update", { skills });
};
export const onUpdateBlinkshadowGirdleSkillSuccess = registerSocketEventListener("blinkshadowGirdleSkill:update:success");
export const onUpdateBlinkshadowGirdleSkillError = registerSocketEventListener<{ message: string }>("blinkshadowGirdleSkill:update:failed");
