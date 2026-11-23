<template>
</template>

<script setup lang="tsx">
import { GameCommonResourceIconAndName, GameCommonResourceUseInfo, GameCommonSimpleActionNameAndIcon, GameCommonSimpleResourceIconAndName } from '#components';
import { clearEffectActionListeners, onUseItemError, onUseItemSuccess } from '~/api/game/socket/effectAction';
import { emitRequestInventory, onDispatchInventoryInfo, onInventoryModify, onInventoryResourceDecrease, onInventoryResourceIncrease, onInventoryUpdated } from '~/api/game/socket/inventory';
import { onShopBuyFail, onShopBuySuccess, onShopSellSuccess } from '~/api/game/socket/trade';
import { useInventory } from '~/composables/game/useInventory';
import type { CharacterInventory } from '~/generated/prisma';
import { allGameResource } from '~/shared/data/allGameResources';
import type { ItemCountInfo } from '~/shared/types/gameInventory';
import type { AllGameResourceID, AllGameResourceIDWithInternal } from '~/shared/types/gameResource';

import {
    emitGetTransactionList,
    onGetTransactionList,
    onGetTransactionListError,
    emitListToMarket,
    onListToMarketSuccess,
    onListToMarketError,
    emitBuyFromMarket,
    onBuyFromMarketSuccess,
    onBuyFromMarketError,
    emitRemoveFromMarket,
    onRemoveFromMarketSuccess,
    onRemoveFromMarketError,
} from "@/api/game/socket/market";

import {
  onListToBuyerMarketSuccess,
  onListToBuyerMarketError,
  onSellToBuyerMarketSuccess,
  onSellToBuyerMarketError,
  onRemoveFromBuyerMarketSuccess,
  onRemoveFromBuyerMarketError,
} from "@/api/game/socket/buyerMarket";

import type { MarketTradeInfo } from '~/shared/types/market';
import { useMarketTransactionInfo } from '~/composables/game/useMarketTransactionInfo';
import { emitGameCurrentPlayerCount, onGetCharacterInitDataSuccess, onGetGameCurrentPlayerCountSuccess, onRateLimitTriggered } from '~/api/game/socket/game';
import { registerSocketEventListener, waitUtilConnected } from '~/api/game/socket/socket';
import { useOnlinePlayerCount } from '~/composables/game/useOnlinePlayerCount';
import { onCompleteQuestSuccess, onQuestUpdated, onRerollQuestError, onRerollQuestSuccess } from '~/api/game/socket/quest';
import { getResourcerIconAndName } from '~/shared/utils/game/info';
import { onEquipItemError, onEquipItemSuccess, onUnequipItemError, onUnequipItemSuccess } from '~/api/game/socket/equipment';
import { useActionDuration } from '~/composables/game/useActionDuration';
import { emitGetEquipment, emitUpdateActionDuration, emitUpdateActionResourceRequirement, onDispatchLatestActionDurationDetail, onDispatchLatestActionResourceRequirementDetail, onGetBattleEquipmentSuccess, onGetTitleSuccess, onGetWorkEquipmentSuccess } from '~/api/game/socket/character';
import { useCharacterEquipment, useCharacterWorkEquipment } from '~/composables/game/useCharacterEquipment';
import { emitRequestCharacterBuildingInfo, onDispatchCharacterBuildingInfo } from '~/api/game/socket/building';
import { useCharacterBuildingInfo } from '~/composables/game/useCharacterBuildingInfo';
import { useKittyInfo } from '~/composables/game/useKittyInfo';
import { emitGetAllKittyInfo, emitGetKittyAllTask, onAddKittyTaskFail, onAddKittyTaskSuccess, onCreateKittyError, onDispatchAllKittyInfo, onGetKittyAllTaskSuccess, onKittyTaskDone, onRemoveKittyTaskFail, onRemoveKittyTaskSuccess } from '~/api/game/socket/kitty';
import { useActionResourceReqiurement } from '~/composables/game/useActionResourceReqiurement';
import { useKittyTaskQueue } from '~/composables/game/useKittyTaskQueue';
import { clone, delay, ObjectKeysTyped } from '~/shared/utils';
import { useGameQuest } from '~/composables/game/useGameQuest';
import { useCurrentBattleRoom } from '~/composables/game/useCurrentBattleRoom';
import { emitGetCurrentBattleRoom, onBattleRoomStartBattleError, onBattleRoomStartBattleSuccess, onBattleRoomUpdate, onGetCurrentBattleRoomError, onGetCurrentBattleRoomSuccess, onJoinBattleRoomError, onJoinBattleRoomSuccess, onLeaveBattleRoomSuccess } from '~/api/game/socket/battleRoom';
import { useBattleInfo } from '~/composables/game/useBattleInfo';
import { emitGetBattleInfo, onBattleEndSuccess, onBattleInfoDetail, onBattleInfoUpdateError, onBattleInfoUpdateSuccess, onBattleLeaveSuccess, onDispatchBattleFullInfoSuccess, onDispatchThisRoundActionSuccess, onGiveBattleExpReward, onGiveBattleResourceReward, onStopBattleSuccess } from '~/api/game/socket/battle';
import { emitGetCharacterBattleSkills, onGetCharacterBattleSkillsSuccess, onUpdateSkillCastLogicSuccess } from '~/api/game/socket/skills';
import { useCharacterBattleSkills } from '~/composables/game/useCharacterBattleSkills';
import { onGmGrantStyleApply, onGmNoticeReceive } from '~/api/game/socket/gm';
import { emitRequestCharacterStatusInfo, onDispatchCharacterStatusInfo } from '~/api/game/socket/characterStatusInfo';
import { useCharacterStatusInfo } from '~/composables/game/useCharacterStatusInfo';
import { useTavern } from '~/composables/game/useTavern';
import { emitTavernGetMyExperts, onTavernGetMyExpertsSuccess } from '~/api/game/socket/tavern';
import { emitJoinRoom, onAddTaskFailed, onJoinRoomSuccess, onTaskImmediatelyStartFailed, onTaskImmediatelyStartSuccess } from '~/api/game/socket/taskQueue';
import { allTitles } from '~/shared/data/allTitle';

import {
  onSendFriendRequestSuccess,
  onSendFriendRequestFail,
  onFriendRequestReceived,
  onFriendRequestAccepted,
  onFriendRequestRejected,
  onFriendRemoved,
  onGetFriendRequests,
  emitGetFriendRequests,
} from '~/api/game/socket/friend';
import { useKittyFurniture } from '~/composables/game/useKittyFurniture';
import { emitGetUserFurniture, onGetUserFurniture, onRepairFurnitureFail, onRepairFurnitureSuccess } from '~/api/game/socket/kittyFurniture';
import { emitCheckBanned, onBanned } from '~/api/game/socket/user';
import { useGameInited } from '~/composables/game/useGameInited';
import { emitGetMyGuild, onGetMyGuildSuccess, onJoinRequestResult, onKicked } from '~/api/game/socket/guild';
import { useMyGuild } from '~/composables/game/useMyGuild';
import { emitGetSponsorPoint, onGetSponsorPointSuccess } from '~/api/game/socket/sponsorPoint';
import { useSponsorPoint } from '~/composables/game/useSponsorPoint';
import { emitGetAllUniqueFlag, onGetAllUniqueFlagSuccess } from '~/api/game/socket/uniqueFlag';
import { useUniqueFlag } from '~/composables/game/useUniqueFlag';
import { emitGetUserCustomStyle, onGetUserCustomStyleFail, onGetUserCustomStyleSuccess, onSetStyleSuccess } from '~/api/game/socket/style';
import { useUserStyle } from '~/composables/game/useUserStyle';
import { useMyKittyExpeditionInfo } from '~/composables/game/useMyKittyExpeditionInfo';
import { emitGetMyExpeditionTeams, onGetMyExpeditionTeamsFail, onGetMyExpeditionTeamsSuccess } from '~/api/game/socket/kittyExpedition';
import { useNormalVillageBaseBuildingInfo } from '~/composables/game/useNormalVillageBaseBuildingInfo';
import { emitGetNormalStateBaseVillageBuildings, onGetNormalStateBaseVillageBuildingsFail, onGetNormalStateBaseVillageBuildingsSuccess } from '~/api/game/socket/village/building';
import { useUserStyleStore } from '~/composables/game/useUserStyleStore';
import { useIronCat } from '~/composables/game/useIronCat';
import { defaultAllGameActionDurationDetail, defaultAllGameActionResourceRequirementDetail } from '~/shared/data/allGameActions';
import { useFriendRequest } from '~/composables/game/useFriendRequest';
import { useLastOnlineDate } from '~/composables/game/useLastOnlineDate';
import { onSensitiveCheckError } from '~/api/game/socket/global';
import { useSkillTree } from '~/composables/game/useSkillTree';
import { useLearnedSkillNodes } from '~/composables/game/useLearnedSkillNodes';
import { registerKittyTraitsListeners, useKittyTraits } from '~/composables/game/useKittyTraits'
import { useMarketPrices } from '~/composables/game/useMarketPrices'
import { useIsBeginner } from '~/composables/game/useIsBeginner';
import { allAvatarBorder, allBattleStyle, allChatBubbleStyle, allProfileStyle } from '~/shared/data/allStyle'

let {user, clear} = useUserSession()

const isBeginner = useIsBeginner();

const inventory = useInventory()
const tavern = useTavern()

const quests = useGameQuest()
// 本地移动端检测，避免依赖 Nuxt useDevice 导致在非 Nuxt 上下文报错
const device = useDevice()

const currentBattleRoom = useCurrentBattleRoom()
const battleInfo = useBattleInfo()

const allGameActionDurationDetail = useActionDuration()
const allGameActionResourceRequirementDetail = useActionResourceReqiurement()

const characterEquipment = useCharacterEquipment()
const characterWorkEquipment = useCharacterWorkEquipment()
const characterBattleSkills = useCharacterBattleSkills()
const buildingInfo = useCharacterBuildingInfo()

const kittyInfo = useKittyInfo()
const allKittyTaskQueues = useKittyTaskQueue()

const characterStatus = useCharacterStatusInfo()

const kittyFurniture = useKittyFurniture()

const myGuild = useMyGuild()

const sponsorPoint = useSponsorPoint();
const uniqueFlag = useUniqueFlag()
const userStyle = useUserStyle()
const userStyleStore = useUserStyleStore();
const kittyTraits = useKittyTraits()

const myKittyExpedition = useMyKittyExpeditionInfo();

const normalVillageBaseBuildingInfo = useNormalVillageBaseBuildingInfo()

const friendRequest = useFriendRequest();

const learnedSkillNode = useLearnedSkillNodes()

let disposeKittyTraits: (() => void) | undefined

function clearBattleState() {
    battleInfo.value = undefined;
}

function clearAllBattleRelatedState() {
    battleInfo.value = undefined;
    currentBattleRoom.value = null;
}

const hasJoinRoom = ref(false)
const gameInited = useGameInited()

const ironCat = useIronCat()

const lastOnlineDate = useLastOnlineDate()
const marketPrices = useMarketPrices()

const { clear: clearSession, fetch: refreshSession } = useUserSession()

const styleNameMap = {
    battle: allBattleStyle,
    profile: allProfileStyle,
    chatBubble: allChatBubbleStyle,
    avatarBorder: allAvatarBorder,
} as const

const styleTypeLabelMap = {
    battle: '战斗面板',
    profile: '个人卡片',
    chatBubble: '聊天气泡',
    avatarBorder: '头像框',
} as const

onMounted(async () => {
    await waitUtilConnected()

        // register global kitty trait listeners once
    try {
        disposeKittyTraits = registerKittyTraitsListeners()
    } catch (e) {
        // ignore if already registered or if any error
        // registerKittyTraitsListeners has its own guard, so this is defensive
        console.error('registerKittyTraitsListeners error', e)
    }

    onRateLimitTriggered(async () => {
      await clearSession()
      await refreshSession()

      location.reload()
    })

    onSensitiveCheckError((err => {
        ElNotification.error({
            title: "操作失败",
            message: err.message
        });
    }))

    // Force logout on security events (e.g., password reset)
    const onForceLogout = registerSocketEventListener<{ reason?: string }>("security:forceLogout")
    onForceLogout(async ({ reason }) => {
        try {
            await clearSession()
            await refreshSession()
        } finally {
            ElMessage.warning('即将退出登陆')
            location.href = '/login'
        }
    })

    onGetCharacterInitDataSuccess(({data}) => {
        inventory.value = data.inventory
        tavern.value = data.tavern
        quests.value = data.quest

        kittyInfo.value = data.kittyInfo

        currentBattleRoom.value = data.currentBattleRoom
        battleInfo.value = data.battleInfo


        allGameActionDurationDetail.value = data.allGameActionDurationDetail
        for(const detail of ObjectKeysTyped(defaultAllGameActionDurationDetail)) {
            if (!allGameActionDurationDetail.value[detail]) {
                allGameActionDurationDetail.value[detail] = defaultAllGameActionDurationDetail[detail];
            }
        }

        allGameActionResourceRequirementDetail.value = data.allGameActionResourceRequirementDetail
        for(const detail of ObjectKeysTyped(defaultAllGameActionResourceRequirementDetail)) {
            if (!allGameActionResourceRequirementDetail.value[detail]) {
                allGameActionResourceRequirementDetail.value[detail] = defaultAllGameActionResourceRequirementDetail[detail];
            }
        }

        characterWorkEquipment.value = data.workEquipment
        characterEquipment.value = data.battleEquipment

        characterBattleSkills.value = data.skills
        buildingInfo.value = data.building
        kittyFurniture.value = data.kittyFurniture

        characterStatus.value = data.status

        myGuild.value = data.guild

        userStyle.value = data.userStyle

        normalVillageBaseBuildingInfo.value = data.villageBuildingInfo

        uniqueFlag.value = data.uniqueFlag
        sponsorPoint.value = data.sponsorPoint

        myKittyExpedition.value = data.kittyExpedition

        lastOnlineDate.value = data.lastOnlineDate

        learnedSkillNode.allLearned.value = data.skillNodes

        isBeginner.value = !!data.isBeginner;
    })

    emitJoinRoom()
    onJoinRoomSuccess(() => {
        hasJoinRoom.value = true
    })

    // 等待hasJoinRoom == true
    await new Promise((resolve) => {
        const timer = setInterval(() => {
            if (hasJoinRoom.value) {
                clearInterval(timer)
                resolve(true)
            }
        }, 100)
    })
    await delay(100);
    gameInited.value = true;

    // init market prices fetching and 30-min refresh
    try {
        marketPrices.init()
    } catch (e) {
        console.error('init market prices error', e)
    }

    onDispatchCharacterStatusInfo(characterStatusInfo => {
        characterStatus.value = characterStatusInfo
    })

    onGmNoticeReceive(({ title, content, type, duration }) => {
        // 这里可以用 Element Plus 的 ElNotification 或自定义弹窗
        let t = type as "error" | "success" | "info" | "warning"
        ElNotification({
            title,
            message: content,
            type: t || 'info',
            duration: duration || 5000,
        })
    })


    onDispatchInventoryInfo(pInventory => {
        inventory.value = pInventory
    })
    onInventoryUpdated((pInventory) => {
        inventory.value = pInventory
    });

    onInventoryResourceIncrease(info => {
        if (device.isMobile) {
            return
        }

         const gain = (Object.keys(info) as AllGameResourceID[]).filter(resourceId => {
            const count = info[resourceId]!.count

            return count > 0
        }).map(resourceId => {
            const count = info[resourceId]!.count
            return (
                <div class="flex flex-row items-center">
                    <GameCommonSimpleResourceIconAndName
                        resourceId={resourceId}
                    ><span class="ml-1 mr-2">x{Math.abs(count)}</span></GameCommonSimpleResourceIconAndName>
                </div>
            )
        })

        ElNotification({
            title: '获得物品',
            type: 'success',
            message: h("div", {
                class: "inline-flex flex-col gap-2"
            }, [
                h("div", { class: "flex flex-row flex-wrap gap-1" }, [
                    h("div", {
                        class: "inline-block whitespace-nowrap"
                    }, "获得:"),
                    ...gain
                ]),
            ]),
            duration: 3600
        })
    })


    onUseItemSuccess((result) => {
        const resourceEffectResult = result?.result?.resourceEffectResult ?? {}
        let allResultResourceIdList = Object.keys(resourceEffectResult) as AllGameResourceIDWithInternal[]
        let hasResult = !!allResultResourceIdList.length

        ElNotification({
            title: '使用成功',
            type: 'success',
            message: () => (
                <>
                    <div>成功使用 {result.multiple} 个
                        <GameCommonSimpleResourceIconAndName resourceId={result.itemId}></GameCommonSimpleResourceIconAndName>
                     </div>

                    {
                        !hasResult && <></>
                    }

                    {
                        !!hasResult && <>
                            <el-divider class="my-2! mb-4!"></el-divider>
                            库存变化: 
                            <div class="flex flex-col items-start gap-2 mt-2">
                            {
                                allResultResourceIdList.map(resourceId => {
                                    const curCount = (unref(inventory)[resourceId]?.count ?? 0)
                                    const modify = resourceEffectResult[resourceId]?.modifyCount ?? 0
                                    return (
                                        <div>
                                        <GameCommonSimpleResourceIconAndName
                                            resourceId={resourceId}
                                        >
                                            {{
                                                default: () => `(+${modify})`
                                            }}
                                        </GameCommonSimpleResourceIconAndName>
                                        </div>
                                    )
                                })
                            }
                            </div>
                        </>
                    }

                </>
            ),
            duration: 6200
        })
    });

    onUseItemError((message) => {
        ElMessage.error(`使用失败: ${message.message}`);
    });

    const onTradeDone = (info: {
        tradeInfo: ItemCountInfo
        inventory: CharacterInventory
    }) => {
        emitRequestInventory()

        const gain = (Object.keys(info.tradeInfo) as AllGameResourceID[]).filter(resourceId => {
            const count = info.tradeInfo[resourceId]!.count

            return count > 0
        }).map(resourceId => {
            const count = info.tradeInfo[resourceId]!.count
            return (
                <>
                    <GameCommonSimpleResourceIconAndName
                        resourceId={resourceId}
                    ></GameCommonSimpleResourceIconAndName> * { count }
                </>
            )
        })
        const lost = (Object.keys(info.tradeInfo) as AllGameResourceID[]).filter(resourceId => {
            const count = info.tradeInfo[resourceId]!.count

            return count < 0
        }).map(resourceId => {
            const count = info.tradeInfo[resourceId]!.count
            return (
                <>
                    <GameCommonSimpleResourceIconAndName
                        resourceId={resourceId}
                    ></GameCommonSimpleResourceIconAndName> * { count }
                </>
            )
        })

        ElNotification({
            title: '商店交易完成',
            type: 'success',
            message: h("div", {
                class: "inline-flex flex-col gap-1"
            }, [
                h("div", { class: "flex flex-row flex-wrap gap-1" }, [
                    h("div", {
                        class: "inline-block whitespace-nowrap"
                    }, "获得:"),
                    ...gain
                    // h("div", {
                    //     class: "inline-flex flex-row flex-wrap gap-1"
                    // }, gain),
                ]),
                // h("div", { class: "flex flex-row flex-wrap gap-1" }, [
                    // h("div", {
                        // class: "inline-block whitespace-nowrap"
                    // }, "失去:"),
                    // ...lost
                    // // h("div", {
                    // //     class: "inline-flex flex-row flex-wrap gap-1"
                    // // }, lost),
                // ]),
            ]),
            duration: 3600
        })
    }

    onShopBuySuccess(onTradeDone)
    onShopSellSuccess(() => {
        ElNotification({
            title: '商店出售成功',
            type: 'success',
            duration: 1800
        })
    })
    onShopBuyFail(data => {
        ElNotification({
            title: '商店购买失败',
            type: 'error',
            message: data.message,
            duration: 3200
        })
    })

    onGetTransactionListError((err) => {
        ElMessage.error("获取市场列表失败：" + err.message);
    });
    onListToMarketSuccess((result: MarketTradeInfo) => {
        ElNotification({
            title: '上架成功',
            type: 'success',
            message: h("div", {
                class: "inline-flex flex-col gap-2"
            }, [
                h("div", { class: "flex flex-row flex-wrap gap-1" }, [
                    h("div", {
                        class: "inline-block whitespace-nowrap"
                    }, "商品:"),
                    <GameCommonSimpleResourceIconAndName
                        resourceId={result.sellResourceId}
                    ></GameCommonSimpleResourceIconAndName>,
                    h("div", {
                    }, " * " + result.sellResourceCount),
                ]),
                h("div", { class: "flex flex-row flex-wrap gap-1" }, [
                    h("div", {
                        class: "inline-block whitespace-nowrap"
                    }, "单价:"),
                    <GameCommonSimpleResourceIconAndName
                        resourceId={result.costResourceId}
                    ></GameCommonSimpleResourceIconAndName>,
                    h("div", {
                    }, " * " + result.costPerUnit),
                ]),
            ]),
            duration: 3600
        })
        emitRequestInventory()
    });
    onListToMarketError((err) => {
        ElMessage.error("上架失败：" + err.message);
    });
    onBuyFromMarketSuccess((result) => {
        ElNotification({
            title: '交易完成',
            type: 'success',
            message: h("div", {
                class: "inline-flex flex-col gap-2"
            }, [
                h("div", { class: "flex flex-row flex-wrap gap-1" }, [
                    h("div", {
                        class: "inline-block whitespace-nowrap"
                    }, "获得:"),
                    <GameCommonSimpleResourceIconAndName
                        resourceId={result.tradeInfo.sellResourceId}
                    ></GameCommonSimpleResourceIconAndName>,
                    h("div", {
                    }, " * " + result.buyCount),
                ]),
            ]),
            duration: 3600
        })
        emitRequestInventory()
    });
    onBuyFromMarketError((err) => {
        ElMessage.error("购买失败：" + err.message);
    });
    onRemoveFromMarketSuccess(() => {
        ElNotification({
            title: '撤销上架成功',
            type: 'success',
            duration: 1800
        })
        emitRequestInventory()
    })
    onRemoveFromMarketError(({message}) => {
        ElNotification({
            title: '撤销上架失败',
            message: message ?? '请稍后重试',
            type: 'error',
            duration: 1800
        })
    })
    //market end

    // onGetGameCurrentPlayerCountSuccess((res) => {
    //     onlinePlayerCount.value = res
    //     console.log(res)
    // })
    // emitGameCurrentPlayerCount()


    onCompleteQuestSuccess(quest => {
        const childs = quest.rewards.map(reward => {
            return <GameCommonSimpleResourceIconAndName
                resourceId={reward.resourceId}
            ></GameCommonSimpleResourceIconAndName>
        })
        ElNotification({
            title: '已领取奖励',
            type: 'success',
            message: h("div", {
                class: "inline-flex flex-col gap-2"
            }, [
                h("div", {
                    class: "inline-block whitespace-nowrap"
                }, "获得:"),
                h("div", { class: "inline-flex flex-row flex-wrap gap-1" }, childs),
            ]),
            duration: 1800
        })
    })

    onEquipItemSuccess((response) => {
        characterEquipment.value = response.equipment

        ElNotification({
            title: '装备成功',
            type: 'success',
            message: h("div", {
                class: "inline-flex flex-row gap-2"
            }, [
                <GameCommonSimpleResourceIconAndName
                    resourceId={response.info.resourceId}
                ></GameCommonSimpleResourceIconAndName>
            ]),
            duration: 3600
        })

        emitGetEquipment('work');
        emitGetEquipment('battle');
    })

    onEquipItemError((response) => {
        ElNotification({
            title: '装备失败',
            type: 'error',
            message: response.message
        })
    })

    onUnequipItemSuccess((response) => {
        characterEquipment.value = response

        ElNotification({
            title: '卸下装备成功',
            type: 'success',
        })

        emitGetEquipment('work');
        emitGetEquipment('battle');
    })

    onUnequipItemError((response) => {
        ElNotification({
            title: '卸下装备失败',
            type: 'error',
            message: response.message
        })
    })

    onDispatchLatestActionDurationDetail(detail => {
        allGameActionDurationDetail.value = detail
    })

    onDispatchLatestActionResourceRequirementDetail(detail => {
        allGameActionResourceRequirementDetail.value = detail
    })

    onGetWorkEquipmentSuccess(equipment => {
        characterWorkEquipment.value = equipment
    })
    onGetBattleEquipmentSuccess(equipment => {
        console.log(equipment)
        characterEquipment.value = equipment
    })

    onDispatchCharacterBuildingInfo(pBuildingInfo => {
        buildingInfo.value = pBuildingInfo
    })

    onDispatchAllKittyInfo(kitty => {
        kittyInfo.value = kitty
    })
    onCreateKittyError((err) => {
        ElMessage.error("招募失败：" + err.message)
    })

    onAddKittyTaskSuccess(info => {
        const kitty = kittyInfo.value.find(k => k.uuid === info.kittyUuid)
        if (kitty) {
            ElNotification({
                title: '已指派给小猫咪',
                type: 'success',
                message: `已指派给 ${kitty.name || ''} 执行`,
                duration: 3800
            })

            allKittyTaskQueues.value[info.kittyUuid] = info.taskQueue
        }
    })


    onAddKittyTaskFail(info => {
        ElNotification({
            title: '指派失败',
            type: 'error',
            message: `${info.message}`,
            duration: 3800
        })
    })

    onKittyTaskDone((info) => {
        const kitty = kittyInfo.value.find(k => k.uuid === info.kittyUuid)
        if (kitty) {
            ElNotification({
                title: '小猫咪任务完成',
                type: 'success',
                message: `小猫咪 ${kitty.name || ''} 完成了任务 ${info.task.name}`,
                duration: 3800
            })
        }
    })

    onGetKittyAllTaskSuccess(({ kittyUuid, taskQueue: queue }) => {
        allKittyTaskQueues.value[kittyUuid] = queue
    })


    onRemoveKittyTaskSuccess(({ kittyUuid, taskQueue }) => {
        allKittyTaskQueues.value[kittyUuid] = taskQueue
        ElNotification({
            title: '移除任务成功',
            type: 'success',
            message: `小猫咪的任务已移除`,
            duration: 3200
        })
    })

    onRemoveKittyTaskFail((info) => {
        ElNotification({
            title: '移除任务失败',
            type: 'error',
            message: info.message,
            duration: 3200
        })
    })


    onRerollQuestError((msg) => {
        ElNotification({
            title: "任务重随失败",
            message: msg.message,
            type: "error",
            duration: 3200
        })
    })

  onQuestUpdated(quest => {
    const idx = quests.value.findIndex(q => q.uuid === quest.uuid);
    if (idx !== -1) {
      quests.value[idx] = quest;
    }
  });



  onJoinBattleRoomSuccess((room) => {
    currentBattleRoom.value = room;
    ElMessage.success("加入房间成功！");
  });
  onJoinBattleRoomError((msg) => {
    ElMessage.error(msg.message || "加入房间失败");
  });

  onGetCurrentBattleRoomSuccess(room => {
    currentBattleRoom.value = room
  })
  onGetCurrentBattleRoomError(err => {
    ElNotification({
        title: '房间状态更新:' + err.message,
        type: 'info',
        duration: 1800
    })
    currentBattleRoom.value = null
  })
  onBattleRoomUpdate(room => {
    currentBattleRoom.value = room
  })

    onBattleRoomStartBattleSuccess((pBattleRoom) => {
        currentBattleRoom.value = pBattleRoom
    });

    onBattleRoomStartBattleError((msg) => {
        ElMessage.error(msg.message || "准备状态更新失败");
        // ElNotification({ title: "战斗开始失败",
        //     message: msg?.message || "未知错误",
        //     type: "error",
        //     duration: 3200
        // });
    });

    onBattleInfoUpdateSuccess((info) => {
        battleInfo.value = info;
    });
    onBattleInfoUpdateError((err) => {
        // ElNotification({
        //     title: '战斗状态更新:' + err.message,
        //     type: 'info',
        //     duration: 1800
        // })
        // battleInfo.value = undefined;
        emitGetCurrentBattleRoom()
    });
    onBattleEndSuccess(() => {
        battleInfo.value = undefined;
        emitGetCurrentBattleRoom()
    });

    onGetCharacterBattleSkillsSuccess(info => {
        characterBattleSkills.value = info
    })

    onUpdateSkillCastLogicSuccess(() => {
        ElNotification({
            title: '技能自动释放逻辑更新成功',
            type: 'success',
            duration: 1800
        })
    })

    onLeaveBattleRoomSuccess(() => {
        clearAllBattleRelatedState();
    })

    onDispatchBattleFullInfoSuccess(({battleInfo: pBattleInfo})=> {
        battleInfo.value = pBattleInfo
    })

    onBattleLeaveSuccess(() => {
        clearBattleState();

        setTimeout(() => {
            clearBattleState();
        }, 1000)
    });
    onStopBattleSuccess(() => {
        battleInfo.value = undefined;
        setTimeout(() => {
            battleInfo.value = undefined;
        }, 1000)
    });


  onListToBuyerMarketSuccess((result) => {
    ElNotification({
      title: "求购上架成功",
      type: "success",
      message: `已发起求购：${result.requireResourceCount} x ${allGameResource[result.requireResourceId]?.name || result.requireResourceId}`,
      duration: 3600,
    });
  });
  onListToBuyerMarketError((err) => {
    ElMessage.error("求购上架失败：" + err.message);
  });

  onSellToBuyerMarketSuccess((result) => {
    ElNotification({
      title: "卖出成功",
      type: "success",
      message: `已卖出 ${result.sellCount} x ${allGameResource[result.tradeInfo.requireResourceId]?.name || result.tradeInfo.requireResourceId}`,
      duration: 3600,
    });
  });
  onSellToBuyerMarketError((err) => {
    ElMessage.error("卖出失败：" + err.message);
  });

  onRemoveFromBuyerMarketSuccess(() => {
    ElNotification({
      title: "撤销求购成功",
      type: "success",
      duration: 1800,
    });
  });
  onRemoveFromBuyerMarketError((err) => {
    ElMessage.error("撤销求购失败：" + err.message);
  });

  onTavernGetMyExpertsSuccess((experts) => {
    tavern.value = experts || [];
  });

//   setInterval(() => {
//     if (battleInfo.value && !currentBattleRoom.value) {
//         emitGetCurrentBattleRoom();
//         emitGetBattleInfo();
//     }
//   }, 1000 * 30)

    onTaskImmediatelyStartFailed((e) => {
        ElNotification({
            title: "立即开始动作失败",
            type: "error",
            message: e.message,
            duration: 1800,
        });
    })
    onTaskImmediatelyStartSuccess((e) => {
        if (device.isMobile) {
            ElMessage({
                type: 'success',
                message: `立即开始成功`,
                duration: 3800
            })
        } else {
            ElNotification({
                title: "立即开始成功",
                type: "success",
                duration: 1800,
            });
        }
    })
    onAddTaskFailed((e) => {
        ElNotification({
            title: "添加任务失败:" + e.message,
            type: "error",
            duration: 1800,
        });
    })

    onGetTitleSuccess((info) => {
        ElNotification({
            title: "获得称号",
            type: 'success',
            message: allTitles[info.titleId]?.name,
            duration: 900000,
        });
    })

    // ===== 好友系统全局监听 =====
    onSendFriendRequestSuccess(({ toUserUuid }) => {
        ElNotification({
            title: "好友请求已发送",
            type: "success",
            message: `已发送好友请求`,
            duration: 3000,
        });
    });
    onSendFriendRequestFail(({ message }) => {
        ElNotification({
            title: "好友请求发送失败",
            type: "error",
            message,
            duration: 3000,
        });
    });

    onFriendRequestReceived(({ fromUserUuid }) => {
        // ElNotification({
        //     title: "收到好友请求",
        //     type: "info",
        //     message: `收到好友请求`,
        //     duration: 100000,
        // });
        emitGetFriendRequests();
    });

    onFriendRequestAccepted(({ fromUserUuid, toUserUuid }) => {
        ElNotification({
            title: "好友请求已被接受",
            type: "success",
            message: fromUserUuid
                ? `你的好友请求被接受`
                : `你已接受好友请求`,
            duration: 3000,
        });
    });

    onFriendRequestRejected(({ toUserUuid }) => {
        // ElNotification({
        //     title: "好友请求被拒绝",
        //     type: "warning",
        //     message: `你的好友请求被用户(${toUserUuid})拒绝`,
        //     duration: 3000,
        // });
    });

    onFriendRemoved(({ userUuid }) => {
        // ElNotification({
        //     title: "被好友删除",
        //     type: "warning",
        //     message: `你已被用户(${userUuid})从好友列表移除`,
        //     duration: 3000,
        // });
    });


    onGetUserFurniture((furniture) => {
        if (furniture.furniture) {
            kittyFurniture.value = furniture.furniture || []
        }
    });

    onRepairFurnitureSuccess(({ furnitureId }) => {
        ElNotification({
            title: "家具修理成功",
            type: "success",
            duration: 3000,
        });
        emitGetUserFurniture();
    });

    onRepairFurnitureFail(({ furnitureId, message }) => {
        ElNotification({
            title: "家具修理失败",
            type: "error",
            message: message || '修理失败',
            duration: 3000,
        });
    });

    setInterval(() => {
        emitCheckBanned()
    }, 60 * 1000)
    onBanned((obj) => {
        ElNotification({
            title: "账号被封禁",
            type: "error",
            message: obj.message,
            duration: 0, // 永久显示
            showClose: true,
        });

        setTimeout(async () => {
            await clear();
        }, 2000)
    })

    onGetMyGuildSuccess((guild) => {
        myGuild.value = guild.guild
    })
    onJoinRequestResult(result => {
        if (result.approve) {
            ElNotification({
                title: "入会申请已通过",
                type: "success",
                duration: 1800,
            })
            emitGetMyGuild()
        }
    })
    onKicked(() => {
        ElNotification({
            title: "你已被踢出公会",
            type: "error",
            duration: 1800,
        })
        emitGetMyGuild()
    })

    onGetSponsorPointSuccess((pSponsorPoint) => {
        console.log(pSponsorPoint)
        sponsorPoint.value = pSponsorPoint
    })

    onGetAllUniqueFlagSuccess((data) => {
        uniqueFlag.value = data.flags
    })

    onGetUserCustomStyleSuccess(data => {
        userStyle.value = data.style
        userStyleStore.value[data.uuid] = data.style
    })
    onSetStyleSuccess(data => {
        userStyle.value = data.style
    })


    onGetMyExpeditionTeamsSuccess(data => {
        myKittyExpedition.value = data.data
    })
    onGetMyExpeditionTeamsFail(data => {
        ElNotification({
            title: "获取探险队失败",
            type: "error",
            message: data.message,
            duration: 3000,
        });
    })

    onGetNormalStateBaseVillageBuildingsSuccess(({ list }) => {
        normalVillageBaseBuildingInfo.value = list
    });
    onGetNormalStateBaseVillageBuildingsFail(({ message }) => {
        ElNotification({
            title: "获取小镇建筑失败",
            type: "error",
            message,
            duration: 3000,
        });
    });

    onInventoryModify((data) => {
        if (!inventory.value) {
            inventory.value = {}
        }

        Object.keys(data).forEach(itemId => {
            if (!inventory.value[itemId]) {
                inventory.value[itemId] = {
                    count: 0,
                }
            }

            const modifyInfo = data[itemId]

            let modifyCount = modifyInfo?.count

            if (!modifyCount) {
                return;
            }

            inventory.value[itemId].count += modifyCount
        })
    })

    onGetFriendRequests(({ requests: reqs }) => {
        friendRequest.value = reqs
    })

    onGmGrantStyleApply(({styleType, styleId}) => {
        const typeKey = styleType as keyof typeof styleNameMap
        const styleConfig = styleNameMap[typeKey]
        const styleDisplayName = (styleConfig?.[styleId as keyof typeof styleConfig]?.name) || styleId || '未知样式'
        const typeLabel = styleTypeLabelMap[typeKey] || styleType

        ElNotification({
            title: '样式已解锁',
            type: 'success',
            message: `获得${typeLabel}：${styleDisplayName}`,
            duration: 99900,
        })
    })

    // emitRequestInventory()
    // emitRequestCharacterStatusInfo()
    // emitGetSponsorPoint()
    // emitGetAllUniqueFlag()
    // emitGetUserCustomStyle()
    // await delay(80);

    // emitGetMyGuild()

    // emitUpdateActionDuration()
    // emitUpdateActionResourceRequirement()

    // await delay(80);
    // emitGetEquipment('work');
    // emitGetEquipment('battle');

    // await delay(80);
    // emitRequestCharacterBuildingInfo()
    // emitGetAllKittyInfo()

    // await delay(80);
    // emitGetCurrentBattleRoom()
    // emitGetBattleInfo()

    // await delay(80);
    // emitGetCharacterBattleSkills()
    // emitTavernGetMyExperts()

    // await delay(80);
    // emitGetUserFurniture()

    // await delay(80);
    // emitGetMyExpeditionTeams()

    // emitGetNormalStateBaseVillageBuildings()
    emitCheckBanned()

    for(const kitty of kittyInfo.value) {
        kittyTraits.fetch(kitty.uuid)
    }

    onGiveBattleExpReward(data => { })
    onGiveBattleResourceReward(data => { })
    onBattleInfoDetail(data => { })

    emitGetFriendRequests()

    ironCat.value = !!user.value?.isIronCat
});

// 清理监听器
onUnmounted(() => {
    clearEffectActionListeners();
        try {
            disposeKittyTraits?.()
        } catch (e) {
            // ignore
        }
});

// let heartbeatTimer: NodeJS.Timeout | null = null;
// function startBattleStateCheckHeartbeat() {
//     if (heartbeatTimer) clearInterval(heartbeatTimer);

//     heartbeatTimer = setInterval(async () => {
//         if (currentBattleRoom.value && user.value) {
//             // 每30秒检查一次状态是否一致
//             try {
//                 emitGetCurrentBattleRoom();
//             } catch (error) {
//                 console.error('Heartbeat check failed:', error);
//             }
//         }
//     }, 30000);
// }

// function stopBattleStateCheckHeartbeat() {
//     if (heartbeatTimer) {
//         clearInterval(heartbeatTimer);
//         heartbeatTimer = null;
//     }
// }

// onMounted(() => {
//     startBattleStateCheckHeartbeat();
// });

// onUnmounted(() => {
//     stopBattleStateCheckHeartbeat();
// });

</script>