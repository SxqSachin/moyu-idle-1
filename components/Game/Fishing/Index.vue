<template>
  <el-tabs v-model="activeTabs">
    <el-tab-pane label="地图" name="map">
      <GameFishingMapContainer></GameFishingMapContainer>
    </el-tab-pane>
    <el-tab-pane label="垂钓记录" name="history" :lazy="true">
      <FishingSessionsList />
    </el-tab-pane>
    <el-tab-pane label="鱼获" name="catches" :lazy="true">
      <FishingMyCatches />
    </el-tab-pane>
    <el-tab-pane label="水产商店" name="shop" :lazy="true">
        <el-tabs class="w-full" v-model="fishActiveTab">
          <el-tab-pane label="鱼类回收" name="fish">
            <GameShopFishShop />
          </el-tab-pane>
          <el-tab-pane label="特殊鱼类回收" name="specialFish">
            <GameInventoryPondTab />
          </el-tab-pane>
        </el-tabs>
    </el-tab-pane>
    <el-tab-pane label="排行榜" name="leaderboard" :lazy="true">
      <FishingLeaderboard />
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="tsx">

import FishingSessionsList from './FishingSessionsList.vue'
import FishingMyCatches from './FishingMyCatches.vue'
import FishingLeaderboard from './FishingLeaderboard.vue'
const activeTabs = ref('map');
const fishActiveTab = ref('fish')

</script>
