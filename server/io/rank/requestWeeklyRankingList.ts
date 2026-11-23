import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { RankingList, } from "~/shared/types/rankingList";
import { emitEventToUser } from "..";
import { getAllRankingList } from "../../utils/game/rankingList";
import { getWeeklyIronLeaderboard, getWeeklyLeaderboard } from "~/server/utils/game/weeklyPlayerStats";
import { GetLeaderboardParams, LeaderboardCategory, LeaderboardResponse } from "~/shared/types/weeklyPlayerStats";
import { safeJsonParse } from "~/shared/utils";

let key = "WEEKLY_RANKING_LIST:";
const getWeeklyRankingRedisKey = (date: Date, category: LeaderboardCategory) => {
  return key + generateWeeklyPeriodId(date) + ":" + category;
}

export async function handleRequestWeeklyRankingList(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<GetLeaderboardParams>
) {
  if (!data.data || !data.data.category) {
    return;
  }

  if (!data.data.date) {
    data.data.date = new Date();
  } else {
    data.data.date = new Date(data.data.date);
  }

  let redisKey = getWeeklyRankingRedisKey(data.data.date, data.data.category);
  let cache = await redisClient.get(redisKey);
  if (cache) {
    try {
      let rankingList: LeaderboardResponse = safeJsonParse(cache);
      emitEventToUser(data.user.uuid, 'weeklyRankingList', rankingList);
      return;
    } catch (error) {
    }
  }

  const rankingList = await getWeeklyLeaderboard(data.data)

  await redisClient.set(redisKey, JSON.stringify(rankingList), {
    expiration: {
      type: 'EX',
      value: 60 * 30, // 缓存30分钟
    }
  });

  emitEventToUser(data.user.uuid, 'weeklyRankingList', rankingList)
}

export async function handleRequestWeeklyIronRankingList(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<GetLeaderboardParams>
) {
  if (!data.data || !data.data.category) {
    return;
  }

  if (!data.data.date) {
    data.data.date = new Date();
  } else {
    data.data.date = new Date(data.data.date);
  }

  let redisKey = getWeeklyRankingRedisKey(data.data.date, data.data.category) + ":iron";
  let cache = await redisClient.get(redisKey);
  if (cache) {
    try {
      let rankingList: LeaderboardResponse = safeJsonParse(cache);
      emitEventToUser(data.user.uuid, 'weeklyIronRankingList', rankingList);
      return;
    } catch (error) {
    }
  }

  const rankingList = await getWeeklyIronLeaderboard(data.data)

  await redisClient.set(redisKey, JSON.stringify(rankingList), {
    expiration: {
      type: 'EX',
      value: 60 * 30, // 缓存30分钟
    }
  });

  emitEventToUser(data.user.uuid, 'weeklyIronRankingList', rankingList)
}

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