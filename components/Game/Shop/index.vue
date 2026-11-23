<template>
    <p class="text-gray-600 dark:text-gray-400  mb-6 text-sm">
        喵呜~这里是小猫咪们日常采购基础资源的地方！你可以在这里方便地买入各种基础资源，满足自己的需求 (=･ω･=)
    </p>

    <div class="flex flex-wrap gap-4 mb-4 items-center">
        <div class="mr-auto text-lg font-semibold flex items-center gap-2">
            <span>我的金币：</span>
            <span class="text-yellow-500 text-xl">{{ formatNumber(gold) }}</span>
        </div>
    </div>
    <!-- 使用可复用的 ShopGrid 组件 -->
    <ShopGrid :resources="filteredResourceList">
        <template #card="{ resource: row }">
            <div class="flex flex-col gap-4 h-full! justify-between">
                <div class="flex flex-col gap-3">

                    <div class="flex justify-between items-center">
                        <GameCommonResourceIconAndName :resource-id="row.id"></GameCommonResourceIconAndName>

                        <div class="text-xs text-gray-500 dark:text-gray-400">库存: <span class="font-mono">{{
                            getResourceCount(row.id) }}</span></div>
                    </div>

                    <span class="text-xs text-gray-500 dark:text-gray-400">{{ row.description }}</span>
                </div>

                <div class="flex flex-col items-start gap-2">
                    <div class="flex flex-col items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <div v-if="row.userBuyCost">
                            <span class="text-xs text-gray-500 mr-1">单价：</span>
                            <template v-for="(cost, idx) in row.userBuyCost" :key="idx">
                                <GameCommonResourceIconAndName :inventory="inventoryInfo"
                                    :resource-id="cost.cost ?? 'gold'" :count="cost.count" size="xs" />
                            </template>
                        </div>
                        <div v-if="row.userSellCost">
                            <span class="text-xs text-gray-500 mr-1">回收价：</span>
                            <template v-for="(cost, idx) in row.userSellCost" :key="idx">
                                <GameCommonResourceIconAndName :inventory="inventoryInfo"
                                    :resource-id="cost.cost ?? 'gold'" :count="cost.count" size="xs" />
                            </template>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <el-button v-if="row.userBuyCost" size="small" :plain="!canBuyCount(row, 1)" type="primary"
                            :disabled="!canBuyCount(row, 1)" @click="buy(row)">购买</el-button>
                        <el-button v-if="row.userSellCost" size="small" :plain="!canSellCount(row, 1)" type="warning"
                            :disabled="!canSellCount(row, 1)" @click="sell(row)">出售</el-button>
                    </div>
                </div>
            </div>
        </template>


    </ShopGrid>

    <el-dialog :draggable="true" v-model="showBuyDialog" title="购买" width="350" align-center @closed="onBuyDialogClose">
        <div v-if="buyResourceInfo">
            <div class="mb-4">
                <span>购买：</span>
                <GameCommonSimpleResourceIconAndName :resource-id="buyResourceInfo.id">
                </GameCommonSimpleResourceIconAndName>
            </div>
            <div class="mb-4 flex flex-col items-start">
                <div>
                    <span class="whitespace-nowrap">数量：</span>
                    <el-input-number controls-position="right" class="w-64!" v-model="buyTradeInfo!.count" :min="1"
                        :max="maxBuyCount">
                        <template #suffix>
                            <span> / {{ formatCountToStr(maxBuyCount) }}</span>
                        </template>
                    </el-input-number>
                </div>

                <div class="mt-4">
                    <el-button class="ml-0!" size="small" type="primary"
                        @click="buyTradeInfo!.count += 100">+100</el-button>
                    <el-button class="ml-2" size="small" type="primary"
                        @click="buyTradeInfo!.count += 1000">+1000</el-button>
                    <el-button class="ml-2" size="small" type="primary"
                        @click="buyTradeInfo!.count += 10000">+10000</el-button>
                </div>
            </div>
            <el-divider class="my-2! mb-3!"></el-divider>
            <div>
                <span>总价：</span>
                <div class="inline-flex flex-col gap-2">
                    <span v-for="(cost, idx) in buyResourceInfo.userBuyCost" :key="idx" class="mr-2">
                        <GameCommonResourceIconAndName :inventory="inventoryInfo" :ignore-tag-color="true"
                            :resource-id="cost.cost ?? 'gold'" :count="cost.count * buyTradeInfo!.count"
                            :show-inventory-count="true" :count-modify="-(cost.count * buyTradeInfo!.count)" />
                    </span>
                </div>
            </div>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <el-button type="primary" class="w-full" :disabled="!canBuyCount(buyResourceInfo, buyTradeInfo?.count)"
                    @click="emitBuy()">
                    确认购买
                </el-button>
            </div>
        </template>
    </el-dialog>

    <el-dialog :draggable="true" v-model="showSellDialog" title="出售" width="350" align-center
        @closed="onSellDialogClose">
        <div v-if="sellResourceInfo">
            <div class="mb-4">
                <span>出售：</span> {{ getResourcerIconAndName(sellResourceInfo.id) }}
            </div>
            <div class="mb-4 flex items-center">
                <span class="whitespace-nowrap">数量：</span>
                <el-input-number size="small" controls-position="right" v-model="sellTradeInfo!.count" :min="1"
                    :max="maxSellCount">
                    <template #suffix>
                        <span> / {{ maxSellCount }}</span>
                    </template>
                </el-input-number>

                <el-button class="ml-2" size="small" type="primary"
                    @click="sellTradeInfo!.count = +(maxSellCount * 0.5).toFixed(0)">50%</el-button>
                <el-button class="ml-2" size="small" type="primary"
                    @click="sellTradeInfo!.count = maxSellCount">100%</el-button>
            </div>
            <div class="">
                <span>可得：</span>

                <div class="inline-flex flex-col gap-2">
                    <template v-for="(costInfo, resourceId) in calcSellInfo(sellResourceInfo, sellTradeInfo!.count)"
                        :key="resourceId">
                        <GameCommonResourceIconAndName :inventory="inventoryInfo"
                            v-if="!!costInfo?.count && !!resourceId" :ignore-tag-color="true" :resource-id="resourceId"
                            :count="costInfo?.count" :show-inventory-count="true" :count-modify="costInfo?.count">
                        </GameCommonResourceIconAndName>
                    </template>
                </div>
            </div>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <el-button type="primary" class="w-full"
                    :disabled="!canSellCount(sellResourceInfo, sellTradeInfo?.count)" @click="emitSell()">
                    确认出售
                </el-button>
            </div>
        </template>
    </el-dialog>
</template>

<script setup lang="tsx">
import { ref, computed } from 'vue'
import { allGameResource, allGameResourceCategoryInfo } from '~/shared/data/allGameResources'
import { type GameResourceTradeEvent, type AllGameResourceID, type GameResource, GameResourceCategory } from '~/shared/types/gameResource'
import { useInventory } from '~/composables/game/useInventory'
import { getResourcerIconAndName } from '~/shared/utils/game/info'
import { GameCommonResourceIconAndName } from '#components'
import ShopGrid from './ShopGrid.vue'
import { emitShopBuyResource, emitShopSellResource, } from '~/api/game/socket/trade'
import { calcSellCost } from '~/shared/utils/game/trade'
import { formatCountToStr, formatNumber } from '~/shared/utils'

const showSellDialog = ref(false)
const showBuyDialog = ref(false)

const buyTradeInfo = ref<GameResourceTradeEvent>()
const sellTradeInfo = ref<GameResourceTradeEvent>()

const sellResourceInfo = ref<GameResource>()
const buyResourceInfo = ref<GameResource>()

const activeCategory = ref<'all' | GameResourceCategory>('all') // 默认选中“食物”分类

const inventoryInfo = useInventory()

const resourceList = computed(() => {
    const allResource = Object.values(allGameResource)

    return allResource.filter(resource => {
        if (resource.shopType) {
            return;
        }

        return !!resource.userBuyCost && (!resource.userBuyCost[0].cost || resource.userBuyCost[0].cost == 'gold')
    })
})

const filteredResourceList = computed(() => {
    if (activeCategory.value == 'all') {
        return resourceList.value
    }
    return resourceList.value.filter(resource => {
        return resource.category?.includes(activeCategory.value)
    })
})

const maxSellCount = computed(() => {
    if (!sellResourceInfo.value) {
        return 0
    }

    return inventoryInfo.value[sellResourceInfo.value.id]?.count ?? 0
})

const maxBuyCount = computed(() => {
    if (!buyResourceInfo.value?.userBuyCost?.length) {
        return 0
    }

    let max = Infinity
    for (const costInfo of buyResourceInfo.value.userBuyCost) {
        const cost = costInfo.cost ?? 'gold'
        const inventoryCount = unref(inventoryInfo)[cost]?.count ?? 0
        max = Math.min(max, Math.floor(inventoryCount / costInfo.count))
    }
    return Math.max(1, max)
})

// 获取资源库存
function getResourceCount(id: AllGameResourceID) {
    return unref(inventoryInfo)[id]?.count ?? 0
}

// 获取金币数量
const gold = computed(() => {
    return unref(inventoryInfo).gold?.count ?? 0
})

const calcSellInfo = (resourceInfo: GameResource, tradeCount: number) => {
    return calcSellCost(resourceInfo, tradeCount)
}

function canBuyCount(resource: GameResource | undefined, count?: number) {
    if (!resource?.userBuyCost || !count) return false
    for (const costInfo of resource.userBuyCost) {
        const cost = costInfo.cost ?? 'gold'
        const inventoryCount = unref(inventoryInfo)[cost]?.count ?? 0
        if (inventoryCount < costInfo.count * count) {
            return false
        }
    }
    return true
}

function canSellCount(resource: GameResource | undefined, count?: number) {
    if (!resource?.userSellCost || !count) return false
    const inventoryCount = resource ? getResourceCount(resource.id) : 0
    return inventoryCount >= count
}

function buy(resource: GameResource) {
    showBuyDialog.value = true
    buyResourceInfo.value = resource
    buyTradeInfo.value = {
        id: resource.id,
        count: 1
    }
}
function sell(resource: GameResource) {
    showSellDialog.value = true
    sellResourceInfo.value = resource
    sellTradeInfo.value = {
        id: resource.id,
        count: 1
    }
}


function emitBuy() {
    showBuyDialog.value = false
    if (!buyResourceInfo.value || !buyTradeInfo.value) {
        return
    }
    emitShopBuyResource(buyTradeInfo.value)
}
function onBuyDialogClose() {
    buyResourceInfo.value = undefined
    buyTradeInfo.value = undefined
}

function emitSell() {
    showSellDialog.value = false
    if (!sellResourceInfo.value || !sellTradeInfo.value) {
        return
    }
    emitShopSellResource(sellTradeInfo.value)
}
function onSellDialogClose() {
    sellResourceInfo.value = undefined
    sellTradeInfo.value = undefined
}

</script>

<style scoped>
/* Grid card styles for shop */
.shop-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
    align-items: start;
}

.shop-card {
    background: var(--el-card-bg-color, #fff);
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 6px 18px rgba(16, 24, 40, 0.06);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 120px;
}

.card-head {
    display: flex;
    align-items: center;
    gap: 8px;
}

.card-body {
    margin-top: 8px;
}

.card-title {
    font-weight: 600;
}

.card-sub {
    color: #6b7280;
    font-size: 12px;
}

.card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
}

.price {
    display: flex;
    align-items: center;
    gap: 6px;
}

.actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

@media (max-width: 640px) {
    .shop-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 420px) {
    .shop-grid {
        grid-template-columns: repeat(1, 1fr);
    }
}
</style>