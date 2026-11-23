<template>
    <el-card class="h-full" body-class="flex flex-col justify-between h-full">
        <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <GameCommonSimpleResourceIconAndName :resource-id="item.resourceId" />
                </div>

                <div v-if="item.comment" class="text-sm text-gray-500 dark:text-gray-400 my-1 truncate">
                    描述：“{{ item.comment }}”
                </div>

                <div class="text-sm text-gray-500 my-2">
                    单价：
                    <GameCommonResourceIconAndName :resource-id="item.currencyResourceId" :count="item.unitPrice" />
                </div>

                <div class="flex flex-col gap-2 mt-4 text-xs text-gray-500">
                    <span>已售出：{{ formatNumber(item.soldCount) }}</span>
                    <span>总库存：{{ formatNumber(thisItemInventory) }}</span>
                    <template v-if="item.inventoryRemainingCount">
                        <span>保留库存：{{ formatNumber(item.inventoryRemainingCount) }}</span>
                        <span>
                            可用库存：{{ formatNumber(Math.max(0, thisItemInventory - item.inventoryRemainingCount)) }}
                        </span>
                    </template>
                    <span
                        v-if="item.perPlayerDailyLimit && item.perPlayerDailyLimit > 0"
                        class="text-amber-600 dark:text-amber-400"
                    >{{ limitIntervalLabel }}限购：{{ formatNumber(item.perPlayerDailyLimit) }}</span>
                </div>
            </div>
        </div>


        <div class="flex flex-col gap-2">
            <el-divider class="my-2!"></el-divider>
            <el-button class="ml-0!" size="small" @click.stop="openEdit">编辑</el-button>
            <el-button class="ml-0!" size="small" type="primary" @click.stop="openRecordDialog">销售记录</el-button>
            <el-button
                class="ml-0!"
                size="small"
                type="danger"
                :disabled="item.state === PlayerShopItemState.REMOVED"
                @click.stop="removeItem(item.uuid)"
            >下架</el-button>
        </div>
    </el-card>

    <!-- Sales Record Dialog -->
    <el-dialog v-model="recordDialogVisible" title="销售记录" width="520">
        <div v-if="!currentPurchases">加载中…</div>
        <div v-else>
            <div v-if="!currentPurchases.records.length" class="text-gray-500 text-sm">暂无记录</div>
            <div v-else>
                <el-table :data="currentPurchases.records" size="small" border>
                    <el-table-column prop="count" label="购买者" width="140" align="left">
                        <template #default="{ row }">
                            <GameUserAvatarAndName :uuid="row.buyerUuid" />
                        </template>
                    </el-table-column>
                    <el-table-column prop="count" label="数量" width="80" align="right">
                        <template #default="{ row }">
                            {{ formatNumber(row.count) }}
                        </template>
                    </el-table-column>
                    <el-table-column label="总价" min-width="120" align="right">
                        <template #default="{ row }">

                            <span class="mr-1">{{ formatNumber(row.unitPrice * row.count) }}</span>
                            <GameCommonSimpleResourceIconAndName :resource-id="row.currencyResourceId" />
                        </template>
                    </el-table-column>
                    <el-table-column label="时间" min-width="80" align="right">
                        <template #default="{ row }">
                            {{ formatTimeToStr(row.createdAt) }}
                        </template>
                    </el-table-column>
                </el-table>
                <div class="flex justify-end pt-2">
                    <el-pagination layout="prev, pager, next" :current-page="recordPage" :page-size="recordPageSize"
                        :total="currentPurchases.total" @current-change="onRecordPageChange" />
                </div>
            </div>
        </div>
    </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { GameCommonResourceIconAndName, GameCommonSimpleResourceIconAndName } from "#components";
import { useInventory } from "~/composables/game/useInventory";
import { usePlayerShop } from "~/composables/game/usePlayerShop";
import type { PlayerShopItemDTO } from "~/shared/types/playerShop";
import { PlayerShopItemState } from "~/shared/types/playerShop";
import { formatNumber, formatTimeToStr } from "~/shared/utils";

const inventory = useInventory();

const {
    removeItem,
    fetchPurchaseList,
    currentPurchases,
} = usePlayerShop();

const props = defineProps<{ item: PlayerShopItemDTO }>();
const emit = defineEmits<{ (e: "edit", item: PlayerShopItemDTO): void }>();

const thisItemInventory = computed(() => {
    return inventory.value[props.item.resourceId]?.count ?? 0;
});

const limitIntervalLabel = computed(() => {
    if (!props.item.perPlayerDailyLimit || props.item.perPlayerDailyLimit <= 0) {
        return "";
    }
    const interval = props.item.perPlayerLimitIntervalDays || 1;
    if (interval <= 1) {
        return "每日";
    }
    return `每${interval}天`;
});

// Sales record dialog state
const recordDialogVisible = ref(false);
const recordPage = ref(1);
const recordPageSize = ref(10);

function openRecordDialog() {
    recordDialogVisible.value = true;
    fetchPurchaseList({
        itemUuid: props.item.uuid,
        page: recordPage.value,
        pageSize: recordPageSize.value,
    });
}

function onRecordPageChange(p: number) {
    recordPage.value = p;
    fetchPurchaseList({ itemUuid: props.item.uuid, page: p, pageSize: recordPageSize.value });
}

function openEdit() {
    emit("edit", props.item);
}

</script>

<style scoped></style>
