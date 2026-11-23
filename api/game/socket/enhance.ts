import type { AutoEnhanceRequest, AutoEnhanceRequestResult } from "~/shared/types/enhance"
import { emitEventToServer, registerSocketEventListener } from "./socket"
import type { AllGameResourceID } from "~/shared/types/gameResource"

// 发起强化请求
export const emitEnhanceRequire = (resourceId: AllGameResourceID, protectedResourceId?: AllGameResourceID) => {
  emitEventToServer("enhance:require", { resourceId, protectedResourceId })
}

// 强化结果监听
export const onEnhanceResult = registerSocketEventListener<{
  success: boolean
  msg: string
  enhanceResultId?: AllGameResourceID
}>("enhance:require:success")

// 强化错误监听
export const onEnhanceError = registerSocketEventListener<{ msg: string }>("enhance:result:error")


export const emitAutoEnhanceRequire = (autoEnhanceRequest: AutoEnhanceRequest) => {
  emitEventToServer("enhance:auto", autoEnhanceRequest)
}

// 强化结果监听
export const onAutoEnhanceCreateSuccess = registerSocketEventListener<void>("enhance:auto:create:success")
export const onAutoEnhanceCreateError = registerSocketEventListener<{ msg: string }>("enhance:auto:create:error")


export const emitStopAutoEnhanceRequire = (uuid: string) => {
  emitEventToServer("enhance:stop", {uuid})
}
export const onStopAutoEnhanceSuccess = registerSocketEventListener<void>("enhance:stop:success")
export const onStopAutoEnhanceError = registerSocketEventListener<{ msg: string }>("enhance:stop:error")


export const emitGetAutoEnhanceHistory = () => {
  emitEventToServer("enhance:history")
}
export const onGetAutoEnhanceHistorySuccess = registerSocketEventListener<AutoEnhanceRequestResult[]>("enhance:history:success")

export const emitGetCurrentAutoEnhance = () => {
  emitEventToServer("enhance:current")
}
export const onGetCurrentAutoEnhanceSuccess = registerSocketEventListener<{res: AutoEnhanceRequestResult | null}>("enhance:current:success")

// export const onAutoEnhanceResult = registerSocketEventListener<{
//   success: boolean
//   msg: string
//   enhanceResultId?: AllGameResourceID
// }>("enhance:auto:")

// 强化错误监听