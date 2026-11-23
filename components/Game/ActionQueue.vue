<template>
    <!-- 优化后的操作队列区域 -->
    <div
        class="bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-2xl shadow-xl border border-blue-100 dark:border-gray-600 p-6 mb-6 backdrop-blur-sm">
        <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3">
                <div
                    class="w-10 h-10 bg-gradient-to-br from-blue-200 to-purple-200 rounded-xl flex items-center justify-center">
                    <span class="text-white text-xl">⚡</span>
                </div>
                <div>
                    <h3 class="text-xl font-bold text-gray-800 dark:text-gray-200">操作队列</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">大猫咪的任务计划</p>
                </div>
            </div>
            <div v-if="waitingTasks.length > 1" class="flex items-center justify-between my-2 mx-3">
                <div class="flex items-center space-x-2" v-if="!isSelfFishing">
                    <el-button v-if="!isReorderMode" size="small" type="primary" @click="enterReorderMode" plain>
                        排序
                    </el-button>
                    <template v-else>
                        <el-button size="small" @click="cancelReorder" plain>
                            取消
                        </el-button>
                        <el-button size="small" type="primary" @click="saveReorder" :loading="isReordering">
                            保存
                        </el-button>
                    </template>
                </div>
            </div>
        </div>

        <div class="space-y-4 relative">
            <div v-if="isSelfFishing" class="w-full h-full absolute z-50">
                <div class="bg-slate-200 dark:bg-gray-800 w-full h-full absolute opacity-80 rounded-md">
                </div>
                <div class="absolute w-full h-full flex flex-col items-center justify-center">
                    <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <span class="text-white text-2xl">🎣</span>
                    </div>
                    <h3 class="text-base font-medium text-gray-600 dark:text-gray-400 mb-1">你正在垂钓</h3>
                    <p class="text-sm text-gray-400 dark:text-gray-600 font-bold">垂钓归来后的1分钟内，队列将恢复执行</p>
                </div>
            </div>

            <div v-if="taskQueue.length > 0" class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4" 
                :class="{
                    'blur-xs': isSelfFishing
                }"
            >

                <!-- 队列长度 - 在移动端占用完整宽度 -->
                <div
                    class="col-span-2 sm:col-span-1 bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                    <div class="flex items-center space-x-2">
                        <div
                            class="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-md flex items-center justify-center flex-shrink-0">
                            <span class="text-purple-600 dark:text-purple-400 text-xs">📋</span>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="text-xs text-gray-500 dark:text-gray-400">队列数量</div>
                            <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ taskQueue.length }} 个
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 饱食度消耗 -->
                <div
                    class="col-span-2 sm:col-span-1 bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                    <div class="flex items-center space-x-2">
                        <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" :class="{
                            'bg-green-100 dark:bg-green-900': currentSatiety >= totalFoodCost,
                            'bg-red-100 dark:bg-red-900': currentSatiety < totalFoodCost
                        }">
                            <span class="text-xs" :class="{
                                'text-green-600 dark:text-green-400': currentSatiety >= totalFoodCost,
                                'text-red-600 dark:text-red-400': currentSatiety < totalFoodCost
                            }">😋</span>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="text-xs text-gray-500 dark:text-gray-400">饱食度</div>
                            <div class="text-sm font-semibold flex gap-2">
                                <span class="text-gray-700 dark:text-gray-300">预计消耗:<span class="text-green-600 dark:text-green-400">{{ formatCountToStr(totalFoodCost) }}</span></span>
                                <span class="text-gray-700 dark:text-gray-300">当前拥有:<span :class="{
                                'text-green-600 dark:text-green-400': currentSatiety >= totalFoodCost,
                                'text-red-600 dark:text-red-400': currentSatiety < totalFoodCost
                            }">{{ formatCountToStr(currentSatiety) }}</span></span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 总耗时 -->
                <div
                    class="col-span-2 sm:col-span-1 bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                    <div class="flex items-center space-x-2">
                        <div
                            class="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-md flex items-center justify-center flex-shrink-0">
                            <span class="text-blue-600 dark:text-blue-400 text-xs">⏱️</span>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="text-xs text-gray-500 dark:text-gray-400">预计完成</div>
                            <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">{{
                                totalQueueFinishTime || '无' }}</div>
                        </div>
                    </div>
                </div>

            </div>


            <!-- 队列列表 -->
            <div class="space-y-2"
                :class="{
                    'blur-xs': isSelfFishing
                }"
            >
                <!-- 空状态 -->
                <div v-if="taskQueue.length === 0" class="text-center py-8">
                    <div class="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <span class="text-white text-2xl">💤</span>
                    </div>
                    <h3 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">队列为空</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">添加任务开始执行吧！</p>
                </div>

                <!-- 执行中的任务 - 不参与排序 -->
                <div v-if="currentExecutingTask"
                    class="group relative overflow-hidden rounded-lg border transition-all duration-300 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-700 shadow-sm"
                    :class="{ 'opacity-75': isReorderMode }">

                    <!-- 执行中的动画背景 -->
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-200/5 to-purple-200/5"></div>


                    <div class="relative p-3">
                        <!-- 移动端紧凑布局 -->
                        <div class="flex items-center space-x-3">
                            <!-- 任务图标 -->
                            <div class="relative flex-shrink-0">
                                <div
                                    class="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-300 to-indigo-300">
                                    <GameCommonSimpleActionNameAndIcon :icon-size="10"
                                        :action-id="currentExecutingTask.actionId" :hide-name="true"
                                        class="text-white" />
                                </div>
                                <!-- 执行中标识 -->
                                <div
                                    class="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse border border-white dark:border-gray-700">
                                </div>
                            </div>

                            <!-- 任务信息 -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center space-x-2 mb-1">
                                    <h4 class="font-medium text-gray-800 dark:text-gray-200 truncate text-sm">{{
                                        getActionName(currentExecutingTask.actionId) }}</h4>
                                    <span
                                        class="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
                                        执行中
                                    </span>
                                </div>

                                <div class="flex items-center justify-between">
                                    <div class="text-xs text-gray-600 dark:text-gray-400">
                                        {{ currentExecutingTask.currentRepeat + 1 }}/{{ currentExecutingTask.repeatCount
                                        }}
                                    </div>

                                    <div class="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                                        <span class="hidden sm:inline">😋 {{ getTaskSatietyCost(currentExecutingTask)
                                            }}</span>
                                        <span class="hidden md:inline">⏰ {{ calcExpectFinishTime(currentExecutingTask,
                                            0) }}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- 操作按钮 -->
                            <div class="flex-shrink-0" v-if="!isReorderMode">
                                <el-button size="small" type="danger" @click="removeFromQueue(0)"
                                    class="!px-2 !py-1 text-xs rounded-md" plain>
                                    终止
                                </el-button>
                            </div>
                        </div>

                        <!-- 移动端显示详细信息 -->
                        <div class="sm:hidden mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                <span>🍖 {{ getTaskSatietyCost(currentExecutingTask) }}</span>
                                <span>⏰ {{ calcExpectFinishTime(currentExecutingTask, 0) }}</span>
                            </div>
                        </div>

                        <!-- 进度条 - 移动端优化 -->
                        <div v-if="showProgressBar" class="mt-3">
                            <div class="relative">
                                <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 overflow-hidden">
                                    <div class="h-full bg-gradient-to-r from-blue-300 to-indigo-400 rounded-full transition-all duration-300 ease-out origin-left progress-bar"
                                        :style="{ '--progress': (currentActionProgress / 100) }"></div>
                                </div>
                                <div class="mt-1 text-center">
                                    <span class="text-xs font-medium text-gray-600 dark:text-gray-300">
                                        {{ Math.round(currentActionProgress) }}% ({{ thisActionDuration }})
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>



                <!-- 等待中的任务 - 可拖拽排序 -->
                <draggable v-if="waitingTasks.length > 0" :disabled="!isReorderMode" v-model="localWaitingTasks"
                    class="flex flex-col gap-y-2" @end="onDragEnd" :item-key="getSortItemKey" handle=".task-card"
                    :animation="220" :ghost-class="'drag-ghost'" :chosen-class="'drag-chosen'"
                    :drag-class="'drag-dragging'">
                    <template #item="{ element: task, index }">
                        <div class="group relative overflow-hidden rounded-lg border transition-all duration-300 task-card bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                            :class="{
                                'cursor-move border-indigo-300 dark:border-indigo-600': isReorderMode,
                            }">
                            <!-- 排序模式提示 -->
                            <div v-if="isReorderMode" class="absolute top-2 right-2 z-10">
                                <div
                                    class="w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                                    <span class="text-indigo-600 dark:text-indigo-400 text-xs">⇅</span>
                                </div>
                            </div>

                            <div class="relative p-3">
                                <!-- 移动端紧凑布局 -->
                                <div class="flex items-center space-x-3">
                                    <!-- 任务图标 -->
                                    <div class="relative flex-shrink-0">
                                        <div
                                            class="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                                            <GameCommonSimpleActionNameAndIcon :icon-size="10"
                                                :action-id="task.actionId" :hide-name="true" class="text-white" />
                                        </div>
                                    </div>

                                    <!-- 任务信息 -->
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center space-x-2 mb-1">
                                            <h4 class="font-medium text-gray-800 dark:text-gray-200 truncate text-sm">{{
                                                getActionName(task.actionId) }}</h4>
                                        </div>

                                        <div class="flex items-center justify-between">
                                            <div class="text-xs text-gray-600 dark:text-gray-400">
                                                重复 {{ task.repeatCount }} 次
                                                <span v-if="task.currentRepeat ">（已完成 {{ task.currentRepeat }}）</span>
                                            </div>

                                            <div
                                                class="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                                                <span class="hidden sm:inline">😋 {{ getTaskSatietyCost(task) }}</span>
                                                <span class="hidden md:inline">⏰ {{ calcExpectFinishTime(task, index +
                                                    1) }}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- 操作按钮 -->
                                    <div class="flex-shrink-0" v-if="!isReorderMode">
                                        <el-button size="small" type="danger" @click="removeFromQueue(index + 1)"
                                            class="!px-2 !py-1 text-xs rounded-md" plain>
                                            移除
                                        </el-button>
                                    </div>
                                </div>

                                <!-- 移动端显示详细信息 -->
                                <div class="sm:hidden mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                    <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <span>🍖 {{ getTaskSatietyCost(task) }}</span>
                                        <span>⏰ {{ calcExpectFinishTime(task, index + 1) }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </draggable>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { GameTask } from '~/shared/types/gameTask'
import draggable from 'vuedraggable'

// 新增：队列相关状态
import { emitGetTaskQueue, emitRemoveTask, emitReorderTasks, onNeedResetCurrentActionProgress, onReorderTasksFailed, onReorderTasksSuccess, onTaskDone, onTaskQueueFetched, onTaskUpdated } from '@/api/game/socket/taskQueue'
import { waitUtilConnected } from '~/api/game/socket/socket'
import type { AllGameActionID } from '~/shared/types/gameAction'
import { allGameAction } from '~/shared/data/allGameActions'
import { formatCountToStr, formatTime } from '~/shared/utils'
import { useTaskQueue } from '~/composables/game/useTaskQueue'
import { useActionDuration } from '~/composables/game/useActionDuration'
import { useInventory } from '~/composables/game/useInventory'
import { useActionResourceReqiurement } from '~/composables/game/useActionResourceReqiurement'
import type { FuncAction } from '~/shared/types'
import useFishing from '~/composables/game/useFishing'

const inventory = useInventory()

const taskQueue = useTaskQueue()
const { hasActiveSession, myActiveSession, getMyActiveSession } = useFishing()
const isSelfFishing = computed(() => Boolean(hasActiveSession.value && myActiveSession.value?.actorType === 'PLAYER'))
const currentActionProgress = ref(0)
const lastTaskUpdateInfo = ref<GameTask | null>(null)

const showProgressBar = ref(false)

const allActionDuration = useActionDuration()

// 排序相关状态
const isReorderMode = ref(false)
const isReordering = ref(false)
const localWaitingTasks = ref<GameTask[]>([])

// 分离执行中任务和等待任务
const currentExecutingTask = computed(() => {
    return unref(taskQueue)[0] || null
})

const waitingTasks = computed(() => {
    return unref(taskQueue).slice(1)
})

// 监听等待任务变化，同步到本地排序队列
watch(waitingTasks, (val) => {
    localWaitingTasks.value = [...val]
}, { immediate: true })

const currentActionInQueue = computed(() => {
    return unref(taskQueue)[0]
})
const currentActionId = computed(() => {
    return unref(taskQueue)[0]?.actionId
})

let unbind1: FuncAction
let unbind2: FuncAction
let unbind3: FuncAction
let unbind4: FuncAction
let unbindReorderSuccess: FuncAction | undefined
let unbindReorderFailed: FuncAction | undefined

// 排序模式相关方法
const enterReorderMode = () => {
    isReorderMode.value = true
    localWaitingTasks.value = [...waitingTasks.value]
}

const cancelReorder = () => {
    isReorderMode.value = false
    localWaitingTasks.value = [...waitingTasks.value]
}

// 为任务生成唯一标识符
const getTaskUniqueId = (task: GameTask) => {
    return `${task.actionId}_${task.repeatCount}_${task.currentRepeat}_${task.lastSubtaskDoneTime || 0}_${task.createTime}`
}

const saveReorder = async () => {
    if (isReordering.value) return

    isReordering.value = true

    try {
        // 构建原始等待任务的索引映射
        const originalWaitingTasks = waitingTasks.value

        // 创建原始任务的唯一标识映射
        const originalTaskIds = originalWaitingTasks.map(task => getTaskUniqueId(task))

        // 生成新的索引数组，表示每个位置应该放置原队列中哪个索引的任务
        const newIndexOrder = localWaitingTasks.value.map(sortedTask => {
            const taskId = getTaskUniqueId(sortedTask)
            const originalIndex = originalTaskIds.indexOf(taskId)
            return originalIndex + 1 // +1 因为第一个是执行中的任务
        })

        // 调用后端API来重新排序任务队列
        emitReorderTasks(newIndexOrder)

        // 注意：不在这里设置 isReorderMode.value = false
        // 等待后端响应后再处理

    } catch (error) {
        console.error('排序错误:', error)
        ElNotification({
            title: '排序失败',
            type: 'error',
            message: '保存队列排序时出错，请重试',
            duration: 3000
        })
        isReordering.value = false
    }
}

const onDragEnd = () => {
    // 拖拽结束时的处理逻辑
    // console.log('Waiting tasks reordered:', localWaitingTasks.value.map(t => t.actionId))
}

const getSortItemKey = (item: GameTask) => {
    return getTaskUniqueId(item)
}

let timer: any = null;
onMounted(async () => {
    await waitUtilConnected()

    getMyActiveSession()

    unbind1 = onTaskQueueFetched(data => {
        if (!isReorderMode.value) {
            taskQueue.value = data
        }

        let firstActionInQueue = data.at(0)
        if (firstActionInQueue && firstActionInQueue.lastSubtaskDoneTime) {
            lastTaskUpdateInfo.value = firstActionInQueue
        }

        showProgressBar.value = false
        nextTick(() => {
            showProgressBar.value = true
        })
    })

    unbind2 = onTaskUpdated(data => {
        currentActionProgress.value = 0
        if (!isReorderMode.value) {
            lastTaskUpdateInfo.value = data
        }

        showProgressBar.value = false
        nextTick(() => {
            showProgressBar.value = true
        })
    })

    unbind3 = onNeedResetCurrentActionProgress(() => {
        currentActionProgress.value = 0

        if (!lastTaskUpdateInfo.value) {
            lastTaskUpdateInfo.value = taskQueue.value.at(0)!
        }

        showProgressBar.value = false
        nextTick(() => {
            showProgressBar.value = true
        })
    })

    unbind4 = onTaskDone((task) => {
        ElNotification({
            title: '任务已完成',
            type: 'success',
            message: `${getActionName(task.actionId)}${task.repeatCount == 1 ? '' : ' *' + task.repeatCount}`,
            duration: 3800
        })

        if (!isReorderMode.value) {
            emitGetTaskQueue()
        }
    })

    unbindReorderSuccess = onReorderTasksSuccess((data) => {
        ElNotification({
            title: '排序已保存',
            type: 'success',
            message: data.message,
            duration: 2000
        })
        isReordering.value = false
        isReorderMode.value = false
        // 重新获取队列以确保数据同步
        emitGetTaskQueue()
    })

    unbindReorderFailed = onReorderTasksFailed((data) => {
        ElNotification({
            title: '排序失败',
            type: 'error',
            message: data.message,
            duration: 3000
        })
        isReordering.value = false
        // 恢复原始排序
        localWaitingTasks.value = [...waitingTasks.value]
        isReorderMode.value = false
    })

    emitGetTaskQueue()

    timer = setInterval(updateProgress, 100);
})

function updateProgress() {
    if (!unref(taskQueue)?.length) {
        return;
    }

    const actionInfo = allGameAction[unref(currentActionId)];
    const lastTaskInfo = unref(lastTaskUpdateInfo) ?? unref(taskQueue).at(0);

    if (!lastTaskInfo) {
        currentActionProgress.value = 0;
        return;
    }

    const msAfterLastTaskUpdate = (Date.now() - (lastTaskInfo.lastSubtaskDoneTime ?? Date.now()));
    currentActionProgress.value = Math.max(0, Math.min((msAfterLastTaskUpdate / unref(allActionDuration)[actionInfo.id].final) * 100, 100));
}

onUnmounted(() => {
    if (timer) clearInterval(timer)

    unbind1?.()
    unbind2?.()
    unbind3?.()
    unbind4?.()

    // 添加重排序事件监听的清理
    unbindReorderSuccess?.()
    unbindReorderFailed?.()
})

const getActionIcon = (actionId: AllGameActionID) => {
    const action = allGameAction[actionId]
    return action ? action.icon : '❓'
}

const getActionName = (actionId: AllGameActionID) => {
    const action = allGameAction[actionId]
    return action ? action.name : '未知动作'
}

const removeFromQueue = (index: number) => {
    emitRemoveTask(index)
}

const calcExpectFinishTime = (task: GameTask, index: number) => {
    const calcTaskTotalTakeTime = (task: GameTask) => {
        const actionInfo = allGameAction[task.actionId]

        const totalNeedTime = (unref(allActionDuration)[actionInfo.id].final) * (task.repeatCount - task.currentRepeat)

        return totalNeedTime;
    }

    if (index == 0) {
        const finishDate = (task.lastSubtaskDoneTime ?? Date.now()) + calcTaskTotalTakeTime(task)

        return formatTime(new Date(finishDate))
    }

    let firstTask = unref(taskQueue).at(0)

    if (!firstTask) {
        return "未知"
    }

    let totalNeedTime = 0
    for (let i = 0; i <= index; i++) {
        let pTask = unref(taskQueue).at(i)

        if (!pTask) {
            continue
        }

        totalNeedTime += calcTaskTotalTakeTime(pTask)
    }

    const finishDate = (taskQueue.value[0].lastSubtaskDoneTime ?? Date.now()) + totalNeedTime

    return formatTime(new Date(finishDate))
}

const allActionResourceRequirement = useActionResourceReqiurement()
const totalFoodCost = computed(() => {
    return unref(taskQueue).reduce((sum, task) => {
        // 优先用修正后的消耗
        const reqArr = unref(allActionResourceRequirement)[task.actionId] || []
        // 查找修正后的饱食度消耗
        const satietyReq = reqArr.find(r => r.resourceId === "__satiety")
        const remainCount = (task.repeatCount - task.currentRepeat)
        if (satietyReq) {
            return sum + (satietyReq.final ?? 0) * remainCount
        }
        // 兼容无修正时的原始消耗
        const action = allGameAction[task.actionId]
        if (!action || !action.requirement?.resource) return sum
        const oriSatietyReq = action.requirement.resource.find(r => r.id === "__satiety")
        if (!oriSatietyReq) return sum
        return sum + oriSatietyReq.count * remainCount
    }, 0)
})

const getTaskSatietyCost = (task: GameTask) => {
    // 优先用修正后的消耗
    const reqArr = unref(allActionResourceRequirement)[task.actionId] || []
    const satietyReq = reqArr.find(r => r.resourceId === "__satiety")
    const remainCount = (task.repeatCount - task.currentRepeat)
    if (satietyReq) {
        return (satietyReq.final ?? 0) * remainCount
    }
    // 兼容无修正时的原始消耗
    const action = allGameAction[task.actionId]
    if (!action || !action.requirement?.resource) return 0
    const oriSatietyReq = action.requirement.resource.find(r => r.id === "__satiety")
    if (!oriSatietyReq) return 0
    return oriSatietyReq.count * remainCount
}

const currentSatiety = computed(() => {
    return unref(inventory).__satiety?.count ?? 0
})

const totalQueueFinishTime = computed(() => {
    if (!unref(taskQueue)?.length) return ""
    let totalNeedTime = 0
    for (const task of unref(taskQueue)) {
        const actionInfo = allGameAction[task.actionId]
        if (!actionInfo) continue
        const duration = unref(allActionDuration)[actionInfo.id]?.final ?? 0
        totalNeedTime += duration * (task.repeatCount - task.currentRepeat)
    }
    if (totalNeedTime === 0) return ""
    const finishDate = (taskQueue.value[0].lastSubtaskDoneTime ?? Date.now()) + totalNeedTime
    return formatTime(new Date(finishDate))
})

const thisActionDuration = computed(() => {
    let duration = allActionDuration.value[currentActionId.value]?.final ?? 0
    duration /= 1000;

    return `${duration.toFixed(2)}s`
})

</script>

<style lang="scss" scoped>
.task-card {
    margin: 0;
    padding: 0;
    transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
}

.drag-ghost {
    opacity: 0.5;
    background: #f3f4f6;
    border: 1.5px dashed #a5b4fc;
}

.drag-chosen {
    box-shadow: 0 0 8px 2px #6366f1;
    transform: scale(1.02);
    z-index: 10;
}

.drag-dragging {
    opacity: 0.8;
    background: #e0e7ff;
    transform: rotate(2deg);
}

.progress-bar__background {
    background-color: #ddd;
    height: 20px;
    border-radius: 4px;

    .progress-bar__bar {
        border-radius: 4px;

        height: 100%;
        background-color: var(--el-color-primary);

        animation-duration: var(--task-duration);
        animation-name: progress-bar-fill;
        animation-timing-function: linear;
    }
}

.progress-bar-inner-text {
    bottom: 2px;
    font-size: 12px;
    left: 50%;
    transform: translateX(-50%);
    mix-blend-mode: difference;
    color: #9e9e9e;
}

@keyframes progress-bar-fill {
    0% {
        width: 0%;
    }

    100% {
        width: 100%;
    }
}
</style>

<style lang="scss">
.progress-bar {
    transform: scaleX(var(--progress));
}
</style>