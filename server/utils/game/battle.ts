import type {
  BattleRoom,
  CreateBattleRoomInput,
  CreateNormalBattleRoomInput,
  CreateWorldBossBattleRoomInput,
  NormalBattleRoom,
  UpdateBattleRoomInput,
  UpdateNormalBattleRoomInput,
  UpdateWorldBossBattleRoomInput,
  WorldBossBattleRoom,
} from "@/shared/types/battleRoom";
import { createRoom, getRoomById, getAllRooms, getRoomKey, updateRoom } from "./room";
import { BaseBattleUnit } from "~/shared/types/unit";
import { getAndUpdateCharacterUnitInfo } from "./characterUnit";
import { generateEnemyById, generateUnitById } from "./enemy";
import { AllGameEnemyID, Enemy } from "~/shared/types/emeny";
import { AllBattleAreaID, BattleArea, BattleInfo, BattleRoundStage, BattleStatus, EnemyPoolEntry, EquipmentTriggerInfo, EquipmentTriggerParam, FullBattleAction } from "~/shared/types/battle";
import { v4 as uuidv4 } from "uuid";
import { allBattleAreas } from "~/shared/data/allBattleInfo";
import { assertUserBattleLevelInArea } from "./battleArea";
import { emitEventToUser } from "~/server/io";
import { Room } from "~/shared/types/room";
import { BATTLE_ROOM_DIFFICULTY_LEVELS_INFO, GO_TO_AREA_DURATION, INTELLIGENCE_EXP_PRE_CAST_SKILL } from "~/shared/data/constant";
import { getUserWorkingTalentCats } from "./tarven";
import { isIronCat } from "./account";
import { ObjectKeysTyped } from "~/shared/utils";
import { ItemCountInfo, ModifyItemCountType } from "~/shared/types/gameInventory";
import { allGameResource } from "~/shared/data/allGameResources";
import { convertItemCountInfoToDecrease } from "~/shared/utils/game/requirementCheck";
import { getWorldBossConfigById } from "~/server/utils/game/worldBoss";
import { getCharacterStatusInfo } from "./characterStatus";

/**
 * 创建一个战斗房间
 */
export async function createBattleRoom(
  payload: CreateBattleRoomInput & {
    ownerId: string;
    ironcat: boolean;
  }
): Promise<BattleRoom> {
  const { ownerId, ironcat, ...rest } = payload;
  const finalBattleType = rest.battleType === "worldBoss" ? "worldBoss" : "normal";

  // 公共必填校验
  if (!rest.name || !rest.name.trim()) {
    throw new Error("房间名称不能为空");
  }

  if (finalBattleType === "worldBoss") {
    const worldBossInput = rest as CreateWorldBossBattleRoomInput;
    if (!worldBossInput.worldBossId) {
      throw new Error("“大麻烦”房间必须提供worldBossId");
    }
    const config = await getWorldBossConfigById(worldBossInput.worldBossId || "");
    if (!config) {
      throw new Error("未找到对应的“大麻烦”配置");
    }

    // const worldBossArea = worldBossInput.area && ObjectKeysTyped(allBattleAreas).includes(worldBossInput.area)
    //   ? worldBossInput.area
    //   : ObjectKeysTyped(allBattleAreas)[0];

    return createRoom<WorldBossBattleRoom>(ownerId, (uuid, ownerId) => ({
      uuid,
      isPublic: worldBossInput.isPublic,
      name: worldBossInput.name,
      ownerId,
      memberIds: [ownerId],
      maxMembers: 6,
      createdAt: Date.now(),

      status: "waiting",
      type: "battle",

      repeatCount: 10000000,
      currentRepeat: 0,
      // area: worldBossArea,
      autoRestart: worldBossInput.autoRestart,
      autoStartBattle: worldBossInput.autoStartBattle,
      lastUpdateAt: Date.now(),
      viewerMemberUuids: [],
      ironcat,

      publicBattleLoot: worldBossInput.publicBattleLoot ?? true,

      battleType: "worldBoss",
      worldBossId: config.id,
      worldBossVersion: config.version,

      // afterWin action (optional)
      afterWin: worldBossInput.afterWin,

      readyMap: { [ownerId]: false }, // 房主初始未准备
    }));
  }

  const normalInput = rest as CreateNormalBattleRoomInput;

  if (!ironcat) {
    normalInput.lootGoldSlider = 0;
  }

  if (!normalInput.area) {
    throw new Error("普通房间必须指定副本区域");
  }

  let { difficulty, area } = normalInput;
  if (difficulty && difficulty > BATTLE_ROOM_DIFFICULTY_LEVELS_INFO.length) {
    difficulty = BATTLE_ROOM_DIFFICULTY_LEVELS_INFO.length;
  }
  if (difficulty && difficulty <= 0) {
    difficulty = 0;
  }

  if (!area || !ObjectKeysTyped(allBattleAreas).includes(area)) {
    throw new Error("无效的副本区域");
  }

  await assertUserBattleLevelInArea(ownerId, area);

  return createRoom<BattleRoom>(ownerId, (uuid, ownerId) => ({
    uuid,
    isPublic: normalInput.isPublic,
    name: normalInput.name,
    ownerId,
    memberIds: [ownerId],
    maxMembers: 6,
    createdAt: Date.now(),
    status: "waiting",
    type: "battle",
    repeatCount: 10000000,
    currentRepeat: 0,
    autoRestart: normalInput.autoRestart,
    autoStartBattle: normalInput.autoStartBattle,
    lastUpdateAt: Date.now(),
    viewerMemberUuids: [],
    area,
    difficulty,
    ironcat,
    denseFogMode: normalInput.denseFogMode,
    autoRestartDenseFogMode: normalInput.autoRestartDenseFogMode,
    // 保持lootGoldSlider持久化
    lootGoldSlider: typeof normalInput.lootGoldSlider === 'number' ? normalInput.lootGoldSlider : 0,
    disableDenseFogModeBecausePlayerLose: false,

    phantomUuidList: normalInput.phantomUuidList ?? [],

    publicBattleLoot: normalInput.publicBattleLoot ?? true,

    autoWorldBossBattleConf: normalInput.autoWorldBossBattleConf ?? { type: "none" },

    battleType: "normal",

    readyMap: { [ownerId]: false }, // 房主初始未准备
  }));
}

export async function updateBattleRoomInfo(
  roomId: string,
  data: UpdateBattleRoomInput
): Promise<BattleRoom | undefined> {
  let battleRoom = await getBattleRoomById(roomId);
  if (!battleRoom) throw new Error("未找到战斗房间");

  // 只允许在等待状态下修改
  if (battleRoom.status !== "waiting") {
    throw new Error("只有等待中的房间才能修改信息");
  }

  if (!!data.ownerId && !battleRoom.memberIds.includes(data.ownerId)) {
    throw new Error("新房主不在此房间中");
  }

  if (data.battleType === "worldBoss") {
    battleRoom = battleRoom as WorldBossBattleRoom;

    const worldBossData: UpdateWorldBossBattleRoomInput = {
      ...battleRoom,
      ...data,
    } as UpdateWorldBossBattleRoomInput;

    if (!worldBossData.name || !worldBossData.name.trim()) {
      throw new Error("房间名称不能为空");
    }

    if (!worldBossData.worldBossId) {
      throw new Error("“大麻烦”房间必须提供BossId");
    }

    battleRoom.isPublic = worldBossData.isPublic;
    battleRoom.battleType = 'worldBoss'
    battleRoom.name = worldBossData.name;
    battleRoom.publicBattleLoot = worldBossData.publicBattleLoot ?? battleRoom.publicBattleLoot ?? true;
    battleRoom.autoStartBattle = worldBossData.autoStartBattle ?? battleRoom.autoStartBattle;
    battleRoom.autoRestart = worldBossData.autoRestart ?? battleRoom.autoRestart;
    battleRoom.worldBossId = worldBossData.worldBossId ?? battleRoom.worldBossId;
    battleRoom.worldBossVersion = worldBossData.worldBossVersion ?? battleRoom.worldBossVersion;
    if (worldBossData.afterWin !== undefined) {
      battleRoom.afterWin = worldBossData.afterWin;
    }

    applyRoomBeginnerInfo(battleRoom);

    delete battleRoom.area;
    delete battleRoom.phantomUuidList;
    // @ts-ignore
    delete battleRoom.difficulty;
    // @ts-ignore
    delete battleRoom.denseFogMode;
    // @ts-ignore
    delete battleRoom.autoRestartDenseFogMode;

    if (worldBossData.ownerId) {
      battleRoom.ownerId = worldBossData.ownerId;
    }

    battleRoom.ironcat = await isIronCat(battleRoom.ownerId);

    await updateRoom(roomId, battleRoom);
    return battleRoom;
  } else if (!data.battleType || data.battleType === "normal") {
    battleRoom = battleRoom as NormalBattleRoom;

    const normalData = data as UpdateNormalBattleRoomInput;

    if (!normalData.name || !normalData.name.trim()) {
      throw new Error("房间名称不能为空");
    }
    if (!normalData.area) {
      throw new Error("普通房间必须指定副本区域");
    }

    if (
      normalData.difficulty &&
      normalData.difficulty > BATTLE_ROOM_DIFFICULTY_LEVELS_INFO.length
    ) {
      normalData.difficulty = BATTLE_ROOM_DIFFICULTY_LEVELS_INFO.length;
    }
    if (normalData.difficulty && normalData.difficulty <= 0) {
      normalData.difficulty = 0;
    }

    if (
      !normalData.area ||
      !ObjectKeysTyped(allBattleAreas).includes(normalData.area)
    ) {
      throw new Error("无效的副本区域");
    }

    battleRoom.battleType = 'normal'
    battleRoom.isPublic = normalData.isPublic;
    battleRoom.name = normalData.name;
    battleRoom.area = normalData.area;
    battleRoom.repeatCount = 10000000; // 重置为默认值
    battleRoom.autoRestart = normalData.autoRestart;
    battleRoom.autoStartBattle = normalData.autoStartBattle;
    battleRoom.difficulty = normalData.difficulty;

    battleRoom.phantomUuidList = normalData.phantomUuidList ?? [];

    battleRoom.denseFogMode = normalData.denseFogMode;
    battleRoom.autoRestartDenseFogMode = normalData.autoRestartDenseFogMode;

    applyRoomBeginnerInfo(battleRoom);

    // 保存金币/战利品比例设置
    if (typeof normalData.lootGoldSlider === 'number') {
      battleRoom.lootGoldSlider = Math.max(0, Math.min(10, normalData.lootGoldSlider));
    }

    if (normalData.ownerId) {
      battleRoom.ownerId = normalData.ownerId;
    }

    battleRoom.disableDenseFogModeBecausePlayerLose = false;

    battleRoom.ironcat = await isIronCat(battleRoom.ownerId);

    battleRoom.publicBattleLoot = normalData.publicBattleLoot ?? true;

    if (normalData.autoWorldBossBattleConf !== undefined) {
      battleRoom.autoWorldBossBattleConf = normalData.autoWorldBossBattleConf;
    }

    // // @ts-ignore
    // delete battleRoom.worldBossId;
    // // @ts-ignore
    // delete battleRoom.worldBossVersion;

    await updateRoom(roomId, battleRoom);
    return battleRoom;
  }
}

/**
 * 通过房间ID获取战斗房间
 */
export async function getBattleRoomById(roomId: string): Promise<BattleRoom | undefined> {
  return getRoomById<BattleRoom>(roomId);
}

/**
 * 获取所有战斗房间
 */
export async function getAllBattleRooms(): Promise<BattleRoom[]> {
  let allRooms = await getAllRooms<BattleRoom>();
  allRooms.filter(room => room.type === "battle");

  // 按创建顺序倒序
  allRooms.sort((a, b) => b.createdAt - a.createdAt);
  return allRooms;
}

function weightedRandomPick(pool: { id: string; weight: number }[], count: number): string[] {
  const result: string[] = [];
  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
  for (let i = 0; i < count; i++) {
    let r = Math.random() * totalWeight;
    for (const entry of pool) {
      if (r < entry.weight) {
        result.push(entry.id);
        break;
      }
      r -= entry.weight;
    }
  }
  return result;
}

export const BATTLE_INFO_KEY = "BATTLE_INFO_";
export const getBattleInfoKey = (battleId: string): string => {
  return BATTLE_INFO_KEY + battleId;
};
export async function setBattleInfoToRedis(battleInfo: BattleInfo): Promise<void> {
  const key = getBattleInfoKey(battleInfo.uuid);
  let res = JSON.stringify(battleInfo)
  if (res) {
    await redisClient.set(key, res);
  }
}

// 从 Redis 读取 BattleInfo
export async function getBattleInfoFromRedis(battleId: string): Promise<BattleInfo | undefined> {
  const key = getBattleInfoKey(battleId);
  const data = await redisClient.get(key);
  if (!data) return;
  return JSON.parse(data) as BattleInfo;
}

export async function prepareRoomDataToBattle(battleRoomId: string): Promise<BattleRoom> {
  const battleRoom = await getBattleRoomById(battleRoomId);
  if (!battleRoom) throw new Error("战斗房间不存在");

  battleRoom.battleUuid = undefined;
  battleRoom.status = "go_to_area";

  // 15秒后
  battleRoom.arriveAreaTime = Date.now() + GO_TO_AREA_DURATION;
  battleRoom.waitingForAutoStartTime = undefined;
  battleRoom.waitingForRestartTime = undefined;

  // 清理记录的数据
  // 只有从房间重新触发战斗，才清空此状态
  battleRoom.disableDenseFogModeBecausePlayerLose = false;
  battleRoom.denseFogModeConflictEncounter = []

  return battleRoom
}

export async function removeBattleInfoFromRedis(battleId: string): Promise<void> {
  const key = getBattleInfoKey(battleId);
  await redisClient.del(key);
}

export async function dispatchBattleEndEventToRoomByRoomId(battleRoomId: string): Promise<void> {
  const battleRoom = await getBattleRoomById(battleRoomId);
  if (!battleRoom) {
    // 房间不存在，通知所有相关成员（如有成员列表可用）
    // 这里无法获取成员，只能跳过或记录日志
    return;
  }

  for (const userId of battleRoom.memberIds) {
    emitEventToUser(userId, "battle:end:success");
  }
}
export async function dispatchLatestBattleInfoToRoomByRoomId(battleRoomId: string): Promise<void> {
  const battleRoom = await getBattleRoomById(battleRoomId);
 
  return dispatchLatestBattleInfoToRoom(battleRoom)
}
export async function dispatchLatestBattleInfoToRoom(battleRoom?: BattleRoom): Promise<void> {
  if (!battleRoom) {
    // 房间不存在，通知所有相关成员（如有成员列表可用）
    // 这里无法获取成员，只能跳过或记录日志
    return;
  }

  if (!battleRoom.battleUuid) {
    for (const userId of battleRoom.memberIds) {
      emitEventToUser(userId, "battle:update:error", { message: "房间未开始战斗" });
    }
    return;
  }

  const battleInfo = await getBattleInfoFromRedis(battleRoom.battleUuid);
  if (!battleInfo) {
    for (const userId of battleRoom.memberIds) {
      emitEventToUser(userId, "battle:update:error", { message: "未找到战斗信息" });
    }
    return;
  }

  for (const userId of battleRoom.memberIds) {
    dispatchLatestBattleInfoToUser(userId, battleInfo);
  }
}
export async function dispatchLatestBattleInfoToUser(user: string, battleInfo: BattleInfo): Promise<void> {
  // 通知用户最新的战斗信息
  emitEventToUser(user, "battle:update:success", battleInfo);
}

export async function dispatchFullBattleInfoToRoom(room: Room, battleInfo: BattleInfo): Promise<void> {
  for (const userId of room.memberIds) {
    dispatchFullBattleInfoToUser(userId, battleInfo)
  }
}

export async function dispatchFullBattleInfoToUser(user: string, battleInfo: BattleInfo): Promise<void> {
  emitEventToUser(user, "battle:fullInfo:success", {
    battleInfo,
    // thisRoundAction: latestFullBattleAction
  });
}

/**
 * 获取当前单位所在分组ID
 */
function getUnitGroupId(groups: Record<string, string[]>, unitId: string): string | undefined {
  return Object.keys(groups).find(groupId => groups[groupId].includes(unitId));
}

/**
 * 获取敌方单位列表
 */
function getAliveEnemyUnits(battleInfo: BattleInfo, currentGroupId: string): BaseBattleUnit[] {
  const { groups, members } = battleInfo;
  const enemyGroupIds = Object.keys(groups).filter(id => id !== currentGroupId);
  const enemyIds = enemyGroupIds.flatMap(id => groups[id]);
  return members.filter(u => enemyIds.includes(u.uuid) && u.hp > 0);
}

/**
 * 获取己方单位列表
 */
function getAliveAllyUnits(battleInfo: BattleInfo, currentGroupId: string): BaseBattleUnit[] {
  const { groups, members } = battleInfo;
  const allyIds = groups[currentGroupId] ?? [];
  return members.filter(u => allyIds.includes(u.uuid) && u.hp > 0);
}
function getEnemyUnits(battleInfo: BattleInfo, currentGroupId: string): BaseBattleUnit[] {
  const { groups, members } = battleInfo;
  const enemyGroupIds = Object.keys(groups).filter(id => id !== currentGroupId);
  const enemyIds = enemyGroupIds.flatMap(id => groups[id]);
  return members.filter(u => enemyIds.includes(u.uuid));
}

/**
 * 获取己方单位列表
 */
function getAllyUnits(battleInfo: BattleInfo, currentGroupId: string): BaseBattleUnit[] {
  const { groups, members } = battleInfo;
  const allyIds = groups[currentGroupId] ?? [];
  return members.filter(u => allyIds.includes(u.uuid));
}

// function generateRandomAttackAction(
//   currentUnit: BaseBattleUnit,
//   target: BaseBattleUnit,
//   damage: number,
//   battleInfo: BattleInfo
// ): FullBattleAction {
//   return {
//     type: "attack",
//     targetType: "single_enemy",
//     damage,
//     heal: 0,
//     sourceUnitUuid: currentUnit.uuid,
//     targetUnitUuidList: [target.uuid],
//   };
// }

// function checkSkillCastLogic(
//   logicArr: GameBattleSkillCastLogic[] | undefined,
//   context: {
//     self: BaseBattleUnit,
//     allies: BaseBattleUnit[],
//     enemies: BaseBattleUnit[],
//     battleInfo: BattleInfo
//   }
// ): boolean {
//   if (!logicArr || logicArr.length === 0) return true;
//   return logicArr.every(logic => {
//     let targetUnits: BaseBattleUnit[] = [];
//     switch (logic.target) {
//       case "self":
//         targetUnits = [context.self];
//         break;
//       case "allies":
//         targetUnits = context.allies;
//         break;
//       case "enemies":
//         targetUnits = context.enemies;
//         break;
//       case "all":
//         targetUnits = [context.self, ...context.allies, ...context.enemies];
//         break;
//     }
//     if (targetUnits.length === 0) return false;

//     // 只要有一个目标满足条件即可
//     return targetUnits.some(unit => {
//       let value = 0;
//       switch (logic.dataType) {
//         case "hp":
//           value = unit.hp;
//           break;
//         case "mp":
//           value = unit.mp;
//           break;
//         case "lostHp":
//           value = unit.maxHp - unit.hp;
//           break;
//         case "lostMp":
//           value = unit.maxMp - unit.mp;
//           break;
//         case "count":
//           value = targetUnits.length;
//           break;
//       }
//       let cond = logic.conditionValue;
//       let compareValue: number;
//       if (typeof cond === "string" && cond.endsWith("%")) {
//         // 百分比
//         const percent = parseFloat(cond) / 100;
//         if (logic.dataType === "hp" || logic.dataType === "lostHp") {
//           compareValue = Math.round(unit.maxHp * percent);
//         } else if (logic.dataType === "mp" || logic.dataType === "lostMp") {
//           compareValue = Math.round(unit.maxMp * percent);
//         } else {
//           compareValue = percent * value;
//         }
//       } else {
//         compareValue = typeof cond === "number" ? cond : parseFloat(cond as string);
//       }

//       switch (logic.compareAction) {
//         case ">": return value > compareValue;
//         case ">=": return value >= compareValue;
//         case "<": return value < compareValue;
//         case "<=": return value <= compareValue;
//         case "=": return value === compareValue;
//         default: return false;
//       }
//     });
//   });
// }

/**
 * 处理一轮战斗逻辑（自动选择目标并造成伤害，可扩展技能/治疗）
 */
// export async function runBattleRound(battleInfo: BattleInfo): 
// Promise<{
//   battleInfo: BattleInfo,
//   thisRoundAction: FullBattleAction | undefined,
//   canPassTurn: Boolean
// }> {
//   const currentTurnIndex = battleInfo.currentTurnIndex;
//   const currentUnitId = battleInfo.turnOrder[currentTurnIndex];
//   const currentUnit = battleInfo.members.find(u => u.uuid === currentUnitId);

//   const playerGroupId = battleInfo.playerGroupId;

//   // 检查是否还有存活单位
//   const aliveUnitIds = battleInfo.turnOrder.filter(id => {
//     const unit = battleInfo.members.find(u => u.uuid === id);
//     return unit && unit.hp > 0;
//   });

//   if (!currentUnit || currentUnit.hp <= 0) {
//     // 如果没有存活单位，直接判定战斗结束，防止死循环
//     if (aliveUnitIds.length === 0) {
//       battleInfo.battleStatus = BattleStatus.PLAYER_LOSE;
//       await setBattleInfoToRedis(battleInfo);
//       return { battleInfo, thisRoundAction: undefined, canPassTurn: true };
//     }

//     gotoNextTurn(battleInfo);
//     // 递归调用，直到遇到存活单位或战斗结束
//     return await runBattleRound(battleInfo);
//   }

//   // 找到当前单位分组
//   const currentGroupId = getUnitGroupId(battleInfo.groups, currentUnitId);
//   if (!currentGroupId) {
//     gotoNextTurn(battleInfo);
//     await setBattleInfoToRedis(battleInfo);
//     return { battleInfo, thisRoundAction: undefined, canPassTurn: true  };
//   }

//   if (!getAliveEnemyUnits(battleInfo, playerGroupId).length) {
//     battleInfo.battleStatus = BattleStatus.PLAYER_WIN;

//     return { battleInfo, thisRoundAction: undefined, canPassTurn: true  };
//   }


//   if (!getAliveAllyUnits(battleInfo, playerGroupId).length) {
//     battleInfo.battleStatus = BattleStatus.PLAYER_LOSE;

//     return { battleInfo, thisRoundAction: undefined, canPassTurn: true  };
//   }

//   const allAllyUnit = getAllyUnits(battleInfo, currentGroupId);
//   const allEnemies = getEnemyUnits(battleInfo, currentGroupId);

//   const allyUnits = allAllyUnit.filter(u => u.hp > 0);
//   const enemyUnits = allEnemies.filter(u => u.hp > 0);


//   // 找到当前单位的所有状态
//   const stateInfo = currentUnit.state
//   if (stateInfo) {

//     // 检查沉默状态，禁止释放技能，只能普通攻击
//     if (stateInfo.silence && stateInfo.silence.remainingDuration > 0) {
//       // 只允许普通攻击
//       let actionResult = allGameBattleSkills.baseAttack.effect({
//         self: currentUnit,
//         allies: allyUnits,
//         enemies: enemyUnits,
//           allAllies: allAllyUnit,
//           allEnemies: allEnemies,
//         battleInfo
//       });

//       return { battleInfo, thisRoundAction: actionResult, canPassTurn: true  };
//     }

//     for (const stateId of ObjectKeys<AllBattleStateId>(stateInfo)) {
//       const thisState = stateInfo[stateId];
//       const stateData: BattleState = allBattleState[stateId];
//       if (!thisState) continue;
//       if (
//         thisState.remainingDuration > 0 &&
//         stateData.StateEffectTriggerWhen == StateEffectTriggerWhen.TURN_START &&
//         !thisState.triggered // 防止重复结算
//       ) {
//         thisState.triggered = true;
//         const actionResult = stateData.effect?.({
//           self: currentUnit,
//           allies: allyUnits,
//           enemies: enemyUnits,
//           battleInfo
//         });
//         if (actionResult) {
//           if (allBattleState[stateId].consumeTurn) {
//             await gotoNextTurn(battleInfo)
//             return { battleInfo, thisRoundAction: actionResult, canPassTurn: true };
//           }
//           return { battleInfo, thisRoundAction: actionResult, canPassTurn: false };
//         }
//       }
//     }
//   }

//   // 选择目标（默认选第一个存活敌人，可扩展AI/策略）
//   // 在这里，我们需要选择一个满足条件的技能，进行释放
//   // 找到第一个满足条件且没有cd的技能
//   let availableSkillId: AllBattleSkillId | undefined = ObjectKeys<AllBattleSkillId>(currentUnit.skills ?? {})
//     .filter(skillId => skillId !== 'baseAttack')
//     .map(skillId => ({
//       skillId,
//       order: currentUnit.skills?.[skillId]?.order ?? 0
//     }))
//     .sort((a, b) => a.order - b.order)
//     .map(item => item.skillId)
//     .find(skillId => {
//       const skillData = allGameBattleSkills[skillId];
//       if (!skillData) return false;
//       if ((currentUnit?.skillColddown?.[skillId] ?? 0) > 0) return false;

//       // 检查技能是否有mp消耗
//       if (skillData.mpCost && currentUnit.mp < skillData.mpCost) return false;

//       // 检查技能释放逻辑
//       const skillLogic = currentUnit.ai?.[skillId];
//       const canCastByLogic = checkSkillCastLogic(skillLogic, {
//         self: currentUnit,
//         allies: allyUnits,
//         enemies: enemyUnits,
//         battleInfo
//       });
//       // 检查 preCheck
//       // @ts-ignore
//       const canCastByPreCheck = skillData.preCheck ? skillData.preCheck({
//           self: currentUnit,
//           allies: allyUnits,
//           enemies: enemyUnits,
//           allAllies: allAllyUnit,
//           allEnemies: allEnemies,
//           battleInfo
//         })
//         : true;
//       return canCastByLogic && canCastByPreCheck;
//     });

//   // 没有任何技能，则使用普通攻击
//   if (!availableSkillId) {
//     availableSkillId = allGameBattleSkills.baseAttack.id;
//   }

//   let actionResult = allGameBattleSkills[availableSkillId].effect({
//     self: currentUnit,
//     allies: allyUnits,
//     enemies: enemyUnits,
//     allAllies: allAllyUnit,
//     allEnemies: allEnemies,
//     battleInfo,
//   });

//   // 如果技能不是攻击，提升对应技能的经验
//   if (availableSkillId != 'baseAttack') {
//     // 如果是玩家
//     if (currentUnit.isPlayer) {
//       increaseCharacterSkillExp(currentUnit.uuid, availableSkillId, 1);
//       increaseCharacterStatusExp(currentUnit.uuid, [{
//         status: 'intelligence',
//         increaseExp: INTELLIGENCE_EXP_PRE_CAST_SKILL
//       }])
//     }

//     // 释放技能后，扣除对应mp
//     // if (allGameBattleSkills[availableSkillId].mpCost) {
//     //     currentUnit.mp -= allGameBattleSkills[availableSkillId].mpCost;
//     //     currentUnit.mp = Math.max(currentUnit.mp, 0); // 确保不小于0
//     // }
//   }

//   // if (availableSkillId != 'baseAttack') {
//   //   const skillData = allGameBattleSkills[availableSkillId];
//   //   if (skillData.mpCost && currentUnit.mp >= skillData.mpCost) {
//   //     currentUnit.mp -= skillData.mpCost;
//   //   } else {
//   //     // 如果mp不足，使用普通攻击
//   //     availableSkillId = 'baseAttack';
//   //     actionResult = allGameBattleSkills.baseAttack.effect({
//   //       self: currentUnit,
//   //       allies: allyUnits,
//   //       enemies: enemyUnits,
//   //       allAllies: allAllyUnit,
//   //       allEnemies: allEnemies,
//   //       battleInfo
//   //     });
//   //   }
//   // }


//   // 触发普攻行为
//   if (availableSkillId == 'baseAttack') {
//     triggerEffect(currentUnit, battleInfo, BattleRoundStage.AFTER_SIMPLE_ATTACK, {
//       thisRoundInfo: actionResult
//     });
//   }
  
//   // 动作执行后，开始处理cd
//   // 自身回合结束后，降低所有技能1cd
//   if (!currentUnit.skillColddown) {
//     currentUnit.skillColddown = {}
//   }
//   ObjectKeys<AllBattleSkillId>(currentUnit.skillColddown).forEach(skillId => {
//     if (!currentUnit.skillColddown![skillId]) {
//       currentUnit.skillColddown![skillId] = 0
//     }

//     if (currentUnit.skillColddown![skillId] > 0) {
//       currentUnit.skillColddown![skillId] -= 1;
//     }

//     if (currentUnit.skillColddown![skillId] < 0) {
//       currentUnit.skillColddown![skillId] = 0; // 确保不小于0
//     }
//   })

//   // 被选择的技能，释放后cd变为最大值
//   currentUnit.skillColddown[availableSkillId] = allGameBattleSkills[availableSkillId].colddown;

//   // 可扩展：技能、治疗等

//   if (stateInfo) {
//     for (const stateId of ObjectKeys<AllBattleStateId>(stateInfo)) {
//       const thisState = stateInfo[stateId];
//       const stateData: BattleState = allBattleState[stateId];
//       if (!thisState) continue;
//       if (
//         thisState.remainingDuration > 0 &&
//         stateData.StateEffectTriggerWhen == StateEffectTriggerWhen.TURN_END &&
//         !thisState.triggered // 防止重复结算
//       ) {
//         thisState.triggered = true;
//         const actionResult = stateData.effect?.({
//           self: currentUnit,
//           allies: allyUnits,
//           enemies: enemyUnits,
//           battleInfo
//         });
//         if (actionResult) {
//           if (allBattleState[stateId].consumeTurn) {
//             await gotoNextTurn(battleInfo)
//             return { battleInfo, thisRoundAction: actionResult, canPassTurn: true };
//           }
//           return { battleInfo, thisRoundAction: actionResult, canPassTurn: false };
//         }
//       }
//     }
//   }

//   return { battleInfo, thisRoundAction: actionResult, canPassTurn: true };
// }

// export async function giveBattleReward(
//   battleRoom: BattleRoom,
//   battleInfo: BattleInfo
// ): Promise<void> {

//   const enemyGroupId = Object.keys(battleInfo.groups).find(
//     (id) => id !== battleInfo.playerGroupId
//   );
//   const enemyUuids: string[] = enemyGroupId
//     ? battleInfo.groups[enemyGroupId]
//     : [];
//   const enemyIds = enemyUuids
//     .map((uuid) => {
//       const enemy = battleInfo.members.find((u) => u.uuid === uuid);
//       return enemy?.id as AllGameEnemyID;
//     })
//     .filter((id) => id !== undefined);

//   const playerIds = battleInfo.groups[battleInfo.playerGroupId] || [];
//   if (playerIds.length === 0) return;

//   const playerMembers = battleInfo.members.filter(u => playerIds.includes(u.uuid) && u.isPlayer);

//   // 只派发给IP唯一的玩家
//   let uniquePlayerMembers = groupByIp(playerMembers)

//   // 每个玩家独立掉落和经验
//   for (const playerMember of uniquePlayerMembers.uniqueList) {
//     const playerUuid = playerMember.uuid;
//     let totalExpReward = 0;
//     const dropItems: ItemCountInfo = {};

//     for (const enemyId of enemyIds) {
//       const enemyData = allGameEnemies[enemyId];
//       let droplist = enemyData.drops;
//       if (droplist) {
//         droplist = allGameEnemies[enemyId].drops;
//       }
//       if (!droplist.length) continue;
//       for (const drop of enemyData.drops) {
//         // 按概率掉落（每个玩家独立判定）
//         if (randomNumberInFullColseRange(0, 1) < drop.percent) {
//           const count = randomIntegerInFullCloseRange(drop.range);
//           if (count > 0) {
//             if (!dropItems[drop.id]) {
//               dropItems[drop.id] = {
//                 count: 0
//               }
//             }
//             dropItems[drop.id]!.count += count
//           }
//         }
//       }
//       totalExpReward += enemyData.expReward || 0;
//     }

//     // 发放经验
//     increaseCharacterStatusExp(playerUuid, [
//       {
//         status: "battle",
//         increaseExp: totalExpReward
//       }
//     ]);

//     // 发放掉落
//     if (Object.keys(dropItems).length) {
//       increaseItemCount(playerUuid, dropItems, {
//         actionName: "战斗掉落奖励",
//         showModifyInfo: true
//       });

//       dispatchResourceIncreaseToClient(playerUuid, dropItems);
//       dispatchInventoryUpdatedEventToClient(playerUuid);
//     }
//   }
// }


export async function leaveBattle(userUuid: string, roomId: string): Promise<void> {
  // 1. 找到玩家所在的战斗房间
  const battleRoom = await getBattleRoomById(roomId);
  if (!battleRoom) throw new Error("未找到战斗房间");

  // 5. 处理 BattleInfo（自动从 Redis 获取并处理）
  if (battleRoom.battleUuid) {
    const battleInfo = await getBattleInfoFromRedis(battleRoom.battleUuid);
    if (battleInfo) {
      // 5.1 从成员列表移除该玩家
      battleInfo.members = battleInfo.members.filter(u => u.uuid !== userUuid);

      // 5.2 从分组中移除
      Object.keys(battleInfo.groups).forEach(groupId => {
        battleInfo.groups[groupId] = battleInfo.groups[groupId].filter(id => id !== userUuid);
      });

      // 5.3 从回合顺序中移除
      battleInfo.turnOrder = battleInfo.turnOrder.filter(id => id !== userUuid);

      // 5.4 如果当前回合单位被移除，重置 currentTurnIndex
      if (battleInfo.currentTurnIndex >= battleInfo.turnOrder.length) {
        battleInfo.currentTurnIndex = 0;
      }

      // 5.5 如果玩家组没人了，直接删除
      const playerGroup = battleInfo.groups[battleInfo.playerGroupId] || [];

      // 如果玩家组没有玩家，则删除战斗
      if (playerGroup.length === 0) {
        await removeBattleInfoFromRedis(battleInfo.uuid);
        return
      }

      let hasPlayer = playerGroup.some(uuid => {
        let member = battleInfo.members.find(u => u.uuid === uuid);
        return member && member.isPlayer;
      })
      if (!hasPlayer) {
        // 如果玩家组没有玩家，则删除战斗
        await removeBattleInfoFromRedis(battleInfo.uuid);
        return;
      }

      // 5.6 更新 BattleInfo
      await setBattleInfoToRedis(battleInfo);
    }
  }
}
// ...existing code...

export async function checkAndConsumeDenseFogResources(room: BattleRoom) {
  if (room.battleType === "worldBoss") {
    return true;
  }
  if (!room.denseFogMode) {
    return true;
  }

  let areaId = room.area;
  let battleArea = allBattleAreas[areaId] as BattleArea;
  if (!battleArea) {
    throw new Error("未找到战斗区域");
  }

  if (!battleArea.denseFogModeRequireResource || !Object.keys(battleArea.denseFogModeRequireResource).length) {
    throw new Error("未找到迷雾区域资源");
  }

  let owner = room.ownerId;

  let actualUsedResource: ItemCountInfo = {}
  for(const itemId of ObjectKeysTyped(battleArea.denseFogModeRequireResource)) {
    let count = battleArea.denseFogModeRequireResource[itemId];
    if (!count || !count.count) {
      continue;
    }

    let thisItemCount = await getItemCount(owner, itemId)
    if (thisItemCount < count.count) {
      throw new Error(`进入副本失败：房主缺少进入迷雾所需的资源 - ${allGameResource[itemId].name}`);
    }

    actualUsedResource[itemId] = count
  }

  await decreaseItemCount(owner, actualUsedResource, {
    actionName: `进入${battleArea.name}的迷雾`,
    type: ModifyItemCountType.Other,
    showModifyInfo: true
  })
  dispatchInventoryModify(owner, convertItemCountInfoToDecrease(actualUsedResource))

  return true;
}

export async function checkAndConsumeResourcesToEnterArea(room: BattleRoom) {
  if (room.battleType === "worldBoss") {
    return true;
  }
  let areaId = room.area;
  let battleArea = allBattleAreas[areaId] as BattleArea;
  if (!battleArea) {
    throw new Error("未找到战斗区域");
  }

  const requireResourceToEnter = battleArea.requireResourceToEnter ?? {};

  if (!Object.keys(requireResourceToEnter).length) {
    return true;
  }

  let owner = room.ownerId;

  let actualUsedResource: ItemCountInfo = {}
  for(const itemId of ObjectKeysTyped(requireResourceToEnter)) {
    let count = requireResourceToEnter[itemId];
    if (!count || !count.count) {
      continue;
    }

    let thisItemCount = await getItemCount(owner, itemId)
    if (thisItemCount < count.count) {
      throw new Error(`进入副本失败：房主缺少进入区域所需的资源 - ${allGameResource[itemId].name}`);
    }

    actualUsedResource[itemId] = count
  }

  await decreaseItemCount(owner, actualUsedResource, {
    actionName: `进入${battleArea.name}`,
    type: ModifyItemCountType.Other,
    showModifyInfo: true,
    sendModifyEvent: true,
  })

  return true;
}

export async function getBattleRoomByUserId(userUuid: string): Promise<BattleRoom | undefined> {
  const userRoomUuid = await getUserRoomUuid(userUuid);
  if (!userRoomUuid) {
    return undefined;
  }
  const room = await getRoomById<BattleRoom>(userRoomUuid);

  if (room) {
    applyRoomBeginnerInfo(room)
  }

  return room;
}
export async function isUserInBattle(userUuid: string): Promise<boolean> {
  const room = await getBattleRoomByUserId(userUuid);
  // Consider user in battle if room exists and either the status indicates battling
  // or a battle UUID is present. This is more robust against races where status
  // may not yet have been flipped but a battle has begun.
  return !!room && (room.status === 'battling' || !!room.battleUuid);
}

export async function applyRoomBeginnerInfo(battleRoom: BattleRoom): Promise<void> {
  if (!battleRoom.memberIds?.length) {
    battleRoom.battleLevelDesyncPlayerUuidList = [];
    return;
  }

  if (battleRoom.ironcat) {
    battleRoom.battleLevelDesyncPlayerUuidList = [];
    return;
  }

  if (battleRoom.battleType !== "normal") {
    battleRoom.battleLevelDesyncPlayerUuidList = [];
    return;
  }

  const levelEntries = await Promise.all(
    battleRoom.memberIds.map(async (memberUuid) => {
      try {
        const status = await getCharacterStatusInfo(memberUuid);
        const level = Math.floor(status?.battle?.level ?? 0);
        return { memberUuid, level };
      } catch (e) {
        return { memberUuid, level: 0 };
      }
    })
  );

  const validLevels = levelEntries.filter((e) => Number.isFinite(e.level));
  if (!validLevels.length) {
    battleRoom.battleLevelDesyncPlayerUuidList = [];
    return;
  }

  const maxLevel = Math.max(...validLevels.map((e) => e.level));

  const desyncList = validLevels
    .filter(({ level }) => {
      if (level >= 90) return false; // 不处理高等级玩家

      const delta = Math.max(0, maxLevel - level);
      const multiplier = Math.max(0.1, Math.exp(-delta / 15));
      return multiplier < 1;
    })
    .map(({ memberUuid }) => memberUuid)
    .filter((uuid, idx, arr) => arr.indexOf(uuid) === idx);

  battleRoom.battleLevelDesyncPlayerUuidList = desyncList;
}