<template>
    <el-card shadow="never" class="mb-4">
        <div class="flex items-center justify-between mb-3">
            <div class="font-bold">“大麻烦”</div>
            <el-button size="small" @click="refresh" :loading="loading">刷新</el-button>
        </div>
        <el-empty v-if="!list.length && !loading" description="暂无可用Boss战" />
        <el-skeleton v-else-if="loading" :rows="3" animated />
        <div v-else class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <WorldBossCard v-for="item in list" :key="item.id" :boss="item">
                <template #actions>
                    <div class="flex flex-col gap-1 items-end">
                        <el-button size="small" type="primary" @click.stop="openCreateDialog(item)">创建房间</el-button>
                        <world-boss-leaderboard :boss="item"></world-boss-leaderboard>
                    </div>
                </template>
            </WorldBossCard>
        </div>
        <el-dialog v-model="showCreateDialog" title="创建“大麻烦”战斗房间" width="480px" destroy-on-close>
            <div v-if="selectedBoss">
                <div class="mb-3 text-sm text-gray-600">
                    目标：{{ selectedBoss.name }}（版本 {{ selectedBoss.version }}）
                </div>
                <GameBattleCreateBattleRoom :default-area="defaultArea" battle-type="worldBoss"
                    :world-boss-id="selectedBoss.id" :world-boss-name="selectedBoss.name"
                    :world-boss-version="selectedBoss.version" @create-room="handleCreateRoom" @cancel="closeDialog" />
            </div>
        </el-dialog>
        <el-alert v-if="errorMsg" type="error" :title="errorMsg" :closable="false" class="mt-2" />
    </el-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import dayjs from "dayjs";
import type { FuncAction } from "~/shared/types";
import type { AllBattleAreaID } from "~/shared/types/battle";
import type { WorldBossConfigWithState } from "~/shared/types/worldBoss";
import { allBattleAreas } from "~/shared/data/allBattleInfo";
import { useWorldBoss } from '~/composables/game/useWorldBoss';
import type { ItemDrop } from "~/shared/types/emeny";
import WorldBossCard from "~/components/Game/Battle/WorldBossCard.vue";
import { GameBattleWorldBossLeaderboard } from "#components";
import WorldBossLeaderboard from "./WorldBossLeaderboard.vue";

const { bossList, loading, refresh } = useWorldBoss();
const list = bossList;
const errorMsg = ref("");
const showCreateDialog = ref(false);
const selectedBoss = ref<WorldBossConfigWithState | null>(null);
const defaultArea = Object.keys(allBattleAreas)[0] as AllBattleAreaID;

// `refresh` is provided by `useWorldBoss()` composable above.

const openCreateDialog = (boss: WorldBossConfigWithState) => {
    selectedBoss.value = boss;
    showCreateDialog.value = true;
};

const handleCreateRoom = () => {
    showCreateDialog.value = false;
};

const closeDialog = () => {
    showCreateDialog.value = false;
};

// useWorldBoss manages listeners and initial refresh
</script>
