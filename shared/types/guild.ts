import type { MinMax } from ".";
import type { allGuildBuilding } from "../data/allGuildBuilding";
import type { AllBattleStateId, AllGlobalActionDurationEffectStateId, AllGlobalEffectStateId } from "./BattleState";
import type { GameActionReward } from "./gameAction";
import type { ItemCountInfo } from "./gameInventory";

export interface GameGuild {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  owner: string;
  create_date: Date;
  update_date: Date;
  is_open: boolean;
  is_active: boolean;
  is_deleted: boolean;
  type: string[];
  gold: number;
  level: number;
  experience: number;
  ironcat: boolean;
}

export enum GuildRole {
  MEMBER = "MEMBER", // 普通成员
  OFFICER = "OFFICER", // 干部
  LEADER = "LEADER", // 会长
}

export type GuildMemberInfo = {
  guildUuid: string
  role: GuildRole
}

export const getGuildRoleName = (role: GuildRole): string => {
  switch (role) {
    case GuildRole.MEMBER:
      return "成员猫猫";
    case GuildRole.OFFICER:
      return "组长猫猫";
    case GuildRole.LEADER:
      return "会长猫猫";
    default:
      return "成员猫猫";
  }
}

export enum GuildBuildingStatus {
  UNBUILD = "UNBUILD", // 未建造
  PREPARE = "PREPARE", // 准备建造
  BUILDING = "BUILDING",  // 建造中

  NORMAL = "NORMAL",

  PREPARE_UPGRADE = "PREPARE_UPGRADE", // 准备升级
  UPGRADING = "UPGRADING",
  DESTROYED = "DESTROYED",
}

export interface GameGuildBuilding {
  // id: number;
  uuid: string;
  guildUuid: string;
  type: keyof typeof allGuildBuilding; // 建筑类型，如 "hall", "warehouse", "shop", "statue", "garden" 等
  level: number;
  exp: number;
  maxLevel: number;
  status: GuildBuildingStatus;

  startBuildAt?: Date | null; // 开始建造时间
  endBuildAt?: Date | null; // 预计结束建造时间

  startUpgradeAt?: Date | null; // 开始升级时间
  endUpgradeAt?: Date | null; // 预计结束升级时间


  createdAt: Date;
  updatedAt: Date;
  extra?: string | null;
}

export interface GuildBuildingConfig<T = unknown> {
  id: string; // 建筑唯一ID
  name: string; // 建筑名称
  description: string; // 建筑描述
  icon: string;
  iconSize?: number;

  maxLevel: number;

  buildCost: ItemCountInfo;
  buildDuration: number;

  upgradeCost: (level: number) => ItemCountInfo;
  upgradeDuration: (level: number) => number;

  maintenanceFee: (level: number) => ItemCountInfo;

  effect: (level: number) => T;
  effectStr: (level: number) => string[];

  buildPrerequisite?: {
    buildingId: string;      // 依赖的建筑ID
    minLevel?: number;       // 依赖建筑的最低等级（可选）
  }[];
}

export interface WarehouseEffect {
  capacity: number;
}



export type AllGuildBuildingId = keyof typeof allGuildBuilding;

export interface GuildInventoryItem {
  itemId: string;
  count: number;
  minRoleToWithdraw: string | null;
  // createdAt: Date;
  // updatedAt: Date;
  extra: string | null;
}

export interface GuildInventoryDonation {
  uuid: string;
  donorUuid: string;
  // itemId: string;
  // amount: number;

  info: ItemCountInfo;

  reason: string | null;
  createdAt: Date;
}

export enum GuildInventoryWithdrawStatus {
  PENDING = "PENDING", // 待处理
  APPROVED = "APPROVED", // 已批准
  REJECTED = "REJECTED", // 已拒绝
  CANCELLED = "CANCELLED", // 已取消
}

export interface GuildInventoryWithdrawal {
  uuid: string;
  itemId: string;
  withdrawerUuid: string;
  amount: number;
  reason: string | null;
  status: GuildInventoryWithdrawStatus;
  createdAt: Date;

  handledBy?: string | null; // 审核人用户uuid（可选）
  handledAt?: Date | null; // 审核时间（可选）
}

// 许愿池效果
export interface WishingPoolEffect {
  luck: MinMax;
  rewardPool: GameActionReward[]
}
export interface VitalityCatStatueEffect {
  availableBuffs: {
    id: AllBattleStateId;
    name: string;
    duration: number;
    value: number;
    untilHours: number
  };
}

export interface BigCozyDenEffects {
  maxGuildMemberIncrease: number; // 公会成员上限增加
}

export interface DenseFogLighthouseEffect {
  effects: {
    duration: number;
    dealDamageIncrease: number;
    takeDamageDecrease: number;
    modifyWhenAlone: number;
    untilHours: number
  };
}

export interface GuildGrandBathhouseEffect {
  availableBuffs: {
    inBattleDuration: number;
    value: number;
    untilHours: number
  };
}