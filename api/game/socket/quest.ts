import { emitEventToServer, registerSocketEventListener } from "@/api/game/socket/socket";
import type { GameSocketData } from "~/shared/types/socket";
import type { Quest, QuickCreateActionQuestParams } from "~/shared/types/quest";

// 获取任务列表
export function emitGetQuestList() {
  emitEventToServer("quest:list", null);
}

// 监听任务更新
export const onQuestUpdated = registerSocketEventListener<Quest>("quest:updated");

// 监听获取任务列表成功
export const onGetQuestListSuccess = registerSocketEventListener<Quest[]>("quest:list:success");

// 监听获取任务列表失败
export const onGetQuestListError = registerSocketEventListener<{ message: string }>("quest:list:error");

// 完成任务
export function emitCompleteQuest(questId: string) {
  emitEventToServer("quest:complete", { questId });
}

// 监听完成任务成功
export const onCompleteQuestSuccess = registerSocketEventListener<Quest>("quest:complete:success");

// 监听完成任务失败
export const onCompleteQuestError = registerSocketEventListener<{ message: string }>("quest:complete:error");


export function emitCompleteAllQuest() {
  emitEventToServer("quest:completeAll");
}
export const onCompleteAllQuestSuccess = registerSocketEventListener<Quest>("quest:completeAll:success");
export const onCompleteAllQuestError = registerSocketEventListener<{ message: string }>("quest:completeAll:error");

// 重新随机任务
export function emitRerollQuest(questUuid: string) {
  emitEventToServer("quest:reroll", { questUuid });
}

// 监听重新随机任务成功
export const onRerollQuestSuccess = registerSocketEventListener<{ newQuest: Quest }>("quest:reroll:success");

// 监听重新随机任务失败
export const onRerollQuestError = registerSocketEventListener<{ message: string }>("quest:reroll:error");

export function emitDeleteQuest(questUuid: string) {
  emitEventToServer("quest:delete", { questUuid });
}
export const onDeleteQuestSuccess = registerSocketEventListener<void>("quest:delete:success");
export const onDeleteQuestError = registerSocketEventListener<{ message: string }>("quest:delete:error");