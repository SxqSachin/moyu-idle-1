import {
  allCharacterDefaultEquipmentPart,
  allCharacterEquipmentPart,
  allDecorateSlots,
  CharacterEquipmentInfo,
  CharacterEquipmentPart,
  CharacterEquipmentType,
} from "~/shared/types/characterInfo";
import { prisma } from "./db";
import { AllGameResourceID } from "~/shared/types/gameResource";
import { CharacterEquipment, CharacterWorkEquipment, Prisma, PrismaClient } from "~/generated/prisma";
import { allGameResource, conflictEquipmentMap } from "~/shared/data/allGameResources";
import { decreaseItemCount, increaseItemCount } from "./characterInventory";
import { getEquipmentActuralId, getEquipmentLevel } from "~/shared/utils/game/equipment";
import { getCharacterStatusInfo } from "./characterStatus";
import { allCharacterStatus } from "~/shared/data/allCharacterStatus";
import { ModifyItemCountType } from "~/shared/types/gameInventory";
import { DefaultArgs } from "@prisma/client/runtime/library";
import { emitEventToUser } from "~/server/io";
import { allGameBattleSkillIds } from "~/shared/data/allGameBattleSkill";
import { clone, ObjectKeysTyped } from "~/shared/utils";
import { allSkillTreeNodeMap } from "~/shared/data/skillTrees";
import { GameBroadcastKind, UserWorkEquipmentUpdateMessage } from "~/shared/types/broadcast";

function checkConflictEquipment(
  resourceId: AllGameResourceID,
  equippedIdList: AllGameResourceID[]
): boolean {
  if (conflictEquipmentMap[resourceId]?.length) {
    for (const conflictId of conflictEquipmentMap[resourceId]) {
      // 检查是否装备了冲突的装备
      const conflictResourceId = equippedIdList.find(equippedId => equippedId === conflictId);
      if (conflictResourceId) {
        throw Error(`无法装备 ${allGameResource[resourceId].name}，因为已装备冲突的装备 ${allGameResource[conflictResourceId].name}`);
      }
    }
  }

  let pResourceId = getEquipmentActuralId(resourceId);
  if (conflictEquipmentMap[pResourceId]?.length) {
    for (const conflictId of conflictEquipmentMap[pResourceId]) {
      // 检查是否装备了冲突的装备
      const conflictResourceId = equippedIdList.find(equippedId => equippedId === conflictId);
      if (conflictResourceId) {
        throw Error(`无法装备 ${allGameResource[resourceId].name}，因为已装备冲突的装备 ${allGameResource[conflictResourceId].name}`);
      }
    }
  }

  return true;
}

function toCharacterEquipmentInfo(
  characterEquipmentInfo: CharacterEquipment | null
): CharacterEquipmentInfo {
  if (!characterEquipmentInfo) {
    return {};
  }
  return {
    decorate1: characterEquipmentInfo.decorate1 as AllGameResourceID,
    decorate2: characterEquipmentInfo.decorate2 as AllGameResourceID,
    decorate3: characterEquipmentInfo.decorate3 as AllGameResourceID,
    decorate4: characterEquipmentInfo.decorate4 as AllGameResourceID,
    decorate5: characterEquipmentInfo.decorate5 as AllGameResourceID,
    decorate6: characterEquipmentInfo.decorate6 as AllGameResourceID,
    decorate7: characterEquipmentInfo.decorate7 as AllGameResourceID,
    decorate8: characterEquipmentInfo.decorate8 as AllGameResourceID,
    decorate9: characterEquipmentInfo.decorate9 as AllGameResourceID,
    head: characterEquipmentInfo.head as AllGameResourceID,
    body: characterEquipmentInfo.body as AllGameResourceID,
    arm: characterEquipmentInfo.arm as AllGameResourceID,

    leftHand: characterEquipmentInfo.leftHand as AllGameResourceID,
    leftHand2: characterEquipmentInfo.leftHand2 as AllGameResourceID,
    rightHand: characterEquipmentInfo.rightHand as AllGameResourceID,
    rightHand2: characterEquipmentInfo.rightHand2 as AllGameResourceID,

    leg: characterEquipmentInfo.leg as AllGameResourceID,
    foot: characterEquipmentInfo.foot as AllGameResourceID,
    cloak: characterEquipmentInfo.cloak as AllGameResourceID, // 新增披风装备
  };
}

export async function getUserEquipment(
  userUuid: string,
  type: CharacterEquipmentType,
  tx?: Omit<PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
): Promise<CharacterEquipmentInfo> {

  if (!tx) {
    tx = prisma;
  }

  let characterEquipmentInfo: CharacterEquipment | CharacterWorkEquipment | null = null;

  switch (type) {
    case 'work':
      characterEquipmentInfo = await tx.characterWorkEquipment.findFirst({
        where: {
          character_uuid: userUuid,
        },
      });
      break;
    case 'battle':
      characterEquipmentInfo = await tx.characterEquipment.findFirst({
        where: {
          character_uuid: userUuid,
        },
      });
      break;
    default:
      throw Error("Unknown equipment type 1 " + type);
  }

  if (!characterEquipmentInfo) {
    return {};
  }

  return toCharacterEquipmentInfo(characterEquipmentInfo);
}

export async function getUserEnabledEquipmentSlots(
  userUuid: string,
  type: CharacterEquipmentType,
  tx?: Omit<PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
): Promise<CharacterEquipmentPart[]> {
  const [skillTreeNodes, uniqueKey] = await Promise.all([
    getSkillTreeSummary(userUuid, userUuid, type== 'battle' ? 'battle' : 'life'),
    getAllUserUniqueFlags(userUuid, tx)
  ]);

  const unlockDecorate9 = uniqueKey.find(u => u.key == 'unlock_9' && u.type == 'decorate_unlock');

  const enabledSlotsFromSkillNodes: Set<CharacterEquipmentPart> = new Set();
  const disabledSlotsFromSkillNodes: Set<CharacterEquipmentPart> = new Set();

  const defaultEnabledSlots: Readonly<CharacterEquipmentPart[]> = allCharacterDefaultEquipmentPart

  for (const nodeId in skillTreeNodes.nodeLevels) {
    const node = allSkillTreeNodeMap[nodeId];
    if (!node) {
      continue;
    }

    if (node.enableBattleEquipSlot?.length) {
      for (const slot of node.enableBattleEquipSlot) {
        enabledSlotsFromSkillNodes.add(slot);
      }
    }
    if (node.disableBattleEquipSlot?.length) {
      for (const slot of node.disableBattleEquipSlot) {
        disabledSlotsFromSkillNodes.add(slot);
      }
    }
  }

  const finalEnabledSlots: CharacterEquipmentPart[] = [];

  for (const slot of allCharacterEquipmentPart) {
    const isEnabledByDefault = defaultEnabledSlots.includes(slot);
    const isEnabledBySkillNode = enabledSlotsFromSkillNodes.has(slot);
    const isDisabledBySkillNode = disabledSlotsFromSkillNodes.has(slot);

    if ((isEnabledByDefault || isEnabledBySkillNode) && !isDisabledBySkillNode) {
      finalEnabledSlots.push(slot);
    }
  }

  if (unlockDecorate9) {
    if (!finalEnabledSlots.includes(CharacterEquipmentPart.decorate9)) {
      finalEnabledSlots.push(CharacterEquipmentPart.decorate9);
    }
  }

  return finalEnabledSlots;
}

export async function equipItem(
  userUuid: string,
  resourceId: AllGameResourceID,
  type: CharacterEquipmentType,
  tx?: Omit<PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
): Promise<CharacterEquipmentInfo> {
  // let equipModifyLockKey = "internalLock:equip:" + userUuid;
  // return await withUnequipLock(equipModifyLockKey, async () => {

  if (!tx) {
    tx = prisma;
  }
    const resource = allGameResource[resourceId];

    if (!resource) {
      throw Error("此物品不可装备");
    }

    if (!resource.equipPart) {
      throw Error("此物品不可装备");
    }

    // 先检查需求
    if (resource.equipStatusRequirement) {
      const characterStatus = await getCharacterStatusInfo(userUuid);

      for (const requirement of resource.equipStatusRequirement) {
        if (requirement.status == 'workTotal') {
          let total = 0;
          for (const statusId of ObjectKeysTyped(characterStatus)) {
            const status = characterStatus[statusId];
            if (statusId != 'trading') {
              total += status.level;
            }
          }
          if (total < requirement.min) {
            throw Error(
              `装备 ${resource.name} 需要 生活总等级 至少达到 ${requirement.min}，当前为 ${total ?? 0}`
            )
          }
        } else {
          const currentStatus = characterStatus[requirement.status];
          if (!currentStatus || currentStatus.level < requirement.min) {
            throw Error(
              `装备 ${resource.name} 需要 ${allCharacterStatus[requirement.status].name} 至少达到 ${requirement.min}，当前为 ${currentStatus?.level ?? 0}`
            );
          }
        }
      }
    }

    if (!!resource.equipmentType?.length && !resource.equipmentType.includes(type)) {
      throw Error(
        `装备 ${resource.name} 只能在 ${resource.equipmentType.join(" 或 ")} 中使用，当前为 ${type}`
      );
    }

    let equipment = await getUserEquipment(userUuid, type, tx);

    // 检查互斥
    const thisEquipmentActualId = getEquipmentActuralId(resourceId);
    const allEquipmentIdList = Object.values(equipment).filter(v => !!v);
    checkConflictEquipment(resourceId, allEquipmentIdList);
    checkConflictEquipment(thisEquipmentActualId, allEquipmentIdList );

    const enabledEquipmentSlot = await getUserEnabledEquipmentSlots(userUuid, type, tx);

    if (!enabledEquipmentSlot.includes(resource.equipPart)) {
      throw Error(`装备槽位被禁用，无法装备 ${resource.name}`);
    }

    if (resource.equipPart.startsWith("decorate")) {
      // 对于饰品，检查所有饰品槽位是否都被占据
      const decorateSlots = enabledEquipmentSlot.filter(slot => slot.startsWith("decorate"))

      const checkUsedResourceId = getEquipmentActuralId(resourceId) as AllGameResourceID;

      // 如果已经装备在某个槽位，直接抛错
      if (decorateSlots.some((slot) => {
        return getEquipmentActuralId(equipment[slot] ?? "") === checkUsedResourceId
      })) {
        throw Error(`${resource.name} 已装备在其他槽位`);
      }
      // 找到第一个空槽位
      const emptySlot = decorateSlots.find((slot) => !equipment[slot]);
      if (!emptySlot) {
        throw Error("已经装备满所有饰品槽位");
      }

      // 装备到第一个空槽位
      equipment[emptySlot] = resourceId;
    } else if (resource.equipPart.startsWith("rightHand")) {
      // 对于饰品，检查所有饰品槽位是否都被占据
      const usableSlots = enabledEquipmentSlot.filter(slot => slot.startsWith("rightHand"))

      const checkUsedResourceId = getEquipmentActuralId(resourceId) as AllGameResourceID;

      // 如果已经装备在某个槽位，直接抛错
      if (usableSlots.some((slot) => {
        return getEquipmentActuralId(equipment[slot] ?? "") === checkUsedResourceId
      })) {
        throw Error(`${resource.name} 已装备在其他槽位`);
      }
      // 找到第一个空槽位
      const emptySlot = usableSlots.find((slot) => !equipment[slot]);
      if (!emptySlot) {
        throw Error("已经装备满所有右手");
      }

      // 装备到第一个空槽位
      equipment[emptySlot] = resourceId;
    } else {
      if (equipment[resource.equipPart]) {
        await unequipItem(userUuid, resource.equipPart, type, tx);
      }

      // 对于其他装备部位，直接装备
      equipment[resource.equipPart] = resourceId;
    }

    // 先移除道具
    let modifyRes = await decreaseItemCount(userUuid, {
      [resourceId]: { count: 1 },
    }, {
      actionName: `装备 ${allGameResource[resourceId].name}`,
      showModifyInfo: true,
      type: ModifyItemCountType.Equipment
    }, tx);
    await invalidateInventoryCache(userUuid);

    if (!modifyRes[resourceId]?.count) {
      throw Error(`库存数量不足：${allGameResource[resourceId].name}`);
    }

    let equipmentResult: CharacterEquipment | CharacterWorkEquipment | null = null;
    switch (
    type
    ) {
      case 'work':
        equipmentResult = await tx.characterWorkEquipment.upsert({
          where: {
            character_uuid: userUuid,
          },
          update: {
            character_uuid: userUuid,
            ...equipment,
          },
          create: {
            character_uuid: userUuid,
            user_uuid: userUuid,
            ...equipment,
          },
        });
        break;
      case 'battle':
        equipmentResult = await tx.characterEquipment.upsert({
          where: {
            character_uuid: userUuid,
          },
          update: {
            character_uuid: userUuid,
            ...equipment,
          },
          create: {
            character_uuid: userUuid,
            user_uuid: userUuid,
            ...equipment,
          },
        });
        break;
      default:
        throw Error("Unknown equipment type 3 " + type);
    }

    // 处理装备绑定技能
    let skillUpdated = false;
    for(const onEquipEffect of resource.onEquip ?? []) {
      if (onEquipEffect.boundSkills?.length) {
        for(const {id: boundSkillId, level} of onEquipEffect.boundSkills) {
          if (!allGameBattleSkillIds.includes(boundSkillId)) {
            continue;
          }

          // check has learned
          const exist = await tx.characterSkillInfo.findUnique({
            where: {
              character_user_skill_unique: {
                user_uuid: userUuid,
                character_uuid: userUuid,
                skill_id: boundSkillId,
              },
            },
          });

          skillUpdated = true;

          if (exist) {
            await tx.characterSkillInfo.update({
              where: {
                character_user_skill_unique: {
                  user_uuid: userUuid,
                  character_uuid: userUuid,
                  skill_id: boundSkillId,
                },
              },
              data: {
                level: level,
                enabled: true,
                available: true,
              },
            })

            continue;
          }

          await tx.characterSkillInfo.create({
            data: {
              user_uuid: userUuid,
              character_uuid: userUuid,
              skill_id: boundSkillId,
              exp: 0,
              level: level,
              available: true,
              enabled: true,
            },
          });
        }
      }
    }

    if (skillUpdated) {
      const skillInfo = await getAllCharacterSkills(userUuid)
      emitEventToUser(userUuid, "character:getSkills:success", skillInfo)
    }

    if (type == 'work') {
      await publishGameBroadcast<UserWorkEquipmentUpdateMessage>({
        kind: GameBroadcastKind.USER_WORK_EQUIPMENT,
        userUuid: userUuid
      });
    }
    // equipmentLogger.info({
    //   userUuid: userUuid,
    //   action: "equipItem",
    //   equipPart: resource.equipPart,
    //   resourceId: resourceId,
    //   equipmentResult: equipmentResult,
    // });
    return toCharacterEquipmentInfo(equipmentResult);
  // });
}

export const unequipItem = async (
  userUuid: string,
  equipPart: CharacterEquipmentPart,
  type: CharacterEquipmentType,
  tx?: Omit<PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
): Promise<CharacterEquipmentInfo> => {
  // let equipModifyLockKey = "internalLock:unequip:" + userUuid;
  // return await withUnequipLock(equipModifyLockKey, async () => {
  if (!tx) {
    tx = prisma;
  }

    // 1. 检查用户是否拥有该装备
    const userEquipment = await getUserEquipment(userUuid, type, tx);
    if (!userEquipment[equipPart]) {
      return userEquipment;
    }

    // 2. 移除装备从用户表的对应部位中
    const itemId = userEquipment[equipPart];

    if (!itemId) {
      throw Error("No item equipped in " + equipPart);
    }

    const resource = allGameResource[itemId];
    if (!resource) {
      throw Error("Unknown equipment resource " + itemId);
    }

    // @ts-ignore
    userEquipment[equipPart] = "";

    let updatedEquipment: CharacterEquipment | CharacterWorkEquipment | null = null;
    switch (type) {
      case 'work':
        updatedEquipment = await tx.characterWorkEquipment.update({
          where: {
            character_uuid: userUuid,
          },
          data: {
            character_uuid: userUuid,
            ...userEquipment,
          },
        });
        break;
      case 'battle':
        updatedEquipment = await tx.characterEquipment.update({
          where: {
            character_uuid: userUuid,
          },
          data: {
            character_uuid: userUuid,
            ...userEquipment,
          },
        });
        break;
      default:
        throw Error("Unknown equipment type 2 " + type);
    }

    // 3. 添加物品到物品栏中
    await increaseItemCount(userUuid, {
      [itemId]: {
        count: 1,
      },
    }, {
      actionName: `卸下装备 ${allGameResource[itemId].name}`,
      showModifyInfo: true,
      type: ModifyItemCountType.Equipment
    }, tx);
    await invalidateInventoryCache(userUuid);

    // 处理装备绑定技能
    let skillUpdated = false;
    for(const onEquipEffect of resource.onEquip ?? []) {
      if (onEquipEffect.boundSkills?.length) {
        for(const {id: boundSkillId} of onEquipEffect.boundSkills) {
          if (!allGameBattleSkillIds.includes(boundSkillId)) {
            continue;
          }

          // check not learned
          const exist = await tx.characterSkillInfo.findUnique({
            where: {
              character_user_skill_unique: {
                user_uuid: userUuid,
                character_uuid: userUuid,
                skill_id: boundSkillId,
              }
            },
          });

          if (!exist) {
            continue;
          }

          await tx.characterSkillInfo.update({
            where: {
              character_user_skill_unique: {
                user_uuid: userUuid,
                character_uuid: userUuid,
                skill_id: boundSkillId,
              }
            },
            data: {
              enabled: false,
              available: false,
            }
          });

          skillUpdated = true;
        }
      }
    }

    if (skillUpdated) {
      const skillInfo = await getAllCharacterSkills(userUuid)
      emitEventToUser(userUuid, "character:getSkills:success", skillInfo)
    }

    // equipmentLogger.info({
    //   userUuid: userUuid,
    //   action: "unequipItem",
    //   equipPart: equipPart,
    //   itemId: itemId,
    //   updatedEquipment: updatedEquipment,
    // });

    if (type == 'work') {
      await publishGameBroadcast<UserWorkEquipmentUpdateMessage>({
        kind: GameBroadcastKind.USER_WORK_EQUIPMENT,
        userUuid: userUuid
      });
    }

    return toCharacterEquipmentInfo(updatedEquipment);
  // })
};

