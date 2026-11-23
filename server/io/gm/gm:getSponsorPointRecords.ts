import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";

/**
 * GM: list sponsor point records with pagination and optional filters
 * data: { page?: number, take?: number, changeType?: 'ADD'|'SUBTRACT'|'SET'|'ALL', target?: string }
 * - target can be user uuid or name
 */
export default async function (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ page?: number; take?: number; changeType?: 'ADD'|'SUBTRACT'|'SET'|'ALL'; target?: string }>
) {
  const userUuid = data.user.uuid;
  const { page: p, take: t, changeType, target } = data.data || ({} as any);

  // GM check
  const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
  if (!gmUser || !gmUser.is_gm) {
    emitEventToUser(userUuid, "gm:getSponsorPointRecords:fail", { message: "无权限" });
    return;
  }

  try {
    const page = Math.max(1, Number(p || 1));
    const take = Math.max(1, Math.min(200, Number(t || 50)));

    // resolve target to uuid if provided
    let targetUuid: string | undefined = undefined;
    if (target && target.trim()) {
      const x = target.trim();
      const byUuid = await prisma.user.findUnique({ select: { uuid: true, name: true }, where: { uuid: x } });
      if (byUuid) {
        targetUuid = byUuid.uuid;
      } else {
        const byName = await prisma.user.findFirst({ select: { uuid: true, name: true }, where: { name: x } });
        if (byName) targetUuid = byName.uuid; else {
          emitEventToUser(userUuid, "gm:getSponsorPointRecords:fail", { message: "目标用户不存在" });
          return;
        }
      }
    }

    const where: any = {};
    if (targetUuid) where.userUuid = targetUuid;
    if (changeType && changeType !== 'ALL') where.changeType = changeType;

    const total = await prisma.sponsorPointRecord.count({ where } as any);
    const records = await prisma.sponsorPointRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * take,
      take,
    } as any);

    // attach user names
    const uuids = Array.from(new Set(records.map(r => r.userUuid)));
    const users = uuids.length ? await prisma.user.findMany({ select: { uuid: true, name: true }, where: { uuid: { in: uuids } } }) : [];
    const nameMap = new Map(users.map(u => [u.uuid, u.name] as const));

    const list = records.map(r => ({
      id: r.id,
      userUuid: r.userUuid,
      userName: nameMap.get(r.userUuid) || r.userUuid,
      changeType: r.changeType,
      amount: r.amount,
      beforePoints: r.beforePoints,
      afterPoints: r.afterPoints,
      reason: r.reason || '',
      createdAt: r.createdAt,
    }));

    emitEventToUser(userUuid, "gm:getSponsorPointRecords:success", { list, page, take, total, filter: { changeType: changeType || 'ALL', target: targetUuid } });
  } catch (err: any) {
    emitEventToUser(userUuid, "gm:getSponsorPointRecords:fail", { message: err?.message || String(err) });
  }
}
