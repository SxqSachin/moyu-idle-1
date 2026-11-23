import {
  type PlayerInfo,
  type PlayerProfileInfo,
  type AllCharacterStatusType,
  type CharacterEquipmentType,
  type PlayerState,
} from "~/shared/types/characterInfo";
import { getCharacterStatusInfo, updateCharacterStatusInfoIntoDB, } from "./characterStatus";
import { prisma } from "../prisma";
import type {
  AllGameActionDurationDetail,
  AllGameActionID,
  AllGameActionResourceRequirementDetail,
  GameActionDurationDetail,
  GameActionResourceRequirementDetail,
} from "~/shared/types/gameAction";
import { getUserEquipment } from "./equipment";
import {
  allGameActionMainType,
  defaultAllGameActionDurationDetail,
  defaultAllGameActionResourceRequirementDetail,
} from "~/shared/data/allGameActions";
import { allGameResource } from "~/shared/data/allGameResources";
import { clone, ObjectKeysTyped, safeJsonParse } from "~/shared/utils";
import { allCharacterBaseStatusType, allCharacterStatusType } from "~/shared/data/allCharacterStatus";

import {redisClient} from '../redis'
import { allTitles, type GameTitle } from "~/shared/data/allTitle";
import { getUserCustomStyle } from "./style";
import type { PrismaTx } from "~/shared/types/socket/db";
import { convertJsonStrToPlayerState } from "~/shared/utils/game/userState";
import { allGlobalActionEffectState } from "~/shared/data/allBattleState";
import { listAllLearnedSkillTreeNodes } from "./skillTree";
import { allSkillTreeNodes } from "~/shared/data/skillTrees";
import { affixDefinitionsById } from "~/shared/data/affix/definitions";
import { listCharacterAffixes } from "./affix"
import { GameBroadcastKind, type UserActionDurationUpdateMessage, type UserStatusUpdateMessage } from "~/shared/types/broadcast";
import { publishGameBroadcast } from "./broadcastHub"

export async function getPlayerTitle(userUuid: string): Promise<{
  active: keyof typeof allTitles,
  inactive: (keyof typeof allTitles)[]
}> {
  const user = await prisma.user.findFirst({
    where: { uuid: userUuid },
  });

  return {
    active: user?.current_title as keyof typeof allTitles,
    inactive: ((user?.available_title || '').split(',').filter(t => t && t !== user?.current_title) as (keyof typeof allTitles)[])
  }
}

// 获取玩家基础信息
export async function getPlayerProfileInfo(
  uesrUuid: string
): Promise<PlayerProfileInfo | null> {
  // 再查用户表
  const user = await prisma.user.findFirst({
    where: { uuid: uesrUuid },
  });
  if (!user) return null;

  let userStyle = await getUserCustomStyle(uesrUuid)

  let data: PlayerProfileInfo = {
    name: user.name,
    avatar: user.avatar,
    createDate: user.create_date,
    availableTitle: (user.available_title || '').split(',') as (keyof typeof allTitles)[],
    title: user.current_title as (keyof typeof allTitles),
    guild: user.guild || undefined,
    guildTitle: user.guildTitle || undefined,
    option: safeJsonParse(user.option) || {},

    effect: {
      profileCard: user.profileCardEffect || undefined
    },

    style: userStyle
  };

  if (user.userGameState) {
    let gameState = safeJsonParse<PlayerState>(user.userGameState, {});
    data.userState = gameState
  }

  return data;
}

// 获取完整玩家信息
export async function getCharacterInfoByUuid(
  characterUuid: string
): Promise<PlayerInfo | null> {
  const base = await getPlayerProfileInfo(characterUuid);
  if (!base) return null;

  const status = await getCharacterStatusInfo(characterUuid);

  return {
    base,
    status,
    skills: []
  };
}

/**
 * 修改用户密码（需校验旧密码）
 * @param userUuid 用户唯一标识
 * @param oldPassword 旧密码（建议已加密）
 * @param newPassword 新密码（建议已加密）
 * @returns 是否修改成功
 */
export async function updateUserPassword(
  userUuid: string,
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  // 校验旧密码
  const user = await prisma.user.findFirst({
    where: { uuid: userUuid, pwd: oldPassword },
  });
  if (!user) return false;

  // 修改密码
  const result = await prisma.user.updateMany({
    where: { uuid: userUuid },
    data: { pwd: newPassword, first_reset_password: true },
  });
  return result.count > 0;
}

/**
 * 修改用户头像与昵称（昵称需唯一）
 * @param userUuid 用户唯一标识
 * @param name 新昵称
 * @param avatar 新头像链接
 * @returns 是否修改成功，若昵称已存在则返回 false
 */
export async function updateUserProfile(
  userUuid: string,
  name: string,
  avatar: string
): Promise<boolean> {
  // 检查昵称是否已存在（排除自己）
  const exist = await prisma.user.findFirst({
    where: {
      name,
      NOT: { uuid: userUuid },
    },
  });
  if (exist) return false;

  const result = await prisma.user.updateMany({
    where: { uuid: userUuid },
    data: { name, avatar },
  });
  return result.count > 0;
}


const convertActionToActionList = (action: string): AllGameActionID[] => {
  let actionList: AllGameActionID[] = [];
  if (action == "allAction") {
    actionList = Object.values(allGameActionMainType).flatMap(
      (type) => type.actions
    );
  } else if (action == "allCollectingAction") {
    actionList = allGameActionMainType.collecting.actions;
  } else if (action == "allSewingAction") {
    actionList = allGameActionMainType.sewing.actions;
  } else if (action == "allExploreAction") {
    actionList = allGameActionMainType.explore.actions;
  } else if (action == "allFishingAction") {
    actionList = allGameActionMainType.fishing.actions;
  } else if (action == "allForgingAction") {
    actionList = allGameActionMainType.forging.actions;
  } else if (action == "allSpecialManufactureAction") {
    actionList = allGameActionMainType.specialManufacture.actions;
  } else if (action == "allMiningAction") {
    actionList = allGameActionMainType.mining.actions;
  } else if (action == "allLevel1Manufacture") {
    actionList = allGameActionMainType.level1Manufacture.actions;
  } else if (action == "allFarmingAnimalAction") {
    actionList = allGameActionMainType.farmingAnimal.actions;
  } else if (action == "allCookingAction") {
    actionList = allGameActionMainType.cooking.actions;
  } else if (action == "allMysteriousAction") {
    actionList = allGameActionMainType.mysterious.actions;
  } else if (action == "allExerciseAction") {
    actionList = allGameActionMainType.exercise.actions;
  } else {
    actionList = [action as AllGameActionID];
  }

  return actionList;
};

const ALL_ACTION_DURATION_KEY_PREFIX = "ALL_ACTION_DURATION_";
const SINGLE_ACTION_DURATION_KEY_PREFIX = "SINGLE_ACTION_DURATION_";
const getSingleActionDurationRedisKey = (
  charaterUuid: string,
  action: AllGameActionID
): string => {
  return SINGLE_ACTION_DURATION_KEY_PREFIX + "_" + action + "_" + charaterUuid;
};

export async function updateAllActionDuration(
  characterUuid: string,
  tx?: PrismaTx
): Promise<AllGameActionDurationDetail> {
  if (!tx) {
    tx = prisma;
  }

  const characterEquipment = await getUserEquipment(characterUuid, 'work', tx);

  const characterPlayerInfo = await tx?.user.findUnique({
    where: { uuid: characterUuid },
    select: { userGameState: true }
  })

  const characterSkillNode = await listAllLearnedSkillTreeNodes(characterUuid, tx);

  const playerState = convertJsonStrToPlayerState(characterPlayerInfo?.userGameState)

  const durationInfo = clone(defaultAllGameActionDurationDetail);

  const fromEquipmentModifyMap: Record<AllGameActionID, number> = {} as Record<AllGameActionID, number>
  const fromStateModifyMap: Record<AllGameActionID, number> = {} as Record<AllGameActionID, number>
  const fromSkillNodeModifyMap: Record<AllGameActionID, number> = {} as Record<AllGameActionID, number>

  if (Object.values(characterEquipment).length) {
    Object.values(characterEquipment).forEach((equipmentId) => {
      if (!equipmentId) {
        return;
      }

      const equipment = allGameResource[equipmentId];

      if (equipment.onEquip) {
        equipment.onEquip.forEach((equipEffect) => {
          if (!equipEffect.actionDurationEffect) return;
          equipEffect.actionDurationEffect.forEach((effect) => {
            let { action } = effect;

            let actionList = convertActionToActionList(action);

            for (const action of actionList) {
              let thisActionModify = 0;

              let actionDuration = durationInfo[action];

              if (!actionDuration) {
                continue;
              }

              durationInfo[action].fromEquipmentModify ??= 0;

              let baseDuration =
                defaultAllGameActionDurationDetail[action].base;

              if (effect.increase) {
                thisActionModify += +effect.increase;
              }
              if (effect.decrease) {
                thisActionModify += -effect.decrease;
              }
              if ("increasePercent" in effect && effect.increasePercent) {
                thisActionModify += baseDuration * effect.increasePercent;
              }
              if ("decreasePercent" in effect && effect.decreasePercent) {
                thisActionModify += -(baseDuration * effect.decreasePercent);
              }

              fromEquipmentModifyMap[action] = (fromEquipmentModifyMap[action] || 0) + thisActionModify;

            }
          });
        });
      }
    });
  }

  for(const actionEffect of playerState?.global?.actionEffect || []) {

    const state = allGlobalActionEffectState[actionEffect.stateId]

    if (!state || !state.onGlobalActionDurationEffectAttach) {
      continue;
    }

    const thisStateDurationEffect = state.onGlobalActionDurationEffectAttach({})
    for (const effect of thisStateDurationEffect) {
      const effectAction = effect.actionId;

      const actionList = convertActionToActionList(effectAction)

      for (const action of actionList) {
        let thisActionModify = 0;

        let actionDuration = durationInfo[action];

        if (!actionDuration) {
          continue;
        }

        durationInfo[action].fromOther ??= 0;

        const baseDuration = defaultAllGameActionDurationDetail[action].base;

        thisActionModify += baseDuration * ((effect.modifyPercent ?? 0) * -1);
        fromStateModifyMap[action] =
          (fromStateModifyMap[action] || 0) + thisActionModify;
      }
    }
  }

  for(const skillNode of characterSkillNode) {
    const node = allSkillTreeNodes.find(n => n.id === skillNode.nodeId)
    if (!node || !node.businessEffects) continue;

    const durationEffects = node.businessEffects.actionDurationEffect;

    if (typeof durationEffects != 'function') continue;

    for(const actionDurationEffect of durationEffects(skillNode.level)) {
      const actionList = convertActionToActionList(actionDurationEffect.actionId)

      for (const action of actionList) {
        let thisActionModify = 0;

        let actionDuration = durationInfo[action];

        if (!actionDuration) {
          continue;
        }

        durationInfo[action].fromOther ??= 0;

        const baseDuration = defaultAllGameActionDurationDetail[action].base;

        // 这里传递的是负数
        thisActionModify += baseDuration * (actionDurationEffect.modifyPercent ?? 0);
        fromSkillNodeModifyMap[action] =
          (fromSkillNodeModifyMap[action] || 0) + thisActionModify;
      }
    }
  }

  const allModifyActionList = Array.from(new Set([
    ...Object.keys(fromEquipmentModifyMap),
    ...Object.keys(fromStateModifyMap),
    ...Object.keys(fromSkillNodeModifyMap),
  ])) as AllGameActionID[]

  for (const action of allModifyActionList) {
    if (action.startsWith("dismantle_")) {
      continue;
    }

    const baseDuration = defaultAllGameActionDurationDetail[action].base;

    durationInfo[action].fromEquipmentModify =
      fromEquipmentModifyMap[action] || 0;

    durationInfo[action].fromOther = (fromStateModifyMap[action] || 0) + (fromSkillNodeModifyMap[action] || 0);

    durationInfo[action].final =
      baseDuration +
      durationInfo[action].fromEquipmentModify +
      durationInfo[action].fromOther;

    // final 不能小于3000ms，且不少于base的10%
    const minDuration = Math.floor(baseDuration * 0.10);
    durationInfo[action].final = Math.max(3000, minDuration, durationInfo[action].final);
  }

  Object.keys(durationInfo).forEach((action) => {
    if (action.startsWith("dismantle_")) {
      // @ts-ignore
      delete durationInfo[action];
    }
  })

  redisClient.set(
    ALL_ACTION_DURATION_KEY_PREFIX + characterUuid,
    JSON.stringify(durationInfo)
  );

  (Object.keys(durationInfo) as AllGameActionID[]).forEach((action) => {
    if (action.startsWith("dismantle_")) {
      return;
    }

    const actionKey = getSingleActionDurationRedisKey(characterUuid, action);
    if (
      durationInfo[action].final !=
      defaultAllGameActionDurationDetail[action].base
    ) {
      redisClient.set(
        actionKey,
        JSON.stringify(durationInfo[action]),
        {
          expiration: {
            type: "EX",
            value: 60 * 60 * 8, // 8小时过期
          },
        }
      );
    } else {
      redisClient.del(actionKey)
    }
  });

  await publishGameBroadcast<UserActionDurationUpdateMessage>({
    kind: GameBroadcastKind.USER_ACTION_DURATION_UPDATED,
    userUuid: characterUuid
  })

  return durationInfo;
}

export async function getAllActionDuration(
  characterUuid: string
): Promise<AllGameActionDurationDetail> {
  let durationInfo = await redisClient.get(
    ALL_ACTION_DURATION_KEY_PREFIX + characterUuid
  );

  if (!!durationInfo) {
    let res = JSON.parse(durationInfo);

    for (const action of Object.keys(res)) {
      if (action.startsWith("dismantle_")) {
        delete res[action];
      }
    }

    return res;
  }

  return defaultAllGameActionDurationDetail
}
// export async function getActionDuration(
//   characterUuid: string,
//   action: AllGameActionID
// ): Promise<GameActionDurationDetail> {
//   if (action.startsWith("dismantle_")) {
//     return defaultAllGameActionDurationDetail[action];
//   }

//   let durationInfo = await redisClient.get(
//     getSingleActionDurationRedisKey(characterUuid, action)
//   );

//   if (!!durationInfo) {
//     return JSON.parse(durationInfo);
//   }

//   let all = await getAllActionDuration(characterUuid)

//   if (all[action]) {
//     await redisClient.set(
//       getSingleActionDurationRedisKey(characterUuid, action),
//       JSON.stringify(all[action]),
//       { EX: 3600 }
//     );

//     return clone(all[action])
//   }

//   return defaultAllGameActionDurationDetail[action];
// }

export async function getActionDuration(
  characterUuid: string,
  action: AllGameActionID
): Promise<GameActionDurationDetail> {
  if (action.startsWith("dismantle_")) {
    return defaultAllGameActionDurationDetail[action];
  }

  let durationInfo = await redisClient.get(
    getSingleActionDurationRedisKey(characterUuid, action)
  );

  if (!!durationInfo) {
    return JSON.parse(durationInfo);
  }

  return (await updateAllActionDuration(characterUuid))[action];
}

const ALL_ACTION_RESOURCE_REQUIREMENT_KEY_PREFIX =
  "ALL_ACTION_RESOURCE_REQUIREMENT_";
const SINGLE_ACTION_RESOURCE_REQUIREMENT_KEY_PREFIX =
  "SINGLE_ACTION_RESOURCE_REQUIREMENT_";
const getSingleActionResourceRequirementRedisKey = (
  charaterUuid: string,
  action: AllGameActionID
): string => {
  return (
    SINGLE_ACTION_RESOURCE_REQUIREMENT_KEY_PREFIX +
    "_" +
    action +
    "_" +
    charaterUuid
  );
};

export async function getAllActionResourceRequirement(
  characterUuid: string
): Promise<AllGameActionResourceRequirementDetail> {
  let requirementInfo = await redisClient.get(
    ALL_ACTION_RESOURCE_REQUIREMENT_KEY_PREFIX + characterUuid
  );

  if (!!requirementInfo) {
    let res = JSON.parse(requirementInfo);
    for (const action of Object.keys(res)) {
      if (action.startsWith("dismantle_")) {
        delete res[action];
      }
    }
    return res;
  }

  return defaultAllGameActionResourceRequirementDetail;
}
export async function getActionResourceRequirement(
  characterUuid: string,
  action: AllGameActionID
): Promise<GameActionResourceRequirementDetail[]> {
  if (action.startsWith("dismantle_")) {
    return defaultAllGameActionResourceRequirementDetail[action] || [];
  }

  let requirementInfo = await redisClient.get(
    getSingleActionResourceRequirementRedisKey(characterUuid, action)
  );

  if (!!requirementInfo) {
    return JSON.parse(requirementInfo);
  }

  let all = await getAllActionResourceRequirement(characterUuid)

  if (all[action]) {
    await redisClient.set(
      getSingleActionResourceRequirementRedisKey(characterUuid, action),
      JSON.stringify(all[action]),
      { EX: 3600 }
    );

    return clone(all[action])
  }

  return defaultAllGameActionResourceRequirementDetail[action] || [];
}

/**
 * 查询用户的最后在线IP
 * @param userUuid 用户唯一标识
 * @returns 最后在线IP字符串，未找到则返回空字符串
 */
export async function getUserLastOnlineIpAndFp(userUuid: string): Promise<{
  ip: string,
  fp: string
}> {
  const user = await prisma.user.findUnique({
    where: { uuid: userUuid },
    select: { last_online_ip: true, last_online_fp: true }
  });
  return {
    ip: user?.last_online_ip || '',
    fp: user?.last_online_fp || ''
  }
}

export async function updateCharacterStatusInfo(characterUuid: string, tx?: PrismaTx) {
  if (!tx) {
    tx = prisma;
  }

  const characterStatus = await getCharacterStatusInfo(characterUuid, tx, true)
  const characterSkillNode = await listAllLearnedSkillTreeNodes(characterUuid, tx)

  const characterAffixes = await listCharacterAffixes(characterUuid, characterUuid, tx);

  const title = await getPlayerTitle(characterUuid);

  const fromEquipModifyMap: Record<AllCharacterStatusType, number> = {} as Record<AllCharacterStatusType, number>
  const fromWorkEquipModifyMap: Record<AllCharacterStatusType, number> = {} as Record<AllCharacterStatusType, number>
  const fromSkillNodeModifyMap: Record<AllCharacterStatusType, number> = {} as Record<AllCharacterStatusType, number>
  const fromAffixModifyMap: Record<AllCharacterStatusType, number> = {} as Record<AllCharacterStatusType, number>

  const fromTitleModifyMap: Record<AllCharacterStatusType, Record<string, number>> = {} as Record<AllCharacterStatusType, Record<string, number>>
  const fromInactiveTitleModifyMap: Record<AllCharacterStatusType, Record<string, number>> = {} as Record<AllCharacterStatusType, Record<string, number>>

  for (const type of ['work', 'battle'] as const) {
    const characterEquipment = await getUserEquipment(characterUuid, type, tx);
    let statusEffectMap: {
      [key in CharacterEquipmentType]: AllCharacterStatusType[]
    } = {
      'work': [
        'collecting',
        'mining',
        'fishing',
        'farmingAnimal',
        'farmingPlant',
        'cooking',
        'manufacturing',
        'forging',
        'sewing',
        'trading',
        'knowledge',
        'exploring',
        'mysterious',
        'enhance',
        'luck',
      ],
      'battle': [
        'luck',
        'battle',
        'strength',
        'dexterity',
        'intelligence',
        'stamina',
        'attacking',
        'defencing',
      ],
    }

    Object.values(characterEquipment).forEach((equipmentId) => {
      if (!equipmentId) {
        return;
      }

      const equipment = allGameResource[equipmentId];

      if (equipment.onEquip) {
        equipment.onEquip.forEach((equipEffect) => {
          if (equipEffect.statusEffect) {
            equipEffect.statusEffect.forEach(({ status, increase, decrease }) => {
              let modify = 0;
              if (decrease) {
                modify -= decrease;
              }
              if (increase) {
                modify += increase;
              }

              if (statusEffectMap[type].includes(status)) {
                if (type == 'battle') {
                  fromEquipModifyMap[status] = (fromEquipModifyMap[status] ?? 0) + modify
                }
                if (type == 'work') {
                  fromWorkEquipModifyMap[status] = (fromWorkEquipModifyMap[status] ?? 0) + modify
                }
              }
            })
          }
        });
      }
    });
  }

  for(const skillNode of characterSkillNode) {
    const node = allSkillTreeNodes.find(n => n.id === skillNode.nodeId)
    if (!node || !node.businessEffects) continue;

    const statusModifyEffects = node.businessEffects.statusModifyEffect

    if (typeof statusModifyEffects != 'function') continue;

    for(const effect of statusModifyEffects(skillNode.level)) {
      fromSkillNodeModifyMap[effect.status] = (fromSkillNodeModifyMap[effect.status] ?? 0) + effect.modifyNumber
    }
  }


  // 仅统计启用中的词条（ACTIVE）对属性的影响
  for (const affixInfo of characterAffixes) {
    if (affixInfo.state !== 'ACTIVE') continue;
    const effect = affixInfo.effect as any;
    if (!effect?.statusEffect) continue;
    for (const statusEffect of effect.statusEffect) {
      const statusKey = statusEffect.status as keyof typeof fromAffixModifyMap;
      if (statusEffect.increase) {
        fromAffixModifyMap[statusKey] = (fromAffixModifyMap[statusKey] ?? 0) + statusEffect.increase;
      }
      if (statusEffect.decrease) {
        fromAffixModifyMap[statusKey] = (fromAffixModifyMap[statusKey] ?? 0) - statusEffect.decrease;
      }
    }
  }

  for (const affixInfo of characterAffixes) {
    if (affixInfo.state !== 'ACTIVE' || !affixInfo.affixId) continue;
    const info = affixDefinitionsById[affixInfo.affixId]
    const infoEffect = info.effect as any;
    if (infoEffect && typeof infoEffect.onCalcStatus === 'function') {
      const onCalcStatusResult = infoEffect.onCalcStatus({ characterStatus, effect: affixInfo.effect });
      for (const status of ObjectKeysTyped(onCalcStatusResult)) {
        const val = onCalcStatusResult[status];
        if (!val) continue;
        const statusKey = status as keyof typeof fromAffixModifyMap;
        fromAffixModifyMap[statusKey] = (fromAffixModifyMap[statusKey] ?? 0) + val;
      }
    }
  }

  if (title.active) {
    const titleData = allTitles[title.active] as GameTitle;

    const titleStatusEffects = titleData.statusModifyEffect;
    if (titleStatusEffects?.length) {
      for (const statusEffect of titleStatusEffects) {
        const statusKey = statusEffect.status
        const inc = Number(statusEffect.increase ?? 0)
        const dec = Number(statusEffect.decrease ?? 0)
        const modify = (Number.isFinite(inc) ? inc : 0) - (Number.isFinite(dec) ? dec : 0)

        if (!fromTitleModifyMap[statusKey]) {
          fromTitleModifyMap[statusKey] = {}
        }
        if (!fromTitleModifyMap[statusKey][titleData.name]) {
          fromTitleModifyMap[statusKey][titleData.name] = 0
        }

        fromTitleModifyMap[statusKey][titleData.name] += modify;
      }
    }
  }
  if (title.inactive.length) {
    for (const inactiveTitleName of title.inactive) {
      const titleData = allTitles[inactiveTitleName] as GameTitle;

      const titleStatusEffects = titleData.statusModifyEffectWhenInactive;
      if (titleStatusEffects?.length) {
        for (const statusEffect of titleStatusEffects) {
          const statusKey = statusEffect.status
          const inc = Number(statusEffect.increase ?? 0)
          const dec = Number(statusEffect.decrease ?? 0)
          const modify = (Number.isFinite(inc) ? inc : 0) - (Number.isFinite(dec) ? dec : 0)

          if (!fromInactiveTitleModifyMap[statusKey]) {
            fromInactiveTitleModifyMap[statusKey] = {}
          }
          if (!fromInactiveTitleModifyMap[statusKey][titleData.name]) {
            fromInactiveTitleModifyMap[statusKey][titleData.name] = 0
          }

          fromInactiveTitleModifyMap[statusKey][titleData.name] += modify;
        }
      }
    }
  }

  for (const status of allCharacterBaseStatusType) {
    characterStatus[status] ??= {
      currentExp: 0,
      level: 1,
    };
    characterStatus[status].fromEquipment = fromEquipModifyMap[status] ?? 0;
    characterStatus[status].fromWorkEquipment = fromWorkEquipModifyMap[status] ?? 0;
    characterStatus[status].fromSkillTreeNode = fromSkillNodeModifyMap[status] ?? 0;
    characterStatus[status].fromAffix = fromAffixModifyMap[status] ?? 0;
    characterStatus[status].fromTitle = fromTitleModifyMap[status] || {};
    characterStatus[status].fromInactiveTitle = fromInactiveTitleModifyMap[status] || {};

    let allFromOther = 0
    for(const other of (Object.values(characterStatus[status].fromOther || {}))) {
      allFromOther += Number(other) || 0
    }

    let allFromActiveTitle = 0;
    for(const activeTitleVal of (Object.values(characterStatus[status].fromTitle || {}))) {
      allFromActiveTitle += Number(activeTitleVal) || 0
    }
  
    let allFromInactiveTitle = 0;
    for(const inactiveTitleVal of (Object.values(characterStatus[status].fromInactiveTitle || {}))) {
      allFromInactiveTitle += Number(inactiveTitleVal) || 0
    }


    let final =
      characterStatus[status].level + characterStatus[status].fromEquipment + characterStatus[status].fromWorkEquipment
      + characterStatus[status].fromSkillTreeNode
      + characterStatus[status].fromAffix
      + (+allFromOther.toFixed(2))
      + allFromActiveTitle
      + allFromInactiveTitle
      ;

    final = Math.max(1, final);
    characterStatus[status].final = final;
  }

  await updateCharacterStatusInfoIntoDB(characterUuid, characterStatus, tx)

  await publishGameBroadcast<UserStatusUpdateMessage>({
    kind: GameBroadcastKind.USER_STATUS_UPDATED,
    userUuid: characterUuid
  })

  return characterStatus
}

export async function getPlayerGlobalState(uuid: string): Promise<PlayerState> {
  let currentUserInfo = await prisma.user.findUnique({
    where: { uuid },
    select: {
      userGameState: true,
    },
  });

  let playerState = convertJsonStrToPlayerState(
    currentUserInfo?.userGameState
  );

  return playerState
}

export async function batchGetPlayerGlobalState(uuidList: string[]): Promise<Map<string, PlayerState>> {
  let userInfoList = await prisma.user.findMany({
    where: { uuid: { in: uuidList } },
    select: {
      uuid: true,
      userGameState: true,
    },
  });

  let result = new Map<string, PlayerState>()

  for(const userInfo of userInfoList) {
    let playerState = convertJsonStrToPlayerState(
      userInfo?.userGameState
    );

    result.set(userInfo.uuid, playerState)
  }

  return result
}