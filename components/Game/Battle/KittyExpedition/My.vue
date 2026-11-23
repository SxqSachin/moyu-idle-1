<template>
    <div class="p-4">
        <el-empty v-if="!Object.keys(myKittyExpedition).length" description="暂无探险队" />
        <div v-else class="flex flex-col gap-4">
            <template v-for="(expedition, i) in myKittyExpedition" :key="expedition?.uuid ?? i">
                <el-card v-if="!!expedition && expedition.state != KittyExpeditionTeamState.FINISHED" shadow="hover"
                    class="" body-class="flex flex-col gap-2">
                    <div class="font-bold text-lg mb-2 text-gray-800 flex items-center justify-between">
                        <div class="flex items-center flex-wrap">
                            <span class="truncate max-w-[60vw] text-gray-600 dark:text-gray-200">{{ expedition.name
                                }}</span>
                            <el-tag size="small" class="ml-2" :type="stateTagType(expedition.state)">
                                {{ stateText(expedition.state) }}
                            </el-tag>
                        </div>

                        <template v-if="expedition.state === KittyExpeditionTeamState.IDLE">
                            <div>
                                <el-button size="small" type="warning" @click="e => deleteExpedition(e, expedition)">
                                    解散
                                </el-button>
                                <el-button size="small" type="primary" :disabled="!canBeginExpedition(expedition)" @click="e => beginExpedition(e, expedition)">
                                    出发!
                                </el-button>
                            </div>
                        </template>
                        <template v-else-if="expedition.state === KittyExpeditionTeamState.EXPEDITION">
                            <el-button size="small" type="primary" @click="e => stopExpedition(e, expedition)">
                                结束探险
                            </el-button>
                        </template>
                    </div>
                    <div class="mb-1">
                        <span class="text-sm text-gray-500">猫咪：</span>
                        <span class="inline-flex flex-wrap gap-1">
                            <GameCommonKittyInfo v-for="kittyUuid in expedition.kittyUuids" :key="kittyUuid"
                                :uuid="kittyUuid"></GameCommonKittyInfo>
                        </span>
                    </div>
                    <div class="mb-1">
                        <span class="text-sm text-gray-500">探险区域：</span>
                        <span class="text-sm text-gray-500">{{ getBattleAreaName(expedition.expeditionAreaId) }}</span>
                    </div>
                    <template v-if="expedition.state === KittyExpeditionTeamState.IDLE">
                        <div>
                            <span class="text-sm text-gray-500">
                                所需物资：
                            </span>
                            <template v-for="(count, id) of getExpeditionRequireResource(expedition)" :key="id">
                                <GameCommonResourceIconAndName :resource-id="id" :count="count?.count" :show-inventory-count="true"></GameCommonResourceIconAndName>
                            </template>
                        </div>
                    </template>
                    <div v-if="expedition.state === KittyExpeditionTeamState.RETURNING" class="mb-1">
                        <span class="text-sm text-gray-500">结束探险于：</span>
                        <span class="text-sm text-gray-500">{{ formatTimeToStr(expedition.endTime!) }}</span>
                    </div>
                    <template v-if="shouldShowReward(expedition)">
                        <el-divider class="my-2!"></el-divider>
                        <div class="mb-1">
                            <span class="text-sm block text-gray-500">战利品：</span>
                            <span v-if="expedition.reward && Object.keys(expedition.reward).length">
                                <template v-for="(reward, userUuid) in expedition.reward" :key="userUuid">
                                    <div class="flex flex-col md:flex-row items-center gap-4 mb-1">
                                        <GameUserAvatarAndName :uuid="(userUuid as string)"></GameUserAvatarAndName>
                                        <div class="flex flex-wrap gap-2">
                                            <template v-for="(countInfo, resourceId) in reward" :key="userUuid">
                                                <GameCommonResourceIconAndName :resource-id="resourceId"
                                                    :count="countInfo?.count">
                                                </GameCommonResourceIconAndName>
                                            </template>
                                        </div>
                                    </div>
                                </template>
                            </span>
                            <span v-else class="text-sm text-gray-400 mt-2"> — </span>
                        </div>
                    </template>
                    <div class="text-xs text-gray-400 mt-4">组建于：{{ formatTimeToStr(expedition.createdAt) }}</div>
                </el-card>

            </template>

        </div>
    </div>
</template>

<script setup lang="ts">
import { ElCard, ElTag, ElEmpty } from "element-plus";
import { KittyExpeditionTeamState, type KittyExpeditionTeamInGame } from "~/shared/types/kittyExpedition";
import { useKittyInfo } from "~/composables/game/useKittyInfo";
import { useMyKittyExpeditionInfo } from "~/composables/game/useMyKittyExpeditionInfo";
import { allBattleAreas } from "~/shared/data/allBattleInfo";
import { formatTimeToStr } from "~/shared/utils";
import { emitBeginExpedition, emitDeleteExpeditionTeam, emitGetMyExpeditionTeams, emitReturnExpedition, onBeginExpeditionFail, onBeginExpeditionSuccess } from "~/api/game/socket/kittyExpedition";
import { waitUtilConnected } from "~/api/game/socket/socket";
import type { FuncAction } from "~/shared/types";
import { GameCommonSimpleResourceIconAndName } from "#components";
import type { BattleArea } from "~/shared/types/battle";
import { useInventory } from "~/composables/game/useInventory";

const kitties = useKittyInfo()
const myKittyExpedition = useMyKittyExpeditionInfo()
const inventory = useInventory()

const getExpeditionRequireResource = (expedition: KittyExpeditionTeamInGame) => {
    const requireResource = allBattleAreas[expedition.expeditionAreaId] as BattleArea

    return requireResource.expeditionRequireResource || {};
}

let off1: FuncAction
let off2: FuncAction
onMounted(async () => {
    await waitUtilConnected()

    emitGetMyExpeditionTeams()

    off1 = onBeginExpeditionSuccess((data) => {
        ElNotification({
            title: "探险开始",
            message: `探险队 ${data.team.name} 已出发!`,
            type: "success"
        })

        emitGetMyExpeditionTeams()
    })
    off2 = onBeginExpeditionFail((data) => {
        ElNotification({
            title: "探险失败",
            message: data.message,
            type: "error"
        })

        emitGetMyExpeditionTeams()
    })
})

onUnmounted(() => {
    off1?.()
    off2?.()
})

function getBattleAreaName(areaId: keyof typeof allBattleAreas) {
    return allBattleAreas[areaId]?.name || "未知区域";
}

function stateText(state: KittyExpeditionTeamState) {
    switch (state) {
        case "IDLE": return "待命";
        case "ON_THE_WAY": return "正在路上";
        case "EXPEDITION": return "探险中";
        case "RETURNING": return "归途中";
        case "FINISHED": return "已完成";
        default: return state;
    }
}

function stateTagType(state: KittyExpeditionTeamState) {
    switch (state) {
        case "IDLE": return "info";
        case "ON_THE_WAY": return "warning";
        case "EXPEDITION": return "success";
        case "RETURNING": return "primary";
        case "FINISHED": return "success";
        default: return "info";
    }
}

function shouldShowReward(expedition: KittyExpeditionTeamInGame) {
    return expedition.state === KittyExpeditionTeamState.EXPEDITION || expedition.state === KittyExpeditionTeamState.FINISHED || expedition.state === KittyExpeditionTeamState.RETURNING;
}

function canBeginExpedition(expedition: KittyExpeditionTeamInGame) {
    const requireResource = getExpeditionRequireResource(expedition);

    return Object.keys(requireResource).every(resourceId => {
        if (!resourceId) {
            return true
        }

        const inventoryCount = inventory.value[resourceId]?.count ?? 0
        return inventoryCount >= (requireResource[resourceId]?.count ?? 0)
    })
}

function beginExpedition(e: Event, expedition: KittyExpeditionTeamInGame) {
    if (!e.isTrusted) return

    ElMessageBox.confirm(
        '确定出发探险吗，出发后，你的小猫咪将停止工作，直到探险结束',
        '出发探险！',
        {
            confirmButtonText: '确认',
            cancelButtonText: '取消',
            type: 'success',
        }
    ).then(() => {
        emitBeginExpedition(expedition.uuid)
    }).catch(() => { })
}
function deleteExpedition(e: Event, expedition: KittyExpeditionTeamInGame) {
    if (!e.isTrusted) return

    ElMessageBox.confirm(
        '确定解散探险队吗？出发前解散将不会消耗资源',
        '解散探险队',
        {
            confirmButtonText: '确认',
            cancelButtonText: '取消',
            type: 'warning',
        }
    ).then(() => {
        emitDeleteExpeditionTeam(expedition.uuid) // 刷新列表
    }).catch(() => { })
}
function stopExpedition(e: Event, expedition: KittyExpeditionTeamInGame) {
    if (!e.isTrusted) return

    ElMessageBox.confirm(
        '确定结束探险吗，你的小猫咪们将在回到家后将战利品放回仓库，然后继续他们的工作',
        '结束探险',
        {
            confirmButtonText: '确认',
            cancelButtonText: '取消',
            type: 'success',
        }
    ).then(() => {
        emitReturnExpedition(expedition.uuid)
    }).catch(() => { })
}
</script>