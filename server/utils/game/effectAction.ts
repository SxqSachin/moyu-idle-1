import { GameEffectAction, UseItemResourceEffectResult, UseItemResult } from "~/shared/types/gameEffect"
import { decreaseItemCount, getInventoryInfo, increaseItemCount, } from "./characterInventory"
import { AllGameResourceID, AllGameResourceIDWithInternal } from "~/shared/types/gameResource"
import { allGameResource, allGameResourceWithInternal } from "~/shared/data/allGameResources"
import { ObjectKeys, randomNumberInFullColseRange } from "~/shared/utils"
import { increaseCharacterSkillExp } from "./characterSkill"
import { increaseCharacterStatusExp, increaseCharacterStatusLevel } from "./characterStatus"
import { AllCharacterStatusType, CharacterStatusImprove, CharacterStatusLevelImprove } from "~/shared/types/characterInfo"
import { allCharacterStatus } from "~/shared/data/allCharacterStatus"
import { ModifyItemCountType } from "~/shared/types/gameInventory"
import { addTitle } from "./player"
import { getAllUserUniqueFlags, setUserUniqueFlag } from "./uniqueFlag"
import { addBattleStyle, addChatBubbleStyle } from "./style"
import { allAvatarBorder, allBattleStyle, allChatBubbleStyle, allProfileStyle } from "~/shared/data/allStyle"
import { MAX_USE_ITEM_COUNT } from "~/shared/data/constant"
import { upsertPlayerState_Global_ActionEffect, upsertPlayerState_Global_Status } from "./character"
import { AllGameActionDurationDetail } from "~/shared/types/gameAction"
import { awardSkillTreePoints } from "./skillTree"

const onUseOveride: {[key: string]: GameEffectAction[]} = {
    "cuteIronBox": [
      {
        "name": "基础奖励",
        "resourceEffect": [
          {
            "resource": "cutePoint",
            "increase": 25,
            "percent": 1
          },
          {
            "resource": "cutePoint",
            "increase": 50,
            "percent": 0.30
          },
          {
            "resource": "cutePoint",
            "increase": 33,
            "percent": 0.25
          },
          {
            "resource": "cutePoint",
            "increase": 150,
            "percent": 0.03
          },
          {
            "resource": "sponsorPointPack",
            "increase": 1,
            "percent": 0.40
          },
          {
            "resource": "sponsorPointPack",
            "increase": 2,
            "percent": 0.23
          },
          {
            "resource": "sponsorPointPack",
            "increase": 3,
            "percent": 0.02
          },
          {
            "resource": "cuteOutfit",
            "increase": 1,
            "percent": 0.05
          },
          {
            "resource": "cuteHat",
            "increase": 1,
            "percent": 0.05
          },
          {
            "resource": "cuteDoll",
            "increase": 1,
            "percent": 0.05
          },
          {
            "resource": "cuteDress",
            "increase": 1,
            "percent": 0.05
          },
          {
            "resource": "cuteGun",
            "increase": 1,
            "percent": 0.05
          },
          {
            "resource": "cuteSword",
            "increase": 1,
            "percent": 0.05
          },
          {
            "resource": "cuteHammer",
            "increase": 1,
            "percent": 0.05
          },
          {
            "resource": "cuteIronShield",
            "increase": 1,
            "percent": 0.05
          },
          {
            "resource": "cuteIronBracelet",
            "increase": 1,
            "percent": 0.05
          },
          {
            "resource": "cuteIronShield",
            "increase": 1,
            "percent": 0.05
          },
          {
            "resource": "cuteLuckyCharm",
            "increase": 1,
            "percent": 0.04
          }
        ]
      }
    ],
}

export const useItem = async (
    userUuid: string,
    itemId: AllGameResourceID,
    multiple: number = 1
): Promise<UseItemResult> => {
    if (typeof multiple != 'undefined' && multiple <= 0) {
        throw new Error(`Item use count illegal`)
    }

    if (multiple > MAX_USE_ITEM_COUNT) {
        throw new Error(`Max use count is ${MAX_USE_ITEM_COUNT}`)
    }

    const item = allGameResourceWithInternal[itemId]
    const itemEffect = onUseOveride[itemId] ?? item.onUse
    if (!itemEffect?.length) {
        throw new Error(`Item ${itemId} has no effect definition`)
    }

    if (item.maxUseEachTime && multiple > item.maxUseEachTime) {
        throw new Error(`该物品每次最多使用 ${item.maxUseEachTime} 个`)
    }

    const inventory = await getInventoryInfoPreferCache(userUuid)
    const currentCount = inventory[itemId]?.count || 0

    if (currentCount < multiple) {
        throw new Error(`Not enough item ${itemId}`)
    }

    if (item.beforeUseUniqueFlagCheck) {
        const uniqueFlag = await getAllUserUniqueFlags(userUuid);

        for (const check of item.beforeUseUniqueFlagCheck) {
            const hasFlag = uniqueFlag.some(flag => flag.type === check.data.type && flag.key === check.data.key);

            if (check.condition == 'has') {
                if (!hasFlag) {
                    throw new Error(`使用失败(01)`);
                }
            }

            if (check.condition == 'not_has') {
                if (hasFlag) {
                    throw new Error(`使用失败(02)，你只能使用此道具1次`);
                }
            }
        }
    }

    if (item.removeAfterUse) {
        await decreaseItemCount(userUuid, {
            [itemId]: { count: multiple }
        }, {
            showModifyInfo: true,
            actionName: `使用物品 ${item.name}`,
            type: ModifyItemCountType.UseItem,
            sendModifyEvent: true,
        })
    }

    const resourceModify: UseItemResourceEffectResult = {}
    let skillExpModify: {[key: string]: number} = {}
    const statusExpModifyInfo: {
        [key in AllCharacterStatusType]?: CharacterStatusImprove[] 
    } = {}

    const statusLevelModifyInfo: {
        [key in AllCharacterStatusType]?: CharacterStatusLevelImprove[] 
    } = {}

    let skillExpModifyPromise: Promise<any>[] = []
    let statusExpModifyPromise: Promise<any>[] = []
    let resourceModifyPromise: Promise<any>[] = []
    let addTitlePromise: Promise<any>[] = []
    let uniqueFlagPromise: Promise<any>[] = []

    let hasStyleChange = false

    let actionDurationEffectResult: AllGameActionDurationDetail | null = null

    for (let i = 0; i < multiple; i++) {
        for (const effect of itemEffect) {
            for (const resourceEffect of (effect.resourceEffect ?? [])) {
                const { percent, increase, decrease, resource } = resourceEffect

                let cPercent = randomNumberInFullColseRange(0, 1)

                if (percent &&  cPercent > percent) {
                    continue
                }

                if (!resourceModify[resource]) {
                    resourceModify[resource] = {
                        modifyCount: 0
                    }
                }

                if (increase) {
                    resourceModify[resource].modifyCount += increase
                } else if (decrease) {
                    resourceModify[resource].modifyCount -= decrease
                }
            }

            for(const skillModify of (effect.learnBattleSkillEffect ?? [])) {
                const { skillId, expReward } = skillModify
                if (!skillExpModify[skillId]) {
                    skillExpModify[skillId] = 0
                }
                skillExpModify[skillId] += expReward
            }

            for (const statusExpModify of (effect.statusExpEffect ?? [])) {
                const { status, increase, } = statusExpModify

                if (increase) {
                    if (!statusExpModifyInfo[status]) {
                        statusExpModifyInfo[status] = []
                    }
                    statusExpModifyInfo[status].push({
                        status,
                        increaseExp: increase,
                        from: `使用物品 ${item.name}`
                    })
                }
            }

            for (const statusLevelModify of (effect.statusLevelEffect ?? [])) {
                const { status, increase, } = statusLevelModify

                if (increase) {
                    if (!statusLevelModifyInfo[status]) {
                        statusLevelModifyInfo[status] = []
                    }
                    statusLevelModifyInfo[status].push({
                        status,
                        increaseLevel: increase,
                        from: `使用物品 ${item.name}`
                    })
                }
            }

            for (const title of (effect.addTitle ?? [])) {
                addTitlePromise.push(addTitle(userUuid, title))
            }

            for (const addUniqueFlag of (effect.addUniqueFlag ?? [])) {
                uniqueFlagPromise.push(setUserUniqueFlag(userUuid, addUniqueFlag.type, addUniqueFlag.key, true))
            }

            for (const addBattleCustomStyle of (effect.addBattleCustomStyle ?? [])) {
                if (!allBattleStyle[addBattleCustomStyle]) {
                    throw new Error(`Unknown battle style ${addBattleCustomStyle} in item ${itemId} effect`)
                }
                await addBattleStyle(userUuid, addBattleCustomStyle)
                hasStyleChange = true
            }

            for (const profileStyle of (effect.addProfileStyle ?? [])) {
                if (!allProfileStyle[profileStyle]) {
                    throw new Error(`Unknown profile style ${profileStyle} in item ${itemId} effect`)
                }
                await addProfileStyle(userUuid, profileStyle)
                hasStyleChange = true
            }

            for (const chatBubbleStyle of (effect.addChatBubbleStyle ?? [])) {
                if (!allChatBubbleStyle[chatBubbleStyle]) {
                    throw new Error(`Unknown chat bubble style ${chatBubbleStyle} in item ${itemId} effect`)
                }
                await addChatBubbleStyle(userUuid, chatBubbleStyle)
                hasStyleChange = true
            }

            for (const avatarBorder of (effect.addAvatarBorder ?? [])) {
                if (!allAvatarBorder[avatarBorder]) {
                    throw new Error(`Unknown avatarBorder ${avatarBorder} in item ${itemId} effect`)
                }
                await addAvatarBorderStyle(userUuid, avatarBorder)
                hasStyleChange = true
            }
        }
    }

    for (const effect of itemEffect) {
      for (const addGlobalState of effect.addGlobalStatusState ?? []) {
        if (addGlobalState.durationMinutes <= 0) continue;

        await upsertPlayerState_Global_Status(userUuid, {
          stateId: addGlobalState.id,
          value: addGlobalState.value,
          durationMinutes: addGlobalState.durationMinutes * multiple,
        });
      }
      for(const globalActionDurationEffectState of effect.addGlobalActionEffectState ?? []) {
        actionDurationEffectResult = await upsertPlayerState_Global_ActionEffect(userUuid, {
          stateId: globalActionDurationEffectState.stateId,
          durationMinutes: globalActionDurationEffectState.durationMinutes * multiple,
        });
      }
      for(const globalBattleStateWhenBattleStart of effect.addGlobalBattleStateWhenBattleStart ?? []) {
        await addOrUpdatePlayerState_Battle_StateWhenStartEachBattle(userUuid, {
            stateId: globalBattleStateWhenBattleStart.stateId,
            duration: globalBattleStateWhenBattleStart.inBattleDurationRound,
            value: 100,
            durationMinutes: globalBattleStateWhenBattleStart.durationMinutes * multiple,
        })
      }
    }
    
    if (Object.keys(skillExpModify).length > 0) {
        for (const skillId of ObjectKeys<string>(skillExpModify)) {
            if (skillExpModify[skillId] > 0) {
                skillExpModifyPromise.push(increaseCharacterSkillExp(userUuid, skillId, skillExpModify[skillId]))
            }
        }
    }

    if (Object.keys(statusExpModifyInfo).length > 0) {
        for (const status of ObjectKeys<AllCharacterStatusType>(statusExpModifyInfo)) {
            if (statusExpModifyInfo[status]?.length) {
                statusExpModifyPromise.push(increaseCharacterStatusExp(userUuid, statusExpModifyInfo[status]))
            }
        }
    }

    if (Object.keys(statusLevelModifyInfo).length > 0) {
        for (const status of ObjectKeys<AllCharacterStatusType>(statusLevelModifyInfo)) {
            if (statusLevelModifyInfo[status]?.length) {
                statusExpModifyPromise.push(increaseCharacterStatusLevel(userUuid, statusLevelModifyInfo[status]))
            }
        }
    }

    let modifiedResourceIdList = Object.keys(resourceModify) as AllGameResourceIDWithInternal[]
    for(const modifiedResourceId of modifiedResourceIdList) {
        const modify = resourceModify[modifiedResourceId] ?? {
            modifyCount: 0
        }

        if (modify.modifyCount > 0) {
            resourceModifyPromise.push(increaseItemCount(userUuid, {
                [modifiedResourceId]: { count: modify.modifyCount }
            }, {
                showModifyInfo: true,
                actionName: `使用物品 ${item.name} 获得`,
                type: ModifyItemCountType.UseItem,
                sendModifyEvent: true,
            }))
        } else if (modify.modifyCount < 0) {
            resourceModifyPromise.push(decreaseItemCount(userUuid, {
                [modifiedResourceId]: { count: -modify.modifyCount }
            }, {
                showModifyInfo: true,
                actionName: `使用物品 ${item.name} 失去`,
                type: ModifyItemCountType.UseItem,
                sendModifyEvent: true,
            }))
        }
    }

    for (const effect of itemEffect) {
      let lifeModify = 0;
      let battleModify = 0;
      for (const addSkillTreePoint of effect.addSkillTreePoint ?? []) {
        if (addSkillTreePoint.increase <= 0) continue;

        if (
          addSkillTreePoint.treeId != "life" &&
          addSkillTreePoint.treeId != "battle"
        ) {
          continue;
        }

        if (addSkillTreePoint.treeId == "life") {
          lifeModify += addSkillTreePoint.increase * multiple;
        }
        if (addSkillTreePoint.treeId == "battle") {
          battleModify += addSkillTreePoint.increase * multiple;
        }
      }

      if (lifeModify) {
        await awardSkillTreePoints(userUuid, userUuid, 'life', lifeModify)
      }
      if (battleModify) {
        await awardSkillTreePoints(userUuid, userUuid, 'battle', battleModify)
      }
    }

    // 至少，资源变动promise是需要先执行的，否则会产生覆写问题
    await Promise.all(skillExpModifyPromise)
    await Promise.all(statusExpModifyPromise)
    await Promise.all(resourceModifyPromise)
    await Promise.all(addTitlePromise)
    await Promise.all(uniqueFlagPromise)

    return {
        resourceEffectResult: resourceModify,
        hasStyleChange,
        actionDurationEffectResult,
        hasUniqueFlagChange: uniqueFlagPromise.length > 0,
    }
}