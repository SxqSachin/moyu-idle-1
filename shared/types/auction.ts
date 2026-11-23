// ...existing code...

/**
 * Auction DTOs for frontend <-> backend.
 * - All numeric fields use `number`.
 * - All date/time fields use `Date`.
 */

export type AuctionState = "OPEN" | "ENDED" | "CANCELLED" | "SETTLED";

export type JsonObject = Record<string, unknown>;

/** 拍卖目标类型（可扩展） */
export type AuctionTargetType = "ITEM" | "TITLE" | "SHOP" | "BUILDING" | "TEXT";

/* --- Auction --- */

export interface AuctionCreateInput {
  creator: string;
  targetType: AuctionTargetType;
  targetId: string;
  targetCount: number;
  metadata?: JsonObject;
  startPrice: number;
  reservePrice?: number | null;
  buyoutPrice?: number | null;
  minIncrement?: number;
  startAt?: Date; // 使用 Date
  endAt: Date; // 使用 Date
  // extensionSeconds?: number | null;
  extensionMinutes?: number | null;
  depositRequired?: number | null;
  depositToken?: string | null;
  extra?: JsonObject;
  isAdminAction?: boolean;
}

export interface AuctionUpdateInput {
  uuid: string;
  state?: AuctionState;
  endAt?: Date;
  extensionSeconds?: number | null;
  extra?: JsonObject;
  buyoutPrice?: number | null;
  reservePrice?: number | null;
}

export interface AuctionDTO {
  id: number;
  uuid: string;
  isAdminAction: boolean;
  creator: string;
  targetType: AuctionTargetType;
  targetId: string;
  targetCount: number;
  metadata?: JsonObject | null;
  state: AuctionState;
  startPrice: number;
  reservePrice?: number | null;
  buyoutPrice?: number | null;
  minIncrement: number;

  startAt: Date;
  endAt: Date;
  extensionSeconds?: number | null;
  extendedUntil?: Date | null;
  depositRequired?: number | null;
  depositToken?: string | null;
  winner?: string | null;
  finalPrice?: number | null;
  extra?: JsonObject | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuctionDetailDTO extends AuctionDTO {
    currentMaxPrice?: number | null;
    currentMaxPriceUserUuid?: string | null;
}

export interface AuctionListItem {
  uuid: string;
  targetType: AuctionTargetType;
  targetId: string;
  targetCount: number;
  title?: string;
  thumbnailUrl?: string;
  state: AuctionState;
  currentHighest?: number | null;
  startPrice: number;
  buyoutPrice?: number | null;
  endAt: Date;
}

/* --- Bid --- */

export interface AuctionBidInput {
  auctionUuid: string;
  bidder: string;
  amount: number;
  maxProxy?: number | null;
  isProxy?: boolean;
  extra?: JsonObject;
}

export interface AuctionBidDTO {
  id: number;
  auctionUuid: string;
  bidder: string;
  amount: number;
  maxProxy?: number | null;
  isProxy: boolean;
  refunded: boolean;
  extra?: JsonObject | null;
  createdAt: Date;
}

export interface AuctionBidHistoryItem {
  id: number;
  bidder: string;
  amount: number;
  isProxy: boolean;
  maxProxy?: number | null;
  createdAt: Date;
  extra?: JsonObject | null;
}

export interface AuctionCurrentBid {
  bidder?: string | null;
  amount?: number | null;
  maxProxy?: number | null;
  updatedAt?: Date | null;
}

/* --- Deposit --- */

export interface AuctionDepositInput {
  auctionUuid: string;
  userUuid: string;
  amount: number;
  token?: string | null;
}

export interface AuctionDepositDTO {
  id: number;
  auctionUuid: string;
  userUuid: string;
  amount: number;
  token?: string | null;
  refunded: boolean;
  lockedUntil?: Date | null;
  createdAt: Date;
}

/* --- Settlement / Events --- */

export interface AuctionSettlementResult {
  auctionUuid: string;
  winner?: string | null;
  finalPrice?: number | null;
  refundedDeposits?: Array<{ userUuid: string; amount: number; token?: string | null }>;
  transferredMetadata?: JsonObject | null;
  settledAt: Date;
}

export type AuctionEventType = "AUCTION_CREATED" | "BID_PLACED" | "AUCTION_UPDATED" | "AUCTION_ENDED";

export interface AuctionEventPayload {
  type: AuctionEventType;
  auctionUuid: string;
  payload?: JsonObject | null;
  createdAt: Date;
}

/* --- Queries / Pagination --- */

export interface AuctionListQuery {
  page?: number;
  pageSize?: number;
  state?: AuctionState | "ALL";
  targetType?: AuctionTargetType;
  creator?: string;
  sortBy?: "endAt" | "createdAt" | "startPrice";
  sortOrder?: "asc" | "desc";
  search?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}