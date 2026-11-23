import type { AccountInfo } from "~/shared/types/account";
import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { AlchemyRecipe, UserAlchemyAtlas } from "~/shared/types/gameAlchemy";
import type { ItemCountInfo } from "~/shared/types/gameInventory";
import type { AllGameResourceID } from "~/shared/types/gameResource";

export const emitGetUserAlchemyAtlas = () => {
  emitEventToServer("alchemy:atlas");
};
export const onGetUserAlchemyAtlasSuccess = registerSocketEventListener<UserAlchemyAtlas>("alchemy:atlas:success");
export const onGetUserAlchemyAtlasFailed = registerSocketEventListener<{ message: string }>("alchemy:atlas:fail");

export const emitStartAlchemy = (input: ItemCountInfo) => {
  emitEventToServer("alchemy:start", {input});
};
export const onDoAlchemySuccess = registerSocketEventListener<{
  usedItems: ItemCountInfo;
  rewardItems: ItemCountInfo;
  successCount: number;
  mutationCount: number;
  expectMainOutput: AllGameResourceID;
  recipeIndex: number;
  rewardTimes: number;
}>("alchemy:start:success");
export const onDoAlchemyFailed = registerSocketEventListener<{ message: string }>("alchemy:start:fail");

// ---- 自动炼金：创建请求 ----
export const emitCreateAutoAlchemy = (input: ItemCountInfo, times: number) => {
  emitEventToServer("alchemy:auto:create", { input, times });
};
export const onCreateAutoAlchemySuccess = registerSocketEventListener<{ uuid: string; recipeId: string; recipeIndex: number; targetTimes: number }>("alchemy:auto:create:success");
export const onCreateAutoAlchemyFail = registerSocketEventListener<{ msg: string }>("alchemy:auto:create:fail");

// ---- 自动炼金：进度 / 完成 / 错误 ----
export const onAutoAlchemyProgress = registerSocketEventListener<{
  uuid: string;
  doneTimes: number;
  targetTimes: number;
  lastReward: ItemCountInfo;
}>("alchemy:auto:progress");
export const onAutoAlchemyFinished = registerSocketEventListener<{
  uuid: string;
  doneTimes: number;
  targetTimes: number;
  allRewardItems: ItemCountInfo;
  allUsedItems: ItemCountInfo;
}>("alchemy:auto:finished");
export const onAutoAlchemyError = registerSocketEventListener<{ uuid: string; msg: string }>("alchemy:auto:error");

// ---- 自动炼金：查询当前 ----
export const emitGetCurrentAutoAlchemy = () => {
  emitEventToServer("alchemy:auto:current");
};
export const onGetCurrentAutoAlchemySuccess = registerSocketEventListener<{
  current: null | {
    uuid: string;
    recipeId: string;
    recipeIndex: number;
    targetTimes: number;
    doneTimes: number;
    status: string;
    allUsedItems: ItemCountInfo;
    allRewardItems: ItemCountInfo;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
  };
}>("alchemy:auto:current:success");
export const onGetCurrentAutoAlchemyFail = registerSocketEventListener<{ msg: string }>("alchemy:auto:current:fail");

// ---- 自动炼金：历史记录 ----
export const emitGetAutoAlchemyHistory = (limit?: number) => {
  emitEventToServer('alchemy:auto:history', { limit });
};
export const onGetAutoAlchemyHistorySuccess = registerSocketEventListener<{
  list: {
    uuid: string;
    recipeId: string;
    recipeIndex: number;
    targetTimes: number;
    doneTimes: number;
    status: string;
    allUsedItems: ItemCountInfo;
    allRewardItems: ItemCountInfo;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
  }[];
}>("alchemy:auto:history:success");
export const onGetAutoAlchemyHistoryFail = registerSocketEventListener<{ msg: string }>("alchemy:auto:history:fail");

// ---- 自动炼金：取消 ----
export const emitCancelAutoAlchemy = (uuid?: string) => {
  emitEventToServer('alchemy:auto:cancel', uuid ? { uuid } : undefined as any);
};
export const onAutoAlchemyCancelled = registerSocketEventListener<{ ok: boolean; uuid?: string; msg?: string }>('alchemy:auto:cancelled');