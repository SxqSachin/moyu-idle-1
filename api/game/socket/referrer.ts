import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";
import type { GameSocketData } from "~/shared/types/socket";
import type { Quest, QuickCreateActionQuestParams } from "~/shared/types/quest";
import type { InviteRewardSettingResponse, ReferrerInfo } from "~/shared/types/referrer";
import type { ItemCountInfo } from "~/shared/types/gameInventory";

// 获取推荐信息
export function emitGetReferrerInfo() {
  emitEventToServer("referrer:info", null);
}

export function emitGetMyInviter() {
  emitEventToServer("referrer:myInviter", null);
}

export const onGetReferrerInfoSuccess = registerSocketEventListener<{info: ReferrerInfo}>("referrer:info:success");
export const onGetReferrerInfoFail = registerSocketEventListener<{message: string}>("referrer:info:fail");

export const onGetMyInviterSuccess = registerSocketEventListener<{ inviter: { uuid: string, name?: string, createDate?: Date } | null }>("referrer:myInviter:success");
export const onGetMyInviterFail = registerSocketEventListener<{ message: string }>("referrer:myInviter:fail");


export function emitClaimedStage1Reward() {
  emitEventToServer("referrer:claimedStage1Reward");
}

export const onClaimedStage1RewardSuccess = registerSocketEventListener("referrer:claimedStage1Reward:success");
export const onClaimedStage1RewardFail = registerSocketEventListener<{message: string}>("referrer:claimedStage1Reward:fail");

export function emitClaimedStage2Reward() {
  emitEventToServer("referrer:claimedStage2Reward");
}

export const onClaimedStage2RewardSuccess = registerSocketEventListener("referrer:claimedStage2Reward:success");
export const onClaimedStage2RewardFail = registerSocketEventListener<{message: string}>("referrer:claimedStage2Reward:fail");

export function emitGetConfirmReferredRelationshipInfo() {
  emitEventToServer("referrer:getConfirmReferredRelationshipInfo");
}
export const onGetConfirmReferredRelationshipInfoSuccess = registerSocketEventListener<{ confirmed: boolean, confirmedAt: Date | null }>("referrer:getConfirmReferredRelationshipInfo:success");
export const onGetConfirmReferredRelationshipInfoFail = registerSocketEventListener<{ message: string }>("referrer:getConfirmReferredRelationshipInfo:fail");

export function emitConfirmReferredRelationship() {
  emitEventToServer("referrer:confirmReferredRelationship");
}
export const onConfirmReferredRelationshipSuccess = registerSocketEventListener("referrer:confirmReferredRelationship:success");
export const onConfirmReferredRelationshipFail = registerSocketEventListener<{ message: string }>("referrer:confirmReferredRelationship:fail");

export function emitDeleteReferredRelationship() {
  emitEventToServer("referrer:deleteReferredRelationship");
}
export const onDeleteReferredRelationshipSuccess = registerSocketEventListener("referrer:deleteReferredRelationship:success");
export const onDeleteReferredRelationshipFail = registerSocketEventListener<{ message: string }>("referrer:deleteReferredRelationship:fail"); 

// 设置/获取邀新奖励
export function emitSetInviteRewardSetting(reward: ItemCountInfo) {
  emitEventToServer("referrer:setInviteRewardSetting", { reward });
}
export const onSetInviteRewardSettingSuccess = registerSocketEventListener<{ setting: InviteRewardSettingResponse['setting'] }>("referrer:setInviteRewardSetting:success");
export const onSetInviteRewardSettingFail = registerSocketEventListener<{ message: string }>("referrer:setInviteRewardSetting:fail");

export function emitGetInviteRewardSetting(userUuid?: string) {
  emitEventToServer("referrer:getInviteRewardSetting", { userUuid });
}
export const onGetInviteRewardSettingSuccess = registerSocketEventListener<InviteRewardSettingResponse>("referrer:getInviteRewardSetting:success");
export const onGetInviteRewardSettingFail = registerSocketEventListener<{ message: string }>("referrer:getInviteRewardSetting:fail");