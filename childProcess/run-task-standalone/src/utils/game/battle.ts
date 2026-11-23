import type { BattleRoom, NormalBattleRoom, WorldBossBattleRoom } from "@/shared/types/battleRoom";
import { getRoomById, getAllRooms, getRoomKey, updateRoom } from "./room";
import { getPlayerGlobalState } from "./character";
import { type BaseBattleUnit, type UnitExpRewardInSingleBattle, type UnitStatisticInfoInSingleBattle } from "~/shared/types/unit";
import { convertCharacterToUnit, getAndUpdateCharacterUnitInfo } from "./characterUnit";
import { generateEnemyById, generateUnitById } from "./enemy";
import { type AllGameEnemyID, type AllUnitID, type Enemy, type ItemDrop } from "~/shared/types/emeny";
import { AllBattlePhase, BattleRoundStage, BattleStatus, HpRestoreReason, MpLossReason, MpRestoreReason, type BattleArea, type BattleCallback, type BattleInfo, type BattlePassTurnReason, type DealDamageTargetDetail, type EnemyPoolEntry, type EquipmentTriggerInfo, type EquipmentTriggerParam, type FullBattleAction, type SimpleFloatTextActionCallback } from "~/shared/types/battle";
import { v4 as uuidv4, v7 } from "uuid";
import { allBattleAreas } from "~/shared/data/allBattleInfo";
import { allGameEnemies } from "~/shared/data/allGameEnemy";
import { clone, delay, groupByIp, ObjectKeys, ObjectKeysTyped, randomElementInCollection, randomElementsInCollection, randomIntegerInFullCloseRange, randomNumberInFullColseRange, safeJsonParse } from "~/shared/utils";
import { increaseItemCount, dispatchInventoryModify, getItemCount, getItemInfoPreferCache, decreaseItemCount, batchIncreaseItemCount } from "./characterInventory";
import { ModifyItemCountType, type ItemCountInfo, } from "~/shared/types/gameInventory";
import { getCharacterStatusInfo, increaseCharacterStatusExp } from "./characterStatus";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";
import { DamageType, GameBattleLogicDataType, GameBattleLogicSpecialAction, GameBattleLogicStateCompareAction, GameBattleLogicTarget, GameBattleLogicUnitExistStateCompareAction, GameBattleLogicValueCompareAction, type AllBattleSkillId, type GameBattleLogic, type GameBattleSkill } from "~/shared/types/skill";
import { batchIncreaseCharacterSkillExp, increaseCharacterSkillExp } from "./characterSkill";
import { StateEffectTriggerWhen, type AllBattleStateId, type BattleState } from "~/shared/types/BattleState";
import { allBattleState, detachState, getStateExtraStack, } from "~/shared/data/allBattleState";
import type { Room } from "~/shared/types/room";
import { ATTACK_EXP_PER_DEAL_DAMAGE, BATTLE_EXPERIENCE_DROP_PERCENT, BATTLE_ROOM_DIFFICULTY_LEVELS_INFO, DAMAGE_EXP_SHARE_PERCENT, DEFENCE_EXP_PER_DEAL_DAMAGE, DENSE_FOG_MODE_BASELINE_STATUS, DENSE_FOG_MODE_ENEMY_LEVEL_EXP_MULTIPLE, DEX_EXP_PER_DEAL_DAMAGE, DEX_EXP_PER_TAKE_DAMAGE, EXTRA_DROP_PERCENT_PER_LUCK, GO_TO_AREA_DURATION, HP_REGEN_PER_TURN_PRE_STAMINA, INTELLIGENCE_EXP_PRE_CAST_SKILL, LAST_BATTLE_AREA_ID, LOOT_GOLD_DROP_MULTIPLIER_PER_SLIDER, MP_REGEN_PER_TURN_PRE_INTELLIGENCE, SOMMONER_DAMAGE_EXP_SHARE_PERCENT, STAMINA_EXP_PER_TAKE_DAMAGE, STRENGTH_EXP_PER_DEAL_DAMAGE } from "~/shared/data/constant";
import { CharacterEquipmentPart, type AllBaseCharacterStatusType, type AllCharacterStatusType, type CharacterStatusDetail, type CharacterStatusImprove, type CharacterStatusInfo } from "~/shared/types/characterInfo";
import { allEquipmentTriggerData } from "~/server/data/allEquipmentTriggerData";
import { enqueueToHarvestBox } from "./harvestBox";
import { pushMessageToQueue } from "./msgQueue";

import { redisClient } from '../redis'
import { castSkill, checkCanLossMp, healUnit, isEnemy, iteratorUnitEquipment, lossMp, restoreMp, iteratorUnitState, iteratorUnitStateAsync, addState, iteratorUnitEquipmentAsync, reduceUnitSkillColddown, iteratorUnitSkillNode, iteratorUnitSkillNodeAsync, unitHasHook, invalidateUnitHookCache, hasStateCauseForbidCastSkill, iteratorAllOfferingAsync, } from "~/server/utils/game/battleAction";
import { getMultiUserTalentCats, getUserWorkingTalentCats } from "./tarven";
import { HarvestBoxSource, type Tavern } from "~/generated/prisma";
import { prisma } from "../prisma"
import { recordUnitKill } from "./codex"
import { getUserEquipment } from "./equipment";
import { hasEquipment } from "~/shared/utils/game/equipment";
import { getAllEnemyIdInBattleArea, getAvailableUnitCollection, getBaseInfoFromBattleInfo, } from "~/shared/utils/game/battle";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import { useBattleInventoryItem } from "./battleInventory";
import { allGameResource, allGameResourceWithInternal } from "~/shared/data/allGameResources";
import { allBattleRoomOffering } from "~/shared/data/allBattleRoomOffering";
import { allResourceTriggerData } from "~/server/data/allResourceTriggerData";
import { findUnitInBattle, getAliveAllyUnits, getAliveEnemyUnits, getAllUnit, getAllyUnits, getEnemyUnits, getInfoFromBattleInfo, getUnitGroupId, hasState, } from "~/shared/utils/game/battle";
import { convertItemCountInfoToDecrease } from "~/shared/utils/game/requirementCheck";
import { allBattleSkillTreeNodesMap, allSkillTreeNodeMap } from "~/shared/data/skillTrees";
import { createTimingProbe } from "./timing";

import {getGameVillageBuildingEffectOnBattle, } from "./village/building"
import { memoryCache } from "../memoryCache"
import type { BattleRoomOfferingEffect, BattleRoomOfferingEffectResult } from "~/shared/types/battleRoomOffering";
import { getGlobalBossState, initializeGlobalBossState, updateGlobalBossStatus, getWorldBossConfigById } from "./worldBoss";
import type { WorldBossBattleConfig, WorldBossGlobalState } from "~/shared/types/worldBoss";

const toVoidPromise = (task?: void | Promise<void>): Promise<void> => Promise.resolve(task).then(() => undefined);
// 复用的临时缓冲，按 battleInfo 维度隔离，避免并行战斗相互污染
type BattleScratch = { unitMap: Map<string, BaseBattleUnit> };
const __battleScratchMap = new WeakMap<BattleInfo, BattleScratch>();
const getBattleScratch = (battleInfo: BattleInfo): BattleScratch => {
  let s = __battleScratchMap.get(battleInfo);
  if (!s) {
    s = { unitMap: new Map<string, BaseBattleUnit>() };
    __battleScratchMap.set(battleInfo, s);
  }
  return s;
};

// 战斗契约：递减回合并消耗计数
const tickBattleRoomOfferings = (battleRoom: BattleRoom): boolean => {
  if (!battleRoom.offerings?.length) return false;

  let changed = false;

  let i = 0;

  let emptyOfferingIndexs: number[] = [];
  for (const stack of battleRoom.offerings) {
    const spec = allBattleRoomOffering[stack.specId];
    if (!spec) continue;

    if (spec.disableInNormalBattle && battleRoom.battleType === 'normal') {
      continue;
    }

    if (spec.disableInWorldBossBattle && battleRoom.battleType === 'worldBoss') {
      continue;
    }

    const turnsInterval = Math.max(1, spec.consume?.turns ?? 1);
    const consumeAmount = Math.max(0, spec.consume?.amount ?? 0);

    stack.consumedCount = stack.consumedCount ?? 0;
    stack.nextConsumeInTurns = stack.nextConsumeInTurns ?? 0;

    // 没堆叠可用则仅保持计数，不再递减
    if (stack.count <= 0 && consumeAmount <= 0) {
      continue;
    }

    // 到点消耗
    if (stack.nextConsumeInTurns <= 0) {
      if (consumeAmount > 0 && stack.count > 0) {
        const used = Math.min(stack.count, consumeAmount);
        stack.count -= used;
        stack.consumedCount += used;
        changed = true;
        stack.nextConsumeInTurns = turnsInterval;
      }
    } else {
      stack.nextConsumeInTurns = Math.max(0, stack.nextConsumeInTurns - 1);
      changed = true;
    }

    // 清理无效数据
    if (stack.count <= 0 && stack.nextConsumeInTurns <= 0) {
      stack.nextConsumeInTurns = 0;
      stack.consumedCount = 0;
      emptyOfferingIndexs.push(i);

      changed = true;
    }
    i++;
  }

  // 清理空的契约堆叠
  for (let j = emptyOfferingIndexs.length - 1; j >= 0; j--) {
    const index = emptyOfferingIndexs[j];
    battleRoom.offerings.splice(index, 1);
  }

  return changed;
};

/**
 * 通过房间ID获取战斗房间
 */
export async function getBattleRoomById(roomId: string): Promise<BattleRoom | undefined> {
  return getRoomById<BattleRoom>(roomId);
}

export async function getNormalBattleRoomById(roomId: string): Promise<NormalBattleRoom | undefined> {
  return getRoomById<NormalBattleRoom>(roomId);
}

// Helper: 清理单个 unit 的触发标记与临时字段
function clearTriggerMarks(unit: BaseBattleUnit) {
  if (!unit.triggerMark) {
    unit.triggerMark = {};
  }
  unit.triggerMark.oncePreBattle = {};
  unit.triggerMark.eachSelfTurn = {};
  unit.triggerMark.timesPerBattle = {};
  unit.triggerMark.cleanWhenBattleStart = {};

  // 临时字段也统一初始化，确保一致性
  unit.tmpOncePreBattleExtraTurnIndexList = [];
}

/**
 * 获取所有战斗房间
 */
export async function getAllBattleRooms(): Promise<BattleRoom[]> {
  let allRooms = await getAllRooms<BattleRoom>();
  allRooms = allRooms.filter(room => room.type === "battle");

  // 按创建顺序倒序
  allRooms.sort((a, b) => b.createdAt - a.createdAt);
  return allRooms;
}

export async function getAllNormalBattleRooms(): Promise<NormalBattleRoom[]> {
  let allRooms = await getAllRooms<NormalBattleRoom>();
  allRooms = allRooms.filter(room => room.type === "battle" && room.battleType == 'normal');

  // 按创建顺序倒序
  allRooms.sort((a, b) => b.createdAt - a.createdAt);
  return allRooms;
}

/**
 * 获取所有开启了 denseFogMode 的普通房间（内存缓存 10 分钟）
 */
export async function getAllDenseFogRooms(): Promise<NormalBattleRoom[]> {
  const CACHE_KEY = 'battle:all_dense_fog_rooms';
  const TTL_MS = 10 * 60 * 1000; // 10 minutes

  const cached = memoryCache.get<NormalBattleRoom[]>(CACHE_KEY);
  if (cached) return cached;

  const allRooms = await getAllNormalBattleRooms();
  const denseRooms = allRooms.filter(r => !!r.denseFogMode);
  memoryCache.set<NormalBattleRoom[]>(CACHE_KEY, denseRooms, TTL_MS);
  return denseRooms;
}

export async function generatePlayerGroupUnit(room: BattleRoom, playerIds: string[], prevBattleState?: BattleInfo) {
  const playerUnits: BaseBattleUnit[] = [];

  // 如果有上一场的战斗状态，则直接沿用上一场的数据
  if (prevBattleState) {
    // 继承玩家状态
    for (let unit of prevBattleState.members) {
      if (playerIds.includes(unit.uuid)) {
        playerUnits.push(unit);
      }

      if (unit.keepWhenNewTurn) {
        // 雇佣兵的单独逻辑，只有玩家数为1时，才能携带进下一场战斗
        if (unit.id.startsWith('b_mercenary')) {
          if (playerIds.length == 1) {
            playerUnits.push(unit);
          }
        } else {
          let unitGroup = getUnitGroupId(prevBattleState.groups, unit.uuid);

          if (unitGroup == prevBattleState.playerGroupId) {
            if (unit.isPlayer) {
              unit.isPlayerUnit = true;
            }
            playerUnits.push(unit);
          }
        }
      }
    }
  } else {
    // 轻量缓存：短TTL复用玩家单位装配，降低连场作战重复I/O
    const TTL_MS = 2000;
    for (const pid of playerIds) {
      const cacheKey = `battle:unit:${pid}`;
      let unit = memoryCache.get<BaseBattleUnit>(cacheKey);
      if (!unit) {
        unit = await getAndUpdateCharacterUnitInfo(pid);
        if (unit) memoryCache.set<BaseBattleUnit>(cacheKey, unit, TTL_MS);
      }

      if (unit.skills.baseAttack && typeof unit.skills.baseAttack.order != 'number') {
        // unit.skills.baseAttack.order = 9999
      }
      if (unit) playerUnits.push(unit);
    }

    // 检查是否存在雇佣兵
    if (playerIds.length == 1) {
      for (const playerId of playerIds) {
        let playerTarvenState = await getUserWorkingTalentCats(playerId)
        if (playerTarvenState.find(tarven => tarven.type === "baseMercenary")) {
          // 如果存在雇佣兵，在战斗中加入雇佣兵

          let memcenaryUnitIdList: AllUnitID[] = [
            "b_mercenary_tank",
            "b_mercenary_pastor",
            "b_mercenary_magician",
          ];

          let playerState = await getPlayerGlobalState(playerId)
          if (playerState.battle.stateWhenStartEachBattle?.find(state => state.id === 'beginnerBattleBless')) {
            memcenaryUnitIdList = [
              "b_mercenary_tank_bb",
              "b_mercenary_pastor_bb",
              "b_mercenary_magician_bb",
            ]
          }

          for(const mercenaryUnitId of memcenaryUnitIdList) {
            const mercenary = generateUnitById(mercenaryUnitId)

            if (mercenary) {
              playerUnits.push(mercenary)
            }
          }
        }
      }
    }
  }

  return playerUnits;
}

export function generateEnemyUnitByIds(room: NormalBattleRoom, enemyIds: AllGameEnemyID[]) {
  const enemyUnits: BaseBattleUnit[] = [];

  // 获取敌人单位
  for (const eid of enemyIds) {
    const enemy = generateEnemyById(eid);
    if (enemy) {
      delete enemy.drops
      delete enemy.description

      // 迷雾模式，额外补正基础属性
      if (room.denseFogMode) {
          // 确保属性至少达到 baseline（增加：baseline - 当前，若为负则不增加）
          enemy.maxHp += Math.max(1, DENSE_FOG_MODE_BASELINE_STATUS.hp - enemy.maxHp);
          enemy.hp += Math.max(1, DENSE_FOG_MODE_BASELINE_STATUS.hp - enemy.hp);

          enemy.maxMp += Math.max(1, DENSE_FOG_MODE_BASELINE_STATUS.mp - enemy.maxMp);
          enemy.mp += Math.max(1, DENSE_FOG_MODE_BASELINE_STATUS.mp - enemy.mp);

          enemy.status.attacking.level += Math.max(0, DENSE_FOG_MODE_BASELINE_STATUS.attack - enemy.status.attacking.level);
          enemy.status.defencing.level += Math.max(0, DENSE_FOG_MODE_BASELINE_STATUS.defense - enemy.status.defencing.level);

          enemy.status.strength.level += Math.max(0, DENSE_FOG_MODE_BASELINE_STATUS.strength - enemy.status.strength.level);
          enemy.status.dexterity.level += Math.max(0, DENSE_FOG_MODE_BASELINE_STATUS.dexterity - enemy.status.dexterity.level);
          enemy.status.intelligence.level += Math.max(0, DENSE_FOG_MODE_BASELINE_STATUS.intelligence - enemy.status.intelligence.level);
          enemy.status.stamina.level += Math.max(0, DENSE_FOG_MODE_BASELINE_STATUS.stamina - enemy.status.stamina.level);


          // 加入随机修正
          let randomFactor = Math.random() * 0.15 + 0.90; // 生成一个 0.95 到 1.05 之间的随机数

          enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * randomFactor));
          enemy.hp = Math.max(1, Math.min(enemy.maxHp, Math.round(enemy.hp * randomFactor)));
          enemy.maxMp = Math.max(1, Math.round(enemy.maxMp * randomFactor));
          enemy.mp = Math.max(1, Math.min(enemy.maxMp, Math.round(enemy.mp * randomFactor)));

          enemy.status.attacking.level = Math.max(0, Math.floor((enemy.status.attacking.level ?? 0) * randomFactor));
          enemy.status.defencing.level = Math.max(0, Math.floor((enemy.status.defencing.level ?? 0) * randomFactor));
          enemy.status.strength.level = Math.max(0, Math.floor((enemy.status.strength.level ?? 0) * randomFactor));
          enemy.status.dexterity.level = Math.max(0, Math.floor((enemy.status.dexterity.level ?? 0) * randomFactor));
          enemy.status.intelligence.level = Math.max(0, Math.floor((enemy.status.intelligence.level ?? 0) * randomFactor));
          enemy.status.stamina.level = Math.max(0, Math.floor((enemy.status.stamina.level ?? 0) * randomFactor));
      }

      // 根据难度等级，补正敌人属性
      if (!!room.difficulty && room.difficulty > 0) {

        let difficultyInfo = BATTLE_ROOM_DIFFICULTY_LEVELS_INFO[room.difficulty - 1]
        if (!difficultyInfo) {
          continue;
        }

        enemy.hp = Math.ceil(enemy.hp * (1 + difficultyInfo.hpPercent)) + difficultyInfo.hpBase
        enemy.maxHp = Math.ceil(enemy.maxHp * (1 + difficultyInfo.hpPercent)) + difficultyInfo.hpBase

        // enemy.attack = Math.ceil(enemy.attack * (1 + difficultyInfo.attackPercent)) + difficultyInfo.attackBase
        // enemy.defense = Math.ceil(enemy.defense * (1 + difficultyInfo.defensePercent)) + difficultyInfo.defenseBase

        enemy.status.attacking.level = Math.ceil(enemy.status.attacking.level * (1 + difficultyInfo.attackPercent)) + difficultyInfo.attackBase
        enemy.status.defencing.level = Math.ceil(enemy.status.defencing.level * (1 + difficultyInfo.defensePercent)) + difficultyInfo.defenseBase
      }

      enemy.isEnvironmentUnit = true;

      enemyUnits.push(enemy);
    }
  }

  return enemyUnits;
}

type InitBattleInfoOption = {
  extraPlayerGroupUnit?: BaseBattleUnit[]
  extraEnemyGroupUnit?: BaseBattleUnit[]
}
export async function initBattleInfo_PVE(playerIds: string[], enemyIds: AllGameEnemyID[], room: NormalBattleRoom, prevBattleState?: BattleInfo, opt?: InitBattleInfoOption): Promise<BattleInfo> {
  // 获取玩家单位
  const playerUnits = await generatePlayerGroupUnit(room, playerIds, prevBattleState);
  const enemyUnits = generateEnemyUnitByIds(room, enemyIds);

  if (opt?.extraPlayerGroupUnit) {
    playerUnits.push(...opt.extraPlayerGroupUnit);
  }

  if (opt?.extraEnemyGroupUnit) {
    enemyUnits.push(...opt.extraEnemyGroupUnit);
  }

  return prepareBattleInfoData(playerUnits, enemyUnits, room, prevBattleState);
}

export async function initBattleInfo_PVP_DenseFogMode(playerIds: string[], enemyIds: string[], room: NormalBattleRoom, prevBattleState?: BattleInfo, opt?: InitBattleInfoOption): Promise<BattleInfo> {
  const enemyPlayerUnits: BaseBattleUnit[] = []

  for(const enemyPlayerUuid of enemyIds) {
    const enemyPlayerUnit = await convertCharacterToUnit(enemyPlayerUuid);

    if (enemyPlayerUnit) {
      enemyPlayerUnits.push(enemyPlayerUnit)
    }
  }

  const enemyUnits = enemyPlayerUnits;

  return initBattleInfo_PVP_withEnemyUnit_DenseFogMode(playerIds, enemyUnits, room, prevBattleState, opt);
}

export async function initBattleInfo_PVP_withEnemyUnit_DenseFogMode(playerIds: string[], pEnemyPlayerUnits: BaseBattleUnit[], room: NormalBattleRoom, prevBattleState?: BattleInfo, opt?: InitBattleInfoOption): Promise<BattleInfo> {
  // 获取玩家单位
  const playerUnits = await generatePlayerGroupUnit(room, playerIds, prevBattleState);
  const enemyPlayerUnits: BaseBattleUnit[] = []

  for(const enemyPlayerUuid of pEnemyPlayerUnits) {
    const enemyPlayerUnit = clone(enemyPlayerUuid) as Enemy

    if (enemyPlayerUnit) {
      // 根据生成前是否为玩家，来决定此单位是否是玩家
      if (enemyPlayerUnit.isPlayer) {
        enemyPlayerUnit.isPlayerUnit = true
      } else {
        enemyPlayerUnit.isPlayerUnit = false
      }

      // 生成的玩家单位 不算作玩家
      enemyPlayerUnit.isPlayer = false
      enemyPlayerUnit.canGetDropReward = false
      enemyPlayerUnit.canGetExpReward = false
      enemyPlayerUnit.canUseItem = true

      // 生成的玩家单位 是环境单位
      enemyPlayerUnit.isEnvironmentUnit = true

      enemyPlayerUnit.name += '的幻象';

      // 迷雾幻象添加“虚像”debuff，造成的伤害降低30%
      if (!enemyPlayerUnit.state) {
        enemyPlayerUnit.state = {};
      }
      enemyPlayerUnit.state["denseFogPhantom"] = {
        id: "denseFogPhantom",
        duration: 9999,
        remainingDuration: 9999,
        addBy: "",
        triggered: false
      };

      // 移除所有永久buff
      for(const stateId in enemyPlayerUnit.state) {
        const stateSpec = allBattleState[stateId as AllBattleStateId] as BattleState;
        if (stateSpec && (stateSpec.isPactState)) { // stateSpec.permanent || 
          delete enemyPlayerUnit.state[stateId as AllBattleStateId];
        }
      }

      // 为迷雾模式状态下的玩家幻象单位，添加单独的掉落
      enemyPlayerUnit.drops = [
        {
          id: "denseFogDust",
          percent: 0.2,
          range: {
            min: 1,
            max: 1,
          },
        },
        {
          id: "denseFogMurkyCrystal",
          percent: 0.2,
          range: {
            min: 1,
            max: 1,
          },
        },
      ];

      enemyPlayerUnits.push(enemyPlayerUnit)
    }
  }

  const enemyUnits = enemyPlayerUnits;

  if (opt?.extraPlayerGroupUnit) {
    playerUnits.push(...opt.extraPlayerGroupUnit);
  }

  if (opt?.extraEnemyGroupUnit) {
    enemyUnits.push(...opt.extraEnemyGroupUnit);
  }

  return prepareBattleInfoData(playerUnits, enemyUnits, room, prevBattleState);
}

async function prepareBattleInfoData(playerGroupUnit: BaseBattleUnit[], enemyGroupUnit: BaseBattleUnit[], room: NormalBattleRoom, prevBattleState?: BattleInfo): Promise<BattleInfo> {
  const playerUnits = playerGroupUnit;
  const enemyUnits = enemyGroupUnit;

  // 临时处理：为所有玩家添加标记
  for(const playerUnit of playerUnits) {
    if (playerUnit.isPlayer) {
      playerUnit.canGetDropReward = true;
      playerUnit.canGetExpReward = true;
      playerUnit.canUseItem = true;
    }
  }

  let unitList: BaseBattleUnit[] = [];
  unitList = [...playerUnits, ...enemyUnits];

  // 预计算敏捷排序索引，避免重复sort
  const sortedIndices = unitList
    .map((_, index) => index)
    .sort((a, b) => (unitList[b].status.dexterity.level ?? 0) - (unitList[a].status.dexterity.level ?? 0));

  const sorted = sortedIndices.map(i => unitList[i]);

  const battleUuid = v7();

  // 分组，假设玩家为一组，敌人为一组
  const playerGroup = playerUnits.map(u => u.uuid);
  const enemyGroup = enemyUnits.map(u => u.uuid);
  const groups: Record<string, string[]> = {
    "player": playerGroup,
    "enemy": enemyGroup,
  }

  for(const player of playerUnits) {
    player.tmpShield = 0
  }

  // 取玩家组第一个单位id作为playerGroupId
  const playerGroupId = "player"

  let extraTurnOnBattleBegin: string[] = []
  if (prevBattleState) {
    // 找到member中tbi.acted为false的单位，作为备战单位
    const callbacks = generateCallback(prevBattleState, {})

    for(const unit of unitList) {
      if (!unit.tbi?.acted && !unit.ignoreTurn && !unit.isSummoned) {
        // 所有!tbi.acted的单位，状态持续时间-1
        iteratorUnitState(unit, ({ stateInfo, stateInBattle: state }) => {
          if (!stateInfo.permanent) {
            const stateId = stateInfo.id as AllBattleStateId;
            state.remainingDuration -= 1;
            if (state.remainingDuration <= 0) {
              detachState(stateId, unit, prevBattleState, {
                callbacks: callbacks,
                invalidateUnitHookCache,
              });
            }
          }
        });

        // ' - 技能的冷却时间 -1',
        if (!unit.skillColddown) {
          unit.skillColddown = {};
        }
        if (!hasState(unit, "skillSeal")) {
          reduceUnitSkillColddown(unit);
        }

        // 物品冷却
        // ' - 战斗物品袋中食物的冷却时间 -1',
        for(const itemId in unit.inventory ?? {}) {
          let inventoryItem = unit.inventory?.[itemId];
          if (!inventoryItem) continue;

          if (!inventoryItem.cooldown) {
            inventoryItem.cooldown = 0; // 确保有初始值
            continue;
          }

          inventoryItem.cooldown -= 1;
          if (inventoryItem.cooldown < 0) {
            inventoryItem.cooldown = 0; // 确保不小于0
          }
        }
      }
    }

    if (prevBattleState.currentTurnIndex > 0) {
      const unacted = unitList.filter(unit => {
        return !unit.tbi?.acted && unit.hp > 0 && !unit.ignoreTurn && !unit.isSummoned;
      })

      extraTurnOnBattleBegin = unacted.map(unit => unit.uuid);

      // 过滤掉已阵亡单位的备战
      // 去除穿戴了passExtraTurnOnBattleBegin装备的单位
      extraTurnOnBattleBegin = extraTurnOnBattleBegin.filter((unitUuid) => {
        let member = prevBattleState.members.find((m) => m.uuid === unitUuid);
        if (!member) return false;
        if (member.hp <= 0) return false;

        for(const part in member.equipment ?? {}) {
          let equipmentId = member.equipment?.[part as CharacterEquipmentPart]
          if (!equipmentId) {
            continue;
          }

          let equipment = allGameResource[equipmentId]
          if (!equipment) {
            continue;
          }

          for(const onEquipEffect of equipment.onEquip ?? []) {
            if (onEquipEffect.passExtraTurnOnBattleBegin) {
              return false
            }
          }
        }

        return true;
      });
    } else {
      if (prevBattleState.extraTurnOnBattleBegin.length > 0 && prevBattleState.extraTurnIndex < prevBattleState.extraTurnOnBattleBegin.length) {
        // 沿用上一场战斗的备战单位
        extraTurnOnBattleBegin = prevBattleState.extraTurnOnBattleBegin.slice(prevBattleState.extraTurnIndex);
      } 
    }

    // 如果活着的玩家只有一个，则直接取消备战
    if (extraTurnOnBattleBegin.length > 0) {
      let alivePlayerCount = 0;
      for(const member of prevBattleState.members) {
        if (member.isPlayer && !member.isSummoned && member.hp > 0) {
          alivePlayerCount++
        }
      }

      if (alivePlayerCount <= 1) {
        extraTurnOnBattleBegin = []
      }
    }
  }

  // 在备战回合添加穿戴了hasExtraTurnOnBattleBegin效果的单位
  for (const unit of unitList) {
    if (extraTurnOnBattleBegin.find((u) => u === unit.uuid)) {
      continue;
    }

    iteratorUnitEquipment(unit, ({equipmentInfo}) => {
      for (const onEquipEffect of equipmentInfo.onEquip ?? []) {
        if (!onEquipEffect.hasExtraTurnOnBattleBegin) {
          continue;
        }
        extraTurnOnBattleBegin.push(unit.uuid);

        return true
      }
    });
  }

  let actualBattleUnit = sorted.filter(unit => {
    // turnOrder中去除ingoreTurn的单位
    if (unit.ignoreTurn) {
      return false;
    }

    // turnOrder中去处穿戴了passTurn装备的单位
    for(const part in unit.equipment ?? {}) {
      let equipmentId = unit.equipment?.[part as CharacterEquipmentPart]
      if (!equipmentId) {
        continue;
      }

      let equipment = allGameResource[equipmentId]
      if (!equipment) {
        continue;
      }

      for(const onEquipEffect of equipment.onEquip ?? []) {
        if (onEquipEffect.passTurn) {
          return false
        }
      }
    }

    return true
  })

  // 去重
  extraTurnOnBattleBegin = Array.from(new Set(extraTurnOnBattleBegin));

  // 清理行动状态
  unitList = unitList.map(unit => {
    if (!unit.tbi) {
      unit.tbi = {};
    }

    unit.tbi.acted = false;

    return unit;
  })

  return {
    battleStatus: BattleStatus.BATTLING,
    uuid: battleUuid,
    members: unitList,
    groups,
    playerGroupId,
    currentTurnIndex: 0,
    turnOrder: actualBattleUnit.map(u => u.uuid),

    area: room.area,

    passedTurn: 0,

    extraTurnIndex: 0,
    extraTurnOnBattleBegin,

    roomUuid: room.uuid,
  };
}

export async function initBattleInfo_WorldBoss(playerIds: string[], state: WorldBossGlobalState, room: WorldBossBattleRoom): Promise<BattleInfo> {
  // 获取玩家单位
  const playerUnits = await generatePlayerGroupUnit(room, playerIds);
  const enemyUnits = state.bossMembers;

  return prepareBattleInfoData_WorldBoss(playerUnits, enemyUnits, room);
}

async function prepareBattleInfoData_WorldBoss(playerGroupUnit: BaseBattleUnit[], enemyGroupUnit: BaseBattleUnit[], room: WorldBossBattleRoom): Promise<BattleInfo> {
  const playerUnits = playerGroupUnit;
  const enemyUnits = enemyGroupUnit;

  // 临时处理：为所有玩家添加标记
  for(const playerUnit of playerUnits) {
    if (playerUnit.isPlayer) {
      playerUnit.canGetDropReward = true;
      playerUnit.canGetExpReward = true;
      playerUnit.canUseItem = true;
    }
  }

  let unitList: BaseBattleUnit[] = [];
  unitList = [...playerUnits, ...enemyUnits];

  // 预计算敏捷排序索引，避免重复sort
  const sortedIndices = unitList
    .map((_, index) => index)
    .sort((a, b) => (unitList[b].status.dexterity.level ?? 0) - (unitList[a].status.dexterity.level ?? 0));

  const sorted = sortedIndices.map(i => unitList[i]);

  const battleUuid = v7();

  // 分组，假设玩家为一组，敌人为一组
  const playerGroup = playerUnits.map(u => u.uuid);
  const enemyGroup = enemyUnits.map(u => u.uuid);
  const groups: Record<string, string[]> = {
    "player": playerGroup,
    "enemy": enemyGroup,
  }

  for(const player of playerUnits) {
    player.tmpShield = 0
  }

  // 取玩家组第一个单位id作为playerGroupId
  const playerGroupId = "player"

  let extraTurnOnBattleBegin: string[] = []
  // 在备战回合添加穿戴了hasExtraTurnOnBattleBegin效果的单位
  for (const unit of unitList) {
    if (extraTurnOnBattleBegin.find((u) => u === unit.uuid)) {
      break;
    }

    iteratorUnitEquipment(unit, ({equipmentInfo}) => {
      for (const onEquipEffect of equipmentInfo.onEquip ?? []) {
        if (!onEquipEffect.hasExtraTurnOnBattleBegin) {
          continue;
        }
        extraTurnOnBattleBegin.push(unit.uuid);

        return true
      }
    });
  }

  let actualBattleUnit = sorted.filter(unit => {
    // turnOrder中去除ingoreTurn的单位
    if (unit.ignoreTurn) {
      return false;
    }

    // turnOrder中去处穿戴了passTurn装备的单位
    for(const part in unit.equipment ?? {}) {
      let equipmentId = unit.equipment?.[part as CharacterEquipmentPart]
      if (!equipmentId) {
        continue;
      }

      let equipment = allGameResource[equipmentId]
      if (!equipment) {
        continue;
      }

      for(const onEquipEffect of equipment.onEquip ?? []) {
        if (onEquipEffect.passTurn) {
          return false
        }
      }
    }

    return true
  })

  return {
    battleStatus: BattleStatus.BATTLING,
    uuid: battleUuid,
    members: unitList,
    groups,
    playerGroupId,
    currentTurnIndex: 0,
    turnOrder: actualBattleUnit.map(u => u.uuid),

    // @ts-ignore
    area: '',

    worldBossId: room.worldBossId,

    passedTurn: 0,

    extraTurnIndex: 0,
    extraTurnOnBattleBegin,

    roomUuid: room.uuid,
  };
}


// Weighted random pick that respects an optional `maxCountPerWave` on pool entries.
// If an entry has `maxCountPerWave`, it will not be picked more times than that in one call.
function weightedRandomPick(
  pool: { id: string; weight: number; maxCountPerWave?: number }[],
  count: number
): string[] {
  const result: string[] = [];

  // clone remaining capacities from maxCountPerWave, default to Infinity
  const remaining = new Map<string, number>();
  for (const e of pool) {
    remaining.set(
      e.id,
      e.maxCountPerWave !== undefined
        ? Math.max(0, Math.floor(e.maxCountPerWave))
        : Number.POSITIVE_INFINITY
    );
  }

  // Perform up to `count` selections. If all entries exhausted before reaching `count`, stop early.
  for (let i = 0; i < count; i++) {
    // build available entries for this round (those with remaining > 0)
    const available = pool.filter(
      (e) => (remaining.get(e.id) ?? 0) > 0 && e.weight > 0
    );
    if (available.length === 0) break;

    const totalWeight = available.reduce((sum, e) => sum + e.weight, 0);
    if (totalWeight <= 0) break;

    let r = Math.random() * totalWeight;
    let picked = available[available.length - 1];
    for (const entry of available) {
      if (r < entry.weight) {
        picked = entry;
        break;
      }
      r -= entry.weight;
    }

    result.push(picked.id);

    // decrement capacity
    const prev = remaining.get(picked.id) ?? Number.POSITIVE_INFINITY;
    if (prev !== Number.POSITIVE_INFINITY) {
      remaining.set(picked.id, prev - 1);
    }
  }

  return result;
}

export const BATTLE_INFO_KEY = "BATTLE_INFO_";
export const BATTLE_PLAYER_UUID_INFO_KEY = "BATTLE_PLAYER_UUID_INFO_";
export const BATTLE_PLAYER_MEMBER_INFO_KEY = "BATTLE_PLAYER_MEMBER_INFO_";
export const BATTLE_PLAYER_MEMBER_SAE_INFO_KEY = "BATTLE_PLAYER_MEMBER_SAE_INFO_"; // skill ai equipment
export const getBattleInfoKey = (battleId: string): string => {
  return BATTLE_INFO_KEY + battleId;
}
export const getBattlePlayerUuidKey = (battleId: string): string => {
  return BATTLE_PLAYER_UUID_INFO_KEY + battleId;
}
export const getBattlePlayerMemberInfoKey = (battleId: string): string => {
  return BATTLE_PLAYER_MEMBER_INFO_KEY + battleId;
}
export const getBattlePlayerMemberSaeInfoKey = (battleId: string): string => {
  return BATTLE_PLAYER_MEMBER_SAE_INFO_KEY + battleId;
}

export async function getBattlePlayerUuidsFromRedis(battleId: string): Promise<string[]> {
  if (!battleId) {
    return [];
  }

  const _entry_player = localBattleInfoCache.get(battleId);
  if (_entry_player) {
    // 更新访问时间并直接返回缓存中的玩家UUID
    _entry_player.lastAccessed = Date.now();
    return _entry_player.value.members
      .filter(member => member.isPlayer)
      .map(member => member.uuid);
  }

  const key = getBattlePlayerUuidKey(battleId);
  const data = await redisClient.get(key);

  if (data) {
    try {
      return JSON.parse(data) as string[];
    } catch (e) {
      console.error("Failed to parse player UUIDs from Redis:", e);
      return [];
    }
  }

  let battleInfo = await getBattleInfoFromRedis(battleId);

  if (!battleInfo) return [];

  // 从 BattleInfo 中获取玩家UUID列表
  const playerMemberList = battleInfo.members.filter(member => member.isPlayer);
  const playerUuids = playerMemberList.map(member => member.uuid);
  return playerUuids;
}

// local cache holds BattleInfo with lastAccessed timestamp to allow periodic sweeping
const localBattleInfoCache = new Map<string, { value: BattleInfo; lastAccessed: number }>();

// 去抖的异步写：用于非最终态的中途更新，减少阻塞
export function setBattleInfoIntoMemory(battleInfo: BattleInfo): void {
  localBattleInfoCache.set(battleInfo.uuid, { value: battleInfo, lastAccessed: Date.now() });
}

export function dumpBattleInfoToRedis(group: string, battleInfo: BattleInfo, pipeline: ReturnType<typeof redisClient['multi']>) {
  const groupKey = `battleGroup:${group}`;
  const battleInfoStr = JSON.stringify(battleInfo);
  pipeline.hSet(groupKey, battleInfo.uuid, battleInfoStr);
}

export async function dumpAllLocalMemoryBattleInfoToRedis(group: string): Promise<void> {
  const pipeline = redisClient.multi();
  for (const [_battleId, entry] of localBattleInfoCache) {
    dumpBattleInfoToRedis(group, entry.value, pipeline);
  }
  await pipeline.exec();
}

export async function loadAllBattleInfoFromRedisToMemory(group: string): Promise<void> {
  const groupKey = `battleGroup:${group}`;
  const allSavedBattleInfo = await redisClient.hGetAll(groupKey);
  for(const [battleId, infoStr] of Object.entries(allSavedBattleInfo)) {
    const obj = safeJsonParse<BattleInfo>(infoStr);
    localBattleInfoCache.set(battleId, { value: obj, lastAccessed: Date.now() });
  }
  redisClient.del(groupKey);
}

// 从 Redis 读取 BattleInfo
export async function getBattleInfoFromRedis(battleId: string): Promise<BattleInfo | undefined> {
  const _entry = localBattleInfoCache.get(battleId);
  if (_entry) {
    _entry.lastAccessed = Date.now();
    return _entry.value;
  }

  const key = getBattleInfoKey(battleId);
  const playerMemberKey = getBattlePlayerMemberInfoKey(battleId);
  const playerMemberSAEInfoKey = getBattlePlayerMemberSaeInfoKey(battleId);

  const pipeline = redisClient.multi();
  pipeline.get(key);
  pipeline.get(playerMemberKey);
  pipeline.get(playerMemberSAEInfoKey);
  const [data, playerMemberData, playerSAEInfo] = await pipeline
    .exec()
    .then((results) => results.map((r: any) => {
      if (!r) {
        return ""
      }

      return r as string
    }));

  if (!data) return;

  // try {
  //   // 尝试解析为 Base64 压缩数据
  //   const buf = Buffer.from(data, 'base64');
  //   const inflated = pako.inflateRaw(buf, { to: 'string' });
  //   return JSON.parse(inflated) as BattleInfo;
  // } catch (e) {
    // 如果解析失败，尝试直接解析为 JSON 字符串
    try {
      let res = JSON.parse(data) as BattleInfo;

      if (playerMemberData) {
        const playerMembers = JSON.parse(playerMemberData) as BaseBattleUnit[];
        if (Array.isArray(playerMembers)) {
          res.members.unshift(...playerMembers);
        }
      }

      if (playerSAEInfo) {
        const playerSAEInfoMap = JSON.parse(playerSAEInfo) as Record<string, Pick<BaseBattleUnit, 'skills' | 'ai' | 'equipment'>>;
        for (const member of res.members) {
          if (playerSAEInfoMap[member.uuid]) {
            member.skills = playerSAEInfoMap[member.uuid].skills;
            member.ai = playerSAEInfoMap[member.uuid].ai;
            member.equipment = playerSAEInfoMap[member.uuid].equipment;
          }
        }
      }

      // console.log(battleId, 'Parsed BattleInfo from Redis in', t2 - t1, 'ms', 'data length:',data.length);

      return res
    } catch (jsonError) {
      console.error('Failed to parse BattleInfo from Redis:', jsonError);
      return undefined;
    }
  // }
}

export async function startBattle(
  battleRoom: NormalBattleRoom,
  prevBattleState?: BattleInfo
): Promise<{ battleRoom: BattleRoom; battleInfo: BattleInfo }> {
  // 统一耗时探针（稳定采样+白名单）
  const { mark: mark_sb, logDuration: logDuration_sb } = createTimingProbe('startBattle', {
    global: false,
    sampleRate: 0.01,
    roomWhitelist: [],
    roomUuid: battleRoom.uuid,
    battleUuid: battleRoom.battleUuid || undefined,
  });

  const playerCount = battleRoom.memberIds.length;

  let extraEnemyCount = 0
  let extraBossCount = 0
  let battleInfo: BattleInfo | null = null;

  // 临时加一个，雇佣兵不进迷雾
  mark_sb('startBattle:precheck:start');
  if (playerCount == 1 && !battleRoom.denseFogMode) {
    let playerUuid = battleRoom.memberIds[0]
    let playerTarvenState = await getUserWorkingTalentCats(playerUuid)
    if (playerTarvenState.find(tarven => tarven.type === "baseMercenary")) {
      extraEnemyCount += 3; // 如果有雇佣兵，增加3个敌人
    }
  }
  mark_sb('startBattle:precheck:end');
  logDuration_sb('startBattle:precheck:start','startBattle:precheck:end');

  // 遍历玩家装备的额外敌人效果
  // Optional map of previous battle members for faster lookups (filled if prevBattleState exists)
  let prevMemberMap: Map<string, BaseBattleUnit> | undefined;
  mark_sb('startBattle:prevStateScan:start');

  // 战斗契约：战斗开始先结算一次消耗/冷却
  tickBattleRoomOfferings(battleRoom);

  if (prevBattleState) {
    // build map from prevBattleState members for efficient lookups
    const prevMemberMap = new Map<string, BaseBattleUnit>();
    for (const m of prevBattleState.members) prevMemberMap.set(m.uuid, m);

    for (const memberUuid of battleRoom.memberIds) {
      const member = prevMemberMap.get(memberUuid);
      if (member) {
        iteratorUnitEquipment(member, ({equipmentTrigger, equipmentId}) => {
          extraEnemyCount += equipmentTrigger?.extraEnemyCount?.({
            self: member,
            equipmentId,
            battleInfo: prevBattleState
          }) ?? 0
        }, { requiredHook: 'extraEnemyCount' })
      }
    }
  }
  mark_sb('startBattle:prevStateScan:end');
  logDuration_sb('startBattle:prevStateScan:start','startBattle:prevStateScan:end');

  const baseEnemyCountInfo = generateBattleEnemyCount(battleRoom, extraEnemyCount)

  let enemyCount = 0;
  let bossCount = 0;
  await iteratorAllOfferingAsync(battleRoom, async ({stack, spec}) => {
    if (!spec.effects?.length) {
      return;
    }
    for(let eff of spec.effects) {
      const res = await (eff as BattleRoomOfferingEffect<'onPrepareBattleData'>).handler({
        baseBossCount: baseEnemyCountInfo.bossCount,
        baseEnemyCount: baseEnemyCountInfo.normalEnemyCount,
        offering: spec,
      }) 

      if (res?.extraEnemyCount) {
        enemyCount += res.extraEnemyCount;
      }
      if (res?.extraBossCount) {
        bossCount += res.extraBossCount;
      }
    }
  }, { requiredTrigger: 'onPrepareBattleData' } );

  baseEnemyCountInfo.normalEnemyCount += enemyCount;
  baseEnemyCountInfo.bossCount += bossCount;

  // 迷雾模式
  mark_sb('startBattle:denseFog:start');
  if (battleRoom.denseFogMode && battleRoom.totalBattleLevel) {
    let denseFogSpriteIdList: AllGameEnemyID[] = ['dense_fog_sprite_001', 'dense_fog_sprite_002', 'dense_fog_sprite_003', 'dense_fog_sprite_004'] as const;
    let denseFogSpriteBossList: AllGameEnemyID[] = ['dense_fog_sprite_e_001'];

    let meetOtherPlayerProbability = 0.08; // 基础遇到其他玩家的概率

    if (prevBattleState) {
      // reuse prevMemberMap if available (from earlier); otherwise build one
      let owner: BaseBattleUnit | undefined;
      // try to access prevMemberMap defined above
      if (typeof prevMemberMap !== 'undefined') {
        // @ts-ignore: prevMemberMap may be undefined in this scope
        owner = prevMemberMap.get(battleRoom.ownerId);
      } else {
        owner = findUnitInBattle(prevBattleState, battleRoom.ownerId);
      }

      if (owner) {
        if (hasState(owner, "denseFogLighthouseStateAggressive")) {
          meetOtherPlayerProbability += meetOtherPlayerProbability * 0.5;
        } else if (hasState(owner, "denseFogLighthouseStateConservative")) {
          meetOtherPlayerProbability -= meetOtherPlayerProbability * 0.5;
        }
      }
    }

    if (randomNumberInFullColseRange(0, 1) < meetOtherPlayerProbability && battleRoom.currentRepeat > 4) { // 刷新为玩家 // 至少重复了4轮，才会遇到
      // 优化：优先随机采样部分房间，降低全量扫描与反序列化开销；若采样为空再回退全量
      let availableBattleRooms: NormalBattleRoom[] = [];
      try {
        const SAMPLE_SIZE = 200; // 采样数量，可按并发规模调整
        // 使用 SRANDMEMBER 从房间集合中随机抽取一批 key
        // 注：不同 redis 客户端方法名可能不同，这里做兼容处理
        const sampleKeys: string[] = (await (redisClient as any)?.SRANDMEMBER?.("ALL_ROOM_KEYS", SAMPLE_SIZE)) || [];
        if (sampleKeys.length > 0) {
          const roomsData = await redisClient.mGet(sampleKeys);
          const sampledRooms: NormalBattleRoom[] = roomsData
            .filter(Boolean)
            .map((data: any) => JSON.parse(data as string))
            .filter((room: any) => room?.type === "battle") as NormalBattleRoom[];
          availableBattleRooms = sampledRooms.filter((room) => {
            return (
              room.status == "battling" &&
              room.denseFogMode &&
              room.area == battleRoom.area &&
              room.memberIds.length > 0 &&
              Math.abs(room.memberIds.length - battleRoom.memberIds.length) <= 1 &&
              room.uuid != battleRoom.uuid &&
              !!room.battleUuid &&
              room.ironcat == battleRoom.ironcat
            );
          });
        }
      } catch {}

      if (!availableBattleRooms.length) {
        // 回退：读取已开启 denseFogMode 的房间（带缓存，降低代价）
        let allBattleRooms = await getAllDenseFogRooms();
        availableBattleRooms = allBattleRooms.filter((room) => {
          return (
            room.status == "battling" &&
            room.denseFogMode &&
            room.area == battleRoom.area &&
            room.memberIds.length > 0 &&
            Math.abs(room.memberIds.length - battleRoom.memberIds.length) <= 1 &&
            room.uuid != battleRoom.uuid &&
            !!room.battleUuid &&
            room.ironcat == battleRoom.ironcat
          );
        });
      }

      let randomBattleRoom: BattleRoom | undefined = undefined;

      for(let i = 0; i < 20; i++) {
        let thisTimeBattleRoom = randomElementInCollection(availableBattleRooms);
        let thisRoomTotalBattleLevel = thisTimeBattleRoom?.totalBattleLevel ?? 0

        if (
          thisTimeBattleRoom &&
          Math.abs(thisRoomTotalBattleLevel - battleRoom.totalBattleLevel) < 50
        ) {
          randomBattleRoom = thisTimeBattleRoom;
          break;
        }
      }

      if (!randomBattleRoom) {
        for (let i = 0; i < 20; i++) {
          let thisTimeBattleRoom = randomElementInCollection(availableBattleRooms);
          let thisRoomTotalBattleLevel = thisTimeBattleRoom?.totalBattleLevel ?? 0;

          if (
            thisTimeBattleRoom &&
            Math.abs(thisRoomTotalBattleLevel - battleRoom.totalBattleLevel) < 150
          ) {
            randomBattleRoom = thisTimeBattleRoom;
            break;
          }
        }
      }

      if (!battleRoom) {
        randomBattleRoom = randomElementInCollection(availableBattleRooms);
      }

      if (randomBattleRoom) {
        if (randomNumberInFullColseRange(0, 1) < 0.5) { // 50%概率为全新战斗
          battleInfo = await initBattleInfo_PVP_DenseFogMode(
            battleRoom.memberIds,
            randomBattleRoom.memberIds,
            battleRoom,
            prevBattleState,
            {
              // 玩家战斗，总是会多一个幽灵
              extraEnemyGroupUnit: [
                generateEnemyById(
                  randomElementInCollection(denseFogSpriteIdList)!
                )!,
              ],
            }
          );
        } else { // 50%继承状态，直接从现有战斗数据中获取
          let thisBattleInfo = await getBattleInfoFromRedis(randomBattleRoom.battleUuid!);
          if (thisBattleInfo) {
            const playerGroupUnitUuids = thisBattleInfo.groups[thisBattleInfo.playerGroupId]

            const playerGroupUnit = playerGroupUnitUuids.map(uuid => {
              let unit = findUnitInBattle(thisBattleInfo, uuid)

              // 直接从战斗中获取的单位，需要重置其阵营

              return unit;
            }).filter(unit => unit) as BaseBattleUnit[]

            battleInfo = await initBattleInfo_PVP_withEnemyUnit_DenseFogMode(
              battleRoom.memberIds,
              playerGroupUnit,
              battleRoom,
              prevBattleState,
              {
                // 玩家战斗，总是会多一个幽灵
                extraEnemyGroupUnit: [
                  generateEnemyById(
                    randomElementInCollection(denseFogSpriteIdList)!
                  )!,
                ],
              }
            );
          }
        }
      }

      // 如果在此if分支生成了battleInfo，则一定是玩家幻象对战
      if (battleInfo) {
        if (!battleRoom.denseFogModeConflictEncounter) {
          battleRoom.denseFogModeConflictEncounter = [];
        }

        battleRoom.denseFogModeConflictEncounter.push({
          battleUuid: battleInfo.uuid,
          enemyPlayerUuidList: battleInfo.members
            .filter((unit) => unit.isPlayerUnit && !unit.isPlayer && !unit.isSummoned && unit.id != 'meowColossus')
            .map((member) => member.uuid),
          result: "BATTLING",
          date: new Date()
        });
        battleRoom.denseFogModeConflictEncounter = battleRoom.denseFogModeConflictEncounter.slice(-10); // 只保留最近10次
        battleInfo.isDenseFogMode_Encounter = true
      }
    } else if (randomNumberInFullColseRange(0, 1) < 0.5) { // 可能随机加入其他副本的敌人
      let allBattleAreasInfo = Object.values(allBattleAreas).filter(a => a.id != 'cat_dungeon_002')
      let usedBattleAreaCount = randomIntegerInFullCloseRange(1, 4);

      let randomBattleAreas: BattleArea[] = randomElementsInCollection(
        allBattleAreasInfo,
        usedBattleAreaCount,
        {
          allowDuplicates: false,
        }
      );

      let allEnemyIds: AllGameEnemyID[] = [];
      for (const area of randomBattleAreas) {
        let enemyIdsInArea = getAllEnemyIdInBattleArea(area);
        allEnemyIds.push(...enemyIdsInArea);
      }

      // 挑选随机个敌人
      let randomEnemyCount = randomNumberInFullColseRange(1, 5);
      let randomEnemyIds = randomElementsInCollection(
        allEnemyIds,
        randomEnemyCount
      );

      let enemyIds = generateBattleEnemyIds(
        battleRoom,
        prevBattleState,
        baseEnemyCountInfo
      );
      enemyIds.push(...randomEnemyIds);

      // 这种情况下，可能会遇到迷雾幽灵
      let extraEnemyInDenseFog = []
      if (randomNumberInFullColseRange(0, 1) < 0.01) {
        extraEnemyInDenseFog.push(
          generateEnemyById(randomElementInCollection(denseFogSpriteIdList)!)!
        );
      }

      // 特殊情况，可能会遇到迷雾幽灵Boss
      if (randomNumberInFullColseRange(0, 1) < 0.01) {
        extraEnemyInDenseFog.push(
          generateEnemyById(randomElementInCollection(denseFogSpriteBossList)!)!
        );
      }

      battleInfo = await initBattleInfo_PVE(
        battleRoom.memberIds,
        enemyIds,
        battleRoom,
        prevBattleState,
        {
          // 玩家战斗，总是会多一个幽灵
          extraEnemyGroupUnit: extraEnemyInDenseFog,
        }
      );
    }
  }
  mark_sb('startBattle:denseFog:end');
  logDuration_sb('startBattle:denseFog:start','startBattle:denseFog:end');

  // 如果没有生成battleInfo，则回退到PVE基本模式，使用原逻辑
  mark_sb('startBattle:pve:init:start');
  if (!battleInfo) {
    let enemyIds = generateBattleEnemyIds(
      battleRoom,
      prevBattleState,
      baseEnemyCountInfo
    );
    battleInfo = await initBattleInfo_PVE(
      battleRoom.memberIds,
      enemyIds,
      battleRoom,
      prevBattleState
    );
  }
  mark_sb('startBattle:pve:init:end');
  logDuration_sb('startBattle:pve:init:start','startBattle:pve:init:end');

  battleInfo.isDenseFogMode = battleRoom.denseFogMode || false;

  // 创建战斗信息（改为后台去抖写，降低开战阻塞）
  mark_sb('redis:setBattleInfo:start');
  setBattleInfoIntoMemory(battleInfo);
  mark_sb('redis:setBattleInfo:end');
  logDuration_sb('redis:setBattleInfo:start','redis:setBattleInfo:end');
  // 立即通知客户端最新战斗信息（一次核心事件）
  pushMessageToQueue({
    type: "dispatch_latest_battle_info",
    battleRoom: battleRoom,
    latestBattleInfo:battleInfo 
  })
  // 清理每个 unit 的触发标记（提取为 helper，减少重复代码）
  mark_sb('startBattle:cleanupOncePreBattle:start');
  for (const unit of battleInfo.members) {
    clearTriggerMarks(unit);
  }
  mark_sb('startBattle:cleanupOncePreBattle:end');
  logDuration_sb('startBattle:cleanupOncePreBattle:start','startBattle:cleanupOncePreBattle:end');

  const callbacksForStart = generateCallback(battleInfo, {});
  mark_sb('startBattle:callbacks:start');

  pushMessageToQueue({
    type: 'battle_begin',
    battleInfo: battleInfo,
    battleUuid: battleInfo.uuid,
    info: {
      turnIndex: battleRoom.currentRepeat + 1
    }
  })

  pushMessageToQueue({
    type: 'battle_prepare_begin',
    battleInfo: battleInfo,
    battleUuid: battleInfo.uuid,
    info: {
    }
  })

  await iteratorAllOfferingAsync(battleRoom, async ({stack, spec}) => {
    if (!spec.effects?.length) {
      return;
    }
    for(const eff of spec.effects) {
      await (eff as BattleRoomOfferingEffect<'onBattleStart'>).handler({
        battleInfo,
        callbacks: callbacksForStart,

        offering: spec,
      })
    }
  }, { requiredTrigger: 'onBattleStart' } );

  for(const unit of battleInfo.members) {
    const info = getBaseInfoFromBattleInfo(unit, battleInfo);
    if (!info) {
      console.error("startBattle: 未能获取单位的战斗信息", unit.name, battleRoom.uuid);
      continue;
    }

    if (unit.hp > 0) {
      // 使用物品
      await unitUseItem(unit, battleInfo, {
        allyUnits: info.allAllies,
        enemyUnits: info.enemies,
        callbacksBase: callbacksForStart,
        phase: AllBattlePhase.BATTLE_START
      })

      await iteratorUnitStateAsync(unit, async ({stateInBattle, stateInfo}) => {
        return stateInfo?.onBattleStart?.({
          self: unit,
          thisState: stateInBattle,
          enemies: info?.allEnemies,
          callbacks: callbacksForStart,
          battleInfo
        })
      }, { requiredHook: 'onBattleStart' });

      // 这里主要装备

      await iteratorUnitEquipmentAsync(unit, async ({equipmentTrigger, equipmentId}) => {
        return equipmentTrigger?.onBattleStart?.({
          self: unit,
          ...info,
          equipmentId,
          battleInfo,
          callbacks: callbacksForStart,
        })
      }, { requiredHook: 'onBattleStart' } );


      await iteratorUnitSkillNodeAsync(unit, async (node, level) => {
        return node.businessBattleEffects!.onBattleStart!({
          level,
          self: unit,
          battleInfo,
          callbacks: callbacksForStart,
        })
      }, { requiredHook: 'onBattleStart' })

      if (unit.stateWhenStartEachBattle) {
        // 如果有状态在战斗开始时触发，添加状态
        for (const stateInfo of unit.stateWhenStartEachBattle) {
          if (stateInfo.onlyDensefog && !battleRoom.denseFogMode) {
            continue
          }

          if (!allBattleState[stateInfo.id]) {
            continue;
          }

          if (new Date() > new Date(stateInfo.until)) {
            continue;
          }

          await addState(
            stateInfo.id,
            stateInfo.duration,
            unit,
            unit,
            {
              thisStateActuralValue: stateInfo.value,
              ...(stateInfo.extra ?? {}),
            },
            {
              battleInfo,
              callbacks: callbacksForStart,
              addStateCallback: (obj) => {
                sendAddStateMsg(battleInfo, obj);
              },
            }
          );
        }
      }
    }
    if (unit.hp <= 0) {
      await iteratorUnitEquipmentAsync(unit, async ({equipmentTrigger, equipmentId}) => {
        return equipmentTrigger?.onBattleStart_selfDead?.({
          self: unit,
          ...info,
          equipmentId,
          battleInfo,
          callbacks: callbacksForStart,
        })
      }, { requiredHook: 'onBattleStart_selfDead' } );
    }
  }

  pushMessageToQueue({
    type: 'battle_prepare_end',
    battleInfo: battleInfo,
    battleUuid: battleInfo.uuid,
    info: {}
  })

  mark_sb('startBattle:callbacks:end');
  logDuration_sb('startBattle:callbacks:start','startBattle:callbacks:end');

  // 过滤掉所有id=meowColossus且hp<=0的单位
  // battleInfo.members = battleInfo.members.filter((unit) => unit.id != 'meowColossus' && unit.hp > 0);

  // let allDiedMeowColosuss = battleInfo.members.filter((unit) => unit.id == 'meowColossus' && unit.hp <= 0).map(u => u.uuid);
  // battleInfo.turnOrder = battleInfo.turnOrder.filter((uuid) => !allDiedMeowColosuss.includes(uuid));

  await iteratorAllOfferingAsync(battleRoom, async ({stack, spec}) => {
    if (!spec.effects?.length) {
      return;
    }
    for(const eff of spec.effects) {
      await (eff as BattleRoomOfferingEffect<'afterBattleStart'>).handler({
        battleInfo,
        callbacks: callbacksForStart,

        offering: spec,
      })
    }
  }, { requiredTrigger: 'afterBattleStart' } );


  battleRoom.battleUuid = battleInfo.uuid;
  battleRoom.status = "battling";

  battleRoom.waitingForAutoStartTime = undefined;
  battleRoom.waitingForRestartTime = undefined;

  // 写入此房间的战斗等级
  battleRoom.totalBattleLevel = 0;
  mark_sb('startBattle:calcTotalBattleLevel:start');
  for(const memberUuid of battleRoom.memberIds) {
    let member = findUnitInBattle(battleInfo, memberUuid);
    let thisMemberBattleLevel = Math.floor(member?.level ?? 10);
    battleRoom.totalBattleLevel += thisMemberBattleLevel
  }
  mark_sb('startBattle:calcTotalBattleLevel:end');
  logDuration_sb('startBattle:calcTotalBattleLevel:start','startBattle:calcTotalBattleLevel:end');

  mark_sb('room:update:start');
  await updateRoom(battleRoom.uuid, battleRoom);
  mark_sb('room:update:end');
  logDuration_sb('room:update:start','room:update:end');

  return {
    battleRoom,
    battleInfo,
  };
}

export async function startWorldBossBattle(
  battleRoom: WorldBossBattleRoom,
  prevBattleState?: BattleInfo
): Promise<{ battleRoom: BattleRoom; battleInfo: BattleInfo, worldBossState: WorldBossGlobalState }> {
  const playerCount = battleRoom.memberIds.length;

  let extraEnemyCount = 0;
  let extraBossCount = 0;
  let battleInfo: BattleInfo | null = null;

  let worldBossState = await getGlobalBossState(battleRoom.worldBossId);
  // Ensure global boss state is initialized
  if (!worldBossState) {
    worldBossState = await initializeGlobalBossState(battleRoom.worldBossId);
  }

  if (!worldBossState) {
    throw new Error("无法获取或初始化世界Boss状态：" + battleRoom.worldBossId);
  }

  // 一旦开打，更新config状态为battling
  if (worldBossState.status != 'battling') {
    await updateGlobalBossStatus(battleRoom.worldBossId, 'battling');
  }

  // 战斗契约：战斗开始先结算一次消耗/冷却
  tickBattleRoomOfferings(battleRoom);

  // const baseEnemyCountInfo = generateBattleEnemyCount(battleRoom, extraEnemyCount)

  if (!battleInfo) {
    // let enemyIds = generateBattleEnemyIds(
    //   battleRoom,
    //   prevBattleState,
    //   baseEnemyCountInfo
    // );
    battleInfo = await initBattleInfo_WorldBoss(
      battleRoom.memberIds,
      worldBossState,
      battleRoom
    );
  }

  const conf = await getWorldBossConfigById(battleRoom.worldBossId);

  battleInfo.worldBossId = battleRoom.worldBossId;
  battleInfo.worldBossConfig = {
    bossId: worldBossState.bossId,
    worldBossBattleUuid: worldBossState.uuid,
    uuidList: worldBossState.bossMembers.map(b => b.uuid),
    startAt: conf?.startAt,
    endAt: conf?.endAt,
  }

  // 创建战斗信息（改为后台去抖写，降低开战阻塞）
  setBattleInfoIntoMemory(battleInfo);
  // 立即通知客户端最新战斗信息（一次核心事件）
  pushMessageToQueue({
    type: "dispatch_latest_battle_info",
    battleRoom: battleRoom,
    latestBattleInfo: battleInfo,
  });
  // 清理每个 unit 的触发标记（提取为 helper，减少重复代码）
  for (const unit of battleInfo.members) {
    clearTriggerMarks(unit);
  }

  const callbacksForStart = generateCallback(battleInfo, {});

  pushMessageToQueue({
    type: "battle_begin",
    battleInfo: battleInfo,
    battleUuid: battleInfo.uuid,
    info: {
      turnIndex: battleRoom.currentRepeat + 1,
    },
  });

  pushMessageToQueue({
    type: "battle_prepare_begin",
    battleInfo: battleInfo,
    battleUuid: battleInfo.uuid,
    info: {},
  });

  await iteratorAllOfferingAsync(
    battleRoom,
    async ({ stack, spec }) => {
      if (!spec.effects?.length) {
        return;
      }
      for (const eff of spec.effects) {
        await (eff as BattleRoomOfferingEffect<"onBattleStart">).handler({
          battleInfo,
          callbacks: callbacksForStart,

          offering: spec,
        });
      }
    },
    { requiredTrigger: "onBattleStart" }
  );

  for (const unit of battleInfo.members) {
    const info = getBaseInfoFromBattleInfo(unit, battleInfo);
    if (!info) {
      console.error(
        "startBattle: 未能获取单位的战斗信息",
        unit.name,
        battleRoom.uuid
      );
      continue;
    }

    if (unit.hp > 0) {
      await iteratorUnitStateAsync(
        unit,
        async ({ stateInBattle, stateInfo }) => {
          return stateInfo?.onBattleStart?.({
            self: unit,
            thisState: stateInBattle,
            enemies: info?.allEnemies,
            callbacks: callbacksForStart,
            battleInfo,
          });
        },
        { requiredHook: "onBattleStart" }
      );

      // 这里主要装备

      await iteratorUnitEquipmentAsync(
        unit,
        async ({ equipmentTrigger, equipmentId }) => {
          return equipmentTrigger?.onBattleStart?.({
            self: unit,
            ...info,
            equipmentId,
            battleInfo,
            callbacks: callbacksForStart,
          });
        },
        { requiredHook: "onBattleStart" }
      );

      await iteratorUnitSkillNodeAsync(
        unit,
        async (node, level) => {
          return node.businessBattleEffects!.onBattleStart!({
            level,
            self: unit,
            battleInfo,
            callbacks: callbacksForStart,
          });
        },
        { requiredHook: "onBattleStart" }
      );

      if (unit.stateWhenStartEachBattle) {
        // 如果有状态在战斗开始时触发，添加状态
        for (const stateInfo of unit.stateWhenStartEachBattle) {
          if (
            allBattleState[stateInfo.id] &&
            new Date() > new Date(stateInfo.until)
          ) {
            continue;
          }

          await addState(
            stateInfo.id,
            stateInfo.duration,
            unit,
            unit,
            {
              thisStateActuralValue: stateInfo.value,
              ...(stateInfo.extra ?? {}),
            },
            {
              battleInfo,
              callbacks: callbacksForStart,
              addStateCallback: (obj) => {
                sendAddStateMsg(battleInfo, obj);
              },
            }
          );
        }
      }
    }
    if (unit.hp <= 0) {
      await iteratorUnitEquipmentAsync(
        unit,
        async ({ equipmentTrigger, equipmentId }) => {
          return equipmentTrigger?.onBattleStart_selfDead?.({
            self: unit,
            ...info,
            equipmentId,
            battleInfo,
            callbacks: callbacksForStart,
          });
        },
        { requiredHook: "onBattleStart_selfDead" }
      );
    }
  }

  pushMessageToQueue({
    type: "battle_prepare_end",
    battleInfo: battleInfo,
    battleUuid: battleInfo.uuid,
    info: {},
  });

  // 过滤掉所有id=meowColossus且hp<=0的单位
  // battleInfo.members = battleInfo.members.filter((unit) => unit.id != 'meowColossus' && unit.hp > 0);

  // let allDiedMeowColosuss = battleInfo.members.filter((unit) => unit.id == 'meowColossus' && unit.hp <= 0).map(u => u.uuid);
  // battleInfo.turnOrder = battleInfo.turnOrder.filter((uuid) => !allDiedMeowColosuss.includes(uuid));

  await iteratorAllOfferingAsync(
    battleRoom,
    async ({ stack, spec }) => {
      if (!spec.effects?.length) {
        return;
      }
      for (const eff of spec.effects) {
        await (eff as BattleRoomOfferingEffect<"afterBattleStart">).handler({
          battleInfo,
          callbacks: callbacksForStart,

          offering: spec,
        });
      }
    },
    { requiredTrigger: "afterBattleStart" }
  );

  battleRoom.battleUuid = battleInfo.uuid;
  battleRoom.status = "battling";

  battleRoom.waitingForAutoStartTime = undefined;
  battleRoom.waitingForRestartTime = undefined;

  // 写入此房间的战斗等级
  battleRoom.totalBattleLevel = 0;
  for (const memberUuid of battleRoom.memberIds) {
    let member = findUnitInBattle(battleInfo, memberUuid);
    let thisMemberBattleLevel = Math.floor(member?.level ?? 10);
    battleRoom.totalBattleLevel += thisMemberBattleLevel;
  }

  await updateRoom(battleRoom.uuid, battleRoom);

  return {
    battleRoom,
    battleInfo,
    worldBossState,
  };
}

export function generateCallback(
  battleInfo: BattleInfo,
  opt: {
    skillId?: AllBattleSkillId,
  }
): BattleCallback {
  const callbacks: BattleCallback = {
    castSkillCallback: (obj) => {
      sendCastSkillMsg(battleInfo, obj);
    },
    healCallback: (obj) => {
      sendBattleMsg("on_heal", battleInfo, obj);
    },
    dealDamageCallback: (obj) => {
      obj.target = (obj.target ?? []).map((v) => {
        if (!v.causeBy) {
          v.causeBy = {};
        }

        if (opt.skillId) {
          v.causeBy.skillId = opt.skillId;
        }

        return v;
      });
      sendDealDamageMsg(battleInfo, obj);
    },
    lossMpCallback: (obj) => {
      sendBattleMsg("on_loss_mp", battleInfo, obj);
    },
    restoreMpCallback: (obj) => {
      sendBattleMsg("on_restore_mp", battleInfo, obj);
    },
    floatTextCallback: (obj) => {
      sendFloatTextMsg(battleInfo, obj);
    },
    addStateCallback: (obj) => {
      sendAddStateMsg(battleInfo, obj);
    },
    drawLineCallback: (obj) => {
      sendDrawLineMsg(battleInfo, obj);
    },
    increaseItemCallback: (obj) => {
    },
  };

  return callbacks;
}

export async function removeBattleInfoFromRedis(battleId: string): Promise<void> {
  // 清除本地缓存
  localBattleInfoCache.delete(battleId);
  // 清理去抖写与静态键标记，防止被延迟写回

  const key = getBattleInfoKey(battleId);
  const playerMemberKey = getBattlePlayerMemberInfoKey(battleId);
  const playerMemberSAEKey = getBattlePlayerMemberSaeInfoKey(battleId);
  const playerUuidKey = getBattlePlayerUuidKey(battleId);

  const pipeline = redisClient.multi();
  // 优先使用 UNLINK 异步删除，环境不支持则回退 DEL 同步删除
  const canUnlink = typeof pipeline?.unlink === 'function';
  if (canUnlink) {
    pipeline.unlink(key);
    pipeline.unlink(playerMemberKey);
    pipeline.unlink(playerMemberSAEKey);
    pipeline.unlink(playerUuidKey);
  } else {
    pipeline.del(key);
    pipeline.del(playerMemberKey);
    pipeline.del(playerMemberSAEKey);
    pipeline.del(playerUuidKey);
  }
  await pipeline.exec();
}

export function removeBattleInfoFromMemory(battleId: string): Promise<void> {
  if (!battleId) return Promise.resolve();

  localBattleInfoCache.delete(battleId);

  return Promise.resolve();
}


/**
 * 进入下一个回合
 */
type GotoNextTurnParam = {
  reason: BattlePassTurnReason
  currentTurnUnit?: BaseBattleUnit
}
export function gotoNextTurn(battleInfo: BattleInfo, {reason, currentTurnUnit}: GotoNextTurnParam) {
  // 找到当前回合单位
  const prevTurnIndex = (battleInfo.currentTurnIndex - 1 + battleInfo.turnOrder.length) % battleInfo.turnOrder.length;
  let prevUnitId = battleInfo.turnOrder[prevTurnIndex];

  const callbacksBase = generateCallback(battleInfo, {});

  // 如果有额外行动单位
  if (battleInfo.extraTurnIndex < battleInfo.extraTurnOnBattleBegin?.length) {
    prevUnitId = battleInfo.extraTurnOnBattleBegin[battleInfo.extraTurnIndex]

    battleInfo.extraTurnIndex++
  } else {
    battleInfo.extraTurnOnBattleBegin = []
    battleInfo.extraTurnIndex = 0

    battleInfo.currentTurnIndex = (battleInfo.currentTurnIndex + 1) % battleInfo.turnOrder.length;
  }

  // let prevUnit = battleInfo.members.find(u => u.uuid === prevUnitId);

  // // 第一轮，不会有上一个单位
  // if (battleInfo.passedTurn <= 0) {
  //   prevUnit = undefined
  // }

  // 重置所有单位的状态触发标记
  for (const unit of battleInfo.members) {
    if (unit.state) {
      Object.values(unit.state).forEach(state => {
        state.triggered = false;
      });
    }
  }

  // 移除阵亡单位的所有状态
  for(const unit of battleInfo.members) {
    if (unit.hp <= 0) {
      if (unit.state) {
        for (const stateId of ObjectKeys<AllBattleStateId>(unit.state)) {
          let stateInfo: BattleState = allBattleState[stateId]
          if (!stateInfo.keepOnDeath) {
            detachState(stateId, unit, battleInfo, {
              callbacks: callbacksBase,
              invalidateUnitHookCache,
            });
          }
        }
      }
    }

    // 移除所有由阵亡单位施加的嘲讽
    if (unit.state?.taunt) {
      let tauntAddBy = unit.state.taunt.addBy;
      let tauntAddByUnit = battleInfo.members.find(u => u.uuid === tauntAddBy);
      if ((tauntAddByUnit?.hp ?? 0) <= 0) {
        // 如果嘲讽是由其他单位施加的，移除嘲讽状态
        detachState("taunt", unit, battleInfo, {
          callbacks: callbacksBase,
          invalidateUnitHookCache,
        });
      }
    }

    // let random = randomIntegerInFullCloseRange(1, 50)
    // if (unit.status.attacking.level > 500 + random) {
    //   unit.status.attacking.level = 500 + random; // 限制攻击力上限
    // }
  }

  // 移除所有回合耗尽的召唤单位
  let tmpUnitUuidList: string[] = [];
  for (const unit of battleInfo.members) {
    if (unit.isSummoned && !unit.isPermanentSummoned && (unit.state?.tmpUnit?.remainingDuration ?? 0) <= 0) {
      tmpUnitUuidList.push(unit.uuid);
    }
  }

  // // 检查房间内的召唤物数量，如果超过5个，则进行console.log
  // const totalSummonedUnits = battleInfo.members.filter(u => u.isSummoned).length;
  // if (totalSummonedUnits > 5) {
  //   console.log(`战斗 ${battleInfo.uuid}(${battleInfo.area}) 中的召唤物数量过多，共有 ${totalSummonedUnits} 个召唤物。`);
  // }

  // // 如果战斗中的单位过多，超过25个，则进行console.log
  // const totalUnits = battleInfo.members.length;
  // if (totalUnits > 25) {
  //   console.log(`战斗 ${battleInfo.uuid}(${battleInfo.area}) 中的单位数量过多，共有 ${totalUnits} 个单位。`);
  // }

  // 每个非召唤物单位，只能拥有10个对应的召唤物
  const summonUnitCountMap: Record<string, number> = {};
  for (const unit of battleInfo.members) {
    if (unit.isSummoned && unit.summonedBy) {
      if (!summonUnitCountMap[unit.summonedBy]) {
        summonUnitCountMap[unit.summonedBy] = 0;
      }
      summonUnitCountMap[unit.summonedBy]++;
    }
  }
  for (const summonerUuid in summonUnitCountMap) {
    const count = summonUnitCountMap[summonerUuid];
    if (count > 5) {
      const neededRemovedUnitCount = count - 6;
      let neededRemovedUnits = battleInfo.members.filter(u => u.isSummoned && u.summonedBy === summonerUuid)
        .sort((a, b) => {
          const aDuration = a.state?.tmpUnit?.remainingDuration ?? 0;
          const bDuration = b.state?.tmpUnit?.remainingDuration ?? 0;
          return aDuration - bDuration;
        })
        .slice(0, neededRemovedUnitCount);
      for (const u of neededRemovedUnits) {
        tmpUnitUuidList.push(u.uuid);
      }
    }
  }

  for (const tmpUuid of tmpUnitUuidList) {
    battleInfo.members = battleInfo.members.filter(u => u.uuid !== tmpUuid);
    // 从分组中移除
    for (const groupId in battleInfo.groups) {
      battleInfo.groups[groupId] = battleInfo.groups[groupId].filter(u => u !== tmpUuid);
    }
    // 从turnOrder中移除
    battleInfo.turnOrder = battleInfo.turnOrder.filter(u => u !== tmpUuid);
  }

  // 移除所有阵亡的召唤单位
  let deadTmpUnitUuidList: string[] = [];
  for (const unit of battleInfo.members) {
    if (unit.isSummoned && unit.hp <= 0) {
      deadTmpUnitUuidList.push(unit.uuid);
    }
  }
  for (const deadUuid of deadTmpUnitUuidList) {
    battleInfo.members = battleInfo.members.filter(u => u.uuid !== deadUuid);
    // 从分组中移除
    for (const groupId in battleInfo.groups) {
      battleInfo.groups[groupId] = battleInfo.groups[groupId].filter(u => u !== deadUuid);
    }
    // 从turnOrder中移除
    battleInfo.turnOrder = battleInfo.turnOrder.filter(u => u !== deadUuid);
  }

  if (reason == 'NORMAL') {
    battleInfo.passedTurn += 1;
  }

  if (currentTurnUnit) {
    // 结算完成后，减少当前回合的状态持续时间
    if (currentTurnUnit.state) {
      iteratorUnitState( currentTurnUnit, ({ stateInfo, stateInBattle: state }) => {
        if (!stateInfo.permanent) {
          const stateId = stateInfo.id as AllBattleStateId;
          state.remainingDuration -= 1;
          if (state.remainingDuration <= 0) {
            detachState(stateId, currentTurnUnit, battleInfo, {
              callbacks: callbacksBase,
              invalidateUnitHookCache,
            });
          }
        }
      });
    }

    // 动作执行后，开始处理cd
    // 自身回合结束后，降低所有技能1cd
    if (!currentTurnUnit.skillColddown) {
      currentTurnUnit.skillColddown = {};
    }
    // 如果没有封印，则减少冷却
    if (!hasState(currentTurnUnit, 'skillSeal')) {
      reduceUnitSkillColddown(currentTurnUnit);
    }

    // 物品冷却
    ObjectKeys<AllGameResourceID>(currentTurnUnit.inventory ?? {}).forEach(
      (itemId) => {
        let inventoryItem = currentTurnUnit.inventory?.[itemId];
        if (!inventoryItem) return;

        if (!inventoryItem.cooldown) {
          inventoryItem.cooldown = 0; // 确保有初始值
          return;
        }

        inventoryItem.cooldown -= 1;
        if (inventoryItem.cooldown < 0) {
          inventoryItem.cooldown = 0; // 确保不小于0
        }
      }
    );

    // 视为这个单位行动过
    if (!currentTurnUnit.tbi) {
      currentTurnUnit.tbi = {}
    }
    currentTurnUnit.tbi.acted = true;
  }
}


export function sendDealDamageMsg(battleInfo: BattleInfo, obj: {
  source: BaseBattleUnit, 
  target: DealDamageTargetDetail[],
  hideAnimEffect_Line?: boolean
}) {
  pushMessageToQueue({
    type: 'on_deal_damage',
    battleUuid: battleInfo.uuid,
    battleInfo,
    info: {
      source: obj.source.uuid,
      target: obj.target.map(t => ({
        unit: t.unit.uuid,
        shieldDamage: t.shieldDamage ?? 0,
        causeBy: t.causeBy,
        damageType: t.damageType,
        value: t.value,
        remainingHp: t.remainingHp,
        fDamage: t.fDamage,
      })),
      hideAnimEffect_Line: obj.hideAnimEffect_Line
    }
  })
}

export function sendDrawLineMsg(battleInfo: BattleInfo, obj: {
  source: BaseBattleUnit, 
  target: BaseBattleUnit,
  color: string
}) {
  if (!obj?.source || !obj?.target) {
    return
  }

  pushMessageToQueue({
    type: 'draw_line',
    battleUuid: battleInfo.uuid,
    battleInfo,
    info: {
      source: obj.source.uuid,
      target: obj.target.uuid,
      color: obj.color
    }
  })
}

export function sendBattleMsg(type: 'on_heal' | 'on_loss_mp' | 'on_restore_mp', battleInfo: BattleInfo, obj: {source: BaseBattleUnit, target: BaseBattleUnit, value: number}) {
  if (obj.value <= 0) {
    return
  }

  pushMessageToQueue({
    type: type,
    battleUuid: battleInfo.uuid,
    battleInfo,
    info: {
      source: obj.source.uuid,
      target: obj.target.uuid,
      value: obj.value,
    }
  })
}

export function sendAddStateMsg(battleInfo: BattleInfo, obj: {source: BaseBattleUnit, target: BaseBattleUnit, value: number, stateId: AllBattleStateId}) {
  if (obj.value <= 0) {
    return
  }

  pushMessageToQueue({
    type: 'on_add_state',
    battleUuid: battleInfo.uuid,
    battleInfo,
    info: {
      source: obj.source.uuid,
      target: obj.target.uuid,
      value: obj.value,
      stateId: obj.stateId
    }
  })
}

export function sendFloatTextMsg(battleInfo: BattleInfo, obj: { unit: BaseBattleUnit, text: string, hidePopover?: boolean }) {
  pushMessageToQueue({
    type: 'battle_float_text',
    battleUuid: battleInfo.uuid,
    battleInfo,
    info: {
      unit: obj.unit.uuid,
      text: obj.text,
      hidePopover: obj.hidePopover
    }
  })
}

export function sendCastSkillMsg(
  battleInfo: BattleInfo,
  obj: {
    source: BaseBattleUnit;
    skillId: AllBattleSkillId;
  }
) {
  pushMessageToQueue?.({
    type: "on_cast_skill",
    battleUuid: battleInfo.uuid,
    battleInfo,
    info: {
      source: obj.source.uuid,
      skillId: obj.skillId,
    },
  });
}

export async function onUseBattleInventoryItem(
  currentUnit: BaseBattleUnit,
  usableItem: AllGameResourceID,
  battleInfo: BattleInfo,
  callbacks: BattleCallback
) {
  let itemInfo = allGameResourceWithInternal[usableItem];

  if (!itemInfo) {
    return
  }

  if (!currentUnit?.inventory?.[usableItem]) {
    return
  }

  pushMessageToQueue({
    type: "use_battle_item",
    battleUuid: battleInfo.uuid,
    battleInfo,
    info: {
      user: currentUnit.uuid,
      itemId: usableItem,
      remainingCount: currentUnit.inventory[usableItem].remainingCount,
    }
  })

  for (const effect of itemInfo.inBattleEffect ?? []) {
    if (effect.currentHpModify) {
      // await healUnit(currentUnit, currentUnit, effect.currentHpModify, {
      healUnit(currentUnit, currentUnit, effect.currentHpModify, {
        callbacks,
        battleInfo,
        reason: HpRestoreReason.USE_ITEM_RESTORE,
        callback: (obj) => {
          sendBattleMsg("on_heal", battleInfo, obj);
        },
      });
    }
    if (effect.currentMpModify) {
      restoreMp(currentUnit, currentUnit, effect.currentMpModify, {
        reason: MpRestoreReason.USE_ITEM_RESTORE,
        callback: (obj) => {
          sendBattleMsg("on_restore_mp", battleInfo, obj);
        },
      });
    }

    if (effect.addState) {
     await addState(effect.addState.id, effect.addState.duration, currentUnit, currentUnit, {}, {
      battleInfo,
      callbacks
     })
    }
  }

  if (allResourceTriggerData[usableItem]?.onUse) {
    const callbacksForItem = generateCallback(battleInfo, {});
    await allResourceTriggerData[usableItem].onUse({ itemId: usableItem, self: currentUnit, battleInfo, callbacks: callbacksForItem});
  }

  let colddown = (itemInfo.inBattleCooldown ?? 3)

  // 因为回合结束就会-1，所以这里需要+1
  currentUnit.inventory[usableItem].cooldown = colddown > 0 ? (colddown + 1) : colddown

  currentUnit.inventory[usableItem].remainingCount -= 1

  // 发送广播
  // 不小于0
  if (currentUnit.inventory[usableItem].remainingCount < 0) {
    currentUnit.inventory[usableItem].remainingCount = 0;
  }
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

export function checkLogic(
  logicArr: GameBattleLogic[] | GameBattleLogic[][] | undefined,
  context: {
    self: BaseBattleUnit,
    allies: BaseBattleUnit[],
    enemies: BaseBattleUnit[],
    battleInfo: BattleInfo
  }
): boolean {
  if (!logicArr || logicArr.length === 0) return true;
  if (Array.isArray(logicArr[0])) {
    // 二维数组，分组间 or
    return (logicArr as GameBattleLogic[][]).some((group) => {
      return checkGroupLogic(group, context);
    });
  } else {
    // 一维数组，兼容老数据
    return checkGroupLogic(logicArr as GameBattleLogic[], context);
  }
}

function checkGroupLogic(
  logicArr: GameBattleLogic[] | undefined,
  context: {
    self: BaseBattleUnit,
    allies: BaseBattleUnit[],
    enemies: BaseBattleUnit[],
    battleInfo: BattleInfo
  }
): boolean {
  if (!logicArr || logicArr.length === 0) return true;

  let iterateFunc: 'some' | 'every' = 'some';

  return logicArr.every(logic => {
    let targetUnits: BaseBattleUnit[] = [];
    switch (logic.target) {
      case GameBattleLogicTarget.Self:
        targetUnits = [context.self];
        break;
      case GameBattleLogicTarget.SelfSummonedUnit:
        targetUnits = context.battleInfo.members.filter(u => u.isSummoned && u.summonedBy === context.self.uuid);
        break;
      case GameBattleLogicTarget.Allies:
        targetUnits = context.allies;
        break;
      case GameBattleLogicTarget.Enemies:
        targetUnits = context.enemies;
        break;
      case GameBattleLogicTarget.EachAllies:
        targetUnits = context.allies;
        iterateFunc = 'every'
        break;
      case GameBattleLogicTarget.EachEnemies:
        targetUnits = context.enemies;
        iterateFunc = 'every'
        break;
      case GameBattleLogicTarget.All:
        targetUnits = [context.self, ...context.allies, ...context.enemies];
        break;
      case GameBattleLogicTarget.None:
        targetUnits = [context.self]
        break;
    }

    if (![GameBattleLogicTarget.None, GameBattleLogicTarget.SelfSummonedUnit].includes(logic.target) && targetUnits.length === 0) return false;

    if (!logic.compareType || logic.compareType === "value") {
      return targetUnits[iterateFunc](unit => {
        let value = 0;
        switch (logic.dataType) {
          case GameBattleLogicDataType.Hp:
            value = unit.hp;
            break;
          case GameBattleLogicDataType.Mp:
            value = unit.mp;
            break;
          case GameBattleLogicDataType.LostHp:
            value = unit.maxHp - unit.hp;
            break;
          case GameBattleLogicDataType.LostMp:
            value = unit.maxMp - unit.mp;
            break;
          case GameBattleLogicDataType.TotalHp:
            value = targetUnits.reduce((sum, u) => sum + u.hp, 0);
            break;
          case GameBattleLogicDataType.Count:
            value = targetUnits.length;
            break;
          case GameBattleLogicDataType.BuffCount:
            value = Object.values(unit.state ?? {}).filter((s) => {
              let stateId = s.id as AllBattleStateId
              let state = allBattleState?.[stateId]

              return state?.isBuff && s.remainingDuration > 0;
            }).length;
            break;
          case GameBattleLogicDataType.DebuffCount:
            value = Object.values(unit.state ?? {}).filter((s) => {
              let stateId = s.id as AllBattleStateId
              let state = allBattleState?.[stateId]

              return state?.isDebuff && s.remainingDuration > 0;
            }).length;
            break;
          case GameBattleLogicDataType.FurryStaticElectricityStack:
            value = getStateExtraStack(unit.state?.furryStaticElectricity)
            break;
          case GameBattleLogicDataType.FurryStaticElectricityOverloadStack:
            value = getStateExtraStack(unit.state?.furryStaticElectricityOverload)
            break;
          case GameBattleLogicDataType.PassedTurn:
            value = context.battleInfo.passedTurn + 1;
            break;
        }
        let cond = logic.valueConditionValue;
        let compareValue: number;
        if (typeof cond === "string" && cond.endsWith("%")) {
          const percent = parseFloat(cond) / 100;
          if (
            logic.dataType === GameBattleLogicDataType.Hp ||
            logic.dataType === GameBattleLogicDataType.LostHp
          ) {
            compareValue = Math.round(unit.maxHp * percent);
          } else if (
            logic.dataType === GameBattleLogicDataType.Mp ||
            logic.dataType === GameBattleLogicDataType.LostMp
          ) {
            compareValue = Math.round(unit.maxMp * percent);
          } else if (logic.dataType === GameBattleLogicDataType.TotalHp) {
            const totalMaxHp = targetUnits.reduce((sum, u) => sum + u.maxHp, 0);
            compareValue = Math.round(totalMaxHp * percent);
          } else {
            compareValue = percent * value;
          }
        } else {
          compareValue = typeof cond === "number" ? cond : parseFloat(cond as string);
        }

        switch (logic.valueCompareAction) {
          case GameBattleLogicValueCompareAction.LargeThan: return value > compareValue;
          case GameBattleLogicValueCompareAction.LargeEqualThan: return value >= compareValue;
          case GameBattleLogicValueCompareAction.SmallThan: return value < compareValue;
          case GameBattleLogicValueCompareAction.SmallEqualThan: return value <= compareValue;
          case GameBattleLogicValueCompareAction.EqualThan: return value === compareValue;
          default: return false;
        }
      });
    } else if (logic.compareType === 'unitExistState') {
      const unitId = logic.unitId;
      let res = false;
      switch (logic.unitExistCompareAction) {
        case GameBattleLogicUnitExistStateCompareAction.Exist: 
          res = targetUnits.some(unit => unit.id === unitId)
          break;
        case GameBattleLogicUnitExistStateCompareAction.NotExist: 
          res = !targetUnits.length || targetUnits.every(unit => unit.id !== unitId)
          break;
        default: 
          res = false;
          break;
      }
      return res
    } else if (logic.compareType === "state") {
      // 状态判断，兼容多种判断方式
      const stateId = logic.stateCompareStateId as AllBattleStateId;
      switch (logic.stateCompareAction) {
        case GameBattleLogicStateCompareAction.SomeoneHasState:
          return targetUnits.some(unit => !!unit.state?.[stateId]);
        case GameBattleLogicStateCompareAction.AllHasState:
          return targetUnits.every(unit => !!unit.state?.[stateId]);
        case GameBattleLogicStateCompareAction.SomeoneNotHasState:
          return targetUnits.some(unit => {
            return !unit.state?.[stateId]
          });
        case GameBattleLogicStateCompareAction.AllNotHasState:
          return targetUnits.every(unit => !unit.state?.[stateId]);
        default:
          return true;
      }
    } else if (logic.compareType === 'stateStack') {
      const stateId = logic.stateCompareStateId as AllBattleStateId;
      let compareValue = logic.valueConditionValue ?? 0;
      return targetUnits.some(unit => {
        if (!hasState(unit, logic.stateCompareStateId)) {
          return false;
        }

        let stateStack = getStateExtraStack(unit.state![stateId]);

        switch (logic.valueCompareAction) {
          case GameBattleLogicValueCompareAction.LargeThan: return stateStack > compareValue;
          case GameBattleLogicValueCompareAction.LargeEqualThan: return stateStack >= compareValue;
          case GameBattleLogicValueCompareAction.SmallThan: return stateStack < compareValue;
          case GameBattleLogicValueCompareAction.SmallEqualThan: return stateStack <= compareValue;
          case GameBattleLogicValueCompareAction.EqualThan: return stateStack === compareValue;
          default: return false;
        }
      })
    } else if (logic.compareType === "cooldown") {
      // 技能冷却判断
      return targetUnits[iterateFunc](unit => {
        const skillColddown = unit.skillColddown ?? {};
        const ids = logic.cooldownSkillIds;
        switch (logic.cooldownCompareAction) {
          case "allInCooldown":
            return ids.every(id => (skillColddown[id] ?? 0) > 0);
          case "allNotInCooldown":
            return ids.every(id => (skillColddown[id] ?? 0) === 0);
          case "someoneInCooldown":
            return ids.some(id => (skillColddown[id] ?? 0) > 0);
          case "someoneNotInCooldown":
            return ids.some(id => (skillColddown[id] ?? 0) === 0);
          case "inCooldown":
            // 只判断第一个id
            return (skillColddown[ids[0]] ?? 0) > 0;
          case "notInCooldown":
            return (skillColddown[ids[0]] ?? 0) === 0;
          default:
            return false;
        }
      });
    } else if (logic.compareType === "itemCooldown") {
      // 技能冷却判断
      return targetUnits[iterateFunc](unit => {
        const itemCooldown = unit.inventory ?? {};
        const ids = logic.cooldownItemIds;
        switch (logic.cooldownCompareAction) {
          case "allInCooldown":
            return ids.every(id => (itemCooldown[id]?.cooldown ?? 0) > 0);
          case "allNotInCooldown":
            return ids.every(id => (itemCooldown[id]?.cooldown ?? 0) === 0);
          case "someoneInCooldown":
            return ids.some(id => (itemCooldown[id]?.cooldown ?? 0) > 0);
          case "someoneNotInCooldown":
            return ids.some(id => (itemCooldown[id]?.cooldown ?? 0) === 0);
          case "inCooldown":
            // 只判断第一个id
            return (itemCooldown[ids[0]]?.cooldown ?? 0) > 0;
          case "notInCooldown":
            return (itemCooldown[ids[0]]?.cooldown ?? 0) === 0;
          default:
            return false;
        }
      });
    } else if (logic.compareType === "special") {
      // 特殊判断分类
      switch (logic.specialAction) {
        case GameBattleLogicSpecialAction.EnemyHasBoss:
          // 判断敌方单位中是否存在 isBoss 属性为 true 的单位
          return context.enemies.some(unit => (unit as Enemy).isBoss)
        case GameBattleLogicSpecialAction.EnemyNotHasBoss:
          // 判断敌方单位中是否完全不存在 isBoss 属性为 true 的单位
          return context.enemies.every(unit => !(unit as Enemy).isBoss)
        // 未来可扩展更多特殊判断
        default:
          return false;
      }
    }
    return false;
  });
}

export async function unitUseItem(
  currentUnit: BaseBattleUnit,
  battleInfo: BattleInfo,
  opt: {
    phase: AllBattlePhase;
    allyUnits: BaseBattleUnit[];
    enemyUnits: BaseBattleUnit[];
    callbacksBase: BattleCallback;
  },
) {
  const { allyUnits, enemyUnits, callbacksBase, phase } = opt;

  let usableItem: AllGameResourceID | undefined = undefined;

  const currentUnitBattleInventory = ObjectKeys<AllGameResourceID>(
    currentUnit.inventory ?? {},
  );

  if (!currentUnitBattleInventory.length) {
    return;
  }

  const inventoryItems = currentUnitBattleInventory
    .map((itemId) => ({
      itemId,
      item: currentUnit.inventory?.[itemId],
      order: currentUnit.inventory?.[itemId]?.order ?? 0,
    }))
    .filter((itemBaseInfo) => {
      if (!itemBaseInfo.item) return false;
      // 先过滤掉无效物品
      if (itemBaseInfo.item.remainingCount <= 0) return false;
      if (itemBaseInfo.item.cooldown) return false;

      // 检查物品的 useWhen 条件
      // 没有条件，默认为自身回合开始
      if (!itemBaseInfo.item.useWhen) {
        if (phase != AllBattlePhase.SELF_TURN_START) {
          return false;
        }
      } else {
        // 如果有条件，检查当前阶段是否包含在内
        if (!itemBaseInfo.item.useWhen.includes(phase)) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => a.order - b.order); // 按 order 升序排序

  for (const itemBaseInfo of inventoryItems) {
    const item = itemBaseInfo.item;
    if (!item) continue;
    const logic = item.ai ?? [];
    const canUse = checkLogic(logic, {
      self: currentUnit,
      allies: allyUnits,
      enemies: enemyUnits,
      battleInfo,
    });

    if (canUse) {
      usableItem = itemBaseInfo.itemId;
      break; // 找到第一个满足条件的物品就退出
    }
  }

  // 可以使用物品时，直接使用物品
  if (usableItem) {
    // 更新数据库
    let used = true;
    // 非环境单位且是玩家，则需要消耗物品
    if (currentUnit.isPlayer) {
      used = await useBattleInventoryItem(currentUnit.uuid, usableItem, 1);
    }

    // 触发使用物品行为
    if (used) {
      await onUseBattleInventoryItem(
        currentUnit,
        usableItem,
        battleInfo,
        callbacksBase,
      );
    }
  }
}

/**
 * 处理一轮战斗逻辑（自动选择目标并造成伤害，可扩展技能/治疗）
 * 
 * 
 * 
  回合内的逻辑：
  回合开始阶段（触发技能、装备、状态的回合开始效果）
  触发回合开始
  状态检查阶段（对每个状态进行结算）
  控制状态检查（这个阶段内，如果检查到存在控制类型的状态，则回合结束）
  物品使用阶段（对每个物品袋内的进行逻辑判断，对第一个满足使用要求的物品进行使用）
  技能选择阶段（对携带的每个技能进行逻辑判断，对第一个满足释放要求的技能进行释放）
  沉默状态检查（如果存在沉默状态，则选择的技能被替换为普通攻击）
  执行技能阶段（执行技能效果）
  技能执行中阶段
  如果技能包含伤害，依次触发以下效果：伤害来源造成伤害前->伤害目标受到伤害前
  技能执行完成阶段
    - 如果是普通攻击，触发“在普通攻击后”效果
    - 如果是技能，触发“在技能释放后”效果
  返还冷却
 * 
 * 
 * 
 */
export async function runBattleRound(battleInfo: BattleInfo, battleRoom: BattleRoom): 
Promise<{
  battleInfo: BattleInfo,
  thisRoundAction: FullBattleAction | undefined,
  canPassTurn: Boolean,
  currentUnit?: BaseBattleUnit
}> {
  if (battleRoom.beForceRestart) {
    battleInfo.battleStatus = BattleStatus.PLAYER_LOSE;

    delete battleRoom.beForceRestart;
    await updateRoom(battleRoom.uuid, battleRoom);

    // await setBattleInfoToRedis(battleInfo);
    return { battleInfo, thisRoundAction: undefined, canPassTurn: true };
  }

  const currentTurnIndex = battleInfo.currentTurnIndex;
  let currentUnitId = battleInfo.turnOrder[currentTurnIndex];

  // 如果有额外的战斗开始回合
  if (battleInfo.extraTurnOnBattleBegin?.length) {
    let extraTurnIndex = battleInfo.extraTurnIndex;

    let extraTurnUnitUuid = battleInfo.extraTurnOnBattleBegin[extraTurnIndex];

    if (extraTurnUnitUuid) {
      currentUnitId = extraTurnUnitUuid
    }
  }

  const scratch = getBattleScratch(battleInfo);
  scratch.unitMap.clear();
  for (const unit of battleInfo.members) {
    scratch.unitMap.set(unit.uuid, unit);
  }

  let currentUnit = scratch.unitMap.get(currentUnitId);

  // Pre-generate base callbacks for this round to avoid allocating repeatedly
  const callbacksBase = generateCallback(battleInfo, {});

  battleInfo.currentTurnUnitUuid = currentUnit?.uuid || currentUnitId;

  const playerGroupId = battleInfo.playerGroupId;

  // 检查是否还有存活单位（避免重复构建数组）
  let aliveUnitCount = 0;
  for (const unit of battleInfo.members) {
    if (unit && unit.hp > 0) {
      aliveUnitCount++;
    }
  }

  try {
    if (!currentUnit || currentUnit.hp <= 0) {
      // 如果没有存活单位，直接判定战斗结束，防止死循环
      if (aliveUnitCount === 0) {
        battleInfo.battleStatus = BattleStatus.PLAYER_LOSE;
        await setBattleInfoIntoMemory(battleInfo);
        return { battleInfo, thisRoundAction: undefined, canPassTurn: true };
      }

      // 移除自身全部状态
      if (currentUnit?.state) {
        for (const stateId in currentUnit.state) {
          const typedStateId = stateId as AllBattleStateId;
          const stateInfo = allBattleState[typedStateId] as BattleState;
          if (!stateInfo.keepOnDeath) {
            detachState(typedStateId, currentUnit, battleInfo, {
              callbacks: callbacksBase,
              invalidateUnitHookCache,
            });
          }
        }
      }

      // 敌方阵营没有单位存活，战斗结束
      if (!getAliveEnemyUnits(battleInfo, playerGroupId).length) {
        battleInfo.battleStatus = BattleStatus.PLAYER_WIN;

        return { battleInfo, thisRoundAction: undefined, canPassTurn: true };
      }

      // 玩家阵营没有玩家存活，战斗结束
      if (!getAliveAllyUnits(battleInfo, playerGroupId).length) {
        battleInfo.battleStatus = BattleStatus.PLAYER_LOSE;

        return { battleInfo, thisRoundAction: undefined, canPassTurn: true };
      }

      // 如果所有有回合的单位都死亡了，战斗结束
      let hasAliveUnitWithTurn = false;
      for (const uuid of battleInfo.turnOrder) {
        const unit = scratch.unitMap.get(uuid);
        if (unit && unit.hp > 0) {
          hasAliveUnitWithTurn = true;
          break;
        }
      }
      if (!hasAliveUnitWithTurn) {
        battleInfo.battleStatus = BattleStatus.PLAYER_LOSE;
        await setBattleInfoIntoMemory(battleInfo);
        return { battleInfo, thisRoundAction: undefined, canPassTurn: true };
      }

      // 如果行动队列中不存在单位，战斗结束
      if (!battleInfo.turnOrder.length) {
        battleInfo.battleStatus = BattleStatus.PLAYER_LOSE;
        await setBattleInfoIntoMemory(battleInfo);
        return { battleInfo, thisRoundAction: undefined, canPassTurn: true };
      }

      // 如果此时战斗中只有1个单位，则结算为战斗失败
      if (battleInfo.turnOrder.length === 1) {
        if (battleInfo.members.length === 1) {
          battleInfo.battleStatus = BattleStatus.PLAYER_LOSE;
          await setBattleInfoIntoMemory(battleInfo);
          return { battleInfo, thisRoundAction: undefined, canPassTurn: true };
        }
      }

      gotoNextTurn(battleInfo, {
        currentTurnUnit: currentUnit,
        reason: "DEAD",
      });
      // 递归调用，直到遇到存活单位或战斗结束
      return await runBattleRound(battleInfo, battleRoom);
    }
  } catch (e) {
    console.error("==========");
    console.error("Error in runBattleRound check currentUnit alive:", e);
    console.error(
      battleInfo.members.map((u) => ({ uuid: u.uuid, name: u.name, hp: u.hp }))
    );
    console.error("turn order", battleInfo.turnOrder);
    console.error(
      "current",
      battleInfo.currentTurnUnitUuid,
      battleInfo.currentTurnIndex
    );
    console.error("==========");

    throw e;
  }

  const aliveEnemies = getAliveEnemyUnits(battleInfo, playerGroupId);
  // 敌方阵营没有单位存活，战斗结束
  if (!aliveEnemies.length) {
    battleInfo.battleStatus = BattleStatus.PLAYER_WIN;

    return { battleInfo, thisRoundAction: undefined, canPassTurn: true  };
  }

  // 玩家阵营没有玩家存活，战斗结束
  let playerMembers = battleInfo.groups[playerGroupId] || [];
  let hasAlivePlayer = playerMembers.some((uuid) => {
    const unit = scratch.unitMap.get(uuid);
    return unit && unit.hp > 0;
  });
  if (!hasAlivePlayer) {
    battleInfo.battleStatus = BattleStatus.PLAYER_LOSE;
    // battleInfo.members = battleInfo.members.filter((unit) => {
    //   return unit.hp > 0 && unit.isPlayer;
    // });
    await setBattleInfoIntoMemory(battleInfo);
    return { battleInfo, thisRoundAction: undefined, canPassTurn: true };
  }

  const aliveAllies = getAliveAllyUnits(battleInfo, playerGroupId);
  if (!aliveAllies.length) {
    battleInfo.battleStatus = BattleStatus.PLAYER_LOSE;

    return { battleInfo, thisRoundAction: undefined, canPassTurn: true  };
  }

  // 找到当前单位分组
  const currentGroupId = getUnitGroupId(battleInfo.groups, currentUnitId);
  if (!currentGroupId) {
    gotoNextTurn(battleInfo, {
      currentTurnUnit: currentUnit,
      reason: 'EXPECTION'
    });
    await setBattleInfoIntoMemory(battleInfo);
    return { battleInfo, thisRoundAction: undefined, canPassTurn: true  };
  }


  const info = getBaseInfoFromBattleInfo(currentUnit, battleInfo);
  if (!info) {
    throw new Error(`Cannot get base info from battle info for unit ${currentUnit.uuid} in battle ${battleInfo.uuid}`);
  }

  let allAllyUnit: BaseBattleUnit[] = info?.allAllies;
  let allEnemies: BaseBattleUnit[] = info?.allEnemies;

  // 不包含被放逐的单位
  allAllyUnit = getAvailableUnitCollection(allAllyUnit, {
    includeDead: true,
    includeSneak: true,
  })
  allEnemies = getAvailableUnitCollection(allEnemies, {
    includeDead: true,
    includeSneak: true,
  })

  const allies = allAllyUnit.filter(u => u.hp > 0);
  const enemies = allEnemies.filter(u => u.hp > 0);

  // 触发回合开始行为
  await iteratorUnitEquipmentAsync(currentUnit, async ({ equipmentTrigger, equipmentId }) => {
    if (equipmentTrigger?.onTurnStart) {
      await equipmentTrigger.onTurnStart({
        allAllies: allAllyUnit,
        allEnemies: allEnemies,
        allies,
        enemies,
        self: currentUnit,
        battleInfo,
        equipmentId,
        callbacks: callbacksBase,
      });
    }
  }, { requiredHook: 'onTurnStart'});

  pushMessageToQueue({
    type: "on_turn_start",
    battleUuid: battleInfo.uuid,
    battleInfo,
    info: {
      source: currentUnit.uuid,
    },
  });

  const isFluster = !!currentUnit.state?.fluster
  const isTaunted = !!currentUnit.state?.taunt
  const isConfusion = hasState(currentUnit, 'confusion')

  let turnStartHpHeal = (currentUnit.status.stamina?.level ?? 0) * HP_REGEN_PER_TURN_PRE_STAMINA
  let turnStartMpRegen = (currentUnit.status.intelligence?.level ?? 0) * MP_REGEN_PER_TURN_PRE_INTELLIGENCE

  // 检查装备提供的恢复
  if (currentUnit.equipment) {
    Object.values(currentUnit.equipment).forEach(equipmentId => {
      let equipment = allGameResourceWithInternal[equipmentId];
      if (!equipment) return;

      for(const equipEffect of equipment.onEquip ?? []) {
        if (equipEffect.hpRegen?.increase) {
          turnStartHpHeal += equipEffect.hpRegen.increase;
        }
        if (equipEffect.mpRegen?.increase) {
          turnStartMpRegen += equipEffect.mpRegen.increase;
        }
      }
    })
  }

  // 检查状态提供的恢复
  if (currentUnit.state) {
    iteratorUnitState(currentUnit, ({ stateInfo, stateInBattle: thisState }) => {
      let thisStateExtraHpRegenWhenTurnStart =
        stateInfo.extraHpRegenWhenTurnStart?.({
          self: currentUnit,
          allies: allAllyUnit,
          enemies: allEnemies,
          battleInfo,
          thisState,
        }) ?? 0;
        turnStartHpHeal += thisStateExtraHpRegenWhenTurnStart
    }, { requiredHook: 'extraHpRegenWhenTurnStart' })

    iteratorUnitState(currentUnit, ({ stateInfo, stateInBattle: thisState }) => {
      let thisStateExtraMpRegenWhenTurnStart =
        stateInfo.extraMpRegenWhenTurnStart?.({
          self: currentUnit,
          allies: allAllyUnit,
          enemies: allEnemies,
          battleInfo,
          thisState,
        }) ?? 0;
        turnStartMpRegen += thisStateExtraMpRegenWhenTurnStart
    }, { requiredHook: 'extraHpRegenWhenTurnStart' })
  }

  iteratorUnitEquipment(currentUnit, ({ equipmentTrigger, equipmentId }) => {
    turnStartHpHeal +=
      equipmentTrigger?.extraHpRegenWhenTurnStart?.({
        self: currentUnit,
        battleInfo,
        equipmentId,
      }) ?? 0;
  }, { requiredHook: 'extraHpRegenWhenTurnStart'});

  iteratorUnitEquipment(currentUnit, ({ equipmentTrigger, equipmentId }) => {
    turnStartMpRegen +=
      equipmentTrigger?.extraMpRegenWhenTurnStart?.({
        self: currentUnit,
        battleInfo,
        equipmentId,
      }) ?? 0;
  }, { requiredHook: 'extraMpRegenWhenTurnStart'});

  // HP regen nodes
  iteratorUnitSkillNode(currentUnit, (node, level) => {
    let thisNodeExtraHpRegenWhenTurnStart = 0;
    if (node.businessBattleEffects?.extraHpRegenWhenTurnStart) {
      thisNodeExtraHpRegenWhenTurnStart += node.businessBattleEffects.extraHpRegenWhenTurnStart({ self: currentUnit, level }) ?? 0;
    }
    turnStartHpHeal += thisNodeExtraHpRegenWhenTurnStart;
  }, { requiredHook: 'extraHpRegenWhenTurnStart' })

  // MP regen nodes
  iteratorUnitSkillNode(currentUnit, (node, level) => {
    let thisNodeExtraMpRegenWhenTurnStart = 0;
    if (node.businessBattleEffects?.extraMpRegenWhenTurnStart) {
      thisNodeExtraMpRegenWhenTurnStart += node.businessBattleEffects.extraMpRegenWhenTurnStart({ self: currentUnit, level }) ?? 0;
    }
    turnStartMpRegen += thisNodeExtraMpRegenWhenTurnStart;
  }, { requiredHook: 'extraMpRegenWhenTurnStart' })

  await healUnit(currentUnit, currentUnit, turnStartHpHeal, {
    reason: HpRestoreReason.TURN_START_RESTORE,
    battleInfo,
    callbacks: callbacksBase,
    callback: (obj) => {
      sendBattleMsg("on_heal", battleInfo, obj);
    },
  });
  restoreMp(currentUnit, currentUnit, turnStartMpRegen, {
    reason: MpRestoreReason.TURN_START_RESTORE,
    callback: (obj) => {
      sendBattleMsg("on_restore_mp", battleInfo, obj);
    },
  });

  if (isTaunted) {
    allAllyUnit = getAllyUnits(battleInfo, currentGroupId)
    let tauntSource = getBattleScratch(battleInfo).unitMap.get(currentUnit.state?.taunt?.addBy ?? "");
    if (tauntSource) {
      allEnemies = [tauntSource]
    } else {
      allEnemies = getEnemyUnits(battleInfo, currentGroupId)
    }
  }

  // 被混淆的话，会把敌人视为友军，友军视为敌人
  if (isConfusion) {
    const mixedAllAlly = clone(allAllyUnit)
    const mixedAllEnemy = clone(allEnemies)
    allAllyUnit = mixedAllEnemy;
    allEnemies = mixedAllAlly;
  }

  // 混乱优先于嘲讽
  if (isFluster) {
    allAllyUnit = getAllUnit(battleInfo)
    allEnemies = getAllUnit(battleInfo)
  } 

  const allyUnits = allAllyUnit.filter(u => u.hp > 0);
  const enemyUnits = allEnemies.filter(u => u.hp > 0);

  // 找到当前单位的所有状态
  const stateInfo = currentUnit.state
  let hasControled: boolean = false;
  if (stateInfo) {
    for (const tStateId in stateInfo) {
      const stateId = tStateId as AllBattleStateId;
      const thisState = stateInfo[stateId];
      const stateData: BattleState = allBattleState[stateId];
      if (!thisState || !stateData) continue; // <-- 修复点
      if (!thisState) continue;
      if (
        thisState.remainingDuration > 0 &&
        stateData.StateEffectTriggerWhen == StateEffectTriggerWhen.TURN_START &&
        !thisState.triggered // 防止重复结算
      ) {
        thisState.triggered = true;
        const actionResult = await stateData.effect?.({
          self: currentUnit,
          allies: allyUnits,
          enemies: enemyUnits,
          battleInfo,
          thisState: thisState,
          callbacks: callbacksBase,
          healCallback: (obj) => { sendBattleMsg("on_heal", battleInfo, obj) },
          lossMpCallback: (obj) => { sendBattleMsg("on_loss_mp", battleInfo, obj) },
          restoreMpCallback: (obj) => { sendBattleMsg("on_restore_mp", battleInfo, obj) },
        });
        if (actionResult) {
          if (allBattleState[stateId].consumeTurn) {
            hasControled = true
          }
        }
      }
    }
  }

  // 状态结算后，可能单位便会阵亡，因此这里还要再判断一次
  if (currentUnit.hp <= 0) {
    // 如果没有存活单位，直接判定战斗结束，防止死循环
    let hasAliveUnitWithTurn = false;
    for (const id of battleInfo.turnOrder) {
      const unit = getBattleScratch(battleInfo).unitMap.get(id);
      if (unit && unit.hp > 0) {
        hasAliveUnitWithTurn = true;
        break;
      }
    }
    if (!hasAliveUnitWithTurn) {
      battleInfo.battleStatus = BattleStatus.PLAYER_LOSE;
      await setBattleInfoIntoMemory(battleInfo);
      return { battleInfo, thisRoundAction: undefined, canPassTurn: true };
    }

    // 移除自身全部状态
    if (currentUnit?.state) {
      for (const stateId in currentUnit.state) {
        const typedStateId = stateId as AllBattleStateId;
        const stateInfo = allBattleState[typedStateId] as BattleState;
        if (!stateInfo.keepOnDeath) {
          detachState(typedStateId, currentUnit, battleInfo, {
            callbacks: callbacksBase,
            invalidateUnitHookCache,
          });
        }
      }
    }

    gotoNextTurn(battleInfo, {
      currentTurnUnit: currentUnit,
      reason: 'DEAD'
    });
    // 递归调用，直到遇到存活单位或战斗结束
    return await runBattleRound(battleInfo, battleRoom);
  }


  // 没有被控制，尝试使物品
  if (!hasControled && currentUnit.canUseItem) {
    await unitUseItem(currentUnit, battleInfo, {
      allyUnits,
      enemyUnits,
      callbacksBase,
      phase: AllBattlePhase.SELF_TURN_START
    });
  }

  // 选择目标（默认选第一个存活敌人，可扩展AI/策略）
  // 在这里，我们需要选择一个满足条件的技能，进行释放
  // 找到第一个满足条件且没有cd的技能

  let availableSkillId: AllBattleSkillId | undefined = undefined
  let thisRoundAction: FullBattleAction | undefined

  // 没有被控制，执行技能释放/普通攻击
  if (!hasControled) {
    availableSkillId = ObjectKeys<AllBattleSkillId>(currentUnit.skills ?? {})
      // .filter(skillId => skillId !== 'baseAttack')
      .map(skillId => ({
        skillId,
        order: currentUnit.skills?.[skillId]?.order ?? 0
      }))
      .sort((a, b) => a.order - b.order)
      .map(item => item.skillId)
      .find(skillId => {
        const skillData = allGameBattleSkills[skillId] as GameBattleSkill;
        if (!skillData) return false;
        if (skillData.passive) return false;
        if ((currentUnit?.skillColddown?.[skillId] ?? 0) > 0) return false;

        // 检查技能是否有mp消耗
        if (skillData.mpCost && currentUnit.mp < skillData.mpCost) return false;

        // 检查技能释放逻辑
        const skillLogic = currentUnit.ai?.[skillId];
        const canCastByLogic = checkLogic(skillLogic, {
          self: currentUnit,
          allies: allyUnits,
          enemies: enemyUnits,
          battleInfo
        });
        // 检查 preCheck
        const canCastByPreCheck = skillData.preCheck ? skillData.preCheck({
          self: currentUnit,
          allies: allyUnits,
          enemies: enemyUnits,
          allAllies: allAllyUnit,
          allEnemies: allEnemies,
          battleInfo
        })
          : true;
        let logicCanCast = canCastByLogic && canCastByPreCheck;

        if (!logicCanCast) {
          return false;
        }

        // 如果技能不是攻击
        let mpCanCast = checkCanLossMp(
          currentUnit,
          currentUnit,
          skillData.mpCost,
          MpLossReason.CAST_SKILL
        );

        return mpCanCast
      });

    // 没有任何技能，则使用普通攻击
    if (!availableSkillId || hasStateCauseForbidCastSkill(currentUnit)) {
      availableSkillId = allGameBattleSkills.baseAttack.id;
    }

    let statusModify: {[key: string]: CharacterStatusImprove[]} = {}
    let skill = allGameBattleSkills[availableSkillId]

    const callbacks = generateCallback(battleInfo, {
      skillId: skill.id as AllBattleSkillId,
    });

    let actionResult = await castSkill(currentUnit, availableSkillId, {
      allies: allyUnits,
      enemies: enemyUnits,
      allAllies: allAllyUnit,
      allEnemies: allEnemies,
      battleInfo,
      // pushMessageToQueue,
      callbacks,
      ...callbacks,
      statusModifyCallback: (info) => {
        statusModify = info;
      },
    });

    if (Object.keys(statusModify).length > 0) {
      // 添加经验
      for (const userId of Object.keys(statusModify)) {
        let unit = findUnitInBattle(battleInfo, userId);
        if (unit?.isPlayer && unit.canGetExpReward) {
          await increaseCharacterStatusExp(userId, statusModify[userId]);
        }
      }
    }

    // 如果技能不是攻击
    if (availableSkillId != 'baseAttack') {
      // 释放技能后，扣除对应mp
      if (skill.mpCost) {
        await lossMp(
          currentUnit,
          currentUnit,
          skill.mpCost,
          {
            reason: MpLossReason.CAST_SKILL,
            battleInfo,
            callbacks,
            callback: callbacks.lossMpCallback
          }
        );

      }
    }

    if (!!actionResult && availableSkillId != 'baseAttack') {
      // @ts-ignore
      actionResult.castSkillId = availableSkillId;
    }

    thisRoundAction = actionResult
  }

  if (!thisRoundAction) {
    thisRoundAction = {
      type: "none",
      damage: {},
      heal: {},
      sourceUnitUuid: currentUnit.uuid,
      targetUnitUuidList: [],
    };
  }
  // --- 优化：仅遍历真正包含 afterEachOtherUnitAction 钩子的单位 ---
  // 使用 battleAction 中的签名缓存，避免在热路径上反复扫描无钩子的单位。
  for (const unit of battleInfo.members) {
    if (unit.uuid === currentUnit.uuid) continue;

    if (unit.hp <= 0) {
      await iteratorUnitEquipmentAsync(unit, ({equipmentTrigger, equipmentId,}) => {
        return equipmentTrigger?.afterEachOtherUnitAction_selfDead?.({
          self: unit,
          equipmentId,
          currentTurnUnit: currentUnit,
          battleInfo,
          thisRoundInfo: thisRoundAction,
          callbacks: callbacksBase,
        })
      }, { requiredHook: 'afterEachOtherUnitAction_selfDead' })
    } else {
      await iteratorUnitEquipmentAsync(unit, async ({equipmentTrigger, equipmentId,}) => {
        if (!equipmentTrigger?.afterEachOtherUnitAction) return;
        return equipmentTrigger.afterEachOtherUnitAction({
          self: unit,
          equipmentId,
          currentTurnUnit: currentUnit,
          battleInfo,
          thisRoundInfo: thisRoundAction,
          callbacks: callbacksBase,
        })
      }, { requiredHook: 'afterEachOtherUnitAction' })

      await iteratorUnitStateAsync(unit, async ({stateInBattle, stateInfo}) => {
        if (!stateInfo.afterEachOtherUnitAction) return;
        return stateInfo.afterEachOtherUnitAction({
          thisState: stateInBattle,
          self: unit,
          currentTurnUnit: currentUnit,
          battleInfo,
          callbacks: callbacksBase,
        })
      }, { requiredHook: 'afterEachOtherUnitAction' })
    }
  }

  // 处理技能cd的逻辑移动到了gotoNextTurn

  // 被选择的技能，释放后cd变为最大值
  // if (availableSkillId) {
    // currentUnit.skillColddown[availableSkillId] = allGameBattleSkills[availableSkillId].colddown;
  // }

  // 可扩展：技能、治疗等
  if (stateInfo) {
    for (const stateId of ObjectKeys<AllBattleStateId>(stateInfo)) {
      const thisState = stateInfo[stateId];
      const stateData: BattleState = allBattleState[stateId];
      if (!thisState) continue;
      if (
        thisState.remainingDuration > 0 &&
        stateData.StateEffectTriggerWhen == StateEffectTriggerWhen.TURN_END &&
        !thisState.triggered // 防止重复结算
      ) {
        thisState.triggered = true;
        const actionResult = await stateData.effect?.({
          self: currentUnit,
          allies: allyUnits,
          enemies: enemyUnits,
          battleInfo,
          thisState: thisState,
          callbacks: callbacksBase,
          healCallback: (obj) => { sendBattleMsg("on_heal", battleInfo, obj) },
          lossMpCallback: (obj) => { sendBattleMsg("on_loss_mp", battleInfo, obj) },
          restoreMpCallback: (obj) => { sendBattleMsg("on_restore_mp", battleInfo, obj) },
          addStateCallback: (obj) => { sendAddStateMsg(battleInfo, obj) },
        });
        if (actionResult) {
          // if (allBattleState[stateId].consumeTurn) {
          //   return { battleInfo, thisRoundAction: actionResult, canPassTurn: false };
          //   // 因为已经是回合后，所以不用再跳过回合了
          //   // await gotoNextTurn(battleInfo)
          // }
          // return { battleInfo, thisRoundAction: actionResult, canPassTurn: false };
        }
      }
    }
  }

  await iteratorUnitEquipmentAsync(currentUnit, async ({ equipmentTrigger, equipmentId, }) => {
    if (!equipmentTrigger?.onTurnEnd) return;
    return equipmentTrigger.onTurnEnd({
      allAllies: allAllyUnit,
      allEnemies: allEnemies,
      allies,
      enemies,
      self: currentUnit,
      equipmentId,
      battleInfo,
      thisRoundInfo: thisRoundAction,
      callbacks: callbacksBase,
    })
  }, { requiredHook: 'onTurnEnd' })

  return { battleInfo, thisRoundAction, canPassTurn: true, currentUnit };
}

function calcBattleRewardMultiplierMap(members: BaseBattleUnit[], room: BattleRoom): Record<string, number> {
  const seen = new Set<string>();
  const uniqueMembers: BaseBattleUnit[] = [];

  for (const member of members) {
    if (!member?.uuid) continue;
    if (seen.has(member.uuid)) continue;
    seen.add(member.uuid);
    uniqueMembers.push(member);
  }

  if (!uniqueMembers.length) return {};

  const getBattleLevel = (unit: BaseBattleUnit): number => {
    return Math.floor(unit.level ?? 0);
  };

  const eligible = uniqueMembers.filter(
    (m) => m.isPlayer && m.canGetDropReward && m.canGetExpReward && !m.isSummoned
  );

  if (!eligible.length) return {};

  const levels = eligible.map(getBattleLevel);
  const maxLevel = Math.max(...levels);

  const multiplierMap: Record<string, number> = {};

  for (const member of uniqueMembers) {
    if (!eligible.includes(member)) {
      multiplierMap[member.uuid] = 1;
      continue;
    }

    if (room.ironcat) {
      multiplierMap[member.uuid] = 1;
      continue;
    }
    if (room.battleType != 'normal') {
      multiplierMap[member.uuid] = 1;
      continue;
    }

    const level = getBattleLevel(member);

    if (level >= 90) {
      multiplierMap[member.uuid] = 1;
      continue;
    }

    if (uniqueMembers.length === 1) {
      multiplierMap[member.uuid] = 1;
      continue;
    }

    const delta = Math.max(0, maxLevel - level);
    multiplierMap[member.uuid] = Math.max(0.05, Math.exp(-delta / 25));
  }

  return multiplierMap;
}

export async function giveBattleExpReward(
  room: NormalBattleRoom,
  battleInfo: BattleInfo,
  unitStatistic: Record<string, UnitStatisticInfoInSingleBattle>,
  extraExpPercent: number = 0
): Promise<Record<string, UnitExpRewardInSingleBattle>> {
  // 采样探针
  // 玩家组没有人，直接返回
  const allPlayerGroupUnitUuids = battleInfo.groups[battleInfo.playerGroupId] || [];
  if (allPlayerGroupUnitUuids.length === 0) return {};

  let unitMap: Record<string, BaseBattleUnit> = {}
  for (const unit of battleInfo.members) {
    unitMap[unit.uuid] = unit;
  }

  let playerGroupMembers = battleInfo.members.filter(u => allPlayerGroupUnitUuids.includes(u.uuid));
  let playerMembers = playerGroupMembers.filter(u => u.isPlayer && u.canGetExpReward);

  const rewardMultiplierMap = calcBattleRewardMultiplierMap(playerMembers, room);

  let playerUuids = playerMembers.map(u => u.uuid);

  // 没有玩家单位，直接返回
  if (playerUuids.length === 0) return {};

  let expMap: Record<string, { [key in AllCharacterStatusType]?: number }> = {};
  let res: Record<string, UnitExpRewardInSingleBattle> = {}
  let addPlayerExp = (playerUuid: string, expList: CharacterStatusImprove[], causeBy: keyof UnitExpRewardInSingleBattle) => {
    if (!expMap[playerUuid]) {
      expMap[playerUuid] = {}
    }
    if (!res[playerUuid]) {
      res[playerUuid] = {
        dealDamageExp: [],
        takeDamageExp: [],
        dealDamageExpFromAlly: [],
        dealDamageExpFromSummonedUnit: [],

        castSkillExp: [],

        battleExp: [],
      }
    }

    expList.forEach(expItem => {
      if (!expMap[playerUuid][expItem.status]) {
        expMap[playerUuid][expItem.status] = 0;
      }

      let increasement = expItem.increaseExp;
      let multiplier = rewardMultiplierMap[playerUuid] ?? 1;

      increasement = Math.floor(increasement * multiplier)

      // @ts-expect-error
      expMap[playerUuid][expItem.status] += increasement;
    })

    res[playerUuid][causeBy].push(...expList);
  };

  // 计算敌人阵亡提供的经验
  const enemyGroupId = Object.keys(battleInfo.groups).find(
    (id) => id !== battleInfo.playerGroupId
  );
  const enemyUuids: string[] = enemyGroupId
    ? battleInfo.groups[enemyGroupId]
    : [];

  let totalExpReward = 0

  const enemyKillAttribution: { enemyId: AllGameEnemyID; killerUuid: string | null }[] = [];

  let baseExpRewardPerEnemy = 0;

  if (room.denseFogMode) {
    baseExpRewardPerEnemy += DENSE_FOG_MODE_BASELINE_STATUS.expReward
  }

  for (const enemyUuid of enemyUuids) {
    const enemy = battleInfo.members.find((u) => u.uuid === enemyUuid);
    if (!enemy || enemy.hp > 0.1) continue;

    if (!enemy.isPlayerUnit) {
      // 计算敌人阵亡提供的经验
      const enemyData = allGameEnemies[enemy.id as AllGameEnemyID];

      if (!enemyData) {
        continue;
      }

      // 记录击杀归属：取对该敌人造成最高伤害的玩家
      let topKiller: string | null = null;
      let topDamage = 0;
      for (const playerUuid of playerUuids) {
        const dmg = unitStatistic[playerUuid]?.dealDamage?.[enemyUuid] ?? 0;
        if (dmg > topDamage) {
          topDamage = dmg;
          topKiller = playerUuid;
        }
      }
      // 若无人伤害记录，回退给第一个玩家（保证记一次）
      if (!topKiller && playerUuids.length) {
        topKiller = playerUuids[0];
      }
      enemyKillAttribution.push({ enemyId: enemy.id as AllGameEnemyID, killerUuid: topKiller });

      if (enemyData.expReward) {
        totalExpReward += enemyData.expReward;
      }
    } else { // 玩家单位，基于玩家战斗经验提供经验
      totalExpReward += (enemy.level * DENSE_FOG_MODE_ENEMY_LEVEL_EXP_MULTIPLE)
    }

    totalExpReward += baseExpRewardPerEnemy
  }

  // 写入击杀图鉴（异步并行，不阻塞后续经验结算）
  // if (enemyKillAttribution.length) {
  //   void Promise.all(
  //     enemyKillAttribution
  //       .filter((k) => !!k.killerUuid)
  //       .map((k) => recordUnitKill({
  //         userUuid: k.killerUuid!,
  //         unitId: k.enemyId,
  //         delta: 1,
  //       }))
  //   );
  // }

  // extraPercent参数中，添加其他全局的经验加成（纪念碑）
  const villageBuildingEffectOnBattle = await getGameVillageBuildingEffectOnBattle();
  if (villageBuildingEffectOnBattle.extraExpPercent > 0) {
    extraExpPercent += villageBuildingEffectOnBattle.extraExpPercent
  }

  const playerSpecificExpPercent: Record<string, number> = {};

  for(const playerMember of playerGroupMembers) {
    if (playerMember.isPlayer && playerMember.canGetExpReward) {
      let thisPlayerSpecificExpPercent = 0;

      iteratorUnitEquipment(playerMember, ({ equipmentTrigger, equipmentId }) => {
        thisPlayerSpecificExpPercent += (equipmentTrigger?.calcBattleWinRewardExtraExpPercent?.({
          self: playerMember,
          battleInfo,
          equipmentId,
        }) ?? 0)
      }, { requiredHook: 'calcBattleWinRewardExtraExpPercent' })

      iteratorUnitState(playerMember, ({ stateInBattle, stateInfo }) => {
        thisPlayerSpecificExpPercent += (stateInfo.calcBattleWinExtraExpPercent?.({
          self: playerMember,
          battleInfo,
          thisState: stateInBattle,
        }) ?? 0)
      }, { requiredHook: 'calcBattleWinExtraExpPercent' })

      playerSpecificExpPercent[playerMember.uuid] = thisPlayerSpecificExpPercent;
    }
  }

  const playerStatusExpMap: Record<string, CharacterStatusImprove[]> = {};
  const playerSkillExpMap: Record<
    string,
    { skillId: AllBattleSkillId; increaseExp: number }[]
  > = {};

  for (const playerMember of playerGroupMembers) {
    if (!playerMember.isPlayer) continue;

    const thisUnitUuid = playerMember.uuid;
    let thisUnitStatistic = unitStatistic[playerMember.uuid]

    if (thisUnitStatistic) {
      if (thisUnitStatistic.dealDamage) {
        // 计算这个单位造成的总伤害
        let damageDealt = 0;
        for (const target of Object.keys(thisUnitStatistic.dealDamage)) {
          if (isEnemy(playerMember.uuid, target, battleInfo)) {
            damageDealt += thisUnitStatistic.dealDamage[target]
          }
        }

        // 如果是召唤单位，则仅给召唤者经验
        if (playerMember.isSummoned) {
          const summonedByUnitUuid = playerMember.summonedBy;

          // 召唤人存在，给予召唤者经验
          if (summonedByUnitUuid && unitMap[summonedByUnitUuid]?.isPlayer) {
            addPlayerExp(summonedByUnitUuid, [
              {
                status: "strength",
                increaseExp: damageDealt * STRENGTH_EXP_PER_DEAL_DAMAGE * SOMMONER_DAMAGE_EXP_SHARE_PERCENT,
              },
              {
                status: "dexterity",
                increaseExp: damageDealt * DEX_EXP_PER_DEAL_DAMAGE * SOMMONER_DAMAGE_EXP_SHARE_PERCENT,
              },
              {
                status: "attacking",
                increaseExp: damageDealt * ATTACK_EXP_PER_DEAL_DAMAGE * SOMMONER_DAMAGE_EXP_SHARE_PERCENT,
              },
            ], 'dealDamageExpFromSummonedUnit');
          }
        } else { // 如果不是召唤单位
          // 给予自己全额经验
          addPlayerExp(thisUnitUuid, [
            {
              status: "strength",
              increaseExp: damageDealt * STRENGTH_EXP_PER_DEAL_DAMAGE,
            },
            {
              status: "dexterity",
              increaseExp: damageDealt * DEX_EXP_PER_DEAL_DAMAGE,
            },
            {
              status: "attacking",
              increaseExp: damageDealt * ATTACK_EXP_PER_DEAL_DAMAGE,
            },
          ], 'dealDamageExp');

          // 给予友军30%经验
          for (const allyUuid of playerUuids) {
            if (allyUuid === thisUnitUuid) {
              continue; // 跳过自己
            }
            let allyUnit = unitMap[allyUuid];

            if (!allyUnit?.isPlayer || allyUnit.isSummoned) {
              continue;
            }

            addPlayerExp(allyUuid, [
              {
                status: "strength",
                increaseExp: damageDealt * STRENGTH_EXP_PER_DEAL_DAMAGE * DAMAGE_EXP_SHARE_PERCENT,
              },
              {
                status: "dexterity",
                increaseExp: damageDealt * DEX_EXP_PER_DEAL_DAMAGE * DAMAGE_EXP_SHARE_PERCENT,
              },
              {
                status: "attacking",
                increaseExp: damageDealt * ATTACK_EXP_PER_DEAL_DAMAGE * DAMAGE_EXP_SHARE_PERCENT,
              },
            ], 'dealDamageExpFromAlly');
          }
        }
      }

      // 非召唤物的友军受到伤害时，给予受击经验
      if (thisUnitStatistic.takeDamage && playerMember.isPlayer && !playerMember.isSummoned) {
        // 计算这个单位受到的总伤害
        let damageTaken = 0;
        for (const source of Object.keys(thisUnitStatistic.takeDamage)) {
          damageTaken += thisUnitStatistic.takeDamage[source]
        }

        // 经验结算上限，避免极端伤害导致经验爆炸
        const MAX_DAMAGE_TAKEN_FOR_EXP = 25000;
        damageTaken = Math.min(damageTaken, MAX_DAMAGE_TAKEN_FOR_EXP);

        addPlayerExp(thisUnitUuid, [
          {
            status: "stamina",
            increaseExp: damageTaken * STAMINA_EXP_PER_TAKE_DAMAGE,
          },
          {
            status: "dexterity",
            increaseExp: damageTaken * DEX_EXP_PER_TAKE_DAMAGE,
          },
          {
            status: "defencing",
            increaseExp: damageTaken * DEFENCE_EXP_PER_DEAL_DAMAGE,
          },
        ], 'takeDamageExp');
      }

      // 给予释放技能的技能经验以及智力经验
      if (thisUnitStatistic.castSkill && playerMember.isPlayer && !playerMember.isSummoned) {
        for (const skillId of ObjectKeys<AllBattleSkillId>(thisUnitStatistic.castSkill)) {
          if (skillId == 'baseAttack') continue;
          if (skillId == 'knowledgeCrownSkill') continue;

          addPlayerExp(thisUnitUuid, [
            {
              status: "intelligence",
              increaseExp: INTELLIGENCE_EXP_PRE_CAST_SKILL
            }
          ], "castSkillExp")

          const thisUnitExtraExpPercent = +(extraExpPercent + (playerSpecificExpPercent[thisUnitUuid] ?? 0)).toFixed(2)

          if (!playerSkillExpMap[thisUnitUuid]) {
            playerSkillExpMap[thisUnitUuid] = [];
          }
          playerSkillExpMap[thisUnitUuid].push({
            skillId,
            increaseExp: 1 * (1 + thisUnitExtraExpPercent),
          });
        }
      }
    }
    
    // 给予战斗经验
    if (totalExpReward > 0 && playerMember.isPlayer) {
      // 给予战斗经验
      addPlayerExp(thisUnitUuid, [
        {
          status: 'battle',
          increaseExp: totalExpReward
        },
      ], 'battleExp');
    }
  }

  // 直接并行提交各玩家的属性经验更新
  for (const unitUuid of Object.keys(expMap)) {
    if (!expMap[unitUuid]) {
      continue;
    }
    if (!unitMap[unitUuid].isPlayer) {
      continue;
    }

    let map = expMap[unitUuid];

    const thisUnitExtraExpPercent = extraExpPercent + (playerSpecificExpPercent[unitUuid] ?? 0)

    let expList: CharacterStatusImprove[] = [];
    for (const status of ObjectKeys<keyof typeof map>(map)) {
      if (!map[status]) {
        continue;
      }
      const statusKey = status as AllBaseCharacterStatusType;
      if (map[statusKey] && map[statusKey] > 0) {
        expList.push({
          status: statusKey,
          increaseExp: map[statusKey] + (+(map[statusKey] * thisUnitExtraExpPercent).toFixed(2)),
        });
      }
    }

    playerStatusExpMap[unitUuid] = expList;
  }

  const allStatusExpPromise: Promise<any>[] = []
  // await prisma.$transaction(async (tx) => {
    for(const unitUuid of Object.keys(playerStatusExpMap)) {
      const expList = playerStatusExpMap[unitUuid];
      allStatusExpPromise.push(increaseCharacterStatusExp(unitUuid, expList));
    }

    await Promise.all(allStatusExpPromise);
  // }, {
  //   maxWait: 10000, // 等待连接 10 秒
  //   timeout: 20000, // 执行时间 20 秒
  //   isolationLevel: 'ReadCommitted' // 默认 RepeatableRead 锁更严格
  // })

  if (Object.keys(playerSkillExpMap).length) {
    await batchIncreaseCharacterSkillExp(playerSkillExpMap);
  }
  // },{
  //   maxWait: 10000, // 等待连接 10 秒
  //   timeout: 20000, // 执行时间 20 秒
  //   isolationLevel: 'ReadCommitted' // 默认 RepeatableRead 锁更严格
  // });

  return res
}

export async function giveBattleReward_Original(
  battleRoom: NormalBattleRoom,
  battleInfo: BattleInfo
): Promise<Record<string, ItemCountInfo>> {

  const enemyGroupId = Object.keys(battleInfo.groups).find(
    (id) => id !== battleInfo.playerGroupId
  );
  let enemyUuids: string[] = enemyGroupId ? battleInfo.groups[enemyGroupId] : [];

  const callbacks = generateCallback(battleInfo, {});

    // 召唤单位不提供掉落
  enemyUuids = enemyUuids.filter(uuid => {
    let unit = battleInfo.members.find(u => u.uuid === uuid);

    return unit && !unit?.isSummoned && unit.hp <= 0;
  });

  // const enemyIds = enemyUuids
  //   .map((uuid) => {
  //     const enemy = battleInfo.members.find((u) => u.uuid === uuid);
  //     return enemy?.id as AllGameEnemyID;
  //   })
  //   .filter((id) => id !== undefined);

  const playerIds = battleInfo.groups[battleInfo.playerGroupId] || [];
  if (playerIds.length === 0) return {};

  let playerMembers = battleInfo.members.filter(u => playerIds.includes(u.uuid) && u.isPlayer && u.canGetDropReward);

  // playerMembers再根据uuid去一次重
  // 以防止有重复的玩家（可能是因为玩家在战斗中被踢出）
  playerMembers = playerMembers.filter((member, index, self) => {
    return index === self.findIndex((m) => m.uuid === member.uuid);
  });

  // 只派发给IP唯一的玩家
  let actInventoryUpdatePromise: Promise<void>[] = [];
  let uniquePlayerMembers = groupByIp(playerMembers)

  // 铁猫不处理多开问题
  if (battleRoom.ironcat) {
    uniquePlayerMembers = {
      uniqueList: playerMembers,
      groupMap: {},
      duplicateGroups: {},
    }
  }

  // 难度额外掉落系数
  let roomAdditionalDropPercent = 0
  if (battleRoom.difficulty && battleRoom.difficulty > 0) {
    let difficultyInfo = BATTLE_ROOM_DIFFICULTY_LEVELS_INFO[battleRoom.difficulty - 1]
    if (difficultyInfo) {
      roomAdditionalDropPercent = difficultyInfo.additionalDropPercent
    }
  }

  let tavernCatsForPlayer: Record<string, Tavern[]> = {};
  let getTavernCatPromise: Promise<Tavern[]>[] = [];
  let playerHasBattleLogisticsExpert: Record<string, boolean> = {};
  for (const playerMember of uniquePlayerMembers.uniqueList) {
    const playerUuid = playerMember.uuid;
    if (!tavernCatsForPlayer[playerUuid]) {
      // 获取玩家的猫猫
      getTavernCatPromise.push(getUserWorkingTalentCats(playerUuid).then(cats => {
        tavernCatsForPlayer[playerUuid] = cats;
        return cats;
      }));
    }
  }

  await Promise.all(getTavernCatPromise);
  // 检查玩家是否有战斗后勤专家
  for (const playerMember of uniquePlayerMembers.uniqueList) {
    const playerUuid = playerMember.uuid;
      playerHasBattleLogisticsExpert[playerUuid] = tavernCatsForPlayer[
        playerUuid
      ]?.some((expert) => expert.type === "battleLogisticsExpert");
  } 


  // 每个玩家独立掉落和经验
  const allDropItems: Record<string, ItemCountInfo> = {};
  for (const playerMember of uniquePlayerMembers.uniqueList) {
    const playerUuid = playerMember.uuid;
    const dropItems: ItemCountInfo = {};

    let allExtraPercentModify = 0
    // 包括type=enhanceExpert的专家
    if (playerHasBattleLogisticsExpert[playerUuid]) {
      // 专家猫猫提升25%掉落率
      allExtraPercentModify += 0.25
    }

    if ((playerMember?.state?.natureGift?.remainingDuration ?? 0) > 0) {
      let percent = playerMember?.state?.natureGift?.extra?.thisStateActuralValue ?? 0

      allExtraPercentModify += percent;
    }

    let playerLuck = playerMember.status.otherStatus?.luck?.level ?? 1;

    // 幸运与掉落增幅上限，防止异常值导致产出膨胀
    const MAX_PLAYER_LUCK_FOR_DROP = 100;
    const MAX_EXTRA_DROP_PERCENT_FROM_LUCK = 1.5; // 150%
    playerLuck = Math.min(Math.max(playerLuck, 1), MAX_PLAYER_LUCK_FOR_DROP);

    let extraDropPercentFromLuck = (playerLuck - 1) * EXTRA_DROP_PERCENT_PER_LUCK;
    extraDropPercentFromLuck = Math.min(extraDropPercentFromLuck, MAX_EXTRA_DROP_PERCENT_FROM_LUCK);

    let extraDropCountPercent = 0
    iteratorUnitSkillNode(playerMember, (node, level) => {
      const extra = node.businessBattleEffects!.calcBattleWinRewardExtraDropCount!({
        self: playerMember,
        battleInfo,
        level,
      }) ?? 0
      if (extra && extra > 0) {
        extraDropCountPercent += extra
      }
    }, { requiredHook: 'calcBattleWinRewardExtraDropCount' })

    const MAX_EXTRA_DROP_COUNT_PERCENT = 1.0; // 额外掉落数量上限 100%
    extraDropCountPercent = Math.min(extraDropCountPercent, MAX_EXTRA_DROP_COUNT_PERCENT);

    for (const enemyUuid of enemyUuids) {
      // 优先从直接写入单位的掉落物列表中获取掉落
      let enemyMember = findUnitInBattle(battleInfo, enemyUuid) as Enemy
      let droplist = enemyMember.drops;

      // 没有写入，则从单位资源表中获取
      if (!droplist?.length) {
        let enemyId = enemyMember.id as AllGameEnemyID
        const enemyData = allGameEnemies[enemyId];

        // 单位不存在，直接跳过此单位的掉落
        if (!enemyData) {
          continue;
        }

        droplist = allGameEnemies[enemyId].drops as ItemDrop[];
      }

      // 仍然没有，跳过此敌人的掉落判断
      if (!droplist?.length) continue;

      for (const drop of droplist) {
        let baseDropPercent = drop.percent;

        // 基础掉落率乘区
        baseDropPercent = baseDropPercent + (baseDropPercent * extraDropPercentFromLuck);

        let dropPercent = baseDropPercent + (baseDropPercent * allExtraPercentModify)

        // // 装备额外掉落
        // if (hasEquipment(playerMember, "cursedSilkSachet")) {
        //   dropPercent = dropPercent + baseDropPercent * 0.08;
        // }

        // 房间难度额外掉落
        dropPercent = dropPercent + (baseDropPercent * roomAdditionalDropPercent)

        // 处理来自装备的掉落率提升
        let extraDropPercentFromEquipment = 0;
        iteratorUnitEquipment(playerMember, ({ equipmentTrigger, equipmentId }) => {

          const pExtraDropPercentFromEquipment = equipmentTrigger?.calcBattleWinRewardExtraDropRate?.({
            self: playerMember,
            battleInfo,
            equipmentId,
            callbacks,
            enemy: enemyMember,
            drop
          }) ?? 0

          if (pExtraDropPercentFromEquipment && pExtraDropPercentFromEquipment > 0) {
            extraDropPercentFromEquipment += pExtraDropPercentFromEquipment
          }
        }, { requiredHook: 'calcBattleWinRewardExtraDropRate' })

        let extraDropPercentFromState = 0
        iteratorUnitState(playerMember, ({ stateInfo, stateInBattle }) => {
          const extra = stateInfo?.calcBattleWinRewardExtraDropRate?.({
            self: playerMember,
            battleInfo,
            callbacks,
            thisState: stateInBattle,
            enemy: enemyMember,
            drop
          }) ?? 0

          if (extra && extra > 0) {
            extraDropPercentFromState += extra
          }
        }, { requiredHook: 'calcBattleWinRewardExtraDropRate' })

        let extraDropPercentFromSkillNode = 0
        iteratorUnitSkillNode(playerMember, (node, level) => {
          const extra = node.businessBattleEffects!.calcBattleWinRewardExtraDropRate!({
            self: playerMember,
            battleInfo,
            level,
            enemy: enemyMember,
            drop
          }) ?? 0
          if (extra && extra > 0) {
            extraDropPercentFromSkillNode += extra
          }
        }, { requiredHook: 'calcBattleWinRewardExtraDropRate' })

        const finalDropPercent = dropPercent + extraDropPercentFromEquipment + extraDropPercentFromState + extraDropPercentFromSkillNode;

        // 按概率掉落（每个玩家独立判定）
        if (randomNumberInFullColseRange(0, 1) < finalDropPercent) {
          let count = randomIntegerInFullCloseRange(drop.range);

          // 对于超过100%的部分，额外作为数量补偿
          if (finalDropPercent > 1) {
            count = count + Math.floor(count * (finalDropPercent - 1));
          }

          count = Math.floor(count * (1 + extraDropCountPercent))

          if (count > 0) {
            if (!dropItems[drop.id]) {
              dropItems[drop.id] = {
                count: 0
              }
            }
            dropItems[drop.id]!.count += count
          }
        }
      }
    }

    let experienceDropPercent = (BATTLE_EXPERIENCE_DROP_PERCENT + (BATTLE_EXPERIENCE_DROP_PERCENT * allExtraPercentModify))
    if (randomNumberInFullColseRange(0, 1) < experienceDropPercent)  {
      // 从三种精华中随机一种

      let resource = [
        'experienceOfStrength',
        'experienceOfDexterity',
        'experienceOfIntelligence',
      ]

      let resExperience = randomElementInCollection(resource)

      if (resExperience) {
        actInventoryUpdatePromise.push(increaseItemCount(playerUuid, {
          [resExperience]: {
            count: 1
          }
        }))
      }
    }

    // 迷雾中，怪物额外给予掉落
    if (battleRoom.denseFogMode) {
      let percent = 0.02;
      let c = randomNumberInFullColseRange(0, 1);
      if (c < percent) {
        let resource = ["denseFogMurkyCrystal", "denseFogDust"];

        let randomDenseFogResource = randomElementInCollection(resource);

        if (randomDenseFogResource) {
          if (!dropItems[randomDenseFogResource]) {
            dropItems[randomDenseFogResource] = {
              count: 0,
            };
          }
          dropItems[randomDenseFogResource].count += 1;
        }
      }
    }

    // 发放掉落
    if (Object.keys(dropItems).length) {
      actInventoryUpdatePromise.push(increaseItemCount(playerUuid, dropItems, {
        actionName: "战斗掉落奖励",
        showModifyInfo: true,
        type: ModifyItemCountType.Battle
      }));

      // dispatchResourceIncreaseToClient(playerUuid, dropItems);
      // dispatchResourceIncreasePromise.push(pushMessageToQueue({
      //   type: "dispatch_resource_increase",
      //   userUuid: playerUuid,
      //   info: dropItems,
      // }));
      // dispatchInventoryUpdatedEventToClient(playerUuid);
      pushMessageToQueue({
        type: 'inventory_modify',
        userUuid: playerUuid,
        info: dropItems
      })
    }

    allDropItems[playerUuid] = dropItems;
  }

  await Promise.all(actInventoryUpdatePromise);

  // await Promise.all(dispatchResourceIncreasePromise);
  return allDropItems;
}

export async function giveBattleReward(
  battleRoom: NormalBattleRoom,
  battleInfo: BattleInfo,
  opt?: {
    target?: 'inventory' | 'harvestbox',
    title?: string,
  }
): Promise<Record<string, ItemCountInfo>> {
  const enemyGroupId = Object.keys(battleInfo.groups).find(
    (id) => id !== battleInfo.playerGroupId
  );
  let enemyUuids: string[] = enemyGroupId ? battleInfo.groups[enemyGroupId] : [];

  // loot/gold slider multipliers (0..10)
  // goldMultiplier: multiply gold counts by (1 - 0.1 * slider)
  // dropMultiplier: multiply drop probability by (1 + 0.05 * slider)
  let _lootSlider = Math.max(0, Math.min(10, Number(battleRoom.lootGoldSlider ?? 0)));

  // 非铁猫模式不受loot/gold slider影响
  if (!battleRoom.ironcat) {
    _lootSlider = 0;
  }

  const goldMultiplier = +(Math.max(0, 1 - 0.1 * _lootSlider)).toFixed(2);
  const dropMultiplier = +(1 + LOOT_GOLD_DROP_MULTIPLIER_PER_SLIDER * _lootSlider).toFixed(2);

    // 召唤单位不提供掉落
  enemyUuids = enemyUuids.filter(uuid => {
    let unit = battleInfo.members.find(u => u.uuid === uuid);

    return unit && !unit?.isSummoned && unit.hp <= 0;
  });

  const callbacks = generateCallback(battleInfo, {});

  // const enemyIds = enemyUuids
  //   .map((uuid) => {
  //     const enemy = battleInfo.members.find((u) => u.uuid === uuid);
  //     return enemy?.id as AllGameEnemyID;
  //   })
  //   .filter((id) => id !== undefined);

  const playerIds = battleInfo.groups[battleInfo.playerGroupId] || [];
  if (playerIds.length === 0) return {};

  let playerMembers = battleInfo.members.filter(u => playerIds.includes(u.uuid) && u.isPlayer && u.canGetDropReward);

  const rewardMultiplierMap = calcBattleRewardMultiplierMap(playerMembers, battleRoom);

  // playerMembers再根据uuid去一次重
  // 以防止有重复的玩家（可能是因为玩家在战斗中被踢出）
  playerMembers = playerMembers.filter((member, index, self) => {
    return index === self.findIndex((m) => m.uuid === member.uuid);
  });

  // 只派发给IP唯一的玩家
  let uniquePlayerMembers = groupByIp(playerMembers)

  // 铁猫不处理多开问题
  if (battleRoom.ironcat) {
    uniquePlayerMembers = {
      uniqueList: playerMembers,
      groupMap: {},
      duplicateGroups: {},
    }
  }

  // 难度额外掉落系数
  let roomAdditionalDropPercent = 0
  if (battleRoom.difficulty && battleRoom.difficulty > 0) {
    let difficultyInfo = BATTLE_ROOM_DIFFICULTY_LEVELS_INFO[battleRoom.difficulty - 1]
    if (difficultyInfo) {
      roomAdditionalDropPercent = difficultyInfo.additionalDropPercent
    }
  }

  let tavernCatsForPlayer: Record<string, Tavern[]> = {};
  let playerHasBattleLogisticsExpert: Record<string, boolean> = {};
  // 从村庄纪念碑获取全局掉落加成（进程内缓存5分钟）
  let villageEffect = await getGameVillageBuildingEffectOnBattle();
  const villageExtraDropAdditive = Number(villageEffect.extraDropPercent ?? 0) || 0;
  // 批量获取玩家猫咪，减少多次冷读
  const owners = uniquePlayerMembers.uniqueList.map(u => u.uuid);
  const catsMap = await getMultiUserTalentCats(owners);
  for (const owner of owners) {
    tavernCatsForPlayer[owner] = catsMap.get(owner) ?? [];
  }
  // 检查玩家是否有战斗后勤专家
  for (const playerMember of uniquePlayerMembers.uniqueList) {
    const playerUuid = playerMember.uuid;
      playerHasBattleLogisticsExpert[playerUuid] = tavernCatsForPlayer[
        playerUuid
      ]?.some((expert) => expert.type === "battleLogisticsExpert");
  } 


  // ================= 重构版本（线性方案 A） =================
  // 目标：
  // 1. 与 Original 在“来源贡献值”上保持数值接近，但改为纯线性加总：final = raw * (1 + ΣadditiveSources)
  // 2. 各来源（luck / playerExtra / room / 装备 / 状态 / 技能节点）统一表示为对 raw 的相对增幅 percent
  // 3. >100% 时仍按旧逻辑把超出部分折算为数量补偿
  // 4. 保留 Original 可回退

  type EnemyDropEntry = {
    enemy: Enemy,
    drop: {
      id: AllGameResourceID,
      percent: number,
      range: any,
      [k: string]: any
    }
  }

  // 预生成敌人掉落条目（只做一次）
  const enemyDropEntries: EnemyDropEntry[] = [];
  for (const enemyUuid of enemyUuids) {
    const enemyUnit = findUnitInBattle(battleInfo, enemyUuid) as Enemy | undefined;
    if (!enemyUnit) continue;
    // 直接写入的 droplist 优先
    let droplist = enemyUnit.drops;
    if (!droplist?.length) {
      const enemyData = allGameEnemies[enemyUnit.id as AllGameEnemyID];
      if (!enemyData) continue;
      droplist = enemyData.drops as ItemDrop[];
    }
    if (!droplist?.length) continue;

    droplist = clone(droplist)

    for (const drop of droplist) {
      enemyDropEntries.push({ enemy: enemyUnit, drop });
    }
  }

  // 玩家级静态上下文缓存
  interface PlayerStaticCtx {
    unit: BaseBattleUnit;
    uuid: string;
    additiveLuck: number;              // 幸运增幅 (relative on raw)
    additivePlayer: number;            // 玩家整体增幅 (专家+state natureGift)
    additiveRoom: number;              // 房间难度增幅
    additiveVillage: number;           // 纪念碑等全局掉落增幅
    extraDropCountPercent: number;     // 数量增幅（独立作用于count）
  }

  const buildPlayerStaticCtx = (unit: BaseBattleUnit): PlayerStaticCtx => {
    let additivePlayer = 0; // 专家 + 自然祝福
    if (playerHasBattleLogisticsExpert[unit.uuid]) {
      additivePlayer += 0.25;
    }
    if ((unit?.state?.natureGift?.remainingDuration ?? 0) > 0) {
      const percent = unit?.state?.natureGift?.extra?.thisStateActuralValue ?? 0;
      additivePlayer += percent;
    }
    const luckLevel = unit.status.otherStatus?.luck?.level ?? 1;
    const additiveLuck = (luckLevel - 1) * EXTRA_DROP_PERCENT_PER_LUCK;

    let extraDropCountPercent = 0;
    for (const skillNodeInfo of unit.skillTreeNodes ?? []) {
      const node = allSkillTreeNodeMap[skillNodeInfo.nodeId];
      if (!node) continue;
      const fn = node.businessBattleEffects?.calcBattleWinRewardExtraDropCount;
      if (typeof fn !== 'function') continue;
      const extra = fn({ self: unit, battleInfo, level: skillNodeInfo.level }) ?? 0;
      if (extra > 0) extraDropCountPercent += extra;
    }

    return {
      unit,
      uuid: unit.uuid,
      additiveLuck,
      additivePlayer,
      additiveRoom: roomAdditionalDropPercent,
      additiveVillage: villageExtraDropAdditive,
      extraDropCountPercent,
    };
  }

  // 动态附加掉率(装备/状态/技能节点) -> 线性增幅累加
  const calcAddonAdditive = (player: BaseBattleUnit, enemy: Enemy, drop: ItemDrop): number => {
    const cacheKey = `battleReward:${player.uuid}-${enemy.name}-${drop.id}`;
    const cached = memoryCache.get<number>(cacheKey);
    if (cached !== undefined) {
      // console.log('hit cache for calcAddonAdditive', cacheKey, cached);
      return cached;
    }

    let additiveFromEquipment = 0;
    let additiveFromState = 0;
    let additiveFromSkillNode = 0;

    iteratorUnitEquipment(player, ({ equipmentTrigger, equipmentId }) => {
      const v = equipmentTrigger?.calcBattleWinRewardExtraDropRate?.({
        self: player,
        battleInfo,
        callbacks,
        equipmentId,
        enemy,
        drop,
      }) ?? 0;
      if (v > 0) additiveFromEquipment += v;
    }, { requiredHook: 'calcBattleWinRewardExtraDropRate' });

    iteratorUnitState(player, ({ stateInfo, stateInBattle }) => {
      const v = stateInfo?.calcBattleWinRewardExtraDropRate?.({
        self: player,
        battleInfo,
        callbacks,
        thisState: stateInBattle,
        enemy,
        drop,
      }) ?? 0;
      if (v > 0) additiveFromState += v;
    }, { requiredHook: 'calcBattleWinRewardExtraDropRate' });

    iteratorUnitSkillNode(player, (node, level) => {
      const v = node.businessBattleEffects!.calcBattleWinRewardExtraDropRate!({ self: player, battleInfo, level, enemy, drop }) ?? 0;
      if (v > 0) additiveFromSkillNode += v;
    }, { requiredHook: 'calcBattleWinRewardExtraDropRate' });

    const result = additiveFromEquipment + additiveFromState + additiveFromSkillNode;
    memoryCache.set(cacheKey, result, 5 * 60 * 1000); // 5分钟TTL
    // console.log('set cache for calcAddonAdditive', cacheKey, result);
    return result;
  }

  // 额外掉落数量
  const calcAddonDropCount = (player: BaseBattleUnit, enemy: Enemy, drop: ItemDrop): number => {
    const cacheKey = `battleRewardCount:${player.uuid}-${enemy.name}-${drop.id}`;
    const cached = memoryCache.get<number>(cacheKey);
    if (cached !== undefined) {
      // console.log('hit cache for calcAddonDropCount', cacheKey, cached);
      return cached;
    }

    let additive = 0;
    iteratorUnitState(player, ({ stateInfo, stateInBattle }) => {
      const v = stateInfo?.calcBattleWinRewardExtraDropCount?.({
        self: player,
        battleInfo,
        callbacks,
        thisState: stateInBattle,
        enemy,
        drop,
      }) ?? 0;
      if (v > 0) additive += v;
    }, { requiredHook: 'calcBattleWinRewardExtraDropCount' });
    memoryCache.set(cacheKey, additive, 5 * 60 * 1000); // 5分钟TTL
    // console.log('set cache for calcAddonDropCount', cacheKey, additive);
    return additive;
  }

  // 线性模式：finalP = raw * (1 + luck + player + room + equipment + state + skillNode)
  // >1 转化为数量补偿逻辑保持不变

  const tryRoll = (p: number): boolean => randomNumberInFullColseRange(0, 1) < p;

  const rollCount = (finalPercent: number, range: any, extraCountPercent: number, extraCount: number): number => {
    if (!tryRoll(finalPercent)) return 0;
    let count = randomIntegerInFullCloseRange(range);
    if (finalPercent > 1) {
      count += Math.floor(count * (finalPercent - 1));
    }
    count = Math.floor(count * (1 + extraCountPercent));

    count += extraCount;

    return count > 0 ? count : 0;
  }

  const grantDenseFogExtra = (dropItems: ItemCountInfo) => {
    if (!battleRoom.denseFogMode) return;
    const percent = 0.02;
    if (tryRoll(percent)) {
      const pool: AllGameResourceID[] = ["denseFogMurkyCrystal", "denseFogDust"] as any;
      const picked = randomElementInCollection(pool);
      if (picked) {
        if (!dropItems[picked]) dropItems[picked] = { count: 0 };
        dropItems[picked]!.count += 1;
      }
    }
  }

  const tryGiveExperienceEssence = (ctx: PlayerStaticCtx, dropItems: ItemCountInfo) => {
    const p = BATTLE_EXPERIENCE_DROP_PERCENT + (BATTLE_EXPERIENCE_DROP_PERCENT * ctx.additivePlayer);
    if (!tryRoll(p)) return;
    const pool: AllGameResourceID[] = [
      'experienceOfStrength','experienceOfDexterity','experienceOfIntelligence'
    ] as any;
    const picked = randomElementInCollection(pool);
    if (picked) {
      if (!dropItems[picked]) dropItems[picked] = { count: 0 };
      dropItems[picked]!.count += 1;
    }
  }

  const allDropItems: Record<string, ItemCountInfo> = {};

  // 主循环：玩家 * (预扁平化的敌人掉落条目)

  // 如果没有可用敌人或掉落条目，直接返回空（与原逻辑等价：循环不会执行）
  if (enemyDropEntries.length === 0 || uniquePlayerMembers.uniqueList.length === 0) {
    return {};
  }

  // 小优化：预判有没有任何可能的附加加成来源，用于快速路径
  const hasAnyDynamicAddonSource = (player: BaseBattleUnit): boolean => {
    let hasSkillNode = false;
    iteratorUnitSkillNode(player, () => { hasSkillNode = true; }, { requiredHook: 'calcBattleWinRewardExtraDropRate' });
    if (hasSkillNode) return true;

    let flag = false;
    iteratorUnitEquipment(player, ({ equipmentTrigger }) => {
      if (equipmentTrigger?.calcBattleWinRewardExtraDropRate) { flag = true; }
    }, { requiredHook: 'calcBattleWinRewardExtraDropRate' });
    if (flag) return true;
    iteratorUnitState(player, ({ stateInfo }) => {
      if (stateInfo?.calcBattleWinRewardExtraDropRate) { flag = true; }
    }, { requiredHook: 'calcBattleWinRewardExtraDropRate' });
    iteratorUnitState(player, ({ stateInfo }) => {
      if (stateInfo?.calcBattleWinRewardExtraDropCount) { flag = true; }
    }, { requiredHook: 'calcBattleWinRewardExtraDropCount' });
    return flag;
  }

  for (const player of uniquePlayerMembers.uniqueList) {
    const ctx = buildPlayerStaticCtx(player);
    const dropItems: ItemCountInfo = {};
    const canHaveAddon = hasAnyDynamicAddonSource(player); // 仍用于快速路径

    for (const entry of enemyDropEntries) {
      let raw = entry.drop.percent;
      // 负数保护：原逻辑未处理，防御性处理成0，不改变正常正数行为
      if (raw < 0) raw = 0;
      // 极端大数保护（> 10 视为异常输入），但不截断到1，因为>1 用于数量补偿
      if (raw > 10) raw = 10; 

      // 收集线性增幅
      let additive = ctx.additiveLuck + ctx.additivePlayer + ctx.additiveRoom + ctx.additiveVillage;
      let additivePercent = 0;
      if (canHaveAddon) {
        additivePercent = calcAddonAdditive(player, entry.enemy, entry.drop);
      }

      additive += additivePercent;

      let extraDropCount = 0;
      if (canHaveAddon) {
        extraDropCount += calcAddonDropCount(player, entry.enemy, entry.drop);
      }

      const finalPercent = raw * (1 + additive) * dropMultiplier;

      // range 校验：原逻辑直接调用，若结构损坏可能异常
      let validRange = entry.drop.range;
      if (!validRange || (typeof validRange !== 'object')) {
        // 静默跳过畸形条目
        continue;
      }

      let count = 0;
      try {
        count = rollCount(finalPercent, validRange, ctx.extraDropCountPercent, extraDropCount);
      } catch (e) {
        continue;
      }

      if (count < 1) {
        continue;
      }

      // 等级差只调整已掉落的数量，避免把单件战利品舍入成零。
      const rewardMultiplier = rewardMultiplierMap[ctx.uuid] ?? 1;
      count = Math.max(1, Math.floor(count * rewardMultiplier));

      if (count >= 1) {
        // 对金币做额外数量折算（向下取整），其他资源按原逻辑
        if (entry.drop.id === 'gold') {
          count = Math.floor(count * goldMultiplier);
          if (count <= 0) {
            // 如果被完全削减，则跳过
            continue;
          }
        }

        if (!dropItems[entry.drop.id]) dropItems[entry.drop.id] = { count: 0 };
        dropItems[entry.drop.id]!.count += count;
      }
    }

    // 经验精华合并到本次掉落，减少写入次数
    tryGiveExperienceEssence(ctx, dropItems);
    grantDenseFogExtra(dropItems);

    allDropItems[ctx.uuid] = dropItems;
  }

  if (!opt?.target || opt.target == 'inventory') {
    await batchIncreaseItemCount(allDropItems, {
      actionName: "战斗掉落奖励",
      showModifyInfo: true,
      sendModifyEvent: true,
      type: ModifyItemCountType.Battle,
    });
  } else if (opt?.target == 'harvestbox') {
    for (const playerMember of uniquePlayerMembers.uniqueList) {
      const dropItems = allDropItems[playerMember.uuid];
      if (Object.keys(dropItems).length) {
        await enqueueToHarvestBox(playerMember.uuid, dropItems, {
          title: opt.title || "战斗掉落奖励",
          source: HarvestBoxSource.Event,
        })
      }
    }
  }

  return allDropItems;
}


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
      if (playerGroup.length === 0) {
        await removeBattleInfoFromRedis(battleInfo.uuid);
        return
      }

      // 5.6 更新 BattleInfo
      await setBattleInfoIntoMemory(battleInfo);
    }
  }
}
// ...existing code...


export async function getBattleRoomByUserId(userUuid: string): Promise<BattleRoom | undefined> {
  const userRoomUuid = await getUserRoomUuid(userUuid);
  if (!userRoomUuid) {
    return undefined;
  }
  const room = await getRoomById<BattleRoom>(userRoomUuid);

  return room;
}
export async function isUserInBattle(userUuid: string): Promise<boolean> {
  const room = await getBattleRoomByUserId(userUuid);
  return !!room && room.status === 'battling'; // 或根据你的房间状态判断
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
  // 此逻辑仅在server/utils/game/battle.ts中生效
  // battleRoom.disableDenseFogModeBecausePlayerLose = false;

  return battleRoom
}

function generateBattleEnemyCount(battleRoom: NormalBattleRoom, extraEnemyCount: number = 0) {
  const areaData = allBattleAreas[battleRoom.area] as BattleArea;
  const playerCount = battleRoom.memberIds.length;

  // 计算敌人数量
  let minEnemies = areaData.minEnemies ?? 1;
  let maxEnemies = areaData.maxEnemies ?? 3;

  // 迷雾模式，最小怪物数量为8
  if (battleRoom.denseFogMode) {
    minEnemies = 8;
    maxEnemies = Math.max(maxEnemies, 8);
  }

  let extraEnemies = 0;
  for (let i = 0; i < playerCount; i++) {
    extraEnemies += Math.round(Math.random());
  }

  extraEnemies += extraEnemyCount;

  let enemyCount =
    Math.floor(Math.random() * (maxEnemies - minEnemies + 1)) +
    minEnemies +
    extraEnemies;
  if (enemyCount > 2) enemyCount -= 1;

  const maxAllowedEnemies = maxEnemies * 2;
  enemyCount = Math.min(enemyCount, maxAllowedEnemies);

  if (battleRoom.difficulty && battleRoom.difficulty > 0) {
    let difficultyInfo = BATTLE_ROOM_DIFFICULTY_LEVELS_INFO[battleRoom.difficulty - 1]
    if (difficultyInfo) {
      enemyCount += difficultyInfo.additionalEnemyCount
    }
  }

  // 判断特殊战斗
  let maxBossNum = 0;
  if (areaData.specialBattles) {
    for (const special of areaData.specialBattles) {
      if ((battleRoom.currentRepeat + 1) % special.every === 0) {
        maxBossNum = special.maxBossNum ?? special.enemies.length;
        break;
      }
    }
  }

  let bossNum = randomIntegerInFullCloseRange(1, maxBossNum);

  if (isNaN(bossNum) || bossNum < 0) {
    bossNum = 0;
  }
  
  return {
    normalEnemyCount: enemyCount,
    bossCount: bossNum,
  }
}

function generateBattleEnemyIds(battleRoom: NormalBattleRoom, prevBattleState?: BattleInfo, enemyCountInfo?: { normalEnemyCount: number, bossCount: number }): AllGameEnemyID[] {
  const areaData = allBattleAreas[battleRoom.area] as BattleArea;
  let specialEnemies: EnemyPoolEntry[] | undefined;
  if (areaData.specialBattles) {
    for (const special of areaData.specialBattles) {
      if ((battleRoom.currentRepeat + 1) % special.every === 0) {
        specialEnemies = special.enemies;
        break;
      }
    }
  }

  // 如果当前不是特殊波次，但是 enemyCountInfo.bossCount > 0，则随机选一个特殊战斗池
  if (!specialEnemies?.length && areaData.specialBattles && (enemyCountInfo?.bossCount ?? 0) > 0) {
    let randomPool = randomElementInCollection(areaData.specialBattles)
    if (randomPool) {
      specialEnemies = randomPool.enemies;
    }
  }

  if (!enemyCountInfo) {
    enemyCountInfo = generateBattleEnemyCount(battleRoom, 0);
  }

  let { normalEnemyCount: enemyCount, bossCount: bossNum } = enemyCountInfo;

  // todo 这里偷懒 直接从上一场战斗中获取玩家数据，这样k可以解决一些问题，但是如果boss战出现在第一场，会有问题
  let playerHasCursedSilkSachet = false
  if (prevBattleState) {
    let players = prevBattleState.groups[prevBattleState.playerGroupId] || [];

    for (const playerUuid of players) {
      let player = prevBattleState.members.find(mem => mem.uuid === playerUuid);
      if (player && hasEquipment(player, "cursedSilkSachet")) {
        playerHasCursedSilkSachet = true;
        break;
      }
    }
  }

  let enemyIds: AllGameEnemyID[] = [];
  if (specialEnemies && specialEnemies.length > 0 && bossNum > 0) {
    let bossCount = bossNum
    let normalCount = enemyCount;

    if (playerHasCursedSilkSachet) {
      bossCount += 1;
      normalCount += 1;
    }

    const bossIds = weightedRandomPick(specialEnemies, bossCount) as AllGameEnemyID[];
    // 如果因为 special 的 maxCountPerWave 限制导致实际 boss 数少于期望，则用普通池补足
    const normalIds = (weightedRandomPick(areaData.enemyPool, normalCount) as AllGameEnemyID[])
    enemyIds = [...bossIds, ...normalIds];
  } else {
    enemyIds = weightedRandomPick(areaData.enemyPool, enemyCount) as AllGameEnemyID[];
  }

  return enemyIds
}

export async function checkAndConsumeDenseFogResources(room: NormalBattleRoom) {
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

    let thisItemCount = await getItemInfoPreferCache(owner, itemId)
    if (thisItemCount.count < count.count) {
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

export async function checkAndConsumeResourcesToEnterArea(room: NormalBattleRoom, slienceFail: boolean = false) {
  let areaId = room.area;
  let battleArea = allBattleAreas[areaId] as BattleArea;
  if (!battleArea) {
    if (!slienceFail) {
      throw new Error("未找到战斗区域");
    }

    return false
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
      if (!slienceFail) {
        throw new Error(`进入副本失败：房主缺少进入区域所需的资源 - ${allGameResource[itemId].name}`);
      }
      return false;
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
