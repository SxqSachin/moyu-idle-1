<template>
    <el-tabs v-model="activeTab" class="mb-0">
      <el-tab-pane v-if="!ironcat" label="总榜" name="all" :lazy="true">
        <GameRankingList></GameRankingList>
      </el-tab-pane>
      <el-tab-pane v-if="ironcat" label="总榜(铁猫)" name="allIron" :lazy="true">
        <GameRankingListIndexIron></GameRankingListIndexIron>
      </el-tab-pane>
      <el-tab-pane v-if="!ironcat" :lazy="true" label="周榜" name="weekly">
        <GameRankingListWeekly></GameRankingListWeekly>
      </el-tab-pane>
      <el-tab-pane v-if="ironcat" :lazy="true" label="周榜(铁猫)" name="weeklyIron">
        <GameRankingListWeeklyIron></GameRankingListWeeklyIron>
      </el-tab-pane>
    </el-tabs>
</template>

<script setup lang="tsx">
import { useIronCat } from '~/composables/game/useIronCat';

const ironcat = useIronCat()

const activeTab = ref('all');

onMounted(() => {
  if (ironcat.value) {
    activeTab.value = 'allIron';
  } else {
    activeTab.value = 'all';
  }
})
</script>