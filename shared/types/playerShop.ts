import type { AllGameResourceID } from "./gameResource";

// Use string enums to avoid magic strings across the codebase
export enum PlayerShopVisibility {
  PUBLIC = "PUBLIC",
  GUILD = "GUILD",
  PRIVATE = "PRIVATE",
}

export enum PlayerShopState {
  OPEN = "OPEN",
  PAUSED = "PAUSED",
  CLOSED = "CLOSED",
  EXPIRED = "EXPIRED",
  REMOVED = "REMOVED",
}

export enum PlayerShopItemState {
  ACTIVE = "ACTIVE",
  HIDDEN = "HIDDEN",
  OUT = "OUT",
  REMOVED = "REMOVED",
}

export type CreatePlayerShopPayload = {
  name: string;
  description?: string;
//   visibility?: PlayerShopVisibility;
//   days?: number; // 默认 7 天
//   guildUuid?: string | null;
//   area?: string | null;
};

export type RenewPlayerShopPayload = {
  shopUuid: string;
  days: number; // 延长天数
};

export type UpdatePlayerShopPayload = {
  shopUuid: string;
  name?: string;
  description?: string | null;
  visibility?: PlayerShopVisibility;
  guildUuid?: string | null;
  area?: string | null;
};

export type AddItemToShopPayload = {
  shopUuid: string;
  resourceId: AllGameResourceID;
//   count: number; // 上架数量（整数）

  inventoryRemainingCount: number; // 库存保留数量
  unitPrice: number; // 单价（整数，单位：currencyResourceId）
//   currencyResourceId?: AllGameResourceID; // 默认 gold
//   minPurchase?: number; // 默认 1
//   maxPerUser?: number; // 默认 0 不限
  metadata?: any;
  comment?: string; // 店主对该物品的一句话评价
  // 每个用户每天限购数量（0 或未填写表示不限制）
  perPlayerDailyLimit?: number;
  // 限购周期（单位：天），仅当限购数量>0 时有效
  perPlayerLimitIntervalDays?: number;
};

export type UpdatePlayerShopItemPayload = {
  itemUuid: string;
  unitPrice?: number;
  comment?: string | null;
  perPlayerDailyLimit?: number | null;
  perPlayerLimitIntervalDays?: number | null;
};

export type RemoveItemFromShopPayload = {
  itemUuid: string;
};

export type BuyFromShopPayload = {
  itemUuid: string;
  count: number; // 购买数量
  buyerUuid?: string; // 服务器从 socket.user 补齐
};

export type GetMyShopsQuery = {
  includeExpired?: boolean;
};

export type GetShopDetailQuery = {
  shopUuid: string;
};

export type GetPublicShopsQuery = {
  page?: number;
  pageSize?: number;
  area?: string | null;
  guildUuid?: string | null;
  search?: string; // match in name (contains)
  resourceId?: AllGameResourceID; // match shops selling this resource
  excludeOwner?: string; // optional: exclude this owner (usually current user)
  // 随机分页的种子：同一 seed 下分页顺序稳定且不重复；不传则服务器默认
  seed?: string;
};

export type GetPublicShopsResult = {
  shops: PlayerShopDTO[];
  page: number;
  pageSize: number;
  total: number;
};

export type PlayerShopDTO = {
  uuid: string;
  owner: string;
  name: string;
  description: string | null;
  visibility: PlayerShopVisibility;
  state: PlayerShopState;
  expiresAt: string; // ISO
  guildUuid: string | null;
  area: string | null;
  sellResource?: AllGameResourceID[]; // 商店当前售卖的资源（去重）
  totalSoldCount?: number; // 店铺所有上架项总销量

  // 置顶
  isPinned?: boolean;
};

export type PlayerShopItemDTO = {
  uuid: string;
  shopUuid: string;
  sellerUuid: string;
  resourceId: AllGameResourceID;

  availableCount: number;
  inventoryRemainingCount: number; // 库存保留数量

  soldCount: number;

  unitPrice: number;
  currencyResourceId: AllGameResourceID;
//   minPurchase: number;
//   maxPerUser: number;
  state: PlayerShopItemState;
  comment?: string; // 店主对该物品的一句话评价
  perPlayerDailyLimit?: number; // 每个用户每天限购（0/缺省不限制）
  perPlayerLimitIntervalDays?: number; // 限购周期（天）
};

// Purchase record DTO and queries
export type PlayerShopPurchaseDTO = {
  uuid: string;
  buyerUuid: string;
//   sellerUuid: string;
//   shopUuid: string;
  itemUuid: string;
  resourceId: AllGameResourceID;
  currencyResourceId: AllGameResourceID;
  unitPrice: number;
  count: number;
//   totalCost: number;
//   state: string; // SUCCESS | REFUNDED | CANCELLED (reserved)
  createdAt: string; // ISO
};

export type GetShopPurchaseListQuery = {
  itemUuid: string;
  page?: number;
  pageSize?: number;
};

export type GetShopPurchaseListResult = {
  records: PlayerShopPurchaseDTO[];
  page: number;
  pageSize: number;
  total: number;
};
