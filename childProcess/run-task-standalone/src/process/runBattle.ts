import type { BattleRoom, NormalBattleRoom, WorldBossBattleRoom } from "~/shared/types/battleRoom";
import { BattleStatus, type BattleInfo } from "~/shared/types/battle";
import type { AllBaseCharacterStatusType, AllCharacterStatusType, CharacterStatusImprove } from "~/shared/types/characterInfo";
import { ATTACK_EXP_PER_DEAL_DAMAGE, BATTLE_ROOM_DIFFICULTY_LEVELS_INFO, DAMAGE_EXP_SHARE_PERCENT, DEFENCE_EXP_PER_DEAL_DAMAGE, DEX_EXP_PER_DEAL_DAMAGE, DEX_EXP_PER_TAKE_DAMAGE, GO_TO_AREA_DURATION, MIN_BATTLE_ROUND, SOMMONER_DAMAGE_EXP_SHARE_PERCENT, STAMINA_EXP_PER_TAKE_DAMAGE, STRENGTH_EXP_PER_DEAL_DAMAGE } from "~/shared/data/constant";
import { generateCallback, getBattleInfoFromRedis, getBattleRoomById, gotoNextTurn, removeBattleInfoFromRedis, runBattleRound, setBattleInfoIntoMemory, startBattle, prepareRoomDataToBattle, checkAndConsumeDenseFogResources, checkAndConsumeResourcesToEnterArea, getNormalBattleRoomById, startWorldBossBattle, removeBattleInfoFromMemory } from "../utils/game/battle";
import { updateRoom } from "../utils/game/room";
import { increaseCharacterStatusExp } from "../utils/game/characterStatus";
import { pushMessageToQueue, enqueueBattleOutcomeBatch } from "../utils/game/msgQueue";
import { clone, ObjectKeys } from "~/shared/utils";
import type { AllBattleStateId } from "~/shared/types/BattleState";
import { detachState } from "~/shared/data/allBattleState";
import type { BaseBattleUnit } from "~/shared/types/unit";
import { createTimingProbe } from "../utils/game/timing";
import { addDamageToQueue, getGlobalBossState, initializeGlobalBossState, syncWorldBossHp, getWorldBossConfigById } from "../utils/game/worldBoss";
import type { WorldBossBattleConfig } from "~/shared/types/worldBoss";
import { getAllUnitStatusticInBattle } from "~/server/utils/game/battleAction"

// 低风险微优化：统一时间戳与双删去重
function removeBattleInfosOnce(primaryUuid: string, roomBattleUuid?: string | null) {
  if (!primaryUuid) return Promise.resolve();
  if (roomBattleUuid && roomBattleUuid !== primaryUuid) {
    removeBattleInfoFromMemory(primaryUuid);
    removeBattleInfoFromMemory(roomBattleUuid);
    return Promise.resolve();
  }
  removeBattleInfoFromMemory(primaryUuid);
  return Promise.resolve();
}

// Cache world-boss configs in memory to avoid frequent redis/hydration calls.
const worldBossConfigCache = new Map<string, WorldBossBattleConfig | null>();

async function getCachedWorldBossConfig(bossId: string): Promise<WorldBossBattleConfig | undefined> {
  if (!bossId) return undefined;
  if (worldBossConfigCache.has(bossId)) {
    return worldBossConfigCache.get(bossId) ?? undefined;
  }
  try {
    const cfg = await getWorldBossConfigById(bossId);
    // cache even undefined (as null) to avoid repeated misses
    worldBossConfigCache.set(bossId, cfg ?? null);
    return cfg;
  } catch (err) {
    console.error('[getCachedWorldBossConfig] failed to load config', err);
    worldBossConfigCache.set(bossId, null);
    return undefined;
  }
}

export const runBattle = async (roomUuid: string) => {
  const room = await getBattleRoomById(roomUuid);

  if (!room) {
    console.error(`[runBattle] room not found: ${roomUuid}`);
    return;
  }

  if (room?.battleType == 'worldBoss') {
    return runBossBattle(room);
  }
  if (!room?.battleType || room.battleType == 'normal') {
    return runNormalBattle(room);
  }

  console.error(`[runBattle] unknown battle type for room ${roomUuid}: ${room.battleType}`);
}

export const runNormalBattle = async (room: NormalBattleRoom) => {
  const roomUuid = room.uuid;
  const now = Date.now();
  const battleId = room.battleUuid;

  if (!room) {
    return
  }

  // if (!battleId) {
  //   return
  // }

  if (room.type !== 'battle') {
    return
  }

  if (!['battling', 'waiting_for_autostart', 'waiting_for_restart', 'go_to_area'].includes(room?.status)) {
    return;
  }

  // Ensure time fields exist for specific states in boss rooms as well
  try {
    if (room.status === 'waiting_for_autostart' && !room.waitingForAutoStartTime) {
      room.waitingForAutoStartTime = now + 15 * 1000;
      room.lastBattleAt = now;
      room.currentRepeat = room.currentRepeat ?? 0;
      await updateRoom(room.uuid, room);
      pushMessageToQueue({ type: 'notify_all_room_members_to_update_room', roomUuid: room.uuid });
      console.warn(`[runBossBattle] patched missing waitingForAutoStartTime for room ${room.uuid}`);
    }

    if (room.status === 'waiting_for_restart' && !room.waitingForRestartTime) {
      room.waitingForRestartTime = now + 15 * 1000;
      room.lastBattleAt = now;
      room.currentRepeat = room.currentRepeat ?? 0;
      await updateRoom(room.uuid, room);
      pushMessageToQueue({ type: 'notify_all_room_members_to_update_room', roomUuid: room.uuid });
      console.warn(`[runBossBattle] patched missing waitingForRestartTime for room ${room.uuid}`);
    }

    if (room.status === 'go_to_area' && !room.arriveAreaTime) {
      room.arriveAreaTime = now + GO_TO_AREA_DURATION;
      room.lastBattleAt = now;
      await updateRoom(room.uuid, room);
      pushMessageToQueue({ type: 'notify_all_room_members_to_update_room', roomUuid: room.uuid });
      console.warn(`[runBossBattle] patched missing arriveAreaTime for room ${room.uuid}`);
    }
  } catch (err) {
    console.error('[runBossBattle] failed to patch missing timers', err);
  }

  // 自愈逻辑：房间标记为战斗中，但缺失 battleId 或 battleInfo
  // 场景：多服务停机后重启，Redis中战斗快照丢失或未持久化，导致战斗无法继续推进
  if (room.status === 'battling') {
    // 若没有 battleId，或后续读取不到 battleInfo，都应触发恢复到可推进状态
    if (!battleId) {
      // 优先遵循房间配置的自动重启/自动开始，否则降级到 waiting
      if (room.autoRestart) {
        room.status = 'waiting_for_restart';
        room.waitingForRestartTime = now + 15 * 1000;
        room.currentRepeat = 0;
        room.lastBattleAt = now;
      } else if (room.autoStartBattle) {
        room.status = 'waiting_for_autostart';
        room.waitingForAutoStartTime = now + 15 * 1000;
        room.currentRepeat = 0;
        room.lastBattleAt = now;
      } else {
        room.status = 'waiting';
        room.currentRepeat = 0;
      }
      room.battleUuid = undefined;
      await updateRoom(room.uuid, room);
      pushMessageToQueue({
        type: 'notify_all_room_members_to_update_room',
        roomUuid: room.uuid,
      });
      return;
    }
  }

  // 最小重复轮数
  if (room.repeatCount < MIN_BATTLE_ROUND) {
    room.repeatCount = MIN_BATTLE_ROUND;
  }

  if (room.status == 'go_to_area') {
    if (room.arriveAreaTime && now >= room.arriveAreaTime) {
      let { battleRoom: latestBattleRoom, battleInfo: latestBattleInfo } = await startBattle(room);

      room.status = "battling";
      room.arriveAreaTime = undefined;
      room.waitingForRestartTime = undefined;
      room.waitingForAutoStartTime = undefined;

      // 更新room信息
      await Promise.all([
        updateRoom(latestBattleRoom.uuid, latestBattleRoom),
        // setBattleInfoToRedis(latestBattleInfo),
      ]);

      for (const member of latestBattleRoom.memberIds) {
        pushMessageToQueue({
          type: "battle_start",
          userUuid: member,
          battleRoom: latestBattleRoom,
        });
      }

      pushMessageToQueue({
        type: "notify_all_room_members_to_update_room",
        roomUuid: room.uuid,
      });
      return;
    } else {
      room.status = 'go_to_area'
      return
    }
  }

  // 自动开始战斗，依旧需要15秒的等待时间
  if (room.status == 'waiting_for_autostart') {
    // 若没有等待时间，被动补齐一个 15s 计时，防止停留在 waiting_for_autostart
    if (!room.waitingForAutoStartTime) {
      room.waitingForAutoStartTime = now + 15 * 1000;
      room.currentRepeat = 0;
      room.lastBattleAt = now;
      await updateRoom(room.uuid, room);
      return;
    }

    if (now >= room.waitingForAutoStartTime) {

      let newRoom = await prepareRoomDataToBattle(roomUuid)

      // 更新room信息
      await updateRoom(newRoom.uuid, newRoom);

      pushMessageToQueue({
        type: "notify_all_room_members_to_update_room",
        roomUuid: newRoom.uuid,
      });
      return
    } else {
      room.status = 'waiting_for_autostart'
      return
    }
  }

  // 自动开启战斗和自动重开是两个逻辑
  if (room.status == 'waiting_for_restart') {
    if (room.waitingForRestartTime && now >= room.waitingForRestartTime) {
      // if (room.battleUuid) {
        // await removeBattleInfoFromRedis(room.battleUuid);
      // }

      let { battleRoom: latestBattleRoom, battleInfo: latestBattleInfo } = await startBattle(room);

        // room.status = "battling";

        // await Promise.all([
        //   await updateRoom(latestBattleRoom.uuid, latestBattleRoom),
        //   await setBattleInfoToRedis(latestBattleInfo),
        // ]);
        // 更新room信息

        for (const member of latestBattleRoom.memberIds) {
          pushMessageToQueue({
            type: "battle_start",
            userUuid: member,
            battleRoom: latestBattleRoom,
          });
        }

        pushMessageToQueue({
          type: "notify_all_room_members_to_update_room",
          roomUuid: room.uuid,
        });
        return;
    } else {
      room.status = 'waiting_for_restart'
      return 
    }
  }

  if (!battleId) {
    return
  }
  const battleInfo = await getBattleInfoFromRedis(battleId);

  if (!battleInfo) {
    // 自愈逻辑：battleId存在但快照丢失，同样按配置恢复
    if (room.status === 'battling') {
      if (room.autoRestart) {
        room.status = 'waiting_for_restart';
        room.waitingForRestartTime = now + 15 * 1000;
        room.currentRepeat = 0;
        room.lastBattleAt = now;
      } else if (room.autoStartBattle) {
        room.status = 'waiting_for_autostart';
        room.waitingForAutoStartTime = now + 15 * 1000;
        room.currentRepeat = 0;
        room.lastBattleAt = now;
      } else {
        room.status = 'waiting';
        room.currentRepeat = 0;
      }
      room.battleUuid = undefined;
      await updateRoom(room.uuid, room);
      pushMessageToQueue({
        type: 'notify_all_room_members_to_update_room',
        roomUuid: room.uuid,
      });
      return;
    }
    return
  }

  let time1 = Date.now();
  await processNormalBattleTurn(room, battleInfo);
  let time2 = Date.now();
  // 关闭耗时警告日志
  if (time2 - time1 > 4000) {
    console.warn(`run battle for room ${room.uuid}(${battleInfo.uuid}) took too long: ${time2 - time1}ms`);
  }
};

async function processNormalBattleTurn(room: NormalBattleRoom, battleInfo: BattleInfo) {
  const now = Date.now();
  // 探针开关与采样：降低日志噪音

  const { mark, logDuration } = createTimingProbe('processBattleTurn', {
    global: false,
    sampleRate: 0.01,
    roomWhitelist: [],
    roomUuid: room.uuid,
    battleUuid: battleInfo.uuid,
  });

  mark("runRound:start");
  const { battleInfo: thisRoundBattleInfo, thisRoundAction, canPassTurn, currentUnit } =
    await runBattleRound(battleInfo, room);
  mark("runRound:end");
  logDuration("runRound:start", "runRound:end");

    const thisBattleUuid = thisRoundBattleInfo.uuid;

    if (currentUnit) {
      pushMessageToQueue({
        type: "on_turn_end",
        battleUuid: battleInfo.uuid,
        battleInfo,
        info: {
          source: currentUnit?.uuid,
        },
      });
    }

  if (
    !thisRoundBattleInfo.battleStatus ||
    thisRoundBattleInfo.battleStatus == BattleStatus.BATTLING
  ) {
    // 3. 通知房间所有成员最新战斗信息
    // await dispatchFullBattleInfoToRoom(room, thisRoundBattleInfo, thisRoundAction);
    mark("push:dispatch_battle_info:start");
    pushMessageToQueue({
      type: "dispatch_battle_info_to_client",
      roomUuid: room.uuid,
      battleInfo: thisRoundBattleInfo,
      thisRoundAction: thisRoundAction,
    });
    mark("push:dispatch_battle_info:end");
    logDuration("push:dispatch_battle_info:start", "push:dispatch_battle_info:end");

    if (canPassTurn) {
      // 推进到下一个单位
      mark("gotoNextTurn:start");
      gotoNextTurn(thisRoundBattleInfo, {
        currentTurnUnit: currentUnit,
        reason: 'NORMAL'
      });
      mark("gotoNextTurn:end");
      logDuration("gotoNextTurn:start", "gotoNextTurn:end");

    }

    // 更新 BattleInfo（中途回合采用去抖异步写，避免阻塞）
    mark("redis:setBattleInfo:start");
    setBattleInfoIntoMemory(thisRoundBattleInfo);
    mark("redis:setBattleInfo:end");
    logDuration("redis:setBattleInfo:start", "redis:setBattleInfo:end");

    // 当一个回合结束后，检查上一个回合是否是某个单位的额外回合
    // 如果是额外回合，则应该去除此额外回合
    if (currentUnit && !battleInfo.extraTurnOnBattleBegin?.length) {
      let currentTurnUnit = currentUnit
      let lastTurnIndex = battleInfo.currentTurnIndex - 1;

      if (currentTurnUnit.tmpOncePreBattleExtraTurnIndexList?.includes(lastTurnIndex)) {

        currentTurnUnit.tmpOncePreBattleExtraTurnIndexList = currentTurnUnit.tmpOncePreBattleExtraTurnIndexList.filter(index => index !== lastTurnIndex);
        battleInfo.thisBattleTmpOnceExtraTurnIndexList = battleInfo.thisBattleTmpOnceExtraTurnIndexList?.filter(index => index != lastTurnIndex)

        battleInfo.turnOrder = battleInfo.turnOrder.toSpliced(lastTurnIndex, 1)
        battleInfo.currentTurnIndex = battleInfo.currentTurnIndex - 1;
      }
    }
  }

  // 如果玩家失败，结束战斗
  if (thisRoundBattleInfo.battleStatus == BattleStatus.PLAYER_LOSE) {
    mark("reward:lose:stats:start");
    let unitStatistic = getAllUnitStatusticInBattle(thisRoundBattleInfo)
    mark("reward:lose:stats:end");
    logDuration("reward:lose:stats:start", "reward:lose:stats:end");

    // 异步入队（微调度），削峰避免与房间更新/广播同窗阻塞
    setImmediate(() => {
      enqueueBattleOutcomeBatch({
        type: 'battle_outcome_batch',
        battleUuid: thisRoundBattleInfo.uuid,
        roomUuid: room.uuid,
        room,
        battleInfo: thisRoundBattleInfo,
        unitStatistic,
        extraExpPercent: 0,
        result: 'lose'
      } as any).catch(err => console.error('[enqueueBattleOutcomeBatch] lose error', err));
    });

    pushMessageToQueue({
      type: "dispatch_battle_info_to_client",
      roomUuid: room.uuid,
      battleInfo: thisRoundBattleInfo,
      thisRoundAction: thisRoundAction,
    });

    mark("redis:removeBattleInfo:start");
    await removeBattleInfosOnce(thisRoundBattleInfo.uuid, room.battleUuid);
    mark("redis:removeBattleInfo:end");
    logDuration("redis:removeBattleInfo:start", "redis:removeBattleInfo:end");

    // 更新迷雾模式战斗结果
    if (thisRoundBattleInfo.isDenseFogMode_Encounter) {
      for (const info of room.denseFogModeConflictEncounter || []) {
        if (info.battleUuid == thisBattleUuid) {
          info.result = 'LOSE'
          break;
        }
      }
    }

    // 删除战斗信息
    if (room.autoRestart) {
      room.status = "waiting_for_restart"
      room.waitingForRestartTime = now + 15 * 1000; // 等待重启
      room.currentRepeat = 0;
      room.lastBattleAt = now;

      if (room.denseFogMode) {
        let canContinueDenseFogMode = false;

        // 战败后，总是关闭迷雾模式
        if (room.autoRestartDenseFogMode) {
          try {
            canContinueDenseFogMode = await checkAndConsumeDenseFogResources(room);
          } catch (e: any) {
            canContinueDenseFogMode = false;
          }
        }

        if (!canContinueDenseFogMode) {
          room.denseFogMode = false;
          room.disableDenseFogModeBecausePlayerLose = true;
        }
      }

      const enterAreaResourceConsumeResult = await checkAndConsumeResourcesToEnterArea(room, true);
      if (!enterAreaResourceConsumeResult) {
        room.status = "waiting"
        room.battleUuid = undefined;
        room.waitingForRestartTime = undefined;
        room.currentRepeat = 0;
      }

      mark("room:update:start");
      await updateRoom(room.uuid, room);
      mark("room:update:end");
      logDuration("room:update:start", "room:update:end");

      mark("push:updateRoomNotify:start");
      pushMessageToQueue({
        type: "notify_all_room_members_to_update_room",
        roomUuid: room.uuid,
      });
      mark("push:updateRoomNotify:end");
      logDuration("push:updateRoomNotify:start", "push:updateRoomNotify:end");

      return
    }

    if (room.autoStartBattle) {
      room.status = "waiting_for_autostart"
      room.waitingForAutoStartTime = now + 15 * 1000; // 等待重启
      room.currentRepeat = 0;
      room.lastBattleAt = now;

      // 战败后，总是关闭迷雾模式
      if (room.denseFogMode) {
        let canContinueDenseFogMode = false;

        // 战败后，总是关闭迷雾模式
        if (room.autoRestartDenseFogMode) {
          try {
            canContinueDenseFogMode = await checkAndConsumeDenseFogResources(room);
          } catch (e: any) {
            canContinueDenseFogMode = false;
          }
        }

        if (!canContinueDenseFogMode) {
          room.denseFogMode = false;
          room.disableDenseFogModeBecausePlayerLose = true;
        }
      }

      const enterAreaResourceConsumeResult = await checkAndConsumeResourcesToEnterArea(room, true);
      if (!enterAreaResourceConsumeResult) {
        room.status = "waiting"
        room.battleUuid = undefined;
        room.waitingForRestartTime = undefined;
        room.currentRepeat = 0;
      }

      await updateRoom(room.uuid, room);

      pushMessageToQueue({
        type: "notify_all_room_members_to_update_room",
        roomUuid: room.uuid,
      });

      return
    }

    // 已执行 removeBattleInfosOnce 上方，这里去重
    // 玩家失败后，更新房间状态
    room.status = "waiting";
    room.battleUuid = undefined; // 清除战斗UUID
    // 更新room信息
    await updateRoom(room.uuid, room);

    // await dispatchBattleEndEventToRoomByRoomId(room.uuid);
    pushMessageToQueue({
      type: "dispatch_battle_end",
      roomUuid: room.uuid,
    });
    // await notifyAllRoomMembersToUpdateRoom(room);
    pushMessageToQueue({
      type: "notify_all_room_members_to_update_room",
      roomUuid: room.uuid,
    })

    return;
  }

  if (thisRoundBattleInfo.battleStatus == BattleStatus.PLAYER_WIN || thisRoundBattleInfo.battleStatus == BattleStatus.ESCAPED) {
    // 玩家胜利后，更新发放奖励
    // 获取此次战斗的敌人信息
    mark("reward:win:stats:start");
    let unitStatistic = getAllUnitStatusticInBattle(thisRoundBattleInfo)
    mark("reward:win:stats:end");
    logDuration("reward:win:stats:start", "reward:win:stats:end");
    let extraExpPercent = 0
    if (room.difficulty && room.difficulty > 0) {
      const difficultyConfig = BATTLE_ROOM_DIFFICULTY_LEVELS_INFO[room.difficulty - 1];
      if (difficultyConfig) {
        extraExpPercent = difficultyConfig.additionalExpPercent || 0;
      }
    }

    // 迷雾模式，额外25%经验获取（玩家可见的描述依旧是25%，但实际上已经变为15%了）
    if (room.denseFogMode) {
      extraExpPercent += 0.15;
    }

    // 异步入队（微调度），削峰避免与清理/广播同窗阻塞
    setImmediate(() => {
      enqueueBattleOutcomeBatch({
        type: 'battle_outcome_batch',
        battleUuid: thisRoundBattleInfo.uuid,
        roomUuid: room.uuid,
        room,
        battleInfo: thisRoundBattleInfo,
        unitStatistic,
        extraExpPercent,
        result: thisRoundBattleInfo.battleStatus == BattleStatus.ESCAPED ? 'escaped' : 'win'
      } as any).catch(err => console.error('[enqueueBattleOutcomeBatch] win error', err));
    });

    // 添加一层检查，检查expRewardDetail中的battleExp是不是每位玩家都一致
    // const allPlayerUuids = Object.keys(expRewardDetail);

    // if (allPlayerUuids.length > 1) {
    //   const battleExpValues = allPlayerUuids.map(uuid => expRewardDetail[uuid]?.battleExp).filter(exp => typeof exp === 'number');
    //   const isConsistent = battleExpValues.length > 0 && battleExpValues.every(exp => exp === battleExpValues[0]);

    //   if (!isConsistent) {
    //     console.error(`[Battle] BattleExp不一致 - 房间:${room.uuid}, 值:`,
    //       Object.fromEntries(allPlayerUuids.map(uuid => [uuid, expRewardDetail[uuid]?.battleExp])));
    //   }
    // }

    // 更新迷雾模式战斗结果
    if (thisRoundBattleInfo.isDenseFogMode_Encounter) {
      for (const info of room.denseFogModeConflictEncounter || []) {
        if (info.battleUuid == thisBattleUuid) {
          info.result = 'WIN'
          break;
        }
      }
    }

    // 客户端奖励事件由后台worker推送（保持事件名与结构完全一致）
    pushMessageToQueue({
      type: "dispatch_battle_info_to_client",
      roomUuid: room.uuid,
      battleInfo: thisRoundBattleInfo,
      thisRoundAction: thisRoundAction,
    });

    mark("redis:removeBattleInfo:start");
    await removeBattleInfosOnce(thisRoundBattleInfo.uuid, room.battleUuid);
    mark("redis:removeBattleInfo:end");
    logDuration("redis:removeBattleInfo:start", "redis:removeBattleInfo:end");

    room.currentRepeat++;
    mark("room:update:start");
    await updateRoom(room.uuid, room);
    mark("room:update:end");
    logDuration("room:update:start", "room:update:end");

    // 玩家胜利后，进行下一场战斗
    // 胜利后开启下一场：轻微延迟，错峰避免与结算清理同窗阻塞
    // setTimeout(async () => {
      try {
        // 重新读取最新的房间状态，避免闭包中的 room 被其他流程修改导致读到脏数据
        const freshRoom = await getNormalBattleRoomById(room.uuid);
        if (!freshRoom) return;

        // 如果房间配置了自动切换到世界Boss，并且目标Boss符合开战条件，则切换房间类型并直接发起世界Boss战斗
        const autoConf = (freshRoom as NormalBattleRoom).autoWorldBossBattleConf;
        if (autoConf && autoConf.type === 'switch' && autoConf.config?.bossId) {
          try {
            const bossId = autoConf.config.bossId;
            const cfg = await getWorldBossConfigById(bossId);
            const now = Date.now();
            const withinWindow = (!cfg?.startAt || cfg.startAt <= now) && (!cfg?.endAt || cfg.endAt >= now);
            const stateAllowed = cfg && (cfg.state === 'waiting' || cfg.state === 'battling');
            if (cfg && withinWindow && stateAllowed) {
              // 转换房间为世界Boss房间并持久化，之后发起世界Boss战斗
              const worldRoom = { ...(freshRoom as any) } as WorldBossBattleRoom;
              worldRoom.battleType = 'worldBoss';
              worldRoom.worldBossId = bossId;
              worldRoom.worldBossVersion = cfg.version;
              worldRoom.afterWin = {
                type: 'startBattle',
                // @ts-expect-error
                config: {
                  area: freshRoom.area,
                  difficulty: freshRoom.difficulty,
                }
              };
              worldRoom.status = 'go_to_area';
              worldRoom.arriveAreaTime = now + GO_TO_AREA_DURATION;
              worldRoom.battleUuid = undefined;
              worldRoom.currentRepeat = 0;
              // 写入房间（updateRoom 会做必要的索引/集合管理）
              await updateRoom(worldRoom.uuid, worldRoom);


              // for (const member of latestBattleRoom.memberIds) {
              //   pushMessageToQueue({
              //     type: "battle_start",
              //     userUuid: member,
              //     battleRoom: latestBattleRoom,
              //   });
              // }

              // pushMessageToQueue({
              //   type: "notify_all_room_members_to_update_room",
              //   roomUuid: latestBattleRoom.uuid,
              // });

              // // 保持现有协议：下发最新战斗信息
              // pushMessageToQueue({
              //   type: "dispatch_latest_battle_info",
              //   battleRoom: latestBattleRoom,
              //   latestBattleInfo: latestBattleInfo
              // });

              return;
            }
          } catch (err) {
            console.error('[runBattle] auto world-boss switch check failed', err);
            // 如果自动切换逻辑出错，继续按照普通战斗流程处理
          }
        }

        // 按需使用上一轮的战斗信息以承接必要状态（例如技能冷却）
        let { battleRoom: latestBattleRoom, battleInfo: latestBattleInfo } = await startBattle(freshRoom, thisRoundBattleInfo);
        latestBattleRoom.lastBattleAt = Date.now();

        for (const member of latestBattleRoom.memberIds) {
          pushMessageToQueue({
            type: "battle_start",
            userUuid: member,
            battleRoom: latestBattleRoom,
          });
        }

        pushMessageToQueue({
          type: "notify_all_room_members_to_update_room",
          roomUuid: latestBattleRoom.uuid,
        });

        // 保持现有协议：下发最新战斗信息
        pushMessageToQueue({
          type: "dispatch_latest_battle_info",
          battleRoom: latestBattleRoom,
          latestBattleInfo: latestBattleInfo
        });
      } catch (err) {
        console.error('[runBattle] delayed startBattle error', err);
      }
    // }, 40);
    return;
  }
}


// 如果在boss战go_to_area期间，boss阵亡，则依旧会进入战斗，但是下一次回合开始时，因敌人全部阵亡，所以判定玩家胜利
export const runBossBattle = async (room: WorldBossBattleRoom) => {
  const roomUuid = room.uuid;
  const now = Date.now();
  const battleId = room.battleUuid;

  if (!room) {
    return
  }

  if (room.type !== 'battle') {
    return
  }

  if (!['battling', 'waiting_for_autostart', 'waiting_for_restart', 'go_to_area'].includes(room?.status)) {
    return;
  }

  if (room.status == 'go_to_area') {
    if (room.arriveAreaTime && now >= room.arriveAreaTime) {
      let { battleRoom: latestBattleRoom, battleInfo: latestBattleInfo, worldBossState } = await startWorldBossBattle(room);

      room.status = "battling";
      room.arriveAreaTime = undefined;
      room.waitingForRestartTime = undefined;
      room.waitingForAutoStartTime = undefined;

      // 更新room信息
      await Promise.all([
        updateRoom(latestBattleRoom.uuid, latestBattleRoom),
        // setBattleInfoToRedis(latestBattleInfo),
      ]);

      for (const member of latestBattleRoom.memberIds) {
        pushMessageToQueue({
          type: "battle_start",
          userUuid: member,
          battleRoom: latestBattleRoom,
        });
      }

      pushMessageToQueue({
        type: "notify_all_room_members_to_update_room",
        roomUuid: room.uuid,
      });
      return;
    } else {
      room.status = 'go_to_area'
      return
    }
  }

  // 自动开始战斗，依旧需要15秒的等待时间
  if (room.status == 'waiting_for_autostart') {
    // 若没有等待时间，被动补齐一个 15s 计时，防止停留在 waiting_for_autostart
    if (!room.waitingForAutoStartTime) {
      room.waitingForAutoStartTime = now + 15 * 1000;
      room.currentRepeat = 0;
      room.lastBattleAt = now;
      await updateRoom(room.uuid, room);
      return;
    }

    if (now >= room.waitingForAutoStartTime) {
      let newRoom = await prepareRoomDataToBattle(roomUuid)

      // 更新room信息
      await updateRoom(newRoom.uuid, newRoom);

      pushMessageToQueue({
        type: "notify_all_room_members_to_update_room",
        roomUuid: newRoom.uuid,
      });
      return
    } else {
      room.status = 'waiting_for_autostart'
      return
    }
  }

  // Self-healing logic
  if (room.status === 'battling') {
    if (!battleId) {
      if (room.autoStartBattle) {
        room.status = 'waiting_for_autostart';
        room.waitingForAutoStartTime = now + 15 * 1000;
        room.currentRepeat = 0;
        room.lastBattleAt = now;
      } else {
        room.status = 'waiting';
        room.currentRepeat = 0;
      }
      room.battleUuid = undefined;
      await updateRoom(room.uuid, room);
      pushMessageToQueue({
        type: 'notify_all_room_members_to_update_room',
        roomUuid: room.uuid,
      });
      return;
    }
  }

  if (room.status == 'waiting_for_restart') {
    if (room.waitingForRestartTime && now >= room.waitingForRestartTime) {
      let { battleRoom: latestBattleRoom, battleInfo: latestBattleInfo } = await startWorldBossBattle(room);

        for (const member of latestBattleRoom.memberIds) {
          pushMessageToQueue({
            type: "battle_start",
            userUuid: member,
            battleRoom: latestBattleRoom,
          });
        }

        pushMessageToQueue({
          type: "notify_all_room_members_to_update_room",
          roomUuid: room.uuid,
        });
        return;
    } else {
      room.status = 'waiting_for_restart'
      return 
    }
  }

  if (!battleId) {
    return
  }
  const battleInfo = await getBattleInfoFromRedis(battleId);

  if (!battleInfo) {
    if (room.status === 'battling') {
      if (room.autoStartBattle) {
        room.status = 'waiting_for_autostart';
        room.waitingForAutoStartTime = now + 15 * 1000;
        room.currentRepeat = 0;
        room.lastBattleAt = now;
      } else {
        room.status = 'waiting';
        room.currentRepeat = 0;
      }
      room.battleUuid = undefined;
      await updateRoom(room.uuid, room);
      pushMessageToQueue({
        type: 'notify_all_room_members_to_update_room',
        roomUuid: room.uuid,
      });
      return;
    }
    return
  }

  let time1 = Date.now();
  await processBossBattleTurn(room, battleInfo);
  let time2 = Date.now();
  if (time2 - time1 > 4000) {
    console.warn(`run boss battle for room ${room.uuid}(${battleInfo.uuid}) took too long: ${time2 - time1}ms`);
  }
};

async function processBossBattleTurn(
  room: WorldBossBattleRoom,
  battleInfo: BattleInfo
) {
  if (battleInfo.worldBossConfig?.startAt) {
    // 如果当前时间还没到开始时间，直接返回
    if (Date.now() < battleInfo.worldBossConfig.startAt) {
      await removeBattleInfosOnce(battleInfo.uuid, room.battleUuid);
      room.status = "waiting";
      room.battleUuid = undefined; // 清除战斗UUID
      // 更新room信息
      await updateRoom(room.uuid, room);

      // await dispatchBattleEndEventToRoomByRoomId(room.uuid);
      pushMessageToQueue({
        type: "dispatch_battle_end",
        roomUuid: room.uuid,
      });
      // await notifyAllRoomMembersToUpdateRoom(room);
      pushMessageToQueue({
        type: "notify_all_room_members_to_update_room",
        roomUuid: room.uuid,
      })
    }
  }

  if (battleInfo.worldBossConfig?.endAt) {
    // 如果当前时间已经超过结束时间，直接返回
    if (Date.now() > battleInfo.worldBossConfig.endAt) {
      await removeBattleInfosOnce(battleInfo.uuid, room.battleUuid);
      room.status = "waiting";
      room.battleUuid = undefined; // 清除战斗UUID
      // 更新room信息
      await updateRoom(room.uuid, room);

      // await dispatchBattleEndEventToRoomByRoomId(room.uuid);
      pushMessageToQueue({
        type: "dispatch_battle_end",
        roomUuid: room.uuid,
      });
      // await notifyAllRoomMembersToUpdateRoom(room);
      pushMessageToQueue({
        type: "notify_all_room_members_to_update_room",
        roomUuid: room.uuid,
      })
    }
  }

  const beforeBossUnitSnapshot = battleInfo.members
    .filter((unit) => battleInfo.worldBossConfig?.uuidList.includes(unit.uuid))
    .map((unit) => ({
      uuid: unit.uuid,
      hp: unit.hp,
    }));

  const now = Date.now();
  const {
    battleInfo: thisRoundBattleInfo,
    thisRoundAction,
    canPassTurn,
    currentUnit,
  } = await runBattleRound(battleInfo, room);

  // 找到所有的boss单位
  const bossId = thisRoundBattleInfo.worldBossConfig!.bossId;
  const bossUnitUuids = thisRoundBattleInfo.worldBossConfig!.uuidList;
  const bossBattleUuid = thisRoundBattleInfo.worldBossConfig!.worldBossBattleUuid;

  const bossUnits = thisRoundBattleInfo.members.filter((unit) =>
    bossUnitUuids.includes(unit.uuid)
  );

  const unitDeltas: Array<{ unitUuid: string; deltaHp: number; afterHp: number }> = [];
  let totalHpDelta = 0;

  // 对比血量变化，携带到事件中，减少后续 Redis 查询
  bossUnits.forEach((bossUnit) => {
    const previousUnit = beforeBossUnitSnapshot.find((unit) => unit.uuid === bossUnit.uuid);
    if (!previousUnit) return;
    const deltaHp = bossUnit.hp - previousUnit.hp; // 伤害为负，治疗为正
    if (deltaHp !== 0) {
      totalHpDelta += deltaHp;
      unitDeltas.push({ unitUuid: bossUnit.uuid, deltaHp, afterHp: bossUnit.hp });
    }
  });

  if (totalHpDelta !== 0 && unitDeltas.length > 0) {
    try {
      await addDamageToQueue(bossId, {
        worldBossBattleUuid: bossBattleUuid,
        bossId,
        totalDeltaHp: totalHpDelta,
        units: unitDeltas,
        roomId: room.uuid,
        battleId: battleInfo.uuid,
        turn: thisRoundBattleInfo.currentTurnIndex ?? 0,
        seq: Date.now(),
        createdAt: Date.now(),
        players: Array.isArray(room.memberIds) ? room.memberIds.filter(Boolean) as string[] : [],
      });
    } catch (err) {
      console.error('[WorldBoss] enqueue delta failed', err);
    }
  }

  // 定期消费队列并同步全局 Boss HP（含 per-unit），再广播给相关玩家
  let updatedBossState = await syncWorldBossHp(bossId, room.memberIds ?? [], room.memberIds ?? []);

  if (updatedBossState) {
    const latestBossMembers = updatedBossState.bossMembers;
    // 更新thisRoundBattleInfo中的Boss单位配置
    thisRoundBattleInfo.members = thisRoundBattleInfo.members.map((unit) => {
      if (bossUnitUuids.includes(unit.uuid)) {
        const latestBossUnit = latestBossMembers.find((bUnit) => bUnit.uuid === unit.uuid);
        if (latestBossUnit) {
          unit.hp = latestBossUnit.hp;
          unit.maxHp = latestBossUnit.maxHp;
          // return latestBossUnit;
        }
      }
      return unit;
    });
  }

  if (currentUnit) {
    pushMessageToQueue({
      type: "on_turn_end",
      battleUuid: battleInfo.uuid,
      battleInfo,
      info: {
        source: currentUnit?.uuid,
      },
    });
  }

  if (
    !thisRoundBattleInfo.battleStatus ||
    thisRoundBattleInfo.battleStatus == BattleStatus.BATTLING
  ) {
    pushMessageToQueue({
      type: "dispatch_battle_info_to_client",
      roomUuid: room.uuid,
      battleInfo: thisRoundBattleInfo,
      thisRoundAction: thisRoundAction,
    });

    if (canPassTurn) {
      gotoNextTurn(thisRoundBattleInfo, {
        currentTurnUnit: currentUnit,
        reason: "NORMAL",
      });
    }

    setBattleInfoIntoMemory(thisRoundBattleInfo);

    if (currentUnit && !battleInfo.extraTurnOnBattleBegin?.length) {
      let currentTurnUnit = currentUnit;
      let lastTurnIndex = battleInfo.currentTurnIndex - 1;

      if (
        currentTurnUnit.tmpOncePreBattleExtraTurnIndexList?.includes(
          lastTurnIndex
        )
      ) {
        currentTurnUnit.tmpOncePreBattleExtraTurnIndexList =
          currentTurnUnit.tmpOncePreBattleExtraTurnIndexList.filter(
            (index) => index !== lastTurnIndex
          );
        battleInfo.thisBattleTmpOnceExtraTurnIndexList =
          battleInfo.thisBattleTmpOnceExtraTurnIndexList?.filter(
            (index) => index != lastTurnIndex
          );

        battleInfo.turnOrder = battleInfo.turnOrder.toSpliced(lastTurnIndex, 1);
        battleInfo.currentTurnIndex = battleInfo.currentTurnIndex - 1;
      }
    }

    // 如果本场战斗的世界boss已经被击败，则结束战斗
    // todo 这里会额外跑一次战斗回合，没有意义
    const globalBossState = await getGlobalBossState(battleInfo.worldBossConfig!.bossId);
    if (globalBossState && globalBossState.currentHp <= 0) {
      thisRoundBattleInfo.battleStatus = BattleStatus.PLAYER_WIN;
    }
    return;
  }

  // 如果玩家逃跑，算作玩家失败
  if (thisRoundBattleInfo.battleStatus == BattleStatus.ESCAPED) {
    thisRoundBattleInfo.battleStatus = BattleStatus.PLAYER_LOSE;
  }

  if (thisRoundBattleInfo.battleStatus == BattleStatus.PLAYER_LOSE) {
    let unitStatistic = getAllUnitStatusticInBattle(thisRoundBattleInfo)

    // 异步入队（微调度），削峰避免与房间更新/广播同窗阻塞
    setImmediate(() => {
      enqueueBattleOutcomeBatch({
        type: 'battle_outcome_batch',
        battleUuid: thisRoundBattleInfo.uuid,
        roomUuid: room.uuid,
        room,
        battleInfo: thisRoundBattleInfo,
        unitStatistic,
        extraExpPercent: 0,
        result: 'lose',

        resourceRewardTarget: 'harvestbox',
        resourceRewardTitle: '“大麻烦”战斗失败奖励'
      } as any).catch(err => console.error('[enqueueBattleOutcomeBatch] lose error', err));
    });

    pushMessageToQueue({
      type: "dispatch_battle_info_to_client",
      roomUuid: room.uuid,
      battleInfo: thisRoundBattleInfo,
      thisRoundAction: thisRoundAction,
    });

    await removeBattleInfosOnce(thisRoundBattleInfo.uuid, room.battleUuid);

    // 删除战斗信息
    if (room.autoRestart) {
      room.status = "waiting_for_restart"
      room.waitingForRestartTime = now + 15 * 1000; // 等待重启
      room.currentRepeat = 0;
      room.lastBattleAt = now;

      await updateRoom(room.uuid, room);

      pushMessageToQueue({
        type: "notify_all_room_members_to_update_room",
        roomUuid: room.uuid,
      });

      return
    }

    if (room.autoStartBattle) {
      room.status = "waiting_for_autostart"
      room.waitingForAutoStartTime = now + 15 * 1000; // 等待重启
      room.currentRepeat = 0;
      room.lastBattleAt = now;

      await updateRoom(room.uuid, room);

      pushMessageToQueue({
        type: "notify_all_room_members_to_update_room",
        roomUuid: room.uuid,
      });

      return
    }

    // 已执行 removeBattleInfosOnce 上方，这里去重
    // 玩家失败后，更新房间状态
    room.status = "waiting";
    room.battleUuid = undefined; // 清除战斗UUID
    // 更新room信息
    await updateRoom(room.uuid, room);

    // await dispatchBattleEndEventToRoomByRoomId(room.uuid);
    pushMessageToQueue({
      type: "dispatch_battle_end",
      roomUuid: room.uuid,
    });
    // await notifyAllRoomMembersToUpdateRoom(room);
    pushMessageToQueue({
      type: "notify_all_room_members_to_update_room",
      roomUuid: room.uuid,
    })

    return;
  }

  if (thisRoundBattleInfo.battleStatus == BattleStatus.PLAYER_WIN) {
    getAllUnitStatusticInBattle(thisRoundBattleInfo)

    // 客户端奖励事件由后台worker推送（保持事件名与结构完全一致）
    pushMessageToQueue({
      type: "dispatch_battle_info_to_client",
      roomUuid: room.uuid,
      battleInfo: thisRoundBattleInfo,
      thisRoundAction: thisRoundAction,
    });

    await removeBattleInfosOnce(thisRoundBattleInfo.uuid, room.battleUuid);

    // room.currentRepeat++;
    // await updateRoom(room.uuid, room);

    const afterWinConfig = clone(room.afterWin);
    if (!afterWinConfig?.type || afterWinConfig.type == 'wait') {
      // boss战斗胜利后，更新房间状态
      room.status = "waiting";
      room.battleUuid = undefined; // 清除战斗UUID
      room.readyMap[room.ownerId] = false;
    } else {
      room.status = 'waiting_for_autostart';
      room.area = afterWinConfig.config.area;

      (room as unknown as NormalBattleRoom).battleType = 'normal';
      (room as unknown as NormalBattleRoom).difficulty = afterWinConfig.config.difficulty || 0;
      room.waitingForAutoStartTime = now + 15 * 1000;
      room.currentRepeat = 0;
      room.lastBattleAt = now;
    }
    (room as unknown as NormalBattleRoom).autoWorldBossBattleConf = undefined;

    // 更新room信息
    await updateRoom(room.uuid, room);

    pushMessageToQueue({
      type: "dispatch_battle_end",
      roomUuid: room.uuid,
    });
    pushMessageToQueue({
      type: "notify_all_room_members_to_update_room",
      roomUuid: room.uuid,
    })

    return;
  }
}