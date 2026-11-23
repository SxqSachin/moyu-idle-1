import { prisma } from "./db";
import { getInventoryInfo, decreaseItemCount, increaseItemCount } from "./characterInventory";
import { ModifyItemCountType, type ItemCountInfo } from "~/shared/types/gameInventory";
import { getGuildMemberInfo } from "./guild";
import { GuildRole, GuildInventoryDonation, GuildInventoryItem, GuildInventoryWithdrawStatus, GuildInventoryWithdrawal } from "~/shared/types/guild";
import type { Prisma, PrismaClient, GuildInventory as PrismaGuildInventory, GuildInventoryDonate as PrismaGuildInventoryDonate, GuildInventoryWithdraw as PrismaGuildInventoryWithdraw } from "~/generated/prisma";
import { DefaultArgs } from "@prisma/client/runtime/library";
import { PrismaTx } from "~/shared/types/socket/db";
import { v4 } from "uuid";
import { safeJsonParse } from "~/shared/utils";

/**
 * 输入校验工具：校验物品ID与数量并进行归一化
 */
function validateItemId(id: string): void {
  if (typeof id !== "string" || id.length === 0 || id.length > 64) {
    throw new Error("物品ID不合法");
  }
  // 支持带强化后缀的物品ID（例如 axe+5、wood+20），因此允许 '+' 字符
  const ok = /^[A-Za-z0-9:_\-\+]+$/.test(id);
  if (!ok) throw new Error("物品ID格式不合法");
}

function normalizeAndValidateItems(items: ItemCountInfo, opts?: { maxItems?: number; maxCountPerItem?: number }): ItemCountInfo {
  const maxItems = opts?.maxItems ?? 100;
  const maxCountPerItem = opts?.maxCountPerItem ?? 1_000_000_000; // 1e9 上限
  const keys = Object.keys(items || {});
  if (keys.length === 0) throw new Error("没有要处理的物品");
  if (keys.length > maxItems) throw new Error("一次处理的物品种类过多，最多允许 " + maxItems + " 种");
  const normalized: ItemCountInfo = {};
  for (const k of keys) {
    validateItemId(k);
    const n = items[k]?.count ?? 0;
    if (!Number.isInteger(n) || n <= 0) continue;
    if (n > maxCountPerItem) throw new Error("单个物品数量过大");
    normalized[k] = { count: n };
  }
  if (!Object.keys(normalized).length) throw new Error("所有物品数量必须为正整数");
  return normalized;
}

/**
 * 将 Prisma GuildInventory 转换为业务类型
 */
export function toPrismaGuildInventoryItem(item: PrismaGuildInventory): GuildInventoryItem {
  return {
    itemId: item.itemId,
    count: Number(item.count),
    minRoleToWithdraw: item.minRoleToWithdraw,
    // createdAt: item.createdAt,
    // updatedAt: item.updatedAt,
    extra: item.extra
  };
}

/**
 * 将 Prisma GuildInventoryDonate 转换为业务类型
 */
export function toPrismaGuildInventoryDonation(donation: PrismaGuildInventoryDonate): GuildInventoryDonation {
  return {
    uuid: donation.uuid,
    donorUuid: donation.donorUuid,

    info: safeJsonParse<ItemCountInfo>(donation.info, {}),

    createdAt: donation.createdAt,
    reason: donation.reason || null
  };
}

/**
 * 将 Prisma GuildInventoryWithdraw 转换为业务类型
 */
export function toPrismaGuildInventoryWithdrawal(withdrawal: PrismaGuildInventoryWithdraw): GuildInventoryWithdrawal {
  return {
    uuid: withdrawal.uuid,
    itemId: withdrawal.itemId,
    withdrawerUuid: withdrawal.withdrawerUuid,
    amount: Number(withdrawal.amount),
    reason: withdrawal.reason,
    status: withdrawal.status as GuildInventoryWithdrawStatus,
    createdAt: withdrawal.createdAt,

    handledBy: withdrawal.handledBy || null, // 审核人用户uuid（可选）
    handledAt: withdrawal.handledAt || null, // 审核时间（可选）
  };
}

/**
 * 获取公会仓库所有物品
 */
export async function getGuildInventory(guildUuid: string, tx?: PrismaTx): Promise<GuildInventoryItem[]> {

    if (!tx) {
      tx = prisma;
    }

  const items = await tx.guildInventory.findMany({
    where: { guildUuid },
    orderBy: { itemId: "asc" }
  });

  return items.map(toPrismaGuildInventoryItem);
}

/**
 * 获取公会仓库特定物品信息
 */
export async function getGuildInventoryItem(guildUuid: string, itemId: string, tx?: PrismaTx): Promise<GuildInventoryItem | null> {
    if (!tx) {
      tx = prisma;
    }

  const item = await tx.guildInventory.findUnique({
    where: { 
      guild_inventory_item_unique: { guildUuid, itemId }
    }
  });

  if (!item) return null;

  return toPrismaGuildInventoryItem(item);
}

/**
 * 捐赠物品到公会仓库
 */
export async function donateToGuildInventory(
  guildUuid: string,
  donorUuid: string,
  donations: ItemCountInfo,
  reason?: string
//   tx?: PrismaTx
): Promise<void> {
  // 验证捐赠者是否在公会中
  const memberInfo = await getGuildMemberInfo(donorUuid);
  if (!memberInfo || memberInfo.guildUuid !== guildUuid) {
    throw new Error("你不在该公会中");
  }

  // 严格检查与归一化输入
  const normalized = normalizeAndValidateItems(donations, { maxItems: 10, maxCountPerItem: 1_000_000_000 });

  await withUniqueLock(
    `guildInventory:donate:${guildUuid}:${donorUuid}`,
    async () => {
      await prisma.$transaction(async (tx) => {
        // 检查捐赠者库存
        const donorInventory = await getInventoryInfo(donorUuid, tx);

        let actDonor: ItemCountInfo = {};
        for (const itemId in normalized) {
          const donateAmount = normalized[itemId]!.count;

          // 检查库存是否足够
          const inventoryItem = donorInventory[itemId];
          if (!inventoryItem || inventoryItem.count < donateAmount) {
            throw new Error(
              `库存不足，无法捐赠物品: ${itemId}，需要 ${donateAmount}，但只有 ${
                inventoryItem?.count ?? 0
              }`
            );
          }

          // 记录实际捐赠的物品
          actDonor[itemId] = { count: donateAmount };
        }

        if (!Object.keys(actDonor).length) {
          throw new Error("捐赠失败");
        }

        // 扣除捐赠者物品
        await decreaseItemCount(
          donorUuid,
          actDonor,
          {
            actionName: "捐赠物品到公会仓库",
            showModifyInfo: true,
            type: ModifyItemCountType.Guild,
          },
          tx
        );
        await invalidateInventoryCache(donorUuid);

        // 更新公会仓库
        for (const itemId in actDonor) {
          const donateAmount = actDonor[itemId]!.count;

          // 更新或创建公会仓库物品记录
          await tx.guildInventory.upsert({
            where: {
              guild_inventory_item_unique: { guildUuid, itemId },
            },
            update: {
              count: { increment: BigInt(donateAmount) },
            },
            create: {
              guildUuid,
              itemId,
              count: BigInt(donateAmount),
            },
          });
        }

        // 记录捐赠明细
        await tx.guildInventoryDonate.create({
          data: {
            uuid: v4(),
            guildUuid,
            donorUuid,
            reason,

            info: JSON.stringify(actDonor),
          },
        });

        // 同步增加用户的个人可提取余额
        for (const itemId in actDonor) {
          const amt = actDonor[itemId]?.count ?? 0;
          if (!amt || amt <= 0) continue;
          await tx.guildInventoryPersonalBalance.upsert({
            where: {
              guild_personal_balance_unique: {
                guildUuid,
                userUuid: donorUuid,
                itemId,
              },
            },
            update: { count: { increment: BigInt(amt) } },
            create: {
              guildUuid,
              userUuid: donorUuid,
              itemId,
              count: BigInt(amt),
            },
          });
        }
      });
    }
  );
}

/**
 * 申请从公会仓库提取物品
 */
export async function requestWithdrawFromGuildInventory(
  guildUuid: string,
  withdrawerUuid: string,
  itemId: string,
  amount: number,
  reason: string
): Promise<void> {
  // 验证申请者是否在公会中
  const memberInfo = await getGuildMemberInfo(withdrawerUuid);
  if (!memberInfo || memberInfo.guildUuid !== guildUuid) {
    throw new Error("你不在该公会中");
  }

  await prisma.$transaction(async (tx) => {
    // 检查公会仓库中是否有足够物品
    const guildItem = await getGuildInventoryItem(guildUuid, itemId, tx);
    if (!guildItem || guildItem.count < BigInt(amount)) {
      throw new Error(
        `公会仓库物品不足: ${itemId}，需要 ${amount}，但只有 ${
          guildItem?.count ?? 0
        }`
      );
    }

    // 检查权限
    // const canDirectWithdraw = await canMemberWithdrawDirectly(
    //   memberInfo.role as GuildRole,
    //   guildItem.minRoleToWithdraw
    // );

    // if (canDirectWithdraw) {
    //   // 直接提取
    //   await executeWithdraw(guildUuid, withdrawerUuid, itemId, amount, reason);
    // } else {
      // 创建提取申请
      await prisma.guildInventoryWithdraw.create({
        data: {
          uuid: v4(),
          guildUuid,
          itemId,
          withdrawerUuid,
          amount: BigInt(amount),
          reason,
          status: GuildInventoryWithdrawStatus.PENDING,
        },
      });
    // }
  });
}

/**
 * 批量个人份额提取：接受 ItemCountInfo 聚合对象，一次事务内完成。
 */
export async function withdrawPersonalFromGuildInventoryBatch(
  guildUuid: string,
  withdrawerUuid: string,
  items: ItemCountInfo,
  reason: string,
): Promise<void> {
  if (!guildUuid || !withdrawerUuid) {
    throw new Error("参数缺失");
  }
  // 严格校验与归一化
  const normalized = normalizeAndValidateItems(items, { maxItems: 10, maxCountPerItem: 1_000_000_000 });

  // 成员校验
  const memberInfo = await getGuildMemberInfo(withdrawerUuid);
  if (!memberInfo || memberInfo.guildUuid !== guildUuid) {
    throw new Error("你不在该公会中");
  }

  // 针对公会设置锁，避免并发批量竞争
  const lockKey = `guildInventory:personal:batch:${guildUuid}`;
  return await withUniqueLock(lockKey, async () => {
    return await prisma.$transaction(async (tx) => {
      // 校验所有个人余额与公会库存是否足够
      for (const itemId in normalized) {
        const need = BigInt(normalized[itemId]!.count);
        const balance = await tx.guildInventoryPersonalBalance.findUnique({
          where: {
            guild_personal_balance_unique: { guildUuid, userUuid: withdrawerUuid, itemId },
          },
          select: { count: true },
        });
        const personal = BigInt(balance?.count ?? 0);
        if (personal < need) {
          throw new Error(`个人可提取份额不足: ${itemId}`);
        }

        const stockRow = await tx.guildInventory.findUnique({
          where: { guild_inventory_item_unique: { guildUuid, itemId } },
          select: { count: true },
        });
        const stock = BigInt(stockRow?.count ?? 0);
        if (stock < need) {
          throw new Error(`公会仓库物品不足: ${itemId}`);
        }
      }

      // 扣减库存与个人余额；累计增加到角色背包
      const increaseData: ItemCountInfo = {};
      for (const itemId in normalized) {
        const need = BigInt(normalized[itemId]!.count);
        await tx.guildInventory.update({
          where: { guild_inventory_item_unique: { guildUuid, itemId } },
          data: { count: { decrement: need } },
        });
        await tx.guildInventoryPersonalBalance.update({
          where: { guild_personal_balance_unique: { guildUuid, userUuid: withdrawerUuid, itemId } },
          data: { count: { decrement: need } },
        });
        increaseData[itemId] = { count: normalized[itemId]!.count };
      }

      await increaseItemCount(
        withdrawerUuid,
        increaseData,
        {
          actionName: "个人份额批量提取公会物品",
          showModifyInfo: true,
          sendModifyEvent: true,
          type: ModifyItemCountType.Guild,
        },
        tx,
      );
      await invalidateInventoryCache(withdrawerUuid);

      // 审计：为每个项目写一条 APPROVED 记录
      for (const itemId in normalized) {
        await tx.guildInventoryWithdraw.create({
          data: {
            uuid: v4(),
            guildUuid,
            itemId,
            withdrawerUuid,
            amount: BigInt(normalized[itemId]!.count),
            reason,
            status: GuildInventoryWithdrawStatus.APPROVED,
          },
        });
      }
    });
  });
}
/**
 * 直接从公会仓库提取物品（管理员或有权限的成员）
 */
// export async function withdrawFromGuildInventory(
//   guildUuid: string,
//   withdrawerUuid: string,
//   itemId: string,
//   amount: number,
//   reason?: string
// ): Promise<void> {
//   // 验证提取者是否在公会中且有权限
//   const memberInfo = await getGuildMemberInfo(withdrawerUuid);
//   if (!memberInfo || memberInfo.guildUuid !== guildUuid) {
//     throw new Error("你不在该公会中");
//   }

//   // 检查公会仓库中是否有足够物品
//   const guildItem = await getGuildInventoryItem(guildUuid, itemId);
//   if (!guildItem || guildItem.count < BigInt(amount)) {
//     throw new Error(`公会仓库物品不足: ${itemId}，需要 ${amount}，但只有 ${guildItem?.count ?? 0}`);
//   }

//   // 检查权限
//   const canWithdraw = await canMemberWithdrawDirectly(memberInfo.role, guildItem.minRoleToWithdraw);
//   if (!canWithdraw) {
//     throw new Error("你没有权限直接提取此物品，请提交申请");
//   }

//   await executeWithdraw(guildUuid, withdrawerUuid, itemId, amount, reason);
// }

/**
 * 执行提取操作
 */
async function executeWithdraw(
  guildUuid: string,
  withdrawerUuid: string,
  itemId: string,
  amount: number,
  tx: PrismaTx
): Promise<void> {
//   await prisma.$transaction(async (tx) => {
    // 减少公会仓库物品
    const updated = await tx.guildInventory.update({
      where: { 
        guild_inventory_item_unique: {
            guildUuid, 
            itemId
        },
        count: { gte: BigInt(amount) }
      },
      data: {
        count: { decrement: BigInt(amount) }
      }
    });

    if (!updated) {
      throw new Error("公会仓库物品不足或已被其他人提取");
    }

    // 增加提取者物品
    const increaseData: ItemCountInfo = {
      [itemId]: { count: amount }
    };

    await increaseItemCount(withdrawerUuid, increaseData, {
      actionName: "从公会仓库提取物品",
      showModifyInfo: true,
      type: ModifyItemCountType.Guild
    }, tx);
    await invalidateInventoryCache(withdrawerUuid);

    // 记录提取记录
    // await tx.guildInventoryWithdraw.create({
    //   data: {
    //     guildUuid,
    //     itemId,
    //     withdrawerUuid,
    //     amount: BigInt(amount),
    //     reason,
    //     status: GuildInventoryWithdrawStatus.APPROVED
    //   }
    // });
//   });
}

/**
 * 审批提取申请
 */
export async function approveWithdrawRequest(
  guildUuid: string,
  approverUuid: string,
  requestUuid: string,
  approve: boolean,
) {
  // 验证审批者权限
  const approverInfo = await getGuildMemberInfo(approverUuid);
  if (!approverInfo || approverInfo.guildUuid !== guildUuid) {
    throw new Error("你不在该公会中");
  }

  if (approverInfo.role === GuildRole.MEMBER) {
    throw new Error("只有管理员才能审批提取申请");
  }

  return await prisma.$transaction(async (tx) => {
    // 查找待审批的申请
    const request = await tx.guildInventoryWithdraw.findUnique({
      where: {
        uuid: requestUuid,
      }
    });

    if (!request) {
      throw new Error("未找到待审批的提取申请");
    }

    if (approve) {
      // 执行提取
      await executeWithdraw(guildUuid, request.withdrawerUuid, request.itemId, Number(request.amount), tx);
      
      // 更新申请状态
      return await tx.guildInventoryWithdraw.update({
        where: { uuid: requestUuid },
        data: { 
            status: GuildInventoryWithdrawStatus.APPROVED,
            handledAt: new Date(),
            handledBy: approverUuid // 审核人用户uuid
         }
      });
    } else {
      // 拒绝申请
      return await tx.guildInventoryWithdraw.update({
        where: { id: request.id },
        data: { 
          status: GuildInventoryWithdrawStatus.REJECTED,
          reason: "申请被拒绝",
            handledAt: new Date(),
            handledBy: approverUuid // 审核人用户uuid
        }
      });
    }
  });
}

/**
 * 获取公会仓库捐赠记录
 */
export async function getGuildInventoryDonations(guildUuid: string, itemId?: string): Promise<GuildInventoryDonation[]> {
  const where: any = { guildUuid };
  if (itemId) {
    where.itemId = itemId;
  }

  const donations = await prisma.guildInventoryDonate.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });

  return donations.map(toPrismaGuildInventoryDonation);
}

/**
 * 获取公会仓库提取记录
 */
export async function getGuildInventoryWithdrawals(guildUuid: string, status?: GuildInventoryWithdrawStatus): Promise<GuildInventoryWithdrawal[]> {
  const where: any = { guildUuid };
  if (status) {
    where.status = status;
  }

  const withdrawals = await prisma.guildInventoryWithdraw.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });

  return withdrawals.map(toPrismaGuildInventoryWithdrawal);
}

/**
 * 获取提取记录（分页）
 */
export async function getGuildInventoryWithdrawalsPaged(
  guildUuid: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<{ withdrawals: GuildInventoryWithdrawal[]; total: number }> {
  const where = { guildUuid } as const;
  const skip = Math.max(0, (page - 1) * pageSize);
  const take = Math.max(1, Math.min(pageSize, 100));

  const [rows, total] = await prisma.$transaction([
    prisma.guildInventoryWithdraw.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.guildInventoryWithdraw.count({ where }),
  ]);

  return { withdrawals: rows.map(toPrismaGuildInventoryWithdrawal), total };
}

/**
 * 获取待审批的提取申请
 */
export async function getPendingWithdrawRequests(guildUuid: string): Promise<GuildInventoryWithdrawal[]> {
  return getGuildInventoryWithdrawals(guildUuid, GuildInventoryWithdrawStatus.PENDING);
}

/**
 * 获取用户在某公会的可个人提取余额（按物品聚合）
 */
export async function getUserPersonalBalances(
  guildUuid: string,
  userUuid: string,
  tx?: PrismaTx
): Promise<Record<string, number>> {
  if (!tx) tx = prisma;
  const rows = await tx.guildInventoryPersonalBalance.findMany({
    where: { guildUuid, userUuid },
  });
  const result: Record<string, number> = {};
  for (const r of rows) {
    const n = Number(r.count);
    if (n > 0) result[r.itemId] = n;
  }
  return result;
}

/**
 * 设置物品的提取权限
 */
export async function setItemWithdrawPermission(
  guildUuid: string,
  operatorUuid: string,
  itemId: string,
  minRole: GuildRole
): Promise<void> {
  // 验证操作者权限
  const operatorInfo = await getGuildMemberInfo(operatorUuid);
  if (!operatorInfo || operatorInfo.guildUuid !== guildUuid) {
    throw new Error("你不在该公会中");
  }

  if (operatorInfo.role === GuildRole.MEMBER) {
    throw new Error("只有管理员才能设置物品权限");
  }

  await prisma.guildInventory.updateMany({
    where: { guildUuid, itemId },
    data: { minRoleToWithdraw: minRole }
  });
}

/**
 * 检查成员是否有权限直接提取物品
 */
async function canMemberWithdrawDirectly(memberRole: GuildRole, minRoleRequired: string | null): Promise<boolean> {
  if (!minRoleRequired) return true; // 没有权限限制
  
  const roleHierarchy = {
    [GuildRole.MEMBER]: 1,
    [GuildRole.OFFICER]: 2,
    [GuildRole.LEADER]: 3
  };

  const memberLevel = roleHierarchy[memberRole] || 0;
  const requiredLevel = roleHierarchy[minRoleRequired as GuildRole] || 0;

  return memberLevel >= requiredLevel;
}

/**
 * 获取用户在公会仓库的捐赠统计
 */
export async function getUserGuildDonationStats(guildUuid: string, userUuid: string): Promise<GuildInventoryDonation[]> {
  const donations = await prisma.guildInventoryDonate.findMany({
    where: { 
      guildUuid,
      donorUuid: userUuid 
    },
    orderBy: { createdAt: "desc" }
  });

  return donations.map(toPrismaGuildInventoryDonation);
}

// /**
//  * 删除空的仓库物品记录（数量为0）
//  */
// export async function cleanupEmptyGuildInventoryItems(guildUuid: string): Promise<number> {
//   const result = await prisma.guildInventory.deleteMany({
//     where: {
//       guildUuid,
//       count: 0
//     }
//   });

//   return result.count;
// }

/**
 * 批量获取多个公会的仓库信息
 */
// export async function getMultiGuildInventories(guildUuids: string[]): Promise<Map<string, GuildInventoryItem[]>> {
//   const result = new Map<string, GuildInventoryItem[]>();
  
//   if (!guildUuids.length) return result;

//   const items = await prisma.guildInventory.findMany({
//     where: { 
//       guildUuid: { in: guildUuids }
//     },
//     orderBy: { itemId: "asc" }
//   });

//   // 按公会分组
//   for (const item of items) {
//     const guildItems = result.get(item.guildUuid) || [];
//     guildItems.push(toPrismaGuildInventoryItem(item));
//     result.set(item.guildUuid, guildItems);
//   }

//   return result;
// }

/**
 * 获取公会特定物品的总捐赠排行榜
 */
// export async function getGuildItemDonationRanking(guildUuid: string, itemId: string): Promise<Array<{donorUuid: string, totalAmount: bigint}>> {
//   const donations = await prisma.guildInventoryDonate.findMany({
//     where: { guildUuid, itemId },
//     orderBy: { amount: "desc" }
//   });

//   return donations.map(d => ({
//     donorUuid: d.donorUuid,
//     totalAmount: d.amount
//   }));
// }

/**
 * 撤销待审批的提取申请
 */
export async function cancelWithdrawRequest(
  guildUuid: string,
  userUuid: string,
  requestUuid: string,
) {
  const updated = await prisma.guildInventoryWithdraw.update({
    where: {
      uuid: requestUuid,
      withdrawerUuid: userUuid,
      status: GuildInventoryWithdrawStatus.PENDING,
    },
    data: {
      status: GuildInventoryWithdrawStatus.CANCELLED,
    },
  });

  if (!updated) {
    throw new Error("未找到可撤销的提取申请");
  }

  return updated
}