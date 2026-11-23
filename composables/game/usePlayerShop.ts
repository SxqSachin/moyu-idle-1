import { ref, computed } from "vue";
import { ElNotification } from "element-plus";
import type {
  PlayerShopDTO,
  PlayerShopItemDTO,
  CreatePlayerShopPayload,
  AddItemToShopPayload,
  BuyFromShopPayload,
  GetPublicShopsQuery,
  GetPublicShopsResult,
  UpdatePlayerShopPayload,
  GetShopPurchaseListQuery,
  GetShopPurchaseListResult,
  UpdatePlayerShopItemPayload,
} from "~/shared/types/playerShop";
import {
  PlayerShopItemState,
  PlayerShopState,
} from "~/shared/types/playerShop";
import {
  emitPlayerShopCreate,
  emitPlayerShopRenew,
  emitPlayerShopAddItem,
  emitPlayerShopRemoveItem,
  emitPlayerShopUpdateItem,
  emitPlayerShopBuy,
  emitPlayerShopMy,
  emitPlayerShopDetail,
  emitPlayerShopPublic,
  emitPlayerShopUpdate,
  emitPlayerShopPurchaseList,
  emitPlayerShopExpandItemSlots,
  emitPlayerShopGetListingLimits,
  emitPlayerShopPin,
  emitPlayerShopUnpin,
  emitPlayerShopGetPinned,
  onPlayerShopCreateSuccess,
  onPlayerShopCreateError,
  onPlayerShopRenewSuccess,
  onPlayerShopRenewError,
  onPlayerShopAddItemSuccess,
  onPlayerShopAddItemError,
  onPlayerShopRemoveItemSuccess,
  onPlayerShopRemoveItemError,
  onPlayerShopUpdateItemSuccess,
  onPlayerShopUpdateItemError,
  onPlayerShopBuySuccess,
  onPlayerShopBuyError,
  onPlayerShopMySuccess,
  onPlayerShopMyError,
  onPlayerShopDetailSuccess,
  onPlayerShopDetailError,
  onPlayerShopPublicSuccess,
  onPlayerShopPublicError,
  onPlayerShopPinSuccess,
  onPlayerShopPinError,
  onPlayerShopUnpinSuccess,
  onPlayerShopUnpinError,
  onPlayerShopGetPinnedSuccess,
  onPlayerShopGetPinnedError,
  onPlayerShopUpdateSuccess,
  onPlayerShopUpdateError,
  onPlayerShopPurchaseListSuccess,
  onPlayerShopPurchaseListError,
  onPlayerShopExpandItemSlotsSuccess,
  onPlayerShopExpandItemSlotsError,
} from "~/api/game/socket/playerShop";

const myShops = ref<PlayerShopDTO[]>([]);
const currentShop = ref<PlayerShopDTO | null>(null);
const currentItems = ref<PlayerShopItemDTO[]>([]);
const loading = ref(false);
const error = ref("");
const publicShops = ref<GetPublicShopsResult | null>(null);
const publicShopSeed = ref<string>("");

const currentPurchases = ref<GetShopPurchaseListResult | null>(null);
const itemUpdateLoading = ref(false);
const itemUpdateStatus = ref<"success" | "error" | null>(null);

const createDialogVisible = ref(false);
const addItemDialogVisible = ref(false);
const buyDialogVisible = ref(false);
const editDialogVisible = ref(false);

const selectedItem = ref<PlayerShopItemDTO | null>(null);

// pin state
const pinnedSet = ref<Set<string>>(new Set());
const pinLoading = ref(false);
const pinnedExpiryMap = ref<Record<string, number>>({});
const pinCooldownRemainingSec = ref(0);
const canPin = ref(true);
const currentPinnedCount = ref(0);
const maxGlobalPins = ref<number | null>(null);

function reorderShopsByPinned(shops: PlayerShopDTO[], pinned: Set<string>) {
  if (!pinned || pinned.size === 0) return shops;
  const pinnedArr: PlayerShopDTO[] = [];
  const others: PlayerShopDTO[] = [];
  for (const s of shops) {
    if (pinned.has(s.uuid)) pinnedArr.push(s);
    else others.push(s);
  }
  return [...pinnedArr, ...others];
}

const { user } = useUserSession();

function generatePublicShopSeed() {
  const d = new Date();
  return `${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function resetPublicShopSeed() {
  publicShopSeed.value = generatePublicShopSeed();
  return publicShopSeed.value;
}

function resetItemUpdateStatus() {
  itemUpdateStatus.value = null;
}

let registered = false;
function ensureListeners() {
  if (registered) return;
  registered = true;

  onPlayerShopCreateSuccess(({ shop }) => {
    myShops.value = [shop, ...myShops.value];
    createDialogVisible.value = false;
    ElNotification({ type: "success", title: "创建成功", message: shop.name });
  });
  onPlayerShopCreateError(({ message }) => {
    ElNotification({ type: "error", title: "创建失败", message });
  });

  onPlayerShopRenewSuccess(({ shop }) => {
    myShops.value = myShops.value.map((s) => (s.uuid === shop.uuid ? shop : s));
    if (currentShop.value?.uuid === shop.uuid) currentShop.value = shop;
    ElNotification({
      type: "success",
      title: "续期成功",
      message: `到期：${new Date(shop.expiresAt).toLocaleString()}`,
    });
  });
  onPlayerShopRenewError(({ message }) => {
    ElNotification({ type: "error", title: "续期失败", message });
  });

  onPlayerShopAddItemSuccess(({ item }) => {
    currentItems.value = [item, ...currentItems.value];
    addItemDialogVisible.value = false;
    if (currentShop.value) {
      const activeIds = new Set(
        currentItems.value
          .filter((i) => i.state === PlayerShopItemState.ACTIVE)
          .map((i) => i.resourceId)
      );
      currentShop.value = {
        ...currentShop.value,
        sellResource: Array.from(activeIds) as any,
      };
    }
    ElNotification({ type: "success", title: "店铺上架成功" });
  });
  onPlayerShopAddItemError(({ message }) => {
    ElNotification({ type: "error", title: "店铺上架失败", message });
  });

  onPlayerShopRemoveItemSuccess(({ itemUuid }) => {
    currentItems.value = currentItems.value.filter((i) => i.uuid !== itemUuid);
    if (currentShop.value) {
      const activeIds = new Set(
        currentItems.value
          .filter((i) => i.state === PlayerShopItemState.ACTIVE)
          .map((i) => i.resourceId)
      );
      currentShop.value = {
        ...currentShop.value,
        sellResource: Array.from(activeIds) as any,
      };
    }
    ElNotification({ type: "success", title: "店铺下架成功" });
  });
  onPlayerShopRemoveItemError(({ message }) => {
    ElNotification({ type: "error", title: "下架失败", message });
  });

  onPlayerShopUpdateItemSuccess(({ item }) => {
    currentItems.value = currentItems.value.map((i) =>
      i.uuid === item.uuid ? item : i
    );
    if (currentShop.value) {
      const activeIds = new Set(
        currentItems.value
          .filter((i) => i.state === PlayerShopItemState.ACTIVE)
          .map((i) => i.resourceId)
      );
      currentShop.value = {
        ...currentShop.value,
        sellResource: Array.from(activeIds) as any,
      };
    }
    ElNotification({ type: "success", title: "更新成功" });
    itemUpdateLoading.value = false;
    itemUpdateStatus.value = "success";
  });
  onPlayerShopUpdateItemError(({ message }) => {
    ElNotification({ type: "error", title: "更新失败", message });
    itemUpdateLoading.value = false;
    itemUpdateStatus.value = "error";
  });

  onPlayerShopBuySuccess(({ itemUuid, buyCount, totalCost }) => {
    currentItems.value = currentItems.value.map((i) =>
      i.uuid === itemUuid
        ? {
            ...i,
            availableCount: Math.max(0, (i.availableCount || 0) - buyCount),
            soldCount: (i.soldCount || 0) + buyCount,
            state:
              (i.availableCount || 0) - buyCount <= 0
                ? PlayerShopItemState.OUT
                : i.state,
          }
        : i
    );
    if (currentShop.value) {
      const activeIds = new Set(
        currentItems.value
          .filter((i) => i.state === PlayerShopItemState.ACTIVE)
          .map((i) => i.resourceId)
      );
      currentShop.value = {
        ...currentShop.value,
        sellResource: Array.from(activeIds) as any,
      };
    }
    buyDialogVisible.value = false;
    ElNotification({
      type: "success",
      title: "购买成功",
      message: `花费：${totalCost}`,
    });
  });
  onPlayerShopBuyError(({ message }) => {
    ElNotification({ type: "error", title: "购买失败", message });
  });

  onPlayerShopMySuccess(({ shops }) => {
    loading.value = false;
    error.value = "";
    myShops.value = shops;
  });
  onPlayerShopMyError(({ message }) => {
    loading.value = false;
    error.value = message;
  });

  onPlayerShopDetailSuccess(({ shop, items }) => {
    loading.value = false;
    error.value = "";
    currentShop.value = shop;
    currentItems.value = items;
  });
  onPlayerShopDetailError(({ message }) => {
    loading.value = false;
    error.value = message;
  });

  onPlayerShopPublicSuccess((res) => {
    loading.value = false;
    error.value = "";
    publicShops.value = res;
  });
  onPlayerShopPublicError(({ message }) => {
    loading.value = false;
    error.value = message;
  });

  onPlayerShopUpdateSuccess(({ shop }) => {
    myShops.value = myShops.value.map((s) => (s.uuid === shop.uuid ? shop : s));
    if (currentShop.value?.uuid === shop.uuid) currentShop.value = shop;
    editDialogVisible.value = false;
    ElNotification({ type: "success", title: "更新成功", message: shop.name });
  });
  onPlayerShopUpdateError(({ message }) => {
    ElNotification({ type: "error", title: "更新失败", message });
  });

  onPlayerShopExpandItemSlotsSuccess(() => {
    fetchMyShops();
    emitPlayerShopGetListingLimits();
    ElNotification({ type: "success", title: "扩展成功" });
  });
  onPlayerShopExpandItemSlotsError(({ message }) => {
    ElNotification({ type: "error", title: "扩展失败", message });
  });

  onPlayerShopPurchaseListSuccess((res) => {
    currentPurchases.value = res;
  });
  onPlayerShopPurchaseListError(({ message }) => {
    ElNotification({ type: "error", title: "获取销售记录失败", message });
  });

  // pin/unpin handlers
  onPlayerShopPinSuccess(({ shopUuid, expiresAt, pinned }) => {
    // update local pinned set (server pin success returns uuid list)
    pinnedSet.value = new Set(pinned || []);
    // if expiresAt provided, update expiry map for this shop
    if (shopUuid && expiresAt) pinnedExpiryMap.value = { ...pinnedExpiryMap.value, [shopUuid]: expiresAt };
    pinLoading.value = false;
    ElNotification({ type: "success", title: "置顶成功", message: `店铺已置顶，持续 8 小时` });
    // refresh lists
    fetchMyShops();
    fetchPublicShops();
  });
  onPlayerShopPinError(({ message }) => {
    pinLoading.value = false;
    ElNotification({ type: "error", title: "置顶失败", message });
  });
  onPlayerShopUnpinSuccess(({ shopUuid, pinned }) => {
    pinnedSet.value = new Set(pinned || []);
    pinLoading.value = false;
    ElNotification({ type: "success", title: "取消置顶成功" });
    fetchMyShops();
    fetchPublicShops();
  });
  onPlayerShopUnpinError(({ message }) => {
    pinLoading.value = false;
    ElNotification({ type: "error", title: "取消置顶失败", message });
  });
  onPlayerShopGetPinnedSuccess((data) => {
    const pinned = data?.pinned || [];
    // handle entries with expiry or just uuids
    if (pinned.length > 0 && typeof (pinned[0] as any).shopUuid === "string") {
      // pinned is array of { shopUuid, expiresAt }
      const entries = pinned as Array<{ shopUuid: string; expiresAt: number }>;
      pinnedSet.value = new Set(entries.map((e) => e.shopUuid));
      const map: Record<string, number> = {};
      for (const e of entries) map[e.shopUuid] = e.expiresAt;
      pinnedExpiryMap.value = map;
    } else {
      pinnedSet.value = new Set(pinned.map(p => p.shopUuid) || []);
      pinnedExpiryMap.value = {};
    }
    // update capacity/cooldown info if provided
    pinCooldownRemainingSec.value = data?.cooldownRemainingSec ?? 0;
    canPin.value = data?.canPin ?? (pinCooldownRemainingSec.value === 0 && (data?.currentPinnedCount ?? 0) < (data?.maxGlobalPins ?? 6));
    currentPinnedCount.value = data?.currentPinnedCount ?? (pinnedSet.value.size ?? 0);
    maxGlobalPins.value = data?.maxGlobalPins ?? maxGlobalPins.value;

    // if we already have public results, reorder them
    if (publicShops.value && publicShops.value.shops) {
      publicShops.value = {
        ...publicShops.value,
        shops: reorderShopsByPinned(publicShops.value.shops, pinnedSet.value),
      };
    }
  });
  onPlayerShopGetPinnedError(({ message }) => {
    // ignore
  });
}

function fetchMyShops(opts: { includeExpired?: boolean } = {}) {
  ensureListeners();
  loading.value = true;
  emitPlayerShopMy(opts);
}

function openShop(shopUuid: string) {
  ensureListeners();
  loading.value = true;
  emitPlayerShopDetail(shopUuid);
}

function fetchPublicShops(query: GetPublicShopsQuery = {}) {
  ensureListeners();
  loading.value = true;
  // fetch pinned list then public page; client will reorder current page by pinned membership
  emitPlayerShopGetPinned();
  emitPlayerShopPublic({ ...query, seed: publicShopSeed.value });
}

function createShop(payload: CreatePlayerShopPayload) {
  ensureListeners();
  emitPlayerShopCreate(payload);
}

function renewShop(shopUuid: string, days: number) {
  ensureListeners();
  emitPlayerShopRenew({ shopUuid, days });
}

function addItem(payload: AddItemToShopPayload) {
  ensureListeners();
  emitPlayerShopAddItem(payload);
}

function removeItem(itemUuid: string) {
  ensureListeners();
  emitPlayerShopRemoveItem({ itemUuid });
}

function updateItem(payload: UpdatePlayerShopItemPayload) {
  ensureListeners();
  itemUpdateLoading.value = true;
  itemUpdateStatus.value = null;
  emitPlayerShopUpdateItem(payload);
}

function buyItem(payload: BuyFromShopPayload) {
  ensureListeners();
  emitPlayerShopBuy(payload);
}

function updateShop(payload: UpdatePlayerShopPayload) {
  ensureListeners();
  emitPlayerShopUpdate(payload);
}

function fetchPurchaseList(query: GetShopPurchaseListQuery) {
  ensureListeners();
  emitPlayerShopPurchaseList(query);
}

function pinShop(shopUuid: string) {
  ensureListeners();
  pinLoading.value = true;
  emitPlayerShopPin({ shopUuid });
}

function unpinShop(shopUuid: string) {
  ensureListeners();
  pinLoading.value = true;
  emitPlayerShopUnpin({ shopUuid });
}

export function usePlayerShop() {
  ensureListeners();

  const hasActiveShop = computed(() =>
    myShops.value.some((s) => s.state === PlayerShopState.OPEN)
  );

  return {
    myShops,
    currentShop,
    currentItems,
    loading,
    error,
    publicShops,
    publicShopSeed,
    resetPublicShopSeed,
    currentPurchases,

    createDialogVisible,
    addItemDialogVisible,
    buyDialogVisible,
    editDialogVisible,
    itemUpdateLoading,
    itemUpdateStatus,

    selectedItem,

    fetchMyShops,
    openShop,
    createShop,
    renewShop,
    addItem,
    removeItem,
    updateItem,
    buyItem,
    updateShop,
    fetchPurchaseList,
    pinShop,
    unpinShop,
    pinnedSet,
    pinnedExpiryMap,
    pinCooldownRemainingSec,
    canPin,
    currentPinnedCount,
    maxGlobalPins,
    pinLoading,
    fetchPublicShops,

    resetItemUpdateStatus,

    hasActiveShop,

    ownChecker: (s: PlayerShopDTO): boolean => s.owner === user.value?.uuid,
  };
}
