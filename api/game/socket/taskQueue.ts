import type { GameTask } from "~/shared/types/gameTask";
import { emitEventToServer, registerSocketEventListener, socket } from "@/api/game/socket/socket"
import type { GameSocketData } from "~/shared/types/socket";

export function emitAddTask(task: GameTask) {
    emitEventToServer("addTaskToQueue", task)
}
export const onAddTaskFailed = registerSocketEventListener<{message: string}>("addTaskToQueue:fail")

export function emitImmediatelyStartTask(task: GameTask) {
    emitEventToServer("task:immediatelyStart", task)
}

export function emitRemoveTask(index: number) {
    emitEventToServer("removeTaskFromQueue", index)
}

export function emitGetTaskQueue() {
    emitEventToServer("getTaskQueue", {})
}

export function emitJoinRoom() {
    emitEventToServer("joinRoom", {})
}

export const onJoinRoomSuccess = registerSocketEventListener<string>("join-room:success")

// 使用 registerSocketEventListener 替换原有 socket.on 监听
export const onTaskQueueFetched = registerSocketEventListener<GameTask[]>("dispatchTaskQueueToClient")
// 使用 registerSocketEventListener 替换原有 socket.on 监听
export const onTaskImmediatelyStartSuccess = registerSocketEventListener<void>("task:immediatelyStart:success")
export const onTaskImmediatelyStartFailed = registerSocketEventListener<{message: string}>("task:immediatelyStart:failed")

export const onTaskUpdated = registerSocketEventListener<GameTask>("taskUpdated")

export const onNeedResetCurrentActionProgress = registerSocketEventListener<void>("needResetCurrentActionProgress")

export const onTaskDone = registerSocketEventListener<GameTask>("taskDone")


/**
 * 重排序任务队列
 * @param newOrder 新的排序索引数组
 */
export function emitReorderTasks(newOrder: number[]) {
    emitEventToServer("task:reorder", newOrder)
}
/**
 * 监听重排序成功事件
 */
export const onReorderTasksSuccess = registerSocketEventListener<{message: string}>("task:reorder:success")
/**
 * 监听重排序失败事件
 */
export const onReorderTasksFailed = registerSocketEventListener<{message: string}>("task:reorder:failed")