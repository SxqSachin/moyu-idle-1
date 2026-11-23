<template>
    <div class="flex flex-col gap-2">
        <h2 class="text-2xl font-bold mb-4">自由市场</h2>

    <div class="text-gray-600 dark:text-gray-400  mb-6 text-sm">
            喵呜~这里是由各位小猫咪自由交易的市场呢！在这里可以自由上架物品、决定售价，和其他小猫咪进行交易。记得要合理定价哦，毕竟大家都是精明的小商喵呢 (=･ω･=)

            <div class="flex gap-2 mt-4">
                <el-text size="small">
                    在市场（非求购市场）中每交易(出售所得、购买花费)1金币，都会提升{{ TRADING_EXP_PER_GOLD_IN_MARKET }}交易经验
                </el-text>
            </div>
    </div>
    <el-tabs v-model="currentSelectedMainTab" class="w-full" @tab-change="handleTabChange">
            <el-tab-pane :lazy="true" label="商品目录" name="index">

                <!-- 最近成交商品（快速入口） -->
                 <div class="mb-2">
                    <RecentTradedResources @to-resource="toResourceMarketDetail" />
                 </div>

                <div class="flex flex-col md:flex-row items-center gap-0 md:gap-4 justify-center mb-4 md:mb-0">
                    <div class="flex flex-col md:flex-row justify-between w-full md:w-2/6">
                        <el-input placeholder="输入商品名称" class="mr-2 w-full md:w-20" v-model="searchQuery"></el-input>
                        <el-checkbox v-model="onlyShowHasTransaction" label="仅显示有交易的" size="large" />
                    </div>
                    <el-tabs v-model="activeCategory" class="w-full md:w-4/6">
                        <el-tab-pane key="all" label="全部" name="all"></el-tab-pane>
                        <el-tab-pane key="usable" label="可使用的物品" name="usable"></el-tab-pane>
                        <el-tab-pane key="workEquipment" label="👋生活装备" name="workEquipment"></el-tab-pane>
                        <el-tab-pane key="battleEquipment" label="🗡️战斗装备" name="battleEquipment"></el-tab-pane>
                        <template v-for="(catInfo, catKey) in allGameResourceCategoryInfo" :key="catKey">
                            <el-tab-pane v-if="catKey != GameResourceCategory.Custom"
                                :label="`${catInfo.icon} ${catInfo.name}`" :name="catKey" />
                        </template>
                    </el-tabs>
                </div>

                <el-divider class="my-4! md:mt-2!"></el-divider>

                <ul class="list-disc px-2">
                    <div class="flex flex-row flex-wrap gap-x-6 gap-8 pb-8 items-center">
                        <template v-if="['all', 'usable'].includes(activeCategory) && filteredResourceList.length">
                            <template v-for="group in categoryGroupedResources" :key="group.category">
                                <div class="flex flex-col gap-2 w-full">
                                    <div class="w-full font-bold text-lg">
                                        {{ getCategoryName(group.category) }}
                                    </div>
                                    <div class="grid gap-8 resource-grid">
                                        <template v-for="resource in group.resources" :key="resource">
                                            <template v-if="isBaseEnhancableResource(resource)">
                                                <GameNewMarketItem :resource-id="resource"
                                                    @click="toResourceMarketDetail(resource)">
                                                </GameNewMarketItem>
                                            </template>
                                            <template
                                                v-else-if="!filteredResourceList.includes(resource.split('+')[0]) && isEnhancedResource(resource)">
                                                <GameNewMarketItem :resource-id="resource.split('+')[0]"
                                                    @click="toResourceMarketDetail(resource.split('+')[0])">
                                                </GameNewMarketItem>
                                            </template>
                                            <template
                                                v-else-if="!isBaseEnhancableResource(resource) && !isEnhancedResource(resource)">
                                                <GameNewMarketItem :resource-id="resource"
                                                    @click="toResourceMarketDetail(resource)">
                                                </GameNewMarketItem>
                                            </template>
                                        </template>
                                    </div>
                                </div>
                            </template>
                        </template>
                        <template
                            v-else-if="['workEquipment', 'battleEquipment', 'Equipment'].includes(activeCategory) && filteredResourceList.length">
                            <template v-for="group in equipmentPartGroupedResources" :key="group.part">
                                <div class="flex flex-col gap-2 w-full">
                                    <div class="w-full font-bold text-lg">
                                        {{ parseEquimentPartToString(group.part) || '其他' }}
                                    </div>
                                    <div class="grid gap-8 resource-grid">
                                        <template v-for="resource in group.resources" :key="resource">
                                            <template v-if="isBaseEnhancableResource(resource)">

                                                <GameNewMarketItem :resource-id="resource"
                                                    @click="toResourceMarketDetail(resource)">
                                                </GameNewMarketItem>

                                            </template>
                                            <template
                                                v-else-if="!filteredResourceList.includes(resource.split('+')[0]) && isEnhancedResource(resource)">
                                                <GameNewMarketItem :resource-id="resource.split('+')[0]"
                                                    @click="toResourceMarketDetail(resource.split('+')[0])">
                                                </GameNewMarketItem>
                                            </template>
                                            <template
                                                v-if="!isBaseEnhancableResource(resource) && !isEnhancedResource(resource)">
                                                <GameNewMarketItem :resource-id="resource"
                                                    @click="toResourceMarketDetail(resource)">
                                                </GameNewMarketItem>
                                            </template>
                                        </template>
                                    </div>
                                </div>
                            </template>
                        </template>
                        <template v-else>
                            <div class="grid gap-8 resource-grid w-full">
                                <template v-for="resource in filteredResourceList" :key="resource">
                                    <GameNewMarketItem :resource-id="resource" @click="toResourceMarketDetail(resource)">
                                    </GameNewMarketItem>
                                </template>
                            </div>
                        </template>
                    </div>
                </ul>
            </el-tab-pane>
            <el-tab-pane :lazy="true" :disabled="!currentSelectedResourceId" label="市场" name="market">
                <template v-if="currentSelectedResourceId">
                    <div class="flex flex-row items-center justify-between gap-8 mb-2 md:mb-2 px-0">
                        <div class="cursor-pointer text-blue-500 flex items-center" @click="backToResourcePanel">
                            <Icon name="material-symbols:arrow-back-ios-new-rounded"></Icon>
                            <span> 返回 </span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-gray-600 text-lg hidden md:inlein-block">商品: </span>
                            <GameCommonResourceIconAndName :resource-id="currentSelectedResourceId">
                            </GameCommonResourceIconAndName>
                        </div>
                        <div>
                            <el-button :loading="refreshBtnDisabled" :disabled="refreshBtnDisabled || isIronCat"
                                @click="triggerRefresh">刷新</el-button>
                        </div>
                    </div>

                    <!-- 图表 -->
                    <div v-if="priceData">
                        <GameNewMarketSingleResourceStatistic :price-data="priceData"
                            :resource-id="currentSelectedResourceId"></GameNewMarketSingleResourceStatistic>
                    </div>

                    <div v-if="getEnhanceChain(currentSelectedResourceId).length">
                        <el-tabs v-model="currentSelectedEnhanceChainTab" class="w-full md:mb-4"
                            @tab-click="onSelectEnhanceChainTab">
                            <el-tab-pane v-for="(enhanceId, index) in getEnhanceChain(currentSelectedResourceId)"
                                :key="enhanceId" :label="getResourceName(enhanceId)" :name="enhanceId">
                            </el-tab-pane>
                        </el-tabs>
                    </div>
                    <template v-if="!transactionList">
                        <div class="hidden md:block">
                            <div class="flex gap-0 md:gap-8">
                                <div class="flex-1 w-1/3 px-2">
                                    <el-skeleton :rows="5" animated />
                                </div>
                                <el-divider direction="vertical" class="mx-4 h-auto!"></el-divider>
                                <div class="flex-1 w-1/3 px-2">
                                    <el-skeleton :rows="5" animated />
                                </div>
                            </div>
                        </div>
                        <div class="block md:hidden">
                            <el-skeleton :rows="5" animated />
                        </div>
                    </template>
                    <template v-else>
                        <div class="hidden md:block">
                            <div class="flex gap-0 md:gap-8">
                                <!-- 卖方市场 -->
                                <div class="flex-1 w-1/3 px-2">
                                    <el-button v-if="!isIronCat" @click="triggerListToSellerMarket" class="w-24 mb-4"
                                        type="primary">上架物品</el-button>
                                    <el-table :data="sellerMarketInfo" :border="true">
                                        <el-table-column label="数量" width="100">
                                            <template #default="{ row }">
                                                {{ row.sellResourceCount - row.selledResourceCount }}
                                            </template>
                                        </el-table-column>
                                        <el-table-column prop="costPerUnit" label="单价">
                                            <template #default="{ row }">
                                                <GameCommonSimpleResourceIconAndName
                                                    :resource-id="row.costResourceId ?? 'gold'" />
                                                {{ marketFormatNumber(row.costPerUnit) }}
                                            </template>
                                        </el-table-column>
                                        <el-table-column label="操作" width="80" v-if="!isIronCat">
                                            <template #default="{ row }">
                                                <el-button v-if="currentUserUuid != row.seller" size="small"
                                                    type="success"
                                                    @click="triggerBuyFromSellerMarket(row)">购买</el-button>
                                                <el-button v-else size="small" type="warning"
                                                    @click="(e) => confirmRemoveFromSellerMarket(e, row)">下架</el-button>
                                            </template>
                                        </el-table-column>
                                    </el-table>
                                </div>
                                <el-divider direction="vertical" class="mx-4 h-auto!"></el-divider>
                                <!-- 买方市场 -->
                                <div class="flex-1 w-1/3 px-2">
                                    <el-button v-if="!isIronCat" @click="triggerListToBuyerMarket"
                                        class="w-24 float-right mb-4" type="primary">求购物品</el-button>
                                    <el-table :data="buyerMarketInfo" :border="true">
                                        <el-table-column label="数量" width="100">
                                            <template #default="{ row }">
                                                {{ row.requireResourceCount - row.doneResourceCount }}
                                            </template>
                                        </el-table-column>
                                        <el-table-column prop="payPerUnit" label="单价">
                                            <template #default="{ row }">
                                                <GameCommonSimpleResourceIconAndName
                                                    :resource-id="row.payResourceId ?? 'gold'" />
                                                {{ marketFormatNumber(row.payPerUnit) }}
                                            </template>
                                        </el-table-column>
                                        <el-table-column label="操作" width="80" v-if="!isIronCat">
                                            <template #default="{ row }">
                                                <el-button v-if="currentUserUuid != row.buyer" size="small"
                                                    type="success" @click="triggerSellToBuyerMarket(row)">卖出</el-button>
                                                <el-button v-else size="small" type="warning"
                                                    @click="(e) => confirmRemoveFromBuyerMarket(e, row)">撤单</el-button>
                                            </template>
                                        </el-table-column>
                                    </el-table>
                                </div>
                            </div>
                        </div>
                        <div class="block md:hidden">
                            <el-tabs v-model="mobileMarketActiveTab">
                                <el-tab-pane label="出售" name="seller">
                                    <div class="flex-1 w-full">
                                        <el-button v-if="!isIronCat" @click="triggerListToSellerMarket"
                                            class="w-full :w-24 mb-4" type="primary">上架物品</el-button>
                                        <el-table :data="sellerMarketInfo" :border="true">
                                            <el-table-column label="数量" width="100">
                                                <template #default="{ row }">
                                                    {{ row.sellResourceCount - row.selledResourceCount }}
                                                </template>
                                            </el-table-column>
                                            <el-table-column prop="costPerUnit" label="单价">
                                                <template #default="{ row }">
                                                    <GameCommonSimpleResourceIconAndName
                                                        :resource-id="row.costResourceId ?? 'gold'" />
                                                    {{ marketFormatNumber(row.costPerUnit) }}
                                                </template>
                                            </el-table-column>

                                            <el-table-column label="操作" width="80" v-if="!isIronCat">
                                                <template #default="{ row }">
                                                    <el-button v-if="currentUserUuid != row.seller" size="small"
                                                        type="success"
                                                        @click="triggerBuyFromSellerMarket(row)">购买</el-button>
                                                    <el-button v-else size="small" type="warning"
                                                        @click="e => confirmRemoveFromSellerMarket(e, row)">下架</el-button>
                                                </template>
                                            </el-table-column>
                                        </el-table>
                                    </div>
                                </el-tab-pane>
                                <el-tab-pane label="求购" name="buyer">
                                    <div class="flex-1 w-full">
                                        <el-button v-if="!isIronCat" @click="triggerListToBuyerMarket"
                                            class="w-full md:w-24 float-right mb-4" type="primary">求购物品</el-button>
                                        <el-table :data="buyerMarketInfo" :border="true">
                                            <el-table-column label="数量" width="100">
                                                <template #default="{ row }">
                                                    {{ row.requireResourceCount - row.doneResourceCount }}
                                                </template>
                                            </el-table-column>
                                            <el-table-column prop="payPerUnit" label="单价">
                                                <template #default="{ row }">
                                                    <GameCommonSimpleResourceIconAndName
                                                        :resource-id="row.payResourceId ?? 'gold'" />
                                                    {{ marketFormatNumber(row.payPerUnit) }}
                                                </template>
                                            </el-table-column>
                                            <el-table-column label="操作" width="80" v-if="!isIronCat">
                                                <template #default="{ row }">
                                                    <el-button v-if="currentUserUuid != row.buyer" size="small"
                                                        type="success"
                                                        @click="triggerSellToBuyerMarket(row)">卖出</el-button>
                                                    <el-button v-else size="small" type="warning"
                                                        @click="e => confirmRemoveFromBuyerMarket(e, row)">撤单</el-button>
                                                </template>
                                            </el-table-column>
                                        </el-table>
                                    </div>
                                </el-tab-pane>
                            </el-tabs>
                        </div>
                    </template>
                </template>
            </el-tab-pane>
            <el-tab-pane :lazy="true" label="上架记录" name="history" v-if="!isIronCat">
                <el-tabs v-model="transactionHistoryActiveTab" @tab-change="onTransactionHistoryTabChange">
                    <el-tab-pane :lazy="true" label="上架" name="sell">
                        <div class="flex items-center justify-between mb-2">
                            <div>
                                <template v-if="listingLimits">
                                    <span class="mr-4 text-sm">上架上限: {{ listingLimits.maxSellerTransactions }} (已用 {{ historyUsage.sell }} )</span>
                                </template>
                            </div>
                            <div class="flex items-center gap-2">
                                <el-popover v-model:visible="sellerExpandPopoverVisible" width="360" placement="bottom" trigger="click">
                                    <template #default>
                                        <div class="text-sm">
                                            <div class="mb-2">选择方案并确认消耗，将上限从 {{ listingLimits?.maxSellerTransactions }} 扩展至 {{ listingLimits ? listingLimits.maxSellerTransactions + 1 : '-' }}：</div>
                                            <div class="mb-3">
                                                <div class="flex flex-col gap-2">
                                                    <template v-for="s in MARKET_LISTING_EXPANSION_SCHEMES" :key="s.id">
                                                        <label class="flex items-start gap-3 p-2 border rounded cursor-pointer" :class="{ 'bg-gray-50': selectedSellerScheme === s.id }">
                                                            <input type="radio" name="marketSellerScheme" class="mt-1" :value="s.id" v-model="selectedSellerScheme" />
                                                            <div class="flex-1">
                                                                <div class="flex items-center justify-between">
                                                                    <div class="font-medium">{{ s.name }}</div>
                                                                    <div class="text-xs text-gray-500">可用: {{ getMarketSchemeRemainingLabel(s.id, 'seller') }}</div>
                                                                </div>
                                                                <div class="text-xs text-gray-400 mt-1">{{ getMarketSchemeShortHint(s.id, 'seller') }}</div>
                                                            </div>
                                                        </label>
                                                    </template>
                                                </div>
                                            </div>
                                            <div class="flex flex-col gap-2 mb-3">
                                                <div v-for="r in sellerNextReq" :key="r.id" class="flex items-center gap-2">
                                                    <GameCommonResourceIconAndName :resource-id="r.id" :count="r.count" :show-inventory-count="true" />
                                                </div>
                                            </div>
                                            <div class="flex justify-end gap-2">
                                                <el-button size="small" @click="sellerExpandPopoverVisible = false">取消</el-button>
                                                <el-button size="small" type="primary" :loading="expandLoading" @click="confirmExpandSeller">扩容</el-button>
                                            </div>
                                        </div>
                                    </template>
                                    <template #reference>
                                        <el-button size="small" type="primary" :loading="expandLoading">扩展上架上限</el-button>
                                    </template>
                                </el-popover>
                            </div>
                        </div>
                                                <div class="flex justify-start items-center mb-2">
                                                        <el-pagination
                                                            v-if="historyTotals.sell > transactionHistoryPageSize"
                                                            small
                                                            layout="prev, pager, next"
                                                            :total="historyTotals.sell"
                                                            :page-size="transactionHistoryPageSize"
                                                            :current-page="historyPage.sell"
                                                            @current-change="(p:number)=>fetchTransactionHistory(p)"
                                                        />
                                                </div>
                                                <el-table :data="sellHistorySorted" :border="true" :loading="transactionHistoryLoading" :default-sort="{ prop: 'createTime', order: 'descending' }" @sort-change="onSellTableSortChange" @filter-change="onSellFilterChange">
                            <el-table-column column-key="sellResourceId" prop="sellResourceId" :filters="sellResourceFilters" :filter-method="noopFilter" :filter-multiple="true">
                                <template #header>
                                    <div class="inline-flex items-center justify-between">
                                        <div>资源</div>
                                    </div>
                                </template>
                                <template #default="{ row }">
                                    <div class="cursor-pointer text-blue-400" @click="toDetail(row.sellResourceId)" v-if="row.type=='sell'">
                                        <GameCommonSimpleResourceIconAndName :resource-id="row.sellResourceId" />
                                    </div>
                                </template>
                            </el-table-column>
                            <el-table-column prop="sellResourceCount" label="数量/已出售" sortable="custom">
                                <template #header>
                                    <div class="inline-flex items-center justify-between">数量/已出售</div>
                                </template>
                                <template #default="{ row }">
                                    <span v-if="row.type === 'sell'">{{ row.sellResourceCount }} / {{ row.selledResourceCount }}</span>
                                </template>
                            </el-table-column>
                            <el-table-column prop="costPerUnit" label="单价" sortable="custom">
                                <template #header>
                                    <div class="inline-flex items-center justify-between">单价</div>
                                </template>
                                <template #default="{ row }">
                                    <template v-if="row.type=='sell'">
                                        <GameCommonSimpleResourceIconAndName :resource-id="row.costResourceId ?? 'gold'" />
                                        {{ formatNumber(row.costPerUnit) }}
                                    </template>
                                </template>
                            </el-table-column>
                            <el-table-column label="收益" prop="revenue" sortable="custom">
                                <template #header>
                                    <div class="inline-flex items-center justify-between">收益</div>
                                </template>
                                <template #default="{ row }">
                                    <template v-if="row.type=='sell'">
                                        <GameCommonSimpleResourceIconAndName :resource-id="row.costResourceId ?? 'gold'" />
                                        {{ formatNumber(row.costPerUnit * row.selledResourceCount) }}
                                    </template>
                                </template>
                            </el-table-column>
                            <el-table-column label="创建时间" prop="createTime" width="150" sortable>
                                <template #header>
                                    <div class="inline-flex items-center justify-between">创建时间</div>
                                </template>
                                <template #default="{ row }">
                                    {{ row.createTime ? formatTime(row.createTime, { hideSecond: true}) : '-' }}
                                </template>
                            </el-table-column>
                            <el-table-column label="关闭时间" prop="closeTime" width="150" sortable>
                                <template #header>
                                    <div class="inline-flex items-center justify-between">关闭时间</div>
                                </template>
                                <template #default="{ row }">
                                    {{ row.closeTime? formatTime(row.closeTime, { hideSecond: true}) : '-' }}
                                </template>
                            </el-table-column>
                            <el-table-column column-key="sellStatus" prop="isClosed" label="状态" width="120" :filters="sellStatusFilters" :filter-method="noopFilter" fixed="right">
                                <template #header>
                                    <div class="inline-flex items-center justify-between">状态</div>
                                </template>
                                <template #default="{ row }">
                                    <template v-if="!row.isClosed">
                                        <el-button v-if="row.type == 'sell'" size="small" type="warning" @click="e => confirmRemoveFromSellerMarket(e, row)">下架</el-button>
                                        <el-button v-if="row.type == 'buy'" size="small" type="warning" @click="e => confirmRemoveFromBuyerMarket(e, row)">撤单</el-button>
                                    </template>
                                    <template v-else>
                                        <el-text>已关闭</el-text>
                                    </template>
                                </template>
                            </el-table-column>
                        </el-table>
                    </el-tab-pane>
                    <el-tab-pane :lazy="true" label="求购" name="buy">
                        <div class="flex items-center justify-between mb-2">
                            <div>
                                <template v-if="listingLimits">
                                    <span class="mr-4 text-sm">求购上限: {{ listingLimits.maxBuyerTransactions }} (已用 {{ historyUsage.buy }} )</span>
                                </template>
                            </div>
                            <div class="flex items-center gap-2">
                                <el-popover v-model:visible="buyerExpandPopoverVisible" width="360" placement="bottom" trigger="click">
                                    <template #default>
                                        <div class="text-sm">
                                            <div class="mb-2">选择方案并确认消耗，将上限从 {{ listingLimits?.maxBuyerTransactions }} 扩展至 {{ listingLimits ? listingLimits.maxBuyerTransactions + 1 : '-' }}：</div>
                                            <div class="mb-3">
                                                <div class="flex flex-col gap-2">
                                                    <template v-for="s in MARKET_LISTING_EXPANSION_SCHEMES" :key="s.id">
                                                        <label class="flex items-start gap-3 p-2 border rounded cursor-pointer" :class="{ 'bg-gray-50': selectedBuyerScheme === s.id }">
                                                            <input type="radio" name="marketBuyerScheme" class="mt-1" :value="s.id" v-model="selectedBuyerScheme" />
                                                            <div class="flex-1">
                                                                <div class="flex items-center justify-between">
                                                                    <div class="font-medium">{{ s.name }}</div>
                                                                    <div class="text-xs text-gray-500">可用: {{ getMarketSchemeRemainingLabel(s.id, 'buyer') }}</div>
                                                                </div>
                                                                <div class="text-xs text-gray-400 mt-1">{{ getMarketSchemeShortHint(s.id, 'buyer') }}</div>
                                                            </div>
                                                        </label>
                                                    </template>
                                                </div>
                                            </div>
                                            <div class="flex flex-col gap-2 mb-3">
                                                <div v-for="r in buyerNextReq" :key="r.id" class="flex items-center gap-2">
                                                    <GameCommonResourceIconAndName :resource-id="r.id" :count="r.count" :show-inventory-count="true" />
                                                </div>
                                            </div>
                                            <div class="flex justify-end gap-2">
                                                <el-button size="small" @click="buyerExpandPopoverVisible = false">取消</el-button>
                                                <el-button size="small" type="primary" :loading="expandLoading" @click="confirmExpandBuyer">扩容</el-button>
                                            </div>
                                        </div>
                                    </template>
                                    <template #reference>
                                        <el-button size="small" type="primary" :loading="expandLoading">扩展求购上限</el-button>
                                    </template>
                                </el-popover>
                            </div>
                        </div>
                                                <div class="flex justify-start items-center mb-2">
                                                        <el-pagination
                                                            v-if="historyTotals.buy > transactionHistoryPageSize"
                                                            small
                                                            layout="prev, pager, next"
                                                            :total="historyTotals.buy"
                                                            :page-size="transactionHistoryPageSize"
                                                            :current-page="historyPage.buy"
                                                            @current-change="(p:number)=>fetchTransactionHistory(p)"
                                                        />
                                                </div>
                                                <el-table :data="buyHistorySorted" :border="true" :loading="transactionHistoryLoading" @sort-change="onBuyTableSortChange" @filter-change="onBuyFilterChange">
                            <el-table-column column-key="buyResourceId" prop="requireResourceId" :filters="buyResourceFilters" :filter-method="noopFilter" :filter-multiple="true">
                                <template #header>
                                    <div class="inline-block">资源</div>
                                </template>
                                <template #default="{ row }">
                                    <div class="cursor-pointer text-blue-400" @click="toDetail(row.requireResourceId)" v-if="row.type=='buy'">
                                        <GameCommonSimpleResourceIconAndName :resource-id="row.requireResourceId" />
                                    </div>
                                </template>
                            </el-table-column>
                            <el-table-column prop="requireResourceCount" label="数量" sortable="custom">
                                <template #header>
                                    <div class="inline-block">数量</div>
                                </template>
                                <template #default="{ row }">
                                    <span v-if="row.type == 'buy'">{{ row.requireResourceCount }} (已购得 {{ row.doneResourceCount }})</span>
                                </template>
                            </el-table-column>
                            <el-table-column prop="payPerUnit" label="单价" sortable="custom">
                                <template #header>
                                    <div class="inline-block">单价</div>
                                </template>
                                <template #default="{ row }">
                                    <template v-if="row.type=='buy'">
                                        <GameCommonSimpleResourceIconAndName :resource-id="row.payResourceId ?? 'gold'" />
                                        {{ formatNumber(row.payPerUnit) }}
                                    </template>
                                </template>
                            </el-table-column>
                            <el-table-column label="创建时间" prop="createTime" width="180" sortable>
                                <template #header>
                                    <div class="inline-flex items-center justify-between">创建时间</div>
                                </template>
                                <template #default="{ row }">
                                    {{ row.createTime ? new Date(row.createTime).toLocaleString() : '-' }}
                                </template>
                            </el-table-column>
                            <el-table-column label="关闭时间" width="180" sortable>
                                <template #header>
                                    <div class="inline-flex items-center justify-between">关闭时间</div>
                                </template>
                                <template #default="{ row }">
                                    {{ row.closeTime? new Date(row.closeTime).toLocaleString() : '-' }}
                                </template>
                            </el-table-column>
                            <el-table-column column-key="buyStatus" prop="isClosed" label="状态" width="100" :filters="buyStatusFilters" :filter-method="noopFilter" fixed="right">
                                <template #header>
                                    <div class="inline-flex items-center justify-between">状态</div>
                                </template>
                                <template #default="{ row }">
                                    <template v-if="!row.isClosed">
                                        <el-button v-if="row.type == 'sell'" size="small" type="warning" @click="e => confirmRemoveFromSellerMarket(e, row)">下架</el-button>
                                        <el-button v-if="row.type == 'buy'" size="small" type="warning" @click="e => confirmRemoveFromBuyerMarket(e, row)">撤单</el-button>
                                    </template>
                                    <template v-else>
                                        <el-text>已关闭</el-text>
                                    </template>
                                </template>
                            </el-table-column>
                        </el-table>
                    </el-tab-pane>
                </el-tabs>
            </el-tab-pane>
            <el-tab-pane :lazy="true" label="价格" name="price">
                <GameNewMarketPrice></GameNewMarketPrice>
            </el-tab-pane>
        </el-tabs>

    </div>

    <el-dialog :draggable="true" v-model="showSellerMarketListDialog" title="上架" width="350" align-center>
        <div>
            <div class="mb-4">
                <span>出售：</span>
                <GameCommonSimpleResourceIconAndName v-if="currentSelectedResourceId"
                    :resource-id="currentSelectedResourceId" />
                <span v-else class="text-gray-400">未选择</span>
            </div>
            <div class="mb-4">
                <div class="flex items-center">
                    <span class="whitespace-nowrap">数量：</span>
                    <el-input-number class="w-64!" step-strictly :step="1" controls-position="right"
                        v-model="sellerMarketListToMarketInfo.sellResourceCount" :min="0"
                        :max="sellerMarketMaxSellCount">
                        <template #suffix>
                            <span> / {{ formatCountToStr(sellerMarketMaxSellCount) }}</span>
                        </template>
                    </el-input-number>
                </div>
                <div class="flex flex-row justify-start my-2">
                    <el-button size="small" type="primary"
                        @click="sellerMarketListToMarketInfo.sellResourceCount = +(sellerMarketListToMarketInfo.sellResourceCount + 10).toFixed(0)">+10</el-button>
                    <el-button size="small" type="primary"
                        @click="sellerMarketListToMarketInfo.sellResourceCount = +(sellerMarketListToMarketInfo.sellResourceCount + 100).toFixed(0)">+100</el-button>
                    <el-button size="small" type="primary"
                        @click="sellerMarketListToMarketInfo.sellResourceCount = +(sellerMarketListToMarketInfo.sellResourceCount + 1000).toFixed(0)">+1000</el-button>
                    <el-button size="small" type="primary"
                        @click="sellerMarketListToMarketInfo.sellResourceCount = +(sellerMarketListToMarketInfo.sellResourceCount + 10000).toFixed(0)">+10000</el-button>
                </div>
                <div class="flex flex-row justify-start my-2">
                    <el-button size="small" type="primary"
                        @click="sellerMarketListToMarketInfo.sellResourceCount = +(sellerMarketMaxSellCount * 0.1).toFixed(0)">10%</el-button>
                    <el-button size="small" type="primary"
                        @click="sellerMarketListToMarketInfo.sellResourceCount = +(sellerMarketMaxSellCount * 0.25).toFixed(0)">25%</el-button>
                    <el-button size="small" type="primary"
                        @click="sellerMarketListToMarketInfo.sellResourceCount = +(sellerMarketMaxSellCount * 0.5).toFixed(0)">50%</el-button>
                    <el-button size="small" type="primary"
                        @click="sellerMarketListToMarketInfo.sellResourceCount = sellerMarketMaxSellCount">100%</el-button>
                </div>
            </div>
            <div class="mb-4 flex flex-col items-start gap-2">
                <span class="whitespace-nowrap">单价：</span>
                <div class="flex gap-1! items-center w-full">
                    <el-button size="small" @click="handleSellerMarketCostPerUnitDivideByTwo">÷2</el-button>
                    <el-button size="small" class="ml-0!" @click="handleSellerMarketCostPerUnitMinus">-</el-button>
                    <el-input-number class="w-full flex-1" @change="handleSellerMarketCostPerUnitChange" step-strictly
                        :controls="false" v-model="sellerMarketListToMarketInfo.costPerUnit" :min="1">
                    </el-input-number>
                    <el-button size="small" @click="handleSellerMarketCostPerUnitPlus">+</el-button>
                    <el-button size="small" class="ml-0!"
                        @click="handleSellerMarketCostPerUnitMultiplyByTwo">x2</el-button>
                </div>
            </div>
            <div class="mb-4">
                <span class="inline-block w-20">可得：</span>
                <div class="inline-flex flex-col gap-2">
                    <GameCommonResourceIconAndName v-if="sellerMarketListToMarketInfo.costResourceId"
                        :ignore-tag-color="true" :resource-id="sellerMarketListToMarketInfo.costResourceId"
                        :count="(sellerMarketListToMarketInfo.sellResourceCount || 0) * (sellerMarketListToMarketInfo.costPerUnit || 0)">
                    </GameCommonResourceIconAndName>
                    <span v-else class="text-gray-400">-</span>
                </div>
            </div>
            <div class="mb-4">
                <span class="inline-block w-20">税费：</span>
                <div class="inline-flex flex-col gap-2">
                    <GameCommonResourceIconAndName v-if="sellerMarketListToMarketInfo.costResourceId"
                        :resource-id="sellerMarketListToMarketInfo.costResourceId" :count="sellerMarketListingFee" />
                    <span v-else class="text-gray-400">-</span>
                </div>
            </div>
            <div class="mb-4">
                <span class="inline-block w-20">预期收入：</span>
                <div class="inline-flex flex-col gap-2">
                    <GameCommonResourceIconAndName v-if="sellerMarketListToMarketInfo.costResourceId"
                        :ignore-tag-color="true" :resource-id="sellerMarketListToMarketInfo.costResourceId"
                        :count="(sellerMarketListToMarketInfo.sellResourceCount || 0) * (sellerMarketListToMarketInfo.costPerUnit || 0) - sellerMarketListingFee" />
                    <span v-else class="text-gray-400">-</span>
                </div>
            </div>
            <div>
                <span class="inline-block w-20">库存：</span>
                <div class="inline-flex flex-col gap-2">
                    <GameCommonResourceIconAndName v-if="sellerMarketListToMarketInfo.sellResourceId"
                        :ignore-tag-color="true" :resource-id="sellerMarketListToMarketInfo.sellResourceId"
                        :count="(inventory?.[sellerMarketListToMarketInfo.sellResourceId]?.count ?? 0) - (sellerMarketListToMarketInfo.sellResourceCount || 0)"
                        :show-inventory-count="true"
                        :count-modify="-(sellerMarketListToMarketInfo.sellResourceCount || 0)" />
                    <span v-else class="text-gray-400">-</span>
                </div>
            </div>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <el-button type="primary" class="w-full"
                    :disabled="sellerMarketListButtonDisable || (!sellerMarketListToMarketInfo.sellResourceCount || sellerMarketListToMarketInfo.sellResourceCount > sellerMarketMaxSellCount)"
                    @click="handleListToSellerMarket">
                    确认上架
                </el-button>
            </div>
            <div class="flex flex-col items-start mt-2 text-left">
                <div class="text-xs text-gray-400">上架须知:</div>
                <div class="text-xs text-gray-400">
                    1. 上架时，将会从您的仓库中提取对应数量的资源。
                    <br />
                    2. 下架物品后返还未出售的资源。
                    <br />
                    3. 当对同一个物品在30分钟内重复进行2次上架操作后，将会触发60分钟的调价冷却，期间你无法对此物品再次进行上架操作。
                </div>
            </div>
        </template>
    </el-dialog>
    <!-- 购买弹窗 -->
    <el-dialog :draggable="true" v-model="showSellerMarketBuyDialog" title="购买" width="350" align-center>
        <div v-if="currentSelectedResourceId && sellerMarketBuyingItem">
            <div class="mb-4">
                <span>购买：</span>
                <GameCommonSimpleResourceIconAndName v-if="currentSelectedResourceId"
                    :resource-id="currentSelectedResourceId" />
                <span v-else class="text-gray-400">-</span>
            </div>
            <div class="mb-4 flex flex-col items-start">
                <div class="flex items-center mb-4">
                    <span class="whitespace-nowrap">数量：</span>
                    <el-input-number step-strictly :step="1" class="w-48!" controls-position="right"
                        v-model="sellerMarketBuyFromMarketInfo.buyCount" :min="0" :max="sellerMarketMaxBuyCount">
                        <template #suffix>
                            <span> / {{ sellerMarketMaxBuyCount }}</span>
                        </template>
                    </el-input-number>
                </div>
                <div class="flex flex-wrap gap-2">
                    <el-button class="ml-0 w-16" size="small" type="primary"
                        @click="sellerMarketBuyFromMarketInfo.buyCount += 10">+10</el-button>
                    <el-button class="ml-0 w-16" size="small" type="primary"
                        @click="sellerMarketBuyFromMarketInfo.buyCount += 100">+100</el-button>
                    <el-button class="ml-0 w-16" size="small" type="primary"
                        @click="sellerMarketBuyFromMarketInfo.buyCount += 1000">+1000</el-button>
                    <el-button class="ml-0 w-16" size="small" type="primary"
                        @click="sellerMarketBuyFromMarketInfo.buyCount += 10000">+10000</el-button>
                </div>
            </div>
            <el-divider></el-divider>
            <div class="mb-4">
                <span>单价：</span>
                <div class="inline-flex flex-col gap-2 mr-2">
                    <GameCommonResourceIconAndName v-if="sellerMarketBuyingItem.costResourceId" :ignore-tag-color="true"
                        :resource-id="sellerMarketBuyingItem.costResourceId"
                        :count="sellerMarketBuyingItem.costPerUnit" />
                    <span v-else class="text-gray-400">-</span>
                </div>
                <el-text type="warning" size="small" v-if="!sellerMarketMaxBuyCount">你无法完成支付</el-text>
            </div>
            <div class="mb-4">
                <span>总价：</span>
                <div class="inline-flex flex-col gap-2">
                    <GameCommonResourceIconAndName v-if="sellerMarketBuyingItem.costResourceId" :ignore-tag-color="true"
                        :resource-id="sellerMarketBuyingItem.costResourceId"
                        :count="(sellerMarketBuyingItem.costPerUnit || 0) * (sellerMarketBuyFromMarketInfo.buyCount || 0)"
                        :show-inventory-count="true"
                        :count-modify="-(sellerMarketBuyingItem.costPerUnit || 0) * (sellerMarketBuyFromMarketInfo.buyCount || 0)" />
                    <span v-else class="text-gray-400">-</span>
                </div>
            </div>
            <div>
                <span>库存：</span>
                <div class="inline-flex flex-col gap-2">
                    <GameCommonResourceIconAndName v-if="sellerMarketBuyingItem.sellResourceId" :ignore-tag-color="true"
                        :resource-id="sellerMarketBuyingItem.sellResourceId"
                        :count="(inventory?.[sellerMarketBuyingItem.sellResourceId]?.count ?? 0) + (sellerMarketBuyFromMarketInfo.buyCount || 0)"
                        :show-inventory-count="true" :count-modify="(sellerMarketBuyFromMarketInfo.buyCount || 0)" />
                    <span v-else class="text-gray-400">-</span>
                </div>
            </div>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <el-button type="primary" class="w-full"
                    :disabled="sellerMarketBuyButtonDisabled || !(!!sellerMarketBuyingItem && sellerMarketBuyFromMarketInfo.buyCount > 0 && sellerMarketBuyFromMarketInfo.buyCount <= sellerMarketMaxBuyCount)"
                    @click="confirmBuyFromSellerMarket">
                    确认购买
                </el-button>
            </div>
        </template>
    </el-dialog>

    <!-- 发起求购弹窗 -->
    <el-dialog :draggable="true" v-model="showBuyerMarketListDialog" title="发起求购" width="350" align-center>
        <div>
            <div class="mb-4 flex flex-row gap-2 items-center" v-if="currentSelectedResourceId">
                <label class="block mb-1 font-medium">求购资源: </label>
                <GameCommonResourceIconAndName :resource-id="currentSelectedResourceId"></GameCommonResourceIconAndName>
            </div>
            <div class="mb-4 flex items-center">
                <span class="whitespace-nowrap">数量：</span>
                <el-input-number step-strictly :step="1" controls-position="right"
                    v-model="buyerMarketListToBuyerMarketInfo.requireResourceCount" :min="1" />
            </div>
            <div class="mb-4">
                <label class="block mb-1 font-medium">支付资源: </label>
                <el-select filterable v-model="buyerMarketListToBuyerMarketInfo.payResourceId" placeholder="选择支付资源"
                    class="w-full">
                    <template v-for="(item, id) in allGameResource" :key="id">
                        <el-option v-if="item && !item.isInternal && (item.id == 'gold' || !item.hideInMarket)"
                            :label="item.name" :value="id">
                            <GameCommonSimpleResourceIconAndName :resource-id="item.id" />
                        </el-option>
                    </template>
                </el-select>
            </div>
            <div class="mb-4 flex flex-col items-start gap-2">
                <span class="whitespace-nowrap">单价：</span>
                <div class="flex gap-1! items-center w-full">

                    <el-button size="small" @click="handleBuyerMarketCostPerUnitDivideByTwo">÷2</el-button>
                    <el-button size="small" class="ml-0!" @click="handleBuyerMarketCostPerUnitMinus">-</el-button>
                    <el-input-number class="w-full flex-1" @change="handleBuyerMarketCostPerUnitChange" step-strictly
                        :controls="false" v-model="buyerMarketListToBuyerMarketInfo.payPerUnit" :min="1">
                    </el-input-number>
                    <el-button size="small" @click="handleBuyerMarketCostPerUnitPlus">+</el-button>
                    <el-button size="small" class="ml-0!"
                        @click="handleBuyerMarketCostPerUnitMultiplyByTwo">x2</el-button>
                </div>

            </div>
            <div class="mb-4" v-if="buyerMarketListToBuyerMarketInfo.payResourceId == 'gold'">
                <span class="inline-block">预扣税费：</span>
                <div class="inline-flex flex-col gap-2">
                    <GameCommonResourceIconAndName v-if="sellerMarketListToMarketInfo.costResourceId"
                        :resource-id="sellerMarketListToMarketInfo.costResourceId" :count="buyerMarketFee" />
                    <span v-else class="text-gray-400">-</span>
                </div>
            </div>
            <div class="mb-4">
                <span>总支付：</span>
                <GameCommonResourceIconAndName v-if="buyerMarketListToBuyerMarketInfo.payResourceId"
                    :resource-id="buyerMarketListToBuyerMarketInfo.payResourceId"
                    :count="(buyerMarketListToBuyerMarketInfo.requireResourceCount || 0) * (buyerMarketListToBuyerMarketInfo.payPerUnit || 0) + buyerMarketFee" />
            </div>
        </div>
        <template #footer>
            <el-button type="primary" class="w-full" :disabled="buyerMarketListButtonDisable"
                @click="handleListToBuyerMarket">
                确认求购
            </el-button>
        </template>
    </el-dialog>
    <el-dialog :draggable="true" v-model="showBuyerMarketSellDialog" title="卖出资源" width="350" align-center>
        <div v-if="buyerMarketSellingItem">
            <div class="mb-4">
                <span>卖出：</span>
                <GameCommonSimpleResourceIconAndName v-if="buyerMarketSellingItem.requireResourceId"
                    :resource-id="buyerMarketSellingItem.requireResourceId" />
            </div>
            <div class="mb-4 flex items-center">
                <span class="whitespace-nowrap">数量：</span>
                <el-input-number controls-position="right" v-model="buyerMarketSellCount" :min="0"
                    :max="buyerMarketMaxSellCount" />
                <span class="ml-2 text-gray-400">/ {{ buyerMarketMaxSellCount }}</span>
            </div>
            <div class="mb-4">
                <span>单价：</span>
                <GameCommonResourceIconAndName v-if="buyerMarketSellingItem.payResourceId"
                    :resource-id="buyerMarketSellingItem.payResourceId" :count="buyerMarketSellingItem.payPerUnit" />
            </div>
            <div class="mb-4">
                <span>可得：</span>
                <GameCommonResourceIconAndName v-if="buyerMarketSellingItem.payResourceId"
                    :resource-id="buyerMarketSellingItem.payResourceId"
                    :count="(buyerMarketSellCount || 0) * (buyerMarketSellingItem.payPerUnit || 0)" />
            </div>
        </div>
        <template #footer>
            <el-button type="primary" class="w-full"
                :disabled="buyerMarketSellButtonDisabled || !(buyerMarketSellCount > 0 && buyerMarketSellCount <= buyerMarketMaxSellCount)"
                @click="buyerMarketConfirmSell">
                确认卖出
            </el-button>
        </template>
    </el-dialog>

    <!-- 确认撤销求购 -->
    <el-dialog :draggable="true" v-model="showRemoveBuyerMarketDialog" title="撤销求购" width="380" align-center>
        <div v-if="pendingRemoveBuyerTrade">
            <div class="mb-2">确定撤销以下求购单:</div>
            <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                    <el-text>资源：</el-text>
                    <GameCommonResourceIconAndName :resource-id="pendingRemoveBuyerTrade.requireResourceId"
                        :count="pendingRemoveBuyerRemain" />
                </div>
                <div class="flex items-center gap-2">
                    <el-text>单价：</el-text>
                    <GameCommonResourceIconAndName :resource-id="pendingRemoveBuyerTrade.payResourceId"
                        :count="pendingRemoveBuyerTrade.payPerUnit" />
                </div>
                <div>
                    <el-text>已完成：{{ pendingRemoveBuyerTrade.doneResourceCount }}</el-text>
                </div>
            </div>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <el-button @click="handleCancelRemoveBuyerMarket">取消</el-button>
                <el-button type="primary" :loading="removeBuyerLoading" @click="handleConfirmRemoveBuyerMarket">
                    确认撤销
                </el-button>
            </div>
        </template>
    </el-dialog>

    <!-- 确认下架商品 -->
    <el-dialog :draggable="true" v-model="showRemoveSellerMarketDialog" title="下架商品" width="380" align-center>
        <div v-if="pendingRemoveSellerTrade">
            <div class="mb-2">确定下架以下商品:</div>
            <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                    <el-text>商品：</el-text>
                    <GameCommonResourceIconAndName :resource-id="pendingRemoveSellerTrade.sellResourceId"
                        :count="pendingRemoveSellerRemain" />
                </div>
                <div class="flex items-center gap-2">
                    <el-text>单价：</el-text>
                    <GameCommonResourceIconAndName :resource-id="pendingRemoveSellerTrade.costResourceId"
                        :count="pendingRemoveSellerTrade.costPerUnit" />
                </div>
                <div>
                    <el-text>已卖出：{{ pendingRemoveSellerTrade.selledResourceCount }}</el-text>
                </div>
            </div>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <el-button @click="handleCancelRemoveSellerMarket">取消</el-button>
                <el-button type="primary" :loading="removeSellerLoading" @click="handleConfirmRemoveSellerMarket">
                    确认下架
                </el-button>
            </div>
        </template>
    </el-dialog>

    <!-- 扩展上架上限 -->
    <el-dialog :draggable="true" v-model="showExpandSellerDialog" title="扩展上架上限" width="420" align-center>
        <div v-if="listingLimits">
            <div class="mb-2">当前上限: {{ sellerExpandPreview.current }}，扩展后: {{ sellerExpandPreview.next }}</div>
            <div class="mb-2">消耗：</div>
            <div class="flex flex-col gap-2">
                <div v-if="expandSellerRequirements.length === 0" class="text-gray-400">无消耗</div>
                <div v-for="req in expandSellerRequirements" :key="req.id" class="flex items-center gap-2">
                    <GameCommonResourceIconAndName :resource-id="req.id" :count="req.count" />
                </div>
            </div>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <el-button @click="showExpandSellerDialog = false">取消</el-button>
                <el-button type="primary" :loading="expandLoading" @click="handleConfirmExpandSeller">
                    确认扩展
                </el-button>
            </div>
        </template>
    </el-dialog>

    <!-- 扩展求购上限 -->
    <el-dialog :draggable="true" v-model="showExpandBuyerDialog" title="扩展求购上限" width="420" align-center>
        <div v-if="listingLimits">
            <div class="mb-2">当前上限: {{ buyerExpandPreview.current }}，扩展后: {{ buyerExpandPreview.next }}</div>
            <div class="mb-2">消耗：</div>
            <div class="flex flex-col gap-2">
                <div v-if="expandBuyerRequirements.length === 0" class="text-gray-400">无消耗</div>
                <div v-for="req in expandBuyerRequirements" :key="req.id" class="flex items-center gap-2">
                    <GameCommonResourceIconAndName :resource-id="req.id" :count="req.count" />
                </div>
            </div>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <el-button @click="showExpandBuyerDialog = false">取消</el-button>
                <el-button type="primary" :loading="expandLoading" @click="handleConfirmExpandBuyer">
                    确认扩展
                </el-button>
            </div>
        </template>
    </el-dialog>
</template>

<script lang="ts" setup>
import { GameCommonResourceIconAndName } from '#components';
import RecentTradedResources from './RecentTradedResources.vue';
import { emitListToBuyerMarket, emitRemoveFromBuyerMarket, emitSellToBuyerMarket, onListToBuyerMarketError, onListToBuyerMarketSuccess, onSellToBuyerMarketError, onSellToBuyerMarketSuccess } from '~/api/game/socket/buyerMarket';
import { emitBuyFromMarket, emitListToMarket, emitRemoveFromMarket, onBuyFromMarketError, onBuyFromMarketSuccess, onListToMarketError, onListToMarketSuccess,
    emitGetMarketListingLimits, onGetMarketListingLimitsSuccess, onGetMarketListingLimitsError,
    emitExpandSellerListingSlots, onExpandSellerListingSlotsSuccess, onExpandSellerListingSlotsError,
    emitExpandBuyerListingSlots, onExpandBuyerListingSlotsSuccess, onExpandBuyerListingSlotsError } from '~/api/game/socket/market';
import { waitUtilConnected } from '~/api/game/socket/socket';
import { emitGetMarketPriceData, emitGetUnifiedTradeableResourceList, emitGetUnifiedTransactionHistory, emitGetUnifiedTransactionList, onGetMarketPriceDataSuccess, onGetUnifiedTradeableResourceList, onGetUnifiedTransactionHistory, onGetUnifiedTransactionHistoryError, onGetUnifiedTransactionList } from '~/api/game/socket/unifiedMarket';
import { useInventory } from '~/composables/game/useInventory';
import { allGameResource, allGameResourceCategoryInfo, allGameResourceIDWithInternal, allGameResourceWithInternal } from '~/shared/data/allGameResources';
import { BANNED_RESOURCE_IN_MARKET, BUYER_MARKET_FEE, MARKET_PRICE_STEP_CONFIG, MIN_LISTING_FEE, SELLER_MARKET_FEE, TRADING_EXP_PER_GOLD_IN_MARKET } from '~/shared/data/constant';
import type { FuncAction } from '~/shared/types';
import type { BuyerMarketTradeInfo, ListToBuyerMarketInfo } from '~/shared/types/buyerMarket';
import { allCharacterEquipmentPart } from '~/shared/types/characterInfo';
import type { AllGameActionID } from '~/shared/types/gameAction';
import { type AllGameResourceID, type AllGameResourceIDWithInternal, type GameResource, GameResourceCategory } from '~/shared/types/gameResource';
import type { BuyFromMarketInfo, ListToMarketInfo, MarketPriceData, MarketTradeInfo, UnifiedMarketRow } from '~/shared/types/market';
import { formatCountToStr, formatTime, ObjectKeys } from '~/shared/utils';
import { getMarketListingExpansionRequirement } from '~/shared/utils/marketListingExpansion';
import { MARKET_BASE_SELLER, MARKET_LISTING_EXPANSION_SCHEMES, MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE, type MarketListingExpansionSchemeId, getMarketSchemeLimitMessage } from '~/shared/data/marketSlotConstants';
import { ElMessage } from 'element-plus';
import { parseEquimentPartToString } from '~/shared/utils/game/equipment';
import enhanceInfo from '~/assets/resource/enhanceInfo.json'
import type { TabPaneName, TabsPaneContext } from 'element-plus';
import PY from 'pinyin-match'
import { useRoute, useRouter } from 'vue-router'

const allTradeableResourceList = ref<string[]>([]);
const currentSelectedResourceId = ref<AllGameResourceIDWithInternal>()
const currentSelectedEnhanceChainTab = ref<string>("")
const transactionHistoryActiveTab = ref("sell");

const route = useRoute()
const router = useRouter()

const props = defineProps<{
    selectedResourceId?: AllGameResourceIDWithInternal
}>();

const { user } = useUserSession()
// @ts-ignore
const currentUserUuid = computed(() => user.value?.uuid ?? "")

const isIronCat = computed(() => {
    return user.value?.isIronCat 
})

const sellerMarketListButtonDisable = ref(false);
const showSellerMarketListDialog = ref(false);
const sellerMarketListToMarketInfo = ref<ListToMarketInfo>({
    sellResourceId: "",
    sellResourceCount: 1,
    costResourceId: "gold",
    costPerUnit: 1
});
const sellerMarketMaxSellCount = computed(() => {
    if (!sellerMarketListToMarketInfo.value) {
        return 0
    }
    return inventory.value[sellerMarketListToMarketInfo.value.sellResourceId]?.count ?? 0
})

const handleSellerMarketCostPerUnitChange = () => {
    sellerMarketListToMarketInfo.value.costPerUnit = adjustToMarketPriceStep(sellerMarketListToMarketInfo.value.costPerUnit);
}
const handleSellerMarketCostPerUnitDivideByTwo = () => {
    sellerMarketListToMarketInfo.value.costPerUnit = adjustToMarketPriceStep(sellerMarketListToMarketInfo.value.costPerUnit / 2);
}
const handleSellerMarketCostPerUnitPlus = () => {
    let step = getMarketPriceStep(sellerMarketListToMarketInfo.value.costPerUnit ?? 1);
    sellerMarketListToMarketInfo.value.costPerUnit += step
    sellerMarketListToMarketInfo.value.costPerUnit = adjustToMarketPriceStep(sellerMarketListToMarketInfo.value.costPerUnit);
}
const handleSellerMarketCostPerUnitMinus = () => {
    let step = getMarketPriceStep(sellerMarketListToMarketInfo.value.costPerUnit ?? 1);
    sellerMarketListToMarketInfo.value.costPerUnit -= step
    sellerMarketListToMarketInfo.value.costPerUnit = adjustToMarketPriceStep(sellerMarketListToMarketInfo.value.costPerUnit);
}
const handleSellerMarketCostPerUnitMultiplyByTwo = () => {
    sellerMarketListToMarketInfo.value.costPerUnit *= 2;
    sellerMarketListToMarketInfo.value.costPerUnit = adjustToMarketPriceStep(sellerMarketListToMarketInfo.value.costPerUnit);
}

const handleBuyerMarketCostPerUnitChange = () => {
    buyerMarketListToBuyerMarketInfo.value.payPerUnit = adjustToMarketPriceStep(buyerMarketListToBuyerMarketInfo.value.payPerUnit);
}
const handleBuyerMarketCostPerUnitDivideByTwo = () => {
    buyerMarketListToBuyerMarketInfo.value.payPerUnit = adjustToMarketPriceStep(buyerMarketListToBuyerMarketInfo.value.payPerUnit / 2);
}
const handleBuyerMarketCostPerUnitPlus = () => {
    let step = getMarketPriceStep(buyerMarketListToBuyerMarketInfo.value.payPerUnit ?? 1);
    buyerMarketListToBuyerMarketInfo.value.payPerUnit += step
    buyerMarketListToBuyerMarketInfo.value.payPerUnit = adjustToMarketPriceStep(buyerMarketListToBuyerMarketInfo.value.payPerUnit);
}
const handleBuyerMarketCostPerUnitMinus = () => {
    let step = getMarketPriceStep(buyerMarketListToBuyerMarketInfo.value.payPerUnit ?? 1);
    buyerMarketListToBuyerMarketInfo.value.payPerUnit -= step
    buyerMarketListToBuyerMarketInfo.value.payPerUnit = adjustToMarketPriceStep(buyerMarketListToBuyerMarketInfo.value.payPerUnit);
}
const handleBuyerMarketCostPerUnitMultiplyByTwo = () => {
    buyerMarketListToBuyerMarketInfo.value.payPerUnit *= 2;
    buyerMarketListToBuyerMarketInfo.value.payPerUnit = adjustToMarketPriceStep(buyerMarketListToBuyerMarketInfo.value.payPerUnit);
}


const handleListToSellerMarket = (e: Event) => {
    if (!e.isTrusted) return;
    if (sellerMarketListButtonDisable.value) return;

    let minSellPrice = getMarketMinSellAndMaxBuyPrice(sellerMarketListToMarketInfo.value.sellResourceId).minSellPrice;
    if (!!minSellPrice) {
        // 检查价格是否符合档位标准
        const price = sellerMarketListToMarketInfo.value.costPerUnit;
        // console.log(price, adjustToMarketPriceStep(price))
        if (price !== adjustToMarketPriceStep(price)) {
            ElMessage.error(`单价未对齐市场档位，请刷新后重试`)
            return;
        }
    }

    sellerMarketListButtonDisable.value = true;

    emitListToMarket(sellerMarketListToMarketInfo.value)
}
const triggerListToSellerMarket = () => {
    if (!currentSelectedResourceId.value) return;
    showSellerMarketListDialog.value = true;

    const { minSellPrice } = getMarketMinSellAndMaxBuyPrice(currentSelectedResourceId.value);
    // 计算当前档位步长
    const step = getMarketPriceStep(minSellPrice ?? 1);
    // 默认价格为市场最低价减去一个档位步长，且不低于1
    let defaultPrice = (minSellPrice ?? step) - step;
    if (defaultPrice < 1) defaultPrice = 1;
    // 修正为合法档位价
    defaultPrice = adjustToMarketPriceStep(defaultPrice);

    sellerMarketListToMarketInfo.value = {
        sellResourceId: currentSelectedResourceId.value,
        sellResourceCount: 1,
        costResourceId: "gold",
        costPerUnit: defaultPrice
    };
}
const triggerBuyFromSellerMarket = (item: MarketTradeInfo) => {
    if (!item) return;
    showSellerMarketBuyDialog.value = true;
    sellerMarketBuyingItem.value = item;
    sellerMarketBuyFromMarketInfo.value = {
        tradeUuid: item.tradeUuid,
        buyCount: 1,
    };
}
const sellerMarketListingFee = computed(() => {
    if (!sellerMarketListToMarketInfo.value) return 0;
    let fee = Math.ceil(sellerMarketListToMarketInfo.value.sellResourceCount * sellerMarketListToMarketInfo.value.costPerUnit * SELLER_MARKET_FEE);

    fee = Math.max(fee, MIN_LISTING_FEE)

    if (sellerMarketListToMarketInfo.value.costPerUnit == 1) {
        fee = 0
    }

    return fee
});

const showSellerMarketBuyDialog = ref(false);
const sellerMarketBuyButtonDisabled = ref(false);
const sellerMarketBuyingItem = ref<MarketTradeInfo | null>(null);
const sellerMarketBuyFromMarketInfo = ref<Omit<BuyFromMarketInfo, "buyerUuid">>({
    tradeUuid: "",
    buyCount: 1,
});
const sellerMarketMaxBuyCount = computed(() => {
    if (!sellerMarketBuyingItem.value) {
        return 0
    }
    let max = Infinity
    const cost = sellerMarketBuyingItem.value.costResourceId ?? 'gold'
    const inventoryCount = inventory.value[cost]?.count ?? 0
    max = Math.min(max, Math.floor(inventoryCount / sellerMarketBuyingItem.value.costPerUnit))
    return Math.min(Math.max(0, max), sellerMarketBuyingItem.value.sellResourceCount - sellerMarketBuyingItem.value.selledResourceCount)
})
const confirmBuyFromSellerMarket = (e: Event) => {
    if (!e.isTrusted) return;
    if (sellerMarketBuyButtonDisabled.value) return;
    sellerMarketBuyButtonDisabled.value = true;

    emitBuyFromMarket(sellerMarketBuyFromMarketInfo.value)
}
const triggerListToBuyerMarket = () => {
    if (!currentSelectedResourceId.value) return;
    showBuyerMarketListDialog.value = true;

    const { maxBuyPrice } = getMarketMinSellAndMaxBuyPrice(currentSelectedResourceId.value);
    // 计算当前档位步长
    const step = getMarketPriceStep(maxBuyPrice ?? 1);
    // 默认价格为市场最高求购价加上一个档位步长，且不低于1
    let defaultPrice = (maxBuyPrice ?? step) + step;
    if (defaultPrice < 1) defaultPrice = 1;
    // 修正为合法档位价
    defaultPrice = adjustToMarketPriceStep(defaultPrice);

    buyerMarketListToBuyerMarketInfo.value = {
        requireResourceId: currentSelectedResourceId.value,
        requireResourceCount: 1,
        payResourceId: "gold",
        payPerUnit: defaultPrice
    };
}



const showBuyerMarketListDialog = ref(false);
const buyerMarketListButtonDisable = ref(false)
const buyerMarketListToBuyerMarketInfo = ref<ListToBuyerMarketInfo>({
    requireResourceId: "",
    requireResourceCount: 1,
    payResourceId: "gold",
    payPerUnit: 1
});
const handleListToBuyerMarket = (e: Event) => {
    if (!e.isTrusted) return;
    if (buyerMarketListButtonDisable.value) return;

    let maxBuyPrice = getMarketMinSellAndMaxBuyPrice(buyerMarketListToBuyerMarketInfo.value.requireResourceId).maxBuyPrice;

    // 检查价格是否符合档位标准
    if (!!maxBuyPrice) {
        const price = buyerMarketListToBuyerMarketInfo.value.payPerUnit;
        if (price !== adjustToMarketPriceStep(price)) {
            ElMessage.error(`单价未对齐市场档位，请刷新后重试`)
            return;
        }
    }

    buyerMarketListButtonDisable.value = true;

    emitListToBuyerMarket(buyerMarketListToBuyerMarketInfo.value)
}
const triggerSellToBuyerMarket = (item: BuyerMarketTradeInfo) => {
    if (!item) return;
    showBuyerMarketSellDialog.value = true;
    buyerMarketSellingItem.value = item;
    buyerMarketSellCount.value = 1;
}


const buyerMarketSellButtonDisabled = ref(false)
const showBuyerMarketSellDialog = ref(false);
const buyerMarketSellingItem = ref<BuyerMarketTradeInfo | null>(null);
const buyerMarketSellCount = ref(1);
const buyerMarketMaxSellCount = computed(() => {
    if (!buyerMarketSellingItem.value) return 0;
    const remain = (buyerMarketSellingItem.value.requireResourceCount ?? 0) - (buyerMarketSellingItem.value.doneResourceCount ?? 0);
    const inventoryCount = inventory.value[buyerMarketSellingItem.value.requireResourceId]?.count ?? 0;
    return Math.min(remain, inventoryCount);
});

const buyerMarketFee = computed(() => {
    if (buyerMarketListToBuyerMarketInfo.value.payResourceId != 'gold') {
        return 0
    }


    if (!buyerMarketListToBuyerMarketInfo.value) return 0;
    let fee = Math.ceil(buyerMarketListToBuyerMarketInfo.value.requireResourceCount * buyerMarketListToBuyerMarketInfo.value.payPerUnit * BUYER_MARKET_FEE);

    fee = Math.max(fee, MIN_LISTING_FEE)

    if (buyerMarketListToBuyerMarketInfo.value.payPerUnit == 1) {
        fee = 0
    }

    return fee
});

const showRemoveBuyerMarketDialog = ref(false);
const pendingRemoveBuyerTrade = ref<BuyerMarketTradeInfo | null>(null);
const removeBuyerLoading = ref(false);
const pendingRemoveBuyerRemain = computed(() => {
    if (!pendingRemoveBuyerTrade.value) return 0;
    const t = pendingRemoveBuyerTrade.value;
    return (t.requireResourceCount ?? 0) - (t.doneResourceCount ?? 0);
});

const showRemoveSellerMarketDialog = ref(false);
const pendingRemoveSellerTrade = ref<MarketTradeInfo | null>(null);
const removeSellerLoading = ref(false);
const pendingRemoveSellerRemain = computed(() => {
    if (!pendingRemoveSellerTrade.value) return 0;
    const t = pendingRemoveSellerTrade.value;
    return (t.sellResourceCount ?? 0) - (t.selledResourceCount ?? 0);
});

const buyerMarketConfirmSell = (e: Event) => {
    if (!e.isTrusted) return;
    if (buyerMarketSellButtonDisabled.value || !buyerMarketSellingItem.value) return;
    buyerMarketSellButtonDisabled.value = true;

    emitSellToBuyerMarket({
        tradeUuid: buyerMarketSellingItem.value.tradeUuid,
        sellCount: buyerMarketSellCount.value,
    });
}


function confirmRemoveFromBuyerMarket(e: Event, tradeInfo: BuyerMarketTradeInfo) {
    if (!e.isTrusted) return;
        pendingRemoveBuyerTrade.value = tradeInfo;
        showRemoveBuyerMarketDialog.value = true;
        removeBuyerLoading.value = false;
}

function confirmRemoveFromSellerMarket(e: Event, tradeInfo: MarketTradeInfo) {
    if (!e.isTrusted) return;
        pendingRemoveSellerTrade.value = tradeInfo;
        showRemoveSellerMarketDialog.value = true;
        removeSellerLoading.value = false;
}

const handleConfirmRemoveBuyerMarket = () => {
        if (!pendingRemoveBuyerTrade.value) return;
        removeBuyerLoading.value = true;
        emitRemoveFromBuyerMarket(pendingRemoveBuyerTrade.value.tradeUuid);
        setTimeout(() => {
                if (currentSelectedResourceId.value) {
                        emitGetUnifiedTransactionList(currentSelectedResourceId.value);
                }
                fetchTransactionHistory();
                showRemoveBuyerMarketDialog.value = false;
                pendingRemoveBuyerTrade.value = null;
                removeBuyerLoading.value = false;
        }, 500);
};

const handleCancelRemoveBuyerMarket = () => {
        showRemoveBuyerMarketDialog.value = false;
        pendingRemoveBuyerTrade.value = null;
        removeBuyerLoading.value = false;
};

const handleConfirmRemoveSellerMarket = () => {
        if (!pendingRemoveSellerTrade.value) return;
        removeSellerLoading.value = true;
        emitRemoveFromMarket(pendingRemoveSellerTrade.value.tradeUuid);
        setTimeout(() => {
                if (currentSelectedResourceId.value) {
                        emitGetUnifiedTransactionList(currentSelectedResourceId.value);
                }
                fetchTransactionHistory();
                showRemoveSellerMarketDialog.value = false;
                pendingRemoveSellerTrade.value = null;
                removeSellerLoading.value = false;
        }, 500);
};

const handleCancelRemoveSellerMarket = () => {
        showRemoveSellerMarketDialog.value = false;
        pendingRemoveSellerTrade.value = null;
        removeSellerLoading.value = false;
};

const refreshBtnDisabled = ref(false);
const triggerRefresh = () => {
    if (refreshBtnDisabled.value) return;
    refreshBtnDisabled.value = true;

    emitGetUnifiedTransactionList(currentSelectedResourceId.value || "");

    setTimeout(() => {
        refreshBtnDisabled.value = false;
    }, 2000);
}



const currentSelectedMainTab = ref("index");
const transactionList = ref<UnifiedMarketRow[] | undefined>([])
const inventory = useInventory()
const activeCategory = ref<'all' | 'usable' | 'workEquipment' | 'battleEquipment' | GameResourceCategory>('all');

const sellerMarketInfo = computed(() => {
    return (transactionList ?? []).value?.filter((transaction) => {
        return transaction.type === 'sell'
    });
})
const buyerMarketInfo = computed(() => {
    return (transactionList.value ?? []).filter((transaction) => {
        return transaction.type === 'buy'
    });
})

const mobileMarketActiveTab = ref<'seller' | 'buyer'>('seller');

const enhanceMap: {[key in AllGameResourceID]: AllGameActionID[]} = {};
Object.keys(enhanceInfo).forEach(key => {
  const base = key.split('+')[0];
  if (!enhanceMap[base]) enhanceMap[base] = [];
  enhanceMap[base].push(key);
});
// 2. 对每个链条按等级排序，并补全最后一次强化的结果
Object.keys(enhanceMap).forEach(base => {
  // 排序：基础在前，+1、+2...依次递增
  enhanceMap[base].sort((a, b) => {
    const getLevel = (id: string) => {
      const match = id.match(/\+(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    };
    return getLevel(a) - getLevel(b);
  });

  // 检查最后一级是否有 enhanceSuccessTo 指向的下一级，如果有且未在链表中，则补全
  let lastId = enhanceMap[base][enhanceMap[base].length - 1];

  // @ts-ignore
  while (enhanceInfo[lastId]?.enhanceSuccessTo && !enhanceMap[base].includes(enhanceInfo[lastId].enhanceSuccessTo)) {
  // @ts-ignore
    enhanceMap[base].push(enhanceInfo[lastId].enhanceSuccessTo);
    // @ts-ignore
    lastId = enhanceInfo[lastId].enhanceSuccessTo;
  }
});

const isBaseEnhancableResource = (resourceId: AllGameResourceID) => {
    return Object.keys(enhanceMap).some(key => {
        return resourceId == key
    });
}
const isEnhancedResource = (resourceId: AllGameResourceID) => {
    return resourceId.includes('+')
}

const renderResourceDropdown = ref<{[key in AllGameResourceID]?: boolean}>({});
const onHover = (visible: boolean, resourceId: AllGameResourceID) => {
    renderResourceDropdown.value[resourceId] = visible;
}

const getCategoryName = (category: GameResourceCategory | 'all' | 'mine') => {
    if (category === 'all') return '全部物品';
    if (category === 'mine') return '我的物品';
    return allGameResourceCategoryInfo[category]?.name || category;
}
const categoryGroupedResources = computed(() => {
    const groups: {[key in (GameResourceCategory | 'all' | 'mine')]?: AllGameActionID[]} = {}
    for (const resourceId of filteredResourceList.value) {
        const resource = allGameResource[resourceId];
        if (Array.isArray(resource.category)) {
            for (const cat of resource.category) {
                if (!groups[cat]) groups[cat] = []
                groups[cat].push(resourceId)
            }
        }
    }
    // 返回有序数组
    return ObjectKeys<(GameResourceCategory | 'all' | 'mine')>(allGameResourceCategoryInfo)
        .filter(cat => groups[cat] && groups[cat].length)
        .map(cat => ({
            category: cat,
            resources: groups[cat]
        }))
})

const equipmentPartGroupedResources = computed(() => {
    const groups: Record<string, AllGameActionID[]> = {}
    for (const resourceId of filteredResourceList.value) {
        const resource = allGameResource[resourceId];
        const part = resource.equipPart || 'other'
        if (!groups[part]) groups[part] = []
        groups[part].push(resourceId)
    }
    // 返回有序数组
    return allCharacterEquipmentPart
        .filter(part => groups[part] && groups[part].length)
        .map(part => ({
            part,
            resources: groups[part]
        }))
})

const searchQuery = ref("");
const onlyShowHasTransaction = ref(false)
const filteredResourceList = computed(() => {
    let allResourceId = Object.keys(allGameResource)

    if (onlyShowHasTransaction.value) {
        allResourceId = allTradeableResourceList.value
    }

    allResourceId = allResourceId.filter(id => {
        const resource = allGameResource[id];

        if (!resource) {
            return false;
        }

        if (resource.hideInMarket) {
            return false;
        }

        if (!!searchQuery.value) {
            const searchLower = searchQuery.value.toLowerCase();

            let pyMatchRes = PY.match(resource.name, searchLower)

            return !!pyMatchRes || (resource?.name || "").toLowerCase().includes(searchLower)
        }

        return resource && !resource.isInternal && resource.id !== 'gold' && resource.id !== 'catnip';
    });

    if (activeCategory.value === 'all') {
        allResourceId = allResourceId.filter(id => !BANNED_RESOURCE_IN_MARKET.includes(id as AllGameResourceIDWithInternal));
    } else if (activeCategory.value === 'usable') {
        allResourceId = allResourceId.filter(id => {
            const resource = allGameResource[id];
            return resource.onUse && resource.onUse.length > 0 && !BANNED_RESOURCE_IN_MARKET.includes(id as AllGameResourceIDWithInternal);
        });
    } else if (activeCategory.value === 'workEquipment') {
        allResourceId = allResourceId.filter(id => {
            const resource = allGameResource[id];
            return resource.equipmentType?.includes('work')
        });
    } else if (activeCategory.value === 'battleEquipment') {
        allResourceId = allResourceId.filter(id => {
            const resource = allGameResource[id];
            return resource.equipmentType?.includes('battle')
        });
    } else {
        allResourceId = allResourceId.filter(id => {
            const resource = allGameResource[id];
            return Array.isArray(resource?.category ?? []) && (resource?.category ?? []).includes(activeCategory.value as GameResourceCategory) && !BANNED_RESOURCE_IN_MARKET.includes(id as AllGameResourceIDWithInternal);
        });
    }

    return allResourceId
});

const transactionHistory = ref<UnifiedMarketRow[]>([]);
const historyTotals = reactive({ sell: 0, buy: 0, all: 0 });
const historyUsage = reactive({ sell: 0, buy: 0 });
const historyPage = reactive({ sell: 1, buy: 1 });
const transactionHistoryPageSize = ref(50);
const transactionHistoryLoading = ref(false);

const sellHistory = computed(() => transactionHistory.value.filter((t) => t.type === 'sell'));
const buyHistory = computed(() => transactionHistory.value.filter((t) => t.type === 'buy'));

// --- Sell table filters and summary ---
const sellResourceFilters = computed(() => {
    const ids = Array.from(new Set(sellHistory.value.map(r => r.sellResourceId))).filter(Boolean) as string[];
    return ids.map(id => ({ text: getResourceName(id as AllGameResourceIDWithInternal), value: id }));
});

const sellStatusFilters = [
    { text: '进行中', value: 'open' },
    { text: '已关闭', value: 'closed' }
];

const noopFilter = () => true;

const sellTableSortProp = ref<string | null>('createTime');
const sellTableSortOrder = ref<'ascending' | 'descending' | null>('descending');
const sellFilters = reactive({ resourceId: undefined as string | undefined, resourceIds: undefined as string[] | undefined, status: undefined as 'open' | 'closed' | undefined });
function onSellFilterChange(filters: Record<string, any[]>) {
    sellFilters.resourceIds = Array.isArray(filters.sellResourceId) && filters.sellResourceId.length
        ? filters.sellResourceId as string[]
        : undefined;
    sellFilters.resourceId = sellFilters.resourceIds?.[0];
    sellFilters.status = (filters.sellStatus?.[0] === 'open'
        ? 'open'
        : filters.sellStatus?.[0] === 'closed'
            ? 'closed'
            : undefined);
    historyPage.sell = 1;
    fetchTransactionHistory(1);
}

function onSellTableSortChange({ column, prop, order }: { column: any, prop: string | null, order: string | null }) {
    sellTableSortProp.value = prop ?? null;
    sellTableSortOrder.value = (order as any) ?? null;
    historyPage.sell = 1;
    fetchTransactionHistory(1);
}

const sellHistorySorted = computed(() => sellHistory.value);

// sellSummary removed — we no longer show aggregate row/header summary

// --- Buy table filters and client-side sorting (mirror of sell table) ---
const buyResourceFilters = computed(() => {
    const ids = Array.from(new Set(buyHistory.value.map(r => r.requireResourceId))).filter(Boolean) as string[];
    return ids.map(id => ({ text: getResourceName(id as AllGameResourceIDWithInternal), value: id }));
});

const buyStatusFilters = [
    { text: '进行中', value: 'open' },
    { text: '已关闭', value: 'closed' }
];

const buyTableSortProp = ref<string | null>('createTime');
const buyTableSortOrder = ref<'ascending' | 'descending' | null>('descending');
const buyFilters = reactive({ resourceId: undefined as string | undefined, resourceIds: undefined as string[] | undefined, status: undefined as 'open' | 'closed' | undefined });
function onBuyFilterChange(filters: Record<string, any[]>) {
    buyFilters.resourceIds = Array.isArray(filters.buyResourceId) && filters.buyResourceId.length
        ? filters.buyResourceId as string[]
        : undefined;
    buyFilters.resourceId = buyFilters.resourceIds?.[0];
    buyFilters.status = (filters.buyStatus?.[0] === 'open'
        ? 'open'
        : filters.buyStatus?.[0] === 'closed'
            ? 'closed'
            : undefined);
    historyPage.buy = 1;
    fetchTransactionHistory(1);
}

function onBuyTableSortChange({ column, prop, order }: { column: any, prop: string | null, order: string | null }) {
    buyTableSortProp.value = prop ?? null;
    buyTableSortOrder.value = (order as any) ?? null;
    historyPage.buy = 1;
    fetchTransactionHistory(1);
}

const buyHistorySorted = computed(() => buyHistory.value);

// sellHistoryDisplay removed: we render the summary in header slots and use sellHistorySorted as table data

let priceData = ref<MarketPriceData>();

let off1: FuncAction;
let off2: FuncAction;
let off3: FuncAction;
let off4: FuncAction;

let off5: FuncAction;
let off6: FuncAction;
let off7: FuncAction;
let off8: FuncAction;

let off9: FuncAction;
let off10: FuncAction;
let off11: FuncAction;
let off12: FuncAction;
let off13: FuncAction;
let off14: FuncAction;
onMounted(async () => {
    await waitUtilConnected()

    emitGetUnifiedTradeableResourceList()
    off1 = onGetUnifiedTradeableResourceList((res) => {
        allTradeableResourceList.value = res;
    });

    off2 = onGetUnifiedTransactionList((res) => {
        if (res[0]?.type === 'buy' && res[0]?.requireResourceId !== currentSelectedResourceId.value) {
            return;
        }

        if (res[0]?.type === 'sell' && res[0]?.sellResourceId !== currentSelectedResourceId.value) {
            return;
        }

        transactionList.value = res;
    });

    off3 = onListToMarketSuccess(() => {
        showSellerMarketListDialog.value = false;
        sellerMarketListButtonDisable.value = false;
        sellerMarketListToMarketInfo.value = {
            sellResourceId: "",
            sellResourceCount: 1,
            costResourceId: "gold",
            costPerUnit: 1
        };

        if (currentSelectedResourceId.value) {
            emitGetUnifiedTransactionList(currentSelectedResourceId.value);
        }
    });

    off4 = onBuyFromMarketSuccess(() => {
        showSellerMarketBuyDialog.value = false;
        sellerMarketBuyButtonDisabled.value = false;
        sellerMarketBuyingItem.value = null;
        sellerMarketBuyFromMarketInfo.value = {
            tradeUuid: "",
            buyCount: 1,
        };

        if (currentSelectedResourceId.value) {
            emitGetUnifiedTransactionList(currentSelectedResourceId.value);
        }
    })

    off9 = onListToMarketError(() => {
        sellerMarketListButtonDisable.value = false;
    });

    off10 = onBuyFromMarketError(() => {
        sellerMarketBuyButtonDisabled.value = false;
    });

    off5 = onListToBuyerMarketSuccess(() => {
        showBuyerMarketListDialog.value = false;
        buyerMarketListButtonDisable.value = false;
        buyerMarketListToBuyerMarketInfo.value = {
            requireResourceId: "",
            requireResourceCount: 1,
            payResourceId: "gold",
            payPerUnit: 1
        };

        if (currentSelectedResourceId.value) {
            emitGetUnifiedTransactionList(currentSelectedResourceId.value);
        }
    });

    off6 = onSellToBuyerMarketSuccess(() => {
        showBuyerMarketSellDialog.value = false;
        buyerMarketSellButtonDisabled.value = false;
        buyerMarketSellingItem.value = null;
        buyerMarketSellCount.value = 1;

        if (currentSelectedResourceId.value) {
            emitGetUnifiedTransactionList(currentSelectedResourceId.value);
        }
    });

    off7 = onListToBuyerMarketError(() => {
        buyerMarketListButtonDisable.value = false;
    })
    off8 = onSellToBuyerMarketError(() => {
        buyerMarketSellButtonDisabled.value = false;
    })

    off11 = onGetUnifiedTransactionHistory((res) => {
        transactionHistory.value = res.items ?? [];
        historyTotals.all = res.total ?? 0;
        if (res.type === 'sell') {
            historyTotals.sell = res.total ?? res.totalSell ?? 0;
        } else if (res.type === 'buy') {
            historyTotals.buy = res.total ?? res.totalBuy ?? 0;
        } else {
            historyTotals.sell = res.totalSell ?? historyTotals.sell;
            historyTotals.buy = res.totalBuy ?? historyTotals.buy;
        }
        historyUsage.sell = res.openSellCount ?? 0;
        historyUsage.buy = res.openBuyCount ?? 0;
        if (res.type === 'buy') {
            historyPage.buy = res.page ?? historyPage.buy;
        } else if (res.type === 'sell') {
            historyPage.sell = res.page ?? historyPage.sell;
        }
        transactionHistoryPageSize.value = res.pageSize ?? transactionHistoryPageSize.value;
        transactionHistoryLoading.value = false;
    });
    off12 = onGetUnifiedTransactionHistoryError((e) => {
        ElMessage.error(e.message || "获取可交易资源列表失败，请稍后重试。");
    });

    off13 = onGetMarketPriceDataSuccess((res) => {
        if (res.resourceId === currentSelectedResourceId.value) {
            priceData.value = res.data;
        }
    });
});

watch(() => props.selectedResourceId, (val) => {
    if (!val) return;
    toResourceMarketDetail(val);
    const newQuery = { ...route.query } as Record<string, any>
    delete newQuery.marketResource
    router.replace({ query: newQuery })
}, { immediate: true });

watch(() => currentSelectedResourceId.value, (newValue) => {
    transactionList.value = undefined
    if (newValue) {
        emitGetUnifiedTransactionList(newValue);
        currentSelectedMainTab.value = 'market'
        // Optionally, you can fetch more details about the selected resource here
        emitGetMarketPriceData(newValue);
    }
});

watch(() => currentSelectedMainTab.value, (newValue) => {
    if (newValue === 'history') {
        fetchTransactionHistory();
    }
});

function fetchTransactionHistory(page?: number) {
    transactionHistoryLoading.value = true;
    if (typeof page === 'number') {
        historyPage[transactionHistoryActiveTab.value === 'buy' ? 'buy' : 'sell'] = page;
    }
    const isBuy = transactionHistoryActiveTab.value === 'buy';
    emitGetUnifiedTransactionHistory({
        page: historyPage[isBuy ? 'buy' : 'sell'],
        pageSize: transactionHistoryPageSize.value,
        type: isBuy ? 'buy' : 'sell',
        status: isBuy ? buyFilters.status : sellFilters.status,
        resourceId: isBuy ? buyFilters.resourceId : sellFilters.resourceId,
        resourceIds: isBuy ? buyFilters.resourceIds : sellFilters.resourceIds,
        sortBy: isBuy ? buyTableSortProp.value ?? undefined : sellTableSortProp.value ?? undefined,
        sortOrder: (() => {
            const order = isBuy ? buyTableSortOrder.value : sellTableSortOrder.value;
            if (order === 'ascending') return 'asc';
            if (order === 'descending') return 'desc';
            return undefined;
        })(),
    });
}

const onTransactionHistoryTabChange = () => {
    historyPage.sell = 1;
    historyPage.buy = 1;
    fetchTransactionHistory(1);
}

const getResourceName = (resourceId: AllGameResourceIDWithInternal) => {
    return allGameResourceWithInternal[resourceId]?.name || resourceId;
}

// --- market listing limits and expansion UI state ---
const listingLimits = ref<any>(null);
const expandLoading = ref(false);
const selectedSellerScheme = ref(MARKET_LISTING_EXPANSION_SCHEMES[0]?.id ?? 'schemeA');
const selectedBuyerScheme = ref(MARKET_LISTING_EXPANSION_SCHEMES[0]?.id ?? 'schemeA');

const showExpandSellerDialog = ref(false);
const showExpandBuyerDialog = ref(false);

// popover visible flags (scheme selection dialogs)
const sellerExpandPopoverVisible = ref(false);
const buyerExpandPopoverVisible = ref(false);

// computed next requirement previews
const sellerNextReq = computed(() => {
    const done = listingLimits.value?.extraSeller ?? 0;
    const usage = listingLimits.value?.schemeUsageSeller ? (listingLimits.value.schemeUsageSeller[selectedSellerScheme.value ?? 'schemeA'] ?? 0) : (listingLimits.value?.schemeUsage ? (listingLimits.value.schemeUsage[selectedSellerScheme.value ?? 'schemeA'] ?? 0) : undefined);
    return getMarketListingExpansionRequirement(done, 'seller', selectedSellerScheme.value as any, usage as any);
});
const buyerNextReq = computed(() => {
    const done = listingLimits.value?.extraBuyer ?? 0;
    const usage = listingLimits.value?.schemeUsageBuyer ? (listingLimits.value.schemeUsageBuyer[selectedBuyerScheme.value ?? 'schemeA'] ?? 0) : (listingLimits.value?.schemeUsage ? (listingLimits.value.schemeUsage[selectedBuyerScheme.value ?? 'schemeA'] ?? 0) : undefined);
    return getMarketListingExpansionRequirement(done, 'buyer', selectedBuyerScheme.value as any, usage as any);
});

const expandSellerRequirements = computed(() => sellerNextReq.value ?? []);
const expandBuyerRequirements = computed(() => buyerNextReq.value ?? []);
const sellerExpandPreview = computed(() => {
    const current = listingLimits.value?.maxSellerTransactions ?? 0;
    return { current, next: current + 1 };
});
const buyerExpandPreview = computed(() => {
    const current = listingLimits.value?.maxBuyerTransactions ?? 0;
    return { current, next: current + 1 };
});

const sellerExpansionsDone = computed(() => listingLimits.value?.extraSeller ?? 0);
const buyerExpansionsDone = computed(() => listingLimits.value?.extraBuyer ?? 0);

function isMarketSchemeAllowed(id: string | undefined, role: 'seller' | 'buyer') {
    if (!id) return false;
    // prefer server-provided allowed lists
    if (listingLimits.value) {
        if (role === 'seller' && Array.isArray(listingLimits.value.allowedSellerSchemes)) {
            return listingLimits.value.allowedSellerSchemes.includes(id);
        }
        if (role === 'buyer' && Array.isArray(listingLimits.value.allowedBuyerSchemes)) {
            return listingLimits.value.allowedBuyerSchemes.includes(id);
        }
    }
    const cap = MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE[id as MarketListingExpansionSchemeId];
    if (cap === 'infinity') return true;
    const done = role === 'seller' ? sellerExpansionsDone.value : buyerExpansionsDone.value;
    return done < (cap as number);
}

function getMarketSchemeCapLabel(id: string | undefined) {
    if (!id) return '';
    if (listingLimits.value) {
        const sellerAllowed = Array.isArray(listingLimits.value.allowedSellerSchemes) ? listingLimits.value.allowedSellerSchemes.includes(id) : undefined;
        const buyerAllowed = Array.isArray(listingLimits.value.allowedBuyerSchemes) ? listingLimits.value.allowedBuyerSchemes.includes(id) : undefined;
        if (sellerAllowed === false || buyerAllowed === false) return '该方案当前不可用';
    }
    const cap = MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE[id as MarketListingExpansionSchemeId];
    if (cap === 'infinity') return '';
    return `总共可用 ${cap} 次`;
}

function getMarketSchemeShortHint(id: string | undefined, role: 'seller' | 'buyer') {
    if (!id) return '';
    if (listingLimits.value) {
        // Only show server-provided per-scheme message when scheme is actually disallowed/exhausted.
        const msg = listingLimits.value.schemeLimitMessage?.[id as string];
        const sellerAllowed = Array.isArray(listingLimits.value.allowedSellerSchemes)
            ? listingLimits.value.allowedSellerSchemes.includes(id)
            : undefined;
        const buyerAllowed = Array.isArray(listingLimits.value.allowedBuyerSchemes)
            ? listingLimits.value.allowedBuyerSchemes.includes(id)
            : undefined;
        // compute remaining for this role if server provided
        let rem: number | 'infinity' | undefined = undefined;
        if (role === 'seller' && listingLimits.value.schemeRemainingSeller && listingLimits.value.schemeRemainingSeller[id as string] !== undefined) {
            rem = listingLimits.value.schemeRemainingSeller[id as string];
        } else if (role === 'buyer' && listingLimits.value.schemeRemainingBuyer && listingLimits.value.schemeRemainingBuyer[id as string] !== undefined) {
            rem = listingLimits.value.schemeRemainingBuyer[id as string];
        } else if (listingLimits.value.schemeRemaining && listingLimits.value.schemeRemaining[id as string] !== undefined) {
            rem = listingLimits.value.schemeRemaining[id as string];
        }
        // if server message exists and the scheme is NOT allowed (explicit) or remaining is 0, surface it
        if (msg && ((role === 'seller' && sellerAllowed === false) || (role === 'buyer' && buyerAllowed === false) || (rem !== undefined && rem !== 'infinity' && Number(rem) <= 0))) {
            return msg;
        }
        // if server explicitly disallows this role, fall back to configured helper message
        if (role === 'seller' && sellerAllowed === false) {
            return getMarketSchemeLimitMessage(id as any) || '该方案当前不可用';
        }
        if (role === 'buyer' && buyerAllowed === false) {
            return getMarketSchemeLimitMessage(id as any) || '该方案当前不可用';
        }
    }
    const cap = MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE[id as MarketListingExpansionSchemeId];
    if (cap === 'infinity') return '无限使用';
    return `总共可用 ${cap} 次`;
}

function getMarketSchemeRemainingLabel(id: string | undefined, role: 'seller' | 'buyer') {
    if (!id) return '-';
    // prefer server-provided remaining if available
    if (listingLimits.value) {
        // prefer server-provided per-role remaining if available
        if (role === 'seller' && listingLimits.value.schemeRemainingSeller && listingLimits.value.schemeRemainingSeller[id as string] !== undefined) {
            const rem = listingLimits.value.schemeRemainingSeller[id as string];
            return String(rem === 'infinity' ? '∞' : Math.max(0, Number(rem ?? 0)));
        }
        if (role === 'buyer' && listingLimits.value.schemeRemainingBuyer && listingLimits.value.schemeRemainingBuyer[id as string] !== undefined) {
            const rem = listingLimits.value.schemeRemainingBuyer[id as string];
            return String(rem === 'infinity' ? '∞' : Math.max(0, Number(rem ?? 0)));
        }
        if (listingLimits.value.schemeRemaining && listingLimits.value.schemeRemaining[id as string] !== undefined) {
            const rem = listingLimits.value.schemeRemaining[id as string];
            return String(rem === 'infinity' ? '∞' : Math.max(0, Number(rem ?? 0)));
        }
    }
    if (listingLimits.value) {
        if (role === 'seller' && Array.isArray(listingLimits.value.allowedSellerSchemes) && !listingLimits.value.allowedSellerSchemes.includes(id)) {
            return '0';
        }
        if (role === 'buyer' && Array.isArray(listingLimits.value.allowedBuyerSchemes) && !listingLimits.value.allowedBuyerSchemes.includes(id)) {
            return '0';
        }
    }
    const cap = MARKET_LISTING_EXPANSION_SCHEME_MAX_USABLE[id as MarketListingExpansionSchemeId];
    if (cap === 'infinity') return '∞';
    const done = role === 'seller' ? sellerExpansionsDone.value : buyerExpansionsDone.value;
    const remain = (cap as number) - done;
    return String(Math.max(0, remain));
}

function confirmExpandSeller() {
    if (!isMarketSchemeAllowed(selectedSellerScheme.value, 'seller')) {
        ElMessage.error('所选方案当前不可用，请选择其他方案或先完成前置扩展');
        return;
    }
    sellerExpandPopoverVisible.value = false;
    showExpandSellerDialog.value = true;
}

function confirmExpandBuyer() {
    if (!isMarketSchemeAllowed(selectedBuyerScheme.value, 'buyer')) {
        ElMessage.error('所选方案当前不可用，请选择其他方案或先完成前置扩展');
        return;
    }
    buyerExpandPopoverVisible.value = false;
    showExpandBuyerDialog.value = true;
}

const handleConfirmExpandSeller = () => {
    if (!isMarketSchemeAllowed(selectedSellerScheme.value, 'seller')) {
        ElMessage.error('所选方案当前不可用，请选择其他方案或先完成前置扩展');
        return;
    }
    showExpandSellerDialog.value = false;
    expandLoading.value = true;
    emitExpandSellerListingSlots({ schemeId: selectedSellerScheme.value });
};

const handleConfirmExpandBuyer = () => {
    if (!isMarketSchemeAllowed(selectedBuyerScheme.value, 'buyer')) {
        ElMessage.error('所选方案当前不可用，请选择其他方案或先完成前置扩展');
        return;
    }
    showExpandBuyerDialog.value = false;
    expandLoading.value = true;
    emitExpandBuyerListingSlots({ schemeId: selectedBuyerScheme.value });
};

let offGetListingLimits: (() => void) | undefined;
let offGetListingLimitsError: (() => void) | undefined;
let offExpandSellerSuccess: (() => void) | undefined;
let offExpandSellerError: (() => void) | undefined;
let offExpandBuyerSuccess: (() => void) | undefined;
let offExpandBuyerError: (() => void) | undefined;

onMounted(() => {
    emitGetMarketListingLimits();
    offGetListingLimits = onGetMarketListingLimitsSuccess((data) => {
        listingLimits.value = data;
    });
    offGetListingLimitsError = onGetMarketListingLimitsError((err) => {
        // ignore for now
    });

    offExpandSellerSuccess = onExpandSellerListingSlotsSuccess((data) => {
        listingLimits.value = data;
        expandLoading.value = false;
        ElMessage.success('扩展成功');
    });
    offExpandSellerError = onExpandSellerListingSlotsError((err) => {
        expandLoading.value = false;
        ElMessage.error(err.message || '扩展失败');
    });
    offExpandBuyerSuccess = onExpandBuyerListingSlotsSuccess((data) => {
        listingLimits.value = data;
        expandLoading.value = false;
        ElMessage.success('扩展成功');
    });
    offExpandBuyerError = onExpandBuyerListingSlotsError((err) => {
        expandLoading.value = false;
        ElMessage.error(err.message || '扩展失败');
    });
});

onUnmounted(() => {
    offGetListingLimits && offGetListingLimits();
    offGetListingLimitsError && offGetListingLimitsError();
    offExpandSellerSuccess && offExpandSellerSuccess();
    offExpandSellerError && offExpandSellerError();
    offExpandBuyerSuccess && offExpandBuyerSuccess();
    offExpandBuyerError && offExpandBuyerError();
});

function getEnhanceChain(resourceId: AllGameResourceID): AllGameActionID[] {
  // 1. 获取基础物品ID（移除 +数字 后缀）
  const baseId = resourceId.split('+')[0] as AllGameResourceID;
  
  // 2. 构建强化链
  const enhanceChain: AllGameActionID[] = [];
  
  // 3. 收集所有相关的强化等级
  Object.keys(enhanceInfo).forEach(key => {
    const currentBaseId = key.split('+')[0];
    if (currentBaseId === baseId) {
      enhanceChain.push(key as AllGameActionID);
    }
  });
  
  // 4. 按强化等级排序
  enhanceChain.sort((a, b) => {
    const getLevel = (id: string) => {
      const match = id.match(/\+(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    };
    return getLevel(a) - getLevel(b);
  });
  
  // 5. 补全可能遗漏的强化等级
  if (enhanceChain.length > 0) {
    let lastId = enhanceChain[enhanceChain.length - 1];
    
    // @ts-ignore
    while (enhanceInfo[lastId]?.enhanceSuccessTo) {
      // @ts-ignore
      const nextId = enhanceInfo[lastId].enhanceSuccessTo;
      if (!enhanceChain.includes(nextId)) {
        enhanceChain.push(nextId);
        lastId = nextId;
      } else {
        break; // 避免无限循环
      }
    }
  }
  
  return enhanceChain;
}

const onSelectEnhanceChainTab = (pane: TabsPaneContext) => {
    currentSelectedResourceId.value = pane.paneName as AllGameResourceIDWithInternal;
}

function toDetail(resourceId: AllGameResourceIDWithInternal) {
    currentSelectedResourceId.value = resourceId;
    renderResourceDropdown.value = {};
}

function toResourceMarketDetail(resourceId: AllGameResourceIDWithInternal) {
    currentSelectedResourceId.value = undefined;
    nextTick(() => {
        currentSelectedResourceId.value = resourceId;
        currentSelectedEnhanceChainTab.value = resourceId;
        renderResourceDropdown.value = {};
    });
}

function backToResourcePanel() {
    currentSelectedMainTab.value = 'index';
    currentSelectedResourceId.value = undefined;
}


const handleTabChange = (tab: TabPaneName) => {
    if (tab == 'index') {
        currentSelectedResourceId.value = undefined;
    }

    if (tab == 'market') {
    }
}

function formatNumber(num: number | undefined | null) {
    return (num ?? 0).toLocaleString();
}

function getMarketPriceStep(price: number): number {
  for (const config of MARKET_PRICE_STEP_CONFIG) {
    if (price >= config.min && price < config.max) {
      return config.step;
    }
  }
  return 1;
}

function adjustToMarketPriceStep(price: number): number {
  const step = getMarketPriceStep(price);
  return Math.round(price / step) * step;
}

function getMarketMinSellAndMaxBuyPrice(resourceId: string): { minSellPrice: number | null, maxBuyPrice: number | null } {
  let minSellPrice: number | null = null;
  let maxBuyPrice: number | null = null;

  // 卖方市场：type === 'sell' && sellResourceId === resourceId
  const sellList = (transactionList.value ?? []).filter(
    t => t.type === 'sell' && t.sellResourceId === resourceId && !t.isClosed
  );
  if (sellList.length) {
    minSellPrice = Math.min(...sellList.filter(t => t.type == 'sell').map(t => t.costPerUnit));
  }

  // 买方市场：type === 'buy' && requireResourceId === resourceId
  const buyList = (transactionList.value ?? []).filter(
    t => t.type === 'buy' && t.requireResourceId === resourceId && !t.isClosed
  );
  if (buyList.length) {
    maxBuyPrice = Math.max(...buyList.filter(t => t.type == 'buy').map(t => t.payPerUnit));
  }

  return { minSellPrice, maxBuyPrice };
}

function marketFormatNumber(number: number) {
    let n1 = formatNumber(number);
    let n2 = formatCountToStr(number);

    if (n1.replace(/,/g, '') == n2) {
        return n1;
    }
    return  n1 + ` (${formatCountToStr(number)})`
}

onUnmounted(() => {
    off1?.();
    off2?.();
    off3?.();
    off4?.();
    off5?.();
    off6?.();
    off7?.();
    off8?.();
    off9?.();
    off10?.();
    off11?.();
    off12?.();
})

// expand seller/buyer handlers
async function expandSellerLimit(e?: Event) {
    if (e && !e.isTrusted) return;
    if (!listingLimits.value) {
        ElMessage.error('无法获取上架上限信息');
        return;
    }

    confirmExpandSeller();
}

async function expandBuyerLimit(e?: Event) {
    if (e && !e.isTrusted) return;
    if (!listingLimits.value) {
        ElMessage.error('无法获取求购上限信息');
        return;
    }

    confirmExpandBuyer();
}
</script>

<style scoped>
/* resource grid for market listings — auto-fill columns, two columns on small screens */
.resource-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    gap: 2em;
}
</style>