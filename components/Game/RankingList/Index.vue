<template>
  <el-card class="p-0">
    <el-tabs v-model="activeTab" class="mb-0">
      <el-tab-pane label="金币排行榜" name="gold_ranking_list_normal" />
      <el-tab-pane label="猫爪币排行榜" name="cat_paw_coin_ranking_list_normal" />
      <el-tab-pane label="猫爪印章排行榜" name="cat_paw_stamp_ranking_list_normal" /> <!-- 新增 -->
      <el-tab-pane label="赞助榜" name="sponsor_list" />
      <el-tab-pane label="角色等级排行榜" name="character_level" />
      <el-tab-pane label="猫咪" name="kitty" />
      <el-tab-pane label="斧头强化榜" name="axe_enhance_level_ranking_list_normal" /> <!-- 新增 -->
    </el-tabs>


    <!-- 金币排行榜 -->
    <div v-if="activeTab === 'gold_ranking_list_normal' && getRankingList('gold_ranking_list_normal').map(item => item.uuid).length">
      <GameUserBatchAvatarAndName :uuid-list="getRankingList('gold_ranking_list_normal').map(item => item.uuid)">
        <el-table :data="getRankingList('gold_ranking_list_normal')" empty-text="加载中" :loading="loading" stripe
          class="w-full rounded shadow" header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
          <el-table-column label="排名" type="index" width="70" align="center" />
          <el-table-column prop="name" label="用户名" align="left">
            <template #default="{ row }">
              <GameUserAvatarAndName class="cursor-pointer" @click="showPlayerInfo(row)" :uuid="row.uuid"></GameUserAvatarAndName>
            </template>
          </el-table-column>
          <el-table-column prop="rank" label="金币">
            <template #default="{ row }">
              {{ formatNumber(row.rank) }}
            </template>
          </el-table-column>
        </el-table>
      </GameUserBatchAvatarAndName>
    </div>

    <!-- 猫爪币排行榜 -->
    <div v-if="activeTab === 'cat_paw_coin_ranking_list_normal'">
      <GameUserBatchAvatarAndName :uuid-list="getRankingList('cat_paw_coin_ranking_list_normal').map(item => item.uuid)">
        <el-table :data="getRankingList('cat_paw_coin_ranking_list_normal')" empty-text="加载中" :loading="loading" stripe
          class="w-full rounded shadow" header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
          <el-table-column label="排名" type="index" width="70" align="center" />
          <el-table-column prop="name" label="用户名" align="center">
            <template #default="{ row }">
              <GameUserAvatarAndName class="cursor-pointer" @click="showPlayerInfo(row)" :uuid="row.uuid"></GameUserAvatarAndName>
            </template>
          </el-table-column>
          <el-table-column prop="rank" label="数量" align="center" />
        </el-table>
      </GameUserBatchAvatarAndName>
    </div>

    <!-- 猫爪印章排行榜 -->
    <div v-if="activeTab === 'cat_paw_stamp_ranking_list_normal'">
      <GameUserBatchAvatarAndName :uuid-list="getRankingList('cat_paw_stamp_ranking_list_normal').map(item => item.uuid)">
        <el-table :data="getRankingList('cat_paw_stamp_ranking_list_normal')" empty-text="加载中" :loading="loading" stripe
          class="w-full rounded shadow" header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
          <el-table-column label="排名" type="index" width="70" align="center" />
          <el-table-column prop="name" label="用户名" align="center">
            <template #default="{ row }">
              <GameUserAvatarAndName class="cursor-pointer" @click="showPlayerInfo(row)" :uuid="row.uuid"></GameUserAvatarAndName>
            </template>
          </el-table-column>
          <el-table-column prop="rank" label="猫爪印章" align="center" />
        </el-table>
      </GameUserBatchAvatarAndName>
    </div>

    <!-- 赞助拍行榜 -->
    <div v-if="activeTab === 'sponsor_list'">
      <GameUserBatchAvatarAndName :listen-change="true" :uuid-list="sponsorUuidList">
        <el-text size="small" class="block mt-4!">赞助榜每2天更新一次，如有遗漏、赞助时未填写id或改名导致未被统计，可联系管理员</el-text>
        <el-table :data="sponsorPagedList" empty-text="加载中" :loading="loading" stripe
          class="w-full rounded shadow" header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
          <el-table-column label="排名" type="index" :index="sponsorIndex" width="70" align="center" />
          <el-table-column prop="name" label="用户名" align="center">
            <template #default="{ row }">
              <div class="ml-0 md:ml-52 text-left">
                <GameUserAvatarAndName :uuid="row.uuid" @click="showPlayerInfo(row)"></GameUserAvatarAndName>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="flex justify-center mt-3">
          <el-pagination
            layout="prev, pager, next, jumper"
            :page-size="sponsorPageSize"
            :current-page="sponsorPage"
            :total="sponsorFullList.length"
            @current-change="onSponsorPageChange"
          />
        </div>
      </GameUserBatchAvatarAndName>
    </div>

    <!-- 角色等级排行榜（总等级+各属性） -->
    <div v-if="activeTab === 'character_level'">
      <el-tabs v-model="activeLevelTab" tab-position="left" class="mb-2">
        <el-tab-pane :lazy="true" v-for="item in characterLevelRankings" :key="item.name"
          :label="getLevelRankingTitle(item.name)" :name="item.name">
          <GameUserBatchAvatarAndName :uuid-list="getRankingList(activeLevelTab).map(item => item.uuid)">
            <el-table height="1000px" :data="getRankingList(activeLevelTab)" empty-text="加载中" :loading="loading" stripe
              class="rounded shadow mt-2" header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
              <el-table-column label="排名" type="index" width="70" align="center" />
              <el-table-column prop="name" label="用户名" align="center" width="140">
                <template #default="{ row }">
                  <GameUserAvatarAndName :uuid="row.uuid" @click="showPlayerInfo(row)"></GameUserAvatarAndName>
                </template>
              </el-table-column>
              <el-table-column prop="rank" :label="getLevelRankingLabel(activeLevelTab)" align="center" />
            </el-table>
          </GameUserBatchAvatarAndName>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div v-if="activeTab === 'kitty'">
      <el-tabs v-model="kittyActiveTab" tab-position="left" class="mb-2">
        <el-tab-pane :lazy="true" v-for="(k, v) in kittyRank" :name="v" :key="v" :label="k" class="p-0!">
          <div v-if="v === 'kitty_friendship'">
            <el-table :data="getRankingList('kitty_friendship_ranking_list')" empty-text="加载中" :loading="loading" stripe
              class="w-full rounded shadow" header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
              <el-table-column label="排名" type="index" width="70" align="center" />
              <el-table-column prop="name" label="猫咪们" align="center" width="200">
                <template #default="{ row }">
                  <div class="flex flex-row gap-4 w-full items-center justify-center text-center">
                    <GameCommonKittyInfo :uuid="row.kittyAUuid"></GameCommonKittyInfo>
                    <GameCommonKittyInfo :uuid="row.kittyBUuid"></GameCommonKittyInfo>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="intimacy" label="亲密度" align="center" />
            </el-table>
          </div>

          <div v-if="v === 'kitty_friends'">
            <el-table :data="getRankingList('kitty_most_friends_ranking_list')" empty-text="加载中" :loading="loading"
              stripe class="w-full rounded shadow" header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
              <el-table-column label="排名" type="index" width="70" align="center" />
              <el-table-column prop="name" label="猫咪" align="center" width="200">
                <template #default="{ row }">
                  <div class="flex flex-row gap-4 w-full items-center justify-center text-center">
                    <GameCommonKittyInfo :uuid="row.kittyUuid"></GameCommonKittyInfo>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="friendCount" label="玩伴数量" align="center" />
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div v-if="activeTab === 'axe_enhance_level_ranking_list_normal'">
          <GameUserBatchAvatarAndName :uuid-list="getRankingList('axe_enhance_level_ranking_list_normal').map(item => item.uuid)">
      <el-table :data="getRankingList('axe_enhance_level_ranking_list_normal')" empty-text="加载中" :loading="loading" stripe
        class="w-full rounded shadow" header-cell-class-name="bg-gray-100 dark:bg-gray-700 ">
        <el-table-column label="排名" type="index" width="70" align="center" />
        <el-table-column prop="name" label="用户名" align="left">
          <template #default="{ row }">
            <GameUserAvatarAndName class="cursor-pointer" @click="showPlayerInfo(row)" :uuid="row.uuid"></GameUserAvatarAndName>
          </template>
        </el-table-column>
        <el-table-column prop="rank" label="斧头强化等级">
          <template #default="{ row }">
            {{ formatNumber(row.rank) }}
          </template>
        </el-table-column>
      </el-table>
    </GameUserBatchAvatarAndName>
    </div>


    <template v-if="activeTab != 'sponsor_list'">
      <el-text size="small" class="block mt-4!">排行榜每30分钟更新一次</el-text>
    </template>
    <template v-else>
      <el-text size="small" class="block mt-4!">赞助榜每2天更新一次，如有遗漏或改名导致未被统计，可联系管理员</el-text>
    </template>

    <!-- 玩家信息弹窗 -->
    <el-dialog v-model="playerInfoDialogVisible" align-center width="420px" :show-close="true"
      :close-on-click-modal="true" destroy-on-close>
      <template #header>
        <span>玩家信息</span>
      </template>

      <GameCharacterInfo :character-uuid="currentSelectPlayerUuid!"></GameCharacterInfo>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { emitRequestRankingList, onDispatchRankingList } from "~/api/game/socket/rankingList";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { allCharacterStatus, allCharacterStatusType } from "~/shared/data/allCharacterStatus";
import type { AllCharacterStatusType } from "~/shared/types/characterInfo";
import type { RankingList } from "~/shared/types/rankingList";
import AvatarAndName from "../User/AvatarAndName.vue";
import { formatNumber } from "~/shared/utils";

const rankingList = ref<RankingList[]>([]);
const activeTab = ref("gold_ranking_list_normal");
const activeLevelTab = ref("character_total_level_ranking_list_normal");
const kittyActiveTab = ref("kitty_friends");
const sponsorPageSize = 100;
const sponsorPage = ref(1);


const kittyRank = {
  'kitty_friends': '玩伴数',
  'kitty_friendship': '亲密度',

}

// 新增 loading 状态
const loading = ref(false);

// 弹窗相关
const playerInfoDialogVisible = ref(false);
const currentSelectPlayerUuid = ref<string | null>(null);

function showPlayerInfo(row: any) {
  currentSelectPlayerUuid.value = row.uuid || null;
  playerInfoDialogVisible.value = true;
}

const characterLevelRankings = computed(() => {
  const total = rankingList.value.find(r => r.name === "character_total_level_ranking_list_normal");
  const attrs = allCharacterStatusType.map(type => {
    const key = `character_${type}_level_ranking_list_normal`;
    return rankingList.value.find(r => r.name === key) || {
      name: key,
      list: []
    };
  });
  return [
    ...(total ? [total] : []),
    ...attrs
  ];
});

function getRankingList(name: string) {
  const found = rankingList.value.find(r => r.name === name);
  return found ? found.list.slice(0, 100000) : [];
}

const sponsorFullList = computed(() => getRankingList('sponsor_ranking_list'));
const sponsorPagedList = computed(() => {
  const start = (sponsorPage.value - 1) * sponsorPageSize;
  return sponsorFullList.value.slice(start, start + sponsorPageSize);
});
const sponsorUuidList = computed(() => sponsorPagedList.value.map(item => item.uuid));

const sponsorIndex = (index: number) => (sponsorPage.value - 1) * sponsorPageSize + index + 1;

function onSponsorPageChange(page: number) {
  sponsorPage.value = page;
}

function getLevelRankingTitle(name: string) {
  if (name === "character_total_level_ranking_list_normal") return "🏅总等级";
  const match = name.match(/^character_(.+)_level_ranking_list_normal$/);
  if (match) {
    const statusKey = match[1] as AllCharacterStatusType;
    if (allCharacterStatus[statusKey]) {
      return `${allCharacterStatus[statusKey].icon} ${allCharacterStatus[statusKey].name}`;
    }
    return `${statusKey}等级`;
  }
  return name;
}

function getLevelRankingLabel(name: string) {
  if (name === "character_total_level_ranking_list_normal") return "总等级";
  return "等级";
}

onMounted(async () => {
  loading.value = true; // 开始加载
  await waitUtilConnected();
  onDispatchRankingList(pRankingList => {
    rankingList.value = pRankingList;
    if (characterLevelRankings.value.length > 0) {
      activeLevelTab.value = "character_total_level_ranking_list_normal";
    }
    loading.value = false; // 加载结束
  });
  emitRequestRankingList();
});

watch(activeTab, (tab) => {
  if (tab === 'sponsor_list') {
    sponsorPage.value = 1;
  }
});
</script>

<style>
.el-tabs__header.is-left .el-tabs__nav.is-left .el-tabs__item.is-left{
  padding: 0;
  padding-right: 1em;
}
</style>