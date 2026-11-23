<template>
    <div>
        <el-button size="small" @click="open" v-if="boss">排行榜</el-button>

        <el-dialog v-model="visible" :width="isMobile ? '100%' : '720px'" :before-close="onClose" title="“大麻烦” 场次排行榜">
            <div v-if="loading" class="text-center py-6">加载中...</div>
            <template v-else>
                <el-collapse accordion v-model="activePanels">
                    <el-collapse-item v-for="group in groups" :key="group.uuid" :title="groupTitle(group)" :name="group.uuid">

                        <div v-if="rowsLoading[group.uuid]" class="text-center py-4">加载中...</div>

                        <template v-else>
                            <div class="mb-2 text-xs text-gray-500">共 {{ (rowsMap[group.uuid] || []).length }} 场 • 总伤害 {{
                                formatNumber(group.totalDamage) }}</div>
                            <game-user-batch-avatar-and-name
                                :uuid-list="(rowsMap[group.uuid] || []).map(i => i.playerUuids).flat()">
                                <el-table :data="rowsMap[group.uuid] || []" style="width: 100%" size="small">
                                    <el-table-column label="#" width="48">
                                        <template #default="{ row, $index }">{{ $index + 1 }}</template>
                                    </el-table-column>
                                    <el-table-column label="玩家数">
                                        <template #default="{ row }">
                                            <div class="flex flex-col gap-2">
                                                <template v-for="uuid of row.playerUuids" :key="uuid">
                                                    <div class="py-2">
                                                        <GameUserAvatarAndName :uuid="uuid"></GameUserAvatarAndName>
                                                    </div>
                                                </template>
                                            </div>
                                        </template>
                                    </el-table-column>
                                    <el-table-column prop="totalDamage" label="总伤害" width="140">
                                        <template #default="{ row }">{{ formatNumber(row.totalDamage) }}</template>
                                    </el-table-column>
                                </el-table>
                            </game-user-batch-avatar-and-name>
                        </template>
                    </el-collapse-item>
                </el-collapse>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import dayjs from 'dayjs';
import type { WorldBossConfigWithState } from '~/shared/types/worldBoss';
import { emitWorldBossLeaderboard, onWorldBossLeaderboardSuccess, onWorldBossLeaderboardFail, emitWorldBossLeaderboardGroups, onWorldBossLeaderboardGroupsSuccess, onWorldBossLeaderboardGroupsFail } from '~/api/game/socket/worldBoss';
import { GameUserBatchAvatarAndName } from '#components';
import { rowContextKey } from 'element-plus';

const props = defineProps<{ boss: WorldBossConfigWithState }>();

const { isMobile } = useDevice()

const visible = ref(false);
const loading = ref(false);

// groups are fetched on open (summary only)
const groups = ref<{ uuid: string; totalDamage: string; minCreatedAt: number; maxCreatedAt: number }[]>([]);

// per-group rows loaded on demand
const rowsMap = ref<Record<string, any[]>>({});
const rowsLoading = ref<Record<string, boolean>>({});
const activePanels = ref<string | any>(null);

const groupTitle = (g: { minCreatedAt: number; maxCreatedAt: number }) => {
    if (!g) return '';
    if (g.minCreatedAt === g.maxCreatedAt) return `${formatTime(g.maxCreatedAt)}`;
    return `${formatTime(g.minCreatedAt)} ~ ${formatTime(g.maxCreatedAt)}`;
};

let offOk: (() => void) | undefined;
let offFail: (() => void) | undefined;
let offGroupsOk: (() => void) | undefined;
let offGroupsFail: (() => void) | undefined;

const open = () => {
    visible.value = true;
    fetchGroups();
}

const fetchGroups = () => {
    loading.value = true;
    groups.value = [];
    emitWorldBossLeaderboardGroups({ bossId: props.boss.id });
}

const fetchGroupRows = (uuid: string) => {
    if (!uuid) return;
    rowsLoading.value[uuid] = true;
    rowsMap.value[uuid] = rowsMap.value[uuid] || [];
    emitWorldBossLeaderboard({ bossId: props.boss.id, worldBossBattleUuid: uuid, limit: 200 });
}

onMounted(() => {
    offOk = onWorldBossLeaderboardSuccess((resp) => {
        // server returns queryUuid to associate response
        const q = (resp as any).queryUuid;
        if (q) {
            rowsMap.value[q] = resp.list || [];
            rowsLoading.value[q] = false;
            return;
        }
        // fallback (should not happen normally)
        loading.value = false;
    });
    offFail = onWorldBossLeaderboardFail((err) => {
        console.error(err);
        // stop any loading flags
        Object.keys(rowsLoading.value).forEach(k => rowsLoading.value[k] = false);
        loading.value = false;
        ElMessage.error(err.message || '获取失败');
    });
    offGroupsOk = onWorldBossLeaderboardGroupsSuccess((resp) => {
        groups.value = resp.list || [];
        loading.value = false;
    });
    offGroupsFail = onWorldBossLeaderboardGroupsFail((err) => {
        console.error(err);
        loading.value = false;
        ElMessage.error(err.message || '获取分组失败');
    });
});

onUnmounted(() => {
    offOk?.();
    offFail?.();
    offGroupsOk?.();
    offGroupsFail?.();
});

watch(() => props.boss, (n) => {
    if (!n) {
        visible.value = false;
    }
});

const onClose = () => {
    visible.value = false;
}

watch(activePanels, (uuid) => {
    if (!uuid) return;
    if (rowsMap.value[uuid] && rowsMap.value[uuid].length) return; // already loaded
    fetchGroupRows(uuid);
});

const formatNumber = (v: string | number) => {
    const s = String(v || '0');
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const formatTime = (ts: number | string) => {
    if (!ts) return '';
    return dayjs(Number(ts)).format('MM-DD HH:mm');
}
</script>

<style scoped>
.text-center {
    text-align: center
}
</style>
