import type { AllBaseCharacterStatusType, AllCharacterStatusType } from "~/shared/types/characterInfo";
import { v4 } from "uuid";
import type {
  AddGoldStatsParams,
  AddPlayerExpStatsParams,
  GetLeaderboardParams,
  GetPlayersStatsOptions,
  LeaderboardCategory,
  LeaderboardResponse,
  WeeklyLeaderboardEntry,
  WeeklyPlayerStatsData,
} from "~/shared/types/weeklyPlayerStats";
import {
  allCharacterBaseStatusType,
  allCharacterStatusType,
} from "~/shared/data/allCharacterStatus";
import { prisma } from "./db";
import { AccountPlayType } from "~/shared/types/account";
import type { PlayerProfileInfo } from "~/shared/types/characterInfo";
import { safeJsonParse } from "~/shared/utils";

export type WeeklyStatsDelta = {
  userUuid: string;
  goldEarned?: number | bigint;
  goldSpent?: number | bigint;
  statusImprovements?: { status: AllBaseCharacterStatusType; increaseExp: number }[];
  weeklyPeriodId?: string;
  date?: Date;
};

// 工具函数：获取日期所在的年份和周数
function getYearAndWeek(date: Date): { year: number; week: number } {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);

  // 设置为当年的1月4日（ISO 8601标准）
  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));

  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  const year = tempDate.getFullYear();
  const week =
    1 +
    Math.round(
      ((tempDate.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    );

  return { year, week };
}

// 工具函数：生成周期ID
function generateWeeklyPeriodId(date: Date): string {
  const { year, week } = getYearAndWeek(date);
  return `${year}-${week.toString().padStart(3, "0")}`; // 例: "2025-043"
}

// 工具函数：生成UUID
function generateUUID(): string {
  return v4();
}

const toBigIntSafe = (v: number | bigint | undefined): bigint => {
  if (v === undefined) return 0n;
  if (typeof v === "bigint") return v;
  if (Number.isNaN(v)) return 0n;
  return BigInt(Math.trunc(v));
};

// -------- 内存聚合缓冲（服务端版本） --------
const BUFFER_MAX_ITEMS = 2000;
const BUFFER_MAX_AGE_MS = 30_000;
const TX_BATCH_SIZE = 500; // 限制单事务 upsert 数量，缩短锁持有时间
type BufferEntry = {
  userUuid: string;
  weeklyPeriodId: string;
  goldEarned: bigint;
  goldSpent: bigint;
  totals: Partial<Record<AllCharacterStatusType | "total", number>>;
  updatedAt: number;
};
const weeklyStatsBuffer = new Map<string, BufferEntry>();

const bufferToDeltas = (): WeeklyStatsDelta[] => {
  const res: WeeklyStatsDelta[] = [];
  for (const entry of weeklyStatsBuffer.values()) {
    const statusImprovements: { status: AllBaseCharacterStatusType; increaseExp: number }[] = [];
    for (const key of Object.keys(entry.totals)) {
      if (key === "total") continue;
      const val = entry.totals[key as AllCharacterStatusType];
      if (!val || !Number.isFinite(val) || val <= 0) continue;
      statusImprovements.push({
        status: key as AllBaseCharacterStatusType,
        increaseExp: +val.toFixed(2),
      });
    }
    res.push({
      userUuid: entry.userUuid,
      weeklyPeriodId: entry.weeklyPeriodId,
      goldEarned: entry.goldEarned,
      goldSpent: entry.goldSpent,
      statusImprovements,
    });
  }
  return res;
};

const flushWeeklyBuffer = async (force = false) => {
  if (!weeklyStatsBuffer.size) return;
  if (!force) {
    const tooMany = weeklyStatsBuffer.size >= BUFFER_MAX_ITEMS;
    const now = Date.now();
    let tooOld = false;
    for (const e of weeklyStatsBuffer.values()) {
      if (now - e.updatedAt >= BUFFER_MAX_AGE_MS) {
        tooOld = true;
        break;
      }
    }
    if (!tooMany && !tooOld) return;
  }
  const deltas = bufferToDeltas();
  weeklyStatsBuffer.clear();
  await applyWeeklyStatsDeltas(deltas);
};

const enqueueWeeklyDelta = async (
  delta: WeeklyStatsDelta,
  date?: Date
) => {
  const weeklyPeriodId =
    delta.weeklyPeriodId ||
    (delta.date ? generateWeeklyPeriodId(delta.date) : generateWeeklyPeriodId(date || new Date()));
  const key = `${delta.userUuid}::${weeklyPeriodId}`;
  const now = Date.now();
  if (!weeklyStatsBuffer.has(key)) {
    weeklyStatsBuffer.set(key, {
      userUuid: delta.userUuid,
      weeklyPeriodId,
      goldEarned: 0n,
      goldSpent: 0n,
      totals: { total: 0 },
      updatedAt: now,
    });
  }
  const entry = weeklyStatsBuffer.get(key)!;
  entry.updatedAt = now;
  entry.goldEarned += toBigIntSafe(delta.goldEarned);
  entry.goldSpent += toBigIntSafe(delta.goldSpent);
  if (delta.statusImprovements?.length) {
    for (const imp of delta.statusImprovements) {
      if (!allCharacterBaseStatusType.includes(imp.status)) continue;
      const val = Math.max(0, imp.increaseExp);
      if (!Number.isFinite(val) || val <= 0) continue;
      entry.totals[imp.status] = (entry.totals[imp.status] || 0) + +val.toFixed(2);
      entry.totals.total = (entry.totals.total || 0) + +val.toFixed(2);
    }
  }
  if (weeklyStatsBuffer.size >= BUFFER_MAX_ITEMS) {
    await flushWeeklyBuffer(true);
  } else {
    setTimeout(() => {
      void flushWeeklyBuffer(false);
    }, BUFFER_MAX_AGE_MS + 1000);
  }
};

/**
 * 根据日期参数，获取对应周次的所有玩家数据
 * @param date 日期参数
 * @param options 查询选项
 * @returns 玩家统计数据列表
 */
export async function getWeeklyPlayersStats(
  options: GetPlayersStatsOptions = {},
  date?: Date
): Promise<WeeklyPlayerStatsData[]> {
  if (!date) {
    date = new Date();
  }
  const {
    limit = 100,
    offset = 0,
    orderBy = "total",
    orderDirection = "desc",
    includeInactive = false,
  } = options;

  try {
    const weeklyPeriodId = generateWeeklyPeriodId(date);

    const whereClause: any = {
      weeklyPeriodId,
    };

    // 如果不包含无活动玩家，添加过滤条件
    if (!includeInactive) {
      whereClause.OR = [{ goldEarned: { gt: 0 } }, { total: { gt: 0 } }];
    }

    const playersStats = await prisma.weeklyPlayerStats.findMany({
      where: whereClause,
      orderBy: { [orderBy]: orderDirection },
      take: limit,
      skip: offset,
    });

    return playersStats as WeeklyPlayerStatsData[];
  } catch (error) {
    console.error("获取周统计数据失败:", error);
    throw new Error(
      `Failed to get weekly players stats: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * 根据日期参数，为指定玩家添加金币统计数据
 * @param params 添加金币参数
 * @param date 日期参数
 * @returns 更新后的统计数据
 */
export async function addPlayerGoldStats(
  params: AddGoldStatsParams,
  date?: Date
): Promise<WeeklyPlayerStatsData> {
  const { userUuid, goldAmount } = params;

  if (!date) {
    date = new Date();
  }

  try {
    await enqueueWeeklyDelta({ userUuid, goldEarned: goldAmount }, date);
    await flushWeeklyBuffer(false);
    return {
      userUuid,
      weeklyPeriodId: generateWeeklyPeriodId(date || new Date()),
    } as WeeklyPlayerStatsData;
  } catch (error) {
    console.error("添加金币统计失败:", error);
    throw new Error(
      `Failed to add gold stats: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function decreasePlayerGoldStats(
  params: AddGoldStatsParams,
  date?: Date
): Promise<WeeklyPlayerStatsData> {
  const { userUuid, goldAmount } = params;

  if (!date) {
    date = new Date();
  }

  try {
    await enqueueWeeklyDelta({ userUuid, goldSpent: goldAmount }, date);
    await flushWeeklyBuffer(false);
    return {
      userUuid,
      weeklyPeriodId: generateWeeklyPeriodId(date || new Date()),
    } as WeeklyPlayerStatsData;
  } catch (error) {
    console.error("添加金币统计失败:", error);
    throw new Error(
      `Failed to add gold stats: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * 根据日期参数，为指定玩家添加指定属性的经验
 * @param params 添加经验参数
 * @param date 日期参数
 * @returns 更新后的统计数据
 */
export async function addPlayerExpStats(
  params: AddPlayerExpStatsParams,
  date?: Date
): Promise<WeeklyPlayerStatsData> {
  const { userUuid, statusImprovements } = params;

  if (!date) {
    date = new Date();
  }

  try {
    const valid = statusImprovements.filter(
      (improvement) =>
        allCharacterBaseStatusType.includes(improvement.status) &&
        improvement.increaseExp > 0
    );
    if (!valid.length) {
      return {
        userUuid,
        weeklyPeriodId: generateWeeklyPeriodId(date || new Date()),
      } as WeeklyPlayerStatsData;
    }
    await enqueueWeeklyDelta({ userUuid, statusImprovements: valid }, date);
    await flushWeeklyBuffer(false);
    return {
      userUuid,
      weeklyPeriodId: generateWeeklyPeriodId(date || new Date()),
    } as WeeklyPlayerStatsData;
  } catch (error) {
    console.error("添加经验统计失败:", error);
    throw new Error(
      `Failed to add exp stats: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * 批量合并周统计增量，单事务一批，显著降低 TPS 与 COMMIT 次数。
 * 调用方应先在内存/队列聚合，再定期调用此函数落库。
 */
export async function applyWeeklyStatsDeltas(
  deltas: WeeklyStatsDelta[],
  date?: Date
): Promise<void> {
  if (!deltas.length) return;

  const now = new Date();
  const defaultPeriodId = generateWeeklyPeriodId(date || now);
  const grouped = new Map<string, {
    userUuid: string;
    weeklyPeriodId: string;
    goldEarned: bigint;
    goldSpent: bigint;
    totals: Record<AllCharacterStatusType | "total", number>;
  }>();

  for (const delta of deltas) {
    const weeklyPeriodId =
      delta.weeklyPeriodId ||
      (delta.date ? generateWeeklyPeriodId(delta.date) : defaultPeriodId);
    const key = `${delta.userUuid}::${weeklyPeriodId}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        userUuid: delta.userUuid,
        weeklyPeriodId,
        goldEarned: 0n,
        goldSpent: 0n,
        totals: { total: 0 },
      } as any);
    }
    const g = grouped.get(key)!;

    g.goldEarned += toBigIntSafe(delta.goldEarned);
    g.goldSpent += toBigIntSafe(delta.goldSpent);

    if (delta.statusImprovements?.length) {
      for (const imp of delta.statusImprovements) {
        if (!allCharacterBaseStatusType.includes(imp.status)) continue;
        const val = Math.max(0, imp.increaseExp);
        if (!Number.isFinite(val) || val <= 0) continue;
        g.totals[imp.status] = (g.totals[imp.status] || 0) + +val.toFixed(2);
        g.totals.total = (g.totals.total || 0) + +val.toFixed(2);
      }
    }
  }

  const tx = prisma;
  const entries = Array.from(grouped.values());
  for (let i = 0; i < entries.length; i += TX_BATCH_SIZE) {
    const slice = entries.slice(i, i + TX_BATCH_SIZE);
    // await prisma.$transaction(async (tx) => {
      for (const { userUuid, weeklyPeriodId, goldEarned, goldSpent, totals } of slice) {
        const hasGold = goldEarned !== 0n || goldSpent !== 0n;
        const hasStat = Object.keys(totals).length > 1 || (totals.total || 0) > 0;
        if (!hasGold && !hasStat) continue;

        const updateData: any = { updatedAt: now };
        const createData: any = {
          uuid: generateUUID(),
          userUuid,
          weeklyPeriodId,
        };

        if (goldEarned !== 0n) {
          updateData.goldEarned = { increment: goldEarned };
          createData.goldEarned = goldEarned;
        }
        if (goldSpent !== 0n) {
          updateData.goldSpent = { increment: goldSpent };
          createData.goldSpent = goldSpent;
        }

        for (const key of Object.keys(totals)) {
          const val = totals[key as keyof typeof totals];
          if (!val || !Number.isFinite(val) || val <= 0) continue;
          updateData[key] = { increment: +val.toFixed(2) };
          createData[key] = +val.toFixed(2);
        }

        await tx.weeklyPlayerStats.upsert({
          where: { user_weekly_unique: { userUuid, weeklyPeriodId } },
          update: updateData,
          create: createData,
        });
      }
    // });
  }
}

export async function getWeeklyLeaderboard(
  params: GetLeaderboardParams
): Promise<LeaderboardResponse> {
  let {
    category,
    date
  } = params;

  if (!date) {
    date = new Date();
  } else {
    date = new Date(date);
  }

  try {
    const weeklyPeriodId = generateWeeklyPeriodId(date);

    // 验证榜单类别
    const validCategories = [
      'goldEarned',
      'total',
      ...allCharacterBaseStatusType,
    ];

    if (!validCategories.includes(category)) {
      throw new Error(`Invalid leaderboard category: ${category}`);
    }

    // 构建查询条件
    const whereClause: any = {
      weeklyPeriodId,
      [category]: { gt: 0 }, // 只显示有数据的玩家
    };

    const bannedUser = await prisma.user.findMany({
      where: {
        OR: [
          { is_banned: true },
          { is_gm: true },
          { accountPlayType: AccountPlayType.IRON },
        ],
      },
      select: {
        uuid: true,
        option: true,
      }
    });
    const bannedUserUuids = bannedUser.map(user => user.uuid);

    // 额外过滤：如果用户在 option 中设置了 hideInRankingList，则也排除
    const usersWithHideOption = await prisma.user.findMany({
      where: { option: { contains: 'hideInRankingList' } },
      select: { uuid: true, option: true },
    });
    const hiddenUuids = usersWithHideOption
      .filter(u => {
        try {
          const opt = safeJsonParse<PlayerProfileInfo['option']>(u.option, {});
          return !!opt?.hideInRankingList;
        } catch {
          return false;
        }
      })
      .map(u => u.uuid);

    const excludedUuidsSet = new Set<string>([...bannedUserUuids, ...hiddenUuids]);

    // 并行查询总数和榜单数据
    const [totalCount, playersStats] = await Promise.all([
      // 获取总参与人数
      prisma.weeklyPlayerStats.count({ where: whereClause }),

      // 获取榜单数据
      prisma.weeklyPlayerStats.findMany({
        where: whereClause,
        orderBy: { [category]: 'desc' },
        take: 50,
      }),
    ]);

    // 过滤掉被封禁的玩家
    const filteredPlayersStats = playersStats.filter(
      (stats) => !excludedUuidsSet.has(stats.userUuid)
    );

    // 处理榜单条目
    const entries: WeeklyLeaderboardEntry[] = filteredPlayersStats.map((stats, index) => {
      // 处理不同类型的值
      let value: number;
      const fieldValue = stats[category as keyof typeof stats];

      if (typeof fieldValue == 'bigint') {
        value = Number(fieldValue)
      } else if (typeof fieldValue == 'number') {
        value = +fieldValue.toFixed(2);
      } else {
        value = 0
      }

      const entry: WeeklyLeaderboardEntry = {
        rank: index + 1, // 考虑偏移量的排名
        userUuid: stats.userUuid,
        weeklyPeriodId: stats.weeklyPeriodId,
        value: Number(value),
        goldEarned: Number(stats.goldEarned),
      };

      return entry;
    });

    return {
      category,
      totalCount,
      entries,
    };
  } catch (error) {
    console.error('获取榜单失败:', error);
    throw new Error(
      `Failed to get leaderboard: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

export async function getWeeklyIronLeaderboard(
  params: GetLeaderboardParams
): Promise<LeaderboardResponse> {
  let {
    category,
    date
  } = params;

  if (!date) {
    date = new Date();
  } else {
    date = new Date(date);
  }

  try {
    const weeklyPeriodId = generateWeeklyPeriodId(date);

    // 验证榜单类别
    const validCategories = [
      'goldEarned',
      'total',
      ...allCharacterBaseStatusType,
    ];

    if (!validCategories.includes(category)) {
      throw new Error(`Invalid leaderboard category: ${category}`);
    }


    const availablePlayerUuidList = await prisma.user.findMany({
      where: {
        is_banned: false,
        is_gm: false,
        accountPlayType: AccountPlayType.IRON,
      },
      select: {
        uuid: true,
      },
    });
    const availablePlayerUuids = availablePlayerUuidList.map(user => user.uuid);

    // 构建查询条件
    const whereClause: any = {
      weeklyPeriodId,
      [category]: { gt: 0 }, // 只显示有数据的玩家
      userUuid: {
        in: availablePlayerUuids 
      }
    };

    // 额外过滤：如果用户在 option 中设置了 hideInRankingList，则也排除（仅针对铁猫玩家）
    const usersWithHideOption = await prisma.user.findMany({
      where: {
        option: { contains: 'hideInRankingList' },
        accountPlayType: AccountPlayType.IRON,
        is_banned: false,
        is_gm: false,
      },
      select: { uuid: true, option: true },
    });
    const hiddenUuids = usersWithHideOption
      .filter(u => {
        try {
          const opt = safeJsonParse<PlayerProfileInfo['option']>(u.option, {});
          return !!opt?.hideInRankingList;
        } catch {
          return false;
        }
      })
      .map(u => u.uuid);
    const excludedUuidsSet = new Set<string>(hiddenUuids);

    // 并行查询总数和榜单数据
    const [totalCount, playersStats] = await Promise.all([
      // 获取总参与人数
      prisma.weeklyPlayerStats.count({ where: whereClause }),

      // 获取榜单数据
      prisma.weeklyPlayerStats.findMany({
        where: whereClause,
        orderBy: { [category]: 'desc' },
        take: 50,
      }),
    ]);

    // 过滤掉被隐藏的玩家（hideInRankingList）
    const filteredPlayersStats = playersStats.filter(
      (stats) => !excludedUuidsSet.has(stats.userUuid)
    )

    // 处理榜单条目
    const entries: WeeklyLeaderboardEntry[] = filteredPlayersStats.map((stats, index) => {
      // 处理不同类型的值
      let value: number;
      const fieldValue = stats[category as keyof typeof stats];

      if (typeof fieldValue == 'bigint') {
        value = Number(fieldValue)
      } else if (typeof fieldValue == 'number') {
        value = +fieldValue.toFixed(2);
      } else {
        value = 0
      }

      const entry: WeeklyLeaderboardEntry = {
        rank: index + 1, // 考虑偏移量的排名
        userUuid: stats.userUuid,
        weeklyPeriodId: stats.weeklyPeriodId,
        value: Number(value),
        goldEarned: Number(stats.goldEarned),
      };

      return entry;
    });

    return {
      category,
      totalCount,
      entries,
    };
  } catch (error) {
    console.error('获取榜单失败:', error);
    throw new Error(
      `Failed to get leaderboard: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}