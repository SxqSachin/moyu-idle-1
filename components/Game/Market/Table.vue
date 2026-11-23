
<template>
  <div>
    <el-table :data="filteredMarketList" border stripe class="mb-4">
      <el-table-column label="物品" prop="sellResourceId">
        <template #default="{ row }">
          <GameCommonResourceIconAndName
            v-if="row && row.sellResourceId"
            :resource-id="row.sellResourceId"
          />
          <span v-else class="text-gray-500">未知物品</span>
        </template>
      </el-table-column>
      <el-table-column label="数量" prop="sellResourceCount">
        <template #default="{ row }">
          <span v-if="row">
            <template v-if="!!userUuid && row.selledResourceCount > 0 && row.seller === userUuid">
              {{ row.sellResourceCount }} (已出售:{{ row.selledResourceCount }})
            </template>
            <template v-else>
              {{ (row.sellResourceCount ?? 0) - (row.selledResourceCount ?? 0) }}
            </template>
          </span>
          <span v-else class="text-gray-500">未知数量</span>
        </template>
      </el-table-column>
      <el-table-column label="单价" prop="costPerUnit">
        <template #default="{ row }">
          <GameCommonResourceIconAndName
            v-if="row && row.costResourceId"
            :resource-id="row.costResourceId"
            :count="row.costPerUnit ?? 0"
          />
          <span v-else class="text-gray-500">未知价格</span>
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template #default="{ row }">
          <span v-if="!row" class="text-gray-500">未知操作</span>
          <template v-else>
            <el-button
              v-if="!!userUuid && row.seller === userUuid && !row.isClosed"
              size="small"
              type="warning"
              @click="$emit('remove', row)"
            >下架</el-button>
            <el-button
              v-else
              size="small"
              type="success"
              @click="$emit('buy', row)"
            >购买</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { GameCommonResourceIconAndName, GameCommonSimpleResourceIconAndName } from "#components";
import { allGameResource } from "@/shared/data/allGameResources";
import type { MarketTradeInfo } from "@/shared/types/market";

const props = defineProps<{
  filteredMarketList: MarketTradeInfo[],
  userUuid: string,
}>();

const emit = defineEmits<{
  (e: 'remove', row: MarketTradeInfo): void,
  (e: 'buy', row: MarketTradeInfo): void,
}>();
</script>