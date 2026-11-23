import type { AllGameActionID } from "./gameAction"

export type GameTask = {
    actionId: AllGameActionID

    createTime: number

    repeatCount: number
    currentRepeat: number

    lastSubtaskDoneTime?: number
    // pastTimeAboutLastSubtask?: number

    markAsDelete?: boolean

    // 是否已经扣除了本次执行的资源
    hasDeductFirstTaskResource?: boolean
}