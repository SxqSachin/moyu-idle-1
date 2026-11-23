import { ref } from "vue";
import { ElNotification } from "element-plus";
import type {
  HarvestBoxListItemDTO,
  ReqHarvestBoxList,
} from "~/shared/types/harvestBox";
import {
  emitHarvestBoxClaim,
  emitHarvestBoxClaimItem,
  emitHarvestBoxList,
  emitHarvestBoxClaimAll,
  onHarvestBoxClaimFail,
  onHarvestBoxClaimItemFail,
  onHarvestBoxClaimItemSuccess,
  onHarvestBoxClaimSuccess,
  onHarvestBoxClaimAllSuccess,
  onHarvestBoxClaimAllFail,
  onHarvestBoxListFail,
  onHarvestBoxListSuccess,
} from "~/api/game/socket/harvestBox";
import { onInventoryModify } from "~/api/game/socket/inventory";
import type { ItemCountInfo } from "~/shared/types/gameInventory";
import { allGameResource } from "~/shared/data/allGameResources";

const listRef = ref<HarvestBoxListItemDTO[]>([]);
const loadingRef = ref(false);
const errorRef = ref("");
const includeClaimedRef = ref(false);
const hasMoreRef = ref(false);
const nextCursorRef = ref<number | null>(null);
const lastBeforeIdRef = ref<number | null>(null);

// For single-shot inventory delta notifications after claim
type PendingClaim = { kind: "box" | "item" } | null;
const pendingClaim = ref<PendingClaim>(null);

function summarizeDelta(delta: ItemCountInfo) {
  const gained: string[] = [];
  for (const [id, info] of Object.entries(delta)) {
    const c = info?.count ?? 0;
    if (c > 0) {
      const name = allGameResource[id as any]?.name ?? id;
      gained.push(`${name} x${c}`);
    }
  }
  return gained;
}

let registered = false;
function ensureListeners() {
  if (registered) return;
  registered = true;

  onHarvestBoxListSuccess(({ list, hasMore, nextCursor }) => {
    loadingRef.value = false;
    errorRef.value = "";
    if (lastBeforeIdRef.value) {
      // append mode
      listRef.value = [...listRef.value, ...list];
    } else {
      // replace mode
      listRef.value = list;
    }
    hasMoreRef.value = !!hasMore;
    nextCursorRef.value = nextCursor ?? null;
    lastBeforeIdRef.value = null;
  });
  onHarvestBoxListFail(({ msg }) => {
    loadingRef.value = false;
    errorRef.value = msg;
    if (process.client) ElNotification({ title: "获取收获箱失败", message: msg, type: "error" });
  });

  onHarvestBoxClaimSuccess(() => {
    // inventory delta toast will be handled by onInventoryModify using pendingClaim set at emit time
    reload();
  });
  onHarvestBoxClaimFail(({ msg }) => {
    pendingClaim.value = null;
    if (process.client) ElNotification({ title: "领取失败", message: msg, type: "error" });
  });

  onHarvestBoxClaimItemSuccess(() => {
    // pendingClaim set at emit time; just refresh
    reload();
  });
  onHarvestBoxClaimItemFail(({ msg }) => {
    pendingClaim.value = null;
    if (process.client) ElNotification({ title: "领取失败", message: msg, type: "error" });
  });

  onInventoryModify((delta) => {
    if (!pendingClaim.value) return;
    const gained = summarizeDelta(delta);
    pendingClaim.value = null;
    if (gained.length && process.client) {
      ElNotification({ type: 'success', title: "领取成功", message: `获得：${gained.join("，")}` });
    }
  });

  onHarvestBoxClaimAllSuccess(() => {
    reload();
  })
  onHarvestBoxClaimAllFail(({ msg }) => {
    if (process.client) ElNotification({ title: "领取失败", message: msg, type: "error" });
  })
}

function fetchList(opts: ReqHarvestBoxList = {}) {
  ensureListeners();
  loadingRef.value = true;
  // reset pagination when opts provided directly
  if (typeof opts.includeClaimed !== "undefined") includeClaimedRef.value = !!opts.includeClaimed;
  hasMoreRef.value = false;
  nextCursorRef.value = null;
  lastBeforeIdRef.value = null;
  emitHarvestBoxList({ includeClaimed: includeClaimedRef.value, take: opts.take ?? 5 });
}

function reload() {
  hasMoreRef.value = false;
  nextCursorRef.value = null;
  lastBeforeIdRef.value = null;
  fetchList({ includeClaimed: includeClaimedRef.value, take: 5 });
}

function loadMore() {
  if (!hasMoreRef.value || loadingRef.value) return;
  loadingRef.value = true;
  lastBeforeIdRef.value = nextCursorRef.value ?? null;
  emitHarvestBoxList({ includeClaimed: includeClaimedRef.value, take: 5, beforeId: nextCursorRef.value ?? undefined });
}

function claimBox(boxId: number) {
  // optimistic set to avoid race: inventoryModify may arrive before claim:success
  pendingClaim.value = { kind: "box" };
  emitHarvestBoxClaim({ boxId });
}

function claimItem(itemId: number) {
  pendingClaim.value = { kind: "item" };
  emitHarvestBoxClaimItem({ itemId });
}

function claimAllBoxes() {
  emitHarvestBoxClaimAll();
}

export function useHarvestBox() {
  ensureListeners();

  return {
    // state
    boxes: listRef,
    loading: loadingRef,
    error: errorRef,
    includeClaimed: includeClaimedRef,
    hasMore: hasMoreRef,
    nextCursor: nextCursorRef,

    // actions
    fetchList,
    reload,
    loadMore,
    claimBox,
    claimItem,
    claimAllBoxes,
  };
}
