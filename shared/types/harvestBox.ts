import type { ItemCountInfo } from "./gameInventory";

// Shared types for Harvest Box system (server/client DTOs and server inputs)

export type HarvestBoxSource = "Auto" | "Manual" | "Event" | "Mail" | "GM" | "Other" | "ActionExtraReward" | "ActionDeductReturn";

// Server-side create input (used by producers to enqueue rewards)
export interface HarvestBoxCreateInput {
  userUuid: string;
  source?: HarvestBoxSource;
  sourceId?: string;
  title?: string;
  extra?: any; // JSON-serializable
  expiresAt?: Date | null;
  items: ItemCountInfo; // Aggregated item counts keyed by resourceId
}

// Server-side list query
export interface HarvestBoxListQuery {
  userUuid: string;
  includeClaimed?: boolean; // default false
  take?: number; // default 20, max 100
  beforeId?: number; // cursor for pagination (fetch items with id < beforeId)
}

// Server-side record shape (Dates and bigint retained)
export interface HarvestBoxItemRecord {
  id: number;
  resourceId: string;
  amount: bigint | number; // bigint in DB; number on DTO
  meta?: string | null;
  claimed: boolean;
  claimedAt?: Date | null;
}

export interface HarvestBoxRecord {
  id: number;
  uuid: string;
  title?: string | null;
  source?: HarvestBoxSource | null;
  sourceId?: string | null;
  createdAt: Date;
  expiresAt?: Date | null;
  claimed: boolean;
  items: HarvestBoxItemRecord[];
}

// Client-facing DTOs (JSON safe: numbers and ISO strings)
export interface HarvestBoxItemDTO {
  id: number;
  resourceId: string;
  amount: number;
  meta?: string | null;
  claimed: boolean;
  claimedAt?: string | null; // ISO string
}

export interface HarvestBoxListItemDTO {
  id: number;
  uuid: string;
  title?: string | null;
  source?: HarvestBoxSource | null;
  createdAt: string; // ISO string
  expiresAt?: string | null; // ISO string
  claimed: boolean;
  items: HarvestBoxItemDTO[];
}

// Socket request/response payloads
export type ReqHarvestBoxList = { includeClaimed?: boolean; take?: number; beforeId?: number };
export type ResHarvestBoxList = { list: HarvestBoxListItemDTO[]; hasMore: boolean; nextCursor?: number | null };
export type ReqHarvestBoxClaim = { boxId: number };
export type ReqHarvestBoxClaimItem = { itemId: number };
