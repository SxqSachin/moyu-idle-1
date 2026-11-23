import type { BaseBattleUnit } from "./unit"

export enum CharacterPhantomListingState {
  OPEN = "OPEN",
  PAUSED = "PAUSED",
  CLOSED = "CLOSED",
  REMOVED = "REMOVED"
}

export enum CharacterPhantomBorrowState {
  ACTIVE = "ACTIVE",
  RETURNED = "RETURNED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED"
}


export type CharacterPhantomListingCreateInput = {
  owner: string
  note?: string
  guildUuid?: string | null
  characterUuid: string
}

export type CharacterPhantomListingDTO = {
  id: number
  uuid: string
  owner: string
  guildUuid?: string | null
  characterUuid: string
  snapshot: BaseBattleUnit
  note: string
  isPublic: boolean
  state: CharacterPhantomListingState
  usageCount: number
  extra?: string | null
  created_at: Date
  updated_at: Date
}

export type CharacterPhantomBorrowCreateInput = {
  phantomUuid: string
  guildUuid: string
  // borrower: string
  // scheduledEnd?: Date | string | null
  // extra?: Record<string, any> | string
}

export type CharacterPhantomBorrowDTO = {
  id: number
  uuid: string
  listingUuid: string
  borrower: string
  phantomOwner: string
  characterUuid: string
  snapshot: BaseBattleUnit
  startAt: Date
  scheduledEnd?: Date | null
  returnedAt?: Date | null
  state: CharacterPhantomBorrowState
  extra?: string | null
  createdAt: Date
  updatedAt: Date
}

export type ListingQueryOptions = {
  owner?: string
  characterUuid?: string
  isPublic?: boolean
  state?: string
  limit?: number
  offset?: number
}