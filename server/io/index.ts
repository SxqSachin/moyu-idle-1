import joinRoom from "./joinRoom";
import leaveRoom from "./leaveRoom";

import getTaskQueue from "./getTaskQueue";
import addTaskToQueue from "./addTaskToQueue";
import taskImmediatelyStart from "./task/task:immediatelyStart";
import taskReorder from "./task/task:reorder";
import removeTaskFromQueue from "./removeTaskFromQueue";
import requestInventoryInfo from "./requestInventoryInfo";

import requestCharacterStatusInfo from "./requestCharacterStatusInfo"

import requestCharacterBuildingInfo from "./requestCharacterBuildingInfo"

import requestShopBuyResource from './requestShopBuyResource'
import requestShopSellResource from './requestShopSellResource'

import {
  handleRequestIronRankingList,
  handleRequestRankingList
}
from './rank/requestRankingList'
import {
  handleRequestWeeklyIronRankingList,
  handleRequestWeeklyRankingList
} from './rank/requestWeeklyRankingList'

import requestCheaterList from './cheaterList'


import requestListToMarket from "./market/market:listToMarket";
import requestBuyFromMarket from "./market/market:buyFromMarket";
import requestRemoveFromMarket from "./market/market:removeFromMarket";
import requestTransactionInfoList from "./market/market:getTransactionList";
import marketGetListHistory from "./market/market:getListHistory";
import marketGetAllTradeableResourceList from "./market/market:getAllTradeableResourceList";
import marketGetListingLimits from "./market/market:getListingLimits";
import marketExpandSellerListingSlots from "./market/market:expandSellerListingSlots";
import marketExpandBuyerListingSlots from "./market/market:expandBuyerListingSlots";

import buyerMarketListToBuyerMarket from "./buyerMarket/buyerMarket:listToBuyerMarket";
import buyerMarketRemoveFromBuyerMarket from "./buyerMarket/buyerMarket:removeFromBuyerMarket";
import buyerMarketGetAllTradeableResourceList from "./buyerMarket/buyerMarket:getAllTradeableResourceList";
import buyerMarketGetTransactionList from "./buyerMarket/buyerMarket:getTransactionList";
import buyerMarketGetListHistory from "./buyerMarket/buyerMarket:getListHistory";
import buyerMarketSellToBuyerMarket from "./buyerMarket/buyerMarket:sellToBuyerMarket";

import unifiedMarketgetAllMarketResourceIds from './newMarket/newMarket:getAllTradeableResourceList'
import unifiedTransactionList from './newMarket/newMarket:getUnifiedTransactionList'
import unifiedTransactionHistory from './newMarket/newMarket:getUnifiedTransactionHistory';
import {
  handleGetBatchMarketPriceDataSimple,
  handleGetMarketPriceData
}
from './newMarket/newMarket'
import { handleGetRecentTradedResources } from './newMarket/newMarket'

import requestUseItem from "./effectAction/effectAction:useItem";


import { curioIdentify, curioQuery, curioGetTags, curioQueryByTag, curioMuseum } from "./curio";


import characterGetInfo from "./character/character:getInfo";
import characterResetPassword from "./character/character:resetPassword";

import getProfile from "./character/character:getProfile";
import getGameState from "./character/character:getGameState";
import updateProfile from "./character/character:updateProfile";

import getCharacterEquipment from './character/character:getEquipment'
import {
    getOtherPlayerEquipment,
    getOtherPlayerWorkEquipment,
}from './character/character:getOtherPlayerEquipment'
import getCharacterSkill from './character/character:getSkills'

import updateSkillCastLogic from "./character/character:updateSkillCastLogic";
import enableSkill from "./character/character:enableSkill";
import disableSkill from "./character/character:disableSkill";
import copySkillLogic from "./character/character:copySkillLogic";
import characterReorderSkill from "./character/character:reorderSkill"
import characterGetBattleInventory from "./character/character:getBattleInventory";
import characterAddResourceToBattleInventory from "./battleInventory/character:addResourceToBattleInventory";
import characterRemoveResourceToBattleInventory from "./battleInventory/character:removeResourceFromBattleInventory";
import characterRefillBattleInventory from "./battleInventory/character:refillBattleInventory";
import characterUpdateBattleUseItemLogic from "./battleInventory/character:updateBattleUseItemLogic";
import characterUpdateBattleInventoryOrder from "./battleInventory/character:reorderBattleInventory";

import getCurrentPlayerCount from "./game/game:currentPlayerCount"

import getPublicChatList from "./chat/chat:getPublicChatList"
import createPublicChatMsg from "./chat/chat:createPublicChatMsg"
import createPrivateChatMsg from "./chat/chat:createPrivateChatMsg"
import getPrivateChatList from "./chat/chat:getPrivateChatList"
import getAllPrivateChatList from "./chat/chat:getAllPrivateChatList"

import getIronPublicChatList from "./chat/chat:getIronPublicChatList"
import createIronPublicChatMsg from "./chat/chat:createIronPublicChatMsg"
import { blockUserHandler, unblockUserHandler, getBlockListHandler } from "./chat/chat:block"

import {
    createRoomChatMsg as createChatRoomMsg,
    getRoomChatList as getChatRoomList
} from './chat/chat:room'

import {
    createGuildChatMsg,
    getGuildChatList
} from './chat/chat:guild'

import questGetList from "./quest/quest:getList";
import questComplete, {handleCompleteAllDoneQuest} from "./quest/quest:complete";
import questReroll from "./quest/quest:reroll";
import questDelete from "./quest/quest:delete";

import equipItem from './effectAction/effectAction:equipItem'
import unequipItem from './effectAction/effectAction:unequipItem'

import updateActionDuration from './character/character:updateActionDuration'
import updateActionResourceRequirement from './character/character:updateActionResourceRequirement'

import kittyGetAllTask from "./kitty/kitty:getAllTask";
import kittyAddTask from "./kitty/kitty:addTask";
import kittyGetAll from "./kitty/kitty:getAll";
import kittyCreate from "./kitty/kitty:create";
import kittyRemoveTask from "./kitty/kitty:removeTask";
import kittyReorder from "./kitty/kitty:reorder";
import kittyFeed from "./kitty/kitty:feed";
import kittyRename from "./kitty/kitty:rename";
import { kittyTraitsGet, kittyTraitsRemove, kittyTraitsAdd, kittyTraitsAddExp } from "./kitty/kitty:traits";

import battleRoomCreate from "./room/battleRoom:create";
import battleRoomUpdate from "./room/battleRoom:update";
import battleRoomSetAutoWorldBossBattleConf from "./room/battleRoom:setAutoWorldBossBattleConf";
import battleRoomAddPhantom from "./room/battleRoom:addPhantom";
import battleRoomGetAll from "./room/battleRoom:list";
import battleRoomJoin from "./room/battleRoom:join";
import battleRoomLeave from "./room/battleRoom:leave";
import battleRoomKick from "./room/battleRoom:kick";
import battleRoomUpdateReadyState from "./room/battleRoom:updateReadyState";
import battleRoomGetCurrentRoom from "./room/battleRoom:getCurrentRoom";
import battleRoomAddOffering from "./room/battleRoom:addOffering";
import { handleGetRoomBattleReward, handleReorderRoomMember, handleResetSelfBattleReward } from "./room/battleRoom";

import battleLeave from "./battle/battle:leaveBattle";
import battleStop from "./battle/battle:stopBattle"
import msgPrefBattleSet from "./msgPref:battle:set";

import {
  handleJoinViewBattleRoom,
  handleLeaveViewBattleRoom
} from './room/battleRoom:viewer'

import battleRoomStartBattle from "./room/battleRoom:startBattle";

import battleGetInfo from "./battle/battle:getInfo"; // ← 添加这行


import inventoryGetModifyInfo from "./inventory/inventory:getModifyInfo";
import inventoryGetModifyInfoByType from "./inventory/inventory:getModifyInfoByType";

import enhanceRequire from "./enhance/enhance:require"
import {
    requestAutoEnhance,
    requestAutoEnhanceHistory,
    requestCurrentAutoEnhance,
    requestStopAutoEnhance
} from "./enhance/enhance:auto"


import gmAddInventory from "./gm/gm:addItem";
import gmRemoveInventory from "./gm/gm:removeItem";
import gmBatchAddItem from "./gm/gm:batchAddItem";
import gmBatchSendNotice from "./gm/gm:batchSendNotice";
import gmWorldBossConfigCreate from "./gm/gm:worldBossConfig:create";
import gmWorldBossConfigList from "./gm/gm:worldBossConfig:list";
import gmWorldBossConfigUpdateOnly from "./gm/gm:worldBossConfig:updateOnly";
import gmWorldBossReset from "./gm/gm:worldBoss:reset";
import gmRemoveUserRoom from "./gm/gm:removeUserRoom";
import gmReadTradeLog from "./gm/gm:readTradeLog";
import gmAddTitle from "./gm/gm:addTitle";
import gmGetUserTransactionList from "./gm/gm:getUserTransactionList";
import gmRollbackMarketSubTrade from "./gm/gm:rollbackMarketSubTrade";
import gmGetUserBuyerMarketList from "./gm/gm:getUserBuyerMarketList";
import gmRollbackBuyerMarketSubTrade from "./gm/gm:rollbackBuyerMarketSubTrade";
import gmGetSponsorPointRecords from "./gm/gm:getSponsorPointRecords";
import gmRollbackMarketPurchaseSubTrade from "./gm/gm:rollbackMarketPurchaseSubTrade";
import gmGrantStyle from "./gm/gm:grantStyle";
import {
  increaseSponsorPoint,
  decreaseSponsorPoint,
  previewSponsorPointModifyInfo
} from "./gm/gm:sponsorPoint";
import { gmServiceUsagePreview, gmServiceUsageSet } from "./gm/gm:serviceUsage";


import tavernHireExpert from "./tavern/tavern:hireExpert";
import tavernGetMyExperts from "./tavern/tavern:getExperts";
import tavernRenewExpert from "./tavern/tavern:renewExpert";
import {
  handlePauseTalentCat,
  handleResumeTalentCat

} from "./tavern/tavern:parseAndResume"

import {
    handleSendFriendRequest,
    handleAcceptFriendRequest,
    handleRejectFriendRequest,
    handleRemoveFriend,
    handleGetFriendList,
    handleGetFriendRequests,
} from "./friend";
import {
  handleStartFishing,
  handleGetNearbyFishingPlayers,
  handleGetMyActiveSession,
  handleEndFishing,
  handleGetCatches,
  handleGetMySessions,
  handleGetBaitAreas,
  handleGetMyBaitAreas,
  handleGetMyCatches,
  handleSellCaughtFish,
  handleBatchSellCaughtFish,
  handleGetLeaderboard,
  handleSendShout,
} from "./fishing";

import {
    handleGetUserFurniture,
    handleInstallFurniture,
    handleRepairFurniture,
    handleToggleFurniture,
    handleCheckCanInstallFurniture,
    handleCheckCanRepairFurniture,
    handleGetFurnitureByType,
    handleGetActiveFurnitureByType,
    handleDecreaseFurnitureDurability,
    handleConfigureFurniture_AutoFeeder
} from "./kitty/kittyFurniture";

import {
    ioGetKittyAllEssay
} from "./kitty/kittyEssay"

import { ioDeleteKittyFriend, ioGetKittyAllFriend } from "./kitty/kittyFriend";

import {
    handleCreateGuild,
    handleGetGuildList,
    handleRequestJoinGuild,
    handleHandleJoinRequest,
    handleGetGuildMembers,
    handleUpdateGuildInfo,
    handleKickMember,
    handleDisbandGuild,
    handleTransferGuildOwner,
    handleGetGuildJoinRequests,
    handleGetUserJoinRequests,
    handleGetMyGuild,
    handleGetOtherGuildInfo,
    handleLeaveGuild,

    handleAddGuildTitle,
    handleUpdateGuildTitle,
    handleDeleteGuildTitle,
    handleGetGuildTitles,
    handleSetGuildMemberTitle,
    handleGetMyGuildMemberInfo,
} from "./guild";

import {
  handleDensefogStateEffect,
    handleGuildGrandBathhouseEffect,
    handleVitalityCatStatueEffect,
    handleWishingPoolEffect
} from "./guild/buildingEffect"

import {
  handleGetBuiltGuildBuildings,
  handlePrepareBuildGuildBuilding,
  handlePrepareUpgradeGuildBuilding,
  handleDonateGuildBuildingMaterial,
  handleGetGuildBuildingMaterialFund,
  handleGetDonationList
} from "./guild/building";

import {
  handleGetGuildInventory,
  handleGetGuildInventoryItem,
  handleDonateToGuildInventory,
  handleRequestWithdrawFromGuildInventory,
  handleApproveWithdrawRequest,
  handleGetGuildInventoryDonations,
  handlePersonalWithdrawFromGuildInventory,
  handleGetUserPersonalBalances,
  handleGetGuildInventoryWithdrawals,
  handleGetPendingWithdrawRequests,
  handleSetItemWithdrawPermission,
//   handleCancelWithdrawRequest,
} from "./guild/inventory";

import {
  handleCreateOutfit,
  handleApplyOutfit,
  handleUpdateOutfit,
  handleDeleteOutfit,
  handleGetAllOutfits,
  
  handleApplySkillOutfitToCharacter,
  handleGetAllSkillOutfit,
  handleSaveCurrentSkillAsOutfit,
  handleDeleteSkillOutfit,
} from "./character/outfit";

import {
  checkBanned,
  bindEmail,
  sendVerifyEmailCode,
  verifyEmailVerifyCode,
} from "./user/index"

import {
  sponsorPoint_get,
//   sponsorPoint_subtract,
//   sponsorPoint_set,
  sponsorPoint_record_list
} from "./user/sponsorPoint";
import {
  uniqueFlag_all,
} from "./user/uniqueFlag";
import {
  ioBuyFromSponsorShop,
  ioExchangeSponsorPointPack,
} from "./shop/sponsorShop";

import {
    style_get,
    style_setAll,
    style_setBattle,
    style_setProfile,
    // style_setChat,
    // style_setChatName
} from './style'

import userPersonalizationGet from './userPersonalization/get'
import userPersonalizationSetFavorites from './userPersonalization/setFavorites'
import userPersonalizationSetCategoryOrder from './userPersonalization/setCategoryOrder'

import {
    handleGetAllExpeditionTeams,
    handleCreateExpeditionTeam,
    handleJoinExpeditionTeam,
    handleDeleteExpeditionTeam,
    handleBeginExpedition,
    handleLeaveExpeditionTeam,
    handleGetAllExpeditionInfoAboutUser,
    handleReturnExpedition,
    handleGetAllExpeditionFinishHistoryAboutUser,
} from "./kitty/kittyExpedition";

import {
  handleGetBuiltVillageBuildings,
  handlePrepareBuildVillageBuilding,
  handleDonateVillageBuildingMaterial,
  handleGetVillageBuildingMaterialFund,
  handleGetVillageBuildingDonationList,
  handleGetNormalStateBaseVillageBuildings,
  handlePrepareUpgradeVillageBuilding,
} from "./village/building";

import { getReferrerInfo, handleClaimedStage1Reward, handleClaimedStage2Reward, getMyInviter, confirmReferredRelationship, getConfirmReferredRelationshipInfo, deleteReferredRelationship, handleSetInviteRewardSetting, handleGetInviteRewardSetting } from "./referrer";

import { GameSocketUserInfo } from "~/shared/types/socket";

import { handleCreateSubaccount, handleGetAccountList, } from "./character/account";

import {
  getAuctionList,
  getAuctionDetail,
  getUpcomingAuctions,
  handleCreateAuction,
  // handleDepositForAuction,
  handlePlaceBid,
  getBidHistory,
  handleSettleAuction,
  handleCancelAuction,
} from "./auction";

import * as characterPhantomIO from "./characterPhantom";
import {
  handleGetFarmPlots,
  handleUnlockFarmPlot,
  handlePlantFarmPlot,
  handleHarvestFarmPlot,
  handleToggleAutoReplant,
  handleShovelFarmPlot,
  // handleCreateFarmPlot,
} from "./farming";
import { handleHarvestBoxClaim, handleHarvestBoxClaimItem, handleHarvestBoxList, handleHarvestBoxClaimAll } from "./harvestBox";
import { ioCreatePlayerShop } from "./playerShop/playerShop:create";
import { ioRenewPlayerShop } from "./playerShop/playerShop:renew";
import { ioAddItemToShop } from "./playerShop/playerShop:addItem";
import { ioUpdatePlayerShopItem } from "./playerShop/playerShop:updateItem";
import { ioRemoveItemFromShop } from "./playerShop/playerShop:removeItem";
import { ioBuyFromPlayerShop } from "./playerShop/playerShop:buy";
import { ioGetMyShops, ioGetShopDetail, ioGetPublicShops } from "./playerShop/playerShop:list";
import { ioUpdatePlayerShop } from "./playerShop/playerShop:update";
import { ioGetPlayerShopPurchaseList } from "./playerShop/playerShop:getPurchaseList";
import playerShopExpandItemSlots from "./playerShop/playerShop:expandItemSlots";
import playerShopGetListingLimits from "./playerShop/playerShop:getListingLimits";
import { ioPinPlayerShop } from "./playerShop/playerShop:pin";
import { ioUnpinPlayerShop } from "./playerShop/playerShop:unpin";
import ioGetPinned from "./playerShop/playerShop:getPinned";

const allEvent = {
  joinRoom,
  leaveRoom,

  getTaskQueue,
  addTaskToQueue,
  removeTaskFromQueue,
  "task:immediatelyStart": taskImmediatelyStart,
  "task:reorder": taskReorder,

  requestInventoryInfo,

  requestCharacterStatusInfo,

  requestCharacterBuildingInfo,

  requestRankingList: handleRequestRankingList,
  requestIronRankingList: handleRequestIronRankingList,
  requestWeeklyRankingList: handleRequestWeeklyRankingList,
  requestWeeklyIronRankingList: handleRequestWeeklyIronRankingList,
  cheaterList,

  requestShopBuyResource,
  requestShopSellResource,

  "market:getAllTradeableResourceList": marketGetAllTradeableResourceList,
  "market:buyFromMarket": requestBuyFromMarket,
  "market:listToMarket": requestListToMarket,
  "market:removeFromMarket": requestRemoveFromMarket,
  "market:getTransactionList": requestTransactionInfoList,
  "market:getListHistory": marketGetListHistory,
  "market:getListingLimits": marketGetListingLimits,
  "market:expandSellerListingSlots": marketExpandSellerListingSlots,
  "market:expandBuyerListingSlots": marketExpandBuyerListingSlots,
  "effectAction:useItem": requestUseItem,

  "buyerMarket:listToBuyerMarket": buyerMarketListToBuyerMarket,
  "buyerMarket:removeFromBuyerMarket": buyerMarketRemoveFromBuyerMarket,
  "buyerMarket:getAllTradeableResourceList":
    buyerMarketGetAllTradeableResourceList,
  "buyerMarket:getTransactionList": buyerMarketGetTransactionList,
  "buyerMarket:listHistory": buyerMarketGetListHistory,
  "buyerMarket:sellToBuyerMarket": buyerMarketSellToBuyerMarket,

  "newMarket:getAllTradeableResourceList": unifiedMarketgetAllMarketResourceIds,
  "newMarket:getUnifiedTransactionList": unifiedTransactionList,
  "newMarket:getUnifiedTransactionHistory": unifiedTransactionHistory,
  "newMarket:priceData": handleGetMarketPriceData,
  "newMarket:batchPriceData": handleGetBatchMarketPriceDataSimple,
  "newMarket:getRecentTradedResources": handleGetRecentTradedResources,

  // 注册角色相关接口
  "character:getInfo": characterGetInfo,
  "character:resetPassword": characterResetPassword,

  "character:getProfile": getProfile,
  "character:getGameState": getGameState,
  "character:updateProfile": updateProfile,
  "character:getEquipment": getCharacterEquipment,
  "character:getOtherPlayerEquipment": getOtherPlayerEquipment,
  "character:getOtherPlayerWorkEquipment": getOtherPlayerWorkEquipment,
  "character:getSkills": getCharacterSkill,
  "character:reorderSkill": characterReorderSkill, // 注册技能顺序调整接口

  "character:updateSkillCastLogic": updateSkillCastLogic,
  "character:enableSkill": enableSkill,
  "character:disableSkill": disableSkill,
  "character:copySkillLogic": copySkillLogic,

  "character:updateActionDuration": updateActionDuration,
  "character:updateActionResourceRequirement": updateActionResourceRequirement,

  "character:getBattleInventory": characterGetBattleInventory,
  "character:addResourceToBattleInventory":
    characterAddResourceToBattleInventory,
  "character:removeResourceFromBattleInventory":
    characterRemoveResourceToBattleInventory,
  "character:refillBattleInventory": characterRefillBattleInventory,
  "character:updateBattleUseItemLogic": characterUpdateBattleUseItemLogic,
  "character:reorderBattleInventory": characterUpdateBattleInventoryOrder,

  // "curio:identify": curioIdentify,
  // "curio:query": curioQuery,
  // "curio:getTags": curioGetTags,
  // "curio:queryByTag": curioQueryByTag,
  // "curio:museum": curioMuseum,

  "game:currentPlayerCount": getCurrentPlayerCount,

  "chat:getPublicChatList": getPublicChatList,
  "chat:createPublicChatMsg": createPublicChatMsg,
  "chat:createPrivateChatMsg": createPrivateChatMsg,
  "chat:getPrivateChatList": getPrivateChatList,
  "chat:getAllPrivateChatList": getAllPrivateChatList,
  "chat:createRoomChatMsg": createChatRoomMsg,
  "chat:getRoomChatList": getChatRoomList,
  "chat:createGuildChatMsg": createGuildChatMsg,
  "chat:getGuildChatList": getGuildChatList,
  "chat:createIronPublicChatMsg": createIronPublicChatMsg,
  "chat:getIronPublicChatList": getIronPublicChatList,
  "chat:blockUser": blockUserHandler,
  "chat:unblockUser": unblockUserHandler,
  "chat:getBlockList": getBlockListHandler,

  "quest:list": questGetList,
  "quest:complete": questComplete,
  "quest:completeAll": handleCompleteAllDoneQuest,
  "quest:reroll": questReroll,
  "quest:delete": questDelete,

  "effectAction:equipItem": equipItem,
  "effectAction:unequipItem": unequipItem,

  "kitty:traits:get": kittyTraitsGet,
  "kitty:traits:remove": kittyTraitsRemove,
  "kitty:traits:add": kittyTraitsAdd,
  "kitty:traits:addExp": kittyTraitsAddExp,

  "kitty:getAll": kittyGetAll,
  "kitty:create": kittyCreate,
  "kitty:feed": kittyFeed,
  "kitty:getAllTask": kittyGetAllTask,
  "kitty:addTask": kittyAddTask,
  "kitty:reorder": kittyReorder,
  "kitty:removeTask": kittyRemoveTask,
  "kitty:rename": kittyRename,

  "battleRoom:create": battleRoomCreate,
  "battleRoom:update": battleRoomUpdate,
  "battleRoom:setAutoWorldBossBattleConf": battleRoomSetAutoWorldBossBattleConf,
  "battleRoom:list": battleRoomGetAll,
  "battleRoom:join": battleRoomJoin,
  "battleRoom:leave": battleRoomLeave,
  "battleRoom:kick": battleRoomKick,
  "battleRoom:updateReadyState": battleRoomUpdateReadyState, // 注册准备状态接口
  "battleRoom:getCurrentRoom": battleRoomGetCurrentRoom,
  "battleRoom:addOffering": battleRoomAddOffering,
  "battleRoom:returnOffering": battleRoomReturnOffering,
  "battleRoom:reorder": handleReorderRoomMember,
  "battleRoom:rewardInfo": handleGetRoomBattleReward,

  "battleRoom:resetSelfBattleRewardInfo": handleResetSelfBattleReward,
  // 'battleRoom:joinView': handleJoinViewBattleRoom,
  // 'battleRoom:leaveView': handleLeaveViewBattleRoom,

  // 'battleRoom:addPhantom': battleRoomAddPhantom,

  "battleRoom:startBattle": battleRoomStartBattle, // 注册新接口

  "battle:getInfo": battleGetInfo, // ← 注册新接口
  "battle:leaveBattle": battleLeave,
  "battle:stopBattle": battleStop, // ← 注册新接口
  "msgPref:battle:set": msgPrefBattleSet,

  // 世界Boss（玩家可见）
  "worldBoss:listAvailable": worldBossListAvailable,
  "worldBoss:leaderboard": worldBossLeaderboard,
  "worldBoss:leaderboardGroups": worldBossLeaderboardGroups,
  "worldBoss:get": worldBossGet,
  "worldBoss:claimReward": worldBossClaimReward,

  "inventory:getModifyInfo": inventoryGetModifyInfo,
  "inventory:getModifyInfoByType": inventoryGetModifyInfoByType,

  "enhance:require": enhanceRequire,
  "enhance:auto": requestAutoEnhance,
  "enhance:history": requestAutoEnhanceHistory,
  "enhance:current": requestCurrentAutoEnhance,
  "enhance:stop": requestStopAutoEnhance,

  "gm:addInventory": gmAddInventory,
  "gm:removeInventory": gmRemoveInventory,
  "gm:batchAddInventory": gmBatchAddItem,
  "gm:batchSendNotice": gmBatchSendNotice,
  "gm:worldBossConfig:create": gmWorldBossConfigCreate,
  "gm:worldBossConfig:updateOnly": gmWorldBossConfigUpdateOnly,
  "gm:worldBossConfig:list": gmWorldBossConfigList,
  "gm:worldBoss:reset": gmWorldBossReset,
  "gm:kickUserFromRoom": gmRemoveUserRoom,
  "gm:readTradeLog": gmReadTradeLog,
  "gm:getUserTransactionList": gmGetUserTransactionList,
  "gm:rollbackMarketSubTrade": gmRollbackMarketSubTrade,
  "gm:rollbackMarketPurchaseSubTrade": gmRollbackMarketPurchaseSubTrade,
  "gm:getUserBuyerMarketList": gmGetUserBuyerMarketList,
  "gm:rollbackBuyerMarketSubTrade": gmRollbackBuyerMarketSubTrade,
  "gm:getSponsorPointRecords": gmGetSponsorPointRecords,
  "gm:addTitle": gmAddTitle,
  "gm:banUser": gmBanUser,
  "gm:grantStyle": gmGrantStyle,
  "gm:serviceUsage:preview": gmServiceUsagePreview,
  "gm:serviceUsage:set": gmServiceUsageSet,

  Xcsac4a31: increaseSponsorPoint,
  Xcsac4apv: previewSponsorPointModifyInfo,
  DSvuerarv: decreaseSponsorPoint,
  "aonrevoi:info": handleGetGMRestockMarketInfo,
  "aonrevoi:update": handleGMRestockMarket,

  // Tavern（小酒馆/专家猫咪）相关接口
  "tavern:hireExpert": tavernHireExpert,
  "tavern:getMyExperts": tavernGetMyExperts,
  "tavern:renewExpert": tavernRenewExpert, // ← 注册续约接口
  "tavern:pause": handlePauseTalentCat, // 暂停专家猫咪
  "tavern:resume": handleResumeTalentCat, // 恢复专家猫咪

  "friend:sendRequest": handleSendFriendRequest,
  "friend:acceptRequest": handleAcceptFriendRequest,
  "friend:rejectRequest": handleRejectFriendRequest,
  "friend:remove": handleRemoveFriend,
  "friend:getList": handleGetFriendList,
  "friend:getRequests": handleGetFriendRequests,
  "fishing:start": handleStartFishing,
  "fishing:nearby:get": handleGetNearbyFishingPlayers,
  "fishing:myActive:get": handleGetMyActiveSession,
  "fishing:end": handleEndFishing,
  "fishing:catches:get": handleGetCatches,
  "fishing:sessions:get": handleGetMySessions,
  "fishing:baitAreas:get": handleGetBaitAreas,
  "fishing:myBaitAreas:get": handleGetMyBaitAreas,
  "fishing:sell": handleSellCaughtFish,
  "fishing:sell:batch": handleBatchSellCaughtFish,
  "fishing:shout:send": handleSendShout,
  "fishing:myCatches:get": handleGetMyCatches,
  "fishing:leaderboard:get": handleGetLeaderboard,
  "kitty:deleteFriend": ioDeleteKittyFriend,

  // 注册猫咪家具相关接口
  "kitty:furniture:getAll": handleGetUserFurniture,
  "kitty:furniture:install": handleInstallFurniture,
  "kitty:furniture:repair": handleRepairFurniture,
  "kitty:furniture:toggle": handleToggleFurniture,
  "kitty:furniture:checkCanInstall": handleCheckCanInstallFurniture,
  "kitty:furniture:checkCanRepair": handleCheckCanRepairFurniture,
  "kitty:furniture:getByType": handleGetFurnitureByType,
  "kitty:furniture:getActiveByType": handleGetActiveFurnitureByType,
  "kitty:furniture:decreaseDurability": handleDecreaseFurnitureDurability,
  "kitty:furniture:configureFurniture_AutoFeeder":
    handleConfigureFurniture_AutoFeeder,

  "kitty:getAllEssay": ioGetKittyAllEssay,
  "kitty:getAllFriend": ioGetKittyAllFriend,

  "guild:create": handleCreateGuild,
  "guild:getList": handleGetGuildList,
  "guild:requestJoin": handleRequestJoinGuild,
  "guild:handleJoinRequest": handleHandleJoinRequest,
  "guild:getMembers": handleGetGuildMembers,
  "guild:updateInfo": handleUpdateGuildInfo,
  "guild:kickMember": handleKickMember,
  "guild:disband": handleDisbandGuild,
  "guild:transferOwner": handleTransferGuildOwner,
  "guild:getJoinRequests": handleGetGuildJoinRequests,
  "guild:getUserJoinRequests": handleGetUserJoinRequests,
  "guild:getMyGuild": handleGetMyGuild,
  "guild:getOtherGuild": handleGetOtherGuildInfo,
  "guild:leave": handleLeaveGuild,
  "guild:getMyGuildMemberInfo": handleGetMyGuildMemberInfo,

  "guild:title:add": handleAddGuildTitle,
  "guild:title:update": handleUpdateGuildTitle,
  "guild:title:delete": handleDeleteGuildTitle,
  "guild:title:list": handleGetGuildTitles,
  "guild:title:set": handleSetGuildMemberTitle,

  "guildBuilding:list": handleGetBuiltGuildBuildings,
  "guildBuilding:prepare": handlePrepareBuildGuildBuilding,
  "guildBuilding:upgrade": handlePrepareUpgradeGuildBuilding,
  "guildBuilding:donate": handleDonateGuildBuildingMaterial,
  "guildBuilding:fund": handleGetGuildBuildingMaterialFund,
  "guildBuilding:donationList": handleGetDonationList,

  "guildBuildingEffect:wishingPool": handleWishingPoolEffect,
  "guildBuildingEffect:vitalityCatStatue": handleVitalityCatStatueEffect,
  "guildBuildingEffect:denseFogLighthouse": handleDensefogStateEffect,
  "guildBuildingEffect:guildGrandBathhouse": handleGuildGrandBathhouseEffect,

  "guildInventory:list": handleGetGuildInventory,
  "guildInventory:item": handleGetGuildInventoryItem,
  "guildInventory:donate": handleDonateToGuildInventory,
  "guildInventory:donations": handleGetGuildInventoryDonations,
  "guildInventory:personalWithdraw": handlePersonalWithdrawFromGuildInventory,
  "guildInventory:personalBalances": handleGetUserPersonalBalances,
  'guildInventory:withdrawals': handleGetGuildInventoryWithdrawals,

  // 'guildInventory:withdraw': handleWithdrawFromGuildInventory,
  // 'guildInventory:requestWithdraw': handleRequestWithdrawFromGuildInventory,
  // 'guildInventory:approveWithdraw': handleApproveWithdrawRequest,
  // 'guildInventory:pendingRequests': handleGetPendingWithdrawRequests,
  // 'guildInventory:setPermission': handleSetItemWithdrawPermission,

  // 'guildInventory:donationStats': handleGetUserGuildDonationStats,
  // 'guildInventory:cancelRequest': handleCancelWithdrawRequest,
  // 'guildInventory:donationRanking': handleGetGuildItemDonationRanking,

  "user:checkBanned": checkBanned,
  // "user:bindEmail": bindEmail,
  "user:sendVerifyEmailCode": sendVerifyEmailCode,
  "user:verifyEmailVerifyCode": verifyEmailVerifyCode,

  // 配装相关接口注册
  "outfit:create": handleCreateOutfit,
  "outfit:apply": handleApplyOutfit,
  "outfit:update": handleUpdateOutfit,
  "outfit:delete": handleDeleteOutfit,
  "outfit:getAll": handleGetAllOutfits,
  "skillOutfit:apply": handleApplySkillOutfitToCharacter,
  "skillOutfit:saveCurrent": handleSaveCurrentSkillAsOutfit,
  "skillOutfit:list": handleGetAllSkillOutfit,
  "skillOutfit:delete": handleDeleteSkillOutfit,

  // 赞助积分相关接口注册
  "sponsorPoint:get": sponsorPoint_get,
  //onsorPoint:record:list': sponsorPoint_record_list,

  "uniqueFlag:all": uniqueFlag_all,

  "shop:buyFromSponsorShop": ioBuyFromSponsorShop,
  "shop:exchangeSponsorPointPack": ioExchangeSponsorPointPack,

  // Player self-run shop (店铺)
  "playerShop:create": ioCreatePlayerShop,
  "playerShop:renew": ioRenewPlayerShop,
  "playerShop:addItem": ioAddItemToShop,
  "playerShop:updateItem": ioUpdatePlayerShopItem,
  "playerShop:removeItem": ioRemoveItemFromShop,
  "playerShop:buy": ioBuyFromPlayerShop,
  "playerShop:my": ioGetMyShops,
  "playerShop:detail": ioGetShopDetail,
  "playerShop:public": ioGetPublicShops,
  "playerShop:update": ioUpdatePlayerShop,
  "playerShop:pin": ioPinPlayerShop,
  "playerShop:unpin": ioUnpinPlayerShop,
  "playerShop:getPinned": ioGetPinned,
  "playerShop:purchaseList": ioGetPlayerShopPurchaseList,
  "playerShop:expandItemSlots": playerShopExpandItemSlots,
  "playerShop:getListingLimits": playerShopGetListingLimits,

  "style:get": style_get,
  // 'style:setBattle': style_setBattle,
  // 'style:setChat': style_setChat,
  // 'style:setChatName': style_setChatName,
  "style:setAll": style_setAll,

  // User personalization (favorites / category order)
  "userPersonalization:get": userPersonalizationGet,
  "userPersonalization:setFavorites": userPersonalizationSetFavorites,
  "userPersonalization:setCategoryOrder": userPersonalizationSetCategoryOrder,

  // 猫咪探险队相关接口注册
  "kittyExpedition:my": handleGetAllExpeditionInfoAboutUser,
  "kittyExpedition:myHistory": handleGetAllExpeditionFinishHistoryAboutUser,
  "kittyExpedition:getAll": handleGetAllExpeditionTeams,
  "kittyExpedition:create": handleCreateExpeditionTeam,
  "kittyExpedition:join": handleJoinExpeditionTeam,
  "kittyExpedition:leave": handleLeaveExpeditionTeam, // 探险队离开战斗
  "kittyExpedition:delete": handleDeleteExpeditionTeam,
  "kittyExpedition:begin": handleBeginExpedition,
  "kittyExpedition:return": handleReturnExpedition,

  // 小镇建筑相关接口注册
  "villageBuilding:normalStateBaseBuildings":
    handleGetNormalStateBaseVillageBuildings,
  "villageBuilding:list": handleGetBuiltVillageBuildings,
  "villageBuilding:prepare": handlePrepareBuildVillageBuilding,
  "villageBuilding:donate": handleDonateVillageBuildingMaterial,
  "villageBuilding:fund": handleGetVillageBuildingMaterialFund,
  "villageBuilding:donationList": handleGetVillageBuildingDonationList,
  "villageBuilding:upgrade": handlePrepareUpgradeVillageBuilding,

  // 征战圣火
  "battlePyreAltar:consecrate": consecrateBattlePyreAltar,
  "battlePyreAltar:getBattlePyreAltarBeginnerBless": handleGetBattlePyreAltarBeginnerBless,
  "battlePyreAltar:leaderboard": queryBattlePyreAltarLeaderboard,
  "battlePyreAltar:leaderboard:total": queryBattlePyreAltarTotalLeaderboard,

  "catVillageMonument:consecrate": consecrateCatVillageMonument,
  "catVillageMonument:leaderboard": queryCatVillageMonumentLeaderboard,
  "catVillageMonument:leaderboard:total": queryCatVillageMonumentTotalLeaderboard,

  "referrer:info": getReferrerInfo,
  "referrer:claimedStage1Reward": handleClaimedStage1Reward,
  "referrer:claimedStage2Reward": handleClaimedStage2Reward,
  "referrer:myInviter": getMyInviter,
  "referrer:confirmReferredRelationship": confirmReferredRelationship,
  'referrer:getConfirmReferredRelationshipInfo': getConfirmReferredRelationshipInfo,
  'referrer:deleteReferredRelationship': deleteReferredRelationship,
  'referrer:setInviteRewardSetting': handleSetInviteRewardSetting,
  'referrer:getInviteRewardSetting': handleGetInviteRewardSetting,

  "account:createSubAccount": handleCreateSubaccount,
  "account:getList": handleGetAccountList,

  // 注册拍卖相关接口（客户端调用这些事件）
  // - 查询列表 / 详情
  "auction:list": getAuctionList,
  "auction:detail": getAuctionDetail,
  "auction:upcoming": getUpcomingAuctions,
  // - 创建拍卖（权限需上层校验）
  "auction:create": handleCreateAuction,
  // - 缴纳保证金、出价
  // 'auction:deposit': handleDepositForAuction,
  "auction:bid": handlePlaceBid,
  // - 出价历史、结算与取消（管理员或业务触发）
  "auction:history": getBidHistory,
  "auction:settle": handleSettleAuction,
  "auction:cancel": handleCancelAuction,

  "alchemy:atlas": handleGetUserAlchemyAtlas,
  // "alchemy:start": handleUserStartAlchemyAction,
  "alchemy:auto:create": handleUserRequestAutoAlchemy,
  "alchemy:auto:current": handleGetUserCurrentAutoAlchemy,
  "alchemy:auto:history": handleGetUserAutoAlchemyHistory,
  "alchemy:auto:cancel": handleCancelAutoAlchemy,

  // Character phantom market handlers
  // 'characterPhantom:list': characterPhantomIO.listCharacterPhantom,
  // 'characterPhantom:get': characterPhantomIO.getCharacterPhantom,
  // 'characterPhantom:getList': characterPhantomIO.handleGetCharacterPhantomList,
  // 'characterPhantom:createListing': characterPhantomIO.createCharacterPhantomListingHandler,
  // 'characterPhantom:createBorrow': characterPhantomIO.createCharacterPhantomBorrowHandler,
  // 'characterPhantom:returnBorrow': characterPhantomIO.returnCharacterPhantomBorrowHandler,
  // 'characterPhantom:cancelListing': characterPhantomIO.cancelCharacterPhantomListingHandler,
  // 'characterPhantom:getBorrow': characterPhantomIO.getSelfBorrowedPhantom,
  // 'characterPhantom:getBorrowedPhantomList': characterPhantomIO.handleGetBorrowedPhantomList,
  'knowledgeCrownSkill:get': handleGetKnowledgeCrownSkill,
  'knowledgeCrownSkill:update': handleUpdateKnowledgeCrownSkill,

  'chefSkill:get': handleGetChefSkill,
  'chefSkill:update': handleUpdateChefSkill,

  'dominationSealSkill:get': handleGetDominationSealSkill,
  'dominationSealSkill:update': handleUpdateDominationSealSkill,

  'intertwinedCatEyeGenesisEssenceStaffSkill:get': handleGetIntertwinedCatEyeGenesisEssenceStaffSkill,
  'intertwinedCatEyeGenesisEssenceStaffSkill:update': handleUpdateIntertwinedCatEyeGenesisEssenceStaffSkill,
  'blinkshadowGirdleSkill:get': handleGetBlinkshadowGirdleSkill,
  'blinkshadowGirdleSkill:update': handleUpdateBlinkshadowGirdleSkill,


  // Skill Tree（技能树）相关接口
  'skillTree:summary': handleSkillTreeSummary,
  'skillTree:allocate': handleSkillTreeAllocate,
  // 'skillTree:deallocate': handleSkillTreeDeallocate,
  'skillTree:reset': handleSkillTreeReset,
  'skillTree:learned': handleSkillTreeLearned,
  // Farming (种植) 相关接口
  "farm:plots": handleGetFarmPlots, // 获取田地列表（可选 area）
  "farm:plot:unlock": handleUnlockFarmPlot, // 解锁田地
  "farm:plot:plant": handlePlantFarmPlot, // 播种
  "farm:plot:harvest": handleHarvestFarmPlot, // 收获
  "farm:plot:autoReplant": handleToggleAutoReplant, // 设置自动播种
  "farm:plot:shovel": handleShovelFarmPlot, // 清理作物（清空当前作物）
  // "farm:plot:create": handleCreateFarmPlot, // 新建田地

  // Harvest Box (收获箱)
  "harvestBox:list": handleHarvestBoxList,
  "harvestBox:claim": handleHarvestBoxClaim,
  "harvestBox:claimItem": handleHarvestBoxClaimItem,
  "harvestBox:claimAll": handleHarvestBoxClaimAll,

  // Character Affix (随机词条) 相关接口
  "characterAffix:list": characterAffixList,
  "characterAffix:roll": characterAffixRoll,
  "characterAffix:updateState": characterAffixUpdateState,
  "characterAffix:remove": characterAffixRemove,
  "characterAffix:removeMany": characterAffixRemoveMany,
  "characterAffix:getLimits": characterAffixGetLimits,
  "characterAffix:reroll": characterAffixReroll,
  "characterAffix:rerollUp": characterAffixRerollUp,
  "characterAffix:upgradeRarity": characterAffixUpgradeRarity,
  "characterAffix:expandOwned": characterAffixExpandOwned,
  "characterAffix:expandActive": characterAffixExpandActive,
} as const;

export default allEvent;

import { io } from "../plugins/socket.io"

import pako from 'pako'
import { deflate as zlibDeflate } from 'zlib';
import { promisify } from 'util';
const deflateAsync = promisify(zlibDeflate);
import { emitter } from "../utils";
import cheaterList from "./cheaterList";
import gmBanUser from "./gm/gm:banUser";
import { handleGetUserAlchemyAtlas, handleGetUserCurrentAutoAlchemy, handleGetUserAutoAlchemyHistory, handleUserRequestAutoAlchemy, handleUserStartAlchemyAction, handleCancelAutoAlchemy } from "./alchemy";
import { handleGetGMRestockMarketInfo, handleGMRestockMarket } from "./gm/gm:market";
import { handleGetKnowledgeCrownSkill, handleUpdateKnowledgeCrownSkill } from "./skill/knowledgeCrownSkill";
import { handleGetChefSkill, handleUpdateChefSkill } from "./skill/chefSkill";
import { handleSkillTreeSummary, handleSkillTreeAllocate, handleSkillTreeReset, handleSkillTreeLearned } from './skillTree';
import { handleGetDominationSealSkill, handleUpdateDominationSealSkill } from "./skill/dominationSealSkill";
import { consecrateBattlePyreAltar, handleGetBattlePyreAltarBeginnerBless, queryBattlePyreAltarLeaderboard, queryBattlePyreAltarTotalLeaderboard } from "./village/effect/battlePyreAltar";
import { consecrateCatVillageMonument, queryCatVillageMonumentLeaderboard, queryCatVillageMonumentTotalLeaderboard } from "./village/effect/catVillageMonument";
import characterAffixList from "./characterAffix/characterAffix:list";
import characterAffixRoll from "./characterAffix/characterAffix:roll";
import characterAffixUpdateState from "./characterAffix/characterAffix:updateState";
import characterAffixRemove from "./characterAffix/characterAffix:remove";
import characterAffixRemoveMany from "./characterAffix/characterAffix:removeMany";
import characterAffixGetLimits from "./characterAffix/characterAffix:getLimits";
import characterAffixReroll from "./characterAffix/characterAffix:reroll";
import characterAffixRerollUp from "./characterAffix/characterAffix:rerollUp";
import characterAffixUpgradeRarity from "./characterAffix/characterAffix:upgradeRarity";
import characterAffixExpandOwned from "./characterAffix/characterAffix:expandOwned";
import characterAffixExpandActive from "./characterAffix/characterAffix:expandActive";
import { handleGetIntertwinedCatEyeGenesisEssenceStaffSkill, handleUpdateIntertwinedCatEyeGenesisEssenceStaffSkill } from "./skill/intertwinedCatEyeGenesisEssenceStaffSkill";
import { handleGetBlinkshadowGirdleSkill, handleUpdateBlinkshadowGirdleSkill } from "./skill/blinkshadowGirdleSkill";
import battleRoomReturnOffering from "./room/battleRoom:returnOffering";
import worldBossListAvailable from "./worldBoss/worldBoss:listAvailable";
import worldBossLeaderboard from "./worldBoss/worldBoss:leaderboard";
import worldBossLeaderboardGroups from "./worldBoss/worldBoss:leaderboardGroups";
import worldBossGet from "./worldBoss/worldBoss:get";
import worldBossClaimReward from "./worldBoss/worldBoss:claimReward";

type EmitMsgCompressOption = {
  level: 0 | 6 | 1 | 2 | 3 | -1 | 4 | 5 | 7 | 8 | 9 | undefined,
  memLevel: number,
  windowBits: number,
}

type EmitMsgOption = {
  compressOption?: EmitMsgCompressOption
  except?: string[]
}

const DEFAULT_COMPRESS_OPTION = {
  level: 6,
  memLevel: 6,
  windowBits: 12,
} as const

// Compression cache + small-message passthrough to avoid excessive CPU use
const COMPRESSION_CACHE_TTL = 3_000; // ms
const COMPRESSION_CACHE_MAX = 2000;
const SMALL_MESSAGE_NO_COMPRESSION_THRESHOLD = 128; // characters
const compressionCache = new Map<string, { buf: Buffer | Uint8Array; ts: number }>();

function getCachedCompressed(key: string) {
  const e = compressionCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > COMPRESSION_CACHE_TTL) {
    compressionCache.delete(key);
    return null;
  }
  return e.buf;
}

function setCachedCompressed(key: string, buf: Buffer | Uint8Array) {
  compressionCache.set(key, { buf, ts: Date.now() });
  if (compressionCache.size > COMPRESSION_CACHE_MAX) {
    const k = compressionCache.keys().next().value;
    if (k) compressionCache.delete(k);
  }
}

async function compressStringWithCacheServer(ev: string, s: string, opt?: EmitMsgCompressOption) {
  if (s.length <= SMALL_MESSAGE_NO_COMPRESSION_THRESHOLD) {
    return { payload: s, compressed: false, rawLen: s.length } as const;
  }
  const key = ev + '|' + s;
  const cached = getCachedCompressed(key);
  if (cached) return { payload: cached, compressed: true, rawLen: s.length } as const;
  const zOptions: any = { level: opt?.level ?? DEFAULT_COMPRESS_OPTION.level, windowBits: opt?.windowBits ?? DEFAULT_COMPRESS_OPTION.windowBits };
  const buf = await deflateAsync(Buffer.from(s), zOptions);
  setCachedCompressed(key, buf);
  return { payload: buf, compressed: true, rawLen: s.length } as const;
}

export function emitEventToUser<T>(userUuid: string, ev: string, data?: T, opt?: EmitMsgOption): void;
export function emitEventToUser<T>(userInfo: GameSocketUserInfo, ev: string, data?: T, opt?: EmitMsgOption): void;

export function emitEventToUser<T>(userInfo: GameSocketUserInfo | string, ev: string, data?: T, opt?: EmitMsgOption): void {
    let userUuid = userInfo

    if (typeof userInfo != 'string') {
        userUuid = userInfo.uuid
    }

    const roomId = "room-" + userUuid

    if (io.sockets.adapter.rooms.has(roomId)) {
        // @ts-expect-error
        delete userInfo.firstResetPassword
        // @ts-expect-error
        delete userInfo.pwd
        // @ts-expect-error
        if (!userInfo.isGm) {
        // @ts-expect-error
            delete userInfo.isGm
        }

        let d = {
            user: userInfo,
            data: data ?? null,
        }
        let s = JSON.stringify(d);

        // async compress and emit (fire-and-forget to avoid blocking caller)
        (async () => {
          try {
            const comp = await compressStringWithCacheServer(ev, s, opt?.compressOption as any);
            emitter.to(roomId).emit(ev, comp.payload as any);
          } catch (err) {
            // fallback to previous behavior (synchronous pako) if async compression fails
            try {
              const res = pako.deflate(s, opt?.compressOption || DEFAULT_COMPRESS_OPTION);
              emitter.to(roomId).emit(ev, res as any);
            } catch (e) {
              // last resort: send raw string
              try { emitter.to(roomId).emit(ev, s); } catch (_) { /* ignore */ }
            }
          }
        })()
        // io.to(roomId).emit(ev, res)
    }
}

export function broadcastEvent<T>(ev: string, data?: T, opt?: EmitMsgOption): void {
        let s = JSON.stringify(data);

        (async () => {
          try {
            const comp = await compressStringWithCacheServer(ev, s, opt?.compressOption as any);
            emitter.emit(ev, comp.payload as any);
          } catch (err) {
            try {
              const res = pako.deflate(s, opt?.compressOption || DEFAULT_COMPRESS_OPTION);
              emitter.emit(ev, res as any);
            } catch (e) {
              try { emitter.emit(ev, s); } catch (_) { /* ignore */ }
            }
          }
        })()
    // io.emit(ev, res)
}

export function exceptBroadcastEvent<T>(ev: string, data?: T, opt?: EmitMsgOption): void {

  if (!opt?.except?.length) {
    return broadcastEvent(ev, data, opt)
  }

  let s = JSON.stringify(data)

  // NOTE: We fetch all currently online users from Redis set `online-users`.
  // Then we emit to each user except those in the exclusion list.
  // This avoids sending to everyone and then asking clients to ignore.
  // If the online user size grows large, consider a shard/room strategy.
  ;(async () => {
    try {
      const comp = await compressStringWithCacheServer(ev, s, opt?.compressOption as any);
      const exceptSet = new Set(opt?.except)
      const onlineUsers = await redisClient.sMembers("online-users")
      if (!onlineUsers?.length) return

      for (const uuid of onlineUsers) {
        if (exceptSet.has(uuid)) continue
        // Reuse existing single-user emit path for consistency (compression already done)
        // We directly emit compressed payload without re-compressing user wrapper.
        const roomId = "room-" + uuid
        if (io.sockets.adapter.rooms.has(roomId)) {
          emitter.to(roomId).emit(ev, comp.payload as any)
        }
      }
    } catch (err) {
      try {
        const res = pako.deflate(s, opt?.compressOption || DEFAULT_COMPRESS_OPTION)
        const exceptSet = new Set(opt?.except)
        const onlineUsers = await redisClient.sMembers("online-users")
        if (!onlineUsers?.length) return
        for (const uuid of onlineUsers) {
          if (exceptSet.has(uuid)) continue
          const roomId = "room-" + uuid
          if (io.sockets.adapter.rooms.has(roomId)) {
            emitter.to(roomId).emit(ev, res as any)
          }
        }
      } catch (e) {
        // Fallback: if anything goes wrong, degrade to normal broadcast (will include excluded users)
        try { emitter.emit(ev, s) } catch (_) { /* ignore */ }
      }
    }
  })()
}