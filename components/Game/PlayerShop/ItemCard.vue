<template>
    <el-card class="h-full" shadow="hover" body-class="p-4!">
        <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0 flex flex-col gap-2">

                <div class="flex flex-row items-center mb-2 gap-2">
                    <GameCommonSimpleResourceIconAndName :icon-size="12" :resource-id="item.resourceId" :hide-name="true">
                    </GameCommonSimpleResourceIconAndName>
                    <div class="font-bold text-lg">{{ resource.name }}</div>
                </div>

                <div v-if="item.comment" class="text-md text-gray-500 dark:text-gray-400 truncate -mt-2 mb-2">
                    “{{ item.comment }}”
                </div>

                <div class="flex flex-row gap-4 text-gray-500 dark:text-gray-400">
                    <span>库存: {{ formatCountToStr(item.availableCount) }}</span>
                    <span>销量: {{ formatNumber(item.soldCount) }}</span>
                </div>

                <div v-if="item.perPlayerDailyLimit && item.perPlayerDailyLimit > 0" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {{ getLimitLabel(item) }}限购：{{ formatNumber(item.perPlayerDailyLimit) }}
                </div>

                <div class="mt-4">
                    <span>单价： </span>
                    <GameCommonResourceIconAndName :resource-id="item.currencyResourceId" :count="item.unitPrice" />
                </div>
            </div>
            <div class="flex flex-col items-end gap-2">
                <template v-if="item.sellerUuid != user?.uuid">
                    <el-button size="small" :type="item.availableCount <= 0 ? 'warning' : 'primary'" :disabled="item.availableCount <= 0"
                        @click.stop="openBuy">
                        {{ item.availableCount <= 0 ? '缺货' : '购买'}}
                    </el-button>
                </template>
            </div>
        </div>
    </el-card>

    <el-dialog v-model="buyDialogVisible" title="购买" width="380" align-center>
        <div v-if="selectedItem" class="space-y-3">
            <div class="flex items-center gap-2">
                <span>购买：</span>
                <GameCommonSimpleResourceIconAndName :resource-id="selectedItem.resourceId" />
            </div>
            <div class="text-sm text-gray-500">
                <span>单价：</span>
                <GameCommonResourceIconAndName :resource-id="selectedItem.currencyResourceId" :count="selectedItem.unitPrice"></GameCommonResourceIconAndName> 
            </div>

            <div v-if="selectedItem?.perPlayerDailyLimit && selectedItem.perPlayerDailyLimit > 0" class="text-xs text-amber-600 dark:text-amber-400">
                {{ getLimitLabel(selectedItem) }}限购：{{ formatNumber(selectedItem.perPlayerDailyLimit) }}
            </div>

            <div class="text-sm text-gray-500">
                <span>数量：</span>
            <el-input-number v-model="buyCount" :min="1" :max="selectedItem.availableCount || 0" :controls="false" />
            </div>

            <div>
                <span>总价：</span>
                <GameCommonResourceIconAndName :resource-id="selectedItem.currencyResourceId" :count="selectedItem.unitPrice * buyCount"></GameCommonResourceIconAndName> 
            </div>
        </div>

        <template #footer>
            <el-button type="primary" class="w-full" @click="submitBuy">确认购买</el-button>
        </template>
    </el-dialog>

</template>

<script setup lang="ts">
import { GameCommonSimpleResourceIconAndName } from "#components";
import { usePlayerShop } from "~/composables/game/usePlayerShop";
import { allGameResource } from "~/shared/data/allGameResources";
import type { PlayerShopItemDTO } from "~/shared/types/playerShop";
import { formatCountToStr, formatNumber } from "~/shared/utils";

const { user } = useUserSession()

const {
    buyItem,
    buyDialogVisible,
    selectedItem
} = usePlayerShop();

const props = defineProps<{ item: PlayerShopItemDTO; }>();

const resource = computed(() => {
    return allGameResource[props.item.resourceId]
})

const buyCount = ref(1);

const getLimitLabel = (target?: PlayerShopItemDTO | null) => {
    if (!target?.perPlayerDailyLimit || target.perPlayerDailyLimit <= 0) {
        return "";
    }
    const interval = target.perPlayerLimitIntervalDays || 1;
    return interval <= 1 ? "每日" : `每${interval}天`;
};
function openBuy() {
    selectedItem.value = props.item;
    buyCount.value = 1
    buyDialogVisible.value = true;
}
function submitBuy() {
    if (!selectedItem.value) return;
    buyItem({ itemUuid: selectedItem.value.uuid, count: buyCount.value });
}


</script>

<style scoped></style>
