<template>
    <el-card shadow="hover" class="world-boss-card h-full w-full">
        <div class="flex items-start justify-between mb-3 gap-2">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-base">{{ boss.name }}</span>
                    <el-tag size="small" :type="statusTagType">{{ statusText }}</el-tag>
                    <template v-if="boss.globalState?.status == 'player_win'">
                        <template v-if="boss.globalState?.dispatchedRewards">
                            <el-tag size="small" type="success">已结算</el-tag>
                        </template>
                        <template v-else>
                            <el-tag size="small" type="warning">结算中</el-tag>
                        </template>
                    </template>
                </div>

                <template v-if="boss.startAt">
                    <div class="text-xs text-gray-500 mb-1">开始时间: {{ formatTime(boss.startAt) }}</div>
                </template>
                <template v-if="boss.endAt">
                    <div class="text-xs text-gray-500 mb-1">结束时间: {{ formatTime(boss.endAt) }}</div>
                </template>


                <div class="text-xs text-gray-500">更新于 {{ formatTime(boss.updatedAt) }}</div>
            </div>
            <div class="flex flex-col items-end gap-2">
                <el-button class="ml-0!" size="small" :loading="isRefreshing" @click="handleRefresh"  v-if="showRefresh">
                    刷新
                </el-button>
                <el-button
                    class="ml-0!"
                    size="small"
                    type="success"
                    :loading="isClaiming"
                    :disabled="hasClaimed || !canClaim"
                    v-if="showClaimButton"
                    @click="handleClaim"
                >
                    {{ hasClaimed ? "已领取" : "领取奖励" }}
                </el-button>
                <slot name="actions" />
            </div>
        </div>

        <div class="mb-3">
            <div class="flex items-center justify-between text-xs mb-1">
                <span>进度</span>
                <span>{{ currentHp }} / {{ totalHp }}</span>
            </div>
            <el-progress :percentage="hpPercent" :show-text="false" :stroke-width="6" color="#67c23a" />
        </div>

        <template v-if="!plain">

            <div v-if="boss.description" class="text-xs text-gray-600 mb-3 line-clamp-2">描述: {{ boss.description }}
            </div>

            <el-divider class="my-4!"></el-divider>

            <div class="mb-3">
                <div class="text-xs text-gray-500 mb-1 flex flex-row items-center justify-start gap-2">
                    <span> 敌人数量: {{ memberStates.length }} </span>

                    <el-tag type="primary" class="ml-0! cursor-pointer" size="small" @click="openAllUnitsDialog" plain>
                        查看详情
                    </el-tag>
                </div>

                <div class="flex flex-col gap-4">
                    <div v-for="unit in memberStates" :key="unit.uuid" class="flex flex-col items-center gap-1 text-xs">
                        <div class="flex flex-row items-center justify-between w-full">
                            <div class="flex flex-row items-center justify-start">
                                <span>{{ unit.name }}</span>
                            </div>
                            <span class="w-full text-right">{{ unit.hp }} / {{ unit.maxHp }}</span>
                        </div>
                        <el-progress :percentage="getUnitPercent(unit)" :show-text="false" :stroke-width="4"
                            color="#67c23a" class="flex-1 w-full" />
                    </div>
                </div>
            </div>

            <el-dialog v-model="showAllUnitsDialog" :width="isMobile ? '100%' : '500px'" title="所有敌人详情" :destroy-on-close="true">
                <template #default>
                    <el-tabs default-value="0">
                        <el-tab-pane v-for="unit in memberStates" :key="unit.uuid" :label="unit.name">
                            <UnitDetail :unit="unit.info" />
                        </el-tab-pane>
                    </el-tabs>
                </template>
                <template #footer>
                    <el-button size="small" @click="showAllUnitsDialog = false">关闭</el-button>
                </template>
            </el-dialog>

            <el-divider class="my-4!"></el-divider>

            <div>
                <div class="text-xs text-gray-500 mb-1">掉落</div>
                <div v-if="flatDrops.length" class="flex flex-wrap gap-2">
                    <div v-for="drop in displayDrops" :key="dropKey(drop)"
                        class="rounded text-xxs flex items-center gap-1 w-full">
                        <GameCommonResourceIconAndName :resource-id="drop.id">
                            <div class="inline-flex flex-row items-center gap-2">
                                <span>:</span>
                                <span>
                                    {{ drop.range.min }}-{{ drop.range.max }}
                                </span>
                                <span>
                                    ({{ (drop.percent * 100).toFixed(1) }}%)
                                </span>
                            </div>
                        </GameCommonResourceIconAndName>
                    </div>
                </div>
                <div v-else class="text-xxs text-gray-400">暂无掉落</div>
            </div>
        </template>
    </el-card>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import dayjs from "dayjs";
import type { BossUnitWithDrops, WorldBossConfigWithState } from "~/shared/types/worldBoss";
import type { BaseBattleUnit } from '~/shared/types/unit'
import UnitDetail from '~/components/Game/Battle/UnitDetail.vue'
import GameCommonResourceIconAndName from "~/components/Game/Common/ResourceIconAndName.vue";
import { ElMessage } from "element-plus";
import { emitWorldBossClaimReward, onWorldBossClaimRewardSuccess, onWorldBossClaimRewardFail, emitWorldBossGet, onWorldBossGetSuccess, onWorldBossGetFail } from '~/api/game/socket/worldBoss'

const { isMobile } = useDevice();

const props = defineProps<{
    boss: WorldBossConfigWithState;
    plain?: boolean;
    showRefresh?: boolean;
}>();

// 本地保持一份 boss 数据，避免单卡刷新需要重拉全列表
const bossData = ref<WorldBossConfigWithState>(props.boss);
const boss = computed(() => bossData.value);

const status = computed(() => boss.value.globalState?.status ?? boss.value.state);
const statusText = computed(() => {
    switch (status.value) {
        case 'battling':
            return '进行中';
        case 'player_lose':
            return '失败';
        case 'player_win':
            return '已击败';
        case 'waiting':
            return '待挑战';
    }
});
const statusTagType = computed(() => {
    switch (status.value) {
        case 'battling':
            return 'primary';
        case 'player_lose':
            return 'danger';
        case 'player_win':
            return 'success';
        case 'waiting':
            return 'info';
    }
});

const totalHp = computed(() => {
    if (boss.value.globalState?.totalHp != null) return boss.value.globalState.totalHp;
    return boss.value.bossMembers.reduce((sum, m) => sum + (m.maxHp ?? m.hp ?? 0), 0);
});

const currentHp = computed(() => {
    if (boss.value.globalState?.currentHp != null) return boss.value.globalState.currentHp;
    return boss.value.bossMembers.reduce((sum, m) => sum + (m.hp ?? m.maxHp ?? 0), 0);
});

const hpPercent = computed(() => {
    if (!totalHp.value) return 0;
    return Math.min(100, Math.max(0, (currentHp.value / totalHp.value) * 100));
});

const isClaiming = ref(false)
const hasClaimed = ref(false)
let unbindClaimOk: (() => void) | undefined
let unbindClaimFail: (() => void) | undefined

const currentBattleUuid = computed(() => boss.value.globalState?.uuid || "");
const canClaim = computed(() => status.value === 'player_win' && !!boss.value.globalState?.dispatchedRewards);
const showClaimButton = computed(() => canClaim.value || hasClaimed.value);

const memberStates = computed(() => {
    if (boss.value.globalState?.bossMembers?.length) {
        return boss.value.globalState.bossMembers.map((m) => ({
            uuid: m.uuid,
            name: m.name,
            hp: m.hp ?? 0,
            maxHp: m.maxHp ?? m.hp ?? 0,
            level: (m as any).level ?? 1,
            info: m
        }));
    }
    return boss.value.bossMembers.map((m) => ({
        uuid: m.uuid,
        name: m.name,
        hp: m.hp ?? 0,
        maxHp: m.maxHp ?? m.hp ?? 0,
        level: m.level ?? 1,
        info: m,
    }));
});

const flatDrops = computed(() => boss.value.bossMembers.flatMap((m) => (m as BossUnitWithDrops).drops || []));
const maxDisplayDrops = 100;
const displayDrops = computed(() => flatDrops.value.slice(0, maxDisplayDrops));
const dropKey = (drop: { id: string; range: { min: number; max: number } }) => `${drop.id}-${drop.range.min}-${drop.range.max}`;

const getUnitPercent = (unit: { hp: number; maxHp: number }) => {
    if (!unit.maxHp) return 0;
    return Math.min(100, Math.max(0, (unit.hp / unit.maxHp) * 100));
};

const formatTime = (ts: number) => dayjs(ts).format("MM-DD HH:mm");

const isRefreshing = ref(false)
let unbindRefreshOk: (() => void) | undefined
let unbindRefreshFail: (() => void) | undefined

// Unit detail dialog state
    // All-units dialog state
    const showAllUnitsDialog = ref(false)
    
    function openAllUnitsDialog() {
        showAllUnitsDialog.value = true
    }

const handleRefresh = () => {
    if (isRefreshing.value) return
    isRefreshing.value = true
    emitWorldBossGet({ bossId: boss.value.id })
}

const handleClaim = () => {
    if (!canClaim.value || isClaiming.value || hasClaimed.value) return
    isClaiming.value = true
    emitWorldBossClaimReward({ bossId: props.boss.id, worldBossBattleUuid: currentBattleUuid.value })
}

watch(currentBattleUuid, () => {
    isClaiming.value = false
    hasClaimed.value = boss.value.hasClaimedReward ?? false
})

watch(() => props.boss.hasClaimedReward, (val) => {
    if (typeof val === 'boolean') {
        hasClaimed.value = val
    }
}, { immediate: true })

watch(() => props.boss, (val) => {
    bossData.value = val
    hasClaimed.value = val.hasClaimedReward ?? false
}, { deep: true })

onMounted(() => {
    unbindRefreshOk = onWorldBossGetSuccess((resp) => {
        if (resp.boss.id !== boss.value.id) return
        bossData.value = resp.boss
        hasClaimed.value = resp.boss.hasClaimedReward ?? false
        isRefreshing.value = false
    })
    unbindRefreshFail = onWorldBossGetFail((err) => {
        if (err.bossId && err.bossId !== boss.value.id) return
        isRefreshing.value = false
        ElMessage.error(err.message || '刷新失败')
    })

    unbindClaimOk = onWorldBossClaimRewardSuccess((resp) => {
        if (resp.bossId !== props.boss.id) return
        if (resp.worldBossBattleUuid && resp.worldBossBattleUuid !== currentBattleUuid.value) return
        isClaiming.value = false
        hasClaimed.value = true
        ElMessage.success('奖励已发放到收获箱')
    })
    unbindClaimFail = onWorldBossClaimRewardFail((err) => {
        if (err.bossId && err.bossId !== props.boss.id) return
        isClaiming.value = false
        if (err.message?.includes('已领取')) {
            hasClaimed.value = true
        }
        ElMessage.error(err.message || '领取失败')
    })
})

onUnmounted(() => {
    unbindRefreshOk?.()
    unbindRefreshFail?.()
    unbindClaimOk?.()
    unbindClaimFail?.()
})
</script>

<style scoped>
.text-xxs {
    font-size: 11px;
}
</style>
