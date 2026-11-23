<template>
    <div class="flex flex-col justify-between h-full" v-if="action && !action.hidden">

        <div class="flex justify-between flex-col">
            <div class="text-center w-full">
                <template v-if="action.icon.includes(':')">
                    <div class="mb-2">
                        <img class="inline w-14 h-14" :src="getIconPath(action.icon)"></img>
                    </div>
                </template>
                <template v-else>
                    <div class="text-4xl mb-2">{{ action.icon }}</div>
                </template>
                <h3 class="text-xl font-bold text-gray-800 dark:text-gray-200 ">{{ action.name }}</h3>
                <p class="text-gray-600 dark:text-gray-400  text-sm">{{ action.description }}</p>
            </div>

            <div class="flex flex-col w-full mt-4 ">
                <GameCommonRequirementLabel label="耗时" :action="action" :show-duration="true">
                </GameCommonRequirementLabel>

                <template
                    v-if="action.requirement && (action.requirement.building || action.requirement.characterStatus)">
                    <GameCommonRequirementLabel label="需求" :action="action" :character-building-info="buildingInfo"
                        :character-status-info="characterStatusInfo">
                    </GameCommonRequirementLabel>
                </template>

                <template v-if="action.requirement?.resource">
                    <GameCommonResourceRequirementLabel :action-id="action.id" :inventory="inventory"></GameCommonResourceRequirementLabel>
                </template>

                <template v-if="action.rewards?.length">
                    <GameCommonRequirementLabel label="获得" :action="action" :show-reward="true">
                    </GameCommonRequirementLabel>
                </template>

                <template v-if="action.characterImprove">
                    <GameCommonRequirementLabel label="提升" :action="action" :show-improve="true">
                    </GameCommonRequirementLabel>
                </template>
            </div>
        </div>

        <!-- 动作按钮 -->
        <div class="space-y-2">
            <!-- 单次执行 -->
            <el-divider class="my-4! md:my-4!" />

            <!-- 重复执行 -->
            <div class="flex flex-col md:flex-col items-start">
                <div class="flex h-8">
                    <el-text class="mx-1 w-16">执行</el-text>
                    <el-input v-model="repeatCounts" size="small" class="flex-1 mr-2" min="0" placeholder="次数" />
                    <el-text class="mx-1">次</el-text>
                </div>
                <div class="flex mt-4">
                    <el-text class="mx-1 w-16">快速操作: </el-text>
                    <div class="flex flex-col">

                        <div class="flex flex-wrap gap-2">
                            <el-button plain type="primary" size="small" @click="repeatCounts = +repeatCounts + 10" class="w-14 ml-0!">
                                +10
                            </el-button>
                            <el-button plain type="primary" size="small" @click="repeatCounts = +repeatCounts + 100" class="w-14 ml-0!">
                                +100 </el-button>
                            <el-button plain type="primary" size="small" @click="repeatCounts = +repeatCounts + 1000"
                                class="w-14 ml-0!">
                                +1000 </el-button>
                            <!-- <el-button plain type="primary" size="small" @click="repeatCounts = '♾'"
                                class="w-12">
                                无限
                            </el-button> -->
                        </div>

                        <div class="flex mt-2 flex-wrap gap-2">
                            <el-button plain type="primary" size="small"
                                @click="repeatCounts = +repeatCounts+calcActionCountByDuration(action.id, 10)" class="w-14 ml-0!">
                                +10分钟
                            </el-button>
                            <el-button plain type="primary" size="small"
                                @click="repeatCounts = +repeatCounts+calcActionCountByDuration(action.id, 30)" class="w-14 ml-0!">
                                +30分钟
                            </el-button>
                            <el-button plain type="primary" size="small"
                                @click="repeatCounts = +repeatCounts+calcActionCountByDuration(action.id, 60)" class="w-14 ml-0!"> +1小时
                            </el-button>
                            <el-button plain type="primary" size="small"
                                @click="repeatCounts = +repeatCounts+calcActionCountByDuration(action.id, 120)" class="w-14 ml-0!">
                                +2小时
                            </el-button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 预计耗时显示，紧贴按钮上方 -->
            <div v-if="repeatCounts > 0" class="text-xs text-gray-500 text-center mt-2">
              预计耗时：{{ formatDuration(repeatCounts * allActionDuration[action.id].final) }}
            </div>

            <div class="flex gap-2">
            <el-button :type="canPerformAction ? 'primary' : 'info'" :plain="!canPerformAction"
                @click="addSingleTaskToQueue(action.id, repeatCounts)" class="w-full mt-2"
                :disabled="!canPerformAction">
                {{ !actionQueue.length ? '开始' : '加入队列' }} {{ action.name }}
            </el-button>

            <el-button v-if="!!actionQueue.length" :type="canPerformAction ? 'primary' : 'info'" :plain="!canPerformAction"
                @click="(e) => immediatelyStartTask(e, action.id, repeatCounts)" class="w-full mt-2"
                :disabled="!canPerformAction">
                立即开始
            </el-button>
            </div>

            <template v-if="kittyList.length && !action.banToKitty">
                <el-divider class="my-4! md:my-4!" />
                <div class="flex items-center mb-4">
                    <span class="text-base font-bold text-yellow-600 mr-2 w-42">🐱 小猫咪助手</span>
                    <el-select v-model="selectedKittyUuid" placeholder="选择小猫咪" class="w-full">
                        <el-option
                            v-for="kitty in kittyList"
                            :key="kitty.uuid"
                            :label="kitty.name"
                            :value="kitty.uuid"
                        />
                    </el-select>
                </div>
                <el-button
                    type="success"
                    class="w-full"
                    :disabled="!canPerformAction || !selectedKittyUuid || repeatCounts < 1"
                    @click="assignTaskToKitty"
                >
                    指派给小猫咪完成
                </el-button>
            </template>

            <!-- <div v-if="action.upgrades" class="pt-2 border-t">
              <div class="text-sm text-gray-600 dark:text-gray-400  mb-2">
                升级 (等级 {{ action.level || 1 }}):
              </div>
              <el-button 
                size="small" 
                @click="upgradeAction(action.id)"
                :disabled="!canUpgrade(action.id)"
                class="w-full"
              >
                升级 - 💰{{ getUpgradeCost(action.id) }}
              </el-button>
            </div> -->
        </div>
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
import { allGameAction } from '~/shared/data/allGameActions';
import { type AllGameActionID, type GameAction } from '~/shared/types/gameAction'
import type { GameTask } from '~/shared/types/gameTask';
import { clone, formatDuration } from '~/shared/utils';
import { requirementCheck } from '~/shared/utils/game/requirementCheck';

// 新增：小猫咪相关
import { useKittyInfo } from '~/composables/game/useKittyInfo'
import { emitAddKittyTask, emitGetKittyAllTask } from '~/api/game/socket/kitty';
import { useActionResourceReqiurement } from '~/composables/game/useActionResourceReqiurement';
import { useTavern } from '~/composables/game/useTavern';
import allTalentCat from '~/shared/data/allTalentCat';

const tavernExpert = useTavern()

const props = defineProps<{
    action: GameAction
    defaultRepeatCount?: number
}>()

const allActionDuration = useActionDuration()
const allActionResourceRequirement = useActionResourceReqiurement()

const actionQueue = useTaskQueue()
const repeatCounts = ref<number>(props.defaultRepeatCount ?? 0)
const inventory = useInventory()
const characterStatusInfo = useCharacterStatusInfo()
const buildingInfo = useCharacterBuildingInfo()
const action = computed<GameAction>(() => {
    if (!tavernExpert.value?.length) {
        return props.action
    }
    const actionClone = clone(props.action)

    for(const expert of tavernExpert.value) {
        const expertInfo = allTalentCat.find(cat => cat.id === expert.type as any)

        if (!expertInfo) continue

        let expertActions = Object.keys(expertInfo?.actionOverride ?? {})

        if (clone(expertActions).includes(props.action.id)) {

            expertActions.some(actionId => {
                if (actionId == props.action.id) {

                    actionClone.rewards = [...(actionClone.rewards ?? []), ...(expertInfo.actionOverride?.[actionId].rewards ?? [])]

                    actionClone.characterImprove = [...(actionClone.characterImprove ?? []), ...(expertInfo.actionOverride?.[actionId].characterImprove ?? [])]

                    // actionClone.baseDuration = expertInfo.actionOverride?.[actionId].baseDuration || actionClone.baseDuration

                    return true
                }
            })
        }
    }
    
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

// 小猫咪相关
const kittyList = useKittyInfo()
const selectedKittyUuid = ref<string | undefined>(kittyList.value[0]?.uuid)

const addSingleTaskToQueue = (action: AllGameActionID, count: number) => {
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
    ElNotification({
        title: '已添加至队列',
        type: 'success',
        message: `${allGameAction[action].name} * ${count} 次`,
        duration: 3800
    })
}

const immediatelyStartTask = (e: Event, action: AllGameActionID, count: number) => {
    if (!e.isTrusted) return;
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
    ElNotification({
        title: '已添加至队列',
        type: 'success',
        message: `${allGameAction[action].name} * ${count} 次`,
        duration: 3800
    })
}

// 新增：指派给小猫咪
const assignTaskToKitty = (e: Event) => {
    if (!e.isTrusted) return;
    repeatCounts.value = +repeatCounts.value
    if (!selectedKittyUuid.value || !canPerformAction.value || repeatCounts.value < 1) {
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
}

const calcActionCountByDuration = (actionId: AllGameActionID, minutes: number) => {
    let duration = allActionDuration.value?.[actionId]?.final ?? unref(action).baseDuration 

    const actionDuration = duration / 1000
    return ~~((minutes * 60) / actionDuration)
}
</script>