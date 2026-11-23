<template>
    <div
        class="bg-white dark:bg-gray-700 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow  flex justify-between flex-col">

        <div class="flex justify-between">
            <div class="text-center flex justify-between items-center flex-col" :class="isAlreadyBuilt ? 'w-full' : 'w-1/2'">
                <GameCommonSimpleIcon :icon="thisBuildingInfo.icon" :icon-size="24"></GameCommonSimpleIcon>
                <h3 class="text-xl font-bold text-gray-800 dark:text-gray-200 ">{{ thisBuildingInfo.name }}</h3>
                <p class="text-gray-600 dark:text-gray-400  text-sm">{{ thisBuildingInfo.description }}</p>
            </div>

            <div class="flex flex-col w-1/2" :class="isAlreadyBuilt ? 'hidden' : ''">
                <GameCommonRequirementLabel label="耗时" :action="buildingAction" :show-duration="true">
                </GameCommonRequirementLabel>

                <template
                    v-if="thisBuildingInfo.buildRequirement?.characterStatus || thisBuildingInfo.buildRequirement?.building">
                    <GameCommonRequirementLabel label="需求" :action-requirement="thisBuildingInfo.buildRequirement"
                        :character-building-info="buildingInfo" :character-status-info="characterStatusInfo">
                    </GameCommonRequirementLabel>
                </template>

                <template v-if="thisBuildingInfo.buildRequirement?.resource">
                    <GameCommonResourceRequirementLabel :action-id="buildActionId" :inventory="inventory"></GameCommonResourceRequirementLabel>
                </template>
            </div>
        </div>

        <el-divider class="my-2!" v-if="!isAlreadyBuilt" />

        <template v-if="!!buildingDetail && false">
            <span class="ml-2 text-sm">
                {{ buildingDetail?.level }}/{{ thisBuildingInfo.maxLevel }}
            </span>
            <el-button type="primary">升级</el-button>
        </template>
        <template v-else>
            <div class="flex gap-2 mt-4">
            <el-button class="w-full" :type="buildBtnType" :plain="!canDoBuildAction" :disabled="!canDoBuildAction"
                @click="startBuild">
                <template v-if="isAlreadyBuilt">
                    已建造
                </template>
                <template v-else-if="isBuildActionInQueue">
                    已加入队列
                </template>
                <template v-else>
                    建造
                </template>
            </el-button>

            <el-button v-if="!!taskQueue.length" :type="canDoBuildAction ? 'primary' : 'info'" :plain="!canDoBuildAction"
                @click="immediatelyStartTask()" class="w-full"
                :disabled="!canDoBuildAction">
                立即开始
            </el-button>
            </div>

            <template v-if="kittyList.length && !buildingAction.banToKitty">
                <el-divider class="my-4! md:my-4!" />
                <div class="flex items-center mb-4">
                    <span class="text-base font-bold text-yellow-600 mr-2 w-42">🐱 小猫咪助手</span>
                    <el-select v-model="selectedKittyUuid" placeholder="选择小猫咪" class="w-full">
                        <el-option v-for="kitty in kittyList" :key="kitty.uuid" :label="kitty.name"
                            :value="kitty.uuid" />
                    </el-select>
                </div>
                <el-button type="success" class="w-full"
                    :disabled="!canDoBuildAction" @click="assignTaskToKitty">
                    <template v-if="isAlreadyBuilt">
                        已建造
                    </template>
                    <template v-else-if="isBuildActionInQueue">
                        已加入队列
                    </template>
                    <template v-else>
                        让猫咪助手进行建造
                    </template>
                </el-button>
            </template>
        </template>
    </div>
</template>
<script setup lang="ts">
import { emitAddKittyTask, emitGetKittyAllTask } from '~/api/game/socket/kitty';
import { emitAddTask, emitImmediatelyStartTask } from '~/api/game/socket/taskQueue';
import { useActionResourceReqiurement } from '~/composables/game/useActionResourceReqiurement';
import { useCharacterBuildingInfo } from '~/composables/game/useCharacterBuildingInfo';
import { useCharacterStatusInfo } from '~/composables/game/useCharacterStatusInfo';
import { useInventory } from '~/composables/game/useInventory';
import { useKittyInfo } from '~/composables/game/useKittyInfo';
import { useKittyTaskQueue } from '~/composables/game/useKittyTaskQueue';
import { useTaskQueue } from '~/composables/game/useTaskQueue';
import { allGameAction } from '~/shared/data/allGameActions';
import { allGameBuilding } from '~/shared/data/allGameBuilding';
import type { AllGameBuildingID, BuildActionID, CharacterBuildingDetail } from '~/shared/types/building';
import { requirementCheck } from '~/shared/utils/game/requirementCheck';

const inventory = useInventory()
const characterStatusInfo = useCharacterStatusInfo()
const buildingInfo = useCharacterBuildingInfo()
const allActionResourceRequirement = useActionResourceReqiurement()

const taskQueue = useTaskQueue()
const kittyTaskQueues = useKittyTaskQueue()

const kittyList = useKittyInfo()
const selectedKittyUuid = ref<string | undefined>(kittyList.value[0]?.uuid)

const props = defineProps<{
    buildingId: AllGameBuildingID
    buildingDetail?: CharacterBuildingDetail
}>()

const thisBuildingInfo = computed(() => {
    return allGameBuilding[props.buildingId]
})

const buildActionId = computed(() => {
    return "build_" + props.buildingId as BuildActionID
})

const buildingAction = computed(() => {
    let key = unref(buildActionId)
    return allGameAction[key]
})

const buildBtnType = computed(() => {
    if (unref(isAlreadyBuilt)) {
        return 'success'
    }

    return unref(canDoBuildAction) ? 'primary' : 'info'
})

const isAlreadyBuilt = computed(() => {
    return unref(buildingInfo)[props.buildingId]?.status == 'BUILT'
})

const isBuildActionInQueue = computed(() => {
    // 检查主队列
    const inMainQueue = taskQueue.value.some(task => task.actionId === buildActionId.value)
    // 检查所有猫咪队列
    const inKittyQueue = Object.values(kittyTaskQueues.value).some(queue =>
        queue?.some(task => task.actionId === buildActionId.value)
    )

    return inMainQueue || inKittyQueue
})

const canDoBuildAction = computed(() => {
    const requirementCheckRes =  requirementCheck(buildingAction.value.id, buildingAction.value.requirement, {
        characterActionResourceRequirement: unref(allActionResourceRequirement),
        characterInventory: unref(inventory),
        buildingInfo: unref(buildingInfo),
        characterStatusInfo: unref(characterStatusInfo),
    })
    return requirementCheckRes && !unref(isAlreadyBuilt) && !isBuildActionInQueue.value
})

const startBuild = () => {
    emitAddTask({
        actionId: unref(buildActionId),

        repeatCount: 1,
        currentRepeat: 0,
        createTime: Date.now(),
    })

    ElNotification({
        title: '已添加至队列',
        type: 'success',
        message: `${allGameAction[unref(buildActionId)].name}`,
        duration: 3800
    })
}

const immediatelyStartTask = () => {
    emitImmediatelyStartTask({
        actionId: unref(buildActionId),

        repeatCount: 1,
        currentRepeat: 0,
        createTime: Date.now(),
    })

    ElNotification({
        title: '已添加至队列',
        type: 'success',
        message: `${allGameAction[unref(buildActionId)].name}`,
        duration: 3800
    })
}

const assignTaskToKitty = () => {
    if (!selectedKittyUuid.value || !canDoBuildAction) {
        ElMessage.warning('请选择小猫咪')
        return
    }

    emitAddKittyTask(selectedKittyUuid.value, {
        actionId: unref(buildActionId),

        repeatCount: 1,
        currentRepeat: 0,
        createTime: Date.now(),
    })
    emitGetKittyAllTask(selectedKittyUuid.value) // 刷新小猫咪任务列表
}
</script>