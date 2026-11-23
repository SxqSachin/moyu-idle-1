import type { allVillageBuilding } from "~/shared/data/allVillageBuilding";
import type { ItemCountInfo } from "../gameInventory";
import type { MinMax } from "..";

export enum VillageBuildingStatus {
  UNBUILD = "UNBUILD", // 未建造
  PREPARE = "PREPARE", // 准备建造
  BUILDING = "BUILDING",  // 建造中

  NORMAL = "NORMAL",
  PREPARE_UPGRADE = "PREPARE_UPGRADE",
  UPGRADING = "UPGRADING",
  DESTROYED = "DESTROYED",
}

export enum VillageBuildingMaterialFundStatus {
  COLLECTING = "COLLECTING", // 筹集材料中
  COMPLETED = "COMPLETED", // 筹集完成
}

export interface GameVillageBuilding {
  // id: number;
  uuid: string;

  type: keyof typeof allVillageBuilding; // 建筑类型，如 "hall", "warehouse", "shop", "statue", "garden" 等
  level: number;
  exp: number;
  maxLevel: number;
  status: VillageBuildingStatus;

  startBuildAt?: Date | null; // 开始建造时间
  endBuildAt?: Date | null; // 预计结束建造时间

  startUpgradeAt?: Date | null; // 开始升级时间
  endUpgradeAt?: Date | null; // 预计结束升级时间


  createdAt: Date;
  updatedAt: Date;
  extra?: string | null;
}

export interface VillageBuildingConfig<T = unknown, E = unknown> {
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

  extra?: (level: number) => E;

  buildPrerequisite?: {
    buildingId: string;      // 依赖的建筑ID
    minLevel?: number;       // 依赖建筑的最低等级（可选）
  }[];
}

export type BaseVillageBuildingInfo = {
  type: keyof typeof allVillageBuilding;
  level: number;
  extra: any
}

export interface CatVillageMonumentEffect {
  expPercent: number;

  donateExpPercent: number;
  extraOutputPercent: number;
}

export interface BattlePyreAltarEffect {
  durationSecondsEachDonate: number;

  baseExpPercent: number;

  donateExpPercent: number;
  donateExtraDropPercent: number;
}

export interface BattlePyreAltarExtraData {
  consecrateUntil: number;
}

export interface CatVillageMonumentExtraData {
  consecrateUntil: number;
}

export interface CatVillageMonumentExtraConfig {
  consecrateItems: ItemCountInfo;
  extraDropRewardPerTimes: number;
  rewardPool: {
    ids: string[];
    percent: number;
    range: MinMax
  }[];
}

export interface BattlePyreAltarExtraConfig {
  consecrateItems: ItemCountInfo;

  rewardPool: {
    ids: string[];
    percent: number;
    range: MinMax
  }[];

  extraDropRewardPerTimes: number;
}

export interface KittyHomeServiceCenter {
  description: string[]
}

export interface ResourceRecoveryCenter {
  description: string[]
}