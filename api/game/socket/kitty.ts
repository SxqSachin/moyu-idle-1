import type { Kitty } from "~/shared/types/kitty"
import { emitEventToServer, registerSocketEventListener, socket } from "./socket"
import type { GameAction } from "~/shared/types/gameAction"
import type { AllGameResourceID } from "~/shared/types/gameResource"
import type { GameTask } from "~/shared/types/gameTask"


export const emitGetAllKittyInfo = () => {
    emitEventToServer("kitty:getAll")
}

export const emitCreateKitty = (name: string) => {
    emitEventToServer("kitty:create", name)
}

export const onCreateKittySuccess = registerSocketEventListener<Kitty>("kitty:create:success")
export const onCreateKittyError = registerSocketEventListener<{message: string}>("kitty:create:error")

export const onDispatchAllKittyInfo = registerSocketEventListener<Kitty[]>("kitty:getAll:success")
export const onLatestKittyTaskQueueUpdate = registerSocketEventListener<{
    kittyUuid: string,
    taskQueue: GameAction[]
}>("kitty:taskQueue:update")

export const onKittyTaskDone = registerSocketEventListener<{
    kittyUuid: string,
    task: GameAction
}>("kitty:taskQueue:done")

export const emitFeedKitty = (kittyUuid: string, resourceId: AllGameResourceID, count: number) => {
    emitEventToServer("kitty:feed", { kittyUuid, resourceId, count })
}

export const onFeedKittySuccess = registerSocketEventListener<Kitty>("kitty:feed:success")
export const onFeedKittyFail = registerSocketEventListener<{ message: string }>("kitty:feed:fail")
export const onKittyUpdated = registerSocketEventListener<Kitty>("kitty:update:success")


export const emitAddKittyTask = (kittyUuid: string, task: GameTask) => {
    emitEventToServer("kitty:addTask", { kittyUuid, task })
}

export const onAddKittyTaskSuccess = registerSocketEventListener<{ kittyUuid: string, taskQueue: GameTask[] }>("kitty:addTask:success")
export const onAddKittyTaskFail = registerSocketEventListener<{ message: string }>("kitty:addTask:error")

export const emitGetKittyAllTask = (kittyUuid: string) => {
    emitEventToServer("kitty:getAllTask", { kittyUuid })
}

export const onGetKittyAllTaskSuccess = registerSocketEventListener<{ kittyUuid: string, taskQueue: GameTask[] }>("kitty:getAllTask:success")
export const onGetKittyAllTaskFail = registerSocketEventListener<{ message: string }>("kitty:getAllTask:fail")

export const emitRemoveKittyTask = (kittyUuid: string, index: number) => {
    emitEventToServer("kitty:removeTask", { kittyUuid, index })
}

export const onRemoveKittyTaskSuccess = registerSocketEventListener<{ kittyUuid: string, taskQueue: GameTask[] }>("kitty:removeTask:success")
export const onRemoveKittyTaskFail = registerSocketEventListener<{ message: string }>("kitty:removeTask:error")

/**
 * 重排序猫咪任务队列
 * @param kittyUuid 猫咪UUID
 * @param newOrder 新的排序索引数组
 */
export const emitReorderKittyTasks = (kittyUuid: string, newOrder: number[]) => {
    emitEventToServer("kitty:reorder", { kittyUuid, newOrder })
}

/**
 * 监听猫咪重排序成功事件
 */
export const onReorderKittyTasksSuccess = registerSocketEventListener<{message: string, kittyUuid: string}>("kitty:reorder:success")

/**
 * 监听猫咪重排序失败事件
 */
export const onReorderKittyTasksFailed = registerSocketEventListener<{message: string}>("kitty:reorder:failed")

export const emitRenameKitty = (kittyUuid: string, newName: string) => {
    emitEventToServer("kitty:rename", { kittyUuid, newName })
}
export const onRenameKittySuccess = registerSocketEventListener<Kitty>("kitty:rename:success")
export const onRenameKittyError = registerSocketEventListener<{ message: string }>("kitty:rename:error")