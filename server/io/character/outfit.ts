import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import * as outfitService from "~/server/utils/game/outfit";
import { CharacterEquipmentType, CharacterEquipmentOutfitInGame, CharacterEquipmentInfo } from "~/shared/types/characterInfo";
import { withUniqueLock } from "~/server/utils/lock";
import { updateAllActionDuration, updateAllActionResourceRequirement, updateCharacterStatusInfo } from "~/server/utils/game/character";
import { dispatchCharacterStatusInfo } from "~/server/utils/game/characterStatus";
import { getUserEquipment } from "~/server/utils/game/equipment";
import { getBattleRoomByUserId } from "~/server/utils/game/battle";
import { applySkillOutfit, deleteSkillOutfit, getUserAllSkillOutfit, saveCurrentAsOutfit } from "~/server/utils/game/skillOutfit";
import { getAllCharacterSkills } from "~/server/utils/game/characterSkill";
import { allGameAction, allGameActionId, allGameActionMainType } from "~/shared/data/allGameActions";

// 分布式锁 key 生成方法
function getOutfitLockKey(userUuid: string) {
  return `outfit:modify:${userUuid}`;
}

// 创建配装方案
export async function handleCreateOutfit(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ name: string; type: CharacterEquipmentType; equipment: any, actionIdList: string[] }>
) {
  const userUuid = data.user.uuid;
  let { name, type, equipment, actionIdList } = data.data;

  if (!actionIdList || !Array.isArray(actionIdList)) {
    actionIdList = []
  }
  // 过滤掉不在 actionIdList 中的动作
  actionIdList = actionIdList.filter(id => Object.keys(allGameActionMainType).includes(id));

  if (!name || name.length > 12) {
    emitEventToUser(userUuid, "outfit:create:fail", { message: "配装名称不能为空且不能超过12个字" });
    return;
  }

  await withUniqueLock(getOutfitLockKey(userUuid), async () => {
    try {
      const outfit: CharacterEquipmentOutfitInGame = await outfitService.createOutfit(userUuid, name, type, equipment, actionIdList);
      emitEventToUser(userUuid, "outfit:create:success", { outfit });
    } catch (e: any) {
      emitEventToUser(userUuid, "outfit:create:fail", { message: e.message || "创建失败" });
    }
  });
}

// 应用配装方案
export async function handleApplyOutfit(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ outfitUuid: string; type: CharacterEquipmentType }>
) {
  const userUuid = data.user.uuid;
  const { outfitUuid, type } = data.data;

  if (type == 'battle') {
    let room = await getBattleRoomByUserId(userUuid);
    if (!!room && room.status != 'waiting') {
      emitEventToUser(userUuid, "outfit:apply:fail", { message: "战斗中无法更换配装" });
      return;
    }
  }

  await withUniqueLock(getOutfitLockKey(userUuid), async () => {
    try {
      const result = await outfitService.applyOutfit(userUuid, outfitUuid, type);
      emitEventToUser(userUuid, "outfit:apply:success", { equipment: result });
    } catch (e: any) {
      emitEventToUser(userUuid, "outfit:apply:fail", { message: e.message || "应用失败" });
    } finally {
      const [
        latestAllActionDurationDetail,
        latestAllActionResourceRequirement,
        latestStatus,
      ] = await Promise.all([
        updateActionDuration(userUuid),
        updateAllActionResourceRequirement(userUuid),
        updateCharacterStatusInfo(userUuid),
      ]);
      emitEventToUser(
        userUuid,
        "character:updateActionDuration:success",
        latestAllActionDurationDetail
      );

      emitEventToUser(
        userUuid,
        "character:updateActionResourceRequirement:success",
        latestAllActionResourceRequirement
      );
      dispatchCharacterStatusInfo(userUuid, latestStatus);

      const res = await getUserEquipment(userUuid, type)
      switch (type) {
        case "work":
          emitEventToUser(userUuid, "character:getEquipment:work:success", res)
          break;
        case "battle":
          emitEventToUser(userUuid, "character:getEquipment:battle:success", res)
          break;
        default:
          break;
      }
    }
  });
}

// 修改配装方案
export async function handleUpdateOutfit(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ outfitUuid: string; equipment: CharacterEquipmentOutfitInGame, actionIdList: string[] }>
) {
  const userUuid = data.user.uuid;
  let { outfitUuid, equipment, actionIdList } = data.data;

  // 过滤掉不在 actionIdList 中的动作
  if (!actionIdList || !Array.isArray(actionIdList)) {
    actionIdList = []
  }
  actionIdList = actionIdList.filter(id => Object.keys(allGameActionMainType).includes(id));

  if (!equipment.name || equipment.name.length > 12) {
    emitEventToUser(userUuid, "outfit:create:fail", { message: "配装名称不能为空且不能超过12个字" });
    return;
  }

  await withUniqueLock(getOutfitLockKey(userUuid), async () => {
    try {
      const outfit: CharacterEquipmentOutfitInGame = await outfitService.updateOutfit(userUuid, outfitUuid, equipment, actionIdList);
      emitEventToUser(userUuid, "outfit:update:success", { outfit });
    } catch (e: any) {
      emitEventToUser(userUuid, "outfit:update:fail", { message: e.message || "修改失败" });
    }
  });
}

// 删除配装方案
export async function handleDeleteOutfit(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ outfitUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { outfitUuid } = data.data;
  await withUniqueLock(getOutfitLockKey(userUuid), async () => {
    try {
      await outfitService.deleteOutfit(userUuid, outfitUuid);
      emitEventToUser(userUuid, "outfit:delete:success", { outfitUuid });
    } catch (e: any) {
      emitEventToUser(userUuid, "outfit:delete:fail", { message: e.message || "删除失败" });
    }
  });
}

// 查询所有配装方案（无需加锁）
export async function handleGetAllOutfits(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ type?: CharacterEquipmentType }>
) {
  const userUuid = data.user.uuid;
  const { type } = data.data;
  try {
    const outfits: CharacterEquipmentOutfitInGame[] = await outfitService.getAllOutfits(userUuid, type);
    emitEventToUser(userUuid, "outfit:list:success", { outfits });
  } catch (e: any) {
    emitEventToUser(userUuid, "outfit:list:fail", { message: e.message || "获取失败" });
  }
}

export async function handleGetAllSkillOutfit(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<void>
) {
  const userUuid = data.user.uuid;
  const characterUuid = userUuid;

  if (!characterUuid) {
    emitEventToUser(userUuid, "skillOutfit:list:fail", { message: "角色ID不能为空" });
    return;
  }

  try {
    const outfits = await getUserAllSkillOutfit(characterUuid);
    emitEventToUser(userUuid, "skillOutfit:list:success", { outfits });
  } catch (e: any) {
    emitEventToUser(userUuid, "skillOutfit:list:fail", { message: e.message || "获取失败" });
  }
}

export async function handleSaveCurrentSkillAsOutfit(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ name: string }>
){
  const userUuid = data.user.uuid;
  const name = data.data.name;

  if (!userUuid || !name) {
    emitEventToUser(userUuid, "skillOutfit:saveCurrent:fail", { message: "名称不能为空" });
    return;
  }

  try {
    const outfit = await saveCurrentAsOutfit(userUuid, name);
    emitEventToUser(userUuid, "skillOutfit:saveCurrent:success", { outfit });
  } catch (e: any) {
    emitEventToUser(userUuid, "skillOutfit:saveCurrent:fail", { message: e.message || "保存失败" });
  }
}

export async function handleApplySkillOutfitToCharacter(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ outfitUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { outfitUuid } = data.data;

  if (!outfitUuid) {
    emitEventToUser(userUuid, "skillOutfit:apply:fail", { message: "角色ID和配装ID不能为空" });
    return;
  }

  try {
    await applySkillOutfit(userUuid, outfitUuid);

    const skillInfo = await getAllCharacterSkills(userUuid)
    emitEventToUser(userUuid, "skillOutfit:apply:success");
    emitEventToUser(data.user, "character:getSkills:success", skillInfo)
  } catch (e: any) {
    emitEventToUser(userUuid, "skillOutfit:apply:fail", { message: e.message || "应用失败" });
  }
}

export async function handleDeleteSkillOutfit(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ outfitUuid: string }>
) {
  const userUuid = data.user.uuid;
  const { outfitUuid } = data.data;

  if (!outfitUuid) {
    emitEventToUser(userUuid, "skillOutfit:delete:fail", { message: "角色ID和配装ID不能为空" });
    return;
  }

  try {
    const outfit = await deleteSkillOutfit(userUuid, outfitUuid);
    emitEventToUser(userUuid, "skillOutfit:delete:success", { outfit });
  } catch (e: any) {
    emitEventToUser(userUuid, "skillOutfit:delete:fail", { message: e.message || "应用失败" });
  }
}