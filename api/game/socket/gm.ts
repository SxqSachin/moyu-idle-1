import type { GMRestockMarketInput } from "~/shared/types/gm"
import type { CreateWorldBossBattleConfigInput, WorldBossBattleConfig, WorldBossConfigWithState, WorldBossGlobalState } from "~/shared/types/worldBoss"
import { emitEventToServer, registerSocketEventListener } from "./socket"
import type { ItemCountInfo } from "~/shared/types/gameInventory"

export const onGmCheckFail = registerSocketEventListener<{ message: string }>("gmcheck:fail")

// 发送GM添加库存请求
export const emitGmAddInventory = (targetName: string, items: ItemCountInfo, comment: string = "") => {
    emitEventToServer("gm:addInventory", { targetName, items, comment })
}
export const onGmAddInventorySuccess = registerSocketEventListener<{ targetUuid: string, items: ItemCountInfo }>("gm:addInventory:success")
export const onGmAddInventoryFail = registerSocketEventListener<{ message: string }>("gm:addInventory:fail")

export const emitGmAddTitle = (targetName: string, title: string) => {
    emitEventToServer("gm:addTitle", { targetName, title })
}
export const onGmAddTitleSuccess = registerSocketEventListener<{ targetName: string }>("gm:addTitle:success")
export const onGmAddTitleFail = registerSocketEventListener<{ message: string }>("gm:addTitle:fail")


// 发送GM添加库存请求
export const emitGmRemoveInventory = (targetName: string, items: ItemCountInfo, comment: string = "") => {
    emitEventToServer("gm:removeInventory", { targetName, items, comment })
}

// 监听添加成功
export const onGmRemoveInventorySuccess = registerSocketEventListener<{ targetUuid: string, items: ItemCountInfo }>("gm:removeInventory:success")

// 监听添加失败
export const onGmRemoveInventoryFail = registerSocketEventListener<{ message: string }>("gm:removeInventory:fail")

// 发送GM添加库存请求
export const emitGmBanUser = (targetName: string, reason: string) => {
    emitEventToServer("gm:banUser", { targetName, reason })
}

// 监听添加成功
export const onGmBanUserSuccess = registerSocketEventListener<{ targetUuid: string }>("gm:banUser:success")
export const onGmBanUserFail = registerSocketEventListener<{ message: string }>("gm:banUser:fail")


// 发送批量发放物品请求（给所有玩家）
export const emitGmBatchAddInventory = (items: ItemCountInfo, comment: string = "", filter?: {
    uuidList?: string[]
    lastOnlineAfter?: Date | null
}) => {
    emitEventToServer("gm:batchAddInventory", { items, comment, filter })
}

// 监听批量发放进度
export const onGmBatchAddInventoryProgress = registerSocketEventListener<{ current: number, total: number, user: string }>("gm:batchAddInventory:progress")

// 监听批量发放结果
export const onGmBatchAddInventoryResult = registerSocketEventListener<{ success: string[], fail: { name: string, reason: string }[] }>("gm:batchAddInventory:result")

// 监听批量发放失败
export const onGmBatchAddInventoryFail = registerSocketEventListener<{ message: string }>("gm:batchAddInventory:fail")


// 发送批量通知
export const emitGmBatchSendNotice = (title: string, content: string, type: string, duration: number) => {
    emitEventToServer("gm:batchSendNotice", { title, content, type, duration })
}

// 监听进度
export const onGmBatchSendNoticeProgress = registerSocketEventListener<{ current: number, total: number, user: string }>("gm:batchSendNotice:progress")

// 监听结果
export const onGmBatchSendNoticeResult = registerSocketEventListener<{ success: string[], fail: { name: string, reason: string }[] }>("gm:batchSendNotice:result")

// 监听失败
export const onGmBatchSendNoticeFail = registerSocketEventListener<{ message: string }>("gm:batchSendNotice:fail")


// 监听GM通知
export const onGmNoticeReceive = registerSocketEventListener<{ title: string, content: string, type: string, duration: number }>("gm:notice:receive")


export const emitGmRemoveUserRoom = (targetName: string) => {
    emitEventToServer("gm:kickUserFromRoom", { targetName });
}

// 监听移除用户房间成功
export const onGmRemoveUserRoomSuccess = registerSocketEventListener<{ targetUuid: string }>("gm:removeUserRoom:success");
// 监听移除用户房间失败
export const onGmRemoveUserRoomFail = registerSocketEventListener<{ message: string }>("gm:removeUserRoom:fail");

export const emitGmReadTradeLog = () => {
    emitEventToServer("gm:readTradeLog");
}

// 监听移除用户房间成功
export const onGmReadTradeLogSuccess = registerSocketEventListener<{log: string}>("gm:readTradeLog:success");

// 监听移除用户房间失败
export const onGmReadTradeLogFail = registerSocketEventListener("gm:readTradeLog:fail");

export const emitGmGetUserTransactionList = (targetUuid: string, page?: number, take?: number, filterType: 'all' | 'listing' | 'purchase' = 'all') => {
    emitEventToServer("gm:getUserTransactionList", { targetUuid, page, take, filterType });
}
export const onGmGetUserTransactionListSuccess = registerSocketEventListener<{ targetUuid: string, list: any[], page?: number, take?: number, total?: number, filterType?: 'all' | 'listing' | 'purchase' }>("gm:getUserTransactionList:success");
export const onGmGetUserTransactionListFail = registerSocketEventListener<{ message: string }>("gm:getUserTransactionList:fail");

export const emitGmRollbackMarketSubTrade = (tradeUuid: string, buyerIndex: number) => {
    emitEventToServer("gm:rollbackMarketSubTrade", { tradeUuid, buyerIndex });
}
export const onGmRollbackMarketSubTradeSuccess = registerSocketEventListener<{ tradeUuid: string, buyerIndex: number, buyer: string, count: number, totalAmount: number }>("gm:rollbackMarketSubTrade:success");
export const onGmRollbackMarketSubTradeFail = registerSocketEventListener<{ message: string }>("gm:rollbackMarketSubTrade:fail");

// Purchase-side rollback (按买家维度回滚)
export const emitGmRollbackMarketPurchaseSubTrade = (tradeUuid: string, buyerIndex: number) => {
    emitEventToServer("gm:rollbackMarketPurchaseSubTrade", { tradeUuid, buyerIndex });
}
export const onGmRollbackMarketPurchaseSubTradeSuccess = registerSocketEventListener<{ tradeUuid: string, buyerIndex: number, buyer: string, count: number, totalAmount: number }>("gm:rollbackMarketPurchaseSubTrade:success");
export const onGmRollbackMarketPurchaseSubTradeFail = registerSocketEventListener<{ message: string }>("gm:rollbackMarketPurchaseSubTrade:fail");

// BuyerMarket 求购列表
export const emitGmGetUserBuyerMarketList = (targetUuid: string, page?: number, take?: number) => {
    emitEventToServer("gm:getUserBuyerMarketList", { targetUuid, page, take });
}
export const onGmGetUserBuyerMarketListSuccess = registerSocketEventListener<{ targetUuid: string, list: any[], page?: number, take?: number, total?: number }>("gm:getUserBuyerMarketList:success");
export const onGmGetUserBuyerMarketListFail = registerSocketEventListener<{ message: string }>("gm:getUserBuyerMarketList:fail");

// BuyerMarket 单笔交易回滚（按 seller_info 索引）
export const emitGmRollbackBuyerMarketSubTrade = (tradeUuid: string, sellerIndex: number) => {
    emitEventToServer("gm:rollbackBuyerMarketSubTrade", { tradeUuid, sellerIndex });
}
export const onGmRollbackBuyerMarketSubTradeSuccess = registerSocketEventListener<{ tradeUuid: string, sellerIndex: number, seller: string, count: number, totalAmount: number }>("gm:rollbackBuyerMarketSubTrade:success");
export const onGmRollbackBuyerMarketSubTradeFail = registerSocketEventListener<{ message: string }>("gm:rollbackBuyerMarketSubTrade:fail");

export const emitIncreaseSponsorPoint = (targetName: string, value: number, reason: string, bearer: string) => {
    emitEventToServer("Xcsac4a31", { targetUserName: targetName, value, reason, bearer });
}
export const onIncreaseSponsorPointSuccess = registerSocketEventListener<{ res: number }>("Xcsac4a31:success");
export const onIncreaseSponsorPointFailed = registerSocketEventListener<{ message: string }>("Xcsac4a31:fail");

export const emitPreviewSponsorPointModifyInfo = (targetName: string, value: number, reason: string, bearer: string) => {
    emitEventToServer("Xcsac4apv", { targetUserName: targetName, value, reason, bearer });
}
export const onPreviewSponsorPointModifyInfoSuccess = registerSocketEventListener<{ res: any }>("Xcsac4apv:success");
export const onPreviewSponsorPointModifyInfoFailed= registerSocketEventListener<{ message: string }>("Xcsac4apv:fail");

export const emitDecreaseSponsorPoint = (targetName: string, value: number, reason: string, bearer: string) => {
    emitEventToServer("DSvuerarv", { targetUserName: targetName, value, reason, bearer });
}
export const onDecreaseSponsorPointSuccess = registerSocketEventListener<{ res: number }>("DSvuerarv:success");
export const onDecreaseSponsorPointFailed = registerSocketEventListener<{ message: string }>("DSvuerarv:fail");

export const emitGetGMRestockMarketInfo = (bearer: string) => {
    emitEventToServer("aonrevoi:info", { bearer });
}
export const onGetGMRestockMarketInfoSuccess = registerSocketEventListener<{ res: GMRestockMarketInput[] }>("aonrevoi:info:success");

export const emitUpdateGMRestockMarketInfo = (info: GMRestockMarketInput[], bearer: string) => {
    emitEventToServer("aonrevoi:update", { info, bearer });
}
export const onUpdateGMRestockMarketInfoSuccess = registerSocketEventListener<{ res: GMRestockMarketInput }>("aonrevoi:update:success");

// Service usage (赞助服务核销) GM
export const emitGmServiceUsagePreview = (targetName: string, serviceKey: string, bearer: string) => {
    emitEventToServer("gm:serviceUsage:preview", { targetUserName: targetName, serviceKey, bearer })
}
export const onGmServiceUsagePreviewSuccess = registerSocketEventListener<{ user: { uuid: string, name: string }, serviceKey: string, usedCount: number, available: number, lastUsedAt: string | null }>("gm:serviceUsage:preview:success")
export const onGmServiceUsagePreviewFail = registerSocketEventListener<{ message: string }>("gm:serviceUsage:preview:fail")

export const emitGmServiceUsageSet = (targetName: string, serviceKey: string, usedCount: number, bearer: string) => {
    emitEventToServer("gm:serviceUsage:set", { targetUserName: targetName, serviceKey, usedCount, bearer })
}
export const onGmServiceUsageSetSuccess = registerSocketEventListener<{ user: { uuid: string, name: string }, serviceKey: string, usedCount: number, lastUsedAt: string }>("gm:serviceUsage:set:success")
export const onGmServiceUsageSetFail = registerSocketEventListener<{ message: string }>("gm:serviceUsage:set:fail")

// Sponsor point records listing (GM)
export const emitGmGetSponsorPointRecords = (
    page?: number,
    take?: number,
    changeType?: 'ADD' | 'SUBTRACT' | 'SET' | 'ALL',
    target?: string
) => {
    emitEventToServer("gm:getSponsorPointRecords", { page, take, changeType, target })
}
export const onGmGetSponsorPointRecordsSuccess = registerSocketEventListener<{ list: any[], page: number, take: number, total: number, filter: { changeType: string, target?: string } }>("gm:getSponsorPointRecords:success")
export const onGmGetSponsorPointRecordsFail = registerSocketEventListener<{ message: string }>("gm:getSponsorPointRecords:fail")

// 世界Boss配置
export const emitGmCreateWorldBossConfig = (payload: CreateWorldBossBattleConfigInput) => {
    emitEventToServer("gm:worldBossConfig:create", payload)
}
export const onGmCreateWorldBossConfigSuccess = registerSocketEventListener<WorldBossBattleConfig>("gm:worldBossConfig:create:success")
export const onGmCreateWorldBossConfigFail = registerSocketEventListener<{ message: string }>("gm:worldBossConfig:create:fail")

// 仅更新配置，不重置状态
export const emitGmUpdateWorldBossConfigOnly = (payload: CreateWorldBossBattleConfigInput) => {
    emitEventToServer("gm:worldBossConfig:updateOnly", payload)
}
export const onGmUpdateWorldBossConfigOnlySuccess = registerSocketEventListener<WorldBossBattleConfig>("gm:worldBossConfig:updateOnly:success")
export const onGmUpdateWorldBossConfigOnlyFail = registerSocketEventListener<{ message: string }>("gm:worldBossConfig:updateOnly:fail")

export const emitGmListWorldBossConfigs = () => {
    emitEventToServer("gm:worldBossConfig:list")
}
export const onGmListWorldBossConfigsSuccess = registerSocketEventListener<{ list: WorldBossConfigWithState[] }>("gm:worldBossConfig:list:success")
export const onGmListWorldBossConfigsFail = registerSocketEventListener<{ message: string }>("gm:worldBossConfig:list:fail")

export const emitGmResetWorldBoss = (bossId: string) => {
    emitEventToServer("gm:worldBoss:reset", { bossId })
}
export const onGmResetWorldBossSuccess = registerSocketEventListener<{ state: WorldBossGlobalState }>("gm:worldBoss:reset:success")
export const onGmResetWorldBossFail = registerSocketEventListener<{ message: string }>("gm:worldBoss:reset:fail")

// 为指定用户解锁样式（GM）
export const emitGmGrantStyle = (targetName: string, styleType: 'battle' | 'profile' | 'chatBubble' | 'avatarBorder', styleId: string) => {
    emitEventToServer("gm:grantStyle", { targetName, styleType, styleId })
}
export const onGmGrantStyleSuccess = registerSocketEventListener<{ targetUuid: string, styleType: string, styleId: string }>("gm:grantStyle:success")
export const onGmGrantStyleFail = registerSocketEventListener<{ message: string }>("gm:grantStyle:fail")

export const onGmGrantStyleApply = registerSocketEventListener<{ styleType: string, styleId: string }>("gm:grantStyle:apply")