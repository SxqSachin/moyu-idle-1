import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { RankingList, } from "~/shared/types/rankingList";
import { emitEventToUser } from ".";
import { prisma } from "../utils/game/db";
import { AccountPlayType, AccountType } from "~/shared/types/account";

export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<RankingList[]>
) {
  // 并行查询，降低总时延
  const [abnormalSkills, suspiciousUsers, abnormalSkillBooks] = await Promise.all([
    // 高等级技能
    prisma.characterSkillInfo.findMany({
      where: {
        level: { gt: 80 },
        skill_id: { notIn: ['curse','confuse','sweep','poison'] },
      },
      orderBy: { level: 'desc' },
    }),
    // 使用一次 SQL 将 groupBy + 过滤 合并，避免巨大 OR 列表
    prisma.$queryRaw<Array<{ uuid: string; name: string; last_online_ip: string; last_online_fp: string | null }>>`
      SELECT u.uuid, u.name, u.last_online_ip, u.last_online_fp
      FROM \`User\` u
      JOIN (
        SELECT last_online_fp, last_online_ip, pwd
        FROM \`User\`
        WHERE last_online_ip <> ''
          AND last_online_fp IS NOT NULL
          AND accountType = ${AccountType.MAIN}
        GROUP BY last_online_fp, last_online_ip, pwd
        HAVING COUNT(uuid) > 3
      ) g ON g.last_online_ip = u.last_online_ip AND g.last_online_fp = u.last_online_fp
      WHERE u.accountPlayType = ${AccountPlayType.NORMAL}
    `,
    // 可疑物品（书本/材料）库存异常
    prisma.characterNewInventory.findMany({
      where: {
        item_id: {
          in: [
            "guardianLaserSkillBook",
            "detectMagicSkillBook",
            "forbiddenMagicSkillBook",
            "forbiddenMagicSkillBook",
            "silkFabric",
            "mithrilIngot",
            "shadowOrb"
          ]
        },
        count: { gt: BigInt(300000), not: BigInt(391685) }
      },
      orderBy: { count: 'desc' }
    })
  ])

  const suspiciousUserGroups = Object.values(
    suspiciousUsers.reduce((acc, user) => {
      const key = `${user.last_online_fp}`;
      if (!acc[key]) {
        acc[key] = {
          last_online_ip: user.last_online_ip,
          // @ts-ignore
          last_online_fp: user.last_online_fp,
          users: [],
        };
      }
      acc[key].users.push({ uuid: user.uuid, name: user.name });
      return acc;
    }, {} as Record<string, { last_online_ip: string, last_online_fp: string, users: { uuid: string, name: string }[] }>)
  ).map(group => ({
    last_online_fp: group.last_online_fp,
    user_count: group.users.length,
    users: group.users,
  }));

  const abnormalSkillBooksSafe = abnormalSkillBooks.map(item => ({
    ...item,
    count: typeof item.count === 'bigint' ? Number(item.count) : item.count
  }));

  let allUserUuid = [...new Set([
    ...abnormalSkills.map(skill => skill.character_uuid),
    ...abnormalSkillBooksSafe.map(book => book.character_uuid),
    ...suspiciousUsers.map(user => user.uuid)
  ])]

  let userIsBanned = await prisma.user.findMany({
    select: {
      uuid: true,
      is_banned: true,
    },
    where: {
      uuid: { in: allUserUuid, },
    }
  });

  let userIsBannedMap = userIsBanned.reduce((acc, user) => {
    acc[user.uuid] = user.is_banned;
    return acc;
  }, {} as Record<string, boolean>);


  let res = {
    abnormalSkills: abnormalSkills,
    suspiciousUserGroups,
    rich: abnormalSkillBooksSafe,
    userIsBanned: userIsBannedMap,
  }

  emitEventToUser(data.user.uuid, 'cheaterList:success', res)
}