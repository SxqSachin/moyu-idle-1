<template>
  <div>
    <!-- 资源Tab栏，金币永远排第一 -->
    <el-tabs
      v-model="tabResourceId"
      type="card"
      class="mb-2"
      @tab-click="onTabResourceChange"
    >
      <el-tab-pane
        v-for="item in resourceTabList"
        :key="item.id"
        :label="allGameResource[item.id]?.name || item.id"
        :name="item.id"
      >
        <template #label>
          <GameCommonSimpleResourceIconAndName :resource-id="item.id" class="mr-1" />
        </template>
      </el-tab-pane>
    </el-tabs>

    <el-table :data="filteredByTab" border stripe class="mb-4">
      <el-table-column label="资源" prop="requireResourceId">
        <template #default="{ row }">
          <GameCommonResourceIconAndName
            v-if="row && row.requireResourceId"
            :resource-id="row.requireResourceId"
          />
          <span v-else class="text-gray-500">未知资源</span>
        </template>
      </el-table-column>
      <el-table-column label="数量" prop="requireResourceCount">
        <template #default="{ row }">
          <span v-if="row">
            <template v-if="!!userUuid && row.buyer === userUuid && row.doneResourceCount > 0">
              {{ row.requireResourceCount }} (已完成:{{ row.doneResourceCount }})
            </template>
            <template v-else>
              {{ (row.requireResourceCount ?? 0) - (row.doneResourceCount ?? 0) }}
            </template>
          </span>
          <span v-else class="text-gray-500">未知数量</span>
        </template>
      </el-table-column>
      <el-table-column label="单价" prop="payPerUnit">
        <template #default="{ row }">
          <GameCommonResourceIconAndName
            v-if="row && row.payResourceId"
            :resource-id="row.payResourceId"
            :count="row.payPerUnit ?? 0"
          />
          <span v-else class="text-gray-500">未知价格</span>
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template #default="{ row }">
          <span v-if="!row" class="text-gray-500">未知操作</span>
          <template v-else>
            <el-button
              v-if="!!userUuid && row.buyer === userUuid && !row.isClosed"
              size="small"
              type="warning"
              @click="$emit('remove', row)"
            >撤销</el-button>
            <el-button
              v-else
              size="small"
              type="success"
              @click="$emit('sell', row)"
            >卖出</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { GameCommonResourceIconAndName, GameCommonSimpleResourceIconAndName } from "#components";
import { allGameResource } from "@/shared/data/allGameResources";
import type { BuyerMarketTradeInfo } from "@/shared/types/buyerMarket";

const props = defineProps<{
  filteredMarketList: BuyerMarketTradeInfo[],
  userUuid: string,
}>();

const emit = defineEmits<{
  (e: 'remove', row: BuyerMarketTradeInfo): void,
  (e: 'sell', row: BuyerMarketTradeInfo): void,
}>();

// 资源Tab列表，金币永远排第一，其余按名称排序
const resourceTabList = computed(() => {
  const ids = Array.from(new Set(props.filteredMarketList.map(i => i.payResourceId)));
  const goldIdx = ids.indexOf("gold");
  if (goldIdx !== -1) ids.splice(goldIdx, 1);
  const sorted = ids.sort((a, b) => (allGameResource[a]?.name || a).localeCompare(allGameResource[b]?.name || b, "zh-Hans-CN"));
  return [{ id: "gold" }, ...sorted.map(id => ({ id }))];
});

const tabResourceId = ref("gold");

// 切换Tab时
function onTabResourceChange(tab: any) {
  tabResourceId.value = tab?.props?.name;
}

// 只显示当前Tab对应支付资源的求购单
const filteredByTab = computed(() => {
  return props.filteredMarketList.filter(item => {
    return item.payResourceId === tabResourceId.value
});
});

// 初始化时自动选中金币或第一个资源
onMounted(() => {
  if (!tabResourceId.value && resourceTabList.value.length) {
    tabResourceId.value = resourceTabList.value[0].id;
  }
});

// 若外部数据变化，自动切换到第一个资源
watch(
  () => resourceTabList.value,
  (list) => {
    if (list.length && !list.find(i => i.id === tabResourceId.value)) {
      tabResourceId.value = list[0].id;
    }
  }
);
</script>