import { BattleArea, BattleItemTriggerInfo, BattleStatus, EquipmentTriggerInfo } from "~/shared/types/battle";
import { AllGameResourceID } from "~/shared/types/gameResource";
import { allGameEnemies } from "~/shared/data/allGameEnemy";
import { generateEnemyById, generateUnitById } from "../utils/game/enemy";
import { allBattleState, detachState } from "~/shared/data/allBattleState";
import { delay, ObjectKeys, randomElementInCollection, randomIntegerInFullCloseRange, randomNumberInFullColseRange } from "~/shared/utils";
import { AllBattleStateId } from "~/shared/types/BattleState";
import { getEquipmentLevel } from "~/shared/utils/game/equipment";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";
import { AllBattleSkillId, DamageType } from "~/shared/types/skill";
import { getInfoFromBattleInfo, moveUnitTurnOrder, getUnitTurnOrder, getUnitTurnLastOrder, addUnitExtraTurn, getMainStatusInfo } from "~/shared/utils/game/battle";
import { dealAoeDamage, dealDamage, summonUnit, addState, } from "../utils/game/battleAction";
import { allGameResource } from "~/shared/data/allGameResources";
import { allBattleAreas } from "~/shared/data/allBattleInfo";
import { AllGameEnemyID } from "~/shared/types/emeny";

export const allResourceTriggerData: Record<string, BattleItemTriggerInfo> = {
  smokeBall: {
    async onUse({ self, battleInfo, callbacks }) {

      callbacks?.floatTextCallback({
        unit: self,
        text: '烟雾弹!',
      })

      await delay(1000);

      battleInfo.battleStatus = BattleStatus.ESCAPED
    }
  },

  swiftElixir: {
    async onUse({ self, battleInfo, callbacks }) {
     await addState('swiftElixir', 80, self, self, {
      }, {
        battleInfo,
        callbacks
      })
    },
  },
  magicalElixir: {
    async onUse({ self, battleInfo, callbacks }) {
     await addState('magicalElixir', 80, self, self, {
      }, {
        battleInfo,
        callbacks
      })
    },
  },

  hasteElixir: {
    async onUse({ self, battleInfo, callbacks }) {
      let baseTurnOrder = getUnitTurnLastOrder(battleInfo, self.uuid)
      addUnitExtraTurn(battleInfo, self, baseTurnOrder + 1)

     await addState('hasteElixirState', 2, self, self, {
      }, {
        battleInfo,
        callbacks
      })
    },
  },
  monoPolarElixir: {
    async onUse({ self, battleInfo, callbacks }) {
      let mainStatusInfo = getMainStatusInfo(self, true);

      let reduceInfo = {
        strength: 0,
        dexterity: 0,
        intelligence: 0,
      }
      
      switch(mainStatusInfo.status) {
        case 'strength':
          reduceInfo.dexterity = Math.max(Math.min(self.baseStatus.dexterity.level - 1, self.status.dexterity.level), 0)
          reduceInfo.intelligence = Math.max(Math.min(self.baseStatus.intelligence.level - 1, self.status.intelligence.level), 0)
          break;
        case 'dexterity':
          reduceInfo.strength = Math.max(Math.min(self.baseStatus.strength.level - 1, self.status.strength.level), 0)
          reduceInfo.intelligence = Math.max(Math.min(self.baseStatus.intelligence.level - 1, self.status.intelligence.level), 0)
          break;
        case 'intelligence':
          reduceInfo.strength = Math.max(Math.min(self.baseStatus.strength.level - 1, self.status.strength.level), 0)
          reduceInfo.dexterity = Math.max(Math.min(self.baseStatus.dexterity.level - 1, self.status.dexterity.level), 0)
          break;
      }

      let totalReduce = Math.floor((reduceInfo.strength + reduceInfo.dexterity + reduceInfo.intelligence) * 0.4)
      let desc: Record<string, string> = {
        '力量降低': '' + reduceInfo.strength,
        '敏捷降低': '' + reduceInfo.dexterity,
        '智力降低': '' + reduceInfo.intelligence
      }

      if (+desc.力量降低 == 0) { delete desc.力量降低 }
      if (+desc.敏捷降低 == 0) { delete desc.敏捷降低 }
      if (+desc.智力降低 == 0) { delete desc.智力降低 }

     await addState('monoPolarElixirState', 80, self, self, {
        thisStateActuralValue: totalReduce,
        mainStatus: mainStatusInfo.status,
        reduceInfo,
        readableDesc: desc,
      }, {
        callbacks,
        battleInfo
      })
    }
  },

  swiftMonoPolarElixir: {
    async onUse({ self, battleInfo, callbacks }) {
      let mainStatusInfo = getMainStatusInfo(self, true);

      let reduceInfo = {
        strength: 0,
        dexterity: 0,
        intelligence: 0,
      }
      
      switch(mainStatusInfo.status) {
        case 'strength':
          reduceInfo.dexterity = Math.max(Math.min(self.baseStatus.dexterity.level - 1, self.status.dexterity.level), 0)
          reduceInfo.intelligence = Math.max(Math.min(self.baseStatus.intelligence.level - 1, self.status.intelligence.level), 0)
          break;
        case 'dexterity':
          reduceInfo.strength = Math.max(Math.min(self.baseStatus.strength.level - 1, self.status.strength.level), 0)
          reduceInfo.intelligence = Math.max(Math.min(self.baseStatus.intelligence.level - 1, self.status.intelligence.level), 0)
          break;
        case 'intelligence':
          reduceInfo.strength = Math.max(Math.min(self.baseStatus.strength.level - 1, self.status.strength.level), 0)
          reduceInfo.dexterity = Math.max(Math.min(self.baseStatus.dexterity.level - 1, self.status.dexterity.level), 0)
          break;
      }

      let percent = 0.4;
      if (mainStatusInfo.status == 'dexterity') {
        percent = 0.55;
      }

      let totalReduce = Math.floor((reduceInfo.strength + reduceInfo.dexterity + reduceInfo.intelligence) * percent)
      let desc: Record<string, string> = {
        '力量降低': '' + reduceInfo.strength,
        '敏捷降低': '' + reduceInfo.dexterity,
        '智力降低': '' + reduceInfo.intelligence
      }

      if (+desc.力量降低 == 0) { delete desc.力量降低 }
      if (+desc.敏捷降低 == 0) { delete desc.敏捷降低 }
      if (+desc.智力降低 == 0) { delete desc.智力降低 }

     await addState('swiftMonoPolarElixirState', 80, self, self, {
        thisStateActuralValue: totalReduce,
        mainStatus: mainStatusInfo.status,
        reduceInfo,
        readableDesc: desc,
      }, {
        callbacks,
        battleInfo
      })
    }
  },
  magicalMonoPolarElixir: {
    async onUse({ self, battleInfo, callbacks }) {
      let mainStatusInfo = getMainStatusInfo(self, true);

      let reduceInfo = {
        strength: 0,
        dexterity: 0,
        intelligence: 0,
      }
      
      switch(mainStatusInfo.status) {
        case 'strength':
          reduceInfo.dexterity = Math.max(Math.min(self.baseStatus.dexterity.level - 1, self.status.dexterity.level), 0)
          reduceInfo.intelligence = Math.max(Math.min(self.baseStatus.intelligence.level - 1, self.status.intelligence.level), 0)
          break;
        case 'dexterity':
          reduceInfo.strength = Math.max(Math.min(self.baseStatus.strength.level - 1, self.status.strength.level), 0)
          reduceInfo.intelligence = Math.max(Math.min(self.baseStatus.intelligence.level - 1, self.status.intelligence.level), 0)
          break;
        case 'intelligence':
          reduceInfo.strength = Math.max(Math.min(self.baseStatus.strength.level - 1, self.status.strength.level), 0)
          reduceInfo.dexterity = Math.max(Math.min(self.baseStatus.dexterity.level - 1, self.status.dexterity.level), 0)
          break;
      }

      let percent = 0.4;

      if (mainStatusInfo.status == 'intelligence') {
        percent = 0.55;
      }

      let totalReduce = Math.floor((reduceInfo.strength + reduceInfo.dexterity + reduceInfo.intelligence) * percent)
      let desc: Record<string, string> = {
        '力量降低': '' + reduceInfo.strength,
        '敏捷降低': '' + reduceInfo.dexterity,
        '智力降低': '' + reduceInfo.intelligence
      }

      if (+desc.力量降低 == 0) { delete desc.力量降低 }
      if (+desc.敏捷降低 == 0) { delete desc.敏捷降低 }
      if (+desc.智力降低 == 0) { delete desc.智力降低 }

     await addState('magicalMonoPolarElixirState', 80, self, self, {
        thisStateActuralValue: totalReduce,
        mainStatus: mainStatusInfo.status,
        reduceInfo,
        readableDesc: desc,
      }, {
        callbacks,
        battleInfo
      })
    }
  },

  sealBell: {
    async onUse({ self, battleInfo, callbacks }) {
      let info = getInfoFromBattleInfo(self, battleInfo)

      if (!info) {
        return;
      }

      if (battleInfo.worldBossId) {
        return;
      }

      if (self.hp <= 1) {
        return
      }

      self.hp = Math.floor(self.hp * 0.7)

      let finalExtraValue = 0;

      let selfStrength = self.baseStatus.strength.level ?? 0;
      let selfDexterity = self.baseStatus.dexterity.level ?? 0;
      let selfIntelligence = self.baseStatus.intelligence.level ?? 0;

      // 判断目标当前最高属性
      if (selfStrength >= selfDexterity && selfStrength >= selfIntelligence) {
        finalExtraValue = selfStrength
      } else if (selfDexterity >= selfStrength && selfDexterity >= selfIntelligence) {
        finalExtraValue = selfDexterity
      } else {
        finalExtraValue = selfIntelligence
      }

      let targets = battleInfo.members.filter(u => u.uuid != self.uuid && u.hp > 0);

      await dealAoeDamage(self, targets, () => finalExtraValue * 2, {
        battleInfo,
        damageType: DamageType.True,
        ignoreTrigger: true,
        ignoreDefence: true,
        callbacks
      });

      // 设置所有友军此物品的冷却
      for(const ally of info.allAllyUnit) {
        if (ally.inventory?.sealBell) {
          ally.inventory.sealBell.cooldown = allGameResource['sealBell'].inBattleCooldown ?? 10
        }
      }

      if (randomNumberInFullColseRange(0, 1) > 0.33) {
        return;
      }

      let areaId = battleInfo.area;
      let area = (allBattleAreas[areaId] as BattleArea)

      if (!areaId || !area || !area.specialBattles?.length) {
        return
      }

      let bosses = area.specialBattles.at(-1)

      if (!bosses?.enemies?.length) {
        return;
      }

      for(let i = 0; i < randomIntegerInFullCloseRange(1, 3); i++) {
        let randomEnemyId = randomElementInCollection(bosses.enemies)?.id as AllGameEnemyID
        let unit = generateUnitById(randomEnemyId)

        let selfTurnIndex = battleInfo.turnOrder.findIndex(u => u === self.uuid)


        let enemyGroupId = Object.keys(battleInfo.groups).findLast(id => id != battleInfo.playerGroupId)
        if (!!randomEnemyId && unit && enemyGroupId) {
          let thisUnit = summonUnit(battleInfo, self, unit, 9999, {
            permanent: true,
            groupId: enemyGroupId
          })

          moveUnitTurnOrder(battleInfo, thisUnit.uuid, selfTurnIndex + 1)
        }
      }
    }
  },
  catMint: {
    onUse({ self, battleInfo, callbacks }) {
      let removeCount = 1;

      for (const stateId of ObjectKeys<AllBattleStateId>(self.state ?? {})) {
        const state = self.state?.[stateId];

        if (!state) {
          continue;
        }

        if (allBattleState[stateId]?.isDebuff && state.remainingDuration > 0) {
          detachState(stateId, self, battleInfo, {
            callbacks
          });

          removeCount--;
          // 如果已经移除足够数量的负面效果，则退出循环
          if (removeCount <= 0) break;
        }
      }
    }
  },
  cannedTuna: {
    async onUse({ self, battleInfo, callbacks }) {

      let value = Math.floor((self.baseStatus?.attacking?.level ?? 1) * 0.11);

     await addState('cannedTunaState', 80, self, self, {
        thisStateActuralValue: value
      }, {
        battleInfo, callbacks,
      })
    }
  },
  dawnBlossomWine: {
    async onUse({ self, battleInfo, callbacks }) {

      let value = Math.floor((self.baseStatus?.attacking?.level ?? 1) * 0.50);

     await addState('silence', 3, self, self, {}, {
        battleInfo, callbacks,
      });
     await addState('dawnBlossomWineState', 3, self, self, {
        thisStateActuralValue: value
      }, {
        battleInfo, callbacks
      });
    }
  },

  cannedShrimp: {
    async onUse({ self, battleInfo, callbacks }) {

      let value = Math.floor((self.baseStatus?.defencing?.level ?? 1) * 0.08);

     await addState('cannedShrimpState', 80, self, self, {
        thisStateActuralValue: value
      }, {
        battleInfo, callbacks
      })
    }
  },
  cannedRainbowFish: {
    async onUse({ self, battleInfo, callbacks }) {

      let value = 8

     await addState('cannedRainbowFishState', 80, self, self, {
        thisStateActuralValue: value
      }, {
        battleInfo, callbacks
      })
    }
  },
  cannedMysticalKoi: {
    async onUse({ self, battleInfo, callbacks }) {

     await addState('cannedMysticalKoiState', 80, self, self, {}, {
        battleInfo, callbacks
      })
    }
  }
};
