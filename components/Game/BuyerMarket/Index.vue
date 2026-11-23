<template>
    <div>
        <el-tabs v-if="isMobile" v-model="activeTab" class="mb-2">
            <el-tab-pane label="求购目录" name="catalog"></el-tab-pane>
            <el-tab-pane label="求购详情" name="market"></el-tab-pane>
        </el-tabs>
        <div class="mb-4 flex flex-col md:flex-row gap-2">
            <el-button type="primary" @click="showListDialog = true" :disabled="listButtonDisable">发起求购</el-button>
            <el-button class="ml-0!" :disabled="refreshButtonDisable" @click="fetchCatalogList">刷新</el-button>
        </div>
        <div v-if="!isMobile" class="flex gap-4">
            <div class="border-r pr-2 w-2/5">
                <GameBuyerMarketCatalog :catalog-list="catalogList" :selected-resource-id="selectedResourceId"
                    :active-category="activeCategory" @select-resource="selectResource" />
            </div>
            <div class="flex-1 pl-4 w-3/5">
                <GameBuyerMarketTable :filtered-market-list="filteredMarketList" :user-uuid="user?.uuid! || ''"
                    @remove="confirmRemoveFromBuyerMarket" @sell="openSellDialog" />
            </div>
        </div>
        <div v-else>
            <div v-show="activeTab === 'catalog'">
                <GameBuyerMarketCatalog :catalog-list="catalogList" :selected-resource-id="selectedResourceId"
                    :active-category="activeCategory" @select-resource="selectResource" />
            </div>
            <div v-show="activeTab === 'market'">
                <GameBuyerMarketTable :filtered-market-list="filteredMarketList" :user-uuid="user?.uuid! || ''"
                    @remove="confirmRemoveFromBuyerMarket" @sell="openSellDialog" />
            </div>
        </div>
        <!-- 发起求购弹窗 -->
        <el-dialog :draggable="true" v-model="showListDialog" title="发起求购" width="350" align-center>
            <div>
                <div class="mb-4">
                    <label class="block mb-1 font-medium">求购资源: </label>
                    <el-select filterable v-model="listToBuyerMarketInfo.requireResourceId" placeholder="选择资源"
                        class="w-full">
                        <template v-for="(item, id) in allGameResource" :key="id">
                            <el-option v-if="item && !item.isInternal && id !== 'gold'" :label="item.name" :value="id">
                                <GameCommonSimpleResourceIconAndName :resource-id="item.id" />
                            </el-option>
                        </template>
                    </el-select>
                </div>
                <div class="mb-4 flex items-center">
                    <span class="whitespace-nowrap">数量：</span>
                    <el-input-number size="small" controls-position="right"
                        v-model="listToBuyerMarketInfo.requireResourceCount" :min="1" />
                </div>
                <div class="mb-4">
                    <label class="block mb-1 font-medium">支付资源: </label>
                    <el-select filterable v-model="listToBuyerMarketInfo.payResourceId" placeholder="选择支付资源"
                        class="w-full">
                        <template v-for="(item, id) in allGameResource" :key="id">
                            <el-option v-if="item && !item.isInternal" :label="item.name" :value="id">
                                <GameCommonSimpleResourceIconAndName :resource-id="item.id" />
                            </el-option>
                        </template>
                    </el-select>
                </div>
                <div class="mb-4 flex items-center">
                    <span class="whitespace-nowrap">单价：</span>
                    <el-input-number size="small" controls-position="right" v-model="listToBuyerMarketInfo.payPerUnit"
                        :min="1" />
                </div>
                <div class="mb-4">
                    <span>总支付：</span>
                    <GameCommonResourceIconAndName v-if="listToBuyerMarketInfo.payResourceId"
                        :resource-id="listToBuyerMarketInfo.payResourceId"
                        :count="(listToBuyerMarketInfo.requireResourceCount || 0) * (listToBuyerMarketInfo.payPerUnit || 0)" />
                </div>
            </div>
            <template #footer>
                <el-button type="primary" class="w-full" :disabled="listButtonDisable || !canList"
                    @click="handleListToBuyerMarket">
                    确认求购
                </el-button>
            </template>
        </el-dialog>
        <!-- 卖出弹窗 -->
        <el-dialog :draggable="true" v-model="showSellDialog" title="卖出资源" width="350" align-center>
            <div v-if="sellingItem">
                <div class="mb-4">
                    <span>卖出：</span>
                    <GameCommonSimpleResourceIconAndName v-if="sellingItem.requireResourceId"
                        :resource-id="sellingItem.requireResourceId" />
                </div>
                <div class="mb-4 flex items-center">
                    <span class="whitespace-nowrap">数量：</span>
                    <el-input-number size="small" controls-position="right" v-model="sellCount" :min="0"
                        :max="maxSellCount" />
                    <span class="ml-2 text-gray-400">/ {{ maxSellCount }}</span>
                </div>
                <div class="mb-4">
                    <span>单价：</span>
                    <GameCommonResourceIconAndName v-if="sellingItem.payResourceId"
                        :resource-id="sellingItem.payResourceId" :count="sellingItem.payPerUnit" />
                </div>
                <div class="mb-4">
                    <span>可得：</span>
                    <GameCommonResourceIconAndName v-if="sellingItem.payResourceId"
                        :resource-id="sellingItem.payResourceId"
                        :count="(sellCount || 0) * (sellingItem.payPerUnit || 0)" />
                </div>
            </div>
            <template #footer>
                <el-button type="primary" class="w-full"
                    :disabled="sellButtonDisable || !(sellCount > 0 && sellCount <= maxSellCount)" @click="confirmSell">
                    确认卖出
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="tsx">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { allGameResource } from "@/shared/data/allGameResources";
import { useInventory } from "~/composables/game/useInventory";
import { waitUtilConnected } from "@/api/game/socket/socket";
import {
  emitGetAllBuyerMarketTradeableResourceList,
  emitGetBuyerMarketTransactionList,
  emitListToBuyerMarket,
  emitRemoveFromBuyerMarket,
  emitSellToBuyerMarket,
  onGetAllBuyerMarketTradeableResourceList,
  onGetBuyerMarketTransactionList,
} from "@/api/game/socket/buyerMarket";
import type { ListToBuyerMarketInfo, BuyerMarketTradeInfo, SellToBuyerMarketInfo } from "~/shared/types/buyerMarket";
import { GameCommonResourceIconAndName, GameCommonSimpleResourceIconAndName } from "#components";
import type { GameResourceCategory } from "@/shared/types/gameResource";

const isMobile = ref(false);
const checkMobile = () => { isMobile.value = window.innerWidth < 768; };
onMounted(() => { checkMobile(); window.addEventListener("resize", checkMobile); });
onUnmounted(() => { window.removeEventListener("resize", checkMobile); });

const listToBuyerMarketInfo = ref<ListToBuyerMarketInfo>({
  requireResourceId: "",
  requireResourceCount: 1,
  payResourceId: "gold",
  payPerUnit: 1
});
const activeTab = ref<"catalog" | "market">("catalog");
const searchKeyword = ref("");
const catalogList = ref<{ id: string, name: string, count: number, minPrice: number }[]>([]);
const selectedResourceId = ref<string | null>(null);
const activeCategory = ref<'all' | 'mine' | GameResourceCategory>('all');
const buyerMarketList = ref<BuyerMarketTradeInfo[]>([]);
const showListDialog = ref(false);
const showSellDialog = ref(false);
const listButtonDisable = ref(false);
const sellButtonDisable = ref(false);
const refreshButtonDisable = ref(false);

const sellingItem = ref<BuyerMarketTradeInfo | null>(null);
const sellCount = ref(1);

const { user } = useUserSession();
const inventoryInfo = useInventory();

let offGetAllBuyerMarketTradeableResourceList: (() => void) | null = null;
let offGetBuyerMarketTransactionList: (() => void) | null = null;

function fetchCatalogList() {
  if (refreshButtonDisable.value) return;
  refreshButtonDisable.value = true;
  emitGetAllBuyerMarketTradeableResourceList();
  if (selectedResourceId.value) {
    emitGetBuyerMarketTransactionList(selectedResourceId.value);
  }
  setTimeout(() => { refreshButtonDisable.value = false; }, 800);
}

function selectResource(id: string) {
  selectedResourceId.value = id;
  emitGetBuyerMarketTransactionList(id);
  if (isMobile.value) activeTab.value = "market";
}

const filteredMarketList = computed(() => {
  let list = Array.isArray(buyerMarketList.value) ? buyerMarketList.value.filter(Boolean) : [];
  if (activeCategory.value === "mine") {
    list = list.filter(item => item && item.buyer === (user.value as any)?.uuid);
  }
  if (selectedResourceId.value) {
    list = list.filter(item => item && item.requireResourceId === selectedResourceId.value);
  }
  return list.slice().sort((a, b) => {
    const nameA = a && a.requireResourceId ? (allGameResource?.[a.requireResourceId]?.name || '') : '';
    const nameB = b && b.requireResourceId ? (allGameResource?.[b.requireResourceId]?.name || '') : '';
    if (nameA === nameB) {
      return -(a?.payPerUnit ?? 0) + (b?.payPerUnit ?? 0);
    }
    return nameA.localeCompare(nameB, 'zh-Hans-CN');
  });
});

const maxSellCount = computed(() => {
  if (!sellingItem.value) return 0;
  const remain = (sellingItem.value.requireResourceCount ?? 0) - (sellingItem.value.doneResourceCount ?? 0);
  const inventory = inventoryInfo.value[sellingItem.value.requireResourceId]?.count ?? 0;
  return Math.min(remain, inventory);
});

const canList = computed(() => {
  const info = listToBuyerMarketInfo.value;
  return !!info.requireResourceId && !!info.payResourceId && info.requireResourceCount > 0 && info.payPerUnit > 0;
});

function handleListToBuyerMarket() {
  if (listButtonDisable.value) return;
  if (!canList.value) {
    ElMessage.warning("请填写完整信息");
    return;
  }
  emitListToBuyerMarket(listToBuyerMarketInfo.value);
  showListDialog.value = false;
  listButtonDisable.value = true;
  setTimeout(() => fetchCatalogList(), 500);
  setTimeout(() => { listButtonDisable.value = false; }, 800);
}

function openSellDialog(row: BuyerMarketTradeInfo) {
  sellingItem.value = row;
  sellCount.value = 1;
  showSellDialog.value = true;
}

function confirmSell() {
  if (sellButtonDisable.value) return;
  if (!sellingItem.value) return;
  sellButtonDisable.value = true;
  const info: SellToBuyerMarketInfo = {
    tradeUuid: sellingItem.value.tradeUuid,
    sellCount: sellCount.value,
    sellerUuid: "",
  };
  emitSellToBuyerMarket(info);
  showSellDialog.value = false;
  sellingItem.value = null;
  setTimeout(() => fetchCatalogList(), 500);
  setTimeout(() => { sellButtonDisable.value = false; }, 800);
}

function confirmRemoveFromBuyerMarket(tradeInfo: BuyerMarketTradeInfo) {
  ElMessageBox({
    title: '撤销求购',
    showConfirmButton: true,
    showCancelButton: false,
    message: () => (
      <>
        <h1 class="mb-2">确定撤销以下求购单:</h1>
        <div class="flex flex-col space-y-2">
          <div>
            <el-text>资源：</el-text>
            <GameCommonResourceIconAndName resourceId={tradeInfo.requireResourceId} count={tradeInfo.requireResourceCount - tradeInfo.doneResourceCount} />
          </div>
          <div>
            <el-text>单价：</el-text>
            <GameCommonResourceIconAndName resourceId={tradeInfo.payResourceId} count={tradeInfo.payPerUnit} />
          </div>
          <div>
            <el-text>已完成：{tradeInfo.doneResourceCount}</el-text>
          </div>
        </div>
      </>
    )
  }).then(() => {
    emitRemoveFromBuyerMarket(tradeInfo.tradeUuid);
    setTimeout(() => fetchCatalogList(), 500);
  }).catch(() => { });
}

onMounted(async () => {
  await waitUtilConnected();
  offGetAllBuyerMarketTradeableResourceList = onGetAllBuyerMarketTradeableResourceList((ids) => {
    catalogList.value = ids.map(id => {
      const name = allGameResource[id]?.name || id;
      return { id, name, count: 0, minPrice: 0 };
    });
    if (ids.length && !selectedResourceId.value) {
      selectResource(ids[0]);
    }
  });
  offGetBuyerMarketTransactionList = onGetBuyerMarketTransactionList((orders) => {
    buyerMarketList.value = (Array.isArray(orders) ? orders.filter(Boolean) : []) as BuyerMarketTradeInfo[];
    const id = selectedResourceId.value;
    if (id) {
      const minPrice = buyerMarketList.value.length ? Math.min(...buyerMarketList.value.map(o => o.payPerUnit)) : 0;
      const count = buyerMarketList.value.length;
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
  offGetAllBuyerMarketTradeableResourceList && offGetAllBuyerMarketTradeableResourceList();
  offGetBuyerMarketTransactionList && offGetBuyerMarketTransactionList();
});
</script>