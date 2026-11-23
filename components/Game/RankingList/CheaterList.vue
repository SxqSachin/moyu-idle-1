<template>
    <el-card class="p-0">
        <el-tabs v-model="activeTab" class="mb-0">
            <el-tab-pane label="超级学习家" name="skill_list" />
            <el-tab-pane label="宿舍" name="mr_list" />
            <el-tab-pane label="财富榜" name="rich_list" />
        </el-tabs>

        <!-- 金币排行榜 -->
        <div v-if="activeTab === 'skill_list'">
            <div class="mb-2 text-md">技能等级异常的玩家，示众后清理账号</div>
            <el-table :data="unbannedAbnormalSkillsList" empty-text="加载中" stripe class="w-full rounded shadow"
                header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
                <el-table-column label="排名" type="index" width="70" align="center" />
                <el-table-column prop="name" label="用户名" align="center">
                    <template #default="{ row }">
                        <GameUserAvatarAndName @click="showPlayerInfo(row.character_uuid)" :uuid="row.character_uuid">
                        </GameUserAvatarAndName>
                    </template>
                </el-table-column>
                <el-table-column prop="name" label="技能" align="center">
                    <template #default="{ row }">
                        <span> {{ getSkillName(row.skill_id) }} Lv.{{ row.level }}</span>
                    </template>
                </el-table-column>
            </el-table>

            <template v-if="bannedAbnormalSkillsList.length">
                <div class="mt-4 mb-2">已处理</div>
                <el-table v-if="bannedAbnormalSkillsList.length" :data="bannedAbnormalSkillsList" empty-text="加载中"
                    stripe class="w-full rounded shadow" header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
                    <el-table-column label="排名" type="index" width="70" align="center" />
                    <el-table-column prop="name" label="用户名" align="center">
                        <template #default="{ row }">
                            <GameUserAvatarAndName @click="showPlayerInfo(row.character_uuid)"
                                :uuid="row.character_uuid">
                            </GameUserAvatarAndName>
                        </template>
                    </el-table-column>
                    <el-table-column prop="name" label="技能" align="center">
                        <template #default="{ row }">
                            <span> {{ getSkillName(row.skill_id) }} Lv.{{ row.level }}</span>
                        </template>
                    </el-table-column>
                </el-table>
            </template>
        </div>

        <div v-if="activeTab === 'mr_list'">
            <div class="mb-2 text-md">基于ip与设备特征进行筛选，示众后清理账号</div>
            <el-table :data="unbannedSuspiciousUserGroups" empty-text="加载中" stripe class="w-full rounded shadow"
                header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
                <el-table-column label="排名" type="index" width="70" align="center" />
                <el-table-column prop="name" label="宿舍成员" align="center">
                    <template #default="{ row }">
                        <div class="flex gap-2" v-for="user of row.users">
                            <GameUserAvatarAndName @click="showPlayerInfo(user.uuid)" :uuid="user.uuid">
                            </GameUserAvatarAndName>
                        </div>
                    </template>
                </el-table-column>
            </el-table>

            <template v-if="bannedSuspiciousUserGroups.length">
                <div class="mt-4 mb-2">已处理</div>
                <el-table :data="bannedSuspiciousUserGroups" empty-text="加载中" stripe class="w-full rounded shadow"
                    header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
                    <el-table-column label="排名" type="index" width="70" align="center" />
                    <el-table-column prop="name" label="宿舍成员" align="center">
                        <template #default="{ row }">
                            <div class="flex gap-2" v-for="user of row.users">
                                <GameUserAvatarAndName @click="showPlayerInfo(user.uuid)" :uuid="user.uuid">
                                </GameUserAvatarAndName>
                            </div>
                        </template>
                    </el-table-column>
                </el-table>
            </template>
        </div>

        <div v-if="activeTab === 'rich_list'">
            <div class="mb-2 text-md">对拥有大量特殊物品的玩家进行财产公示，核验确实有问题后进行处理</div>
            <el-table :data="unbannedRich" empty-text="加载中" stripe class="w-full rounded shadow"
                header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
                <el-table-column label="排名" type="index" width="70" align="center" />
                <el-table-column prop="name" label="名称" align="center">
                    <template #default="{ row }">
                        <GameUserAvatarAndName @click="showPlayerInfo(row.user_uuid)" :uuid="row.user_uuid">
                        </GameUserAvatarAndName>
                    </template>
                </el-table-column>
                <el-table-column prop="item" label="物品" align="center">
                    <template #default="{ row }">
                        <span>{{ allGameResource[row.item_id].name }} x{{ row.count }}</span>
                    </template>
                </el-table-column>
            </el-table>

            <template v-if="bannedRich.length">
                <div class="mt-4 mb-2">已处理</div>
                <el-table :data="bannedRich" empty-text="加载中" stripe class="w-full rounded shadow"
                    header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
                    <el-table-column label="排名" type="index" width="70" align="center" />
                    <el-table-column prop="name" label="名称" align="center">
                        <template #default="{ row }">
                            <GameUserAvatarAndName @click="showPlayerInfo(row.user_uuid)" :uuid="row.user_uuid">
                            </GameUserAvatarAndName>
                        </template>
                    </el-table-column>
                    <el-table-column prop="item" label="物品" align="center">
                        <template #default="{ row }">
                            <span>{{ allGameResource[row.item_id].name }} x{{ row.count }}</span>
                        </template>
                    </el-table-column>
                </el-table>
            </template>
        </div>
    </el-card>

    <!-- 玩家信息弹窗 -->
    <el-dialog v-model="playerInfoDialogVisible" align-center width="420px" :show-close="true"
        :close-on-click-modal="true" destroy-on-close>
        <template #header>
            <span>玩家信息</span>
        </template>

        <GameCharacterInfo :character-uuid="currentSelectPlayerUuid!"></GameCharacterInfo>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { emitRequestCheaterList, emitRequestRankingList, onDispatchCheaterList, onDispatchRankingList } from "~/api/game/socket/rankingList";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { allGameBattleSkillIds, allGameBattleSkills } from "~/shared/data/allGameBattleSkill";
import { allGameResource } from "~/shared/data/allGameResources";
import type { AllBattleSkillId } from "~/shared/types/skill";

const rankingList = ref<any>([]);
const activeTab = ref("skill_list");

const currentSelectPlayerUuid = ref("");
const playerInfoDialogVisible = ref(false);

const bannedMap = ref<{[key: string]: boolean}>({});

onMounted(async () => {
  await waitUtilConnected();
  emitRequestCheaterList();
  onDispatchCheaterList(pRankingList => {
    rankingList.value = pRankingList

    bannedMap.value = pRankingList.userIsBanned || {};
  });
});

function showPlayerInfo(uuid: string) {
  currentSelectPlayerUuid.value = uuid;
  playerInfoDialogVisible.value = true;
}

function getSkillName(skillId: AllBattleSkillId) {
    return allGameBattleSkills[skillId]?.name || "未知技能";
}

let unbannedAbnormalSkillsList = computed(() => {
    let list = rankingList.value?.abnormalSkills ?? [];

    let unbannedList = list.filter((item: any) => {
        return !bannedMap.value[item.character_uuid];
    });

    return unbannedList
})

let bannedAbnormalSkillsList = computed(() => {
    let list = rankingList.value?.abnormalSkills ?? [];

    let bannedList = list.filter((item: any) => {
        return bannedMap.value[item.character_uuid];
    });

    return bannedList
})

let unbannedSuspiciousUserGroups = computed(() => {
    let list = rankingList.value?.suspiciousUserGroups ?? [];

    let res: any = []
    for(const item of list) {
        let unbannedUser = item.users.filter((user: any) => {
            return !bannedMap.value[user.uuid]
        });

        if (unbannedUser.length <= 1) {
            continue;
        }

        res.push({
            ...item,
            users: unbannedUser
        });
    }

    return res
})

let bannedSuspiciousUserGroups = computed(() => {
    let list = rankingList.value?.suspiciousUserGroups ?? [];

    let res: any = []
    for(const item of list) {
        let bannedUser = item.users.filter((user: any) => {
            return bannedMap.value[user.uuid]
        });

        res.push({
            ...item,
            users: bannedUser
        });
    }

    return res
})


let unbannedRich = computed(() => {
    let list = rankingList.value?.rich?? [];

    let bannedList = list.filter((item: any) => {
        return !bannedMap.value[item.character_uuid];
    });

    return bannedList
})
let bannedRich = computed(() => {
    let list = rankingList.value?.rich?? [];

    let bannedList = list.filter((item: any) => {
        return bannedMap.value[item.character_uuid];
    });

    return bannedList
})
</script>