import { prisma } from "./db";
import { allCharacterEquipmentPart, CharacterEquipmentInfo, CharacterEquipmentOutfitInGame, CharacterEquipmentPart, CharacterEquipmentType } from "~/shared/types/characterInfo";
import { AllGameResourceID } from "~/shared/types/gameResource";
import { CharacterEquipmentOutfit } from "~/generated/prisma";
import { getUserEquipment, equipItem, unequipItem } from "./equipment";
import { v4 } from "uuid";
import { getInventoryInfo } from "./characterInventory";
import { allGameResource, allGameResourceIDWithInternal } from "~/shared/data/allGameResources";
import { MAX_OUTFIT_COUNT } from "~/shared/data/constant";
import { getCharacterStatusInfo } from "./characterStatus";
import { allCharacterStatus } from "~/shared/data/allCharacterStatus";
import { AllGameActionID } from "~/shared/types/gameAction";

// 类型转换方法
function toOutfitInGame(outfit: CharacterEquipmentOutfit): CharacterEquipmentOutfitInGame {
  return {
    uuid: outfit.uuid,
    user_uuid: outfit.user_uuid,
    name: outfit.name,
    type: outfit.type as 'work' | 'battle',
    head: outfit.head ?? "",
    body: outfit.body ?? "",
    arm: outfit.arm ?? "",
    leg: outfit.leg ?? "",
    foot: outfit.foot ?? "",

    leftHand: outfit.leftHand ?? "",
    leftHand2: outfit.leftHand2 ?? "",
    rightHand: outfit.rightHand ?? "",
    rightHand2: outfit.rightHand2 ?? "",

    cloak: outfit.cloak ?? "", // 新增披风装备
    decorate1: outfit.decorate1 ?? "",
    decorate2: outfit.decorate2 ?? "",
    decorate3: outfit.decorate3 ?? "",
    decorate4: outfit.decorate4 ?? "",
    decorate5: outfit.decorate5 ?? "",
    decorate6: outfit.decorate6 ?? "",
    decorate7: outfit.decorate7 ?? "",
    decorate8: outfit.decorate8 ?? "",
    decorate9: outfit.decorate9 ?? "",
    actionType: outfit.actionType ? outfit.actionType.split(',') as AllGameActionID[] : []
  };
}

// 创建配装方案
export async function createOutfit(
  userUuid: string,
  name: string,
  type: CharacterEquipmentType,
  equipment: CharacterEquipmentInfo,
  actionIdList: AllGameActionID[]
): Promise<CharacterEquipmentOutfitInGame> {

  if (!actionIdList?.length) {
    actionIdList = []
  }

  // 检查是否已存在同名方案
  const exist = await prisma.characterEquipmentOutfit.findFirst({
    where: { user_uuid: userUuid, name, type }
  });
  if (exist) throw Error("配装方案名称已存在");

  // 检查已存在套装数量
  const count = await prisma.characterEquipmentOutfit.count({
    where: { user_uuid: userUuid, type }
  });

  if (count > MAX_OUTFIT_COUNT) {
    throw Error(`已达到最大配装方案数量限制：${MAX_OUTFIT_COUNT}`);
  }

  // 生成唯一uuid
  const uuid = v4();

  const outfit = await prisma.characterEquipmentOutfit.create({
    data: {
      user_uuid: userUuid,
      character_uuid: userUuid,
      uuid,
      name,
      type,
      ...equipment,
      actionType: actionIdList.join(',')
    }
  });
  return toOutfitInGame(outfit);
}

// 应用配装方案（将方案中的装备依次装备到角色）
export async function applyOutfit(
  userUuid: string,
  outfitUuid: string,
  type: CharacterEquipmentType
): Promise<void> {

  const outfit = await prisma.characterEquipmentOutfit.findUnique({
    where: { uuid: outfitUuid }
  });
  if (!outfit) throw Error("未找到配装方案");

  if (outfit.user_uuid !== userUuid) throw Error("无权限操作该配装方案");

  const characterStatus = await getCharacterStatusInfo(userUuid);
  for (const part of allCharacterEquipmentPart) {
    let equipmentId = outfit[part]
    if (equipmentId) {
      let resource = allGameResource[equipmentId as AllGameResourceID];
      // 先检查需求
      if (resource.equipStatusRequirement) {
        for (const requirement of resource.equipStatusRequirement) {

          if (requirement.status == 'workTotal') {
            let total = 0;
            for (const status of Object.values(characterStatus)) {
              total += status.level;
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
    }
  }

  // 脱下全部装备
  // 这里脱装备单独使用一组事务，需要保证每个装备确实被脱下，与变动记录同步
  await prisma.$transaction(async (tx) => {
    for (const part of allCharacterEquipmentPart) {
      try {
        await unequipItem(userUuid, part, type, tx)
      } catch (e: any) {
        throw Error("应用配装失败：" + e.message);
      }
    }
  })

  return prisma.$transaction(async (tx) => {
    const outfit = await tx.characterEquipmentOutfit.findUnique({
      where: { uuid: outfitUuid }
    });
    if (!outfit) throw Error("未找到配装方案");

    if (outfit.user_uuid !== userUuid) throw Error("无权限操作该配装方案");

    // 检查配装方案中需要的装备，是否都拥有
    let characterInventory = await getInventoryInfo(userUuid, tx);

    for (const part of allCharacterEquipmentPart) {
      let equipmentId = outfit[part] 
      if (equipmentId && !characterInventory[equipmentId]?.count) {
        throw Error(`缺少配装所需装备：${allGameResource[equipmentId].name}`);
      }
    }

    // 穿装备
    for (const part of allCharacterEquipmentPart) {
      const resourceId = outfit[part] as AllGameResourceID | undefined;
      if (resourceId) {
        try {
          await equipItem(userUuid, resourceId, type, tx);
        } catch (e: any) {
          throw Error("应用配装失败：" + e.message);
        }
      }
    }
  }, {
    isolationLevel: "Serializable",
    timeout: 10000,
  });
}

// 修改配装方案
export async function updateOutfit(
  userUuid: string,
  outfitUuid: string,
  equipment: Partial<CharacterEquipmentOutfitInGame>,
  actionIdList: AllGameActionID[]
): Promise<CharacterEquipmentOutfitInGame> {

  if (!actionIdList?.length) {
    actionIdList = []
  }

  const outfit = await prisma.characterEquipmentOutfit.findUnique({
    where: { uuid: outfitUuid }
  });
  if (!outfit || outfit.user_uuid !== userUuid) {
    throw Error("未找到配装方案");
  }

  let nameExist = await prisma.characterEquipmentOutfit.findFirst({
    where: {
      user_uuid: userUuid,
      name: equipment.name,
      type: equipment.type,
      uuid: { not: outfitUuid } // 排除当前方案
    }
  });

  if (nameExist) {
    throw Error("配装方案名称已存在");
  }

  delete equipment.uuid;
  delete equipment.user_uuid;
  delete equipment.type;

  const updated = await prisma.characterEquipmentOutfit.update({
    where: { uuid: outfitUuid },
    data: { 
      ...equipment,
      actionType: actionIdList.join(',')
    }
  });
  return toOutfitInGame(updated);
}

// 删除配装方案
export async function deleteOutfit(
  userUuid: string,
  outfitUuid: string
): Promise<void> {
  const outfit = await prisma.characterEquipmentOutfit.findUnique({
    where: { uuid: outfitUuid }
  });
  if (!outfit || outfit.user_uuid !== userUuid) {
    throw Error("未找到配装方案");
  }
  await prisma.characterEquipmentOutfit.delete({
    where: { uuid: outfitUuid }
  });
}

// 查询所有配装方案
export async function getAllOutfits(
  userUuid: string,
  type?: CharacterEquipmentType
): Promise<CharacterEquipmentOutfitInGame[]> {
  const outfits = await prisma.characterEquipmentOutfit.findMany({
    where: {
      user_uuid: userUuid,
      ...(type ? { type } : {})
    }
  });
  return outfits.map(toOutfitInGame);
}