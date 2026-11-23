import type { ItemCountInfo } from "./gameInventory"
import type { AllGameResourceID } from "./gameResource"


export type AutoEnhanceRequestResult = {
    uuid: string;

    startAt: Date,
    endAt: Date | null,

    targetResourceId?: string
    targetRepeatCount?: number

    status: AutoEnhanceRequestStatus

    enhanceItemId: string;

    repeatCount: number;

    eachResult: AutoEnhanceResult[]

    allGetItems: ItemCountInfo
    allUsedItems: ItemCountInfo
}

export type AutoEnhanceResult = {
    result: 'success'
    increaseItemId: AllGameResourceID
    decreaseItemId: ItemCountInfo
} | {
    result: 'failed'
    increaseItemId: AllGameResourceID
    decreaseItemId: ItemCountInfo
} | {
    result: 'error'
    reason: string
} | {
    result: 'restart'
    reason: string
    currentItemId: AllGameResourceID
}


// "PENDING" | "PROCESSING" | "SUCCESS" | "FINISHED" | "CANCELLED" | "ERROR"
export enum AutoEnhanceRequestStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    SUCCESS = "SUCCESS",
    FINISHED = "FINISHED",
    CANCELLED = "CANCELLED",
    ERROR = "ERROR"
}

export type AutoEnhanceRequest = {
  resourceId: AllGameResourceID
  protectedResourceId?: AllGameResourceID

  repeatCount: number
  stopWhenGetResource?: AllGameResourceID

  startProtectedWhen: number
}
