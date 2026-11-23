// ...existing code...
import { Socket, DefaultEventsMap } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import {
  createAuction,
  getAuctionByUuid,
  listAuctions,
  listUpcomingAuctions,
  placeBid,
  settleAuction,
  cancelAuction,
} from "../utils/game/auction";
import { prisma } from "../utils/game/db";
import { broadcastEvent, emitEventToUser, } from ".";
import { withUniqueLock } from "../utils/lock"
import {
  AuctionCreateInput,
  AuctionBidInput,
  AuctionDepositInput,
  AuctionListQuery,
} from "~/shared/types/auction";

/**
 * socket 接口：拍卖相关
 * 规范与 referrer.ts 一致：调用后 emitEventToUser(user, "<topic>:success"/":fail", { ... })
 * 关键路径使用 withUniqueLock 防止重复并发。
 */

/** 查询拍卖列表 */
export async function getAuctionList(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ query?: AuctionListQuery }>
) {
  const user = data.user;
  try {
    const res = await listAuctions(data.data.query ?? {}, user.uuid);
    emitEventToUser(user, "auction:list:success", { ...res });
  } catch (e: any) {
    emitEventToUser(user, "auction:list:fail", { message: e.message });
  }
}

/** 获取拍卖详情 */
export async function getAuctionDetail(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ uuid: string }>
) {
  const user = data.user;
  try {
    const dto = await getAuctionByUuid(data.data.uuid);
    if (!dto) throw new Error("拍卖不存在");
    emitEventToUser(user, "auction:detail:success", { auction: dto });
  } catch (e: any) {
    emitEventToUser(user, "auction:detail:fail", { message: e.message });
  }
}

/** 获取即将成交的拍卖（2小时内结束，客户端为展示用，不分页） */
export async function getUpcomingAuctions(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{}>,
) {
  const user = data.user;
  try {
    const items = await listUpcomingAuctions(user.uuid, 2 * 60 * 60 * 1000);
    emitEventToUser(user, "auction:upcoming:success", { items });
  } catch (e: any) {
    emitEventToUser(user, "auction:upcoming:fail", { message: e.message });
  }
}

/** 创建拍卖（简易接口，业务权限在上层控制） */
export async function handleCreateAuction(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ input: AuctionCreateInput }>
) {
  const user = data.user;
  data.data.input.creator = user.uuid; // 强制设置创建者为当前用户

  const lockKey = `auction:${user.uuid}:create`;
  await withUniqueLock(lockKey, async () => {
    try {
      const created = await createAuction(data.data.input);
      emitEventToUser(user, "auction:create:success", { auction: created });
    } catch (e: any) {
      emitEventToUser(user, "auction:create:fail", { message: e.message });
    }
  });
}

/** 出价（并发关键路径加锁） */
export async function handlePlaceBid(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ input: AuctionBidInput }>
) {
  const user = data.user;
  const auctionUuid = data.data.input.auctionUuid;
  const lockKey = `auction:${auctionUuid}:bid`;
  await withUniqueLock(lockKey, async () => {
    try {
      // 确保 bidder 字段与当前用户一致
      const bidInput: AuctionBidInput = { ...data.data.input, bidder: user.uuid };
      const bid = await placeBid(bidInput);
      emitEventToUser(user, "auction:bid:success", { bid });

      // 返回最新拍卖信息
      
      // 任何变动都进行广播
      const dto = await getAuctionByUuid(auctionUuid);
      broadcastEvent("auction:detail:success", { auction: dto });
    } catch (e: any) {
      emitEventToUser(user, "auction:bid:fail", { message: e.message });
    }
  });
}

/** 获取出价历史（最多 200 条，按时间降序） */
export async function getBidHistory(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ auctionUuid: string }>
) {
  const user = data.user;
  try {
    const rows = await prisma.auctionBid.findMany({
      where: { auction_uuid: data.data.auctionUuid },
      orderBy: { created_at: "desc" },
      take: 200,
    });
    const history = rows.map((r: any) => ({
      id: r.id,
      bidder: r.bidder,
      amount: Number(r.amount ?? 0n),
      isProxy: !!r.is_proxy,
      maxProxy: r.max_proxy != null ? Number(r.max_proxy) : null,
      refunded: !!r.refunded,
      extra: r.extra ? JSON.parse(r.extra) : null,
      createdAt: r.created_at,
    }));
    emitEventToUser(user, "auction:history:success", { history });
  } catch (e: any) {
    emitEventToUser(user, "auction:history:fail", { message: e.message });
  }
}

/** 管理员/触发结算（会在后端执行完整结算流程） */
export async function handleSettleAuction(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ auctionUuid: string }>
) {
  const user = data.user;
  const auctionUuid = data.data.auctionUuid;
  const lockKey = `auction:${auctionUuid}:settle`;
  await withUniqueLock(lockKey, async () => {
    try {
      const result = await settleAuction(auctionUuid);
      emitEventToUser(user, "auction:settle:success", { result });

      // 任何变动都进行广播
      const dto = await getAuctionByUuid(auctionUuid);
      broadcastEvent("auction:detail:success", { auction: dto });
    } catch (e: any) {
      emitEventToUser(user, "auction:settle:fail", { message: e.message });
    }
  });
}

/** 取消拍卖（创建者或管理员） */
export async function handleCancelAuction(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ auctionUuid: string }>
) {
  const user = data.user;
  const auctionUuid = data.data.auctionUuid;
  const lockKey = `auction:${auctionUuid}:cancel`;
  await withUniqueLock(lockKey, async () => {
    try {
      await cancelAuction(auctionUuid, user.uuid);
      emitEventToUser(user, "auction:cancel:success", { auctionUuid });

      // 任何变动都进行广播
      const dto = await getAuctionByUuid(auctionUuid);
      broadcastEvent("auction:detail:success", { auction: dto });
    } catch (e: any) {
      emitEventToUser(user, "auction:cancel:fail", { message: e.message });
    }
  });
}