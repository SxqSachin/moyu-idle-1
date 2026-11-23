// Shared farming types for consistent client/server DTOs

export type FarmPlotState = 'LOCKED' | 'EMPTY' | 'GROWING' | 'READY' | 'WITHERED';

export type FarmAreaId = string; // e.g., 'home' | 'guild'

export interface FarmPlotDTO {
  id: number;
  uuid: string;
  userUuid: string;
  plotIndex: number;
  area: FarmAreaId;

  state: FarmPlotState;

  seedId: string | null;

  // 本轮种植配置（只在已播种时有值）
  fertilizers?: { id: string; stacks?: number }[]; // 施用的肥料
  // 统一的预估产出（含概率/范围）：
  // - 已包含普通与变异两类产物；其中变异产物的 percent 为“绝对概率”（已乘以最终变异概率）
  // - 收获时直接依据该列表进行物化
  expectedYield?: WeightedYield[];
  mutationChance?: number | null; // 最终变异概率（0~1）

  plantedAt: string | null; // ISO string for transport
  expectedHarvestAt: string | null;
  growthSecondsRequired: number | null;
  growthSecondsAccumulated: number;
  lastTickAt: string | null;

  autoReplant: boolean;
  config?: any;
  extra?: any;

  createdAt: string;
  updatedAt: string;
}

// Socket request payloads
export type ReqFarmPlots = { area?: FarmAreaId };
export type ReqUnlockPlot = { plotIndex: number; area?: FarmAreaId };
export type ReqPlantPlot = {
  plotIndex: number;
  seedId: string;
  // growthSecondsRequired?: number;
  area?: FarmAreaId;
  // 可选：施肥与预估产出参数
  fertilizers?: { id: string; stacks?: number }[];
  expectedYield?: WeightedYield[];
  // 变异产出通常由服务端按定义与肥料计算，无需客户端提供
  // mutationChance?: number;
};
export type ReqHarvestPlot = { plotIndex: number };
export type ReqToggleAutoReplant = { plotIndex: number; value: boolean };
// Create a new plot (append next index). If area omitted, defaults to 'home'.
export type ReqCreatePlot = { area?: FarmAreaId };
// Shovel/clear current plot (discard current crop, no rewards)
export type ReqShovelPlot = { plotIndex: number };

// =====================
// Planting data models
// =====================
import type { ResourceRequirement } from './gameAction'
import type { AllGameResourceID } from './gameResource'

// Weighted/quantified yield entry with optional probability and range support
export type WeightedYield =
  | { id: AllGameResourceID; count: number; percent?: number }
  | { id: AllGameResourceID; range: { min: number; max: number }; percent?: number };

// Defines fertilizer effects that can be applied to a planting lifecycle
export type FertilizerEffect =
  | {
      type: 'shortenDuration';
      // 缩短总生长时间
      seconds?: number; // 固定减少的秒数
      percent?: number; // 按 (1 - percent) 倍缩短，例如 0.1 表示加速 10%
    }
  | {
      type: 'increaseYield';
      // 增加最终产量
      flat?: number; // 为每条产出增加固定数量
      percent?: number; // 产量按 (1 + percent) 倍增加
    }
  | {
      type: 'increaseMutationChance';
      // 提高变异/稀有结果的概率
      percentPoint?: number; // 增加绝对百分点，例如 0.05 表示 +5 个百分点
    }
  | {
      type: 'adjustMutationChance';
      // 调整变异概率：支持绝对值或乘数
      percentPoint?: number; // 绝对百分点增量，例如 +0.05 表示 +5 个百分点
      multiply?: number; // 按倍数相乘，例如 1.1 表示提高 10%
    }
  | {
      type: 'adjustYieldProbability';
      // 调整单项产出概率
      scope?: 'normal' | 'mutation' | 'all'; // 作用范围：普通/变异/全部
      selector?: 'ALL' | 'BY_ID'; // 选择器：全部或按资源ID
      id?: AllGameResourceID; // 当 selector=BY_ID 时填写对应资源ID
      percentPoint?: number; // 概率的绝对百分点变化，例如 +0.05 表示 +5 个百分点
      multiply?: number; // 概率按倍数相乘，例如 1.2 表示提升 20%
    };

// Config describing a fertilizer item and its effects
export interface FertilizerConfig {
  id: AllGameResourceID; // 肥料的资源ID
  effects: FertilizerEffect[]; // 生效规则
  cost?: ResourceRequirement[]; // 使用成本（可选）
  maxStacks?: number; // 单田地最大叠加层数（默认不叠加）
}

// Seed/planting definition to drive client/server logic
export interface SeedPlantingConfig {
  seedId: AllGameResourceID; // 种子资源ID
  // 常规产出（可含概率）；至少提供一个
  yields: WeightedYield[];
  // 变异产出（可含概率，选填）
  mutationYields?: WeightedYield[];
  fertilizable: boolean; // 是否可施肥
  fertilizerIds?: AllGameResourceID[]; // 可用/推荐的肥料（可选，逗号分隔在表中）

  plantCost?: ResourceRequirement[]; // 播种成本（可选）

  farmingPlantLevelRequired?: number; // 种植等级需求
  farmingPlantExpGainWhenHarvest?: number; // 收获时获得的种植经验

  // 可选基础参数，方便做数据驱动（保留灵活性）
  baseGrowthSeconds?: number; // 基础生长时长
  baseMutationChance?: number; // 基础变异概率（0~1）
}

// Parsed Excel definitions
export interface CropDefinition {
  seedId: AllGameResourceID;
  name?: string;
  plantCost?: ResourceRequirement[];
  yields: WeightedYield[];
  mutationYields?: WeightedYield[];
  baseGrowthSeconds?: number;
  baseMutationChance?: number;
  fertilizable?: boolean;
  fertilizerIds?: AllGameResourceID[];
  farmingPlantLevelRequired?: number; // 种植等级需求
  farmingPlantExpGainWhenHarvest?: number; // 收获时获得的种植经验
}

export interface FertilizerDefinition {
  id: AllGameResourceID;
  name?: string;
  effects: FertilizerEffect[];
  cost?: ResourceRequirement[];
  maxStacks?: number;
}
