<template>
  <el-card body-class="p-3! md:p-4! flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold">拍卖行</h2>
      <el-button type="primary" @click="showCreate = true">创建拍卖</el-button>
    </div>

    <el-tabs v-model="activeTab" class="w-full">
      <el-tab-pane :lazy="true" label="列表" name="list">
        <AuctionList @select="onSelect" ref="listRef" />
      </el-tab-pane>

          <el-tab-pane :lazy="true" label="即将成交" name="upcoming">
            <Upcoming @select="(uuid) => onSelect(uuid)" />
          </el-tab-pane>

      <el-tab-pane :lazy="true" label="详情" name="detail">
        <AuctionDetail v-if="selected" :uuid="selected" @refresh="onRefresh" />
        <div v-else class="p-4 bg-white shadow rounded text-gray-500">选择一个拍卖以查看详情</div>
      </el-tab-pane>
    </el-tabs>

    <CreateDialog v-model:visible="showCreate" @created="onCreated" />
  </el-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import AuctionList from "./List/Index.vue";
import AuctionDetail from "./Detail.vue";
import CreateDialog from "./CreateDialog.vue";
import Upcoming from "./Upcoming.vue";

const selected = ref<string | null>(null);
const showCreate = ref(false);
const listRef = ref();

const activeTab = ref("list")

function onSelect(uuid: string) {
  selected.value = uuid;
  activeTab.value = "detail"
}
function onCreated(uuid: string) {
  // 选中新创建的拍卖并刷新列表/详情
  selected.value = uuid;
  // 如果需要刷新列表，调用子组件方法或更改查询参数触发刷新
  listRef.value?.reload?.();

  setTimeout(() => {
    listRef.value?.reload?.();
  }, 1000)
}
function onRefresh() {
  listRef.value?.reload?.();
}
</script>