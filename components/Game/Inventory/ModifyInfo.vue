<template>
  <div class="p-4">
    <h2 class="text-xl font-bold mb-4">物品变动记录</h2>
    <p class="text-xs text-gray-600 mb-4">
      每种类别保留最近300次事件的物品变动记录
    </p>
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <!-- <el-tab-pane label="全部" name="all" /> -->
      <el-tab-pane
        v-for="(label, key) in typeLabels"
        :key="key"
        :label="label"
        :name="key"
        :lazy="true"
      />
    </el-tabs>
    <el-table
      v-loading="loading"
      :data="displayedList"
      style="width: 100%"
      class="mb-4"
      stripe
    >
      <el-table-column prop="date" label="时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.date) }}
        </template>
      </el-table-column>
      <el-table-column prop="action" label="事件" width="200"></el-table-column>
      <el-table-column prop="type" label="类型" width="100">
        <template #default="{ row }">
          <span :class="row.type === 'increase' ? 'text-green-600' : 'text-red-600'">
            {{ row.type === 'increase' ? '增加' : '减少' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="info" label="变动内容">
        <template #default="{ row }">
          <div v-for="(item, key) in row.info" :key="key">
            <GameCommonSimpleResourceIconAndName :resource-id="key as any">
              : {{ item.count }}
            </GameCommonSimpleResourceIconAndName>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <div class="flex justify-center">
      <el-button
        v-if="canLoadMore"
        @click="loadMore"
        type="primary"
        size="small"
        plain
      >
        加载更多
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { emitGetInventoryModifyinfo, onGetInventoryModifyInfoSuccess, emitGetInventoryModifyinfoByType, onGetInventoryModifyInfoByTypeSuccess } from '@/api/game/socket/inventory'
import type { ItemCountModifyInfo } from '~/shared/types/gameInventory'
import { formatTime } from '~/shared/utils'
import { ModifyItemCountType } from '~/shared/types/gameInventory'
import type { FuncAction } from '~/shared/types'
import type { TabPaneName } from 'element-plus'
import { waitUtilConnected } from '~/api/game/socket/socket'

const loading = ref(false)
const allList = ref<ItemCountModifyInfo[]>([])
const displayedList = ref<ItemCountModifyInfo[]>([])
const pageSize = 20
const page = ref(1)
const activeTab = ref('Battle')

// 构建类型标签
const typeLabels: Record<ModifyItemCountType, string> = {
  Battle: '战斗掉落',
  Market: '市场交易',
  Equipment: '装备变动',
  UseItem: '物品使用',
  ActionUse: '行为消耗',
  ActionGain: '行为获得',
  Alchemy: '炼金',
  Kitty: '猫咪相关',
  KittySpecialAction: '猫咪随遇',
  Enhance: '强化相关',
  Guild: '公会',
  Auction: '拍卖',
  Village: '小镇',
  Other: '其他',
}

const canLoadMore = computed(() => displayedList.value.length < allList.value.length)

function loadMore() {
  const next = allList.value.slice(0, (page.value + 1) * pageSize)
  displayedList.value = next
  page.value++
}

let unbind: FuncAction = () => {}

function fetchListByTab(tab: TabPaneName) {
  loading.value = true
  emitGetInventoryModifyinfoByType(tab as any)

  // todo 如果因为网络问题，这里可能会有bug
  unbind = onGetInventoryModifyInfoByTypeSuccess((list) => {
    if (!list?.length) {
      allList.value = []
      displayedList.value = []
      loading.value = false
      return
    }
    // if (list[0].modifyType == tab)
    if (list?.[0]?.modifyType == tab) {
      allList.value = list.sort((a, b) => b.date - a.date)
      displayedList.value = allList.value.slice(0, pageSize)
      page.value = 1
      loading.value = false
    }
  })
}

function onTabChange(tab: TabPaneName) {
  unbind?.()
  fetchListByTab(tab)
}

onMounted(async () => {
  await waitUtilConnected()

  fetchListByTab(activeTab.value)
})

onUnmounted(() => {
  unbind?.()
})
</script>