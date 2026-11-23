import { getUserPersonalBalances } from "~/server/utils/game/guildInventory";
import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import * as guildInventoryService from "~/server/utils/game/guildInventory";
import { ItemCountInfo } from "~/shared/types/gameInventory";
import { prisma } from "~/server/utils/game/db";
import { GuildRole, GuildInventoryWithdrawStatus } from "~/shared/types/guild";
import { allGameResource } from "~/shared/data/allGameResources";
import { GUILD_INVENTORY_DONATE_ITEM_WHITE_LIST } from "~/shared/data/constant";
import { delay } from "~/shared/utils";

// 获取公会仓库所有物品
export async function handleGetGuildInventory(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid } = data.data;

  try {
    const inventory = await guildInventoryService.getGuildInventory(guildUuid);
    emitEventToUser(userUuid, "guildInventory:list:success", { guildUuid, inventory });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildInventory:list:fail", { message: e.message || "获取失败" });
  }
}

// 获取公会仓库特定物品信息
export async function handleGetGuildInventoryItem(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; itemId: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, itemId } = data.data;

  try {
    const item = await guildInventoryService.getGuildInventoryItem(guildUuid, itemId);
    emitEventToUser(userUuid, "guildInventory:item:success", { guildUuid, itemId, item });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildInventory:item:fail", { message: e.message || "获取失败" });
  }
}

// 捐赠物品到公会仓库
export async function handleDonateToGuildInventory(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; donations: ItemCountInfo, reason?: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, donations, reason } = data.data;

  // 验证捐赠信息
  if (!donations || !Object.keys(donations).length || Object.values(donations).every(countInfo => !countInfo?.count)) {
    emitEventToUser(userUuid, "guildInventory:donate:fail", { message: "捐赠信息不能为空" });
    return;
  }

  for (const itemId in donations) {
    if (!donations[itemId]?.count) {
      continue;
    }

    let count = donations[itemId].count;

    if (!Number.isInteger(count)) {
      emitEventToUser(userUuid, "guildInventory:donate:fail", { message: "捐赠数量必须为整数" });
      return;
    }
    if (count <= 0) {
      emitEventToUser(userUuid, "guildInventory:donate:fail", { message: "捐赠数量必须大于0" });
      return;
    }

    // 检查溢出
    if (count > 100000000) {
      emitEventToUser(userUuid, "guildInventory:donate:fail", { message: "捐赠数量不能超过100000000" });
      return;
    }

    let resource = allGameResource[itemId];
    if (resource.hideInMarket && !GUILD_INVENTORY_DONATE_ITEM_WHITE_LIST.includes(resource.id)) {
      emitEventToUser(userUuid, "guildInventory:donate:fail", { message: `物品 ${resource.name} 不能捐赠到公会仓库` });
      return;
    }
  }

  try {
    await guildInventoryService.donateToGuildInventory(guildUuid, userUuid, donations, reason);
    emitEventToUser(userUuid, "guildInventory:donate:success", { guildUuid });

    // 返回更新后的仓库信息
    const inventory = await guildInventoryService.getGuildInventory(guildUuid);
    emitEventToUser(userUuid, "guildInventory:list:success", { guildUuid, inventory });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildInventory:donate:fail", { message: e.message || "捐赠失败" });
  }
}

// 申请从公会仓库提取物品
export async function handleRequestWithdrawFromGuildInventory(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; itemId: string; amount: number; reason: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, itemId, amount, reason } = data.data;

  // 验证提取数量
  if (!Number.isInteger(amount) || amount <= 0) {
    emitEventToUser(userUuid, "guildInventory:requestWithdraw:fail", { message: "提取数量必须为正整数" });
    return;
  }

  if (amount > 10000000) {
    emitEventToUser(userUuid, "guildInventory:requestWithdraw:fail", { message: "提取数量不能超过10000000" });
    return;
  }

  try {
    await guildInventoryService.requestWithdrawFromGuildInventory(guildUuid, userUuid, itemId, amount, reason);
    emitEventToUser(userUuid, "guildInventory:requestWithdraw:success", { guildUuid, itemId, amount });

    // 返回更新后的仓库信息
    const inventory = await guildInventoryService.getGuildInventory(guildUuid);
    emitEventToUser(userUuid, "guildInventory:list:success", { guildUuid, inventory });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildInventory:requestWithdraw:fail", { message: e.message || "申请失败" });
  }
}

// 个人份额直接提取（仅限个人余额，不走审批）
export async function handlePersonalWithdrawFromGuildInventory(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; items: ItemCountInfo; reason: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, items, reason } = data.data;

  if (!guildUuid || !items) {
    emitEventToUser(userUuid, "guildInventory:personalWithdraw:fail", { message: "参数错误" });
    return;
  }
  // 校验聚合对象：至少一个正数且不超过上限
  const hasValid = Object.keys(items).some(k => {
    const n = items[k]?.count ?? 0;
    return Number.isInteger(n) && n > 0 && n <= 10000000;
  });
  if (!hasValid) {
    emitEventToUser(userUuid, "guildInventory:personalWithdraw:fail", { message: "提取数量必须为正整数且不超过上限" });
    return;
  }

  try {
    await guildInventoryService.withdrawPersonalFromGuildInventoryBatch(guildUuid, userUuid, items, reason);
    emitEventToUser(userUuid, "guildInventory:personalWithdraw:success", { guildUuid });

    // 返回更新后的仓库信息
    const inventory = await guildInventoryService.getGuildInventory(guildUuid);
    emitEventToUser(userUuid, "guildInventory:list:success", { guildUuid, inventory });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildInventory:personalWithdraw:fail", { message: e.message || "提取失败" });
  }
}
// 直接从公会仓库提取物品（管理员或有权限的成员）
// export async function handleWithdrawFromGuildInventory(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ guildUuid: string; itemId: string; amount: number; reason?: string }>
// ) {
//   const userUuid = data.user.uuid;
//   const { guildUuid, itemId, amount, reason } = data.data;

//   // 验证提取数量
//   if (!Number.isInteger(amount) || amount <= 0) {
//     emitEventToUser(userUuid, "guildInventory:withdraw:fail", { message: "提取数量必须为正整数" });
//     return;
//   }

//   if (amount > 1000000000) {
//     emitEventToUser(userUuid, "guildInventory:withdraw:fail", { message: "提取数量不能超过1000000000" });
//     return;
//   }

//   try {
//     await guildInventoryService.withdrawFromGuildInventory(guildUuid, userUuid, itemId, amount, reason);
//     emitEventToUser(userUuid, "guildInventory:withdraw:success", { guildUuid, itemId, amount });

//     // 返回更新后的仓库信息
//     const inventory = await guildInventoryService.getGuildInventory(guildUuid);
//     emitEventToUser(userUuid, "guildInventory:list:success", { guildUuid, inventory });
//   } catch (e: any) {
//     emitEventToUser(userUuid, "guildInventory:withdraw:fail", { message: e.message || "提取失败" });
//   }
// }

// 审批提取申请
export async function handleApproveWithdrawRequest(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; requestUuid: string; approve: boolean; reason?: string }>
) {
  const handlerUuid = data.user.uuid;
  const { guildUuid, requestUuid, approve, reason } = data.data;

  // 验证审批者权限
  let userRole = await prisma.guildMember.findUnique({
    where: { guildUuid_userUuid: { guildUuid, userUuid: handlerUuid } },
    select: { role: true }
  });

  if (!userRole || userRole.role === GuildRole.MEMBER) {
    emitEventToUser(handlerUuid, "guildInventory:approveWithdraw:fail", { message: "权限不足" });
    return;
  }

  try {
    let requestData = await guildInventoryService.approveWithdrawRequest(guildUuid, handlerUuid, requestUuid, approve);
    emitEventToUser(handlerUuid, "guildInventory:approveWithdraw:success", { guildUuid, approve });
    emitEventToUser(requestData.withdrawerUuid, "guildInventory:approveWithdraw:success", { guildUuid, approve });

    // 返回待审批列表
    const pendingRequests = await guildInventoryService.getPendingWithdrawRequests(guildUuid);
    emitEventToUser(handlerUuid, "guildInventory:pendingRequests:success", { guildUuid, pendingRequests });

    // 返回更新后的仓库信息
    // const inventory = await guildInventoryService.getGuildInventory(guildUuid);
    // emitEventToUser(handlerUuid, "guildInventory:list:success", { guildUuid, inventory });
  } catch (e: any) {
    emitEventToUser(handlerUuid, "guildInventory:approveWithdraw:fail", { message: e.message || "审批失败" });
  }
}

// 获取公会仓库捐赠记录
export async function handleGetGuildInventoryDonations(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; itemId?: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, itemId } = data.data;

  try {
    const donations = await guildInventoryService.getGuildInventoryDonations(guildUuid, itemId);
    emitEventToUser(userUuid, "guildInventory:donations:success", { guildUuid, itemId, donations });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildInventory:donations:fail", { message: e.message || "获取失败" });
  }
}

// 获取公会仓库提取记录
export async function handleGetGuildInventoryWithdrawals(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; page?: number; pageSize?: number }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, page = 1, pageSize = 20 } = data.data;

  try {
    const { withdrawals, total } = await guildInventoryService.getGuildInventoryWithdrawalsPaged(guildUuid, page, pageSize);
    emitEventToUser(userUuid, "guildInventory:withdrawals:success", { guildUuid, withdrawals, total, page, pageSize });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildInventory:withdrawals:fail", { message: e.message || "获取失败" });
  }
}

// 获取用户在公会的个人提取余额（可提取数量）
export async function handleGetUserPersonalBalances(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid } = data.data;
  try {
    const balances = await getUserPersonalBalances(guildUuid, userUuid);
    emitEventToUser(userUuid, "guildInventory:personalBalances:success", { guildUuid, balances });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildInventory:personalBalances:fail", { message: e.message || "获取失败" });
  }
}

// 获取待审批的提取申请
export async function handleGetPendingWithdrawRequests(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid } = data.data;

  // 验证权限
  let userRole = await prisma.guildMember.findUnique({
    where: { guildUuid_userUuid: { guildUuid, userUuid } },
    select: { role: true }
  });

  if (!userRole || userRole.role === GuildRole.MEMBER) {
    emitEventToUser(userUuid, "guildInventory:pendingRequests:fail", { message: "权限不足" });
    return;
  }

  try {
    const pendingRequests = await guildInventoryService.getPendingWithdrawRequests(guildUuid);
    emitEventToUser(userUuid, "guildInventory:pendingRequests:success", { guildUuid, pendingRequests });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildInventory:pendingRequests:fail", { message: e.message || "获取失败" });
  }
}

// 设置物品的提取权限
export async function handleSetItemWithdrawPermission(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string; itemId: string; minRole: GuildRole }>
) {
  const userUuid = data.user.uuid;
  const { guildUuid, itemId, minRole } = data.data;

  // 验证权限
  let userRole = await prisma.guildMember.findUnique({
    where: { guildUuid_userUuid: { guildUuid, userUuid } },
    select: { role: true }
  });

  if (!userRole || userRole.role === GuildRole.MEMBER) {
    emitEventToUser(userUuid, "guildInventory:setPermission:fail", { message: "权限不足，只有管理员才能设置物品权限" });
    return;
  }

  try {
    await guildInventoryService.setItemWithdrawPermission(guildUuid, userUuid, itemId, minRole);
    emitEventToUser(userUuid, "guildInventory:setPermission:success", { guildUuid, itemId, minRole });

    // 返回更新后的仓库信息
    const inventory = await guildInventoryService.getGuildInventory(guildUuid);
    emitEventToUser(userUuid, "guildInventory:list:success", { guildUuid, inventory });
  } catch (e: any) {
    emitEventToUser(userUuid, "guildInventory:setPermission:fail", { message: e.message || "设置失败" });
  }
}

// 获取用户在公会仓库的捐赠统计
// export async function handleGetUserGuildDonationStats(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ guildUuid: string; userUuid?: string }>
// ) {
//   const requestUserUuid = data.user.uuid;
//   const { guildUuid, userUuid } = data.data;

//   // 如果没有指定用户，默认查询自己的统计
//   const targetUserUuid = userUuid || requestUserUuid;

//   try {
//     const stats = await guildInventoryService.getUserGuildDonationStats(guildUuid, targetUserUuid);
//     emitEventToUser(requestUserUuid, "guildInventory:donationStats:success", { guildUuid, userUuid: targetUserUuid, stats });
//   } catch (e: any) {
//     emitEventToUser(requestUserUuid, "guildInventory:donationStats:fail", { message: e.message || "获取失败" });
//   }
// }

// 撤销待审批的提取申请
// export async function handleCancelWithdrawRequest(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ guildUuid: string; requestUuid: string }>
// ) {
//   const userUuid = data.user.uuid;
//   const { guildUuid, requestUuid } = data.data;

//   try {
//     await guildInventoryService.cancelWithdrawRequest(guildUuid, userUuid, requestUuid);
//     emitEventToUser(userUuid, "guildInventory:cancelRequest:success", { guildUuid });

//     // 返回待审批列表
//     // const pendingRequests = await guildInventoryService.getPendingWithdrawRequests(guildUuid);
//     // emitEventToUser(userUuid, "guildInventory:pendingRequests:success", { guildUuid, pendingRequests });
//   } catch (e: any) {
//     emitEventToUser(userUuid, "guildInventory:cancelRequest:fail", { message: e.message || "撤销失败" });
//   }
// }

// 获取物品捐赠排行榜
// export async function handleGetGuildItemDonationRanking(
//   socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
//   data: GameSocketData<{ guildUuid: string; itemId: string }>
// ) {
//   const userUuid = data.user.uuid;
//   const { guildUuid, itemId } = data.data;

//   try {
//     const ranking = await guildInventoryService.getGuildItemDonationRanking(guildUuid, itemId);
//     emitEventToUser(userUuid, "guildInventory:donationRanking:success", { guildUuid, itemId, ranking });
//   } catch (e: any) {
//     emitEventToUser(userUuid, "guildInventory:donationRanking:fail", { message: e.message || "获取失败" });
//   }
// }