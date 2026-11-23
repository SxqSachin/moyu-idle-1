import { GameResourceTradeEvent } from "~/shared/types/gameResource";
import { prisma } from "./db";
import { allGameResource } from "~/shared/data/allGameResources";
import { Prisma, PrismaClient } from "~/generated/prisma";
import { DefaultArgs } from "@prisma/client/runtime/library";
import { increaseItemCount } from "./characterInventory";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { getAllUserUniqueFlags, setUserUniqueFlag } from "./uniqueFlag";
import { emitEventToUser } from "~/server/io";
import { PrismaTx } from "~/shared/types/socket/db";
import { SPONSOR_POINT_PACK_TO_SPONSOR_POINT_RATE } from "~/shared/data/constant";

/**
 * 查询用户赞助积分
 */
export async function getSponsorPoints(userUuid: string, tx?: PrismaTx): Promise<number> {
  if (!tx) {
    tx = prisma
  }
  const user = await tx.user.findUnique({
    where: { uuid: userUuid },
    select: { sponsor_points: true }
  });
  return user?.sponsor_points ?? 0;
}

export async function getMaxSponsorPoints(userUuid: string, tx?: PrismaTx): Promise<number> {
  if (!tx) {
    tx = prisma
  }
  const user = await tx.user.findUnique({
    where: { uuid: userUuid },
    select: { max_sponsor_points: true }
  });
  return user?.max_sponsor_points ?? 0;
}

export async function getUserSponsorPointInfo(userUuid: string, tx?: PrismaTx): Promise<{ current: number; max: number }> {
  if (!tx) {
    tx = prisma
  }
  const user = await tx.user.findUnique({
    where: { uuid: userUuid },
    select: { sponsor_points: true, max_sponsor_points: true }
  });
  return {
    current: user?.sponsor_points ?? 0,
    max: user?.max_sponsor_points ?? 0,
  };
}


/**
 * 增加赞助积分（事务安全，记录积分变动）
 */
export async function addSponsorPoints(userUuid: string, amount: number, reason: string): Promise<number> {
  return await prisma.$transaction(async (tx) => {
    return await addSponsorPointsWithOtherTx(userUuid, amount, reason, tx)
  });
}

export async function addSponsorPointsWithOtherTx(userUuid: string, amount: number, reason: string, tx: PrismaTx): Promise<number> {
    const user = await tx.user.findUnique({ where: { uuid: userUuid }, select: { sponsor_points: true } });
    if (!user) throw new Error("用户不存在");
    const beforePoints = user.sponsor_points;
    let res = await tx.user.update({
      where: { uuid: userUuid },
      data: { 
        sponsor_points: {
          increment: amount
        },
        max_sponsor_points: {
          increment: amount
        }
      }
    });
    await tx.sponsorPointRecord.create({
      data: {
        userUuid,
        changeType: "ADD",
        amount,
        beforePoints,
        afterPoints: res.sponsor_points,
        reason
      }
    });
    emitEventToUser(userUuid, "sponsorPoint:get:success", await getUserSponsorPointInfo(userUuid, tx));

    // 如果有推荐人，给推荐人增加10%的积分
    // const referrerInfo = await tx.userReferral.findUnique({
    //   select: { referrerUuid: true },
    //   where: { referredUuid: userUuid, confirmedByReferred: true }
    // });
    // if (referrerInfo) {
    //   const referrerUuid = referrerInfo.referrerUuid;
    //   const referrer = await tx.user.findUnique({ where: { uuid: referrerUuid }, select: { sponsor_points: true } });
    //   if (referrer) {

    //     const referrerRewardPoints = Math.floor(amount * 0.1);
    //     let referrerRes = await tx.user.update({
    //       where: { uuid: referrerUuid },
    //       data: {
    //         sponsor_points: {
    //           increment: referrerRewardPoints,
    //         },
    //         max_sponsor_points: {
    //           increment: referrerRewardPoints,
    //         },
    //       },
    //     });

    //     await tx.sponsorPointRecord.create({
    //       data: {
    //         userUuid: referrerUuid,
    //         changeType: "ADD",
    //         amount: Math.floor(amount * 0.1),
    //         beforePoints: referrer.sponsor_points,
    //         afterPoints: referrer.sponsor_points + referrerRewardPoints,
    //         reason: `推荐玩家进行赞助，获得赞助积分`
    //       }
    //     });
    //     emitEventToUser(referrerUuid, "sponsorPoint:get:success",  await getUserSponsorPointInfo(referrerUuid, tx));
    //   }
    // }


    return res.sponsor_points;
}

/**
 * 扣减赞助积分（事务安全，记录积分变动）
 */
export async function subtractSponsorPoints(userUuid: string, amount: number, reason: string, tx?: Omit<PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">): Promise<number> {
  if (!tx) {
    tx = prisma
  }
  const user = await tx.user.findUnique({ where: { uuid: userUuid }, select: { sponsor_points: true } });
  if (!user) throw new Error("用户不存在");
  const beforePoints = user.sponsor_points;
  if (beforePoints < amount) throw new Error("赞助积分不足");
  let newPoints = beforePoints - amount;
  await tx.user.update({
    where: { uuid: userUuid },
    data: { sponsor_points: newPoints }
  });
  await tx.sponsorPointRecord.create({
    data: {
      userUuid,
      changeType: "SUBTRACT",
      amount: -amount,
      beforePoints,
      afterPoints: newPoints,
      reason
    }
  });
  return newPoints;
}

export async function subtractMaxSponsorPoints(userUuid: string, amount: number, reason: string, tx?: Omit<PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">): Promise<number> {
  if (!tx) {
    tx = prisma
  }
  const user = await tx.user.findUnique({ where: { uuid: userUuid }, select: { max_sponsor_points: true } });
  if (!user) throw new Error("用户不存在");
  const beforePoints = user.max_sponsor_points;
  if (beforePoints < amount) throw new Error("赞助积分不足");
  let newPoints = beforePoints - amount;
  await tx.user.update({
    where: { uuid: userUuid },
    data: { max_sponsor_points: newPoints }
  });
  return newPoints;
}

/**
 * 查询赞助积分用户列表（分页）
 */
export async function listSponsorUsers(page: number = 1, pageSize: number = 20): Promise<{ uuid: string, name: string, sponsor_points: number }[]> {
  const users = await prisma.user.findMany({
    where: { sponsor_points: { gt: 0 } },
    orderBy: { sponsor_points: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { uuid: true, name: true, sponsor_points: true }
  });
  return users;
}

/**
 * 查询用户赞助积分变动记录（分页）
 */
export async function listSponsorPointRecords(userUuid: string, page: number = 1, pageSize: number = 20) {
  return await prisma.sponsorPointRecord.findMany({
    where: { userUuid },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize
  });
}

export async function buyFromSponsorShop(userUuid: string, tradeInfo: GameResourceTradeEvent) {
  if (!userUuid || !tradeInfo?.id || !tradeInfo?.count) {
    throw new Error("参数错误");
  }

  let resourceId = tradeInfo.id;

  let resource = allGameResource[resourceId]

  if (!resource.userBuyCostSponsorPoint) {
    throw new Error("商品不支持购买");
  }

  if (resource.maxBuyCount && tradeInfo.count > resource.maxBuyCount) {
    throw new Error("超出最大购买数量");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { uuid: userUuid }, select: { sponsor_points: true } });
    if (!user) throw new Error("用户不存在");

    let sponsorPoint = await getSponsorPoints(userUuid, tx);

    let totalCost = resource.userBuyCostSponsorPoint! * tradeInfo.count;

    if (sponsorPoint < totalCost) {
      throw new Error("赞助积分不足");
    }

    if (resource.uniqueFlagCheckWhenBuy) {
      const uniqueFlag = await getAllUserUniqueFlags(userUuid);

      for (const check of resource.uniqueFlagCheckWhenBuy) {
        const hasFlag = uniqueFlag.some(flag => flag.type === check.data.type && flag.key === check.data.key);

        if (check.condition == 'has') {
          if (!hasFlag) {
            throw new Error(`购买失败(01)`);
          }
        }

        if (check.condition == 'not_has') {
          if (hasFlag) {
            throw new Error(`购买失败(02)`);
          }
        }
      }
    }

    let action = `赞助商店购买 ${resource.name} x${tradeInfo.count}，消耗 ${totalCost} 赞助积分`;

    await increaseItemCount(userUuid, {
      [tradeInfo.id]: {
        count: tradeInfo.count,
      }
    }, {
      actionName: action,
      type: ModifyItemCountType.Other,
      showModifyInfo: true,
      sendModifyEvent: true,
    }, tx)
    await invalidateInventoryCache(userUuid);

    await subtractSponsorPoints(userUuid, totalCost, action, tx);

    if (tradeInfo.id == "sponsorPointPack") {
      await subtractMaxSponsorPoints(userUuid, totalCost, action, tx);
    }

    if (resource.addUniqueFlagAfterBuy) {
      for (const flag of resource.addUniqueFlagAfterBuy) {
        await setUserUniqueFlag(userUuid, flag.type, flag.key, true, tx);
      }
    }

    return true;
  })
}

export async function exchangeSponsorPointPack(userUuid: string, count: number) {
  if (!count || !Number.isInteger(count) || count < 0) {
    throw new Error("参数错误");
  }

  const user = await prisma.user.findUnique({ where: { uuid: userUuid } });

  if (!user) {
    throw new Error("用户不存在");
  }

  if (user.accountType == "MAIN") {
    if (!user?.email_verified) {
      throw new Error("请先验证邮箱后再进行兑换");
    }
  }

  return prisma.$transaction(async (tx) => {
    const hasSponsorPointPack = await getItemCount(userUuid, "sponsorPointPack", tx);

    if (hasSponsorPointPack < count) {
      throw new Error("赞助积分包数量不足");
    }
    
    await decreaseItemCount(userUuid, {
      sponsorPointPack: {
        count,
      }
    }, {
      actionName: `兑换赞助积分包 x${count}`,
      type: ModifyItemCountType.Other,
      showModifyInfo: true,
      sendModifyEvent: true,
    }, tx);
    await invalidateInventoryCache(userUuid);

    await addSponsorPointsWithOtherTx(userUuid, count * SPONSOR_POINT_PACK_TO_SPONSOR_POINT_RATE, `兑换赞助积分包 x${count}`, tx);
  })
}