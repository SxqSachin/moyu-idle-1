<template>
  <div class="flex flex-col">
    <!-- 捐赠按钮 -->

    <!-- 搜索和筛选 -->
    <div class="flex flex-row items-center gap-2 md:gap-4 justify-between mb-4">
      <div class="flex flex-col md:w-64">
        <el-input placeholder="输入物品名称" class="mr-2 w-full md:w-20" v-model="searchQuery"></el-input>
      </div>

      <div class="flex">
        <el-button type="primary" @click="openDonateDialog">
          <Icon name="streamline:give-gift" class="mr-2 text-lg"></Icon>
          捐赠物品
        </el-button>
        <el-button class="ml-2" @click="openWithdrawModal">
          <Icon name="mdi:tray-arrow-up" class="mr-2 text-lg"></Icon>
          提取物品
        </el-button>
      </div>
    </div>

    <!-- 库存展示 -->
    <div class="flex flex-wrap gap-x-6 gap-8 pb-8 px-0 md:px-2">
      <template v-if="filteredInventoryItems.length">
        <template v-for="group in categoryGroupedResources" :key="group.category">
          <div class="flex flex-col gap-2 w-full">
            <div class="w-full font-bold text-lg">
              {{ getCategoryName(group.category) }}
            </div>
            <div class="flex flex-wrap gap-x-6 gap-8">
              <template v-for="(item, id) in group.resources" :key="item.itemId">
                <GameGuildInventoryItem :resource-id="id" :count="item?.count ?? 0" />
              </template>
            </div>
          </div>
        </template>
      </template>
      <template v-else>
        <div class="w-full text-center py-8 text-gray-400">
          <div class="text-4xl mb-2">📦</div>
          <div>公会仓库暂无物品</div>
        </div>
      </template>
    </div>

    <!-- 提取申请弹窗 -->
    <el-dialog v-model="withdrawDialog.visible" title="申请提取物品" width="400px" @close="resetWithdrawDialog">
      <div v-if="withdrawDialog.item" class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <GameCommonResourceIconAndName :resource-id="withdrawDialog.item.itemId" />
          <div class="text-gray-500">库存：{{ withdrawDialog.item.count }}</div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">提取数量</label>
          <el-input-number v-model="withdrawDialog.amount" :min="1" :max="Number(withdrawDialog.item.count)" :step="1"
            class="w-full" :placeholder="`最多可提取${withdrawDialog.item.count}`" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">申请理由（可选）</label>
          <el-input v-model="withdrawDialog.reason" type="textarea" :rows="3" placeholder="请简要说明提取理由..." />
        </div>
      </div>
      <template #footer>
        <div class="w-full pt-4 mt-4 flex gap-2">
          <el-button class="w-full" @click="withdrawDialog.visible = false">取消</el-button>
          <el-button class="w-full" type="primary" @click="onSubmitWithdraw" :loading="withdrawDialog.loading">
            提交申请
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 捐赠弹窗 -->
    <el-dialog v-model="donateDialog.visible" title="捐赠物品" width="600px" @close="resetDonateDialog">
      <div class="flex flex-col gap-4">
        <!-- 搜索和筛选 -->
        <div class="flex flex-col md:flex-row items-center gap-2">
          <el-input placeholder="搜索物品名称" v-model="donateDialog.searchQuery" class="flex-1">
            <template #prefix>
              <Icon name="material-symbols:search" />
            </template>
          </el-input>
          <el-select v-model="donateDialog.category" placeholder="选择分类" style="width: 150px">
            <el-option label="全部分类" value="all" />
            <template v-for="(catInfo, catKey) in allGameResourceCategoryInfo" :key="catKey">
              <el-option v-if="catKey != GameResourceCategory.Custom" :label="catInfo.name" :value="catKey" />
            </template>
          </el-select>
        </div>


        <!-- 待捐赠物品列表 -->
        <div v-if="Object.keys(donateDialog.items).length" class="p-3 bg-blue-50 dark:bg-gray-700 rounded-lg">
          <div class="font-medium mb-2">准备捐赠的物品</div>
          <div class="flex flex-wrap gap-2 mb-3">
            <template v-for="(countInfo, itemId) in donateDialog.items" :key="itemId">
              <div v-if="countInfo"
                class="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1 rounded-full text-sm">
                <GameCommonSimpleResourceIconAndName :resource-id="itemId">:{{formatNumber(countInfo.count)}} </GameCommonSimpleResourceIconAndName>
                <Icon name="material-symbols:close" class="cursor-pointer text-red-400 hover:text-red-500"
                  @click="removeDonateItem(itemId)" />
              </div>
            </template>
          </div>
          <div class="flex gap-2">
            <el-button size="small" @click="clearDonateItems">清空</el-button>
          </div>
        </div>

        <!-- 我的库存 -->
        <div class="max-h-96 overflow-y-auto">
          <div class="text-sm text-gray-500 mb-2">我的库存</div>
          <template v-if="filteredMyInventory.length">
            <div class="grid grid-cols-2 gap-2">
              <template v-for="resource in filteredMyInventory" :key="resource.id">
                <div class="flex flex-col items-start gap-2 justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div class="flex items-center gap-3">
                    <GameCommonResourceIconAndName :resource-id="resource.id"
                      :count="myInventory[resource.id]?.count || 0" />
                    <span class="text-sm text-gray-500 dark:text-gray-400">
                      已选：{{ donateDialog.items[resource.id]?.count || 0 }}
                    </span>
                  </div>
                  <div class="flex items-center w-full">
                    <el-input-number v-model="donateAmounts[resource.id]" :min="0"
                      :max="myInventory[resource.id]?.count || 0" :step="1" step-strictly class="flex-1 w-full"
                      @change="amount => onDonateAmountChange(resource.id, amount)" />
                  </div>
                </div>
              </template>
            </div>
          </template>
          <template v-else>
            <div class="text-center py-8 text-gray-400">
              <div class="text-2xl mb-2">📦</div>
              <div class="text-sm">暂无可捐赠的物品</div>
            </div>
          </template>
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">备注</label>
          <el-input 
            v-model="donateDialog.reason" 
            placeholder="可选填"
            maxlength="48"
            show-word-limit
          />
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <el-button @click="donateDialog.visible = false">取消</el-button>
          <el-button type="primary" @click="onConfirmDonate" :loading="donateDialog.loading"
            :disabled="!Object.keys(donateDialog.items).length">
            确认捐赠
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 个人提取弹窗（独立组件） -->
    <GameGuildInventoryWithdrawModal
      v-model:visible="withdrawModalVisible"
      :guild-uuid="props.guildUuid"
      :inventory="guildInventory"
      @refetch="fetchGuildInventory"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { allGameResource, allGameResourceCategoryInfo } from '~/shared/data/allGameResources'
import { GameResourceCategory, type GameResource } from '~/shared/types/gameResource'
import { formatNumber, ObjectKeys } from '~/shared/utils'
import { useInventory } from '~/composables/game/useInventory'
import { waitUtilConnected } from '~/api/game/socket/socket'
import type { GuildInventoryItem, GuildMemberInfo } from '~/shared/types/guild'
import type { FuncAction } from '~/shared/types'
import type { ItemCountInfo } from '~/shared/types/gameInventory'

import {
  emitGetGuildInventory,
  onGetGuildInventorySuccess,
  onGetGuildInventoryFail,
  emitRequestWithdrawFromGuildInventory,
  onRequestWithdrawFromGuildInventorySuccess,
  onRequestWithdrawFromGuildInventoryFail,
  emitDonateToGuildInventory,
  onDonateToGuildInventorySuccess,
  onDonateToGuildInventoryFail,
  validateWithdrawAmount,
  validateDonations
} from '~/api/game/socket/guildInventory'
import { GUILD_INVENTORY_DONATE_ITEM_WHITE_LIST } from '~/shared/data/constant'
import GameGuildInventoryWithdrawModal from './WithdrawModal.vue'

const props = defineProps<{
  guildUuid: string
  myMemberInfo: GuildMemberInfo
}>()

const myInventory = useInventory()

// 响应式数据
const searchQuery = ref('')
const guildInventory = ref<GuildInventoryItem[]>([])

// 捐赠相关数据
const donateAmounts = ref<Record<string, number>>({})

// 提取申请弹窗
const withdrawDialog = reactive({
  visible: false,
  item: null as GuildInventoryItem | null,
  amount: 1,
  reason: '',
  loading: false
})
// 个人直接提取弹窗
const withdrawModalVisible = ref(false)

// 捐赠弹窗
const donateDialog = reactive({
  visible: false,
  searchQuery: '',
  reason: '',
  category: 'all' as 'all' | GameResourceCategory,
  items: {} as ItemCountInfo,
  loading: false
})

// 计算属性
const getCategoryName = (category: GameResourceCategory | 'all') => {
  if (category === 'all') return '全部物品'
  return allGameResourceCategoryInfo[category]?.name || category
}

const filteredInventoryItems = computed(() => {
  let items = guildInventory.value

  if (searchQuery.value) {
    items = items.filter(item => {
      const resource = allGameResource[item.itemId]
      return resource?.name.includes(searchQuery.value)
    })
  }

  return items
})

const categoryGroupedResources = computed(() => {
    const groups: {[key in (GameResourceCategory | 'all')]?: ItemCountInfo} = {}
    for (const resourceId of filteredInventoryItems.value) {
        let resource = allGameResource[resourceId.itemId]
        if (Array.isArray(resource.category)) {
            for (const cat of resource.category) {
                if (!groups[cat]) groups[cat] = {}
                if (!groups[cat][resourceId.itemId]) {
                    groups[cat][resourceId.itemId] = { count: 0 }
                }
                groups[cat][resourceId.itemId]!.count += resourceId.count
            }
        }
    }
    // 返回有序数组
    let res = ObjectKeys<(GameResourceCategory | 'all')>(allGameResourceCategoryInfo)
        .filter(cat => groups[cat] && Object.keys(groups[cat]).length)
        .map(cat => ({
            category: cat,
            resources: groups[cat]
        }))

    return res;
})

// 可捐赠的物品列表
const filteredMyInventory = computed(() => {
  let resources = Object.values(allGameResource).filter(resource => 
    (myInventory.value[resource.id]?.count ?? 0) > 0
  ).filter(resource => {
    return !resource.hideInMarket || GUILD_INVENTORY_DONATE_ITEM_WHITE_LIST.includes(resource.id)
  })

  if (donateDialog.category !== 'all') {
    resources = resources.filter(resource =>
      resource.category?.includes(donateDialog.category as GameResourceCategory)
    )
  }

  if (donateDialog.searchQuery) {
    resources = resources.filter(resource =>
      resource.name.includes(donateDialog.searchQuery)
    )
  }

  return resources
})

// 事件处理
let offFunctions: FuncAction[] = []

onMounted(async () => {
  await waitUtilConnected()
  
  // 注册事件监听
  offFunctions.push(
    onGetGuildInventorySuccess((data) => {
      guildInventory.value = data.inventory
    }),
    onGetGuildInventoryFail((data) => {
      ElNotification.error({ title: '获取失败', message: data.message })
    }),
    onRequestWithdrawFromGuildInventorySuccess(() => {
      ElNotification.success({ title: '申请提交成功' })
      withdrawDialog.visible = false
      withdrawDialog.loading = false
      resetWithdrawDialog()
      // 刷新数据
      fetchGuildInventory()
    }),
    onRequestWithdrawFromGuildInventoryFail((data) => {
      ElNotification.error({ title: '申请提交失败', message: data.message })
      withdrawDialog.loading = false
    }),
    onDonateToGuildInventorySuccess(() => {
      ElNotification.success({ title: '捐赠成功！' })
      donateDialog.visible = false
      donateDialog.loading = false
      resetDonateDialog()
      // 刷新数据
      fetchGuildInventory()
    }),
    onDonateToGuildInventoryFail((data) => {
      ElNotification.error({ title: '捐赠失败', message: data.message })
      donateDialog.loading = false
    })
  )

  // 初始加载数据
  fetchGuildInventory()
})

onUnmounted(() => {
  offFunctions.forEach(off => off?.())
})

// 方法
function fetchGuildInventory() {
  emitGetGuildInventory(props.guildUuid)
}

// 提取相关方法
function onRequestWithdraw(item: GuildInventoryItem) {
  withdrawDialog.visible = true
  withdrawDialog.item = item
  withdrawDialog.amount = 1
  withdrawDialog.reason = ''
}

function openWithdrawModal() {
  withdrawModalVisible.value = true
}

function resetWithdrawDialog() {
  withdrawDialog.visible = false
  withdrawDialog.item = null
  withdrawDialog.amount = 1
  withdrawDialog.reason = ''
  withdrawDialog.loading = false
}

function onSubmitWithdraw() {
  if (!withdrawDialog.item) return

  const validation = validateWithdrawAmount(withdrawDialog.amount)
  if (!validation.isValid) {
    ElNotification.error({ title: '提交失败', message: validation.message })
    return
  }

  withdrawDialog.loading = true
  emitRequestWithdrawFromGuildInventory(
    props.guildUuid,
    withdrawDialog.item.itemId,
    withdrawDialog.amount,
    withdrawDialog.reason || undefined
  )
}

// 捐赠相关方法
function openDonateDialog() {
  donateDialog.visible = true
  donateDialog.searchQuery = ''
  donateDialog.category = 'all'
  donateDialog.items = {}
  donateAmounts.value = {}
}

function resetDonateDialog() {
  donateDialog.visible = false
  donateDialog.searchQuery = ''
  donateDialog.category = 'all'
  donateDialog.items = {}
  donateDialog.loading = false
  donateAmounts.value = {}
}

function onDonateAmountChange(itemId: string, amount?: number | null) {
  if (!amount || amount <= 0) {
    delete donateDialog.items[itemId]
    donateAmounts.value[itemId] = 0
  } else {
    donateDialog.items[itemId] = { count: amount }
    donateAmounts.value[itemId] = amount
  }
}

function removeDonateItem(itemId: string) {
  delete donateDialog.items[itemId]
  donateAmounts.value[itemId] = 0
}

function clearDonateItems() {
  donateDialog.items = {}
  donateAmounts.value = {}
}

function onConfirmDonate() {
  const validation = validateDonations(donateDialog.items)
  if (!validation.isValid) {
    ElNotification.error({ title: '提交失败', message: validation.message })
    return
  }

  donateDialog.loading = true
  emitDonateToGuildInventory(props.guildUuid, donateDialog.items, donateDialog.reason)
}
</script>

<style lang="scss" scoped>
:deep(.el-input-number) {
  .el-input__inner {
    text-align: center;
  }
}

:deep(.el-dialog__body) {
  padding-top: 10px;
}
</style>