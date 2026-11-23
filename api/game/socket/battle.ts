import { type BattleBeginMsg, type BattleDrawLine, type BattleFloatText, type BattleInfoDetail, type BattlePrepareBeginMsg, type BattlePrepareEndMsg, type GiveBattleExpReward, type GiveBattleResourceReward, type OnAddState, type OnCastSkill, type OnDealDamage, type OnHeal, type OnLossMp, type OnRestoreMp, type OnTurnEnd, type OnTurnStart, type UseBattleItem, type WorldBossHpUpdate } from "~/shared/types/msgQueue";
import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { BattleInfo, FullBattleAction } from "~/shared/types/battle";


export const emitGetBattleInfo = () => {
  emitEventToServer("battle:getInfo");
};
export const onBattleInfoUpdateSuccess = registerSocketEventListener<BattleInfo>("battle:update:success");
export const onBattleInfoUpdateError = registerSocketEventListener<{ message: string }>("battle:update:error");

export const onDispatchThisRoundActionSuccess = registerSocketEventListener<FullBattleAction>("battle:thisRoundAction:success");

export const onDispatchBattleFullInfoSuccess = registerSocketEventListener<{
  battleInfo: BattleInfo;
  // thisRoundAction: Pick<FullBattleAction, 'sourceUnitUuid'>;
}>("battle:fullInfo:success");


export const onBattleEndSuccess = registerSocketEventListener("battle:end:success");

export const emitBattleLeave = (roomId: string) => {
  emitEventToServer("battle:leaveBattle", { roomId });
};
export const onBattleLeaveSuccess = registerSocketEventListener("battle:leaveBattle:success");

export const emitStopBattle = (roomId: string) => {
  emitEventToServer("battle:stopBattle", { roomId });
};
export const onStopBattleSuccess = registerSocketEventListener("battle:stopBattle:success");

// battle message preference: abstract event to toggle receiving battle messages
export const emitSetBattleMsgPreference = (enable: boolean) => {
  emitEventToServer("msgPref:battle:set", { enable });
};

export const onUseBattleItem = registerSocketEventListener<UseBattleItem['info']>("battle:useBattleItem:success");
export const onHeal = registerSocketEventListener<OnHeal['info']>("battle:heal:success");
export const onLossMp = registerSocketEventListener<OnLossMp['info']>("battle:lossMp:success");
export const onRestoreMp = registerSocketEventListener<OnRestoreMp['info']>("battle:restoreMp:success");
export const onCastSkill = registerSocketEventListener<OnCastSkill['info']>("battle:castSkill:success");
export const onDealDamage = registerSocketEventListener<OnDealDamage['info']>("battle:dealDamage:success");
export const onDrawLine = registerSocketEventListener<BattleDrawLine['info']>("battle:drawLine:success");
export const onAddState = registerSocketEventListener<OnAddState['info']>("battle:addState:success");
export const onBattleFloatText = registerSocketEventListener<BattleFloatText['info']>("battle:floatText:success");
export const onTurnStart = registerSocketEventListener<OnTurnStart['info']>("battle:turnStart:success");
export const onTurnEnd = registerSocketEventListener<OnTurnEnd['info']>("battle:turnEnd:success");

export const onBossHpUpdated = registerSocketEventListener<WorldBossHpUpdate['info']>("worldBoss:hpUpdate:success");


export const onBattlePrepareBegin = registerSocketEventListener<BattlePrepareBeginMsg['info']>("battle:prepareBegin:success");
export const onBattlePrepareEnd = registerSocketEventListener<BattlePrepareEndMsg['info']>("battle:prepareEnd:success");
export const onBattleBegin = registerSocketEventListener<BattleBeginMsg['info']>("battle:begin:success");

export const onGiveBattleResourceReward = registerSocketEventListener<GiveBattleResourceReward['info']>("battle:giveResourceReward:success");
export const onGiveBattleExpReward = registerSocketEventListener<GiveBattleExpReward['info']>("battle:giveExpReward:success");
export const onBattleInfoDetail = registerSocketEventListener<BattleInfoDetail['info']>("battle:battleInfoDetail:success");