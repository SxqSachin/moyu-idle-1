import { emitEventToServer, registerSocketEventListener } from "./socket";
import type {
  CreatePlayerShopPayload,
  RenewPlayerShopPayload,
  AddItemToShopPayload,
  RemoveItemFromShopPayload,
  BuyFromShopPayload,
  PlayerShopDTO,
  PlayerShopItemDTO,
  GetPublicShopsQuery,
  GetPublicShopsResult,
  UpdatePlayerShopPayload,
  GetShopPurchaseListQuery,
  GetShopPurchaseListResult,
  UpdatePlayerShopItemPayload,
} from "~/shared/types/playerShop";

// Emitters
export function emitPlayerShopCreate(payload: CreatePlayerShopPayload) {
  emitEventToServer("playerShop:create", payload);
}
export function emitPlayerShopRenew(payload: RenewPlayerShopPayload) {
  emitEventToServer("playerShop:renew", payload);
}
export function emitPlayerShopAddItem(payload: AddItemToShopPayload) {
  emitEventToServer("playerShop:addItem", payload);
}
export function emitPlayerShopRemoveItem(payload: RemoveItemFromShopPayload) {
  emitEventToServer("playerShop:removeItem", payload);
}
export function emitPlayerShopUpdateItem(payload: UpdatePlayerShopItemPayload) {
  emitEventToServer("playerShop:updateItem", payload);
}
export function emitPlayerShopBuy(payload: BuyFromShopPayload) {
  emitEventToServer("playerShop:buy", payload);
}
export function emitPlayerShopMy(query: { includeExpired?: boolean } = {}) {
  emitEventToServer("playerShop:my", query);
}
export function emitPlayerShopDetail(shopUuid: string) {
  emitEventToServer("playerShop:detail", { shopUuid });
}

export function emitPlayerShopPublic(query: GetPublicShopsQuery = {}) {
  emitEventToServer("playerShop:public", query);
}

export function emitPlayerShopUpdate(payload: UpdatePlayerShopPayload) {
  emitEventToServer("playerShop:update", payload);
}

// Purchases
export function emitPlayerShopPurchaseList(query: GetShopPurchaseListQuery) {
  emitEventToServer("playerShop:purchaseList", query);
}

// Listeners
export const onPlayerShopCreateSuccess = registerSocketEventListener<{ shop: PlayerShopDTO }>(
  "playerShop:create:success"
);
export const onPlayerShopCreateError = registerSocketEventListener<{ message: string }>(
  "playerShop:create:error"
);

export const onPlayerShopRenewSuccess = registerSocketEventListener<{ shop: PlayerShopDTO }>(
  "playerShop:renew:success"
);
export const onPlayerShopRenewError = registerSocketEventListener<{ message: string }>(
  "playerShop:renew:error"
);

export const onPlayerShopAddItemSuccess = registerSocketEventListener<{ item: PlayerShopItemDTO }>(
  "playerShop:addItem:success"
);
export const onPlayerShopAddItemError = registerSocketEventListener<{ message: string }>(
  "playerShop:addItem:error"
);

export const onPlayerShopRemoveItemSuccess = registerSocketEventListener<{ itemUuid: string; returned: number }>(
  "playerShop:removeItem:success"
);
export const onPlayerShopRemoveItemError = registerSocketEventListener<{ message: string }>(
  "playerShop:removeItem:error"
);

export const onPlayerShopUpdateItemSuccess = registerSocketEventListener<{ item: PlayerShopItemDTO }>(
  "playerShop:updateItem:success"
);
export const onPlayerShopUpdateItemError = registerSocketEventListener<{ message: string }>(
  "playerShop:updateItem:error"
);

export const onPlayerShopBuySuccess = registerSocketEventListener<{
  itemUuid: string;
  buyCount: number;
  totalCost: number;
  sellerUuid: string;
}>("playerShop:buy:success");
export const onPlayerShopBuyError = registerSocketEventListener<{ message: string }>(
  "playerShop:buy:error"
);

export const onPlayerShopMySuccess = registerSocketEventListener<{ shops: PlayerShopDTO[] }>(
  "playerShop:my:success"
);
export const onPlayerShopMyError = registerSocketEventListener<{ message: string }>(
  "playerShop:my:error"
);

export const onPlayerShopDetailSuccess = registerSocketEventListener<{
  shop: PlayerShopDTO;
  items: PlayerShopItemDTO[];
}>("playerShop:detail:success");
export const onPlayerShopDetailError = registerSocketEventListener<{ message: string }>(
  "playerShop:detail:error"
);

export const onPlayerShopPublicSuccess = registerSocketEventListener<GetPublicShopsResult>(
  "playerShop:public:success"
);
export const onPlayerShopPublicError = registerSocketEventListener<{ message: string }>(
  "playerShop:public:error"
);

export const onPlayerShopUpdateSuccess = registerSocketEventListener<{ shop: PlayerShopDTO }>(
  "playerShop:update:success"
);
export const onPlayerShopUpdateError = registerSocketEventListener<{ message: string }>(
  "playerShop:update:error"
);

// Pin / unpin
export const emitPlayerShopPin = (payload: { shopUuid: string }) => {
  emitEventToServer("playerShop:pin", payload);
};
export const emitPlayerShopUnpin = (payload: { shopUuid: string }) => {
  emitEventToServer("playerShop:unpin", payload);
};

export const onPlayerShopPinSuccess = registerSocketEventListener<{ shopUuid: string; expiresAt: number; pinned: string[] }>(
  "playerShop:pin:success"
);
export const onPlayerShopPinError = registerSocketEventListener<{ message: string }>(
  "playerShop:pin:error"
);

export const onPlayerShopUnpinSuccess = registerSocketEventListener<{ shopUuid: string; pinned: string[] }>(
  "playerShop:unpin:success"
);
export const onPlayerShopUnpinError = registerSocketEventListener<{ message: string }>(
  "playerShop:unpin:error"
);

// Get pinned list
export const emitPlayerShopGetPinned = () => {
  emitEventToServer("playerShop:getPinned", null);
};
export type PlayerShopPinnedEntry = { shopUuid: string; expiresAt: number };
export const onPlayerShopGetPinnedSuccess = registerSocketEventListener<{
  pinned: PlayerShopPinnedEntry[];
  cooldownRemainingSec?: number;
  canPin?: boolean;
  currentPinnedCount?: number;
  maxGlobalPins?: number;
}>("playerShop:getPinned:success");
export const onPlayerShopGetPinnedError = registerSocketEventListener<{ message: string }>(
  "playerShop:getPinned:error"
);

export const onPlayerShopPurchaseListSuccess = registerSocketEventListener<GetShopPurchaseListResult>(
  "playerShop:purchaseList:success"
);
export const onPlayerShopPurchaseListError = registerSocketEventListener<{ message: string }>(
  "playerShop:purchaseList:error"
);

// Expand shop item slots
export const emitPlayerShopExpandItemSlots = (payload: { schemeId?: string }) => {
  emitEventToServer("playerShop:expandItemSlots", payload);
};
export const onPlayerShopExpandItemSlotsSuccess = registerSocketEventListener<any>(
  "playerShop:expandItemSlots:success"
);
export const onPlayerShopExpandItemSlotsError = registerSocketEventListener<{ message: string }>(
  "playerShop:expandItemSlots:error"
);

// Get player shop listing limits (base + extra)
export const emitPlayerShopGetListingLimits = () => {
  emitEventToServer("playerShop:getListingLimits", null);
};
export const onPlayerShopGetListingLimitsSuccess = registerSocketEventListener<any>(
  "playerShop:getListingLimits:success"
);
export const onPlayerShopGetListingLimitsError = registerSocketEventListener<{ message: string }>(
  "playerShop:getListingLimits:error"
);
