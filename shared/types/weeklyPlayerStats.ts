import type { AllBaseCharacterStatusType, AllCharacterStatusType, CharacterStatusImprove } from "./characterInfo";

export interface WeeklyPlayerStatsData {
  id: number;
  uuid: string;
  userUuid: string;
  weeklyPeriodId: string; // 格式: "2025-043" (年-周)
  
  // 金币统计
  goldEarned: bigint;
  goldSpent: bigint;
  
  // 属性经验统计
  collecting: number;
  fishing: number;
  mining: number;
  farmingAnimal: number;
  farmingPlant: number;
  cooking: number;
  forging: number;
  sewing: number;
  manufacturing: number;
  trading: number;
  knowledge: number;
  mysterious: number;
  enhance: number;
  exploring: number;
  luck: number;
  
  battle: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  stamina: number;
  attacking: number;
  defencing: number;
  
  // 总计
  total: number;
  
  // 时间记录
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyLeaderboardEntry {
  rank: number;
  userUuid: string;
  weeklyPeriodId: string;
  value: number;
  goldEarned: number;
}

// 排行榜类别类型
export type LeaderboardCategory = 'goldEarned' | 'total' | AllBaseCharacterStatusType;

// 添加金币统计的参数类型
export interface AddGoldStatsParams {
  userUuid: string;
  goldAmount: bigint;
  // actionType?: string; // 可选：记录获得金币的行动类型
}

export interface AddPlayerExpStatsParams {
  userUuid: string;
  statusImprovements: CharacterStatusImprove[];
}

// 查询玩家数据的选项类型
export interface GetPlayersStatsOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'goldEarned' | 'total' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
  includeInactive?: boolean; // 是否包含本周无活动的玩家
}

// 榜单请求参数类型
export interface GetLeaderboardParams {
  category: LeaderboardCategory; // 榜单类别
  date?: Date; // 日期参数，默认为当前日期
}

// 榜单响应数据类型
export interface LeaderboardResponse {
  category: LeaderboardCategory;
  totalCount: number; // 总参与人数
  entries: WeeklyLeaderboardEntry[];
}