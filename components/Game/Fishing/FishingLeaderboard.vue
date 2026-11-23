<template>
    <el-card class="w-full">
        <el-skeleton :rows="6" animated v-if="loading" />
        <div v-else-if="error" class="text-xs text-red-500">{{ error }}</div>
        <div v-else>
            <div v-if="groups.length === 0" class="text-xs text-gray-500">暂无排行数据</div>
            <div v-else>
                <div class="space-y-4">
                    <el-card v-for="g in groups" :key="g.fishId" shadow="hover">
                        <div class="flex items-center justify-between">
                            <div class="font-medium">鱼种: {{ allFishSpecies[g.fishId].name }}</div>
                            <div class="text-xs text-gray-400">&nbsp;</div>
                        </div>

                        <div class="mt-2 grid grid-cols-2 gap-3">
                            <div class="flex flex-col gap-2" v-if="g.maxLength">
                                <GameUserAvatarAndName :uuid="g.maxLength.userUuid"></GameUserAvatarAndName>
                                <FishingCatchPreview :fish="g.maxLength" />
                                <div class="text-xs text-gray-500">长度: {{ g.maxLength.length }}cm</div>
                                <div class="text-xs text-gray-500">时间: {{  formatTimeToStr(g.maxLength.caughtAt) }}</div>
                            </div>


                            <div class="flex flex-col gap-2" v-if="g.maxWeight">
                                <GameUserAvatarAndName :uuid="g.maxWeight.userUuid"></GameUserAvatarAndName>
                                <FishingCatchPreview :fish="g.maxWeight" />
                                <div class="text-xs text-gray-500">重量: {{ g.maxWeight.weight }}kg</div>
                                <div class="text-xs text-gray-500">时间: {{  formatTimeToStr(g.maxWeight.caughtAt) }}</div>
                            </div>
                        </div>
                    </el-card>
                </div>
            </div>
        </div>
    </el-card>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { emitGetLeaderboard, onGetLeaderboardSuccess, onGetLeaderboardFail } from '~/api/game/socket/fishing'
import FishingCatchPreview from './FishingCatchPreview.vue'
import type { CaughtFishDTO } from '~/shared/types/fishing'
import { allFishSpecies, type AllFishSpeciesID } from '~/shared/data/allFishSpecies'
import { formatTimeToStr } from '~/shared/utils'

type Group = { fishId: AllFishSpeciesID; maxLength?: CaughtFishDTO | null; maxWeight?: CaughtFishDTO | null }

const groups = ref<Group[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

let unsubSuccess: null | (() => void) = null
let unsubFail: null | (() => void) = null

function clearListeners() {
    if (unsubSuccess) { unsubSuccess(); unsubSuccess = null }
    if (unsubFail) { unsubFail(); unsubFail = null }
}

function load() {
    loading.value = true
    error.value = null

    unsubSuccess = onGetLeaderboardSuccess((p) => {
        groups.value = Array.isArray(p?.data) ? p.data : []
        loading.value = false
        clearListeners()
    })
    unsubFail = onGetLeaderboardFail((p) => {
        error.value = p?.message || '请求失败'
        groups.value = []
        loading.value = false
        clearListeners()
    })

    try {
        emitGetLeaderboard()
    } catch (e) {
        error.value = String(e)
        loading.value = false
        clearListeners()
    }
}

load()

onBeforeUnmount(() => clearListeners())
</script>

<style scoped></style>
