<template>
  <div>
    <h2 class="text-lg font-bold mb-4">上架记录</h2>
    <el-table :data="history" style="width: 100%" v-loading="loading" empty-text="暂无记录">
      <el-table-column prop="sellResourceId" label="出售资源">
        <template #default="{ row }">
            <GameCommonSimpleResourceIconAndName :resource-id="row.sellResourceId"></GameCommonSimpleResourceIconAndName>
        </template>
      </el-table-column>
      <el-table-column prop="sellResourceCount" label="上架数量" />
      <el-table-column prop="selledResourceCount" label="已售数量" />
      <el-table-column prop="costResourceId" label="定价资源">
        <template #default="{ row }">
            <GameCommonSimpleResourceIconAndName :resource-id="row.costResourceId"></GameCommonSimpleResourceIconAndName>
        </template>
      </el-table-column>
      <el-table-column prop="costPerUnit" label="单价" />
      <el-table-column prop="isClosed" label="是否已关闭">
        <template #default="{ row }">
          <el-tag :type="row.isClosed ? 'info' : 'success'">
            {{ row.isClosed ? '已关闭' : '进行中' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="上架时间">
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
import { emitGetMarketListHistory, onGetMarketListHistorySuccess, onGetMarketListHistoryError } from "@/api/game/socket/market";
import type { MarketTradeInfo } from "~/shared/types/market";
import { ElMessage } from "element-plus";

const history = ref<MarketTradeInfo[]>([]);
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
  emitGetMarketListHistory();
  offSuccess = onGetMarketListHistorySuccess((data) => {
    history.value = data;
    loading.value = false;
  });
  offError = onGetMarketListHistoryError((err) => {
    ElMessage.error(err.message || "获取历史上架记录失败");
    loading.value = false;
  });
});

onUnmounted(() => {
  offSuccess && offSuccess();
  offError && offError();
});
</script>