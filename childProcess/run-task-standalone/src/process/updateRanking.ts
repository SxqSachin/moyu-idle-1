import { allCharacterStatusType } from "~/shared/data/allCharacterStatus"
import type { RankingListItem } from "~/shared/types/rankingList"
import type { UnitStatusDetail } from "~/shared/types/unit"
import { prisma } from "../utils/prisma"
import { redisClient } from '../utils/redis'
import { type PlayerProfileInfo, type CharacterStatusDetail } from "~/shared/types/characterInfo"
import { AccountPlayType } from "~/shared/types/account"
import { safeJsonParse } from "~/shared/utils"

async function updateGoldRankingList(users: any[], inventories: {
  user_uuid: string;
  item_id: string;
  count: bigint;
}[]) {
  // 普通玩家
  const normalUsers = users.filter(u => u.accountPlayType === AccountPlayType.NORMAL);
  const normalUserMap = new Map(normalUsers.map(u => [u.uuid, u.name]));
  const normalAvatarMap = new Map(normalUsers.map(u => [u.uuid, u.avatar]));
  const normalRanking: RankingListItem[] = inventories.filter(i => {
    return i.item_id == 'gold' && normalUserMap.has(i.user_uuid);
  }).map(inv => ({
    uuid: inv.user_uuid,
    name: normalUserMap.get(inv.user_uuid) ?? `未知用户(${inv.user_uuid})`,
    avatar: normalAvatarMap.get(inv.user_uuid) ?? 'avatar_1',
    rank: Number(inv.count)
  }));
  normalRanking.sort((a, b) => +b.rank - +a.rank);
  const topNormal = normalRanking.slice(0, 100);
  await redisClient.set("gold_ranking_list_normal", JSON.stringify(topNormal));

  // 铁猫玩家
  const ironUsers = users.filter(u => u.accountPlayType === AccountPlayType.IRON);
  const ironUserMap = new Map(ironUsers.map(u => [u.uuid, u.name]));
  const ironAvatarMap = new Map(ironUsers.map(u => [u.uuid, u.avatar]));
  const ironRanking: RankingListItem[] = inventories.filter(i => {
    return i.item_id == 'gold' && ironUserMap.has(i.user_uuid);
  }).map(inv => ({
    uuid: inv.user_uuid,
    name: ironUserMap.get(inv.user_uuid) ?? `未知用户(${inv.user_uuid})`,
    avatar: ironAvatarMap.get(inv.user_uuid) ?? 'avatar_1',
    rank: Number(inv.count)
  }));
  ironRanking.sort((a, b) => +b.rank - +a.rank);
  const topIron = ironRanking.slice(0, 100);
  await redisClient.set("gold_ranking_list_iron", JSON.stringify(topIron));
}

async function updateCatPawCoinRankingList(users: any[], inventories: {
  user_uuid: string;
  item_id: string;
  count: bigint;
}[]) {
  // 普通玩家
  const normalUsers = users.filter(u => u.accountPlayType === AccountPlayType.NORMAL);
  const normalUserMap = new Map(normalUsers.map(u => [u.uuid, u.name]));
  const normalAvatarMap = new Map(normalUsers.map(u => [u.uuid, u.avatar]));
  const normalRanking: RankingListItem[] = inventories.filter(i => {
    return i.item_id == 'catPawCoin' && normalUserMap.has(i.user_uuid);
  }).map(inv => ({
    uuid: inv.user_uuid,
    name: normalUserMap.get(inv.user_uuid) ?? `未知用户(${inv.user_uuid})`,
    avatar: normalAvatarMap.get(inv.user_uuid) ?? 'avatar_1',
    rank: Number(inv.count)
  }));
  normalRanking.sort((a, b) => +b.rank - +a.rank);
  const topNormal = normalRanking.slice(0, 50);
  await redisClient.set("cat_paw_coin_ranking_list_normal", JSON.stringify(topNormal));

  // 铁猫玩家
  const ironUsers = users.filter(u => u.accountPlayType === AccountPlayType.IRON);
  const ironUserMap = new Map(ironUsers.map(u => [u.uuid, u.name]));
  const ironAvatarMap = new Map(ironUsers.map(u => [u.uuid, u.avatar]));
  const ironRanking: RankingListItem[] = inventories.filter(i => {
    return i.item_id == 'catPawCoin' && ironUserMap.has(i.user_uuid);
  }).map(inv => ({
    uuid: inv.user_uuid,
    name: ironUserMap.get(inv.user_uuid) ?? `未知用户(${inv.user_uuid})`,
    avatar: ironAvatarMap.get(inv.user_uuid) ?? 'avatar_1',
    rank: Number(inv.count)
  }));
  ironRanking.sort((a, b) => +b.rank - +a.rank);
  const topIron = ironRanking.slice(0, 50);
  await redisClient.set("cat_paw_coin_ranking_list_iron", JSON.stringify(topIron));
}

async function updateCatPawStampRankingList(users: any[], inventories: {
  user_uuid: string;
  item_id: string;
  count: bigint;
}[]) {
  // 普通玩家
  const normalUsers = users.filter(u => u.accountPlayType === AccountPlayType.NORMAL);
  const normalUserMap = new Map(normalUsers.map(u => [u.uuid, u.name]));
  const normalAvatarMap = new Map(normalUsers.map(u => [u.uuid, u.avatar]));
  const normalRanking: RankingListItem[] = inventories.filter(i => {
    return i.item_id == 'catPawStamp' && normalUserMap.has(i.user_uuid);
  }).map(inv => ({
    uuid: inv.user_uuid,
    name: normalUserMap.get(inv.user_uuid) ?? `未知用户(${inv.user_uuid})`,
    avatar: normalAvatarMap.get(inv.user_uuid) ?? 'avatar_1',
    rank: Number(inv.count)
  }));
  normalRanking.sort((a, b) => +b.rank - +a.rank);
  const topNormal = normalRanking.slice(0, 50);
  await redisClient.set("cat_paw_stamp_ranking_list_normal", JSON.stringify(topNormal));

  // 铁猫玩家
  const ironUsers = users.filter(u => u.accountPlayType === AccountPlayType.IRON);
  const ironUserMap = new Map(ironUsers.map(u => [u.uuid, u.name]));
  const ironAvatarMap = new Map(ironUsers.map(u => [u.uuid, u.avatar]));
  const ironRanking: RankingListItem[] = inventories.filter(i => {
    return i.item_id == 'catPawStamp' && ironUserMap.has(i.user_uuid);
  }).map(inv => ({
    uuid: inv.user_uuid,
    name: ironUserMap.get(inv.user_uuid) ?? `未知用户(${inv.user_uuid})`,
    avatar: ironAvatarMap.get(inv.user_uuid) ?? 'avatar_1',
    rank: Number(inv.count)
  }));
  ironRanking.sort((a, b) => +b.rank - +a.rank);
  const topIron = ironRanking.slice(0, 50);
  await redisClient.set("cat_paw_stamp_ranking_list_iron", JSON.stringify(topIron));
}

async function updateCharacterStatusRankingList(users: any[], statuses: any[]) {
  for (const playType of [AccountPlayType.NORMAL, AccountPlayType.IRON]) {
    const filteredUsers = users.filter(u => u.accountPlayType === playType);
    const userMap = new Map(filteredUsers.map(u => [u.uuid, u.name]));
    const avatarMap = new Map(filteredUsers.map(u => [u.uuid, u.avatar]));

    // 总等级榜
    const ranking: RankingListItem[] = statuses
      .filter(stat => userMap.has(stat.user_uuid))
      .map(stat => {
        let totalLevel = 0;
        for(const status of allCharacterStatusType) {
          try {
            const thisStatus = JSON.parse(stat[status]) as UnitStatusDetail;
            totalLevel += thisStatus.level;
          } catch {}
        }
        return {
          uuid: stat.user_uuid,
          name: userMap.get(stat.user_uuid) ?? `未知用户(${stat.user_uuid})`,
          rank: totalLevel,
          avatar: avatarMap.get(stat.user_uuid) ?? 'avatar_1',
        }
      });

    ranking.sort((a, b) => +b.rank - +a.rank);
    const top50Ranking = ranking.slice(0, 50);
    await redisClient.set(`character_total_level_ranking_list_${playType.toLowerCase()}`, JSON.stringify(top50Ranking));

    // 各单项榜
    await Promise.all(allCharacterStatusType.map(async statusType => {
      const statusRanking: RankingListItem[] = statuses
        .filter(stat => userMap.has(stat.user_uuid))
        .map(stat => {
          let level = 0;
          let exp = 0;
          try {
            const thisStatus = JSON.parse(stat[statusType]) as CharacterStatusDetail;
            level = thisStatus.level;
            exp = thisStatus.currentExp;
          } catch {}
          return {
            uuid: stat.user_uuid,
            name: userMap.get(stat.user_uuid) ?? `未知用户(${stat.user_uuid})`,
            rank: level,
            avatar: avatarMap.get(stat.user_uuid) ?? 'avatar_1',
            exp: exp
          }
        });
      statusRanking.sort((a, b) => {
        if (b.rank !== a.rank) {
          return +b.rank - +a.rank; // 按等级降序
        }
        return +(b.exp ?? 0) - +(a.exp ?? 0); // 如果等级相同，按经验降序
      });
      const top50StatusRanking = statusRanking.slice(0, 50);
      await redisClient.set(`character_${statusType}_level_ranking_list_${playType.toLowerCase()}`, JSON.stringify(top50StatusRanking));
    }));
  }
}

async function updateSponsorRankingList(users: any[]) {
  // 按 max_sponsor_points 降序排序
  const ranking = users
    .filter(u => (u.max_sponsor_points ?? 0) > 0 && u.uuid != 'b34aff13-acf3-4e14-aaa3-9511297eeb74')
    .sort((a, b) => (b.max_sponsor_points ?? 0) - (a.max_sponsor_points ?? 0))
    .map((u, idx) => ({
      uuid: u.uuid,
      name: u.name,
      avatar: u.avatar,
      rank: idx + 1 // 排名
    }));

  await redisClient.set("sponsor_ranking_list", JSON.stringify(ranking));
}

async function updateKittyFriendshipRankingList(kittyFriendshop: any[]) {
  // 只取前50，按亲密度降序
  const ranking = kittyFriendshop
    .sort((a, b) => (b.intimacy ?? 0) - (a.intimacy ?? 0))
    .slice(0, 50)
    .map((item, idx) => ({
      kittyAUuid: item.kittyAUuid,
      kittyBUuid: item.kittyBUuid,
      ownerA: item.ownerA,
      ownerB: item.ownerB,
      intimacy: item.intimacy,
      rank: idx + 1,
      becomeFriendTime: item.becomeFriendTime,
    }));

  await redisClient.set("kitty_friendship_ranking_list", JSON.stringify(ranking));
}

async function updateKittyMostFriendsRankingList() {
  // 查询所有未删除的好友关系
  const allFriendships = await prisma.kittyFriendship.findMany({
    where: { del: false },
    select: {
      kittyAUuid: true,
      kittyBUuid: true,
    }
  });

  // 统计每只猫咪的好友数量
  const kittyFriendCount: Record<string, number> = {};
  for (const f of allFriendships) {
    kittyFriendCount[f.kittyAUuid] = (kittyFriendCount[f.kittyAUuid] ?? 0) + 1;
    kittyFriendCount[f.kittyBUuid] = (kittyFriendCount[f.kittyBUuid] ?? 0) + 1;
  }

  // 排序并取前50
  const ranking = Object.entries(kittyFriendCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([kittyUuid, count], idx) => ({
      kittyUuid,
      friendCount: count,
      rank: idx + 1,
    }));

  await redisClient.set("kitty_most_friends_ranking_list", JSON.stringify(ranking));
}

export async function updateAxeEnhanceLevelRankingList(filteredUsers: {
    name: string;
    uuid: string;
    avatar: string;
    max_sponsor_points: number;
    is_banned: boolean;
    accountPlayType: string | null;
}[]) {
  const allAxe = await prisma.characterNewInventory.findMany({
    where: { 
      user_uuid: {
        in: filteredUsers.map(u => u.uuid)
      },
      item_id: {
        startsWith: 'axe'
      }
    },
    select: {
      user_uuid: true,
      item_id: true,
    }
  });

  // 创建用户信息映射
  const userMap = new Map(filteredUsers.map(u => [u.uuid, u]));

  // 统计每个用户的最高强化等级
  const userMaxEnhanceLevel: Record<string, number> = {};

  for(const inventoryInfo of allAxe) {
    const axeEnhanceLevelStr = inventoryInfo.item_id.split("+")[1];
    const axeEnhanceLevel = axeEnhanceLevelStr ? parseInt(axeEnhanceLevelStr, 10) : 0;
    
    // 更新用户的最高强化等级
    const currentMax = userMaxEnhanceLevel[inventoryInfo.user_uuid] ?? 0;
    if (axeEnhanceLevel > currentMax) {
      userMaxEnhanceLevel[inventoryInfo.user_uuid] = axeEnhanceLevel;
    }
  }

  // 普通/铁猫榜
  for (const playType of [AccountPlayType.NORMAL, AccountPlayType.IRON]) {
    const filtered = filteredUsers.filter(u => u.accountPlayType === playType);
    const ranking: RankingListItem[] = filtered
      .map(u => ({
        uuid: u.uuid,
        name: u.name ?? `未知用户(${u.uuid})`,
        avatar: u.avatar ?? 'avatar_1',
        rank: userMaxEnhanceLevel[u.uuid] ?? 0
      }))
      .filter(item => item.rank > 0)
      .sort((a, b) => b.rank - a.rank);

    const top50Ranking = ranking.slice(0, 50).map((item, index) => ({
      ...item,
      position: index + 1
    }));

    await redisClient.set(`axe_enhance_level_ranking_list_${playType.toLowerCase()}`, JSON.stringify(top50Ranking));
  }
}

export async function updateAllRankingLists() {
  // 并发获取数据
  const [users, inventories, statuses, kittyFriendshop] = await Promise.all([
    prisma.user.findMany({
      select: {
        uuid: true,
        name: true,
        avatar: true,
        is_banned: true,
        max_sponsor_points: true,
        accountPlayType: true,
        option: true,
      },
      where: { 
        is_banned: false, is_gm: false 
      },
    }),
    prisma.characterNewInventory.findMany({
      where: {
        item_id: {
          in: ["gold", "catPawCoin", "catPawStamp"],
        },
      },
      select: { user_uuid: true, item_id: true, count: true },
    }),
    prisma.characterStatus.findMany(),
    prisma.kittyFriendship.findMany({
      where: {
        intimacy: {
          gt: 1,
        },
      },
      orderBy: {
        intimacy: "desc",
      },
      take: 50,
    }),
  ]);

  const filteredUsers = users.filter(u => {
    // 去掉被封禁的用户
    if (u.is_banned) {
      return false;
    }

    // 去掉不加入排行榜的用户
    if (u.option?.length) {
      const opt = safeJsonParse<PlayerProfileInfo['option']>(u.option, {});
      if (opt?.hideInRankingList) {
        return false;
      }
    }

    return true;
  })
  // inventory也对应过滤一次
  const filteredInventories = inventories.filter(inv => filteredUsers.some(u => u.uuid === inv.user_uuid))
  // statuses也过滤一遍
  const filteredStatuses = statuses.filter(stat => filteredUsers.some(u => u.uuid === stat.user_uuid))

  await Promise.all([
    updateGoldRankingList(filteredUsers, filteredInventories),
    updateCatPawCoinRankingList(filteredUsers, filteredInventories),
    updateCatPawStampRankingList(filteredUsers, filteredInventories),
    updateCharacterStatusRankingList(filteredUsers, filteredStatuses),
    updateSponsorRankingList(users), // 新增赞助榜
    updateKittyFriendshipRankingList(kittyFriendshop), // 新增猫咪好友榜
    updateKittyMostFriendsRankingList(), // 新增猫咪好友数量榜
    updateAxeEnhanceLevelRankingList(filteredUsers), // 新增斧头强化榜
  ])

  users.length = 0;
  inventories.length = 0;
  statuses.length = 0;
  kittyFriendshop.length = 0;
}

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function runScheduler() {
  while (running) {
    try {
      console.log(`[${new Date().toISOString()}] Start updating ranking lists...`)
      await updateAllRankingLists()
      console.log(`[${new Date().toISOString()}] Ranking lists updated.`)
    } catch (e) {
      console.error(`[${new Date().toISOString()}] Failed to update ranking lists:`, e)
    }
    // 30分钟 = 1800000 毫秒
    await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000))
  }
}

runScheduler()