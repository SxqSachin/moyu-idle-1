<template>
    <div v-if="action && !action.hidden">
        <div 
            class="group relative p-4 w-20 h-20 rounded-xl shadow-md hover:shadow-xl transition-all bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/40 border-blue-200/50 dark:border-blue-700/50 duration-300 cursor-pointer border hover:scale-105 hover:-translate-y-1"
            :class="{
                'opacity-60': !baseRequirePass
            }"
            @click="handleActionClick"
            v-if="!onlyCard"
        >
            <!-- 背景装饰圆圈 -->
            <div class="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
            
            <!-- 动作图标容器 -->
            <div class="relative flex w-full h-12 items-center justify-center mb-1">
                <div class="relative z-10 transform group-hover:scale-110 transition-transform duration-300">
                    <GameCommonSimpleActionNameAndIcon 
                        :icon-size="15" 
                        :action-id="action.id" 
                        :hide-name="true"
                    />
                </div>
                
                <!-- 图标背景光环 -->
                <div class="absolute inset-0 bg-blue-400/20 dark:bg-blue-300/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>

            <!-- 动作名称 - 修复长文本显示问题 -->
            <div class="absolute left-1/2 top-19 transform -translate-x-1/2 z-20 min-w-max">
                <span class=" inline-block max-w-24 break-all whitespace-normal text-xs text-center font-medium  px-2 py-1 rounded-xl shadow-md backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50"
                :class="{
                    'text-gray-700 dark:text-gray-300 bg-white/90 dark:bg-gray-800/90': baseRequirePass,
                    'text-gray-400 dark:text-gray-600': !baseRequirePass
                }"
                >
                    {{ action.name }}
                </span>
            </div>

            <!-- 状态指示器 -->
            <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs z-10">
                <!-- <template v-if="canPerformAction">
                    <div class="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-sm"></div>
                </template> -->
                <!-- <template v-else>
                    <div class="w-3 h-3 bg-gray-400 dark:bg-gray-600 rounded-full"></div>
                </template> -->
            </div>

            <!-- 悬停时的特效 -->
            <div class="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
        </div>

        <!-- 使用 Tailwind 样式的弹窗 -->
        <el-dialog 
            v-model="showActionDialog" 
            :title="action.name" 
            width="400px"
            align-center
            class="cute-action-dialog p-0"
            body-class="bg-white dark:bg-gray-800"
            append-to-body
            @close="dialogClose"
        >
            <!-- 可爱的猫咪装饰 - 趴在弹窗顶部 -->
            <div class="absolute -top-9 left-4 z-10 pointer-events-none">
                <img 
                    :src="dialogKitty"
                    alt="cute cat" 
                    class="w-28 h-28 object-contain drop-shadow-lg"
                />
                <!-- 猫咪的阴影 -->
                <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-12 h-2 bg-black/10 dark:bg-white/10 rounded-full blur-sm"></div>
            </div>

            <!-- 弹窗内容 -->
            <div class="relative z-1 space-y-4">
                <!-- 需求信息 - 紧凑布局 -->
                 <GameActionCardInfo 
                    :action="action" 
                    :building-info="buildingInfo" 
                    :status-info="characterStatusInfo" 
                    :inventory="inventory"
                    class="mb-4"
                    ></GameActionCardInfo>

                <div class="border-t border-gray-200 dark:border-gray-600 my-3"></div>

                <!-- 执行控制 -->
                <div class="space-y-3">
                    <!-- 执行次数输入 -->
                    <div class="flex items-center space-x-2">
                        <span class="text-sm w-12 shrink-0 text-gray-700 dark:text-gray-300">执行</span>
                        <el-input 
                            v-model="repeatCounts" 
                            size="small" 
                            class="flex-1" 
                            min="0"
                            placeholder="次数" 
                        />
                        <span class="text-sm text-gray-700 dark:text-gray-300">次</span>
                    </div>
                    
                    <!-- 快速操作按钮 -->
                    <div class="space-y-2">
                        <div class="text-xs text-gray-500 dark:text-gray-400">快速操作:</div>
                        <div class="grid grid-cols-3 gap-2">
                            <el-button 
                                plain 
                                type="primary" 
                                size="small" 
                                @click="repeatCounts = +repeatCounts + 10" 
                                class="text-xs bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/40"
                            >
                                +10
                            </el-button>
                            <el-button 
                                plain 
                                type="primary" 
                                size="small" 
                                @click="repeatCounts = +repeatCounts + 100" 
                                class="text-xs bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/40"
                            >
                                +100
                            </el-button>
                            <el-button 
                                plain 
                                type="primary" 
                                size="small" 
                                @click="repeatCounts = +repeatCounts + 1000" 
                                class="text-xs bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/40"
                            >
                                +1000
                            </el-button>
                        </div>
                        <div class="flex flex-row justify-between flex-wrap gap-2">
                            <el-button 
                                plain 
                                type="primary" 
                                size="small"
                                @click="repeatCounts = +repeatCounts + calcActionCountByDuration(action.id, 30)" 
                                class="flex-1 text-xs bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-800/40"
                            >
                                +30分钟
                            </el-button>
                            <el-button 
                                plain 
                                type="primary" 
                                size="small"
                                @click="repeatCounts = +repeatCounts + calcActionCountByDuration(action.id, 60)" 
                                class="flex-1 text-xs bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-800/40"
                            >
                                +1小时
                            </el-button>
                            <el-button 
                                plain 
                                type="primary" 
                                size="small"
                                @click="repeatCounts = +repeatCounts + calcActionCountByDuration(action.id, 240)" 
                                class="flex-1 text-xs bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-800/40"
                            >
                                +4小时
                            </el-button>
                            <el-button 
                                plain 
                                type="primary" 
                                size="small"
                                @click="repeatCounts = +repeatCounts + calcActionCountByDuration(action.id, 480)" 
                                class="flex-1 text-xs bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-800/40"
                            >
                                +8小时
                            </el-button>
                        </div>
                    </div>

                    <!-- 预计耗时显示 -->
                    <div 
                        v-if="repeatCounts > 0" 
                        class="text-xs text-center text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                    >
                        <span class="font-medium">预计耗时：</span>
                        <span class="text-blue-600 dark:text-blue-400 font-bold">
                            {{ formatDuration(repeatCounts * allActionDuration[action.id].final) }}
                        </span>
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div class="space-y-3">
                    <div class="grid gap-2" :class="actionQueue.length ? 'grid-cols-2' : 'grid-cols-1'">
                        <el-button 
                        v-if="!actionQueue.length"
                            :type="canPerformAction ? 'primary' : 'info'" 
                            :plain="!canPerformAction"
                            @click="e => addSingleTaskToQueue(e, action.id, repeatCounts)" 
                            size="small"
                            :disabled="!canPerformAction"
                            class="rounded-lg font-medium transition-all duration-200 hover:shadow-md"
                        >
                            🚀 开始
                        </el-button>

                        <el-button 
                            v-if="!!actionQueue.length"
                            type="primary" 
                            @click="e => addSingleTaskToQueue(e, action.id, repeatCounts)" 
                            size="small"
                            class="rounded-lg font-medium transition-all duration-200 hover:shadow-md"
                        >
                            📝 加入队列
                        </el-button>

                        <el-button 
                            v-if="!!actionQueue.length" 
                            :type="canPerformAction ? 'primary' : 'info'"
                            :plain="!canPerformAction" 
                            @click="e => immediatelyStartTask(e, action.id, repeatCounts)"
                            size="small"
                            :disabled="!canPerformAction"
                            class="rounded-lg font-medium transition-all duration-200 hover:shadow-md"
                        >
                            ⚡ 立即开始
                        </el-button>
                    </div>

                    <!-- 小猫咪助手 -->
                    <template v-if="kittyList.length && !action.banToKitty">
                        <div class="border-t border-gray-200 dark:border-gray-600 my-3"></div>
                        <div class="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-700/30">
                            <div class="flex items-center mb-3">
                                <span class="text-sm font-bold text-yellow-600 dark:text-yellow-400 mr-2">
                                    🐱 小猫咪助手
                                </span>
                                <div class="flex-1 h-px bg-gradient-to-r from-yellow-300 to-transparent"></div>
                            </div>
                            <div class="flex gap-2">
                                <el-select 
                                    v-model="selectedKittyUuid" 
                                    placeholder="选择小猫咪" 
                                    class="flex-1" 
                                    size="small"
                                >
                                    <el-option
                                        v-for="kitty in kittyList"
                                        :key="kitty.uuid"
                                        :label="kitty.name"
                                        :value="kitty.uuid"
                                    />
                                </el-select>
                                <el-button
                                    type="success"
                                    size="small"
                                    :disabled="!selectedKittyUuid || repeatCounts < 1"
                                    @click="assignTaskToKitty"
                                    class="rounded-lg font-medium bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 border-0 shadow-sm"
                                >
                                    🎯 指派
                                </el-button>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { GameCommonRequirementLabel } from '#components';
import { emitAddTask, emitImmediatelyStartTask } from '~/api/game/socket/taskQueue';
import { useActionDuration } from '~/composables/game/useActionDuration';
import { useCharacterBuildingInfo } from '~/composables/game/useCharacterBuildingInfo';
import { useCharacterStatusInfo } from '~/composables/game/useCharacterStatusInfo';
import { useInventory } from '~/composables/game/useInventory';
import { useTaskQueue } from '~/composables/game/useTaskQueue';
import { allGameAction, allGameActionMainType } from '~/shared/data/allGameActions';
import { type AllGameActionID, type GameAction, type GameActionReward } from '~/shared/types/gameAction'
import type { GameTask } from '~/shared/types/gameTask';
import { clone, formatDuration } from '~/shared/utils';
import { requirementCheck } from '~/shared/utils/game/requirementCheck';

// 新增：小猫咪相关
import { useKittyInfo } from '~/composables/game/useKittyInfo'
import { emitAddKittyTask, emitGetKittyAllTask } from '~/api/game/socket/kitty';
import { useActionResourceReqiurement } from '~/composables/game/useActionResourceReqiurement';
import { useWorkingTavern } from '~/composables/game/useTavern';
import allTalentCat from '~/shared/data/allTalentCat';

import dialogKitty from '~/assets/images/dialog_kitty_1.png'
import { useCharacterWorkEquipment } from '~/composables/game/useCharacterEquipment';
import { iteratorWorkEquipment } from '~/shared/utils/game/equipment';

const tavernExpert = useWorkingTavern()
const device = useDevice()
const workEquipment = useCharacterWorkEquipment()

const props = defineProps<{
    action: GameAction
    defaultRepeatCount?: number
    onlyCard?: boolean
}>()

const emits = defineEmits<{
    (e: 'dialog-close'): void
}>()

const allActionDuration = useActionDuration()
const allActionResourceRequirement = useActionResourceReqiurement()

const actionQueue = useTaskQueue()
const repeatCounts = ref<number>(props.defaultRepeatCount ?? 1)
const inventory = useInventory()
const characterStatusInfo = useCharacterStatusInfo()
const buildingInfo = useCharacterBuildingInfo()

// 弹窗控制
const showActionDialog = ref(props.onlyCard)
const handleActionClick = () => {
    showActionDialog.value = true
}
// 在对话框打开时重置次数
watch(showActionDialog, (newVal) => {
    if (newVal) {
        repeatCounts.value = props.defaultRepeatCount ?? 1
    }
})

const action = computed<GameAction>(() => {
    return props.action;
    const actionClone = clone(props.action)
    const actionId =props.action.id 

    // let actualReward: Readonly<GameActionReward[]> = actionClone.rewards ?? []
    // let extraReward: Readonly<GameActionReward[]> = [];

    // if (workEquipment) {
    //     iteratorWorkEquipment(workEquipment.value, ({ equipmentId, equipmentTrigger }) => {
    //         // 检查装备是否有有覆盖效果
    //         const overrideReward = equipmentTrigger?.overrideRewardOnActionFinish?.({ actionId }) ?? null
    //         if (overrideReward) {
    //             actualReward = overrideReward
    //         }

    //         // 检查额外奖励
    //         const extra = equipmentTrigger?.extraRewardOnActionFinish?.({ actionId }) ?? null
    //         if (extra) {
    //             extraReward = [...extraReward, ...extra]
    //         }
    //     })
    // }

    // actualReward = clone([...actualReward, ...extraReward])
    // actionClone.rewards = actualReward



    // for (const expert of tavernExpert) {
    //     const expertInfo = allTalentCat.find(cat => cat.id === expert.type as any)

    //     if (!expertInfo) continue

    //     let expertActions = Object.keys(expertInfo?.actionOverride ?? {})

    //     if (clone(expertActions).includes(props.action.id)) {

    //         expertActions.some(actionId => {
    //             if (actionId == props.action.id) {

    //                 actionClone.rewards = [...(actionClone.rewards ?? []), ...(expertInfo.actionOverride?.[actionId].rewards ?? [])]

    //                 actionClone.characterImprove = [...(actionClone.characterImprove ?? []), ...(expertInfo.actionOverride?.[actionId].characterImprove ?? [])]

    //                 // actionClone.baseDuration = expertInfo.actionOverride?.[actionId].baseDuration || actionClone.baseDuration

    //                 return true
    //             }
    //         })
    //     }
    // }

  return actionClone
})
const canPerformAction = computed(() => {
    return requirementCheck(action.value.id, action.value.requirement, {
        characterActionResourceRequirement: unref(allActionResourceRequirement),
        characterInventory: unref(inventory),
        buildingInfo: unref(buildingInfo),
        characterStatusInfo: unref(characterStatusInfo),
    })
})

const baseRequirePass = computed(() => {
    return requirementCheck(action.value.id, action.value.requirement, {
        characterActionResourceRequirement: unref(allActionResourceRequirement),
        characterInventory: unref(inventory),
        buildingInfo: unref(buildingInfo),
        characterStatusInfo: unref(characterStatusInfo),
    }, {
        withoutResourceCheck: true
    })
})

// 小猫咪相关
const kittyList = useKittyInfo()
const selectedKittyUuid = ref<string | undefined>(kittyList.value[0]?.uuid)

const addSingleTaskToQueue = (e: Event, action: AllGameActionID, count: number) => {
    if (!e.isTrusted) return; // 忽略脚本触发
    count = +count
    if (!count || !Number.isInteger(count) || count <= 0) {
        ElMessage.warning({
            message: "请输入有效的正整数次数"
        })
        return
    }
    const task: GameTask = {
        actionId: action,
        repeatCount: count,
        currentRepeat: 0,
        createTime: Date.now(),
    }
    emitAddTask(task)

    if (device.isMobile) {
        ElMessage({
            type: 'success',
            message: `已添加至队列: ${allGameAction[action].name} * ${count} 次`,
            duration: 3800
        })
    } else {
        ElNotification({
            title: '已添加至队列',
            type: 'success',
            message: `${allGameAction[action].name} * ${count} 次`,
            duration: 3800
        })
    }

    dialogClose()
}

const immediatelyStartTask = (e: Event, action: AllGameActionID, count: number) => {
    if (!e.isTrusted) return; // 忽略脚本触发
    count = +count
    if (!count || !Number.isInteger(count) || count <= 0) {
        ElMessage.warning({
            message: "请输入有效的正整数次数"
        })
        return
    }
    const task: GameTask = {
        actionId: action,
        repeatCount: count,
        currentRepeat: 0,
        createTime: Date.now(),
    }
    emitImmediatelyStartTask(task)

    dialogClose()
}

// 新增：指派给小猫咪
const assignTaskToKitty = (e: Event) => {
    if (!e.isTrusted) return; // 忽略脚本触发
    repeatCounts.value = +repeatCounts.value
    if (!selectedKittyUuid.value || repeatCounts.value < 1) {
        ElMessage.warning('请选择小猫咪并输入有效次数')
        return
    }

    if (!repeatCounts.value || !Number.isInteger(repeatCounts.value) || repeatCounts.value <= 0) {
        ElMessage.warning({
            message: "请输入有效的正整数次数"
        })
        return
    }

    const task: GameTask = {
        actionId: action.value.id,
        repeatCount: repeatCounts.value,
        currentRepeat: 0,
        createTime: Date.now(),
    }
    emitAddKittyTask(selectedKittyUuid.value, task)

    dialogClose()
}

const calcActionCountByDuration = (actionId: AllGameActionID, minutes: number) => {
    let duration = allActionDuration.value?.[actionId]?.final ?? unref(action).baseDuration

    const actionDuration = duration / 1000
    return ~~((minutes * 60) / actionDuration)
}

const dialogClose = () => {
    showActionDialog.value = false;
    emits('dialog-close')
}
</script>

<style lang="scss">
/* 保留一些基础的弹窗样式，其余使用 Tailwind */
.cute-action-dialog {
    padding: 0 !important;
    background-color: transparent;
  .el-dialog {
    border-radius: 20px;
    overflow: visible;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
    position: relative;
    max-height: 90vh;
  }
  
  .el-dialog__header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 20px 20px 0 0;
    padding: 12px;
    text-align: center;
  }
  
  .el-dialog__title {
    font-size: 1.1rem;
    font-weight: bold;
    color: white;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .el-dialog__body {
    padding: 20px;
    border-radius: 0 0 20px 20px;
    max-height: calc(90vh - 120px);
    overflow-y: auto;
  }
}

/* 暗色模式弹窗样式 */
.dark .cute-action-dialog {
  .el-dialog {
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  }
  
  .el-dialog__header {
    background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
  }
  
  .el-dialog__body {
    background: linear-gradient(145deg, #2c3e50 0%, #34495e 100%);
  }
}

/* 简化的动画 */
@keyframes catBounce {
  0%, 100% { transform: translateY(0px) rotate(-2deg); }
  50% { transform: translateY(-8px) rotate(2deg); }
}

.cute-action-dialog .el-dialog {
  animation: dialogSlideIn 0.3s ease-out;
}

@keyframes dialogSlideIn {
  0% {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>