<template>
  <el-card>
    <h2 class="text-2xl font-bold mb-4">买方市场</h2>
    <div class="text-gray-600 dark:text-gray-400 mb-6 text-sm">
      这里是处在试运行阶段的买方市场，你可以发起求购单，或将资源卖给其他玩家的求购单。<br>
      在试运行阶段，你可以使用任意资源来支付求购单，卖出时会自动结算为你选择的资源。后续视市场情况，可能规范为仅使用金币进行结算。<br>
      求购时会冻结支付资源，卖出后自动结算。<br>
      后续求购市场将与常规市场合并，届时会有更多功能和优化。<br>
    </div>
    <el-tabs v-model="activeTab" class="w-full">
      <el-tab-pane :lazy="true" label="求购市场" name="index">
        <GameBuyerMarket />
      </el-tab-pane>
      <el-tab-pane :lazy="true" label="求购记录" name="history">
        <GameBuyerMarketHistory />
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>
<script setup lang="ts">
const activeTab = ref("index");
</script>