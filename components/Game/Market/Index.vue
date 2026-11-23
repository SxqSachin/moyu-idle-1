<template>
  <div>
    <!-- PC端：左右布局，移动端：tab切换 -->
    <el-tabs v-if="isMobile" v-model="activeTab" class="mb-2">
      <el-tab-pane label="商品目录" name="catalog"></el-tab-pane>
      <el-tab-pane label="挂单详情" name="market"></el-tab-pane>
    </el-tabs>

    <div class="mb-4 flex flex-col md:flex-row gap-2">
      <el-button class="mx-0!" type="primary" @click="showListDialog = true; listButtonDisable = false;">上架商品</el-button>
      <el-button class="mx-0!" type="" :disabled="refreshButtonDisable" @click="fetchCatalogList">刷新</el-button>
    </div>

    <div v-if="!isMobile" class="flex gap-4">
      <!-- 商品目录 -->
      <div class="w-64 border-r pr-2">
        <GameMarketCatalog
          :catalog-list="catalogList"
          :selected-resource-id="selectedResourceId"
          :active-category="activeCategory"
          @select-resource="selectResource"
        />
      </div>
      <!-- 挂单详情 -->
      <div class="flex-1 pl-4">
        <GameMarketTable
          :filtered-market-list="filteredMarketList"
          :user-uuid="user?.uuid! || ''"
          @remove="confirmRemoveFromMarket"
          @buy="openBuyDialog"
        />
      </div>
    </div>
    <div v-else>
      <div v-show="activeTab === 'catalog'">
        <GameMarketCatalog
          :catalog-list="catalogList"
          :selected-resource-id="selectedResourceId"
          :active-category="activeCategory"
          @select-resource="selectResource"
          @show-list-dialog="showListDialog = true"
        />
      </div>
      <div v-show="activeTab === 'market'">
        <GameMarketTable
          :filtered-market-list="filteredMarketList"
          :user-uuid="user?.uuid! || ''"
          @refresh="fetchCatalogList"
          @remove="confirmRemoveFromMarket"
          @buy="openBuyDialog"
        />
      </div>
    </div>
    <!-- 上架弹窗 -->
    <el-dialog :draggable="true" v-model="showListDialog" title="上架" width="350" align-center>
      <div>
        <div class="mb-4">
          <label class="block mb-1 font-medium">选择要上架的物品: </label>
          <el-select v-model="listToMarketInfo.sellResourceId" placeholder="选择物品" class="w-full">
            <template v-for="(item, id) in allGameResource" :key="id">
              <el-option v-if="
                item && !BANNED_RESOURCE_IN_MARKET.includes(item.id) &&
                !item.isInternal &&
                (inventoryInfo?.[item.id]?.count ?? 0) > 0
              " :label="item.name" :value="id">
                <GameCommonSimpleResourceIconAndName :resource-id="item.id"> ({{inventoryInfo?.[item.id]?.count ?? 0}})
                </GameCommonSimpleResourceIconAndName>
              </el-option>
            </template>
          </el-select>
        </div>
        <el-divider class="my-2!"></el-divider>
        <div class="mb-4">
          <span>出售：</span>
          <GameCommonSimpleResourceIconAndName v-if="listToMarketInfo.sellResourceId" :resource-id="listToMarketInfo.sellResourceId" />
          <span v-else class="text-gray-400">未选择</span>
        </div>
        <div class="mb-4 flex items-center">
          <span class="whitespace-nowrap">数量：</span>
          <el-input-number size="small" controls-position="right" v-model="listToMarketInfo.sellResourceCount" :min="0"
            :max="maxSellCount">
            <template #suffix>
              <span> / {{ maxSellCount }}</span>
            </template>
          </el-input-number>
          <el-button class="ml-2" size="small" type="primary"
            @click="listToMarketInfo.sellResourceCount = +(maxSellCount * 0.5).toFixed(0)">50%</el-button>
          <el-button class="ml-2" size="small" type="primary"
            @click="listToMarketInfo.sellResourceCount = maxSellCount">100%</el-button>
        </div>
        <div class="mb-4 flex items-center">
          <span class="whitespace-nowrap">单价：</span>
          <el-input-number size="small" controls-position="right" v-model="listToMarketInfo.costPerUnit" :min="1">
          </el-input-number>
        </div>
        <div class="mb-4">
          <span>可得：</span>
          <div class="inline-flex flex-col gap-2">
            <GameCommonResourceIconAndName v-if="listToMarketInfo.costResourceId"
              :ignore-tag-color="true" :resource-id="listToMarketInfo.costResourceId"
              :count="(listToMarketInfo.sellResourceCount || 0) * (listToMarketInfo.costPerUnit || 0)"
              :show-inventory-count="true"
              :count-modify="(listToMarketInfo.sellResourceCount || 0) * (listToMarketInfo.costPerUnit || 0)" />
            <span v-else class="text-gray-400">-</span>
          </div>
        </div>
        <div>
          <span>库存：</span>
          <div class="inline-flex flex-col gap-2">
            <GameCommonResourceIconAndName v-if="listToMarketInfo.sellResourceId"
              :ignore-tag-color="true" :resource-id="listToMarketInfo.sellResourceId"
              :count="(inventoryInfo?.[listToMarketInfo.sellResourceId]?.count ?? 0) - (listToMarketInfo.sellResourceCount || 0)"
              :show-inventory-count="true" :count-modify="-(listToMarketInfo.sellResourceCount || 0)" />
            <span v-else class="text-gray-400">-</span>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" class="w-full"
            :disabled="listButtonDisable || (!listToMarketInfo.sellResourceCount || listToMarketInfo.sellResourceCount > maxSellCount)"
            @click="handleListToMarket">
            确认上架
          </el-button>
        </div>
        <div class="flex flex-col items-start mt-2 text-left">
          <div class="text-xs text-gray-400">上架须知:</div>
          <div class="text-xs text-gray-400">
            1. 上架时，将会从您的仓库中提取对应数量的资源。
            <br />
            2. 下架物品后返还未出售的资源。
          </div>
        </div>
      </template>
    </el-dialog>
    <!-- 购买弹窗 -->
    <el-dialog :draggable="true" v-model="showBuyDialog" title="购买" width="350" align-center>
      <div v-if="buyingItem">
        <div class="mb-4">
          <span>购买：</span>
          <GameCommonSimpleResourceIconAndName v-if="buyingItem.sellResourceId" :resource-id="buyingItem.sellResourceId" />
          <span v-else class="text-gray-400">-</span>
        </div>
        <div class="mb-4 flex items-center">
          <span class="whitespace-nowrap">数量：</span>
          <el-input-number size="small" controls-position="right" v-model="buyCount" :min="0" :max="maxBuyCount">
            <template #suffix>
              <span> / {{ maxBuyCount }}</span>
            </template>
          </el-input-number>
          <el-button class="ml-2" size="small" type="primary" @click="buyCount += 100">+100</el-button>
          <el-button class="ml-2" size="small" type="primary" @click="buyCount += 1000">+1000</el-button>
        </div>
        <div class="mb-4">
          <span>单价：</span>
          <div class="inline-flex flex-col gap-2 mr-2">
            <GameCommonResourceIconAndName v-if="buyingItem.costResourceId"
              :ignore-tag-color="true" :resource-id="buyingItem.costResourceId"
              :count="buyingItem.costPerUnit" />
            <span v-else class="text-gray-400">-</span>
          </div>
          <el-text type="warning" size="small" v-if="!maxBuyCount">你无法完成支付</el-text>
        </div>
        <div class="mb-4">
          <span>总价：</span>
          <div class="inline-flex flex-col gap-2">
            <GameCommonResourceIconAndName v-if="buyingItem.costResourceId"
              :ignore-tag-color="true" :resource-id="buyingItem.costResourceId"
              :count="(buyingItem.costPerUnit || 0) * (buyCount || 0)" :show-inventory-count="true"
              :count-modify="-(buyingItem.costPerUnit || 0) * (buyCount || 0)" />
            <span v-else class="text-gray-400">-</span>
          </div>
        </div>
        <div>
          <span>库存：</span>
          <div class="inline-flex flex-col gap-2">
            <GameCommonResourceIconAndName v-if="buyingItem.sellResourceId"
              :ignore-tag-color="true" :resource-id="buyingItem.sellResourceId"
              :count="(inventoryInfo?.[buyingItem.sellResourceId]?.count ?? 0) + (buyCount || 0)" :show-inventory-count="true"
              :count-modify="(buyCount || 0)" />
            <span v-else class="text-gray-400">-</span>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" class="w-full" :disabled="buyButtonDisable || !(!!buyingItem && buyCount > 0 && buyCount <= maxBuyCount)"
            @click="confirmBuy">
            确认购买
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="tsx">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { allGameResource } from "@/shared/data/allGameResources";
import { type ListToMarketInfo, type MarketTradeInfo, type BuyFromMarketInfo } from "@/shared/types/market";
import {
  emitGetTransactionList,
  emitListToMarket,
  emitBuyFromMarket,
  emitRemoveFromMarket,
  emitGetAllTradeableResourceList,
  onGetAllTradeableResourceList,
  onGetTransactionList,
} from "@/api/game/socket/market";
import { GameCommonResourceIconAndName, GameCommonSimpleResourceIconAndName } from "#components";
import { useInventory } from "~/composables/game/useInventory";
import { waitUtilConnected } from "~/api/game/socket/socket";
import { BANNED_RESOURCE_IN_MARKET } from "~/shared/data/constant";
import type { GameResourceCategory } from "~/shared/types/gameResource";

// 响应式判断是否为移动端
const isMobile = ref(false);
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768;
};
onMounted(() => {
  checkMobile();
  window.addEventListener("resize", checkMobile);
});
onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
});

const listToMarketInfo = ref<ListToMarketInfo>({
  sellResourceId: "",
  sellResourceCount: 1,
  costResourceId: "gold",
  costPerUnit: 1
});

// tab切换
const activeTab = ref<"catalog" | "market">("catalog");

// 目录相关
const searchKeyword = ref("");
const catalogList = ref<{ id: string, name: string, count: number, minPrice: number }[]>([]);
const selectedResourceId = ref<string | null>(null);

// 物品类型tab
const activeCategory = ref<'all' | GameResourceCategory>('all');

// 市场数据
const marketList = ref<MarketTradeInfo[]>([]);

// 控制弹窗
const showListDialog = ref(false);
const showBuyDialog = ref(false);

const listButtonDisable = ref(false);
const buyButtonDisable = ref(false)
const refreshButtonDisable = ref(false)

// 购买弹窗相关
const buyingItem = ref<MarketTradeInfo | null>(null);
const buyCount = ref(1);

const { user } = useUserSession();
const inventoryInfo = useInventory();

let offGetAllTradeableResourceList: (() => void) | null = null;
let offGetTransactionList: (() => void) | null = null;

// 获取市场商品目录
function fetchCatalogList() {
  if (refreshButtonDisable.value) return
  refreshButtonDisable.value = true
  emitGetAllTradeableResourceList();
  if (selectedResourceId.value) {
    emitGetTransactionList(selectedResourceId.value);
  }
  setTimeout(() => {
    refreshButtonDisable.value = false
  }, 800)
}

// 选中商品时加载挂单
function selectResource(id: string) {
  selectedResourceId.value = id;
  emitGetTransactionList(id);
  if (isMobile.value) activeTab.value = "market";
}

// 搜索过滤
const filteredCatalogList = computed(() => {
  let list = Array.isArray(catalogList.value) ? catalogList.value.filter(Boolean) : [];
  if (searchKeyword.value) {
    list = list.filter(item => item && item.name && item.name.includes(searchKeyword.value));
  }
  if (activeCategory.value !== "all") {
    list = list.filter(item => {
      if (!item) return false;
      const resource = allGameResource?.[item.id];
      return resource?.category?.includes(activeCategory.value);
    });
  }
  return list.sort((a, b) => (a?.name || '').localeCompare(b?.name || '', 'zh-Hans-CN'));
});

// 过滤后的市场列表
const filteredMarketList = computed(() => {
  let list = Array.isArray(marketList.value) ? marketList.value.filter(Boolean) : [];
  if (selectedResourceId.value) {
    list = list.filter(item => item && item.sellResourceId === selectedResourceId.value);
  }
  list = list.filter(Boolean);
  return list.slice().sort((a, b) => {
    const nameA = a && a.sellResourceId ? (allGameResource?.[a.sellResourceId]?.name || '') : '';
    const nameB = b && b.sellResourceId ? (allGameResource?.[b.sellResourceId]?.name || '') : '';
    if (nameA === nameB) {
      return (a?.costPerUnit ?? 0) - (b?.costPerUnit ?? 0);
    }
    return nameA.localeCompare(nameB, 'zh-Hans-CN');
  });
});

const maxSellCount = computed(() => {
  if (!listToMarketInfo.value) {
    return 0
  }
  return inventoryInfo.value[listToMarketInfo.value.sellResourceId]?.count ?? 0
})

const maxBuyCount = computed(() => {
  if (!buyingItem.value) {
    return 0
  }
  let max = Infinity
  const cost = buyingItem.value.costResourceId ?? 'gold'
  const inventoryCount = inventoryInfo.value[cost]?.count ?? 0
  max = Math.min(max, Math.floor(inventoryCount / buyingItem.value.costPerUnit))
  return Math.min(Math.max(0, max), buyingItem.value.sellResourceCount - buyingItem.value.selledResourceCount)
})

// 上架物品
function handleListToMarket() {
  if (listButtonDisable.value) return
  if (!listToMarketInfo.value?.sellResourceId) {
    ElMessage.warning("请选择物品");
    return;
  }
  if (!listToMarketInfo.value?.sellResourceCount || !listToMarketInfo.value.costPerUnit) {
    ElMessage.warning("请输入数量与金币价格");
    return;
  }
  emitListToMarket(listToMarketInfo.value);
  showListDialog.value = false;
  listButtonDisable.value = true;
  setTimeout(() => fetchCatalogList(), 500);
}

// 购买弹窗
function openBuyDialog(row: MarketTradeInfo) {
  buyingItem.value = row;
  buyCount.value = 1;
  showBuyDialog.value = true;
}

function confirmBuy() {
  if (buyButtonDisable.value) return
  if (!buyingItem.value) return;
  buyButtonDisable.value = true
  const info: BuyFromMarketInfo = {
    tradeUuid: buyingItem.value.tradeUuid,
    buyCount: buyCount.value,
    buyerUuid: "",
  };
  emitBuyFromMarket(info);
  showBuyDialog.value = false;
  buyingItem.value = null;
  setTimeout(() => fetchCatalogList(), 500);
  setTimeout(() => {
    fetchCatalogList();
    buyButtonDisable.value = false;
  }, 800);
}

function confirmRemoveFromMarket(tradeInfo: MarketTradeInfo) {
  ElMessageBox({
    title: '下架商品',
    showConfirmButton: true,
    showCancelButton: false,
    message: () => {
      return (
        <>
          <h1 class="mb-2">确定下架以下商品:</h1>
          <div class="flex flex-col space-y-2">
            <div>
              <el-text>商品：</el-text>
              <GameCommonResourceIconAndName
                resourceId={tradeInfo.sellResourceId}
                count={tradeInfo.sellResourceCount - tradeInfo.selledResourceCount}
              />
            </div>
            <div>
              <el-text>单价：</el-text>
              <GameCommonResourceIconAndName
                resourceId={tradeInfo.costResourceId}
                count={tradeInfo.costPerUnit}
              />
            </div>
            <div>
              <el-text>已卖出：{tradeInfo.selledResourceCount}</el-text>
            </div>
          </div>
        </>
      )
    }
  }).then(() => {
    emitRemoveFromMarket(tradeInfo.tradeUuid);
    setTimeout(() => fetchCatalogList(), 500);
  }).catch(() => { });
}

// 监听与解绑
onMounted(async () => {
  await waitUtilConnected();
  offGetAllTradeableResourceList = onGetAllTradeableResourceList((ids) => {
    catalogList.value = ids.map(id => {
      const name = allGameResource[id]?.name || id;
      return { id, name, count: 0, minPrice: 0 };
    });
    if (ids.length && !selectedResourceId.value) {
      selectResource(ids[0]);
    }
  });
  offGetTransactionList = onGetTransactionList((orders) => {
    marketList.value = (Array.isArray(orders) ? orders.filter(Boolean) : []) as MarketTradeInfo[];
    const id = selectedResourceId.value;
    if (id) {
      const minPrice = marketList.value.length ? Math.min(...marketList.value.map(o => o.costPerUnit)) : 0;
      const count = marketList.value.length;
      const item = catalogList.value.find(i => i.id === id);
      if (item) {
        item.minPrice = minPrice;
        item.count = count;
      }
    }
  });
  fetchCatalogList();
});
onUnmounted(() => {
  offGetAllTradeableResourceList && offGetAllTradeableResourceList();
  offGetTransactionList && offGetTransactionList();
});
</script>