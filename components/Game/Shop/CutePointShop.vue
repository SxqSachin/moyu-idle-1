<template>
    <p class="text-gray-600 dark:text-gray-400  mb-6 text-sm">
        喵呜~在这里可以用猫咪助手给你的
        <GameCommonSimpleResourceIconAndName resource-id="cutePoint"></GameCommonSimpleResourceIconAndName>
        兑换各种特有的道具！看看有什么喜欢的吧 (=｀ω´=)
    </p>

    <div class="flex flex-wrap gap-4 mb-4 items-center">
        <div class="mr-auto text-lg font-semibold flex items-center gap-2">
            <span>我的心意点数：</span>
            <span class="text-red-500 text-xl">{{ cutePoint }}</span>
        </div>
    </div>

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
                    <el-input-number class="w-64!" v-model="buyTradeInfo!.count" :min="1" :max="maxBuyCount">
                        <template #suffix>
                            <span> / 可购买 {{ formatCountToStr(maxBuyCount) }}</span>
                        </template>
                    </el-input-number>
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
                <el-button type="primary" class="w-full" :disabled="!canBuyCount(buyResourceInfo, buyTradeInfo?.count) || btnLoading"
                    @click="e => emitBuy(e)">
                    确认购买
                </el-button>
            </div>
        </template>
    </el-dialog>

    <el-dialog :draggable="true" v-model="showSellDialog" title="出售" width="350" align-center
        @closed="onSellDialogClose">
        <div v-if="sellResourceInfo">
            <div class="mb-4">
                <span>出售：</span>
                <GameCommonSimpleResourceIconAndName :resource-id="sellResourceInfo.id">
                </GameCommonSimpleResourceIconAndName>
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
                    :disabled="!canSellCount(sellResourceInfo, sellTradeInfo?.count) || btnLoading" @click="emitSell">
                    确认出售
                </el-button>
            </div>
        </template>
    </el-dialog>
</template>

<script setup lang="tsx">
import { ref, computed } from 'vue'
import { allGameResource, } from '~/shared/data/allGameResources'
import { type GameResourceTradeEvent, type AllGameResourceID, type GameResource, GameResourceCategory } from '~/shared/types/gameResource'
import { useInventory } from '~/composables/game/useInventory'
import { GameCommonResourceIconAndName } from '#components'
import ShopGrid from './ShopGrid.vue'
import { emitShopBuyResource, emitShopSellResource, } from '~/api/game/socket/trade'
import { formatCountToStr } from '~/shared/utils'
import { calcSellCost } from '~/shared/utils/game/trade'
import { getResourcerIconAndName } from '~/shared/utils/game/info'


const showSellDialog = ref(false)
const showBuyDialog = ref(false)
const btnLoading = ref(false)

const buyTradeInfo = ref<GameResourceTradeEvent>()
const sellTradeInfo = ref<GameResourceTradeEvent>()

const sellResourceInfo = ref<GameResource>()
const buyResourceInfo = ref<GameResource>()

const activeCategory = ref<'all' | GameResourceCategory>('all')

const inventoryInfo = useInventory()

const resourceList = computed(() => {
    const allResource = Object.values(allGameResource)

    return allResource.filter(resource => {
        // if (resource.hideInMarket) {
        //     return false;
        // }
        if (resource.hideInShop) {
            return false;
        }
        return (!!resource.userBuyCost && resource.userBuyCost[0].cost == 'cutePoint') || (!!resource.userSellCost && resource.userSellCost[0].cost == 'cutePoint')
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

const maxBuyCount = computed(() => {
    if (!buyResourceInfo.value?.userBuyCost?.length) {
        return 0
    }

    let max = Infinity
    for (const costInfo of buyResourceInfo.value.userBuyCost) {
        const cost = costInfo.cost ?? 'cutePoint'
        const inventoryCount = unref(inventoryInfo)[cost]?.count ?? 0
        max = Math.min(max, Math.floor(inventoryCount / costInfo.count))
    }
    return Math.max(1, max)
})

// 获取数量
const cutePoint = computed(() => {
    return unref(inventoryInfo).cutePoint?.count ?? 0
})

function canBuyCount(resource: GameResource | undefined, count?: number) {
    if (!resource?.userBuyCost || !count) return false
    for (const costInfo of resource.userBuyCost) {
        const cost = costInfo.cost ?? 'cutePoint'
        const inventoryCount = unref(inventoryInfo)[cost]?.count ?? 0
        if (inventoryCount < costInfo.count * count) {
            return false
        }
    }
    return true
}

function buy(resource: GameResource) {
    showBuyDialog.value = true
    buyResourceInfo.value = resource
    buyTradeInfo.value = {
        id: resource.id,
        count: 1
    }
}

function emitBuy(e: Event) {
    if (!e.isTrusted) return
    showBuyDialog.value = false
    if (!buyResourceInfo.value || !buyTradeInfo.value) {
        return
    }
    emitShopBuyResource(buyTradeInfo.value)

    btnLoading.value = true
    setTimeout(() => {
        btnLoading.value = false
    }, 1000)
}
function onBuyDialogClose() {
    buyResourceInfo.value = undefined
    buyTradeInfo.value = undefined
}

function getResourceCount(id: AllGameResourceID) {
    return unref(inventoryInfo)[id]?.count ?? 0
}

const calcSellInfo = (resourceInfo: GameResource, tradeCount: number) => {
    return calcSellCost(resourceInfo, tradeCount)
}

function canSellCount(resource: GameResource | undefined, count?: number) {
    if (!resource?.userSellCost || !count) return false
    const inventoryCount = resource ? getResourceCount(resource.id) : 0
    return inventoryCount >= count
}

const maxSellCount = computed(() => {
    if (!sellResourceInfo.value) {
        return 0
    }

    return inventoryInfo.value[sellResourceInfo.value.id]?.count ?? 0
})

function sell(resource: GameResource) {
    showSellDialog.value = true
    sellResourceInfo.value = resource
    sellTradeInfo.value = {
        id: resource.id,
        count: 1
    }
}
function emitSell(e: Event) {
    if (!e.isTrusted) return

    showSellDialog.value = false
    if (!sellResourceInfo.value || !sellTradeInfo.value) {
        return
    }
    emitShopSellResource(sellTradeInfo.value)

    btnLoading.value = true
    setTimeout(() => {
        btnLoading.value = false
    }, 1000)
}
function onSellDialogClose() {
    sellResourceInfo.value = undefined
    sellTradeInfo.value = undefined
}

</script>

<style scoped>
/* 可根据需要添加自定义样式 */
</style>