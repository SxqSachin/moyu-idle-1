import type { AllFishingBaitId } from "../data/allFishBaitInfo";
import type { AllFishSpeciesID } from "../data/allFishSpecies";
import type { CharacterStatusRequirement } from "./gameAction"
import type { ItemCountInfo } from "./gameInventory";

export interface FishPondFishConfig {
    speciesId: AllFishSpeciesID

    weight: number; // 相对权重
}
export interface FishPond {
    id: string
    name: string

    groundWidth: number // 可选：钓场地面宽度（用于客户端钓点生成等）
    groundHeight: number // 可选：钓场地面高度
    pondWidth: number // 可选：钓场水面宽度
    pondHeight: number // 可选：钓场水面高度

    fishConfig: FishPondFishConfig[]
}

export interface FishSpecies {
  // 程序唯一标识，例如 "carp_common"
  id: string
  // 显示名称
  name: string
  icon: string
  description: string

  percent: number

  rarity: number
  qualityWeight: number[]

  // 长度范围（单位由产品规定，例如 cm）
  minLength: number
  maxLength: number

  minWeight: number
  maxWeight: number

  // 相对稀有度（数值越大越常见，或用 spawnWeight 直接计算权重）

  neededStatus: CharacterStatusRequirement[]
  neededConfiguration: { [key: string]: boolean }
  neededBait: string[]

  // 可选：按季节/时段限制
  seasons?: string[] // 例如 ["spring","summer"]
  // 活跃时间段，使用字符串 HH:mm 格式，例如 { start: "06:00", end: "18:30" }
  activeHours?: { start: string; end: string }

  shopBaseRecallPrice: number // 基础回收价
  extraPriceForEachLength: number
  extraPriceForEachWeight: number
  extraPriceForEachQuality: number

  disabled?: boolean // 是否禁用

  asResource?: boolean // 是否作为资源存在（而非仅作为钓鱼物种）
  resourcePool?: { [key: string]: number } // 作为资源时的产出池，key 为资源 id，value 为相对权重


  exp: number;

//   // 捕获后的掉落配置
//   drops?: ResourceDrop[]

  // 可放置任意扩展字段（JSON 原样保存）
//   extra?: any
}

export interface FishingToolSnapshot {
  // 在会话中记录的道具快照（工具不持久化为表）
  rod?: string // 钓竿 id
  net?: string // 抄网 id
  cage?: string // 鱼笼 id
  bait?: string // 饵料 id
  // 以及其他道具/强化信息
  [key: string]: any
}

// ===== DTO types that mirror Prisma schema for fishing-related tables =====
// Timestamps are represented as `Date` objects in internal DTOs.

export interface BaitEventDTO {
  id: number
  userUuid: string
  pointX: number
  pointY: number
  radius: number
  startedAt: Date
  expiresAt: Date
  strength: number
  shared: boolean
  note?: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * DTO for a player-created fishing bait/attraction area
 */
export interface FishingBaitAreaDTO {
  id: number
  uuid: string
  userUuid: string
  pondId?: string | null
  pointX: number
  pointY: number
  radius: number
  baitId: string
  effect?: any | null
  startedAt: Date
  expiresAt?: Date | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Lightweight DTO returned to clients when listing nearby bait areas
 */
export interface NearbyBaitAreaDTO {
  uuid: string
  userUuid: string
  pondId?: string | null
  pointX: number
  pointY: number
  radius: number
  baitId: string
  effect?: any | null
  startedAt: Date
  expiresAt?: Date | null
  active: boolean
}

export interface FishingSessionDTO {
  id: number;
  uuid: string;
  userUuid: string;
  characterUuid?: string | null;
  pointX: number;
  pointY: number;
  pondId?: string | null;
  startAt: Date;
  endAt?: Date | null;
  durationSec?: number | null;

  // toolConfig is stored as LongText JSON in DB; DTO exposes parsed object or raw string
  toolConfig?: any | null;
  baitConfig?: { [key: string]: number };

  rngSeed: string;
  endConditions: any | null;
  endAction: "STOP" | "CONTINUE";
  actorType: "PLAYER" | "KITTY";
  actorId: string;
  resultSummary?: any | null;
  visiblePlayers?: any | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface CaughtFishDTO {
  id: number
  userUuid: string
  sessionId: string
  pondId: string
  fishId: string
  length: number
  weight?: number | null
  quality?: number | null
  caughtAt: Date
  extra?: any | null
  createdAt: Date

  asResource?: boolean // 是否作为资源
  resourceResult?: {[key: string]: number} // 作为资源时的产出结果
}

export interface ActiveFishingSessionDTO {
  id: number
  sessionId: string 
  userUuid: string
  pointX: number
  pointY: number
  pondId?: string | null
  startedAt: Date
  endConditions: any | null
  endAction: "STOP" | "CONTINUE"
  actorType: "PLAYER" | "KITTY"
  actorId: string
}

export interface ActiveSession {
  sessionId: string;

  userUuid: string;
  name: string;
  avatar: string;

  characterUuid?: string | null;
  pointX: number;
  pointY: number;
  pondId: string | null;
  startedAt: Date;
  rndSeed: string;
  endConditions: any | null
  endAction: "STOP" | "CONTINUE"
  actorType: "PLAYER" | "KITTY"
  actorId: string
}
export interface NearbyPlayer {
  userUuid: string
  name: string
  avatar: string

  pointX: number
  pointY: number

  sessionId: string
  startedAt: Date

  endConditions: any | null
  endAction: "STOP" | "CONTINUE"
  actorType: "PLAYER" | "KITTY"
  actorId: string
}

export interface SellCaughtFishReceipt {
  caughtFishId: number
  fishId: AllFishSpeciesID
  length: number
  weight?: number | null
  quality?: number | null
  amount: number
}

export interface BatchSellCaughtFishSuccessPayload {
  sold: SellCaughtFishReceipt[]
  totalAmount: number
  received: ItemCountInfo
}

export interface FishBaitInfo {
  resourceId: AllFishingBaitId

  baitAreaDurationSec: number
  baitAreaRadius: number

  baitAreaHookTimeReductionPercent: number
  baitAreaBiteRateIncreasePercent: number
  baitAreaPreferredSpeciesPercentBoost: { [key in AllFishSpeciesID]?: number} // 对特定鱼种的加成
  baitAreaPreferredSpeciesWeightBoost: { [key in AllFishSpeciesID]?: number} // 对特定鱼种的加成


  hookTimeReductionPercent: number // 降低上钩时间(%)
  biteRateIncreasePercent: number // 提升咬口率(%)
  preferredSpeciesBoost: { [key in AllFishSpeciesID]?: number} // 对特定鱼种的加成
}