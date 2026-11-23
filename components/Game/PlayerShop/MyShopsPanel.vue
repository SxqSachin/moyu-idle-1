<template>
    <div class="space-y-3">
        <div v-if="!myShop" class="p-4">
            <el-empty description="你还没有创建店铺">
                <el-button type="primary" @click="openCreateShop">创建店铺</el-button>
            </el-empty>
            <p class="text-sm text-gray-500 text-center mt-2">创建店铺后可以上架物资，出售给其他玩家。</p>
            <p class="text-sm text-gray-500 text-center mt-2">在店铺中上架的物资，将自动从库存中取货并出售，无需手动补货。</p>
            <p class="text-sm text-gray-500 text-center mt-2">店长可以查看店铺中的每笔交易信息。</p>
            <p class="text-sm text-gray-500 text-center mt-2">出售所得将扣除3%交易税，其余的收入将存入收获箱。</p>
            <p class="text-sm text-gray-500 text-center mt-2">基础店铺拥有{{ BASE_MAX_PLAYER_SHOP_ITEM_SLOT }}个上架槽位。</p>
        </div>

        <div v-else class="space-y-2">
            <div class="flex items-center justify-between">
                <div class="flex flex-col gap-2">
                    <div class="font-semibold flex flex-row gap-2 items-center">
                        <div>
                            店铺基本信息
                        </div>
                        <div class="flex items-center gap-2">
                            <el-button type="primary" size="small" @click="openEdit">编辑</el-button>
                            <el-popover v-model:visible="expandPopoverVisible" placement="bottom" width="320"
                                trigger="click">
                                <div class="space-y-3">
                                    <div class="text-sm font-medium">选择扩展方案</div>
                                    <!-- render schemes as vertical selectable cards with remaining counts -->
                                    <div class="flex flex-col gap-2">
                                        <template v-for="s in expansionSchemes" :key="s.id">
                                            <label class="flex items-start gap-3 p-2 border rounded cursor-pointer"
                                                :class="{ 'bg-gray-50': selectedScheme === s.id }">
                                                <input type="radio" name="playerShopScheme" class="mt-1" :value="s.id"
                                                    v-model="selectedScheme" />
                                                <div class="flex-1">
                                                    <div class="flex items-center justify-between">
                                                        <div class="font-medium">{{ s.name }}</div>
                                                        <div class="text-xs text-gray-500">可用: {{
                                                            getSchemeRemainingLabel(s.id) }}</div>
                                                    </div>
                                                    <div class="text-xs text-gray-400 mt-1">{{ getSchemeShortHint(s.id)
                                                        }}</div>
                                                </div>
                                            </label>
                                        </template>
                                    </div>

                                    <div>
                                        <div class="text-sm">所需资源预览：</div>
                                        <div class="mt-2 flex flex-row flex-wrap gap-2">
                                            <GameCommonItemCountInfoIconAndName
                                                :item-count-info="playerShopExpandCostObj" :show-count="true"
                                                :show-inventory-count="true" />
                                        </div>
                                    </div>

                                    <div class="flex justify-end gap-2">
                                        <el-button size="small" @click="expandPopoverVisible = false">取消</el-button>
                                        <el-button size="small" type="primary" :loading="expandLoading"
                                            @click="confirmExpand">确认扩展</el-button>
                                    </div>
                                </div>
                                <template #reference>
                                    <el-button type="warning" size="small" class="ml-0!">扩展货架</el-button>
                                </template>
                            </el-popover>

                            <el-popover v-model:visible="pinPopoverVisible" placement="bottom" width="320" trigger="click">
                                <div class="space-y-3">
                                    <div>
                                        <div>置顶店铺后，你的店铺将在商业街首页顶部显示，持续24小时。</div>
                                        <div>商业街最多同时支持6家店铺进行置顶。</div>
                                        <div>当你购买置顶服务后，你在48小时内无法再次进行购买。</div>
                                    </div>

                                    <el-divider class="mt-0! mb-3!"></el-divider>

                                    <div class="text-sm font-medium">置顶店铺所需资源</div>
                                    <div class="mt-2 flex flex-row flex-wrap gap-2">
                                        <GameCommonItemCountInfoIconAndName :item-count-info="PLAYER_SHOP_PIN_COST" :show-count="true" :show-inventory-count="true" />
                                    </div>
                                    <div class="text-sm">
                                        <div>全局已置顶: {{ currentPinnedCount }} / {{ maxGlobalPins ?? 6 }}</div>
                                        <div v-if="pinCooldownRemainingSec > 0">个人冷却剩余: {{ formatSecondsToLabel(pinCooldownRemainingSec) }}</div>
                                        <div v-else>个人冷却: 可置顶</div>
                                    </div>
                                    <div class="flex justify-end gap-2">
                                        <el-button size="small" @click="pinPopoverVisible = false">取消</el-button>
                                        <el-button size="small" type="primary" :loading="pinLoading" :disabled="!canPin" @click="onConfirmPin">确认置顶</el-button>
                                    </div>
                                </div>
                                <template #reference>
                                    <el-button class="ml-0!" v-if="!isPinned" :type="'primary'" size="small" :loading="pinLoading">置顶</el-button>
                                    <el-popconfirm v-else title="确认取消置顶？" width="220" @confirm="() => unpinShop(myShop!.uuid)">
                                        <template #reference>
                                            <el-button class="ml-0!" :type="'info'" size="small" :loading="pinLoading">取消置顶</el-button>
                                        </template>
                                    </el-popconfirm>
                                </template>
                            </el-popover>
                            <div v-if="isPinned && myShopPinRemaining !== null" class="text-xs text-gray-500">置顶剩余: {{ formatSecondsToLabel(myShopPinRemaining) }}</div>

                        </div>
                    </div>
                    <div>
                        名称：{{ myShop?.name }}
                    </div>
                    <div>
                        描述：{{ myShop.description ?? "暂无描述" }}
                    </div>
                </div>
            </div>

            <el-divider class="my-2!"></el-divider>

            <div class="text-sm"> 商品信息: </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <template v-for="(slot, idx) in itemSlots" :key="'slot-'+idx">

                    <OwnerItemCard v-if="slot" :item="slot" @edit="openEditItem" />

                    <el-card v-else class="border-2 border-dashed flex items-center justify-center min-h-[140px]"
                        shadow="hover">
                        <div class="flex flex-col items-center gap-2 py-4">
                            <div class="text-gray-500">空货架</div>
                            <el-button type="primary" size="small" @click="openAddItem">上架物品</el-button>
                        </div>
                    </el-card>
                </template>

            </div>
            <div class="text-xs text-gray-500">最多上架 {{ maxSlots }} 个商品</div>
        </div>
    </div>


    <el-dialog v-model="editDialogVisible" title="编辑店铺" width="420" align-center>
        <el-form label-width="80" v-if="myShop">
            <el-form-item label="名称">
                <el-input v-model="formEdit.name" placeholder="店铺名称" :maxlength="12" :show-word-limit="true" />
            </el-form-item>
            <el-form-item label="描述">
                <el-input v-model="formEdit.description" type="textarea" :rows="3" :maxlength="24"
                    :show-word-limit="true" />
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button type="primary" class="w-full" @click="submitEdit">保存</el-button>
        </template>
    </el-dialog>

    <!-- dialogs -->
    <el-dialog v-model="createDialogVisible" title="创建店铺" width="360" align-center>
        <el-form label-width="80">
            <el-form-item label="名称">
                <el-input v-model="formCreate.name" placeholder="请输入店铺名称" :maxlength="12" :show-word-limit="true" />
            </el-form-item>
            <el-form-item label="描述">
                <el-input v-model="formCreate.description" type="textarea" :rows="3" :maxlength="24"
                    :show-word-limit="true" />
            </el-form-item>
            <!-- <el-form-item label="天数">
                <el-input-number v-model="formCreate.days" :min="1" />
            </el-form-item> -->

            <el-divider></el-divider>

            <div class="flex flex-row flex-wrap items-center gap-2">
                <span>创建店铺所需资源:</span>
                <GameCommonItemCountInfoIconAndName :show-count="true" :show-inventory-count="true"
                    :item-count-info="CREATE_PLAYER_SHOP_RESOURCE_REQUIREMENT"></GameCommonItemCountInfoIconAndName>
            </div>
        </el-form>
        <template #footer>
            <el-button type="primary" class="w-full" @click="submitCreate">创建</el-button>
        </template>
    </el-dialog>

    <el-dialog v-model="addItemDialogVisible" title="上架物品" width="360" align-center>
        <el-form label-width="90">
            <el-form-item label="物品">
                <el-select v-model="formAdd.resourceId" :filterable="true" :clearable="true">
                    <el-option v-for="opt in sellableItems" :key="opt.id" :label="opt.name" :value="opt.id">
                        <div class="flex items-center gap-1">
                            <GameCommonSimpleResourceIconAndName :resource-id="opt.id" />
                            (库存:{{ formatNumber(inventory[opt.id]?.count) }})
                        </div>
                    </el-option>
                </el-select>

            </el-form-item>
            <el-form-item label="单价">
                <el-input-number class="w-full!" v-model="formAdd.unitPrice" :min="1" :controls="false" />
            </el-form-item>

            <el-form-item label="保留数量">
                <template #label>
                    <div class="flex flex-row items-center">
                        <el-text>保留数量</el-text>
                        <el-tooltip placement="top">
                            <template #content>
                                <div>填写库存保留数量后，当你的库存数量低于此数值时，此商品将暂停出售，直到库存大于此数值</div>
                            </template>
                            <el-icon class="cursor-pointer text-gray-400">
                                <Icon name="material-symbols:help"></Icon>
                            </el-icon>
                        </el-tooltip>
                    </div>
                </template>
                <el-input-number class="w-full!" v-model="formAdd.inventoryRemainingCount" :min="0" :controls="false" />
            </el-form-item>
            <el-form-item label="一句话评价">
                <el-input v-model="formAdd.comment" :maxlength="40" :show-word-limit="true"
                    placeholder="对这个物品说点有趣的话吧～" />
            </el-form-item>
            <el-form-item label="限购数量">
                <template #label>
                    <div class="flex flex-row items-center">
                        <el-text>限购数量</el-text>
                        <el-tooltip placement="top">
                            <template #content>
                                <div>每个玩家在选择的周期内最多可购买的数量；0 或留空表示不限制</div>
                            </template>
                            <el-icon class="cursor-pointer text-gray-400">
                                <Icon name="material-symbols:help"></Icon>
                            </el-icon>
                        </el-tooltip>
                    </div>
                </template>
                <el-input-number class="w-full!" v-model="formAdd.perPlayerDailyLimit" :min="0" :controls="false" />
            </el-form-item>
            <el-form-item v-if="formAdd.perPlayerDailyLimit && formAdd.perPlayerDailyLimit > 0" label="限购周期">
                <template #label>
                    <div class="flex flex-row items-center">
                        <el-text>限购周期</el-text>
                        <el-tooltip placement="top">
                            <template #content>
                                <div>周期单位为天，范围 1-30；到期后限购数量自动刷新</div>
                            </template>
                            <el-icon class="cursor-pointer text-gray-400">
                                <Icon name="material-symbols:help"></Icon>
                            </el-icon>
                        </el-tooltip>
                    </div>
                </template>
                <el-input-number class="w-full!" v-model="formAdd.perPlayerLimitIntervalDays" :min="1" :max="30"
                    :controls="false" />
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button type="primary" class="w-full" @click="submitAddItem">上架</el-button>
        </template>
    </el-dialog>

    <el-dialog v-model="editItemDialogVisible" title="编辑货架" width="360" align-center>
        <el-form label-width="90">
            <el-form-item label="单价">
                <el-input-number class="w-full!" v-model="formEditItem.unitPrice" :min="1" :controls="false" />
            </el-form-item>
            <el-form-item label="一句话评价">
                <el-input v-model="formEditItem.comment" :maxlength="40" :show-word-limit="true"
                    placeholder="留空则删除评价" />
            </el-form-item>
            <el-form-item label="限购数量">
                <template #label>
                    <div class="flex flex-row items-center">
                        <el-text>限购数量</el-text>
                        <el-tooltip placement="top">
                            <template #content>
                                <div>每个玩家在指定周期内最多可购买数量；0 或留空表示不限制</div>
                            </template>
                            <el-icon class="cursor-pointer text-gray-400">
                                <Icon name="material-symbols:help"></Icon>
                            </el-icon>
                        </el-tooltip>
                    </div>
                </template>
                <el-input-number class="w-full!" v-model="formEditItem.perPlayerDailyLimit" :min="0"
                    :controls="false" />
            </el-form-item>
            <el-form-item v-if="formEditItem.perPlayerDailyLimit && formEditItem.perPlayerDailyLimit > 0" label="限购周期">
                <template #label>
                    <div class="flex flex-row items-center">
                        <el-text>限购周期</el-text>
                        <el-tooltip placement="top">
                            <template #content>
                                <div>周期单位为天，范围 1-30；到期后限购数量自动刷新</div>
                            </template>
                            <el-icon class="cursor-pointer text-gray-400">
                                <Icon name="material-symbols:help"></Icon>
                            </el-icon>
                        </el-tooltip>
                    </div>
                </template>
                <el-input-number class="w-full!" v-model="formEditItem.perPlayerLimitIntervalDays" :min="1" :max="30"
                    :controls="false" />
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button type="primary" class="w-full" :loading="itemUpdateLoading" @click="submitEditItem">保存</el-button>
        </template>
    </el-dialog>

</template>

<script setup lang="ts">
import { watchEffect, computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { PlayerShopVisibility, type AddItemToShopPayload, type CreatePlayerShopPayload, type PlayerShopDTO, type PlayerShopItemDTO, type UpdatePlayerShopPayload, type UpdatePlayerShopItemPayload } from "~/shared/types/playerShop";
import OwnerItemCard from './OwnerItemCard.vue'
import GameCommonResourceSelector from "~/components/Game/Common/ResourceSelector.vue";
import { usePlayerShop } from '~/composables/game/usePlayerShop';
import { waitUtilConnected } from '~/api/game/socket/socket';
import { BASE_MAX_PLAYER_SHOP_ITEM_SLOT, CREATE_PLAYER_SHOP_RESOURCE_REQUIREMENT, BASE_MAX_PLAYER_SHOP_ITEM_SLOT as MAX_SLOTS, PLAYER_SHOP_PIN_COST } from '~/shared/data/constant'
import { allGameResource } from '~/shared/data/allGameResources';
import { useInventory } from '~/composables/game/useInventory';
import { formatNumber } from '~/shared/utils';
import { PLAYER_SHOP_EXPANSION_SCHEMES, PLAYER_SHOP_EXPANSION_SCHEDULE_MAP, PLAYER_SHOP_EXPANSION_SCHEME_MAX_USABLE } from '~/shared/data/playerShopSlotConstants';
import type { PlayerShopExpansionSchemeId } from '~/shared/data/playerShopSlotConstants';
import { ElMessage } from 'element-plus';

import { getPlayerShopExpansionRequirement } from '~/shared/utils/playerShopExpansion';
import {
    emitPlayerShopGetListingLimits,
    onPlayerShopGetListingLimitsSuccess,
    onPlayerShopGetListingLimitsError,
} from '~/api/game/socket/playerShop';
import {
    emitPlayerShopExpandItemSlots,
    onPlayerShopExpandItemSlotsSuccess,
    onPlayerShopExpandItemSlotsError,
} from '~/api/game/socket/playerShop';

const {
    myShops,
    currentItems,
    createDialogVisible,
    addItemDialogVisible,
    editDialogVisible,
    openShop,
    createShop,
    addItem,
    updateShop,
    updateItem,
    fetchMyShops,
    itemUpdateLoading,
    itemUpdateStatus,
    resetItemUpdateStatus,
    pinShop,
    unpinShop,
    pinnedSet,
    pinnedExpiryMap,
    pinCooldownRemainingSec,
    canPin,
    currentPinnedCount,
    maxGlobalPins,
    pinLoading,
} = usePlayerShop();
const pinPopoverVisible = ref(false);

function formatSecondsToLabel(sec: number | null | undefined) {
    if (!sec || sec <= 0) return "0s";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

const myShopPinRemaining = computed(() => {
    if (!myShop.value) return null;
    const expires = pinnedExpiryMap?.value?.[myShop.value.uuid];
    if (!expires) return null;
    const sec = Math.max(0, Math.floor((expires - Date.now()) / 1000));
    return sec;
});

function onConfirmPin() {
    if (!myShop.value) return;
    pinPopoverVisible.value = false;
    pinShop(myShop.value.uuid);
}
const { user } = useUserSession();

// const ownChecker = (s: PlayerShopDTO) => s.owner === user.value?.uuid

onMounted(async () => {
    await waitUtilConnected();
    if (myShop.value) {
        openShop(myShop.value.uuid);
    }
})

const props = defineProps<{}>()
const emit = defineEmits<{
    (e: 'create'): void;
    (e: 'open', uuid: string): void;
    (e: 'renew', uuid: string): void;
    (e: 'edit'): void;
    (e: 'add-item'): void;
    (e: 'buy', item: PlayerShopItemDTO): void;
    (e: 'remove', uuid: string): void;
}>()


const formCreate = ref<CreatePlayerShopPayload>({ name: "我的店铺", description: "", });
const formAdd = ref<AddItemToShopPayload>({
    shopUuid: "",
    resourceId: "gold" as any,
    // count: 1,
    inventoryRemainingCount: 0,
    unitPrice: 1,
    comment: "",
    perPlayerDailyLimit: undefined as any,
    perPlayerLimitIntervalDays: 1,
    // currencyResourceId: "gold" as any,
    // minPurchase: 1
});
const formEdit = ref<UpdatePlayerShopPayload>({ shopUuid: "" });

type EditItemFormState = {
    itemUuid: string;
    unitPrice: number;
    comment: string;
    perPlayerDailyLimit: number | null;
    perPlayerLimitIntervalDays: number | null;
};

const editItemDialogVisible = ref(false);
const formEditItem = ref<EditItemFormState>({
    itemUuid: "",
    unitPrice: 1,
    comment: "",
    perPlayerDailyLimit: null,
    perPlayerLimitIntervalDays: null,
});

function openCreateShop() {
    formCreate.value = { name: ((user.value?.name ?? "我的") + "的店铺"), description: "" };
    createDialogVisible.value = true;
}
function submitCreate() {
    createShop(formCreate.value);
}

function openAddItem() {
    if (!myShop.value) return;
    formAdd.value = {
        shopUuid: myShop.value.uuid,
        resourceId: "",
        inventoryRemainingCount: 0,
        //   count: 0,
        unitPrice: 1,
        comment: "",
        perPlayerDailyLimit: undefined as any,
        perPlayerLimitIntervalDays: 1,
        // currencyResourceId: "gold" as any,
        //  minPurchase: 1
    };
    addItemDialogVisible.value = true;
}
function submitAddItem() {
    const payload: AddItemToShopPayload = {
        ...formAdd.value,
    };
    if (!payload.perPlayerDailyLimit || payload.perPlayerDailyLimit <= 0) {
        payload.perPlayerDailyLimit = undefined as any;
        payload.perPlayerLimitIntervalDays = undefined;
    } else {
        const interval = payload.perPlayerLimitIntervalDays ?? 1;
        payload.perPlayerLimitIntervalDays = Math.min(30, Math.max(1, interval));
    }
    addItem(payload);
}

function openEdit() {
    if (!myShop.value) return;
    formEdit.value = {
        shopUuid: myShop.value.uuid,
        name: myShop.value.name,
        description: myShop.value.description,
        visibility: myShop.value.visibility as any,
    };
    editDialogVisible.value = true;
}
function submitEdit() {
    if (!myShop.value) return;
    updateShop(formEdit.value);
}

function openEditItem(item: PlayerShopItemDTO) {
    if (!item) return;
    resetItemUpdateStatus();
    formEditItem.value = {
        itemUuid: item.uuid,
        unitPrice: item.unitPrice,
        comment: item.comment ?? "",
        perPlayerDailyLimit: item.perPlayerDailyLimit && item.perPlayerDailyLimit > 0 ? item.perPlayerDailyLimit : 0,
        perPlayerLimitIntervalDays:
            item.perPlayerDailyLimit && item.perPlayerDailyLimit > 0
                ? item.perPlayerLimitIntervalDays ?? 1
                : 1,
    };
    editItemDialogVisible.value = true;
}

function submitEditItem() {
    if (!formEditItem.value.itemUuid) return;
    const limit = formEditItem.value.perPlayerDailyLimit ?? 0;
    const payload: UpdatePlayerShopItemPayload = {
        itemUuid: formEditItem.value.itemUuid,
        unitPrice: formEditItem.value.unitPrice,
        comment: formEditItem.value.comment ?? "",
        perPlayerDailyLimit: limit,
        perPlayerLimitIntervalDays:
            limit > 0
                ? (formEditItem.value.perPlayerLimitIntervalDays ?? 1)
                : null,
    };
    if (limit <= 0) {
        payload.perPlayerDailyLimit = 0;
        payload.perPlayerLimitIntervalDays = null;
    } else if (payload.perPlayerLimitIntervalDays !== null && payload.perPlayerLimitIntervalDays !== undefined) {
        const interval = payload.perPlayerLimitIntervalDays;
        payload.perPlayerLimitIntervalDays = Math.min(30, Math.max(1, interval));
    }
    updateItem(payload);
}

watch(
    () => formAdd.value.perPlayerDailyLimit,
    (val) => {
        if (!val || val <= 0) {
            formAdd.value.perPlayerLimitIntervalDays = undefined;
            return;
        }
        if (!formAdd.value.perPlayerLimitIntervalDays || formAdd.value.perPlayerLimitIntervalDays < 1) {
            formAdd.value.perPlayerLimitIntervalDays = 1;
        } else if (formAdd.value.perPlayerLimitIntervalDays > 30) {
            formAdd.value.perPlayerLimitIntervalDays = 30;
        }
    }
);

watch(
    () => formEditItem.value.perPlayerDailyLimit,
    (val) => {
        if (!val || val <= 0) {
            formEditItem.value.perPlayerLimitIntervalDays = null;
            return;
        }
        if (!formEditItem.value.perPlayerLimitIntervalDays || formEditItem.value.perPlayerLimitIntervalDays < 1) {
            formEditItem.value.perPlayerLimitIntervalDays = 1;
        } else if (formEditItem.value.perPlayerLimitIntervalDays > 30) {
            formEditItem.value.perPlayerLimitIntervalDays = 30;
        }
    }
);

watch(itemUpdateStatus, (status) => {
    if (status === "success") {
        editItemDialogVisible.value = false;
        resetItemUpdateStatus();
    }
});

watch(editItemDialogVisible, (visible) => {
    if (!visible) {
        resetItemUpdateStatus();
    }
});

const myShop = computed(() => {
    return myShops.value.find(s => {
        return s.owner == user.value?.uuid
    })
})

const maxSlots = computed(() => {
    return listingLimits.value?.maxSlots ?? BASE_MAX_PLAYER_SHOP_ITEM_SLOT
})

const itemSlots = computed<(PlayerShopItemDTO | null)[]>(() => {
    const list = currentItems.value || []
    return Array.from({ length: maxSlots.value }, (_, i) => list[i] ?? null)
})

const inventory = useInventory();
const sellableItems = computed(() => {
    return Object.values(allGameResource).filter(r => {
        if (!r) {
            return false;
        }

        if (r.hideInMarket || r.hideInShop || r.isInternal) {
            return false;
        }

        return true;
    }).filter(r => {
        return (inventory.value[r.id]?.count ?? 0) > 0
    })
})

// expansion UI state
const expansionSchemes = PLAYER_SHOP_EXPANSION_SCHEMES;
const expandPopoverVisible = ref(false);
const expandLoading = ref(false);
const selectedScheme = ref<string | undefined>(expansionSchemes?.[0]?.id);
const listingLimits = ref<any>(null);

const playerShopNextReq = computed(() => {
    const done = listingLimits.value?.extra ?? 0;
    const usage = listingLimits.value?.schemeUsage ? (listingLimits.value.schemeUsage[selectedScheme.value ?? 'default'] ?? 0) : undefined;
    return getPlayerShopExpansionRequirement(done, selectedScheme.value as any, usage as any);
});

const expansionsDone = computed(() => listingLimits.value?.extra ?? 0);

// determine whether scheme is allowed (server-preferred), but UI still allows selecting even if not allowed
const isSchemeAllowed = (id: string | undefined) => {
    if (!id) return false;
    if (listingLimits.value && Array.isArray(listingLimits.value.allowedSchemes)) {
        return listingLimits.value.allowedSchemes.includes(id);
    }
    // prefer server provided remaining
    if (listingLimits.value && listingLimits.value.schemeRemaining) {
        const rem = listingLimits.value.schemeRemaining[id as string];
        if (rem === 'infinity') return true;
        return (rem ?? 0) > 0;
    }
    const cap = PLAYER_SHOP_EXPANSION_SCHEME_MAX_USABLE[id as PlayerShopExpansionSchemeId];
    if (cap === 'infinity') return true;
    return expansionsDone.value < (cap as number);
}

function getSchemeShortHint(id: string | undefined) {
    if (!id) return '';
    const cap = PLAYER_SHOP_EXPANSION_SCHEME_MAX_USABLE[id as PlayerShopExpansionSchemeId];
    if (listingLimits.value && listingLimits.value.schemeRemaining && listingLimits.value.schemeRemaining[id as string] !== undefined) {
        const rem = listingLimits.value.schemeRemaining[id as string];
        if (rem === 'infinity') return '无限使用';
        if ((rem ?? 0) <= 0) return '该方案当前不可用';
        return `剩余 ${rem} 次可用`;
    }
    if (cap === 'infinity') return '无限使用';
    return `总共可用 ${cap} 次`;
}

function getSchemeRemainingLabel(id: string | undefined) {
    if (!id) return '-';
    if (listingLimits.value && listingLimits.value.schemeRemaining && listingLimits.value.schemeRemaining[id as string] !== undefined) {
        const rem = listingLimits.value.schemeRemaining[id as string];
        return String(rem === 'infinity' ? '∞' : Math.max(0, Number(rem ?? 0)));
    }
    const cap = PLAYER_SHOP_EXPANSION_SCHEME_MAX_USABLE[id as PlayerShopExpansionSchemeId];
    if (cap === 'infinity') return '∞';
    const remain = (cap as number) - expansionsDone.value;
    return String(Math.max(0, remain));
}

// convert requirement array to ItemCountInfo map for existing UI component
const playerShopExpandCostObj = computed(() => {
    const arr = playerShopNextReq.value || [];
    const obj: Record<string, { count: number }> = {};
    for (const r of arr) obj[r.id] = { count: r.count };
    return obj;
});

const ownedExpandDisabled = computed(() => {
    const done = listingLimits.value?.extraSeller ?? 0;
    return done >= (/* reuse market cap */ 20);
});

function confirmExpand() {
    // if selected scheme not allowed, show explicit hint and abort
    if (!isSchemeAllowed(selectedScheme.value)) {
        ElMessage.error(`所选方案当前不可用，请选择其他方案或先完成前置扩展`);
        return;
    }
    expandPopoverVisible.value = false;
    expandLoading.value = true;
    emitPlayerShopExpandItemSlots({ schemeId: selectedScheme.value });
}

let offGetListingLimits: (() => void) | undefined;
let offGetListingLimitsError: (() => void) | undefined;
let offExpandSuccess: (() => void) | undefined;
let offExpandError: (() => void) | undefined;


const isPinned = computed(() => !!myShop.value && (pinnedSet?.value?.has(myShop.value.uuid) ?? false));
function togglePin() {
    if (!myShop.value) return;
    if (isPinned.value) unpinShop(myShop.value.uuid);
    else pinShop(myShop.value.uuid);
}

onMounted(() => {
    emitPlayerShopGetListingLimits();
    offGetListingLimits = onPlayerShopGetListingLimitsSuccess((data) => {
        listingLimits.value = data;
    });
    offGetListingLimitsError = onPlayerShopGetListingLimitsError((err) => {
        // ignore
    });

    offExpandSuccess = onPlayerShopExpandItemSlotsSuccess((data) => {
        expandLoading.value = false;
        // server emits full updated listingLimits; replace local copy
        listingLimits.value = data;
        // refresh shops
        fetchMyShops();
        // friendly message
        // using ElNotification defined in usePlayerShop listeners via socket responses is also fine
    });
    offExpandError = onPlayerShopExpandItemSlotsError((err) => {
        expandLoading.value = false;
        // show simple message
        // ElNotification not imported here; use window alert fallback if needed
        // but avoid side-effects here since usePlayerShop already shows notification; keep silent
    });
});

onUnmounted(() => {
    offGetListingLimits && offGetListingLimits();
    offGetListingLimitsError && offGetListingLimitsError();
    offExpandSuccess && offExpandSuccess();
    offExpandError && offExpandError();
});


</script>

<style scoped></style>
