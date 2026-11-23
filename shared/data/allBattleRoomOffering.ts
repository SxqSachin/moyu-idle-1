import type { BattleRoomOfferingEffectParam, BattleRoomOfferingEffectResult, BattleRoomOfferingSpec, AnyBattleRoomOfferingEffect } from "../types/battleRoomOffering";
import type { BaseBattleUnit } from "../types/unit";
import { randomIntegerInFullCloseRange, randomNumberInFullColseRange } from "../utils";
import { dealAoeDamage, dealDamage, getRandomUnitsInCollection, healUnit, lossMp, restoreMp, castSkill, getTimesPerBattleTriggerMark, increaseTimesPerBattleTriggerMark, decreaseTimesPerBattleTriggerMark, addState, isAlly, getUnitStatusInBattle, getRandomPercentAboutUnit, checkRandomPercentAboutUnit } from "~/server/utils/game/battleAction";

const consume = (turns = 5, amount = 1) => ({ turns, amount });

export const allBattleRoomOffering: Record<string, BattleRoomOfferingSpec> = {
  fluffyBufferPact: {
    id: "fluffyBufferPact",
    name: "蓬松防御",
    description: "战斗中受到的伤害降低15%",
    kind: { type: "resource", resourceId: "fluffyBufferPact" },
    stackable: false,
    consume: consume(360, 1),
    effects: [
      {
        trigger: "onBattleStart",
        handler: async ({ battleInfo, callbacks, offering }) => {
          const playerUuidList = battleInfo.groups[battleInfo.playerGroupId];

          for(const uuid of playerUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState('fluffyBufferPact', 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }
        },
      },
    ]
  },
  fluffyBufferPactTransmutation: {
    id: "fluffyBufferPactTransmutation",
    name: "异变蓬松防御",
    description: "战斗中受到的伤害降低25%",
    kind: { type: "resource", resourceId: "fluffyBufferPactTransmutation" },
    stackable: false,
    consume: consume(450, 1),
    effects: [
      {
        trigger: "onBattleStart",
        handler: async ({ battleInfo, callbacks, offering }) => {
          const playerUuidList = battleInfo.groups[battleInfo.playerGroupId];

          for(const uuid of playerUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState('fluffyBufferPactTransmutation', 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }
        },
      },
    ]
  },


  frenziedPact: {
    id: "frenziedPact",
    name: "狂热",
    description: "战斗中友军造成的伤害提高10%，受到的伤害提高20%",
    kind: { type: "resource", resourceId: "frenziedPact" },
    stackable: false,
    consume: consume(360, 1),
    effects: [
      {
        trigger: "onBattleStart",
        handler: async ({ battleInfo, callbacks, offering }) => {
          const playerUuidList = battleInfo.groups[battleInfo.playerGroupId];

          for(const uuid of playerUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState('frenziedPact', 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }
        },
      },
    ]
  },
  frenziedPactTransmutation: {
    id: "frenziedPactTransmutation",
    name: "异变狂热",
    description: "战斗中友军造成的伤害提高20%，受到的伤害提高40%",
    kind: { type: "resource", resourceId: "frenziedPactTransmutation" },
    stackable: false,
    consume: consume(450, 1),
    effects: [
      {
        trigger: "onBattleStart",
        handler: async ({ battleInfo, callbacks, }) => {
          const playerUuidList = battleInfo.groups[battleInfo.playerGroupId];

          for(const uuid of playerUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState('frenziedPactTransmutation', 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }
        },
      },
    ]
  },


  clawSharpeningPact: {
    id: "clawSharpeningPact",
    name: "利爪磨砺",
    description: "战斗中敌人获得15%伤害减免，战利品基础掉落概率提高10%",
    kind: { type: "resource", resourceId: "clawSharpeningPact" },
    stackable: false,
    consume: consume(360, 1),
    effects: [
      {
        trigger: "onBattleStart",
        handler: async ({ battleInfo, callbacks, }) => {
          const playerUuidList = battleInfo.groups[battleInfo.playerGroupId];
          for(const uuid of playerUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState('clawSharpeningPactPlayerBuff', 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }

          const enemyUuidList = (() => {
            const enemyGroupIds = Object.keys(battleInfo.groups).filter(gid => gid !== battleInfo.playerGroupId);
            const allEnemyUuids: string[] = [];
            for (const gid of enemyGroupIds) {
              allEnemyUuids.push(...battleInfo.groups[gid]);
            }
            return allEnemyUuids;
          })()

          for(const uuid of enemyUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState('clawSharpeningPact', 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }
        },
      },
    ]
  },

  clawSharpeningPactTransmutation: {
    id: "clawSharpeningPactTransmutation",
    name: "异变利爪磨砺",
    description: "战斗中敌人获得25%伤害减免，战利品基础掉落概率提高15%",
    kind: { type: "resource", resourceId: "clawSharpeningPactTransmutation" },
    stackable: false,
    consume: consume(450, 1),
    effects: [
      {
        trigger: "onBattleStart",
        handler: async ({ battleInfo, callbacks, }) => {
          const playerUuidList = battleInfo.groups[battleInfo.playerGroupId];
          for(const uuid of playerUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState('clawSharpeningPactTransmutationPlayerBuff', 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }

          const enemyUuidList = (() => {
            const enemyGroupIds = Object.keys(battleInfo.groups).filter(gid => gid !== battleInfo.playerGroupId);
            const allEnemyUuids: string[] = [];
            for (const gid of enemyGroupIds) {
              allEnemyUuids.push(...battleInfo.groups[gid]);
            }
            return allEnemyUuids;
          })()

          for(const uuid of enemyUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState('clawSharpeningPactTransmutation', 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }
        },
      },
    ]
  },

  fleaHotbedPact: {
    id: "fleaHotbedPact",
    name: "温床",
    description: "战斗中敌人的数量+3",
    kind: { type: "resource", resourceId: "fleaHotbedPact" },
    stackable: true,
    disableInWorldBossBattle: true,
    consume: consume(360, 1),
    effects: [
      {
        trigger: "onPrepareBattleData",
        handler: () => {
          return {
            extraEnemyCount: 3,
          }
        },
      },
    ]
  },

  fleaHotbedPactTransmutation: {
    id: "fleaHotbedPactTransmutation",
    name: "异变温床",
    description: "战斗中敌人的数量+3，每一轮都有10%概率出现Boss",
    kind: { type: "resource", resourceId: "fleaHotbedPactTransmutation" },
    stackable: true,
    disableInWorldBossBattle: true,
    consume: consume(450, 1),
    effects: [
      {
        trigger: "onPrepareBattleData",
        handler: ({ baseBossCount }) => {
          if (baseBossCount == 0 && randomNumberInFullColseRange(0, 1) < 0.1) {
            return {
              extraBossCount: randomIntegerInFullCloseRange(2, 3),
              extraEnemyCount: 3,
            }
          }
          return {
            extraEnemyCount: 3,
          }
        },
      },
    ]
  },

  aberrantBossSurgePact: {
    id: "aberrantBossSurgePact",
    name: "双生王座",
    description: "战斗中Boss的数量*2",
    kind: { type: "resource", resourceId: "aberrantBossSurgePact" },
    stackable: false,
    disableInWorldBossBattle: true,
    consume: consume(360, 1),
    effects: [
      {
        trigger: "onPrepareBattleData",
        handler: ({ baseBossCount, }) => {
          return {
            extraBossCount: baseBossCount * 2,
          }
        },
      },
    ]
  },

  aberrantBossSurgePactTransmutation: {
    id: "aberrantBossSurgePactTransmutation",
    name: "异变双生王座",
    description: "战斗中Boss的数量*3",
    kind: { type: "resource", resourceId: "aberrantBossSurgePactTransmutation" },
    stackable: false,
    disableInWorldBossBattle: true,
    consume: consume(450, 1),
    effects: [
      {
        trigger: "onPrepareBattleData",
        handler: ({baseBossCount}) => {
          return {
            extraBossCount: baseBossCount * 3,
          }
        },
      },
    ]
  },



  traitorsOathPact: {
    id: "traitorsOathPact",
    name: "讹誓",
    description: "队伍中至少有2个玩家: 战斗开始后，如果队伍中至少有2个玩家存活，所有友军获得“混淆”，持续10回合；战利品基础掉落概率提高10%",
    kind: { type: "resource", resourceId: "traitorsOathPact" },
    stackable: false,
    consume: consume(360, 1),
    effects: [
      {
        trigger: "afterBattleStart",
        handler: async ({ battleInfo, callbacks, offering }) => {
          const playerUuidList = battleInfo.groups[battleInfo.playerGroupId];

          const playerMap = new Map<string, BaseBattleUnit>();
          for(const uuid of playerUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            playerMap.set(uuid, unit);
          }
          if (playerMap.size < 2) {
            playerMap.clear()
            return;
          }

          for(const uuid of playerUuidList) {
            const unit = playerMap.get(uuid);
            if (!unit || unit.hp <= 0) continue;

            await Promise.all([
              addState('confusion', 10, unit, unit, {}, { // confusion
                battleInfo, callbacks,
                ignoreAddStateCallback: true,
                ignoreHook: true
              }),
              addState('traitorsOathPactPlayerBuff', 10, unit, unit, {}, {
                battleInfo, callbacks,
                ignoreAddStateCallback: true,
                ignoreHook: true
              })
            ])
          }

          playerMap.clear()
        },
      },
    ]
  },

  traitorsOathPactTransmutation: {
    id: "traitorsOathPactTransmutation",
    name: "异变讹誓",
    description: "队伍中至少有2个玩家: 战斗开始后，如果队伍中至少有2个玩家存活，所有友军获得“混淆”，持续10回合; 战利品基础掉落概率提高10%，掉落概率<1%的战利品有额外10%概率使掉落数量+1。",
    kind: { type: "resource", resourceId: "traitorsOathPactTransmutation" },
    stackable: false,
    consume: consume(450, 1),
    effects: [
      {
        trigger: "afterBattleStart",
        handler: async ({ battleInfo, callbacks, offering }) => {
          const playerUuidList = battleInfo.groups[battleInfo.playerGroupId];

          const playerMap = new Map<string, BaseBattleUnit>();
          for(const uuid of playerUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            playerMap.set(uuid, unit);
          }
          if (playerMap.size < 2) {
            playerMap.clear()
            return;
          }

          for(const uuid of playerUuidList) {
            const unit = playerMap.get(uuid);
            if (!unit || unit.hp <= 0) continue;
            await Promise.all([
              addState('confusion', 10, unit, unit, {}, { // confusion
                battleInfo, callbacks,
                ignoreAddStateCallback: true,
                ignoreHook: true
              }),
              addState('traitorsOathPactTransmutationPlayerBuff', 10, unit, unit, {}, {
                battleInfo, callbacks,
                ignoreAddStateCallback: true,
                ignoreHook: true
              })
            ])
          }

          playerMap.clear()
        },
      },
    ]
  },


  thornPact: {
    id: "thornPact",
    name: "荆棘",
    description: "敌人将15%受到的伤害返还给伤害来源；战利品基础掉落概率提高10%",
    kind: { type: "resource", resourceId: "thornPact" },
    stackable: false,
    consume: consume(360, 1),
    effects: [
      {
        trigger: "onBattleStart",
        handler: async ({ battleInfo, callbacks, }) => {
          const playerUuidList = battleInfo.groups[battleInfo.playerGroupId];
          for(const uuid of playerUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState("thornPactPlayerBuff", 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }

          const enemyUuidList = (() => {
            const enemyGroupIds = Object.keys(battleInfo.groups).filter(gid => gid !== battleInfo.playerGroupId);
            const allEnemyUuids: string[] = [];
            for (const gid of enemyGroupIds) {
              allEnemyUuids.push(...battleInfo.groups[gid]);
            }
            return allEnemyUuids;
          })()

          for(const uuid of enemyUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState('thornPact', 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }
        },
      },
    ]
  },
  thornPactTransmutation: {
    id: "thornPactTransmutation",
    name: "异变荆棘",
    description: "敌人将25%受到的伤害返还给伤害来源；战利品基础掉落概率提高10%，Boss掉落的战利品有额外10%概率使掉落数量+1。",
    kind: { type: "resource", resourceId: "thornPactTransmutation" },
    stackable: false,
    consume: consume(450, 1),
    effects: [
      {
        trigger: "onBattleStart",
        handler: async ({ battleInfo, callbacks, }) => {
          const playerUuidList = battleInfo.groups[battleInfo.playerGroupId];
          for(const uuid of playerUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState('thornPactTransmutationPlayerBuff', 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }

          const enemyUuidList = (() => {
            const enemyGroupIds = Object.keys(battleInfo.groups).filter(gid => gid !== battleInfo.playerGroupId);
            const allEnemyUuids: string[] = [];
            for (const gid of enemyGroupIds) {
              allEnemyUuids.push(...battleInfo.groups[gid]);
            }
            return allEnemyUuids;
          })()

          for(const uuid of enemyUuidList) {
            const unit = battleInfo.members.find(u => u.uuid === uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState('thornPactTransmutation', 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }
        },
      },
    ]
  },

  mistServitudePact: {
    id: "mistServitudePact",
    name: "迷雾侍奉",
    description: "迷雾战斗中战利品基础掉落率提高5%；与迷雾幻象的战斗中，所有非召唤物单位获得70%伤害减免，持续2回合。",
    kind: { type: "resource", resourceId: "mistServitudePact" },
    stackable: false,
    disableInWorldBossBattle: true,
    consume: consume(360, 1),
    effects: [
      {
        trigger: "onBattleStart",
        handler: async ({ battleInfo, callbacks, }) => {
          if (!battleInfo.isDenseFogMode) {
            return;
          }

          const playerUuidList = battleInfo.groups[battleInfo.playerGroupId];

          const unitMap = new Map<string, BaseBattleUnit>();

          for(const unit of battleInfo.members) {
            unitMap.set(unit.uuid, unit);
          }

          for(const uuid of playerUuidList) {
            const unit = unitMap.get(uuid);
            if (!unit || unit.hp <= 0) continue;
            await addState('mistServitudePactExtraDrop', 60, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }

          if (battleInfo.isDenseFogMode_Encounter) {
            for(const unit of battleInfo.members) {
              if (unit.isSummoned) continue;
              await addState('mistServitudePact', 3, unit, unit, {}, {
                battleInfo, callbacks,
                ignoreAddStateCallback: true,
                ignoreHook: true
              })
            }
          }

          unitMap.clear();
        },
      },
    ]
  },


  shadowPact: {
    id: "shadowPact",
    name: "阴影",
    description: "战斗开始后，所有单位获得“潜行”，持续2回合。",
    kind: { type: "resource", resourceId: "shadowPact" },
    stackable: false,
    consume: consume(360, 1),
    effects: [
      {
        trigger: "afterBattleStart",
        handler: async ({ battleInfo, callbacks, }) => {
          for(const unit of battleInfo.members) {
            await addState('sneak', 2, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }
        },
      },
    ]
  },
  silencePact: {
    id: "silencePact",
    name: "沉默",
    description: "战斗开始后，所有单位获得“沉默”，持续2回合。",
    kind: { type: "resource", resourceId: "silencePact" },
    stackable: false,
    consume: consume(360, 1),
    effects: [
      {
        trigger: "afterBattleStart",
        handler: async ({ battleInfo, callbacks, }) => {
          for(const unit of battleInfo.members) {
            await addState('silence', 2, unit, unit, {}, {
              battleInfo, callbacks,
              ignoreAddStateCallback: true,
              ignoreHook: true
            })
          }
        },
      },
    ]
  },
};

export type AllBattleRoomOfferingId = keyof typeof allBattleRoomOffering;
