<template>
    <div class="flex flex-col gap-4">
        <div class="flex flex-col items-center justify-center gap-3">
            <el-button type="primary" @click="triggerConsecrate">祈福</el-button>
            <el-button @click="openLeaderboard" size="small" plain class="ml-0!">查看记录</el-button>
        </div>

        <div v-if="!isStillConsecrated">
            <div class="text-sm text-gray-600 dark:text-gray-300 mt-2">
                祈愿尚未生效
            </div>
        </div>
        <div v-else>
            <div class="text-sm text-gray-600 dark:text-gray-300 mt-2">
                祈愿生效中，持续至 {{ formatTime(new Date(consecrateUntil), { hideSecond: true }) }}
            </div>
        </div>
    </div>

    <el-divider></el-divider>

    <!-- 排行榜弹窗 -->
    <el-dialog v-model="showLeaderboard" title="猫猫镇纪念碑" width="560px" :before-close="() => (showLeaderboard = false)">
        <el-tabs v-model="leaderboardTab" @tab-change="onLeaderboardTabChange">
            <el-tab-pane name="current" label="当前生效">
                <div class="flex justify-between items-center mb-2">
                    <div class="text-sm text-gray-500">按当前生效排序</div>
                    <el-button size="small" @click="refreshCurrent">刷新</el-button>
                </div>
                <div v-if="leaderboard.length === 0" class="text-sm text-gray-500 py-8 text-center">暂无数据</div>
                <div v-else class="space-y-2 overflow-y-auto pr-1 max-h-96">
                    <GameUserBatchAvatarAndName :uuid-list="leaderboard.map(item => item.userUuid)">
                    <div v-for="(item, idx) in leaderboard" :key="'cur-' + item.userUuid + '-' + idx"
                        class="flex items-center justify-between p-3 rounded-md" :class="getRankingClass(idx)">
                        <div class="w-full flex items-center gap-3">
                            <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                                :class="getRankBadgeClass(idx)">{{ item.rank }}</span>
                            <div class="w-full flex flex-row justify-between items-center">
                                <GameUserAvatarAndName :uuid="item.userUuid"></GameUserAvatarAndName>
                                <span class="text-xs text-gray-500">{{ formatDuration(item.activeSeconds) }}</span>
                            </div>
                        </div>
                    </div>
                    </GameUserBatchAvatarAndName>
                </div>
            </el-tab-pane>
            <el-tab-pane name="total" label="历史累计">
                <div class="flex justify-between items-center mb-2">
                    <div class="text-sm text-gray-500">按总时长排序</div>
                    <el-button size="small" @click="refreshTotal">刷新</el-button>
                </div>
                <div v-if="leaderboardTotal.length === 0" class="text-sm text-gray-500 py-8 text-center">暂无数据</div>
                <div v-else class="space-y-2 overflow-y-auto pr-1 max-h-96">
                    <GameUserBatchAvatarAndName :uuid-list="leaderboardTotal.map(item => item.userUuid)">
                    <div v-for="(item, idx) in leaderboardTotal" :key="'tot-' + item.userUuid + '-' + idx"
                        class="flex items-center justify-between p-3 rounded-md" :class="getRankingClass(idx)">
                        <div class="w-full flex items-center gap-3">
                            <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                                :class="getRankBadgeClass(idx)">{{ item.rank }}</span>
                            <div class="w-full flex flex-row justify-between items-center">
                                <GameUserAvatarAndName :uuid="item.userUuid"></GameUserAvatarAndName>
                                <span class="text-xs text-gray-500">{{ formatDuration(item.totalSeconds) }}</span>
                            </div>
                        </div>
                    </div>
                    </GameUserBatchAvatarAndName>
                </div>
            </el-tab-pane>
        </el-tabs>

        <template #footer>
            <el-button class="w-full" type="primary" @click="showLeaderboard = false">关闭</el-button>
        </template>
    </el-dialog>

    <el-dialog v-model="openDialog" title="祈福" width="350px" :before-close="() => (openDialog = false)">
        <div class="text-sm mt-2 text-gray-600 dark:text-gray-300 flex flex-wrap items-start justify-start gap-2">
            <span>消耗：</span>
            <div class="inline-flex flex-row flex-wrap gap-2 justify-start">
                <template v-for="(c, itemId) in consecrateItems" :key="itemId">
                    <GameCommonResourceIconAndName v-if="c?.count" :resource-id="itemId" :count="c?.count">
                    </GameCommonResourceIconAndName>
                </template>
            </div>
        </div>

        <div class="flex items-center gap-2 mt-2">
            <span>时长：</span>
            <div class="flex flex-col gap-4">
                <el-input-number v-model="times" :min="1" :max="240" :step="1" :step-strictly="true"></el-input-number>
            </div>
            <span class="ml-2">{{ times }} 分钟</span>
        </div>
        <el-slider v-model="times" :min="1" :max="240" :step="1" class="flex-1 w-full!" />
        <el-divider class="my-2!"></el-divider>
        <div class="flex flex-col justify-start text-base">
            <div class="mb-2">
                <el-text>总花费：</el-text>
            </div>
            <div class="inline-flex flex-col flex-wrap gap-2">
                <template v-for="(c, itemId) in consecrateItems" :key="itemId">
                    <div class="w-fit">
                        <GameCommonResourceIconAndName v-if="c?.count" :resource-id="itemId" :count="c.count * times"
                            :show-inventory-count="true">
                        </GameCommonResourceIconAndName>
                    </div>
                </template>
            </div>
        </div>

        <div class="mt-4 text-sm text-gray-600 dark:text-gray-300">
            <template v-if="rewardCount > 0">
                额外获得 {{ rewardCount }} 份奖励
            </template>
            <template v-else>
                每 {{extraConfig.extraDropRewardPerTimes}} 次获得 1 份奖励
            </template>

            <el-button size="small" plain @click="showRewardInfoDialog = true">奖励详情</el-button>
        </div>

        <template #footer>
            <el-button class="w-full" type="primary" @click="confirm" :disabled="loading">确定</el-button>
        </template>
    </el-dialog>

    <el-dialog v-model="showRewardInfoDialog" @close="showRewardInfoDialog = false" title="祈福奖励">
        <div class="flex flex-col gap-4 divide-y divide-gray-200 dark:divider-gray-800">
            <template v-for="reward of rewardPool">
                <div class="flex flex-col gap-2 pb-4">
                    <div class="text-md"> 概率: {{ reward.percent * 100 }}%</div>
                    <div class="flex flex-row flex-wrap gap-1">
                        <template v-for="id of reward.ids">
                            <GameCommonResourceIconAndName :resource-id="id">
                                <template v-if="reward.range.min == reward.range.max">({{ reward.range.min
                                    }})</template>
                                <template v-else>({{ reward.range.min }} ~ {{ reward.range.max }})</template>
                            </GameCommonResourceIconAndName>
                        </template>
                    </div>
                </div>
            </template>
        </div>
    </el-dialog>

</template>

<script setup lang="tsx">
import { waitUtilConnected } from '~/api/game/socket/socket';
import { emitGetBuiltVillageBuildings, emitGetNormalStateBaseVillageBuildings, } from '~/api/game/socket/village/building';
import { emitConsecrateCatVillageMonument, emitGetCatVillageMonumentLeaderboard, emitGetCatVillageMonumentTotalLeaderboard, onCatVillageMonumentLeaderboardFail, onCatVillageMonumentLeaderboardSuccess, onCatVillageMonumentTotalLeaderboardFail, onCatVillageMonumentTotalLeaderboardSuccess, onConsecrateCatVillageMonumentFail, onConsecrateCatVillageMonumentSuccess, type CatVillageMonumentLeaderboardItem, type CatVillageMonumentTotalLeaderboardItem } from '~/api/game/socket/village/buildingEffect';
import { allVillageBuilding } from '~/shared/data/allVillageBuilding';
import type { FuncAction } from '~/shared/types';
import type { CatVillageMonumentExtraData, GameVillageBuilding } from '~/shared/types/village/building';
import { formatTime, safeJsonParse } from '~/shared/utils';

const props = defineProps<{
    building: GameVillageBuilding
}>();

const openDialog = ref(false);
const times = ref(1);
const loading = ref(false);
const showRewardInfoDialog = ref(false)

const extraConfig = computed(() => {
    return allVillageBuilding.catVillageMonument.extra(props.building.level)
});
const consecrateItems = computed(() => {
    return extraConfig.value.consecrateItems;
});

const extraData = computed(() => {
    return safeJsonParse<CatVillageMonumentExtraData>(props.building.extra)
})

const consecrateUntil = computed(() => {
    return extraData.value?.consecrateUntil || 0;
})

const isStillConsecrated = computed(() => {
    return consecrateUntil.value > Date.now();
})

const rewardCount = computed(() => {
    return Math.floor(times.value / extraConfig.value.extraDropRewardPerTimes)
})

let off1: FuncAction;
let off2: FuncAction;
let off3: FuncAction;
let off4: FuncAction;
let off5: FuncAction;
let off6: FuncAction;

const triggerConsecrate = async (e: Event) => {
    if (!e.isTrusted) return;

    openDialog.value = true;
}

const confirm = async (e: Event) => {
    if (!e.isTrusted) return;

    loading.value = true;

    emitConsecrateCatVillageMonument(times.value);
}

    const showLeaderboard = ref(false)
    function openLeaderboard(e?: Event) {
        if (e && !e.isTrusted) return
        showLeaderboard.value = true
        // 默认打开“当前生效”Tab，按需拉取
        leaderboardTab.value = 'current'
        refreshCurrent()
    }

onMounted(async () => {
    await waitUtilConnected()

    off1 = onConsecrateCatVillageMonumentSuccess(() => {
        loading.value = false;
        openDialog.value = false;
        times.value = 1;
        ElMessage({
            message: '供奉成功',
            type: 'success',
        })

                emitGetBuiltVillageBuildings()
                emitGetNormalStateBaseVillageBuildings()
                if (showLeaderboard.value && leaderboardTab.value === 'current') {
                    refreshCurrent()
                }
    })

    off2 = onConsecrateCatVillageMonumentFail(({ message }) => {
        loading.value = false;
        ElMessage({
            message: message || '供奉失败',
            type: 'error',
        })

        emitGetBuiltVillageBuildings()
        emitGetNormalStateBaseVillageBuildings()
    })

    // Leaderboard listeners（当前）
    off3 = onCatVillageMonumentLeaderboardSuccess(({ list }) => {
        leaderboard.value = list
    })
    off4 = onCatVillageMonumentLeaderboardFail(({ message }) => {
        ElMessage({ message: message || '排行榜获取失败', type: 'error' })
    })

    // Total leaderboard listeners
    off5 = onCatVillageMonumentTotalLeaderboardSuccess(({ list }) => {
        leaderboardTotal.value = list
    })
    off6 = onCatVillageMonumentTotalLeaderboardFail(({ message }) => {
        ElMessage({ message: message || '总排行榜获取失败', type: 'error' })
    })

    // 默认不自动拉取，打开弹窗或切换Tab时再拉
})

const rewardPool = computed(() => {
    return allVillageBuilding.catVillageMonument.extra(props.building.level).rewardPool
})

onUnmounted(() => {
    off1?.();
    off2?.();
    off3?.();
    off4?.();
    off5?.();
    off6?.();
})

// Leaderboard state and helpers
const leaderboardTab = ref<'current' | 'total'>('current')
function onLeaderboardTabChange() {
    if (leaderboardTab.value === 'current') refreshCurrent()
    else refreshTotal()
}
const leaderboard = ref<CatVillageMonumentLeaderboardItem[]>([])
const leaderboardTotal = ref<CatVillageMonumentTotalLeaderboardItem[]>([])
const refreshCurrent = () => emitGetCatVillageMonumentLeaderboard(20)
const refreshTotal = () => emitGetCatVillageMonumentTotalLeaderboard(20)
function formatDuration(sec: number) {
    if (!sec || sec <= 0) return '0秒'
    const m = Math.floor(sec / 60)
    const s = sec % 60
    if (m >= 60) {
        const h = Math.floor(m / 60)
        const rm = m % 60
        return `${h}小时${rm}分`
    }
    return `${m}分${s}秒`
}

// 排名样式（参考募集排行）
function getRankingClass(index: number) {
    if (index === 0) return 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
    if (index === 1) return 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
    if (index === 2) return 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
    return 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
}
function getRankBadgeClass(index: number) {
    if (index === 0) return 'bg-yellow-400 text-white'
    if (index === 1) return 'bg-gray-400 text-white'
    if (index === 2) return 'bg-orange-400 text-white'
    return 'bg-blue-50 dark:bg-blue-900 text-blue-400 dark:text-blue-400'
}
</script>