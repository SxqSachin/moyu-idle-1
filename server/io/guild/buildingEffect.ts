import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { allGuildBuilding } from "~/shared/data/allGuildBuilding";
import { prisma } from "~/server/utils/game/db";
import { randomIntegerInFullCloseRange, randomNumberInFullColseRange } from "~/shared/utils";
import { ItemCountInfo, ModifyItemCountType } from "~/shared/types/gameInventory";
import { increaseItemCount } from "~/server/utils/game/characterInventory";
import { increaseCharacterStatusFromOther } from "~/server/utils/game/characterStatus";
import { addPlayerState_Battle_StateWhenStartEachBattle, upsertPlayerState_Global_Status } from "~/server/utils/game/character";
import { AllGuildBuildingId, GuildBuildingStatus } from "~/shared/types/guild";
import { AllBattleStateId } from "~/shared/types/BattleState";

export async function handleWishingPoolEffect(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{guildUuid: string}>
){
    const redisWishingPoolKey = `wishingPool:${data.user.uuid}`;

    const userUuid = data.user.uuid;
    const guildUuid = data.data.guildUuid;

    await withUniqueLock(`wishingPoolEffect:${data.user.uuid}`, async () => {
        // 检查redis中是否存在当天许愿池的记录
        const existingRecord = await redisClient.get(redisWishingPoolKey);
        if (existingRecord) {
            emitEventToUser(userUuid, "guildBuildingEffect:wishingPool:fail", { message: "今天已经许愿过了" });
            return;
        }

        // 插入redis记录，截止到今天24点过期
        const expireTime = new Date();
        expireTime.setHours(24, 30, 0, 0); // 设置到今天24点
        let result = await redisClient.set(redisWishingPoolKey, "1", {
            condition: "NX",
            expiration: {
                type: 'EX',
                value: Math.floor((expireTime.getTime() - Date.now()) / 1000) // 设置过期时间
            },
        });
        if (!result) {
            emitEventToUser(userUuid, "guildBuildingEffect:wishingPool:fail", { message: "今天已经许愿过了，晚些再来吧" });
            return;
        }

        let guildBuilding = await prisma.guildBuilding.findFirst({
            where: {
                guildUuid,
                type: "wishing_pool",
                status: {
                  in: [GuildBuildingStatus.NORMAL, GuildBuildingStatus.PREPARE_UPGRADE]
                }
            }
        });

        if (!guildBuilding) {
            emitEventToUser(userUuid, "guildBuildingEffect:wishingPool:fail", { message: "公会许愿池未建造或已损坏" });
            return;
        }

        // 获取许愿池效果
        const effect = allGuildBuilding.wishing_pool.effect(guildBuilding.level);
        let thisTimeLuckIncrease = +randomNumberInFullColseRange(effect.luck).toFixed(1);

        let rewardInfo : ItemCountInfo = {};
        for(const reward of effect.rewardPool) {
            if (!reward.id || !reward.percent) continue;

            let rewardId = reward.id;

            let percent = randomNumberInFullColseRange(0, 1);
            if (percent > reward.percent) {
                continue;
            }

            let count = reward.count ?? 1;
            if (reward.range) {
                count = randomIntegerInFullCloseRange(reward.range)
            }

            if (!rewardInfo[rewardId]) {
                rewardInfo[rewardId] = { count: 0 };
            }
            rewardInfo[rewardId].count += count;
        }

        if (Object.keys(rewardInfo).length) {
            await increaseItemCount(userUuid, rewardInfo, {
                type: ModifyItemCountType.Guild,
                actionName: "公会许愿池",
                showModifyInfo: true,
            });
        }

        await upsertPlayerState_Global_Status(userUuid, {
          stateId: 'wishingPool',
          value: thisTimeLuckIncrease,
          durationMinutes: 24 * 60
        })

        emitEventToUser(userUuid, "guildBuildingEffect:wishingPool:success", { 
            luck: thisTimeLuckIncrease,
            rewardInfo
        });
    })
}

export async function handleVitalityCatStatueEffect(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string, type: 'hp' | 'mp' | 'all' }>
) {
  const userUuid = data.user.uuid;
  const guildUuid = data.data.guildUuid;
  const type = data.data.type

  let guildBuildingId: AllGuildBuildingId = "vitalityCatStatue";
  const redisCheckKey = `${guildBuildingId}:${data.user.uuid}`;

  await withUniqueLock(`${guildBuildingId}Effect:${data.user.uuid}`, async () => {
    // 检查redis中是否存在当天许愿池的记录
    const existingRecord = await redisClient.get(redisCheckKey);
    if (existingRecord) {
      emitEventToUser(userUuid, `guildBuildingEffect:${guildBuildingId}:fail`, {
        message: "过会儿再来玩儿吧！"
      });
      return;
    }

    // 插入redis记录，持续4小时
    let result = await redisClient.set(redisCheckKey, "1", {
      condition: "NX",
      expiration: {
        type: "EX",
        // 持续4小时
        value: 60 * 60 * 4
      },
    });
    if (!result) {
      emitEventToUser(userUuid, `guildBuildingEffect:${guildBuildingId}:fail`, {
        message: "过会儿再来玩儿吧！"
      });
      return;
    }

    let guildBuilding = await prisma.guildBuilding.findFirst({
      where: {
        guildUuid,
        type: guildBuildingId,
        status: {
          in: [GuildBuildingStatus.NORMAL, GuildBuildingStatus.PREPARE_UPGRADE]
        },
      },
    });

    if (!guildBuilding) {
      emitEventToUser(userUuid, `guildBuildingEffect:${guildBuildingId}:fail`, {
        message: "此建筑未建造或已损坏",
      });
      return;
    }
    let effect = allGuildBuilding[guildBuildingId].effect(guildBuilding.level);

    try {
      let state = effect.availableBuffs.id;
      let value = effect.availableBuffs.value;
      if (type == 'hp') {
        state = 'catnipGardenEnergyBoostHpRegen'
        value = +(value * 1.3).toFixed(2)
      }
      if (type == 'mp') {
        state = 'catnipGardenEnergyBoostMpRegen'
        value = +(value * 1.3).toFixed(2)
      }
      await addPlayerState_Battle_StateWhenStartEachBattle(userUuid, {
        stateId: state,
        duration: effect.availableBuffs.duration,
        value: value,
        until: new Date(
          Date.now() + effect.availableBuffs.untilHours * 60 * 60 * 1000
        ), // 持续到指定小时后
      });
    } catch (error: any) {
      emitEventToUser(userUuid, `guildBuildingEffect:${guildBuildingId}:fail`, {
        message: error.message || "添加状态失败",
      });
    }

    emitEventToUser(
      userUuid,
      `guildBuildingEffect:${guildBuildingId}:success`,
      {
        guildUuid,
      }
    );
  });
}

export async function handleGuildGrandBathhouseEffect(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string, type: 'work' | 'battle' }>
) {
  const userUuid = data.user.uuid;
  const guildUuid = data.data.guildUuid;
  const type = data.data.type

  let guildBuildingId: AllGuildBuildingId = "guildGrandBathhouse";
  const redisCheckKey = `${guildBuildingId}:${data.user.uuid}`;

  await withUniqueLock(`${guildBuildingId}Effect:${data.user.uuid}`, async () => {
    // 检查redis中是否存在当天许愿池的记录
    const existingRecord = await redisClient.get(redisCheckKey);
    if (existingRecord) {
      emitEventToUser(userUuid, `guildBuildingEffect:${guildBuildingId}:fail`, {
        message: "才洗完澡没多久，过会儿再来~"
      });
      return;
    }

    // 插入redis记录，持续4小时
    let result = await redisClient.set(redisCheckKey, "1", {
      condition: "NX",
      expiration: {
        type: "EX",
        // 持续4小时
        value: 60 * 60 * 8
      },
    });
    if (!result) {
      emitEventToUser(userUuid, `guildBuildingEffect:${guildBuildingId}:fail`, {
        message: "才洗完澡没多久，过会儿再来~"
      });
      return;
    }

    let guildBuilding = await prisma.guildBuilding.findFirst({
      where: {
        guildUuid,
        type: guildBuildingId,
        status: {
          in: [GuildBuildingStatus.NORMAL, GuildBuildingStatus.PREPARE_UPGRADE]
        },
      },
    });

    if (!guildBuilding) {
      emitEventToUser(userUuid, `guildBuildingEffect:${guildBuildingId}:fail`, {
        message: "此建筑未建造或已损坏",
      });
      return;
    }
    let effect = allGuildBuilding[guildBuildingId].effect(guildBuilding.level);

    try {
      let value = effect.availableBuffs.value;

      if (type == 'work') {
        const state = 'guildGrandBathhouseStatusWork'

        await upsertPlayerState_Global_ActionEffect(userUuid, {
          stateId: state,
          durationMinutes: effect.availableBuffs.untilHours * 60,
        })
      }

      if (type == 'battle') {
        const state ='guildGrandBathhouseStatusBattle' 

        await addPlayerState_Battle_StateWhenStartEachBattle(userUuid, {
          stateId: state,
          duration: effect.availableBuffs.inBattleDuration,
          value: value,
          until: new Date(
            Date.now() + effect.availableBuffs.untilHours * 60 * 60 * 1000
          ),
        });
      }
    } catch (error: any) {
      emitEventToUser(userUuid, `guildBuildingEffect:${guildBuildingId}:fail`, {
        message: error.message || "添加状态失败",
      });
    }

    await updateActionDuration(userUuid);

    emitEventToUser(
      userUuid,
      `guildBuildingEffect:${guildBuildingId}:success`,
      {
        guildUuid,
      }
    );
  });
}

export async function handleDensefogStateEffect(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{ guildUuid: string, type: 'aggressive' | 'conservative' | 'alone' }>
) {
  const userUuid = data.user.uuid;
  const guildUuid = data.data.guildUuid;
  const type = data.data.type

  let guildBuildingId: AllGuildBuildingId = 'denseFogLighthouse';
  const redisCheckKey = `${guildBuildingId}:${data.user.uuid}`;

  await withUniqueLock(`${guildBuildingId}Effect:${data.user.uuid}`, async () => {
    // 检查redis中是否存在记录
    const existingRecord = await redisClient.get(redisCheckKey);
    if (existingRecord) {
      emitEventToUser(userUuid, `guildBuildingEffect:${guildBuildingId}:fail`, {
        message: "你已经受到了迷雾的指引，过会儿再来吧！"
      });
      return;
    }

    // 插入redis记录
    let result = await redisClient.set(redisCheckKey, "1", {
      condition: "NX",
      expiration: {
        type: "EX",
        // 持续8小时
        value: 60 * 60 * 8
      },
    });
    if (!result) {
      emitEventToUser(userUuid, `guildBuildingEffect:${guildBuildingId}:fail`, {
        message: "你已经受到了迷雾的指引，过会儿再来吧！"
      });
      return;
    }

    let guildBuilding = await prisma.guildBuilding.findFirst({
      where: {
        guildUuid,
        type: guildBuildingId,
        status: {
          in: [GuildBuildingStatus.NORMAL, GuildBuildingStatus.PREPARE_UPGRADE]
        },
      },
    });

    if (!guildBuilding) {
      emitEventToUser(userUuid, `guildBuildingEffect:${guildBuildingId}:fail`, {
        message: "此建筑未建造或已损坏",
      });
      return;
    }
    let effect = allGuildBuilding[guildBuildingId].effect(guildBuilding.level);

    try {
      if (type == "aggressive") {
        const stateId: AllBattleStateId = "denseFogLighthouseStateAggressive";
        const value = +(effect.effects.dealDamageIncrease / 100).toFixed(2);

        await addPlayerState_Battle_StateWhenStartEachBattle(userUuid, {
          stateId,
          duration: effect.effects.duration,
          value: value,
          onlyDensefog: true,
          extra: {
            thisStateActuralValueUnit: 'percent'
          },
          until: new Date(
            Date.now() + effect.effects.untilHours * 60 * 60 * 1000
          ), // 持续到指定小时后
        });
      } else if (type == "conservative") {
        const stateId: AllBattleStateId = "denseFogLighthouseStateConservative";
        const value = +(effect.effects.takeDamageDecrease / 100).toFixed(2);

        await addPlayerState_Battle_StateWhenStartEachBattle(userUuid, {
          stateId,
          duration: effect.effects.duration,
          value: value,
          onlyDensefog: true,
          extra: {
            thisStateActuralValueUnit: 'percent'
          },
          until: new Date(
            Date.now() + effect.effects.untilHours * 60 * 60 * 1000
          ), // 持续到指定小时后
        });
      } else if (type == "alone") {
        const stateId: AllBattleStateId = "denseFogLighthouseStateAlone";
        const value = +(effect.effects.modifyWhenAlone / 100).toFixed(2);

        await addPlayerState_Battle_StateWhenStartEachBattle(userUuid, {
          stateId,
          duration: effect.effects.duration,
          value: value,
          onlyDensefog: true,
          extra: {
            thisStateActuralValueUnit: 'percent'
          },
          until: new Date(
            Date.now() + effect.effects.untilHours * 60 * 60 * 1000
          ), // 持续到指定小时后
        });
      } else {
        throw new Error("参数错误");
      }
    } catch (error: any) {
      emitEventToUser(userUuid, `guildBuildingEffect:${guildBuildingId}:fail`, {
        message: error.message || "添加状态失败",
      });
    }

    emitEventToUser(
      userUuid,
      `guildBuildingEffect:${guildBuildingId}:success`,
      {
        guildUuid,
      }
    );
  });
}