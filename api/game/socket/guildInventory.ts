import { emitEventToServer, registerSocketEventListener } from "./socket";
import type { GuildInventoryItem, GuildInventoryDonation, GuildInventoryWithdrawal, GuildInventoryWithdrawStatus, GuildRole } from "~/shared/types/guild";
import type { ItemCountInfo } from "~/shared/types/gameInventory";

// 获取公会仓库所有物品
export function emitGetGuildInventory(guildUuid: string) {
  emitEventToServer("guildInventory:list", { guildUuid });
}
export const onGetGuildInventorySuccess = registerSocketEventListener<{ guildUuid: string; inventory: GuildInventoryItem[] }>("guildInventory:list:success");
export const onGetGuildInventoryFail = registerSocketEventListener<{ message: string }>("guildInventory:list:fail");

// 获取公会仓库特定物品信息
export function emitGetGuildInventoryItem(guildUuid: string, itemId: string) {
  emitEventToServer("guildInventory:item", { guildUuid, itemId });
}
export const onGetGuildInventoryItemSuccess = registerSocketEventListener<{ guildUuid: string; itemId: string; item: GuildInventoryItem | null }>("guildInventory:item:success");
export const onGetGuildInventoryItemFail = registerSocketEventListener<{ message: string }>("guildInventory:item:fail");

// 捐赠物品到公会仓库
export function emitDonateToGuildInventory(guildUuid: string, donations: ItemCountInfo, reason?: string) {
  emitEventToServer("guildInventory:donate", { guildUuid, donations, reason });
}
export const onDonateToGuildInventorySuccess = registerSocketEventListener<{ guildUuid: string }>("guildInventory:donate:success");
export const onDonateToGuildInventoryFail = registerSocketEventListener<{ message: string }>("guildInventory:donate:fail");

// 申请从公会仓库提取物品
export function emitRequestWithdrawFromGuildInventory(guildUuid: string, itemId: string, amount: number, reason?: string) {
  emitEventToServer("guildInventory:requestWithdraw", { guildUuid, itemId, amount, reason });
}
export const onRequestWithdrawFromGuildInventorySuccess = registerSocketEventListener<{ guildUuid: string; itemId: string; amount: number }>("guildInventory:requestWithdraw:success");
export const onRequestWithdrawFromGuildInventoryFail = registerSocketEventListener<{ message: string }>("guildInventory:requestWithdraw:fail");

// // 直接从公会仓库提取物品（管理员或有权限的成员）
// export function emitWithdrawFromGuildInventory(guildUuid: string, itemId: string, amount: number, reason?: string) {
//   emitEventToServer("guildInventory:withdraw", { guildUuid, itemId, amount, reason });
// }
// export const onWithdrawFromGuildInventorySuccess = registerSocketEventListener<{ guildUuid: string; itemId: string; amount: number }>("guildInventory:withdraw:success");
// export const onWithdrawFromGuildInventoryFail = registerSocketEventListener<{ message: string }>("guildInventory:withdraw:fail");

// 审批提取申请
export function emitApproveWithdrawRequest(guildUuid: string, withdrawerUuid: string, itemId: string, approve: boolean, reason?: string) {
  emitEventToServer("guildInventory:approveWithdraw", { guildUuid, withdrawerUuid, itemId, approve, reason });
}
export const onApproveWithdrawRequestSuccess = registerSocketEventListener<{ guildUuid: string; withdrawerUuid: string; itemId: string; approve: boolean }>("guildInventory:approveWithdraw:success");
export const onApproveWithdrawRequestFail = registerSocketEventListener<{ message: string }>("guildInventory:approveWithdraw:fail");

// 获取公会仓库捐赠记录
export function emitGetGuildInventoryDonations(guildUuid: string, itemId?: string) {
  emitEventToServer("guildInventory:donations", { guildUuid, itemId });
}
export const onGetGuildInventoryDonationsSuccess = registerSocketEventListener<{ guildUuid: string; itemId?: string; donations: GuildInventoryDonation[] }>("guildInventory:donations:success");
export const onGetGuildInventoryDonationsFail = registerSocketEventListener<{ message: string }>("guildInventory:donations:fail");

// 获取公会仓库提取记录
export function emitGetGuildInventoryWithdrawals(guildUuid: string, page?: number, pageSize?: number) {
  emitEventToServer("guildInventory:withdrawals", { guildUuid, page, pageSize });
}
export const onGetGuildInventoryWithdrawalsSuccess = registerSocketEventListener<{ guildUuid: string; withdrawals: GuildInventoryWithdrawal[]; total: number; page: number; pageSize: number }>("guildInventory:withdrawals:success");
export const onGetGuildInventoryWithdrawalsFail = registerSocketEventListener<{ message: string }>("guildInventory:withdrawals:fail");

// 获取待审批的提取申请
export function emitGetPendingWithdrawRequests(guildUuid: string) {
  emitEventToServer("guildInventory:pendingRequests", { guildUuid });
}
export const onGetPendingWithdrawRequestsSuccess = registerSocketEventListener<{ guildUuid: string; pendingRequests: GuildInventoryWithdrawal[] }>("guildInventory:pendingRequests:success");
export const onGetPendingWithdrawRequestsFail = registerSocketEventListener<{ message: string }>("guildInventory:pendingRequests:fail");

// 个人份额直接提取（批量）
export function emitPersonalWithdrawFromGuildInventory(guildUuid: string, items: ItemCountInfo, reason?: string) {
  emitEventToServer("guildInventory:personalWithdraw", { guildUuid, items, reason });
}
export const onPersonalWithdrawFromGuildInventorySuccess = registerSocketEventListener<{ guildUuid: string }>("guildInventory:personalWithdraw:success");
export const onPersonalWithdrawFromGuildInventoryFail = registerSocketEventListener<{ message: string }>("guildInventory:personalWithdraw:fail");

// 获取个人可提取余额（按物品聚合）
export function emitGetUserPersonalBalances(guildUuid: string) {
  emitEventToServer("guildInventory:personalBalances", { guildUuid });
}
export const onGetUserPersonalBalancesSuccess = registerSocketEventListener<{ guildUuid: string; balances: Record<string, number> }>("guildInventory:personalBalances:success");
export const onGetUserPersonalBalancesFail = registerSocketEventListener<{ message: string }>("guildInventory:personalBalances:fail");

// 设置物品的提取权限
// export function emitSetItemWithdrawPermission(guildUuid: string, itemId: string, minRole: GuildRole) {
//   emitEventToServer("guildInventory:setPermission", { guildUuid, itemId, minRole });
// }
// export const onSetItemWithdrawPermissionSuccess = registerSocketEventListener<{ guildUuid: string; itemId: string; minRole: GuildRole }>("guildInventory:setPermission:success");
// export const onSetItemWithdrawPermissionFail = registerSocketEventListener<{ message: string }>("guildInventory:setPermission:fail");

// 获取用户在公会仓库的捐赠统计
// export function emitGetUserGuildDonationStats(guildUuid: string, userUuid?: string) {
//   emitEventToServer("guildInventory:donationStats", { guildUuid, userUuid });
// }
// export const onGetUserGuildDonationStatsSuccess = registerSocketEventListener<{ guildUuid: string; userUuid: string; stats: GuildInventoryDonation[] }>("guildInventory:donationStats:success");
// export const onGetUserGuildDonationStatsFail = registerSocketEventListener<{ message: string }>("guildInventory:donationStats:fail");

// 撤销待审批的提取申请
// export function emitCancelWithdrawRequest(guildUuid: string, itemId: string) {
//   emitEventToServer("guildInventory:cancelRequest", { guildUuid, itemId });
// }
// export const onCancelWithdrawRequestSuccess = registerSocketEventListener<{ guildUuid: string; itemId: string }>("guildInventory:cancelRequest:success");
// export const onCancelWithdrawRequestFail = registerSocketEventListener<{ message: string }>("guildInventory:cancelRequest:fail");

// 获取物品捐赠排行榜
// export function emitGetGuildItemDonationRanking(guildUuid: string, itemId: string) {
//   emitEventToServer("guildInventory:donationRanking", { guildUuid, itemId });
// }
// export const onGetGuildItemDonationRankingSuccess = registerSocketEventListener<{ 
//   guildUuid: string; 
//   itemId: string; 
//   ranking: Array<{donorUuid: string, totalAmount: bigint}> 
// }>("guildInventory:donationRanking:success");
// export const onGetGuildItemDonationRankingFail = registerSocketEventListener<{ message: string }>("guildInventory:donationRanking:fail");

// 批量操作 - 获取多个物品信息（可选的扩展功能）
// export function emitGetMultipleGuildInventoryItems(guildUuid: string, itemIds: string[]) {
//   itemIds.forEach(itemId => {
//     emitGetGuildInventoryItem(guildUuid, itemId);
//   });
// }

// 批量捐赠验证（前端辅助函数）
export function validateDonations(donations: ItemCountInfo): { isValid: boolean; message?: string } {
  for (const itemId in donations) {
    const countInfo = donations[itemId];
    if (!countInfo?.count) {
      continue;
    }

    const count = countInfo.count;

    if (!Number.isInteger(count)) {
      return { isValid: false, message: "捐赠数量必须为整数" };
    }
    if (count <= 0) {
      return { isValid: false, message: "捐赠数量必须大于0" };
    }
    if (count > 1000000000) {
      return { isValid: false, message: "捐赠数量不能超过1000000000" };
    }
  }

  // 检查是否有有效的捐赠
  const hasValidDonation = Object.values(donations).some(countInfo => countInfo?.count && countInfo.count > 0);
  if (!hasValidDonation) {
    return { isValid: false, message: "请选择要捐赠的物品" };
  }

  return { isValid: true };
}

// 提取数量验证（前端辅助函数）
export function validateWithdrawAmount(amount: number): { isValid: boolean; message?: string } {
  if (!Number.isInteger(amount)) {
    return { isValid: false, message: "提取数量必须为整数" };
  }
  if (amount <= 0) {
    return { isValid: false, message: "提取数量必须大于0" };
  }
  if (amount > 1000000000) {
    return { isValid: false, message: "提取数量不能超过1000000000" };
  }

  return { isValid: true };
}