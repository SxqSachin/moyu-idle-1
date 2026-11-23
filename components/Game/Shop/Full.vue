
<template>
  <el-card body-class="p-3! md:p-4!">
    <h2 class="text-2xl font-bold mb-4">商店</h2>
    <el-tabs v-model="activeTab" class="w-full">
      <el-tab-pane label="金币" name="shop">
        <GameShop />
      </el-tab-pane>
      <el-tab-pane label="农产品" name="farmingPlant">
        <GameShopFarmingPlantShop />
      </el-tab-pane>
      <el-tab-pane label="水产商店" name="fish">
        <el-tabs class="w-full" v-model="fishActiveTab">
          <el-tab-pane label="鱼类回收" name="fish">
            <GameShopFishShop />
          </el-tab-pane>
          <el-tab-pane label="特殊鱼类回收" name="specialFish">
            <GameInventoryPondTab />
          </el-tab-pane>
        </el-tabs>
      </el-tab-pane>
      <el-tab-pane label="猫爪印章" name="paw">
        <GameShopCatPawStampShop />
      </el-tab-pane>
      <el-tab-pane label="心意点数" name="cute_point">
        <GameShopCutePointShop />
      </el-tab-pane>
      <el-tab-pane label="赞助积分" name="sponsor_point">
        <GameShopSponsorShop/>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const activeTab = ref('shop')
const fishActiveTab = ref('fish')
</script>