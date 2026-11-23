<template>
  <div
    class="bg-gradient-to-br from-white via-yellow-50/30 to-orange-50/30 dark:from-gray-800 dark:via-yellow-900/20 dark:to-orange-900/20 rounded-2xl shadow-xl border border-yellow-100 dark:border-yellow-700/30 p-6 mb-6 backdrop-blur-sm">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center space-x-3 mb-6">
        <div
          class="w-10 h-10 bg-gradient-to-br from-yellow-200 to-orange-200 rounded-xl flex items-center justify-center">
          <span class="text-white text-xl">🐱</span>
        </div>
        <div>
          <h3 class="text-xl font-bold text-gray-800 dark:text-gray-200">小猫咪助手队列</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">你的可爱助手们正在努力工作</p>
        </div>


      </div>
      <!-- 排序模式控制按钮 -->
      <div v-if="waitingTasks.length > 1" class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-2">
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

    <div class="space-y-3">
      <!-- 空状态 -->
      <div v-if="taskQueue.length === 0" class="text-center py-6">
        <div v-if="isKittyFishing">
          <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span class="text-white text-2xl">🎣</span>
          </div>
          <h3 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{{ kitty.name }} 正在垂钓</h3>
        </div>
        <div v-else-if="kitty.isInExpedition">
          <div class="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span class="text-white text-2xl">🗺️</span>
          </div>
          <h3 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{{ kitty.name }} 正在外出探险</h3>
        </div>
        <div v-else>
          <div class="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span class="text-white text-2xl">😴</span>
          </div>
          <h3 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{{ kitty.name }} 正在休息</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">为它安排一些任务吧！ ฅ(^ω^ฅ)</p>
        </div>
      </div>

      <!-- 猫咪状态概览 - 移动端优化 -->
      <div v-if="taskQueue.length > 0">
        <template v-if="isKittyFishing">
          <div class="flex flex-col items-center w-full mb-4">
            <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex flex-col items-center justify-center mx-auto mb-3">
              <span class="text-white text-2xl">🎣</span>
            </div>
            <h3 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{{ kitty.name }} 正在垂钓</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 font-bold">垂钓归来后的1分钟内，队列将恢复执行</p>
          </div>
        </template>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4" v-else>
          <!-- 猫咪名字 -->
          <div class="bg-white dark:bg-gray-700 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700/30">
            <div class="flex items-center space-x-2">
              <div
                class="w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-md flex items-center justify-center flex-shrink-0">
                <span class="text-white text-xs">🐱</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-xs text-gray-500 dark:text-gray-400">猫咪</div>
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">{{ kitty.name }}</div>
              </div>
            </div>
          </div>

          <!-- 饱食度状态 -->
          <div class="bg-white dark:bg-gray-700 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700/30">
            <div class="flex items-center space-x-2">
              <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" :class="{
              'bg-green-100 dark:bg-green-900': true || kitty.satiety >= 30,
              'bg-red-100 dark:bg-red-900': false && kitty.satiety < 30
            }">
                <span class="text-xs text-green-600 dark:text-green-400">🍖</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-xs text-gray-500 dark:text-gray-400">饱食度</div>
                <div class="text-sm font-semibold" :class="{
                'text-green-600 dark:text-green-400': kitty.satiety >= 30,
                'text-red-600 dark:text-red-400': kitty.satiety < 30 
              }">{{ kitty.satiety.toFixed(0) }} / {{ kitty.maxSatiety }}</div>
              </div>
            </div>
          </div>

          <!-- 预计完成时间 - 在移动端占用完整宽度 -->
          <div
            class="col-span-2 sm:col-span-1 bg-white dark:bg-gray-700 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700/30">
            <div class="flex items-center space-x-2">
              <div
                class="w-6 h-6 bg-orange-100 dark:bg-orange-900 rounded-md flex items-center justify-center flex-shrink-0">
                <span class="text-orange-600 dark:text-orange-400 text-xs">⏰</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-xs text-gray-500 dark:text-gray-400">预计完成</div>
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">{{ totalFinishTime || '无'
                  }}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      <!-- 任务卡片列表 -->
      <div class="space-y-2">
        <!-- 执行中的任务 - 不参与排序 -->
        <div v-if="currentExecutingTask"
          class="group relative overflow-hidden rounded-lg border transition-all duration-300 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-200/30 dark:to-orange-200/30 border-yellow-200 dark:border-yellow-700 shadow-sm"
          :class="{ 'opacity-75': isReorderMode }">

          <!-- 执行中的动画背景 -->
          <div class="absolute inset-0 bg-gradient-to-r from-yellow-400/5 to-orange-400/5"></div>

          <!-- 排序模式提示 -->
          <div v-if="isReorderMode" class="absolute top-2 right-2 z-10">
            <div class="w-6 h-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <span class="text-gray-400 dark:text-gray-500 text-xs">🔒</span>
            </div>
          </div>

          <div class="relative p-3">
            <!-- 移动端紧凑布局 -->
            <div class="flex items-center space-x-3">
              <!-- 任务图标 -->
              <div class="relative flex-shrink-0">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-yellow-200 to-orange-200">
                  <GameCommonSimpleActionNameAndIcon :icon-size="8" :action-id="currentExecutingTask.actionId"
                    :hide-name="true" class="text-white" />
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
                  <span class="text-xs bg-yellow-500 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
                    执行中
                  </span>
                </div>

                <div class="flex items-center justify-between">
                  <div class="text-xs text-gray-600 dark:text-gray-400">
                    {{ currentExecutingTask.currentRepeat + 1 }}/{{ currentExecutingTask.repeatCount }}
                  </div>

                  <div class="hidden md:flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>⏰ {{ calcExpectFinishTime(currentExecutingTask, 0) }}</span>
                  </div>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="flex-shrink-0" v-if="!isReorderMode">
                <el-button size="small" type="danger" @click="removeFromQueue(0)" class="!px-2 !py-1 text-xs rounded-md"
                  plain>
                  终止
                </el-button>
              </div>
            </div>

            <!-- 移动端显示详细信息 -->
            <div class="md:hidden mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>⏰ {{ calcExpectFinishTime(currentExecutingTask, 0) }}</span>
                <span>耗时: {{ currentActionDuration }}s</span>
              </div>
            </div>

            <!-- 进度条 - 移动端优化 -->
            <div v-if="showProgressBar && !!currentActionInQueue" class="mt-3">
              <div class="relative">
                <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-yellow-300 to-orange-300 rounded-full transition-all duration-300 ease-out origin-left progress-bar"
                    :style="{ '--progress': currentActionProgress / 100 }"></div>
                </div>
                <div class="mt-1 text-center">
                  <span class="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {{ Math.round(currentActionProgress) }}% ({{ currentActionDuration }}s)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 等待中的任务 - 可拖拽排序 -->
        <draggable v-if="waitingTasks.length > 0" :disabled="!isReorderMode" v-model="localWaitingTasks"
          class="flex flex-col gap-y-2" @end="onDragEnd" :item-key="getSortItemKey" handle=".task-card" :animation="220"
          :ghost-class="'drag-ghost'" :chosen-class="'drag-chosen'" :drag-class="'drag-dragging'">
          <template #item="{ element: task, index }">
            <div
              class="group relative overflow-hidden rounded-lg border transition-all duration-300 task-card bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
              :class="{
                'cursor-move border-orange-300 dark:border-orange-600': isReorderMode,
              }">
              <!-- 排序模式提示 -->
              <div v-if="isReorderMode" class="absolute top-2 right-2 z-10">
                <div class="w-6 h-6 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                  <span class="text-orange-600 dark:text-orange-400 text-xs">⇅</span>
                </div>
              </div>

              <div class="relative p-3">
                <!-- 移动端紧凑布局 -->
                <div class="flex items-center space-x-3">
                  <!-- 任务图标 -->
                  <div class="relative flex-shrink-0">
                    <div
                      class="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                      <GameCommonSimpleActionNameAndIcon :icon-size="14" :action-id="task.actionId" :hide-name="true"
                        class="text-white" />
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
                        <span v-if="task.currentRepeat">（已完成 {{ task.currentRepeat }}）</span>
                      </div>

                      <div class="hidden md:flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>⏰ {{ calcExpectFinishTime(task, index + 1) }}</span>
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
                <div class="md:hidden mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
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
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue'
import { allGameAction } from '~/shared/data/allGameActions'
import { formatTime } from '~/shared/utils'
import { useActionDuration } from '~/composables/game/useActionDuration'
import type { AllGameActionID } from '~/shared/types/gameAction'
import type { Kitty } from '~/shared/types/kitty'
import { emitRemoveKittyTask, emitReorderKittyTasks, onReorderKittyTasksSuccess, onReorderKittyTasksFailed } from '~/api/game/socket/kitty'
import { useKittyFurniture } from '~/composables/game/useKittyFurniture'
import type { FuncAction } from '~/shared/types'
import draggable from 'vuedraggable'
import { waitUtilConnected } from '~/api/game/socket/socket'
import useKittyTraits from '~/composables/game/useKittyTraits'
import allKittyTraits from '~/shared/data/kittyTraits'
import useFishing from '~/composables/game/useFishing'

const props = defineProps<{
  kitty: Kitty
  taskQueue: GameTask[]
}>()

const { hasActiveSession, getMyActiveSession, myActiveSession } = useFishing()

const isKittyFishing = computed(() => {
  return Boolean(hasActiveSession.value && myActiveSession.value?.actorType === 'KITTY' && myActiveSession.value?.actorId === props.kitty.uuid)
})

const kittyTraits = useKittyTraits();

const currentActionProgress = ref(0)
const showProgressBar = ref(false)
const allActionDuration = useActionDuration()
const kittyFurniture = useKittyFurniture()

// 排序相关状态
const isReorderMode = ref(false)
const isReordering = ref(false)
const localWaitingTasks = ref<GameTask[]>([])

// 分离执行中任务和等待任务
const currentExecutingTask = computed(() => {
  return props.taskQueue[0] || null
})

const waitingTasks = computed(() => {
  return props.taskQueue.slice(1)
})

// 监听等待任务变化，同步到本地排序队列
watch(waitingTasks, (val) => {
  localWaitingTasks.value = [...val]
}, { immediate: true })

const currentActionInQueue = computed(() => props.taskQueue[0])
const currentActionId = computed(() => props.taskQueue[0]?.actionId)

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

    // 调用后端API来重新排序猫咪任务队列
    emitReorderKittyTasks(props.kitty.uuid, newIndexOrder)

    // 注意：不在这里设置 isReorderMode.value = false
    // 等待后端响应后再处理

  } catch (error) {
    console.error('猫咪队列排序错误:', error)
    ElNotification({
      title: '排序失败',
      type: 'error',
      message: '保存猫咪队列排序时出错，请重试',
      duration: 3000
    })
    isReordering.value = false
  }
}

const onDragEnd = () => {
  // 拖拽结束时的处理逻辑
  // console.log('猫咪等待任务重排序:', localWaitingTasks.value.map(t => t.actionId))
}

const getSortItemKey = (item: GameTask) => {
  return getTaskUniqueId(item)
}

const updateQueue = () => {
  currentActionProgress.value = 0
  showProgressBar.value = false
  nextTick(() => { showProgressBar.value = true })
}

const lastTaskUpdateInfo = computed(() => {
  return props.taskQueue[0] || null
})

// 计算总完成时间
const totalFinishTime = computed(() => {
  if (!props.taskQueue.length) return ""

  let totalNeedTime = 0
  for (const task of props.taskQueue) {
    const actionInfo = allGameAction[task.actionId]
    if (!actionInfo) continue
    const duration = allActionDuration.value[actionInfo.id]?.base ?? 0
    totalNeedTime += duration * (task.repeatCount - task.currentRepeat)
  }

  if (totalNeedTime === 0) return ""
  const finishDate = (props.taskQueue?.[0].lastSubtaskDoneTime ?? Date.now()) + totalNeedTime
  return formatTime(new Date(finishDate))
})

watch(() => props.taskQueue, (newQueue) => {
  updateQueue()
})

let timer: any = null
onMounted(async () => {
  await waitUtilConnected()

  updateQueue()

  getMyActiveSession()

  // 监听重排序结果
  unbindReorderSuccess = onReorderKittyTasksSuccess((data) => {
    // 只处理当前猫咪的重排序结果
    if (data.kittyUuid === props.kitty.uuid) {
      ElNotification({
        title: '排序已保存',
        type: 'success',
        message: data.message,
        duration: 2000
      })
      isReordering.value = false
      isReorderMode.value = false
      // 队列会通过props自动更新，不需要手动刷新
    }
  })

  unbindReorderFailed = onReorderKittyTasksFailed((data) => {
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

  timer = setInterval(updateProgress, 100)
})

function updateProgress() {
  if (!props.taskQueue.length) {
    return
  }
  const actionInfo = allGameAction[currentActionId.value]
  const lastTaskInfo = lastTaskUpdateInfo.value ?? props.taskQueue[0]
  if (!lastTaskInfo) {
    currentActionProgress.value = 0
    return
  }
  const msAfterLastTaskUpdate = (Date.now() - (lastTaskInfo.lastSubtaskDoneTime ?? Date.now()))
  currentActionProgress.value = Math.max(
    0,
    Math.min(
      (msAfterLastTaskUpdate / ((+currentActionDuration.value * 1000) || allActionDuration.value[actionInfo.id].base)) * 100,
      100
    )
  )
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
  // 清理重排序事件监听器
  unbindReorderSuccess?.()
  unbindReorderFailed?.()
})

const getActionIcon = (actionId: AllGameActionID) => allGameAction[actionId]?.icon || '❓'
const getActionName = (actionId: AllGameActionID) => allGameAction[actionId]?.name || '未知动作'

const removeFromQueue = (index: number) => {
  emitRemoveKittyTask(props.kitty.uuid, index)
}

const calcExpectFinishTime = (task: GameTask, index: number) => {
  const calcTaskTotalTakeTime = (task: GameTask) => {
    const actionInfo = allGameAction[task.actionId]

    const totalNeedTime = (allActionDuration.value[actionInfo.id].base) * (task.repeatCount - task.currentRepeat)

    return totalNeedTime
  }

  if (index == 0) {
    const finishDate = (task.lastSubtaskDoneTime ?? Date.now()) + calcTaskTotalTakeTime(task)

    return formatTime(new Date(finishDate))
  }

  let totalNeedTime = 0
  for (let i = 0; i <= index; i++) {
    let pTask = props.taskQueue[i]
    if (!pTask) continue
    totalNeedTime += calcTaskTotalTakeTime(pTask)
  }
  const finishDate = (props.taskQueue?.[0].lastSubtaskDoneTime ?? Date.now()) + totalNeedTime
  return formatTime(new Date(finishDate))
}

const currentActionDuration = computed(() => {
  if (!currentActionInQueue.value?.actionId) return 0

  let base = allActionDuration.value[currentActionInQueue.value.actionId]?.base
  if (!base) return 0

  let modify = 0

  if (kittyFurniture.value.length > 0) {
    const hasScratchingPost = kittyFurniture.value.some(f => f.isActive && f.furnitureId === 'scratchingPost')
    const hasCashmereToy = kittyFurniture.value.some(f => f.isActive && f.furnitureId === 'furnitureCashmereToy')
    const hasSilkKittyNest= kittyFurniture.value.some(f => f.isActive && f.furnitureId === 'silkKittyNest')

    if (hasScratchingPost) {
      modify += (base * 0.03)
    }

    if (hasSilkKittyNest) {
      modify += (base * 0.02)
    }

    if (hasCashmereToy) {
      modify += (base * 0.02)
    }
  }

  let fromTraitsModify = 0;
  const traits = kittyTraits.state.value[props.kitty.uuid];
  if (traits && traits.length) {
    for (const trait of traits) {
      const traitDef = allKittyTraits[trait.traitId];
      if (traitDef && traitDef.extraActionDurationDecrease) {
        const dec = traitDef.extraActionDurationDecrease({
          actionId: currentActionId.value,
          oriDuration: base,
          kittyUuid: props.kitty.uuid,
          kittyName: props.kitty.name,
          owner: props.kitty.owner,
          traitLevel: trait.level,
          requestDecreaseMood: async () => {},
          requestIncreaseMood: async () => {},
        });
        fromTraitsModify += dec;
      }
    }
  }

  let fromMoodModify = 0;
  if (props.kitty.mood >= 90) {
    fromMoodModify += base * 0.02;
  }
  if (props.kitty.mood >= 140) {
    fromMoodModify += base * 0.03;
  }
  if (props.kitty.mood >= 180) {
    fromMoodModify += base * 0.03;
  }

  if (props.kitty.mood <= 10) {
    fromMoodModify -= base * 0.5;
  }

  return ((base - modify - fromTraitsModify - fromMoodModify) / 1000).toFixed(2)
})
</script>

<style scoped>
.task-card {
  margin: 0;
  padding: 0;
  transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
}

.drag-ghost {
  opacity: 0.5;
  background: #fef3c7;
  border: 1.5px dashed #f59e0b;
}

.drag-chosen {
  box-shadow: 0 0 8px 2px #f59e0b;
  transform: scale(1.02);
  z-index: 10;
}

.drag-dragging {
  opacity: 0.8;
  background: #fef3c7;
  transform: rotate(2deg);
}

.progress-bar-inner-text {
  bottom: 2px;
  font-size: 12px;
  left: 50%;
  transform: translateX(-50%);
  mix-blend-mode: difference;
  color: #9e9e9e;
}
.progress-bar {
    transform: scaleX(var(--progress));
}
</style>