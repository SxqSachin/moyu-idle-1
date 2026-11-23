<template>
  <div>
    <h2 class="text-lg font-bold mb-4">求购记录</h2>
    <el-table :data="history" style="width: 100%" v-loading="loading" empty-text="暂无记录">
      <el-table-column prop="requireResourceId" label="求购资源">
        <template #default="{ row }">
          <GameCommonSimpleResourceIconAndName :resource-id="row.requireResourceId"></GameCommonSimpleResourceIconAndName>
        </template>
      </el-table-column>
      <el-table-column prop="requireResourceCount" label="求购数量" />
      <el-table-column prop="doneResourceCount" label="已完成数量" />
      <el-table-column prop="payResourceId" label="支付资源">
        <template #default="{ row }">
          <GameCommonSimpleResourceIconAndName :resource-id="row.payResourceId"></GameCommonSimpleResourceIconAndName>
        </template>
      </el-table-column>
      <el-table-column prop="payPerUnit" label="单价" />
      <el-table-column prop="isClosed" label="是否已关闭">
        <template #default="{ row }">
          <el-tag :type="row.isClosed ? 'info' : 'success'">
            {{ row.isClosed ? '已关闭' : '进行中' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="发起时间">
        <template #default="{ row }">
          {{ formatTime(row.createTime) }}
        </template>
      </el-table-column>
      <el-table-column prop="closeTime" label="关闭时间">
        <template #default="{ row }">
          {{ row.closeTime ? formatTime(row.closeTime) : '-' }}
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { emitGetBuyerMarketListHistory, onGetBuyerMarketListHistorySuccess, onGetBuyerMarketListHistoryError } from "@/api/game/socket/buyerMarket";
import type { BuyerMarketTradeInfo } from "~/shared/types/buyerMarket";
import { ElMessage } from "element-plus";

const history = ref<BuyerMarketTradeInfo[]>([]);
const loading = ref(true);

function formatTime(time: string | Date) {
  if (!time) return "-";
  const d = typeof time === "string" ? new Date(time) : time;
  return d.toLocaleString();
}

let offSuccess: (() => void) | undefined;
let offError: (() => void) | undefined;

onMounted(() => {
  loading.value = true;
  emitGetBuyerMarketListHistory();
  offSuccess = onGetBuyerMarketListHistorySuccess((data) => {
    history.value = data;
    loading.value = false;
  });
  offError = onGetBuyerMarketListHistoryError((err) => {
    ElMessage.error(err.message || "获取求购历史失败");
    loading.value = false;
  });
});

onUnmounted(() => {
  offSuccess && offSuccess();
  offError && offError();
});
</script>