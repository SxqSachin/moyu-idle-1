<template>
    <div class="p-4">
        <el-empty v-if="!myKittyExpeditionHistory.length" description="暂无探险历史" />
        <div v-else class="flex flex-col gap-4">
            <template v-for="expedition in myKittyExpeditionHistory" :key="expedition?.uuid">
                <el-card v-if="!!expedition" shadow="hover"
                    class="" body-class="flex flex-col gap-2">
                    <div class="font-bold text-lg mb-2 text-gray-800 flex items-center justify-between">
                        <div class="flex items-center flex-wrap">
                            <span class="truncate max-w-[60vw] text-gray-600 dark:text-gray-200">{{ expedition.name
                                }}</span>
                        </div>
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
                    <div v-if="expedition.state === KittyExpeditionTeamState.RETURNING" class="mb-1">
                        <span class="text-sm text-gray-500">结束探险于：</span>
                        <span class="text-sm text-gray-500">{{ formatTimeToStr(expedition.endTime!) }}</span>
                    </div>
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
                    <div class="text-xs text-gray-400 mt-4">组建于：{{ formatTimeToStr(expedition.createdAt) }}</div>
                </el-card>

            </template>

        </div>
    </div>
</template>

<script setup lang="ts">
import { ElCard, ElTag, ElEmpty } from "element-plus";
import { KittyExpeditionTeamState, type KittyExpeditionTeamInGame } from "~/shared/types/kittyExpedition";
import { allBattleAreas } from "~/shared/data/allBattleInfo";
import { formatTimeToStr } from "~/shared/utils";
import { emitBeginExpedition, emitDeleteExpeditionTeam, emitGetMyExpeditionHistory, emitGetMyExpeditionTeams, emitReturnExpedition, onBeginExpeditionFail, onBeginExpeditionSuccess, onGetMyExpeditionHistoryFail, onGetMyExpeditionHistorySuccess } from "~/api/game/socket/kittyExpedition";
import { waitUtilConnected } from "~/api/game/socket/socket";
import type { FuncAction } from "~/shared/types";

const myKittyExpeditionHistory = ref<KittyExpeditionTeamInGame[]>([])

let off1: FuncAction
let off2: FuncAction
onMounted(async () => {
    await waitUtilConnected()

    emitGetMyExpeditionHistory()

    off1 = onGetMyExpeditionHistorySuccess((data) => {
        myKittyExpeditionHistory.value = data.data
    })

    off2 = onGetMyExpeditionHistoryFail((data) => {
        ElNotification({
            title: "获取探险历史失败",
            message: data.message,
            type: "error",
        })
    })
})

onUnmounted(() => {
    off1?.()
    off2?.()
})


function getBattleAreaName(areaId: keyof typeof allBattleAreas) {
    return allBattleAreas[areaId]?.name || "未知区域";
}
</script>