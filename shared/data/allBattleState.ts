import { dealAoeDamage, dealDamage, getRandomUnitsInCollection, healUnit, lossMp, restoreMp, castSkill, getTimesPerBattleTriggerMark, increaseTimesPerBattleTriggerMark, decreaseTimesPerBattleTriggerMark, addState, isAlly, getUnitStatusInBattle, getRandomPercentAboutUnit, checkRandomPercentAboutUnit } from "~/server/utils/game/battleAction";
import { DealDamageCauseByType, HpRestoreReason, MpLossReason, MpRestoreReason, type BattleCallback, type BattleInfo, type FullBattleAction, type SimpleBattleTargetActionCallback, type SimpleBattleTargetAddStateActionCallback, type SimpleBattleTargetDamageActionCallback, type SimpleFloatTextActionCallback } from "../types/battle";
import { StateEffectTriggerWhen, type AllBattleStateId, type BattleState, type BattleStateInBattle, type BattleStateInBattleExtraInfo } from "../types/BattleState";
import type { BaseBattleUnit } from "../types/unit";
import { DamageType, type AllBattleSkillId } from "../types/skill";
import { ObjectKeys, ObjectKeysTyped, randomElementInCollection, randomNumberInFullColseRange } from "../utils";
import type { CharacterEquipmentPart } from "../types/characterInfo";
import { getEquipmentActuralId, hasEquipment } from "../utils/game/equipment";
import { addUnitExtraTurnAfter, findUnitInBattle, getEnemyUnits, getEnemyUnitsByUnit, getInfoFromBattleInfo, getUnitGroupId, hasState, getAllyUnitsByUnit, getBaseInfoFromBattleInfo, addUnitExtraTurn } from '~/shared/utils/game/battle'
import { allGameAction, allGameActionMainType } from "./allGameActions";
import { isActionInclude } from "../utils/game/game";
import { catDungeon002State } from "./state/cat_dungeon_002";
import { iteratorUnitEquipment } from "~/server/utils/game/battleAction"
import { allCharacterStatus } from "./allCharacterStatus";

export const allGlobalStatusEffectState = {
  superLuckyBerryPieState: {
    id: "superLuckyBerryPieState",
    name: "超级幸运浆果派",
    description: "提升4点幸运",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onGlobalStatusEffectAttach() {
      return [
        {
          status: 'luck',
          modify: 4,
        }
      ]
    },
  },
  superLuckyMushroomStewState: {
    id: "superLuckyMushroomStewState",
    name: "超级香浓蘑菇汤",
    description: "提升4点幸运",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onGlobalStatusEffectAttach() {
      return [
        {
          status: 'luck',
          modify: 4,
        }
      ]
    },
  },
  luckyBoost: {
    id: "luckyBoost",
    name: "幸运提升",
    description: "提升10点幸运",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onGlobalStatusEffectAttach() {
      return [
        {
          status: 'luck',
          modify: 10,
        }
      ]
    },
  },
  luckyMintState: {
    id: "luckyMintState",
    name: "幸运曲奇",
    description: "提升0.5点幸运",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onGlobalStatusEffectAttach() {
      return [
        {
          status: 'luck',
          modify: 0.5,
        }
      ]
    },
  },
  luckySashimiPlatterState: {
    id: "luckySashimiPlatterState",
    name: "幸运刺身拼盘",
    description: "提升1点幸运",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onGlobalStatusEffectAttach() {
      return [
        {
          status: 'luck',
          modify: 1,
        }
      ]
    },
  },
  wishingPool: {
    id: "wishingPool",
    name: "许愿池",
    description: "提升幸运",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onGlobalStatusEffectAttach({value}) {
      return [
        {
          status: 'luck',
          modify: value,
        }
      ]
    },
  }
} as const satisfies Record<string, BattleState>;


const tartStateGenerate = (id: string, name: string, description: string, actionIds: string | string[]): BattleState => {
  if (typeof actionIds === 'string') {
    actionIds = [actionIds]
  }

  return {
    id,
    name,
    description,
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onGlobalActionDurationEffectAttach() {
      return actionIds.map(actionId => {
        return {
          actionId,
          modifyPercent: 0.03
        }
      })
    },
    onCalcTaskDoneExtraRewardPercent({actionId: thisActionId}) {
      const passActionCheck = actionIds.some(actionId => isActionInclude(actionId, thisActionId))

      if (!passActionCheck) {
        return false
      }

      return {
        percent: 0.02,
        desc: name + " 获得额外产出"
      }
    },
  }
}


const tartStateLv2Generate = (id: string, name: string, description: string, actionIds: string | string[]): BattleState => {
  if (typeof actionIds === 'string') {
    actionIds = [actionIds]
  }

  return {
    id,
    name,
    description,
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onGlobalActionDurationEffectAttach() {
      return actionIds.map(actionId => {
        return {
          actionId,
          modifyPercent: 0.05
        }
      })
    },
    onCalcTaskDoneExtraRewardPercent({actionId: thisActionId}) {
      const passActionCheck = actionIds.some(actionId => isActionInclude(actionId, thisActionId))

      if (!passActionCheck) {
        return false
      }

      return {
        percent: 0.03,
        desc: name + " 获得额外产出"
      }
    },
  }
}

export const allGlobalActionEffectState = {
  collectingTartState: tartStateGenerate("collectingTartState", "采集助力蛋挞", "采集类动作的执行时间降低3%\n有2%几率获得一份额外的产出", "allCollectingAction"),
  fishingTartState: tartStateGenerate("fishingTartState", "钓鱼助力蛋挞", "钓鱼类动作的执行时间降低3%\n有2%几率获得一份额外的产出", "allFishingAction"),
  farmingAnimalTartState: tartStateGenerate("farmingAnimalTartState", "畜牧助力蛋挞", "畜牧类动作的执行时间降低3%\n有2%几率获得一份额外的产出", "allFarmingAnimalAction"),
  miningTartState: tartStateGenerate("miningTartState", "挖掘助力蛋挞", "挖掘类动作的执行时间降低3%\n有2%几率获得一份额外的产出", "allMiningAction"),
  cookingTartState: tartStateGenerate("cookingTartState", "烹饪助力蛋挞", "烹饪类动作的执行时间降低3%\n有2%几率获得一份额外的产出", "allCookingAction"),
  sewingTartState: tartStateGenerate("sewingTartState", "缝制助力蛋挞", "缝制类动作的执行时间降低3%\n有2%几率获得一份额外的产出", "allSewingAction"),
  manufactureAndForgingTartState: tartStateGenerate("manufactureTartState", "制造助力蛋挞", "制造与锻造类动作的执行时间降低3%\n有2%几率获得一份额外的产出", ["allForgingAction", "allLevel1Manufacture"]),
  exploreTartState: tartStateGenerate("exploreTartState", "探索助力蛋挞", "探索类动作的执行时间降低3%\n有2%几率获得一份额外的产出", "allExploreAction"),
  knowledgeTartState: tartStateGenerate("knowledgeTartState", "知识助力蛋挞", "自我提升类动作的执行时间降低3%\n有2%几率获得一份额外的产出", "allExerciseAction"),

  collectingTartStateLv2: tartStateLv2Generate("collectingTartStateLv2", "采集增幅蛋挞", "采集类动作的执行时间降低5%\n有3%几率获得一份额外的产出", "allCollectingAction"),
  fishingTartStateLv2: tartStateLv2Generate("fishingTartStateLv2", "钓鱼增幅蛋挞", "钓鱼类动作的执行时间降低5%\n有3%几率获得一份额外的产出", "allFishingAction"),
  farmingAnimalTartStateLv2: tartStateLv2Generate("farmingAnimalTartStateLv2", "畜牧增幅蛋挞", "畜牧类动作的执行时间降低5%\n有3%几率获得一份额外的产出", "allFarmingAnimalAction"),
  miningTartStateLv2: tartStateLv2Generate("miningTartStateLv2", "挖掘增幅蛋挞", "挖掘类动作的执行时间降低5%\n有3%几率获得一份额外的产出", "allMiningAction"),
  cookingTartStateLv2: tartStateLv2Generate("cookingTartStateLv2", "烹饪增幅蛋挞", "烹饪类动作的执行时间降低5%\n有3%几率获得一份额外的产出", "allCookingAction"),
  sewingTartStateLv2: tartStateLv2Generate("sewingTartStateLv2", "缝制增幅蛋挞", "缝制类动作的执行时间降低5%\n有3%几率获得一份额外的产出", "allSewingAction"),
  manufactureAndForgingTartStateLv2: tartStateLv2Generate("manufactureTartStateLv2", "制造增幅蛋挞", "制造与锻造类动作的执行时间降低5%\n有3%几率获得一份额外的产出", ["allForgingAction", "allLevel1Manufacture"]),
  exploreTartStateLv2: tartStateLv2Generate("exploreTartStateLv2", "探索增幅蛋挞", "探索类动作的执行时间降低5%\n有3%几率获得一份额外的产出", "allExploreAction"),
  knowledgeTartStateLv2: tartStateLv2Generate("knowledgeTartStateLv2", "知识增幅蛋挞", "自我提升类动作的执行时间降低5%\n有3%几率获得一份额外的产出", "allExerciseAction"),

  guildGrandBathhouseStatusWork: {
    id: "guildGrandBathhouseStatusWork",
    name: "公会大浴场-热水澡",
    description: "舒缓疲劳，生活动作耗时降低3%",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onGlobalActionDurationEffectAttach(p) {
      const availableActionIdList = ObjectKeysTyped(allGameAction).filter(id => {
        const isDismentleAction = id.startsWith('dismantle_')
        if (isDismentleAction) {
          return false
        }

        return true;
      })
      return availableActionIdList.map(actionId => {
        return {
          actionId,
          modifyPercent: 0.03
        }
      })
    },
  },

  doubleActionEfficiency: {
    id: "doubleActionEfficiency",
    name: "生活动作效率提升",
    description: "大猫咪所有动作执行时间降低35%",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onGlobalActionDurationEffectAttach(p) {
      const availableActionIdList = ObjectKeysTyped(allGameAction).filter(id => {
        const isDismentleAction = id.startsWith('dismantle_')
        if (isDismentleAction) {
          return false
        }

        return true;
      })
      return availableActionIdList.map(actionId => {
        return {
          actionId,
          modifyPercent: 0.35
        }
      })
    },
  }
} as const satisfies Record<string, BattleState>;
export const allGlobalOtherEffectState = {
} as const satisfies Record<string, BattleState>;

export const allUnitInitState = {
  denseFogStrength: {
    id: "denseFogStrength",
    name: "迷乱(力量)",
    description: "战斗开始时，将所有单位根据“力量”属性排序战斗次序",
    duration: 40,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBattleStart({battleInfo, self, callbacks}) {
      let oriSort = battleInfo.turnOrder;

      let unitList: BaseBattleUnit[] = oriSort.map(uuid => findUnitInBattle(battleInfo, uuid)) as BaseBattleUnit[];

      callbacks?.floatTextCallback?.({
        text: "迷乱-力量",
        unit: self
      });

      const sorted = unitList
        .slice()
        .sort(
          (a, b) =>
            (b.status.strength.level ?? 0) - (a.status.strength.level ?? 0)
        );

      battleInfo.turnOrder = sorted.map((u) => u.uuid);
    }
  },
  denseFogDexterity: {
    id: "denseFogDexterity",
    name: "迷乱(敏捷)",
    description: "战斗开始时，将所有单位根据“敏捷”属性排序战斗次序",
    duration: 40,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBattleStart({battleInfo, self, callbacks}) {
      let oriSort = battleInfo.turnOrder;

      let unitList: BaseBattleUnit[] = oriSort.map(uuid => findUnitInBattle(battleInfo, uuid)) as BaseBattleUnit[];

      callbacks?.floatTextCallback?.({
        text: "迷乱-敏捷",
        unit: self
      });

      const sorted = unitList
        .slice()
        .sort(
          (a, b) =>
            (b.status.dexterity.level ?? 0) - (a.status.dexterity.level ?? 0)
        );

      battleInfo.turnOrder = sorted.map((u) => u.uuid);
    }
  },
  denseFogIntelligence: {
    id: "denseFogIntelligence",
    name: "迷乱(智力)",
    description: "战斗开始时，将所有单位根据“智力”属性排序战斗次序",
    duration: 40,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBattleStart({battleInfo, self, callbacks}) {
      let oriSort = battleInfo.turnOrder;

      let unitList: BaseBattleUnit[] = oriSort.map(uuid => findUnitInBattle(battleInfo, uuid)) as BaseBattleUnit[];

      callbacks?.floatTextCallback?.({
        text: "迷乱-智力",
        unit: self
      });

      const sorted = unitList
        .slice()
        .sort(
          (a, b) =>
            (b.status.intelligence.level ?? 0) - (a.status.intelligence.level ?? 0)
        );

      battleInfo.turnOrder = sorted.map((u) => u.uuid);
    }
  },
  denseFogStamina: {
    id: "denseFogStamina",
    name: "迷乱(耐力)",
    description: "战斗开始时，将所有单位根据“耐力”属性排序战斗次序",
    duration: 40,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBattleStart({battleInfo, self, callbacks}) {
      let oriSort = battleInfo.turnOrder;

      let unitList: BaseBattleUnit[] = oriSort.map(uuid => findUnitInBattle(battleInfo, uuid)) as BaseBattleUnit[];

      callbacks?.floatTextCallback?.({
        text: "迷乱-耐力",
        unit: self
      });

      const sorted = unitList
        .slice()
        .sort(
          (a, b) =>
            (b.status.stamina.level ?? 0) - (a.status.stamina.level ?? 0)
        );

      battleInfo.turnOrder = sorted.map((u) => u.uuid);
    }
  },
  denseFogPhantom: {
    id: "denseFogPhantom",
    name: "迷雾虚像",
    description: "此单位造成的伤害降低30%",
    duration: 40,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    unremovable: true,
    permanent: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeDamageSourceCalcDamage({reducedDamage}) {
      return Math.floor(reducedDamage * 0.7);
    }
  },

  battleBlessForMercenary: {
    id: "battleBlessForMercenary",
    name: "见习猫猫守护者",
    description: "化身为守护者猫咪\n此单位受到的伤害降低50%。\n造成的伤害提升100%。",
    duration: 40,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    permanent: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({reducedDamage}) {
      return Math.floor(reducedDamage * 0.5);
    },
    onNeedModifyOriginDamage({oriDamage}) {
      return Math.floor(oriDamage * 1);
    },
  },
  beginnerBattleBless: {
    id: "beginnerBattleBless",
    name: "见习战斗猫猫祝福",
    description: "此单位受到的伤害降低85%。\n雇佣兵猫猫获得强化。\n金币掉落数量提升50%。\n\n仅在队伍中玩家的平均战斗等级与你相差不超过3级时生效。",
    duration: 40,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    permanent: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({reducedDamage, battleInfo, self}) {
      const allPlayerAlly = battleInfo.members.filter(m => {
        if (m.uuid == self.uuid) {
          return true
        }
        if (!isAlly(m.uuid, self.uuid, battleInfo)) {
          return false
        }

        return m.isPlayer && m.isPlayerUnit;
      });

      const selfBattleLevel = self.level;
      const totalBattleLevel = allPlayerAlly.reduce((sum, unit) => sum + unit.level, 0);
      const avgBattleLevel = totalBattleLevel / allPlayerAlly.length;

      if (Math.abs(avgBattleLevel - selfBattleLevel) > 3) {
        return reducedDamage;
      }

      return Math.floor(reducedDamage * 0.15);
    },
    async onBattleStart({battleInfo, self, callbacks}) {
      const allPlayerAlly = battleInfo.members.filter(m => {
        if (m.uuid == self.uuid) {
          return true
        }
        if (!isAlly(m.uuid, self.uuid, battleInfo)) {
          return false
        }

        return m.isPlayer && m.isPlayerUnit;
      });

      const selfBattleLevel = self.level;
      const totalBattleLevel = allPlayerAlly.reduce((sum, unit) => sum + unit.level, 0);
      const avgBattleLevel = totalBattleLevel / allPlayerAlly.length;

      if (Math.abs(avgBattleLevel - selfBattleLevel) > 3) {
        return;
      }


      for(const member of battleInfo.members) {
        if (!isAlly(self.uuid, member.uuid, battleInfo)) {
          continue;
        }

        if (!member.id.startsWith('b_mercenary_')) {
          continue;
        }

        await addState('battleBlessForMercenary', 10, self, member, {}, {
          battleInfo,
          callbacks
        })
      }
    },
    calcBattleWinRewardExtraDropCount({drop, battleInfo, self}) {
      const allPlayerAlly = battleInfo.members.filter(m => {
        if (m.uuid == self.uuid) {
          return true
        }
        if (!isAlly(m.uuid, self.uuid, battleInfo)) {
          return false
        }

        return m.isPlayer && m.isPlayerUnit;
      });

      const selfBattleLevel = self.level;
      const totalBattleLevel = allPlayerAlly.reduce((sum, unit) => sum + unit.level, 0);
      const avgBattleLevel = totalBattleLevel / allPlayerAlly.length;

      if (Math.abs(avgBattleLevel - selfBattleLevel) > 3) {
        return 0;
      }


      if (drop.id == 'gold') {
        return drop.range.max * 1.5
      }

      return 0;
    }
  },

  doubleBattleEfficiency: {
    id: "doubleBattleEfficiency",
    name: "战利品掉落概率提升",
    description: "战利品掉落率提高50%。",
    duration: 10,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    calcBattleWinRewardExtraDropRate({drop}) {
      return drop.percent ? drop.percent * 0.5 : 0;
    }
  },
} as const satisfies Record<string, BattleState>;

export const allPactState = {
  fluffyBufferPact: {
    id: "fluffyBufferPact",
    name: "战斗契约-蓬松防御",
    description: "战斗中受到的伤害降低15%",
    duration: 60,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({reducedDamage}) {
      return Math.floor(reducedDamage * 0.85);
    }
  },
  fluffyBufferPactTransmutation: {
    id: "fluffyBufferPactTransmutation",
    name: "战斗契约-异变蓬松防御",
    description: "战斗中受到的伤害降低25%",
    duration: 60,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({reducedDamage}) {
      return Math.floor(reducedDamage * 0.75);
    }
  },

  frenziedPact: {
    id: "frenziedPact",
    name: "战斗契约-狂热",
    description: "战斗中友军造成的伤害提高10%，受到的伤害提高20%",
    duration: 60,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onNeedModifyOriginDamage({oriDamage}) {
      return Math.floor(oriDamage * 0.1);
    },
    onBeforeTakeDamage({reducedDamage}) {
      return Math.floor(reducedDamage * 1.2);
    }
  },
  frenziedPactTransmutation: {
    id: "frenziedPactTransmutation",
    name: "战斗契约-异变狂热",
    description: "战斗中友军造成的伤害提高20%，受到的伤害提高40%",
    duration: 60,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onNeedModifyOriginDamage({oriDamage}) {
      return Math.floor(oriDamage * 0.2);
    },
    onBeforeTakeDamage({reducedDamage}) {
      return Math.floor(reducedDamage * 1.4);
    }
  },

  clawSharpeningPact: {
    id: "clawSharpeningPact",
    name: "战斗契约-利爪磨砺",
    description: "受到的伤害降低15%",
    duration: 60,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({reducedDamage}) {
      return Math.floor(reducedDamage * 0.85);
    }
  },
  clawSharpeningPactPlayerBuff: {
    id: "clawSharpeningPact",
    name: "战斗契约-利爪磨砺",
    description: "战利品掉落率提高10%",
    duration: 60,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    calcBattleWinRewardExtraDropRate({drop}) {
      return (drop.percent ?? 0) * 0.1;
    }
  },

  clawSharpeningPactTransmutation: {
    id: "clawSharpeningPactTransmutation",
    name: "战斗契约-异变利爪磨砺",
    description: "受到的伤害降低25%",
    duration: 60,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({reducedDamage}) {
      return Math.floor(reducedDamage * 0.75);
    }
  },
  clawSharpeningPactTransmutationPlayerBuff: {
    id: "clawSharpeningPactTransmutationPlayerBuff",
    name: "战斗契约-异变利爪磨砺",
    description: "战利品掉落率提高15%",
    duration: 60,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    calcBattleWinRewardExtraDropRate({drop}) {
      return (drop.percent ?? 0) * 0.15;
    }
  },


  traitorsOathPactPlayerBuff: {
    id: "traitorsOathPactPlayerBuff",
    name: "战斗契约-讹誓",
    description: "获得“混淆”，战利品掉落率提高10%",
    duration: 60,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    calcBattleWinRewardExtraDropRate({drop}) {
      return (drop.percent ?? 0) * 0.1;
    }
  },
  traitorsOathPactTransmutationPlayerBuff: {
    id: "traitorsOathPactTransmutationPlayerBuff",
    name: "战斗契约-异变讹誓",
    description: "获得“混淆”，战利品基础掉落概率提高10%，Boss掉落的战利品有额外10%概率使掉落数量+1",
    duration: 60,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    calcBattleWinRewardExtraDropRate({drop}) {
      return (drop.percent ?? 0) * 0.1;
    },
    calcBattleWinRewardExtraDropCount({drop, enemy}) {
      if (enemy.isBoss) {
        if (randomNumberInFullColseRange(1, 10) <= 1) {
          return 1;
        }
      }

      return 0;
    }
  },

  thornPact: {
    id: "thornPact",
    name: "战斗契约-荆棘反伤",
    description: "将15%受到的伤害返还给伤害来源，忽视30%防御",
    duration: 60,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    async afterTakeDamage({
      self,
      damageSource,
      oriDamage,
      damageType,
      battleInfo,
      callbacks,
    }) {
      if (!battleInfo || !callbacks) {
        return;
      }

      if (isAlly(self.uuid, damageSource.uuid, battleInfo)) {
        return;
      }

      const reflectDamage = Math.floor(oriDamage * 0.15);

      callbacks.floatTextCallback({
        unit: self,
        text: "荆棘",
        hidePopover: true,
      });

      await dealDamage(self, damageSource, reflectDamage, {
        causeBy: {
          type: DealDamageCauseByType.State,
          state: "thornPact",
        },
        damageType,
        ignoreDefencePercent: 30,
        callbacks: callbacks,
        battleInfo,
        ignoreTrigger: true,
      });
    },
  },
  thornPactTransmutation: {
    id: "thornPactTransmutation",
    name: "战斗契约-异变荆棘反伤",
    description: "将25%受到的伤害返还给伤害来源，忽视50%防御",
    duration: 60,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    async afterTakeDamage({
      self,
      damageSource,
      oriDamage,
      damageType,
      battleInfo,
      callbacks,
    }) {
      if (!battleInfo || !callbacks) {
        return;
      }

      if (isAlly(self.uuid, damageSource.uuid, battleInfo)) {
        return;
      }

      const reflectDamage = Math.floor(oriDamage * 0.25);

      callbacks.floatTextCallback({
        unit: self,
        text: "异变荆棘",
        hidePopover: true,
      });

      await dealDamage(self, damageSource, reflectDamage, {
        causeBy: {
          type: DealDamageCauseByType.State,
          state: "thornPactTransmutation",
        },
        damageType,
        ignoreDefencePercent: 50,
        callbacks: callbacks,
        battleInfo,
        ignoreTrigger: true,
      });
    },

  },

  thornPactPlayerBuff: {
    id: "thornPactPlayerBuff",
    name: "战斗契约-荆棘",
    description: "战利品掉落率提高10%",
    duration: 60,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    calcBattleWinRewardExtraDropRate({drop}) {
      return (drop.percent ?? 0) * 0.1;
    }
  },
  thornPactTransmutationPlayerBuff: {
    id: "thornPactTransmutationPlayerBuff",
    name: "战斗契约-异变荆棘",
    description: "战利品基础掉落概率提高10%，Boss掉落的战利品有额外10%概率使掉落数量+1",
    duration: 60,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    calcBattleWinRewardExtraDropRate({drop}) {
      return (drop.percent ?? 0) * 0.1;
    },
    calcBattleWinRewardExtraDropCount({drop, enemy}) {
      if (enemy.isBoss) {
        if (randomNumberInFullColseRange(1, 10) <= 1) {
          return 1;
        }
      }

      return 0;
    }
  },


  mistServitudePactExtraDrop: {
    id: "mistServitudePactExtraDrop",
    name: "战斗契约-迷雾侍奉",
    description: "战利品掉落率提高5%",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    calcBattleWinRewardExtraDropRate({drop}) {
      return (drop.percent ?? 0) * 0.05;
    }
  },
  mistServitudePact: {
    id: "mistServitudePact",
    name: "战斗契约-迷雾侍奉",
    description: "战斗中受到的伤害降低70%",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    isPactState: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({reducedDamage}) {
      return Math.floor(reducedDamage * 0.30);
    }
  },
} as const satisfies Record<string, BattleState>;

export const allWorldBossState = {
  worldBossNian: {
    id: "worldBossNian",
    name: "岁末之压",
    description: "每个单位行动后，获得1层。每1层使造成的伤害提高5%。\n当叠加至12层后，清除所有层数，对所有敌人造成最大生命值50%无视防御的伤害，并立即获得一次机会。",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: true,
    maxStack: 12,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    async onAttach({ battleInfo, target, callbacks, thisState, extraAttachStack }) {
      if (!thisState || !battleInfo || !target) {
        return;
      }

      if (!extraAttachStack || extraAttachStack <= 0) {
        return;
      }

      increaseStateExtraStack(thisState.id, target, extraAttachStack, { battleInfo});
      const currentStack = getStateExtraStack(thisState) ?? 0;

      if (currentStack >= 12) {
        resetStateExtraStack(thisState);

        const enemies = getBaseInfoFromBattleInfo(target, battleInfo)?.enemies ?? [];

        await dealAoeDamage(target, enemies, (t) => {
          return t.maxHp * 0.5;
        }, {
          damageType: DamageType.True,
          ignoreDefence: true,
          battleInfo,
          callbacks: callbacks!,
          causeBy: { type: DealDamageCauseByType.State, state: 'worldBossNian' }
        })

        if (battleInfo.currentTurnUnitUuid) {
          addUnitExtraTurnAfter(battleInfo, target, battleInfo.currentTurnUnitUuid)
        }
      }
    },
    afterEachOtherUnitAction: async ({ self, battleInfo, currentTurnUnit, thisState, callbacks, }) => {
      if (!self || self.hp <= 0) return;
      
      await addState("worldBossNian", 4, self, self, {
      }, {
        extraStack: 1,
        battleInfo,
        callbacks,
      });

    },
    onNeedModifyOriginDamage({oriDamage, state}) {
      const currentStack = getStateExtraStack(state) ?? 0;
      return Math.floor(oriDamage * (0.05 * currentStack));
    }
  },


} as const satisfies Record<string, BattleState>;

export const allBattleAreaState = {
  nightmarePrisonFear: {
    id: "nightmarePrisonFear",
    name: "噩梦监狱",
    description: "在噩梦的笼罩下，感受到无尽的恐惧。",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return
      }
      let reducedAttacking = Math.floor(target.baseStatus.attacking.level * 0.3)
      let reducedDefencing = Math.floor(target.baseStatus.defencing.level * 0.2)

      target.status.attacking.level -= reducedAttacking
      target.status.defencing.level -= reducedDefencing
    },
    onDetach: ({ self, thisState }) => {
      if (!self) {
        return
      }

      let reducedAttacking = Math.floor(self.baseStatus.attacking.level * 0.3)
      let reducedDefencing = Math.floor(self.baseStatus.defencing.level * 0.2)

      self.status.attacking.level += reducedAttacking
      self.status.defencing.level += reducedDefencing
    }
  },
  // 猫猫地牢·回响之厅 环境：施法回响与黑暗偏执
  catDungeonEchoCurse: {
    id: "catDungeonEchoCurse",
    name: "回响诅咒",
    description: "释放技能时，回响在阴影里反噬施法者与一名友军",
    duration: 9999,
    permanent: true,
    isBuff: false,
    isDebuff: true,
    unremovable: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    afterCastSkill: async ({ self, battleInfo, callbacks }) => {
      if (!self || self.hp <= 0) return;

      // 自身反噬：基于最大生命的5%真实伤害
      const selfBacklash = Math.max(1, Math.floor(self.maxHp * 0.05));
      await dealDamage(self, self, selfBacklash, {
        damageType: DamageType.True,
        battleInfo,
        ignoreTrigger: true,
        callbacks,
        causeBy: { type: DealDamageCauseByType.State, state: 'catDungeonEchoCurse' }
      });

      // 友军一名承受回响：最大生命的5%真实伤害
      const allies = getAllyUnitsByUnit(battleInfo, self).filter(u => u.uuid !== self.uuid && u.hp > 0);
      if (allies.length > 0) {
        const [ally] = getRandomUnitsInCollection(allies, 1);
        if (ally) {
          const allyBacklash = Math.max(1, Math.floor(ally.maxHp * 0.05));
          await dealDamage(self, ally, allyBacklash, {
            damageType: DamageType.True,
            battleInfo,
            ignoreTrigger: true,
            callbacks,
            causeBy: { type: DealDamageCauseByType.State, state: 'catDungeonEchoCurse' }
          });
        }
      }
    }
  },
  catDungeonDarknessFavorEnemy: {
    id: "catDungeonDarknessFavorEnemy",
    name: "黑暗偏爱",
    description: "处于黑暗庇护：造成的魔法伤害提升10%",
    duration: 9999,
    permanent: true,
    isBuff: true,
    isDebuff: false,
    unremovable: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeDamageSourceCalcDamage: ({ reducedDamage, damageType }) => {
      if (damageType === DamageType.Magical) {
        return reducedDamage * 1.1;
      }
      return reducedDamage;
    }
  },
  catDungeonDarknessSuppressPlayer: {
    id: "catDungeonDarknessSuppressPlayer",
    name: "黑暗压制",
    description: "黑暗吞噬刀锋：造成的物理伤害降低10%",
    duration: 9999,
    permanent: true,
    isBuff: false,
    isDebuff: true,
    unremovable: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeDamageSourceCalcDamage: ({ reducedDamage, damageType }) => {
      if (damageType === DamageType.Physical) {
        return reducedDamage * 0.9;
      }
      return reducedDamage;
    }
  },
} as const satisfies Record<string, BattleState>;

export const allGuildBuildingState = {
  denseFogLighthouseStateAggressive: {
    id: "denseFogLighthouseStateAggressive",
    name: "迷雾指引-激进",
    description: "迷雾中造成的伤害提升。作为队长时，在迷雾中遭遇幻象的概率提升50%。",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onNeedModifyOriginDamage({battleInfo, oriDamage, state}) {
      if (battleInfo.isDenseFogMode) {
        const percent = (state.extra?.thisStateActuralValue ?? 0.05)
        return Math.floor(oriDamage * percent)
      }

      return 0
    },
  },
  denseFogLighthouseStateConservative: {
    id: "denseFogLighthouseStateConservative",
    name: "迷雾指引-稳健",
    description: "迷雾中受到的伤害降低。作为队长时，在迷雾中遭遇幻象的概率降低50%。",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({battleInfo, reducedDamage, state}) {
      if (battleInfo.isDenseFogMode) {
        const percent = (state.extra?.thisStateActuralValue ?? 0.05)
        return Math.floor(reducedDamage * (1 - percent))
      }

      return reducedDamage
    }
  },

  denseFogLighthouseStateAlone: {
    id: "denseFogLighthouseStateAlone",
    name: "迷雾指引-独自前行",
    description: "当小队中只有你一个玩家时进入迷雾，造成的伤害提升，受到的伤害降低",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onNeedModifyOriginDamage({self, battleInfo, oriDamage, state}) {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return 0;
      }

      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter(uuid => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });
      if (playerMemberUuids.length > 1 || playerMemberUuids[0] != self.uuid) {
        return 0;
      }

      if (battleInfo.isDenseFogMode) {
        const percent = (state.extra?.thisStateActuralValue ?? 0.12)
        return Math.floor(oriDamage * percent)
      }

      return 0
    },
    onBeforeTakeDamage({self, battleInfo, reducedDamage, state}) {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return reducedDamage;
      }

      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter(uuid => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });
      if (playerMemberUuids.length > 1 || playerMemberUuids[0] != self.uuid) {
        return reducedDamage;
      }

      if (battleInfo.isDenseFogMode) {
        const percent = (state.extra?.thisStateActuralValue ?? 0.12)
        return Math.floor(reducedDamage * (1 - percent))
      }

      return reducedDamage
    }
  },

  catnipGardenEnergyBoost: {
    id: "catnipGardenEnergyBoost",
    name: "精力充沛",
    description: "很有精神!",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    extraHpRegenWhenTurnStart: ({ thisState }) => {
      return thisState.extra?.thisStateActuralValue ?? 0
    },
    extraMpRegenWhenTurnStart: ({ thisState }) => {
      return thisState.extra?.thisStateActuralValue ?? 0
    }
  },
  catnipGardenEnergyBoostHpRegen: {
    id: "catnipGardenEnergyBoostHpRegen",
    name: "精力充沛(生命)",
    description: "很有精神!",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    extraHpRegenWhenTurnStart: ({ thisState }) => {
      return thisState.extra?.thisStateActuralValue ?? 0
    },
  },
  catnipGardenEnergyBoostMpRegen: {
    id: "catnipGardenEnergyBoostMpRegen",
    name: "精力充沛(魔法)",
    description: "很有精神!",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    extraMpRegenWhenTurnStart: ({ thisState }) => {
      return thisState.extra?.thisStateActuralValue ?? 0
    }
  },

  guildGrandBathhouseStatusBattle: {
    id: "guildGrandBathhouseStatusBattle",
    name: "公会大澡堂-冷水澡",
    description: "造成的伤害略微提升。",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach({thisState}) {
      if (!thisState?.extra) return
      thisState.extra.thisStateActuralValueUnit = 'percent'
    },
    onNeedModifyOriginDamage({oriDamage, state}) {
      const val = (state.extra?.thisStateActuralValue ?? 0.01)
      const percent = +(val).toFixed(2)

      return Math.floor(oriDamage * percent);
    }
  },
} as const satisfies Record<string, BattleState>;

export const allFoodState = {
  ryeBreadState: {
    id: "ryeBreadState",
    name: "黑麦面包",
    description: "回合开始时，回复15生命值，持续20回合",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    extraHpRegenWhenTurnStart: ({ }) => {
      return 15
    },
  },
  cloudFluffCandyColddown: {
    id: "cloudFluffCandyColddown",
    name: "软软棉花糖",
    description: "下一次释放的技能，冷却时间降低至1回合",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    afterCastSkill({ self, battleInfo, skillId, callbacks }) {
      if (!self.skillColddown) {
        self.skillColddown = {};
      }
      self.skillColddown[skillId] = 2;
      detachState('cloudFluffCandyColddown', self, battleInfo, {
        callbacks
      })
    }
  },
  milkManaShake: {
    id: "milkManaShake",
    name: "浆果奶昔",
    description: "造成的魔法伤害+25",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onNeedModifyOriginDamage({damageType}) {
      if (damageType == DamageType.Magical) {
        return 25
      }

      return 0;
    }
  },

  windBellMilkShake: {
    id: "windBellMilkShake",
    name: "铃语奶昔",
    description: "造成的魔法伤害提升8%",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onBeforeDamageSourceCalcDamage({reducedDamage, damageType}) {
      if (damageType == DamageType.Magical) {
        return reducedDamage = reducedDamage * (1 + 0.08)
      }

      return reducedDamage;
    }
  },

  grapeMilkManaShake: {
    id: "grapeMilkManaShake",
    name: "葡萄浆果奶昔",
    description: "造成的魔法伤害+45\n造成魔法伤害时，穿透10%防御",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onNeedModifyOriginDamage({damageType}) {
      if (damageType == DamageType.Magical) {
        return 45
      }

      return 0;
    },
    onDamageSourceNeedModifyDefenceIgnorePercent: ({damageType}) => {
      if (damageType === DamageType.Magical) {
        return 10;
      }

      return 0;
    }
  },
  grapeWindBellMilkShake: {
    id: "grapeWindBellMilkShake",
    name: "葡萄铃语奶昔",
    description: "造成的魔法伤害提升15%\n造成魔法伤害时，穿透10%防御",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onBeforeDamageSourceCalcDamage({reducedDamage, damageType}) {
      if (damageType == DamageType.Magical) {
        return reducedDamage = reducedDamage * (1 + 0.15)
      }

      return reducedDamage;
    },
    onDamageSourceNeedModifyDefenceIgnorePercent: ({damageType}) => {
      if (damageType === DamageType.Magical) {
        return 10;
      }

      return 0;
    }
  },


  windBellWine: {
    id: "windBellWine",
    name: "铃语精酿",
    description: "法力消耗提升100%，造成的魔法伤害提升50%",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onBeforeDamageSourceCalcDamage({reducedDamage, damageType}) {
      if (damageType == DamageType.Magical) {
        return reducedDamage = reducedDamage * (1 + 0.50)
      }

      return reducedDamage;
    },
    onBeforeLossMp({mpLoss}) {
      return mpLoss * 2;
    }
  },

  battleKnowledgeCocktail: {
    id: "battleKnowledgeCocktail",
    name: "战斗知识鸡尾酒",
    description: "基础攻击力提升15%\n魔法伤害提升15%\n从战斗中获得的各项经验提升15%",
    duration: 40,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    calcBattleWinExtraExpPercent() {
      return 0.15;
    },
    onNeedModifyOriginDamage({oriDamage, damageType}) {
      if (damageType == DamageType.Magical) {
        return oriDamage * 0.15;
      }

      if (damageType == DamageType.Physical) {
        return oriDamage * 0.15;
      }

      return oriDamage;
    },
    onBeforeLossMp({mpLoss}) {
      return mpLoss * 1.5;
    }
  },

} as const satisfies Record<string, BattleState>;

export const allPotionState = {
  breezeElixirState: {
    id: "breezeElixirState",
    name: "风息药剂",
    description: "每个单位的回合结束后，你都有10%几率立即行动一次",
    duration: 40,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    async afterEachOtherUnitAction({self, currentTurnUnit, callbacks, battleInfo}) {
      if (currentTurnUnit.uuid == self.uuid) {
        return;
      }

      if (!(await checkRandomPercentAboutUnit(self, 0.1, {battleInfo, callbacks}))) {
        return;
      }

      callbacks.floatTextCallback({
        unit: self,
        text: "风息",
      })

      addUnitExtraTurnAfter(battleInfo, self, currentTurnUnit.uuid)
    },
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      target.status.dexterity.level += 10;
    },
    onDetach: ({ self, thisState }) => {
      if (!self) {
        return;
      }

      self.status.dexterity.level -= 10;
    },
  },

  magicalElixir: {
    id: "magicalElixir",
    name: "魔力药剂",
    description: "智力提升15点，持续80回合",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      target.status.intelligence.level += 15;
    },
    onDetach: ({ self, thisState }) => {
      if (!self) {
        return;
      }

      self.status.intelligence.level -= 15;
    },
  },
  swiftElixir: {
    id: "swiftElixir",
    name: "迅捷药剂",
    description: "敏捷提升15点，持续80回合",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      target.status.dexterity.level += 15;
    },
    onDetach: ({ self, thisState }) => {
      if (!self) {
        return;
      }

      self.status.dexterity.level -= 15;
    },
  },

  hasteElixirState: {
    id: "hasteElixirState",
    name: "急速药剂",
    description: "造成的伤害降低50%",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeDamageSourceCalcDamage({ reducedDamage }) {
      return reducedDamage * 0.5;
    },
  },
  monoPolarElixirState: {
    id: "monoPolarElixirState",
    name: "单极药剂",
    description: "非主属性降低至1级，主属性提升(因此效果降低的数值的40%)。",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      const mainStatus: "strength" | "dexterity" | "intelligence" =
        state!.extra!.mainStatus;

      if (!mainStatus) {
        return;
      }

      const info: {
        strength: number;
        dexterity: number;
        intelligence: number;
      } = state?.extra?.reduceInfo;

      switch (mainStatus) {
        case "strength":
          target.status.strength.level += value;
          target.status.dexterity.level -= info.dexterity;
          target.status.intelligence.level -= info.intelligence;
          break;
        case "dexterity":
          target.status.dexterity.level += value;
          target.status.strength.level -= info.strength;
          target.status.intelligence.level -= info.intelligence;
          break;
        case "intelligence":
          target.status.intelligence.level += value;
          target.status.strength.level -= info.strength;
          target.status.dexterity.level -= info.dexterity;
          break;
      }
    },
    onDetach: ({ self, thisState }) => {
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      const mainStatus: "strength" | "dexterity" | "intelligence" =
        state!.extra!.mainStatus ?? "strength";

      if (!mainStatus) {
        return;
      }

      const info: {
        strength: number;
        dexterity: number;
        intelligence: number;
      } = state?.extra?.reduceInfo;

      switch (mainStatus) {
        case "strength":
          self.status.strength.level -= value;
          self.status.dexterity.level += info.dexterity;
          self.status.intelligence.level += info.intelligence;
          break;
        case "dexterity":
          self.status.dexterity.level -= value;
          self.status.strength.level += info.strength;
          self.status.intelligence.level += info.intelligence;
          break;
        case "intelligence":
          self.status.intelligence.level -= value;
          self.status.strength.level += info.strength;
          self.status.dexterity.level += info.dexterity;
          break;
      }
    },
  },

  swiftMonoPolarElixirState: {
    id: "swiftMonoPolarElixirState",
    name: "迅捷单极药剂",
    description:
      "非主属性降低至1级，主属性提升(因此效果降低的数值的40%)\n如果主属性是敏捷，则比例提高至55%",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      const mainStatus: "strength" | "dexterity" | "intelligence" =
        state!.extra!.mainStatus;

      if (!mainStatus) {
        return;
      }

      const info: {
        strength: number;
        dexterity: number;
        intelligence: number;
      } = state?.extra?.reduceInfo;

      switch (mainStatus) {
        case "strength":
          target.status.strength.level += value;
          target.status.dexterity.level -= info.dexterity;
          target.status.intelligence.level -= info.intelligence;
          break;
        case "dexterity":
          target.status.dexterity.level += value;
          target.status.strength.level -= info.strength;
          target.status.intelligence.level -= info.intelligence;
          break;
        case "intelligence":
          target.status.intelligence.level += value;
          target.status.strength.level -= info.strength;
          target.status.dexterity.level -= info.dexterity;
          break;
      }
    },
    onDetach: ({ self, thisState }) => {
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      const mainStatus: "strength" | "dexterity" | "intelligence" =
        state!.extra!.mainStatus ?? "strength";

      if (!mainStatus) {
        return;
      }

      const info: {
        strength: number;
        dexterity: number;
        intelligence: number;
      } = state?.extra?.reduceInfo;

      switch (mainStatus) {
        case "strength":
          self.status.strength.level -= value;
          self.status.dexterity.level += info.dexterity;
          self.status.intelligence.level += info.intelligence;
          break;
        case "dexterity":
          self.status.dexterity.level -= value;
          self.status.strength.level += info.strength;
          self.status.intelligence.level += info.intelligence;
          break;
        case "intelligence":
          self.status.intelligence.level -= value;
          self.status.strength.level += info.strength;
          self.status.dexterity.level += info.dexterity;
          break;
      }
    },
  },
  magicalMonoPolarElixirState: {
    id: "magicalMonoPolarElixirState",
    name: "魔力单极药剂",
    description:
      "非主属性降低至1级，主属性提升(因此效果降低的数值的40%)\n如果主属性是智力，则比例提高至55%",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      const mainStatus: "strength" | "dexterity" | "intelligence" =
        state!.extra!.mainStatus;

      if (!mainStatus) {
        return;
      }

      const info: {
        strength: number;
        dexterity: number;
        intelligence: number;
      } = state?.extra?.reduceInfo;

      switch (mainStatus) {
        case "strength":
          target.status.strength.level += value;
          target.status.dexterity.level -= info.dexterity;
          target.status.intelligence.level -= info.intelligence;
          break;
        case "dexterity":
          target.status.dexterity.level += value;
          target.status.strength.level -= info.strength;
          target.status.intelligence.level -= info.intelligence;
          break;
        case "intelligence":
          target.status.intelligence.level += value;
          target.status.strength.level -= info.strength;
          target.status.dexterity.level -= info.dexterity;
          break;
      }
    },
    onDetach: ({ self, thisState }) => {
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      const mainStatus: "strength" | "dexterity" | "intelligence" =
        state!.extra!.mainStatus ?? "strength";

      if (!mainStatus) {
        return;
      }

      const info: {
        strength: number;
        dexterity: number;
        intelligence: number;
      } = state?.extra?.reduceInfo;

      switch (mainStatus) {
        case "strength":
          self.status.strength.level -= value;
          self.status.dexterity.level += info.dexterity;
          self.status.intelligence.level += info.intelligence;
          break;
        case "dexterity":
          self.status.dexterity.level -= value;
          self.status.strength.level += info.strength;
          self.status.intelligence.level += info.intelligence;
          break;
        case "intelligence":
          self.status.intelligence.level -= value;
          self.status.strength.level += info.strength;
          self.status.dexterity.level += info.dexterity;
          break;
      }
    },
  },

  cognitionStrikeElixirState: {
    id: "cognitionStrikeElixirState",
    name: "魔力打击药剂",
    description:
      "普通攻击附带（智力25%）的额外魔法伤害\n此额外伤害不触发任何被动效果",
    duration: 80,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    async afterDealDamage({ self, target, callbacks, battleInfo, causeBy }) {
      if (causeBy.skillId != "baseAttack") {
        return;
      }

      let damage = Math.floor(self.status.intelligence.level * 0.25);

      // let targets = (thisRoundInfo?.targetUnitUuidList ?? []).map(uuid => findUnitInBattle(battleInfo, uuid)).filter(u => !!u);

      await dealDamage(self, target, damage, {
        damageType: DamageType.Magical,
        callbacks,
        battleInfo,

        ignoreTrigger: true,
        causeBy: {
          type: DealDamageCauseByType.State
        },
      });
    },
  },
} as const satisfies Record<string, BattleState>;

export const allEquipmentState = {

  patchworkHideCloakState: {
    id: "patchworkHideCloakState",
    name: "技艺祈福",
    description: "你获得了群生披肩的庇护",
    duration: 5,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach: ({ target, thisState }) => {
      if (!target || !thisState) {
        return;
      }

      const mainStatus = readStateExtraInfo<'strength' | 'dexterity' | 'intelligence'>(thisState, "mainStatus") ?? 'strength';
      const increment = readStateExtraInfo<number>(thisState, "increment") ?? 1;

      target.status[mainStatus].level += increment;

      if (!thisState.extra!.readableDesc) {
        thisState.extra!.readableDesc = {};
      }

      thisState.extra!.readableDesc["技艺祈福属性"] = allCharacterStatus[mainStatus].name
      thisState.extra!.readableDesc["技艺祈福属性提升"] = increment.toFixed(0)
    },
    onDetach: ({ thisState, self }) => {
      if (!self || !thisState) {
        return;
      }

      const mainStatus = readStateExtraInfo<'strength' | 'dexterity' | 'intelligence'>(thisState, "mainStatus") ?? 'strength';
      const increment = readStateExtraInfo<number>(thisState, "increment") ?? 1;

      self.status[mainStatus].level -= increment;
    },
  },

  fallenStarAmuletState: {
    id: "fallenStarAmuletState",
    name: "堕落星辰庇护",
    description: "你获得了堕落星辰的庇护",
    duration: 5,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach: ({ target, thisState }) => {
      if (!target || !thisState) {
        return;
      }

      if (!target.status.otherStatus.luck) {
        return;
      }

      const extraStatus = readStateExtraInfo<number>(thisState, "extraStatus") ?? 99;
      const extraDamagePercent = readStateExtraInfo<number>(thisState, "extraDamagePercent") ?? 0.01;
      const reducedLuck = readStateExtraInfo<number>(thisState, "reducedLuck") ?? 5;

      target.status.strength.level += extraStatus
      target.status.dexterity.level += extraStatus
      target.status.intelligence.level += extraStatus

      target.status.otherStatus.luck!.level -= reducedLuck

      if (!thisState.extra!.readableDesc) {
        thisState.extra!.readableDesc = {};
      }
      thisState.extra!.readableDesc["堕落庇护全属性提升"] = extraStatus.toFixed(1)
      thisState.extra!.readableDesc["堕落庇护伤害提升"] = (extraDamagePercent * 100).toFixed(2) + '%'
    },
    onDetach: ({ thisState, self }) => {
      if (!thisState || !self) {
        return;
      }

      if (!self.status.otherStatus.luck) {
        return;
      }

      const extraStatus = readStateExtraInfo<number>(thisState, "extraStatus") ?? 99;
      const reducedLuck = readStateExtraInfo<number>(thisState, "reducedLuck") ?? 5;

      self.status.strength.level -= extraStatus
      self.status.dexterity.level -= extraStatus
      self.status.intelligence.level -= extraStatus

      self.status.otherStatus.luck!.level += reducedLuck
    },
    onNeedModifyOriginDamage: ({ oriDamage, state }) => {
      const extraDamagePercent = readStateExtraInfo<number>(state, "extraDamagePercent") ?? 0.01;

      if (extraDamagePercent <= 0) {
        return 0;
      }
      
      return oriDamage * extraDamagePercent;
    }
  },

  darkingHeartState: {
    id: "darkingHeartState",
    name: "黑暗之心",
    description: "你从黑暗中汲取力量",
    duration: 2,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: true,
    maxStack: 50,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,

    onAttach: async ({ target, thisState, extraAttachStack, battleInfo }) => {
      if (!target || !thisState || !extraAttachStack) {
        return;
      }

      if (checkAlreadyReachMaxStateExtraStack(thisState.id, target, battleInfo)) {
        return;
      }
      const currentStack = getStateExtraStack(thisState) ?? 0;

      const statusPerStack = readStateExtraInfo<number>(thisState, "statusPerStack") ?? 1;
      const damageReducePercentPerStack = readStateExtraInfo<number>(thisState, "damageReducePercentPerStack") ?? 0.01;

      // 移除之前应用的加成（如果有），以便重新按最新层数应用
      if (currentStack > 0) {
        const prevTotal = Math.floor(currentStack * statusPerStack);
        target.status.strength.level = Math.max(0, target.status.strength.level - prevTotal);
        target.status.dexterity.level = Math.max(0, target.status.dexterity.level - prevTotal);
        target.status.intelligence.level = Math.max(0, target.status.intelligence.level - prevTotal);
      }

      // 增加层数并重新应用新的总加成
      increaseStateExtraStack(thisState.id, target, extraAttachStack, { battleInfo});
      const latestStack = getStateExtraStack(thisState) ?? 0;

      const newTotal = Math.floor(latestStack * statusPerStack);
      target.status.strength.level = Math.max(0, target.status.strength.level + newTotal);
      target.status.dexterity.level = Math.max(0, target.status.dexterity.level + newTotal);
      target.status.intelligence.level = Math.max(0, target.status.intelligence.level + newTotal);

      if (!thisState.extra!.readableDesc) {
        thisState.extra!.readableDesc = {};
      }
      thisState.extra!.readableDesc["黑暗之心属性加成"] = (latestStack * statusPerStack).toFixed(1);

      // 伤害减免最多为0.9
      let factor = latestStack * damageReducePercentPerStack;
      factor = Math.min(factor, 0.9);

      thisState.extra!.readableDesc["黑暗之心伤害减免"] = (factor * 100).toFixed(2) + '%';
    },

    onBeforeTakeDamage: ({ reducedDamage, self, state, battleInfo, callbacks }) => {
      const stack = getStateExtraStack(state) ?? 0;

      if (stack <= 0) return reducedDamage;

      let damageReducePercentPerStack =
        readStateExtraInfo<number>(state, "damageReducePerStack") ?? 0.01;

      let factor = Math.max(0, 1 - stack * damageReducePercentPerStack);

      // 伤害减免最多为0.9
      factor = Math.max(factor, 0.1);

      return Math.floor(reducedDamage * factor);
    },

    onDetach: ({ thisState, self }) => {
      if (!thisState) {
        return;
      }

      const stack = getStateExtraStack(thisState) ?? 0;
      resetStateExtraStack(thisState);

      let statusPerStack =
        readStateExtraInfo<number>(thisState, "statusPerStack") ?? 1;

      const totalExtraStatus = Math.floor(stack * statusPerStack);

      self.status.strength.level = Math.max(0, self.status.strength.level - totalExtraStatus);
      self.status.dexterity.level = Math.max(0, self.status.dexterity.level - totalExtraStatus);
      self.status.intelligence.level = Math.max(0, self.status.intelligence.level - totalExtraStatus);
    },
  },

  shadowTalonFangState: {
    id: "shadowTalonFangState",
    name: "潜锋",
    description: "你从黑暗中汲取力量",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: true,
    maxStack: 30,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,

    onAttach: async ({ target, thisState, extraAttachStack, battleInfo }) => {
      if (!target || !thisState || !extraAttachStack) {
        return;
      }

      if (checkAlreadyReachMaxStateExtraStack(thisState.id, target, battleInfo)) {
        return;
      }
      const currentStack = getStateExtraStack(thisState) ?? 0;

      const attackPerStack = readStateExtraInfo<number>(thisState, "attackPerStack") ?? 1;
      const dexterityPerStack = readStateExtraInfo<number>(thisState, "dexterityPerStack") ?? 1;
      const selfDefenceReducePerStack = readStateExtraInfo<number>(thisState, "selfDefenceReducePerStack") ?? 1;

      // 移除之前应用的加成（如果有），以便重新按最新层数应用
      if (currentStack > 0) {
        const prevAttack = Math.floor(currentStack * attackPerStack);
        const prevDexterity = Math.floor(currentStack * dexterityPerStack);
        const prevDefenceReduce = Math.floor(currentStack * selfDefenceReducePerStack);

        target.status.attacking.level = target.status.attacking.level - prevAttack;
        target.status.dexterity.level = target.status.dexterity.level - prevDexterity;
        target.status.defencing.level = target.status.defencing.level + prevDefenceReduce;
      }

      // 增加层数并重新应用新的总加成
      increaseStateExtraStack(thisState.id, target, extraAttachStack, { battleInfo });
      const latestStack = getStateExtraStack(thisState) ?? 0;

      const newAttack = Math.floor(latestStack * attackPerStack);
      const newDexterity = Math.floor(latestStack * dexterityPerStack);
      const newDefenceReduce = Math.floor(latestStack * selfDefenceReducePerStack);

      target.status.attacking.level = target.status.attacking.level + newAttack;
      target.status.dexterity.level = target.status.dexterity.level + newDexterity;
      target.status.defencing.level = target.status.defencing.level - newDefenceReduce;

      if (!thisState.extra!.readableDesc) {
        thisState.extra!.readableDesc = {};
      }
      thisState.extra!.readableDesc["攻击力加成"] = (newAttack).toFixed(1)
      thisState.extra!.readableDesc["敏捷加成"] = (newDexterity).toFixed(1)
      thisState.extra!.readableDesc["防御力降低"] = (newDefenceReduce).toFixed(1)

      const defenceIgnorePerStack = readStateExtraInfo<number>(thisState, "defenceIgnorePerStack") ?? 0.5;
      const defenceIgnore = latestStack * defenceIgnorePerStack;
      thisState.extra!.readableDesc["物理防御穿透"] = (defenceIgnore).toFixed(2) + '%'
    },

    onDamageSourceNeedModifyDefenceIgnorePercent: ({ state, damageType }) => {
      if (damageType !== DamageType.Physical) {
        return 0;
      }

      const defenceIgnorePerStack = readStateExtraInfo<number>(state, "defenceIgnorePerStack") ?? 0.5;
      const currentStack = getStateExtraStack(state) ?? 0;

      return Math.floor(currentStack * defenceIgnorePerStack);
    },

    onDetach: ({ thisState, self }) => {
      if (!thisState) {
        return;
      }

      const currentStack = getStateExtraStack(thisState) ?? 0;
      resetStateExtraStack(thisState);

      const attackPerStack = readStateExtraInfo<number>(thisState, "attackPerStack") ?? 1;
      const dexterityPerStack = readStateExtraInfo<number>(thisState, "dexterityPerStack") ?? 1;
      const selfDefenceReducePerStack = readStateExtraInfo<number>(thisState, "selfDefenceReducePerStack") ?? 1;

      const prevAttack = Math.floor(currentStack * attackPerStack);
      const prevDexterity = Math.floor(currentStack * dexterityPerStack);
      const prevDefenceReduce = Math.floor(currentStack * selfDefenceReducePerStack);

      self.status.attacking.level = self.status.attacking.level - prevAttack;
      self.status.dexterity.level = self.status.dexterity.level - prevDexterity;
      self.status.defencing.level = self.status.defencing.level + prevDefenceReduce;
    },
  },

  cuteSwordLuckyState: {
    id: "cuteSwordLuckyState",
    name: "猫猫剑幸运加持",
    description: "幸运+3，每当你成功通过一次概率判定时，恢复自身5%已损失的生命值与魔法值。",
    duration: 2,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach({ target, thisState }) {
      if (target?.status?.otherStatus?.luck) {
        target.status.otherStatus.luck.level += 3;
      }
    },
    onDetach({ self, thisState }) {
      if (self?.status?.otherStatus?.luck) {
        self.status.otherStatus.luck.level -= 3;

        if (self.status.otherStatus.luck.level < 0) {
          self.status.otherStatus.luck.level = 0;
        }
      }
    },
    async onRandomPercentPassCheckSuccess({ self, battleInfo, callbacks }) {
      const hpRegen = (self.maxHp - self.hp) * 0.05;
      const mpRegen = (self.maxMp - self.mp) * 0.05;

      await healUnit(self, self, hpRegen, {
        battleInfo, callbacks, reason: HpRestoreReason.EQUIPMENT_EFFECT,
      })

      restoreMp(self, self, mpRegen, {
        callback: callbacks?.restoreMpCallback, reason: MpRestoreReason.EQUIPMENT_EFFECT,
      })
    }
  },

  twilightFeatherCloakState: {
    id: "twilightFeatherCloakState",
    name: "夜鸮守护",
    description: "受到的魔法伤害降低80%。\n触发后此状态消失",
    duration: 3,
    permanent: true,
    isBuff: true,
    isDebuff: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    consumeTurn: false,

    onBeforeTakeDamage({self, damageType, battleInfo, reducedDamage, callbacks}) {
      if (damageType == DamageType.Magical) {

        detachState('twilightFeatherCloakState', self, battleInfo, {
          callbacks
        })

        return Math.floor(reducedDamage * 0.2);
      }

      return reducedDamage
    }
  },

  wardenIronWhipAllyState: {
    id: "wardenIronWhipAllyState",
    name: "狱卒的催促",
    description: "造成的伤害提升10%\n造成伤害时，穿透5%防御",
    duration: 2,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onNeedModifyOriginDamage({oriDamage}) {
      return Math.floor(oriDamage * 0.15)
    },
    onDamageSourceNeedModifyDefenceIgnorePercent() {
      return 5;
    }
  },

  genesisEssenceShadowSteelSwordMaxHpState: {
    id: "genesisEssenceShadowSteelSwordMaxHpState",
    name: "精华窃取",
    description: "生命值上限提升",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: false,
    unremovable: true,
    maxStack: 3,
    permanent: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onDetach({ self, thisState }) {
      if (!self || !thisState) {
        return;
      }

      const currentMaxHpIncrease = readStateExtraInfo<number>(thisState, 'genesisEssenceShadowSteelSwordMaxHpIncrease') || 0;

      if (currentMaxHpIncrease) {
        self.maxHp -= currentMaxHpIncrease;
        self.hp -= currentMaxHpIncrease;

        if (self.maxHp < 1) {
          self.maxHp = 1;
        }
        if (self.hp < 1) {
          self.hp = 1;
        }
      }
    }
  },

  timeflowCatEyeGenesisEssenceStaffCountDownState: {
    id: "timeflowCatEyeGenesisEssenceStaffCountDownState",
    name: "时涌",
    description: "倒计时归零时，你所有技能的冷却时间-1",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: false,
    unremovable: true,
    maxStack: 3,
    permanent: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
  },

  starforgedAlloylCoatDamageTransfer: {
    id: "starforgedAlloylCoatDamageTransfer",
    name: "奉献",
    description: "你分担的伤害将在你的回合开始时或下次战斗开始时作用到你身上，使你流失等量的生命值\n此效果不会使你的生命值低于1",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: true,
    unremovable: true,
    maxStack: 9999999,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect({self, thisState, battleInfo, callbacks}) {
      let damage = getStateExtraStack(thisState);

      if (damage) {
        self.hp = Math.max(1, self.hp - damage);

        callbacks?.floatTextCallback?.({
          unit: self,
          text: `奉献-${damage}`,
        })
      }

      detachState('starforgedAlloylCoatDamageTransfer', self, battleInfo, {
        callbacks
      })

      return undefined;
    },
    onAttach: ({ target, thisState, extraAttachStack, battleInfo }) => {
      if (!target || !thisState || !extraAttachStack) {
        return;
      }
      increaseStateExtraStack(thisState.id, target, extraAttachStack, { battleInfo });
    },

    onBattleStart({ self, thisState, battleInfo, callbacks }) {
      let damage = getStateExtraStack(thisState);

      if (damage) {
        self.hp = Math.max(1, self.hp - damage);

        callbacks?.floatTextCallback?.({
          unit: self,
          text: `奉献-${damage}`,
        })
      }

      detachState('starforgedAlloylCoatDamageTransfer', self, battleInfo, {
        callbacks
      })

      return undefined;
    },
  },


  starforgedAlloyHatStellarJudgment: {
    id: "starforgedAlloyHatStellarJudgment",
    name: "裁决之眼",
    description: "你对力量比你高的单位造成的伤害降低30%。\n力量比你高的单位对你造成伤害时，伤害提升30%",
    duration: 4,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    stackable: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeDamageSourceCalcDamage({damageSource, self, target, reducedDamage, battleInfo, callbacks}) {
      if (damageSource.uuid != self.uuid) {
        return reducedDamage;
      }

      const selfStrength = getUnitStatusInBattle(self, 'strength', { battleInfo, callbacks, ignoreTriggers: true }) ?? 0;
      const targetStrength = getUnitStatusInBattle(target, 'strength', { battleInfo, callbacks, ignoreTriggers: true }) ?? 0;

      if (targetStrength > selfStrength) {
        reducedDamage *= 0.7;
      }

      return reducedDamage
    },
    onNeedModifyOriginDamage({damageSource, self, totalExtraDamageBeforeCalcDefence, oriDamage, callbacks, battleInfo}) {
      const selfStrength = getUnitStatusInBattle(self, 'strength', { battleInfo, callbacks, ignoreTriggers: true }) ?? 0;
      const damageSourceStrength = getUnitStatusInBattle(damageSource, 'strength', { battleInfo, callbacks, ignoreTriggers: true }) ?? 0;

      if (selfStrength < damageSourceStrength) {
        return oriDamage * 0.3;
      }

      return 0
    }
  },
  starforgedAlloyHatCelestialInsight: {
    id: "starforgedAlloyHatCelestialInsight",
    name: "星辰启示",
    description: "触发一次任意效果后，此状态消失:\n - 造成的第一次伤害翻倍\n - 受到的第一次伤害归0",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: false,
    unremovable: false,
    permanent: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({self, reducedDamage, battleInfo, callbacks}) {
      reducedDamage = 0;

      callbacks?.floatTextCallback?.({
        unit: self,
        text: "星辰启示-伤害无效",
      })

      detachState('starforgedAlloyHatCelestialInsight', self, battleInfo, {
        callbacks,
      })

      return reducedDamage;
    },
    onNeedModifyOriginDamage({self, totalExtraDamageBeforeCalcDefence, oriDamage, callbacks, battleInfo}) {
      totalExtraDamageBeforeCalcDefence = oriDamage;

      callbacks?.floatTextCallback?.({
        unit: self,
        text: "星辰启示-双倍伤害",
      })

      detachState('starforgedAlloyHatCelestialInsight', self, battleInfo, {
        callbacks,
      })

      return totalExtraDamageBeforeCalcDefence;
    }
  },
  starforgedAlloyGlovesInfusion: {
    id: "starforgedAlloyGlovesInfusion",
    name: "星辉灌注",
    description: "回合开始时，恢复额外生命",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    async effect({self, thisState, battleInfo, callbacks}) {
      let healValue = thisState!.extra!.thisStateActuralValue ?? 0;

      if (!healValue) {
        return
      }

      let addBy = thisState?.addBy;

      if (!addBy) {
        addBy = self.uuid
      }

      let member = findUnitInBattle(battleInfo, addBy);

      if (!member) {
        return;
      }

      await healUnit(member, self, healValue, {
        reason: HpRestoreReason.STATE_EFFECT,
        battleInfo,
        callbacks,
      })

      return undefined
    }
  },

  cuteIronBraceletState: {
    id: "cuteIronBraceletState",
    name: "喵之夜语",
    description: "喵～",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ target }) => {
      if (!target) {
        return;
      }

      target.status.strength.level += 11;
      target.status.dexterity.level += 11;
      target.status.intelligence.level += 11;
    },
    onDetach: ({ self }) => {
      self.status.strength.level -= 11;
      self.status.dexterity.level -= 11;
      self.status.intelligence.level -= 11;
    },
  },
  bookOfUnwritingColddown: {
    id: "bookOfUnwritingColddown",
    name: "回溯手稿",
    description: "你的逆写抄本正在准备中",
    duration: 4,
    isBuff: false,
    isDebuff: false,
    consumeTurn: false,
    stackable: false,
    unremovable: true,
    // maxStack: 1,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
  },
  empressCloakStatusUp: {
    id: "empressCloakStatusUp",
    name: "尊贵气场",
    description: "你被女皇鼓舞",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: false,
    // maxStack: 1,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      const mainStatus: 'strength' | 'dexterity' | 'intelligence' = state!.extra!.mainStatus ?? 'strength';

      target.status[mainStatus].level = target.status[mainStatus].level + value;
      // target.status[mainStatus].level = target.baseStatus[mainStatus].level;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      const mainStatus: 'strength' | 'dexterity' | 'intelligence' = state!.extra!.mainStatus ?? 'strength';

      self.status[mainStatus].level = self.status[mainStatus].level - value;
      // self.status[mainStatus].level = self.baseStatus[mainStatus].level;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  shadowSteelScytheDeathPact: {
    id: "shadowSteelScytheDeathPact",
    name: "死契",
    description: "从收割的灵魂处汲取力量",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: true,
    maxStack: 20,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach({ target, thisState, extraAttachStack, battleInfo }) {
      if (!extraAttachStack || !thisState) {
        return;
      }

      if (!target || !target?.status.attacking.level) {
        return;
      }

      let attackPerStack =
        readStateExtraInfo<number>(thisState, "attackPerStack") ?? 5;
      const currentStack = getStateExtraStack(thisState);

      if (checkAlreadyReachMaxStateExtraStack(thisState.id, target, battleInfo)) {
        return;
      }

      increaseStateExtraStack(thisState.id, target, extraAttachStack, { battleInfo });

      if (!thisState.extra!.readableDesc) {
        thisState.extra!.readableDesc = {};
      }
      thisState.extra!.readableDesc["死契额外攻击力"] =
        "" + getStateExtraStack(thisState) * attackPerStack;

      target.status.attacking.level += extraAttachStack * attackPerStack;
    },
    onDetach({ self, thisState }) {
      if (!thisState) {
        return;
      }

      let attackPerStack =
        readStateExtraInfo<number>(thisState, "attackPerStack") ?? 5;
      const stack = getStateExtraStack(thisState);

      self.status.attacking.level -= stack * attackPerStack;
    },
  },
  shadowSteelHammerBloodFrenzy: {
    id: "shadowSteelHammerBloodFrenzy",
    name: "狂暴",
    description: "普通攻击伤害提升50%，受到的伤害增加50%",
    duration: 2,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    stackable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onNeedModifyOriginDamage({ state, damageType, causeBy, oriDamage }) {
      if (causeBy?.skillId == "baseAttack") {
        return oriDamage * 0.5;
      }
      return 0;
    },
    onBeforeTakeDamage({ reducedDamage }) {
      return Math.floor(reducedDamage * 1.5);
    },
  },
  fluffConcentration: {
    id: "fluffConcentration",
    name: "凝神",
    description: "保持高度专注，给予致命一击",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    stackable: true,
    maxStack: 5,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach({ thisState, target, extraAttachStack: extraAttackStack, battleInfo }) {
      if (!target || !thisState || !extraAttackStack) return;
      increaseStateExtraStack(thisState.id, target, extraAttackStack, { battleInfo });
    },
  },
  shadowstack: {
    id: "shadowstack",
    name: "叠影",
    description: "你感到越来越越沉重",
    duration: 1,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    unremovable: true,
    stackable: true,
    maxStack: 10,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
  },

  // 超压
  furryStaticElectricityOverload: {
    id: "furryStaticElectricityOverload",
    name: "超压",
    description:
      "每一层“超压”使你的魔法消耗提升25%，造成的魔法伤害提升5%，最大10层\n普通攻击后释放积蓄的能量，对随机2个目标造成(智力120% + 25)的魔法伤害，无视防御。随后降低6层静电，并清除所有“超压”层数",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    stackable: true,
    maxStack: 10,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach({ thisState, extraAttachStack: extraAttackStack, target, battleInfo }) {
      if (!target || !thisState || !extraAttackStack) return;
      increaseStateExtraStack(thisState.id, target, extraAttackStack, { battleInfo });
    },
    onNeedModifyOriginDamage({ state, damageType, oriDamage }) {
      let stack = getStateExtraStack(state);

      if (damageType == DamageType.Magical) {
        return (oriDamage * (stack * 0.05));
      }

      return 0;
    },
    onBeforeLossMp({ state, mpLoss }) {
      let stack = getStateExtraStack(state);

      return mpLoss * (1 + stack * 0.25);
    },
    async afterSimpleAttack({ self, battleInfo, dealDamageCallback, callbacks }) {
      let enemies = getEnemyUnitsByUnit(battleInfo, self).filter(
        (enemy) => enemy.hp > 0
      );
      let targetEnemies = getRandomUnitsInCollection(enemies, 2);

      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks, ignoreTriggers: true }) ?? 0;

      let damage = intelligence * 1.2 + 25;
      await dealAoeDamage(
        self,
        targetEnemies,
        () => {
          return damage;
        },
        {
          damageType: DamageType.Magical,
          battleInfo,
          ignoreDefence: true,
          dealDamageCallback,
        }
      );

      decreaseStateExtraStack(self.state!["furryStaticElectricity"]!, 6);
      detachState("furryStaticElectricityOverload", self, battleInfo, {
        callbacks
      });
    },
  },
  furryStaticElectricity: {
    id: "furryStaticElectricity",
    name: "静电",
    description:
      "每积蓄3层“静电”，对随机2个敌人造成(智力90% + 25)的魔法伤害，无视10%防御。每额外拥有3层“静电”，伤害额外提升(智力30%)，目标+1。\n当已拥有的“静电”层数超过(最大层数 - 3)时，对所有敌人造成一次(智力300% + 100)的魔法伤害，无视防御，然后清除所有静电层数\n在你的回合结束时，如果静电层数超过12层，每超过1层，获得1层“超压”，持续2回合",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    stackable: true,
    maxStack: 15,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_END,
    onAttach: async ({
      target,
      thisState,
      battleInfo,
      extraAttachStack: extraAttackStack,
      callbacks
      // dealDamageCallback,
      // floatTextCallback,
    }) => {
      if (!thisState || !battleInfo || !target) {
        return;
      }

      let addedStack = extraAttackStack ?? 0;
      if (!addedStack) {
        return;
      }

      let oldStack = getStateExtraStack(thisState);
      let newStack = increaseStateExtraStack(thisState.id, target, addedStack, { battleInfo });

      let enemies = getEnemyUnitsByUnit(battleInfo, target).filter(
        (enemy) => enemy.hp > 0
      );

      const maxStack = getUnitStateMaxExtraStack(thisState.id, target, battleInfo);

      for (
        let checkStack = oldStack + 1;
        checkStack <= newStack;
        checkStack++
      ) {
        if (checkStack % 3 === 0 && checkStack < maxStack) {
          callbacks?.floatTextCallback?.({
            unit: target,
            text: `静电！(${checkStack}层)`,
          });

          let extraStack = Math.floor(checkStack / 3) - 1;
          let enemyCount = 2 + extraStack;
          let intelligence = getUnitStatusInBattle(target, 'intelligence', { battleInfo, callbacks: callbacks! }) ?? 0;
          let damage =
            intelligence * 0.9 + 25 + extraStack * 0.3 * intelligence;

          let targetEnemies = getRandomUnitsInCollection(enemies, enemyCount);

          await dealAoeDamage(
            target,
            targetEnemies,
            () => {
              return damage;
            },
            {
              damageType: DamageType.Magical,
              battleInfo,
              ignoreDefencePercent: 10,
              dealDamageCallback: callbacks?.dealDamageCallback,
            }
          );
        }
      }

      if (newStack >= maxStack) {
        callbacks?.floatTextCallback?.({
          unit: target,
          text: "超级静电！",
        });

        const intelligence = getUnitStatusInBattle(target, 'intelligence', { battleInfo, callbacks: callbacks! }) ?? 0;

        await dealAoeDamage(
          target,
          enemies,
          () => {
            return intelligence * 3 + 100;
          },
          {
            damageType: DamageType.Magical,
            battleInfo,
            ignoreDefence: true,
            dealDamageCallback: callbacks?.dealDamageCallback,
            // ignoreTrigger: true,
          }
        );

        resetStateExtraStack(thisState);
        detachState("furryStaticElectricity", target, battleInfo, {
          callbacks: callbacks!
        });
      }
    },
    async effect({ self, thisState, battleInfo, callbacks, addStateCallback }) {
      if (!thisState) {
        return;
      }

      let stack = getStateExtraStack(thisState);
      const maxStack = getUnitStateMaxExtraStack(thisState.id, self, battleInfo);

      if (stack > maxStack - 3) {
        let overflow = stack - (maxStack - 3);

       await addState(
          "furryStaticElectricityOverload",
          2,
          self,
          self,
          {},
          {
            battleInfo,
            callbacks,
            extraStack: overflow,
            addStateCallback,
          }
        );
      }

      return undefined;
    },
  },
  intertwinedCatEyeStaffPhysical: {
    id: "intertwinedCatEyeStaffPhysical",
    name: "交织(物理)",
    description: "造成的物理伤害提升",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onBeforeDamageSourceCalcDamage: ({ reducedDamage, damageType, target, state }) => {
      let extraDamagePercent = 0;
      if (damageType == DamageType.Physical) {
        extraDamagePercent = state.extra!.thisStateActuralValue ?? 0;
      }

      return reducedDamage * (1 + extraDamagePercent);
    },
  },
  intertwinedCatEyeGenesisEssenceStaffMagical: {
    id: "intertwinedCatEyeGenesisEssenceStaffMagical",
    name: "棱彩交织(魔法)",
    description: "造成的魔法伤害提升",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onBeforeDamageSourceCalcDamage: ({ reducedDamage, damageType, target, state }) => {
      let extraDamagePercent = 0;
      if (damageType == DamageType.Magical) {
        extraDamagePercent = state.extra!.thisStateActuralValue ?? 0;
      }

      return reducedDamage * (1 + extraDamagePercent);
    },
  },


  intertwinedCatEyeGenesisEssenceStaffPhysical: {
    id: "intertwinedCatEyeGenesisEssenceStaffPhysical",
    name: "棱彩交织(物理)",
    description: "造成的物理伤害提升",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onBeforeDamageSourceCalcDamage: ({ reducedDamage, damageType, target, state }) => {
      let extraDamagePercent = 0;
      if (damageType == DamageType.Physical) {
        extraDamagePercent = state.extra!.thisStateActuralValue ?? 0;
      }

      return reducedDamage * (1 + extraDamagePercent);
    },
  },
  intertwinedCatEyeStaffMagical: {
    id: "intertwinedCatEyeStaffMagical",
    name: "交织(魔法)",
    description: "造成的魔法伤害提升",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onBeforeDamageSourceCalcDamage: ({ reducedDamage, damageType, target, state }) => {
      let extraDamagePercent = 0;
      if (damageType == DamageType.Magical) {
        extraDamagePercent = state.extra!.thisStateActuralValue ?? 0;
      }

      return reducedDamage * (1 + extraDamagePercent);
    },
  },

  solitude: {
    id: "solitude",
    name: "孤立",
    description: "你无法被友军选择为目标",
    duration: 30,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onAttach: () => {},
  },

  overloadCrownDecreaseAttack: {
    id: "overloadCrownDecreaseAttack",
    name: "霸主威严",
    description: "你的攻击力被降低了",
    duration: 3,
    unremovable: true,
    stackable: false,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ thisState, target }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.attacking.level = target.status.attacking.level - value;
    },
    onDetach: ({ self, thisState }) => {
      const state = thisState
      const value = state!.extra!.thisStateActuralValue ?? 1;
      self.status.attacking.level = self.status.attacking.level + value;
    },
  },
  overloadCrownIncreaseAttack: {
    id: "overloadCrownIncreaseAttack",
    name: "霸主威严",
    description: "你的攻击力被提升了",
    duration: 3,
    unremovable: true,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ thisState, target }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.attacking.level = target.status.attacking.level + value;
    },
    onDetach: ({ self, thisState }) => {
      const state = thisState
      const value = state!.extra!.thisStateActuralValue ?? 1;
      self.status.attacking.level = self.status.attacking.level - value;
    },
  },
  eternalGuardianAmuletState: {
    id: "eternalGuardianAmuletState",
    name: "永恒守护",
    description: "你现在很安全",
    duration: 1,
    unremovable: true,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({ self, reducedDamage, state }) {
      if (hasEquipment(self, 'eternalGuardianAmulet')) {
        return reducedDamage;
      }

      if (hasEquipment(self, 'otherworldCrystalPendant')) {
        return reducedDamage;
      }

      return 0;
    },
    onNeedModifyOriginDamage({ oriDamage }) {
      return Math.floor(oriDamage * 0.2)
    }
  },
  eternalGuardianAmuletCooldown: {
    id: "eternalGuardianAmuletCooldown",
    name: "永恒庇护冷却",
    description: "你已通过永恒庇护离开了危险，请等待永恒守护恢复",
    duration: 30,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_END,
    onAttach: () => {},
  },

  starforgedAlloylCoatKeeping: {
    id: "starforgedAlloylCoatKeeping",
    name: "星辰奔涌",
    description: "你正处于星辰奔涌中",
    duration: 30,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_END,
    onAttach: () => {},
  }
} as const satisfies Record<string, BattleState>;


export const allBattleState = {
  chefSkillSour: {
    id: "chefSkillSour",
    name: "爆炒-酸",
    description: "获得伤害增幅与伤害减免",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onNeedModifyOriginDamage({oriDamage, state}) {
      const val = state.extra?.thisStateActuralValue ?? 0

      if (!val) {
        return 0
      }

      return val * oriDamage
    },
    onBeforeTakeDamage({reducedDamage, state}) {
      const val = state.extra?.thisStateActuralValue ?? 0

      if (!val) {
        return reducedDamage
      }

      return reducedDamage * (1 - val)
    }
  },
  chefSkillBitter: {
    id: "chefSkillBitter",
    name: "爆炒-苦",
    description: "受到的伤提升,",
    duration: 4,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({reducedDamage, state}) {
      const val = state.extra?.thisStateActuralValue ?? 0

      if (!val) {
        return reducedDamage
      }

      return reducedDamage * (1 + val)
    }
  },

  // // 宿舍副本：抗控护盾（小）
  // dormCcWard: {
  //   id: "dormCcWard",
  //   name: "宿舍抗控护盾",
  //   description: "宿舍怪物初始的抗控护盾，提升对眩晕/沉默/冻结的抵抗几率",
  //   duration: 999,
  //   isBuff: true,
  //   isDebuff: false,
  //   consumeTurn: false,
  //   unremovable: true,
  //   StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
  //   onAttach: () => {},
  // },
  // // 宿舍Boss专用：更强的抗控护盾
  // dormCcWardBoss: {
  //   id: "dormCcWardBoss",
  //   name: "宿舍守护残影·抗控",
  //   description: "Boss特有的强效抗控护盾，大幅提升对控制技能的抵抗几率",
  //   duration: 999,
  //   isBuff: true,
  //   isDebuff: false,
  //   consumeTurn: false,
  //   unremovable: true,
  //   StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
  //   onAttach: () => {},
  // },

  forgeSkillCraftMeowColossusState: {
    id: "forgeSkillCraftMeowColossusState",
    name: "巨像充能",
    description: `每一层充能，将为喵喵巨像提供15生命，8攻击，4护甲，最多100层。每场战斗开始时, 如果当前充能数大于10层, 则损失失4层。\n到达一定层数后为喵喵巨像解锁新的能力:

5层：战斗开始时对随机5个敌人施加3回合的“嘲讽”
10层：喵喵巨像获得30%伤害减免
20层：解锁“巨像激光”技能
30层：每经过4回合，都将立即释放一次“巨像激光”，每场战斗开始时重置
40层：喵喵巨像获得30%伤害增幅
50层：“巨像激光”将对敌人造成两次伤害
`,
    duration: 9999,
    permanent: true,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    stackable: true,
    maxStack: 100,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach({ target, thisState, extraAttachStack, battleInfo }) {
      if (!extraAttachStack || !thisState) {
        return;
      }

      if (!target) {
        return;
      }

      let hpPerStack = 15
      let attackPerStack = 8
      let defencePerStack = 4

      let currentStack = getStateExtraStack(thisState);

      if (checkAlreadyReachMaxStateExtraStack(thisState.id, target, battleInfo)) {
        return;
      }

      let latestCurrentStack = increaseStateExtraStack(thisState.id, target, extraAttachStack, { battleInfo });

      extraAttachStack = latestCurrentStack - currentStack

      currentStack = latestCurrentStack

      if (!thisState.extra!.readableDesc) {
        thisState.extra!.readableDesc = {};
      }
      thisState.extra!.readableDesc["额外攻击力"] = "" + currentStack * attackPerStack;
      thisState.extra!.readableDesc["额外防御力"] = "" + currentStack * defencePerStack;
      thisState.extra!.readableDesc["额外生命值"] = "" + currentStack * hpPerStack;

      target.status.attacking.level += extraAttachStack * attackPerStack;
      target.status.defencing.level += extraAttachStack * defencePerStack;
      target.maxHp += extraAttachStack * hpPerStack;

      target.hp += extraAttachStack * hpPerStack;
    },
    onDetach({ self, thisState }) {
      if (!thisState) {
        return;
      }

      let hpPerStack = 15
      let attackPerStack = 8
      let defencePerStack = 4

      const stack = getStateExtraStack(thisState);

      self.status.attacking.level -= stack * attackPerStack;
      self.status.defencing.level -= stack * defencePerStack;
      self.maxHp -= stack * hpPerStack;
      self.hp -= stack * hpPerStack;

      self.hp = Math.max(0, self.hp)
    },

    onReduceStack({ self, thisState, reduceCount }) {
      if (!thisState) {
        return;
      }

      let hpPerStack = 15
      let attackPerStack = 8
      let defencePerStack = 4

      self.status.attacking.level -= reduceCount * attackPerStack;
      self.status.defencing.level -= reduceCount * defencePerStack;
      self.maxHp -= reduceCount * hpPerStack;
      self.hp -= reduceCount * hpPerStack;

      self.hp = Math.max(0, self.hp)
    },

    async onBattleStart({self, thisState, enemies, callbacks, battleInfo}) {
      if (getStateExtraStack(thisState) < 5 || !enemies?.length) {
        return;
      }

      if (getStateExtraStack(thisState) > 10) {
        reduceStateStack('forgeSkillCraftMeowColossusState', self, 4)
      }

      let randomEnemies = getRandomUnitsInCollection(enemies, 5);

      callbacks?.floatTextCallback({
        unit: self,
        text: "嘲讽",
      })

      for (const enemy of randomEnemies) {
       await addState(
          "taunt",
          3,
          self,
          enemy,
          {},
          {
            callbacks,
            addStateCallback: callbacks?.addStateCallback,
            battleInfo,
          }
        );
      }

    },

    onBeforeTakeDamage({self, state, reducedDamage}) {
      if (getStateExtraStack(state) >= 10) {
        reducedDamage = reducedDamage * 0.7
      }

      return reducedDamage;
    },
    onNeedModifyOriginDamage({state, oriDamage}) {
      let extraDamage = 0

      if (getStateExtraStack(state) >= 40) {
        extraDamage = oriDamage * 0.3;
      }

      return extraDamage;
    },

    // 猫猫巨像阵亡后，移除
    afterTakeDamage({self, battleInfo}) {
      if (self.hp > 0 || !battleInfo) {
        return;
      }
      let selfUuid = self.uuid

      battleInfo.members = battleInfo.members.filter(u => u.uuid !== selfUuid);
      // 从分组中移除
      for (const groupId in battleInfo.groups) {
        battleInfo.groups[groupId] = battleInfo.groups[groupId].filter(u => u !== selfUuid);
      }
      // 从turnOrder中移除
      battleInfo.turnOrder = battleInfo.turnOrder.filter(u => u !== selfUuid);
    },

    async afterEachOtherUnitAction({self, currentTurnUnit, thisState, battleInfo, callbacks}) {
      if (currentTurnUnit.uuid == self.uuid) {
        return;
      }

      if (getStateExtraStack(thisState) < 30) {
        return;
      }

      if (getTimesPerBattleTriggerMark(self, "meowColossusLaserTurns") < 4) {
        increaseTimesPerBattleTriggerMark(self, "meowColossusLaserTurns", 1);
        return;
      }

      let info = getInfoFromBattleInfo(self, battleInfo);
      if (!info) {
        return;
      }

      decreaseTimesPerBattleTriggerMark(self, "meowColossusLaserTurns", 4)

      await castSkill(self, "meowColossusLaser", {
        allAllies: info.allAllyUnit,
        allEnemies: info.allEnemies,
        allies: info.allyUnits,
        enemies: info.enemyUnits,
        callbacks,
        battleInfo,
      }, {
        ignoreColddown: true,
        ignoreMpCost: true,
        ignoreControl: true,
      });
    },
  },
  forgeSkillCraftTurretUpgrade: {
    id: "forgeSkillCraftTurretUpgrade",
    name: "升级！",
    description: "炮台升级",
    duration: 9999,
    permanent: true,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    stackable: true,
    maxStack: 10,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    afterEachOtherUnitAction: async ({ self, battleInfo, currentTurnUnit, callbacks }) => {
      let info = getInfoFromBattleInfo(self, battleInfo)

      if (currentTurnUnit.uuid != self.summonedBy) {
        return;
      }

      if (!info) {
        return;
      }

      await castSkill(self, 'baseAttack', {
        battleInfo,
        callbacks,
        enemies: info.enemyUnits,
        allEnemies: info.allEnemies,
        allies: info.allyUnits,
        allAllies: info.allAllyUnit,
      })
    },
    onAttach({ target, thisState, extraAttachStack, battleInfo }) {
      if (!extraAttachStack || !thisState) {
        return;
      }

      if (!target) {
        return;
      }

      let attackPerStack = readStateExtraInfo<number>(thisState, "attackPerStack") ?? 5;
      let defencePerStack = readStateExtraInfo<number>(thisState, "defencePerStack") ?? 5;
      let hpPerStack = readStateExtraInfo<number>(thisState, "hpPerStack") ?? 5;
      const currentStack = getStateExtraStack(thisState);

      if (checkAlreadyReachMaxStateExtraStack(thisState.id, target, battleInfo)) {
        return;
      }

      increaseStateExtraStack(thisState.id, target, extraAttachStack, { battleInfo });

      if (!thisState.extra!.readableDesc) {
        thisState.extra!.readableDesc = {};
      }
      thisState.extra!.readableDesc["额外攻击力"] = "" + getStateExtraStack(thisState) * attackPerStack;
      thisState.extra!.readableDesc["额外防御力"] = "" + getStateExtraStack(thisState) * defencePerStack;
      thisState.extra!.readableDesc["额外生命值"] = "" + getStateExtraStack(thisState) * hpPerStack;

      target.status.attacking.level += extraAttachStack * attackPerStack;
      target.status.defencing.level += extraAttachStack * defencePerStack;
      target.maxHp += extraAttachStack * hpPerStack;

      target.hp = target.maxHp
    },
    onDetach({ self, thisState }) {
      if (!thisState) {
        return;
      }

      let attackPerStack = readStateExtraInfo<number>(thisState, "attackPerStack") ?? 5;
      let defencePerStack = readStateExtraInfo<number>(thisState, "defencePerStack") ?? 5;
      let hpPerStack = readStateExtraInfo<number>(thisState, "hpPerStack") ?? 5;

      const stack = getStateExtraStack(thisState);

      self.status.attacking.level -= stack * attackPerStack;
      self.status.defencing.level -= stack * defencePerStack;
      self.maxHp -= stack * hpPerStack;
    },
  },

  fishmanSkillSource: {
    id: "fishmanSkillSource",
    name: "钓鱼中",
    description: "天知道为什么会在这个时候钓鱼",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: true,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
  },
  // fishmanSkillTarget: {
  //   id: "fishmanSkillTarget",
  //   name: "上钩了！",
  //   description: "钓到了个大宝贝",
  //   duration: 2,
  //   isBuff: false,
  //   isDebuff: true,
  //   consumeTurn: true,
  //   unremovable: true,
  //   StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
  //   onDetach({ self, thisState, battleInfo, callbacks }) {
  //     if (self.hp <= 0) {
  //       return;
  //     }

  //     let sourceUuid = thisState?.addBy;

  //     if (!sourceUuid || !battleInfo) {
  //       return;
  //     }

  //     let sourceUnit = battleInfo?.members.find(
  //       (member) => member.uuid === sourceUuid
  //     );
  //     if (!sourceUnit) {
  //       return;
  //     }

  //     let fishingLevel = sourceUnit.status.otherStatus.fishing?.level ?? 1;
  //     let sourceUnitSkillLevel = sourceUnit.skills.fishmanSkill?.level ?? 1;
  //     let damage = fishingLevel * 10 + sourceUnitSkillLevel * 5;

  //     dealDamage(sourceUnit, self, damage, {
  //       damageType: DamageType.Physical,
  //       battleInfo,
  //       // dealDamageCallback
  //     });

  //     if (self.hp <= 0) {
  //       if (randomNumberInFullColseRange(0, 1) < fishingLevel * 0.5) {
  //         callbacks?.floatTextCallback({
  //           unit: sourceUnit,
  //           text: "上钩了！",
  //         });
  //       }
  //     }
  //   },
  //   afterTakeDamage({ self, state: thisState, battleInfo, callbacks }) {
  //     if (self.hp > 0) {
  //       return;
  //     }

  //     let sourceUuid = thisState?.addBy;

  //     if (!sourceUuid || !battleInfo) {
  //       return;
  //     }

  //     let sourceUnit = battleInfo?.members.find(
  //       (member) => member.uuid === sourceUuid
  //     );
  //     if (!sourceUnit) {
  //       return;
  //     }

  //     let fishingLevel = sourceUnit.status.otherStatus.fishing?.level ?? 1;

  //     if (self.hp <= 0) {
  //       if (randomNumberInFullColseRange(0, 1) < fishingLevel * 0.25) {
  //         callbacks?.floatTextCallback({
  //           unit: sourceUnit,
  //           text: "上钩了！",
  //         });
  //       }
  //     }
  //   },
  // },
  enhanceEmpowerState: {
    id: "enhanceEmpowerState",
    name: "强化赋能",
    description:
      "获得主属性提升，每穿戴1件强化过的装备，每1强化等级都额外提供属性",
    duration: 5,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      const mainStatus: "strength" | "dexterity" | "intelligence" =
        state!.extra!.mainStatus ?? "strength";

      target.status[mainStatus].level = target.status[mainStatus].level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      const mainStatus: "strength" | "dexterity" | "intelligence" =
        state!.extra!.mainStatus ?? "strength";

      self.status[mainStatus].level = self.status[mainStatus].level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  shadowIntimidate: {
    id: "shadowIntimidate",
    name: "暗影威慑",
    description: "对“战栗”状态下的敌人，造成额外10%伤害",
    duration: 2,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onBeforeDamageSourceCalcDamage: ({ reducedDamage, target, state }) => {
      if (hasState(target, "tremble")) {
        reducedDamage = reducedDamage * 1.1;
      }
      return reducedDamage;
    },
  },
  tremble: {
    id: "tremble",
    name: "战栗",
    description: "造成的伤害降低10%",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onBeforeDamageSourceCalcDamage: ({ reducedDamage, state }) => {
      reducedDamage = reducedDamage * 0.9;
      return reducedDamage;
    },
  },

  knowledgeInspirationState: {
    id: "knowledgeInspirationState",
    name: "知识启迪",
    description: "你已经被知识的光辉所启迪，短时间内不会再受到影响",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
  },

  natureGift: {
    id: "natureGift",
    name: "自然时运",
    description: "战利品掉落率提升",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
  },

  sowMelonsReapMelonsColddown: {
    id: "sowMelonsReapMelonsColddown",
    name: "种瓜得瓜(重置冷却)",
    description: "状态消失后，重置技能冷却",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onDetach({ self, thisState }) {
      self.skillColddown = {};
    },
  },

  sowMelonsReapMelonsRegen: {
    id: "sowMelonsReapMelonsRegen",
    name: "种瓜得瓜(状态恢复)",
    description: "状态消失后，恢复50%已损失的生命值和魔法值",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onDetach({ self, thisState, callbacks, battleInfo }) {
      healUnit(self, self, Math.floor((self.maxHp - self.hp) * 0.5), {
        reason: HpRestoreReason.STATE_EFFECT,
        battleInfo: battleInfo!,
        callbacks: callbacks!,
        callback: callbacks?.healCallback
      });
      restoreMp(self, self, Math.floor((self.maxMp - self.mp) * 0.5), {
        reason: MpRestoreReason.STATE_EFFECT,
        callback: callbacks?.restoreMpCallback
      });
    },
  },

  sowMelonsReapMelonsLuck: {
    id: "sowMelonsReapMelonsLuck",
    name: "得瓜",
    description: "获得4点幸运，持续4回合",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onAttach({ target, thisState }) {
      if (target?.status?.otherStatus?.luck) {
        target.status.otherStatus.luck.level += 4;
      }
    },
    onDetach({ self, thisState }) {
      if (self?.status?.otherStatus?.luck) {
        self.status.otherStatus.luck.level -= 4;

        if (self.status.otherStatus.luck.level < 0) {
          self.status.otherStatus.luck.level = 0;
        }
      }
    },
  },

  paradeCapeAddAttack: {
    id: "paradeCapeAddAttack",
    name: "欢乐游行（攻击）",
    description: "攻击力提升5%",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.attacking.level = target.status.attacking.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      // 护盾消失时移除
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      self.status.attacking.level = self.status.attacking.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  paradeCapeAddDefence: {
    id: "paradeCapeAddDefence",
    name: "欢乐游行（防御）",
    description: "防御力提升5%",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.defencing.level = target.status.defencing.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      // 护盾消失时移除
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      self.status.defencing.level = self.status.defencing.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  paradeCapeAddStatus: {
    id: "paradeCapeAddDefence",
    name: "欢乐游行（属性）",
    description: "力量、敏捷、智力提升10",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.strength.level = target.status.strength.level + value;
      target.status.dexterity.level = target.status.dexterity.level + value;
      target.status.intelligence.level =
        target.status.intelligence.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      // 护盾消失时移除
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      self.status.strength.level = self.status.strength.level - value;
      self.status.dexterity.level = self.status.dexterity.level - value;
      self.status.intelligence.level = self.status.intelligence.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  loadOfamusementParkIncreaseDamage: {
    id: "loadOfamusementParkIncreaseDamage",
    name: "狂欢",
    description: "额外造成伤害",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.AFTER_TAKE_DAMAGE,
    onNeedModifyOriginDamage({ oriDamage, state }) {
      return oriDamage * (state.extra!.thisStateActuralValue ?? 0);
    },
  },
  loadOfamusementParkDecreaseDamage: {
    id: "loadOfamusementParkDecreaseDamage",
    name: "狂欢",
    description: "降低受到的伤害",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.AFTER_TAKE_DAMAGE,
    onBeforeTakeDamage({ reducedDamage, state }) {
      let damage = reducedDamage;
      damage = damage * (1 - (state.extra!.thisStateActuralValue ?? 0));

      return damage;
    },
  },

  berryWine: {
    id: "berryWine",
    name: "浆果酒",
    description: "每回合开始时，回复30魔法值",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect: ({ self, callbacks }) => {
      restoreMp(self, self, 40, {
        reason: MpRestoreReason.STATE_EFFECT,
        callback: callbacks?.restoreMpCallback
      });
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
    onAttach: () => {},
    onDetach: () => {},
  },
  custardPudding: {
    id: "custardPudding",
    name: "蛋奶布丁",
    description: "每回合开始时，回复40生命值",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect: async ({ self, callbacks, battleInfo }) => {
      await healUnit(self, self, 40, {
        reason: HpRestoreReason.STATE_EFFECT,
        callback: callbacks?.healCallback,
        battleInfo: battleInfo!,
        callbacks: callbacks!,
      });
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
    onAttach: () => {},
    onDetach: () => {},
  },

  dawnBlossomWineState: {
    id: "dawnBlossomWineState",
    name: "晨露精酿",
    description: "当前攻击力提升50%",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.attacking.level = target.status.attacking.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      // 护盾消失时移除
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      self.status.attacking.level = self.status.attacking.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  cannedTunaState: {
    id: "cannedTunaState",
    name: "金枪鱼罐头",
    description: "当前攻击力提升8%",
    duration: 10,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.attacking.level = target.status.attacking.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      // 护盾消失时移除
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      self.status.attacking.level = self.status.attacking.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  cannedShrimpState: {
    id: "cannedShrimpState",
    name: "风味虾仁罐头",
    description: "当前防御力提升8%",
    duration: 10,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.defencing.level = target.status.defencing.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      // 护盾消失时移除
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      self.status.defencing.level = self.status.defencing.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  cannedRainbowFishState: {
    id: "cannedRainbowFishState",
    name: "彩虹鱼干罐头",
    description: "力量、敏捷、智力提升8",
    duration: 10,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.strength.level = target.status.strength.level + value;
      target.status.dexterity.level = target.status.dexterity.level + value;
      target.status.intelligence.level =
        target.status.intelligence.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      // 护盾消失时移除
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      self.status.strength.level = self.status.strength.level - value;
      self.status.dexterity.level = self.status.dexterity.level - value;
      self.status.intelligence.level = self.status.intelligence.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  cannedMysticalKoiState: {
    id: "cannedMysticalKoiState",
    name: "神秘锦鲤罐头",
    description: "战利品掉落率提升8%（*108%）",
    duration: 10,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    keepOnDeath: true,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onAttach: () => {},
    onDetach: () => {},
    calcBattleWinRewardExtraDropRate: ({drop}) => {
      return drop.percent * 0.08;
    }
  },

  cannedCrystalCarpTunaState: {
    id: "cannedCrystalCarpTunaState",
    name: "水晶金枪鱼罐头",
    description: "当前攻击力提升12%\n造成物理伤害时，穿透10%防御",
    duration: 10,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      target.status.attacking.level = Math.floor(target.status.attacking.level + (target.baseStatus.attacking.level * 0.12));
    },
    onDetach: ({ self, thisState }) => {
      self.status.attacking.level = Math.floor(self.status.attacking.level - (self.baseStatus.attacking.level * 0.12));
    },
    onDamageSourceNeedModifyDefenceIgnorePercent: ({damageType}) => {
      if (damageType === DamageType.Physical) {
        return 10;
      }

      return 0;
    }
  },
  cannedCrystalCarpShrimpState: {
    id: "cannedCrystalCarpShrimpState",
    name: "风味水晶虾仁罐头",
    description: "当前防御力提升15%\n受到的伤害降低15%",
    duration: 10,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      target.status.defencing.level = Math.floor(target.status.defencing.level + (target.baseStatus.defencing.level * 0.15));
    },
    onDetach: ({ self, thisState }) => {
      self.status.defencing.level = Math.floor(self.status.defencing.level - (self.baseStatus.defencing.level * 0.15));
    },
    onBeforeTakeDamage({reducedDamage}) {
      return Math.floor(reducedDamage * 0.85);
    }
  },

  cannedCrystalCarpRainbowFishState: {
    id: "cannedCrystalCarpRainbowFishState",
    name: "彩虹水晶鱼干罐头",
    description: "力量、敏捷、智力提升15",
    duration: 10,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    keepOnDeath: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const value = 15;

      target.status.strength.level = target.status.strength.level + value;
      target.status.dexterity.level = target.status.dexterity.level + value;
      target.status.intelligence.level = target.status.intelligence.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self, }) => {
      const value = 15;

      self.status.strength.level = self.status.strength.level - value;
      self.status.dexterity.level = self.status.dexterity.level - value;
      self.status.intelligence.level = self.status.intelligence.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  cannedCrystalCarpMysticalKoi: {
    id: "cannedCrystalCarpMysticalKoi",
    name: "神秘水晶锦鲤罐头",
    description: "战利品掉落率提升12%（*112%）",
    duration: 10,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    keepOnDeath: true,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onAttach: () => {},
    onDetach: () => {},
    calcBattleWinRewardExtraDropRate: ({drop}) => {
      return drop.percent * 0.12;
    }
  },




  infusedShadowBladeHauntingDreams: {
    id: "infusedShadowBladeHauntingDreams",
    name: "缚魂",
    description: "回合开始时，失去25魔法值，并受到等量无视防御的伤害",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect: async ({ self, battleInfo, dealDamageCallback, callbacks }) => {
      let damage = 25;

      const addBy = self.state?.infusedShadowBladeHauntingDreams?.addBy;
      const source = battleInfo.members.find((unit) => unit.uuid === addBy);

      if (!source) {
        return;
      }

      let finalDamage = await dealDamage(source, self, damage, {
        ignoreDefence: true,
        battleInfo,
        damageType: DamageType.Magical,
        dealDamageCallback,
      });

      await lossMp(source, self, 25, {
        reason: MpLossReason.UNKNOWN,
        battleInfo,
        callbacks
      });

      let res: FullBattleAction = {
        type: "state",
        damage: { [self.uuid]: finalDamage },
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: source.uuid ?? self.uuid,
      };

      return res;
    },
  },

  ancestorCrownRefreshSkill: {
    id: "ancestorCrownRefreshSkill",
    name: "猫祖威仪",
    description: "强大的气息让你在战斗中更具威严",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_END,
    effect: ({ self }) => {
      if (self.skillColddown?.shadowBurst) {
        self.skillColddown.shadowBurst = 0;
      }

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  fangNecklaceAtkUp: {
    id: "fangNecklaceAtkUp",
    name: "兽牙项链",
    description: "锋利的牙齿让你在战斗中更具攻击力",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.attacking.level = target.status.attacking.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      // 护盾消失时移除
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      self.status.attacking.level = self.status.attacking.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  litheFromCloudwalkerBoots: {
    id: "litheFromCloudwalkerBoots",
    name: "轻盈",
    description: "轻盈的步伐让你在战斗中更灵活致命",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target }) => {
      if (!target) {
        return;
      }

      const state = target!.state!.litheFromCloudwalkerBoots;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.attacking.level = target.status.attacking.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self }) => {
      // 护盾消失时移除
      const state = self!.state!.litheFromCloudwalkerBoots;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      self.status.attacking.level = self.status.attacking.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },


  litheFromPhantomWalkerBoots: {
    id: "litheFromPhantomWalkerBoots",
    name: "风行",
    description: "如风般轻盈的步伐让你在战斗中更灵活致命",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ thisState, target }) => {
      if (!target) {
        return;
      }

      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.attacking.level = target.status.attacking.level + value;
    },
    onDetach: ({ self, thisState }) => {
      const state = thisState
      const value = state!.extra!.thisStateActuralValue ?? 1;
      self.status.attacking.level = self.status.attacking.level - value;
    },
  },

  litheFromCloudwalkerCloak: {
    id: "litheFromCloudwalkerCloak",
    name: "轻盈",
    description: "轻盈的身姿让你在战斗中更灵活致命",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target }) => {
      if (!target) {
        return;
      }

      const state = target!.state!.litheFromCloudwalkerCloak;
      const value = state!.extra!.thisStateActuralValue ?? 1;

      target.status.attacking.level = target.status.attacking.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self }) => {
      // 护盾消失时移除
      const state = self!.state!.litheFromCloudwalkerCloak;
      const value = state!.extra!.thisStateActuralValue ?? 1;
      let ori = self.status.attacking.level;
      self.status.attacking.level = self.status.attacking.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  guardianLaserResist: {
    id: "guardianLaserResist",
    name: "激光抵抗",
    description: "后续受到的守护者激光的伤害将被降低。",
    duration: 3,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_END,
  },

  slimeDivideCoreState: {
    id: "slimeDivideCoreState",
    name: "分裂核心",
    description: "这个单位看着黏糊糊的，还在冒烟",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_END,
    effect: async ({ self, enemies, battleInfo, dealDamageCallback }) => {
      await dealDamage(self, self, self.maxHp + 100, {
        ignoreDefence: true,
        battleInfo,
        damageType: DamageType.Magical,
        dealDamageCallback,
      });

      const results: FullBattleAction = {
        type: "skill",
        damage: {
          [self.uuid]: {
            damage: self.maxHp,
            damageType: DamageType.Magical,
          },
        },
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };

      const damage = 10 + (self.status.attacking.level ?? 0);
      for (const enemy of enemies) {
        let d = await dealDamage(self, enemy, damage, {
          ignoreDefencePercent: 30,
          battleInfo,
          damageType: DamageType.Magical,
          dealDamageCallback,
        });

        results.damage![enemy.uuid] = d;
        results.targetUnitUuidList!.push(enemy.uuid);
      }

      return results;
    },
  },

  emberAegisCooldown: {
    id: "emberAegisCooldown",
    name: "余烬已庇护",
    description: "你已通过余烬的庇护离开了危险，请等待余烬之力恢复",
    duration: 30,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_END,
    onAttach: () => {},
  },

  skillSeal: {
    id: "skillSeal",
    name: "技能封印",
    description: "你的技能冷却被暂停",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_END,
    onAttach: () => {},
  },

  banished: {
    id: "banished",
    name: "驱逐",
    description: "你被驱逐了，你无法行动，也无法被多数效果选择为目标",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: true,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_END,
    onAttach: () => {},
  },

  arcaneLock: {
    id: "arcaneLock",
    name: "驱魔锁",
    description: "此单位阵亡时，使伤害来源的所有技能进入2回合冷却。",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: true,
    unremovable: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.AFTER_TAKE_DAMAGE,
    afterTakeDamage: (opt) => {
      const { damageSource, self } = opt;
      if (self.hp <= 0) {
        // 使伤害来源的所有技能进入2回合冷却
        if (damageSource.skills) {
          ObjectKeys<AllBattleSkillId>(damageSource.skills).forEach(
            (skillId) => {
              if (!damageSource.skillColddown) {
                damageSource.skillColddown = {};
              }

              if (skillId == "baseAttack") {
                return;
              }

              // 如果冷却时间比2大，则不设置冷却时间
              if (
                damageSource.skillColddown[skillId] &&
                damageSource.skillColddown[skillId] > 2
              ) {
                return;
              }
              damageSource.skillColddown[skillId] = 2; // 设置冷却时间为2回合
            }
          );
        }
      }
    },
  },

  silkTightsClothBuff: {
    id: "silkTightsClothBuff",
    name: "月光庇护",
    description: "在月光的力量下，你变得更敏捷与致命了",
    duration: 2,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ target }) => {
      if (!target) {
        return;
      }

      // 取技能传递的护盾值
      var value =
        target?.state?.silkTightsClothBuff?.extra?.thisStateActuralValue ?? 6;

      target.status.attacking.level = target.status.attacking.level + value;
      target.status.dexterity.level = target.status.dexterity.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: target.uuid,
      };
    },
    onDetach: ({ self }) => {
      var value =
        self?.state?.silkTightsClothBuff?.extra?.thisStateActuralValue ?? 6;

      self.status.attacking.level = self.status.attacking.level - value;
      self.status.dexterity.level = self.status.dexterity.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  silkMageBurqaBuff: {
    id: "silkMageBurqaBuff",
    name: "神秘庇护",
    description: "神秘精华的力量是你感到被庇护，获得临时防御与智力提升",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ target }) => {
      if (!target) {
        return;
      }

      // 取技能传递的护盾值
      var value =
        target?.state?.silkMageBurqaBuff?.extra?.thisStateActuralValue ?? 6;

      target.status.defencing.level = target.status.defencing.level + value;
      target.status.intelligence.level =
        target.status.intelligence.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: target.uuid,
      };
    },
    onDetach: ({ self }) => {
      var value =
        self?.state?.silkMageBurqaBuff?.extra?.thisStateActuralValue ?? 6;

      self.status.defencing.level = self.status.defencing.level - value;
      self.status.intelligence.level = self.status.intelligence.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  sneak: {
    id: "sneak",
    name: "潜行",
    description: "在此状态下，无法被敌人选为目标（群体技能不受影响）。",
    duration: 2,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_END,
    onAttach: () => {},
  },

  shadowStrike: {
    id: "shadowStrike",
    name: "影袭",
    description:
      "回合开始时，受到来自状态施加者（150%攻击+150%敏捷）的伤害，无视防御。",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect: async ({ self, battleInfo, dealDamageCallback, callbacks }) => {
      let damage = 0;

      let res: FullBattleAction = {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      const addBy = self.state?.shadowStrike?.addBy;
      if (!addBy) {
        return res;
      }
      const source = battleInfo.members.find((unit) => unit.uuid === addBy);

      if (source) {
        const attacking = getUnitStatusInBattle(source, 'attacking', {battleInfo, callbacks})
        const dexterity = getUnitStatusInBattle(source, 'dexterity', {battleInfo, callbacks})

        let modify =
          attacking * 1.5 +
          dexterity * 1.5;
        damage = +(damage + modify).toFixed(0);

        let damageRes = await dealDamage(source, self, damage, {
          ignoreDefence: true,
          damageType: DamageType.Physical,
          battleInfo,
          dealDamageCallback,
        });

        res.damage = { [self.uuid]: damageRes };
        res.sourceUnitUuid = source.uuid;
        res.targetUnitUuidList = [self.uuid];
      }

      return res;
    },
  },

  shield: {
    id: "shield",
    name: "护盾",
    description: "获得一个可吸收伤害的护盾",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ target }) => {
      // 取技能传递的护盾值
      const state = target!.state!.shield;

      if (!state) {
        return;
      }

      const value = state!.extra!.thisStateActuralValue ?? 20;
      target!.tmpShield = (target!.tmpShield ?? 0) + value;

      let totalShieldValue =
        readStateExtraInfo<number>(state, "shieldValue") ?? 0;
      writeStateExtraInfo(state, "shieldValue", totalShieldValue + value);

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self }) => {
      // 护盾消失时移除
      const state = self!.state!.shield;
      const value = state!.extra!.thisStateActuralValue ?? 20;

      if (!state) {
        return;
      }

      let totalShieldValue =
        readStateExtraInfo<number>(state, "shieldValue") ?? value;
      writeStateExtraInfo(state, "shieldValue", 0);

      self.tmpShield -= totalShieldValue;
      if (self.tmpShield < 0) {
        self.tmpShield = 0; // 确保护盾不会为负值
      }
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  manacrystalStaffShield: {
    id: "manacrystalStaffShield",
    name: "魔晶守护",
    description: "受到魔晶保护获得护盾，持续2回合",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    stackable: true,
    onAttach: ({ target }) => {
      // 取技能传递的护盾值
      const state = target!.state!.manacrystalStaffShield;

      if (!target || !state) {
        return;
      }

      const value = state!.extra!.thisStateActuralValue ?? 10;

      let totalShieldValue =
        readStateExtraInfo<number>(state, "infusedGuardianCoreAmuletShield") ??
        0;
      writeStateExtraInfo(state, "infusedGuardianCoreAmuletShield", value);

      target.tmpShield = target.tmpShield - totalShieldValue;
      if (target.tmpShield < 0) {
        target.tmpShield = 0;
      }

      target.tmpShield = target.tmpShield + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self }) => {
      // 护盾消失时移除
      const state = self!.state!.manacrystalStaffShield;
      const value = state!.extra!.thisStateActuralValue ?? 10;

      if (!state) {
        return;
      }

      let totalShieldValue =
        readStateExtraInfo<number>(state, "manacrystalStaffShield") ?? value;
      writeStateExtraInfo(state, "manacrystalStaffShield", 0);

      self.tmpShield -= totalShieldValue;
      if (self.tmpShield < 0) {
        self.tmpShield = 0; // 确保护盾不会为负值
      }
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  infusedGuardianCoreAmuletShield: {
    id: "infusedGuardianCoreAmuletShield",
    name: "魂灵守护",
    description: "受到魂灵守护者的保护，获得护盾，持续2回合",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ target }) => {
      // 取技能传递的护盾值
      const state = target!.state!.infusedGuardianCoreAmuletShield;

      if (!state || !target) {
        return;
      }
      const value = state!.extra!.thisStateActuralValue ?? 10;

      let totalShieldValue =
        readStateExtraInfo<number>(state, "infusedGuardianCoreAmuletShield") ??
        0;
      writeStateExtraInfo(state, "infusedGuardianCoreAmuletShield", value);

      target.tmpShield = target.tmpShield - totalShieldValue;
      if (target.tmpShield < 0) {
        target.tmpShield = 0;
      }

      target.tmpShield = target.tmpShield + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self }) => {
      // 护盾消失时移除
      const state = self!.state!.infusedGuardianCoreAmuletShield;
      const value = state!.extra!.thisStateActuralValue ?? 10;

      if (!state) {
        return;
      }

      let totalShieldValue =
        readStateExtraInfo<number>(state, "infusedGuardianCoreAmuletShield") ??
        value;
      writeStateExtraInfo(state, "infusedGuardianCoreAmuletShield", 0);

      self.tmpShield -= totalShieldValue;
      if (self.tmpShield < 0) {
        self.tmpShield = 0; // 确保护盾不会为负值
      }
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },


  eternalGuardianAmuletShield: {
    id: "eternalGuardianAmuletShield",
    name: "永恒守护护盾",
    description: "获得护盾2回合",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    stackable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ target, thisState }) => {
      // 取技能传递的护盾值
      const state = thisState

      if (!state || !target) {
        return;
      }
      const value = state!.extra!.thisStateActuralValue ?? 10;

      let totalShieldValue =
        readStateExtraInfo<number>(state, "eternalGuardianAmuletShield") ??
        0;
      writeStateExtraInfo(state, "eternalGuardianAmuletShield", value);

      target.tmpShield = target.tmpShield - totalShieldValue;
      if (target.tmpShield < 0) {
        target.tmpShield = 0;
      }

      target.tmpShield = target.tmpShield + value;
    },
    onDetach: ({ self, thisState }) => {
      // 护盾消失时移除
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 10;

      if (!state) {
        return;
      }

      let totalShieldValue =
        readStateExtraInfo<number>(state, "eternalGuardianAmuletShield") ??
        value;
      writeStateExtraInfo(state, "eternalGuardianAmuletShield", 0);

      self.tmpShield -= totalShieldValue;
      if (self.tmpShield < 0) {
        self.tmpShield = 0; // 确保护盾不会为负值
      }
    },
  },

  atkUp: {
    id: "atkUp",
    name: "攻击提升",
    description: "攻击力获得提升",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target }) => {
      if (!target) {
        return;
      }

      const state = target!.state!.atkUp;
      const value = state!.extra!.thisStateActuralValue ?? 15;

      let ori = target.status.attacking.level;
      target.status.attacking.level = target.status.attacking.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self }) => {
      // 护盾消失时移除
      const state = self!.state!.atkUp;
      const value = state!.extra!.thisStateActuralValue ?? 15;
      let ori = self.status.attacking.level;
      self.status.attacking.level = self.status.attacking.level - value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  defUp: {
    id: "defUp",
    name: "防御提升",
    description: "防御力获得提升",
    duration: 1,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target }) => {
      if (!target) {
        return;
      }

      const state = target!.state!.defUp;
      const value = state!.extra!.thisStateActuralValue ?? 15;
      target.status.defencing.level = target.status.defencing.level + value;
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self }) => {
      // 护盾消失时移除
      const state = self!.state!.defUp;
      const value = state!.extra!.thisStateActuralValue ?? 15;
      self.status.defencing.level = self.status.defencing.level - value;
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  poison: {
    id: "poison",
    name: "中毒",
    description:
      "每回合开始时，自身受到(15 + 智力(30 + 技能等级*4)%)点伤害（无视防御）",
    duration: 6,
    consumeTurn: false,
    isDebuff: true,
    isBuff: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect: async ({ self, battleInfo, thisState, dealDamageCallback }) => {
      let value = thisState?.extra?.thisStateActuralValue ?? 15;

      let addBy = battleInfo.members.find(
        (unit) => unit.uuid === thisState?.addBy
      );

      let damage = await dealDamage(addBy ?? self, self, value, {
        ignoreDefence: true,
        damageType: DamageType.Magical,
        battleInfo,
        dealDamageCallback,
      });

      let res: FullBattleAction = {
        type: "state",
        damage: { [self.uuid]: damage },
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
      return res;
    },
    onAttach: () => {},
    onDetach: () => {},
  },

  bleeding: {
    id: "bleeding",
    name: "流血",
    description:
      "每回合结束时，每一层流血都会使自身受到当前生命值5%的伤害，无视防御。\n这个伤害不会超过状态来源（力量*300%）",
    duration: 6,
    consumeTurn: false,
    isDebuff: true,
    isBuff: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    stackable: true,
    maxStack: 15,
    effect: async ({ self, battleInfo, thisState, dealDamageCallback }) => {
      const currentStack = getStateExtraStack(thisState) ?? 1;
      let damage = Math.floor(self.hp * 0.05 * currentStack);

      let addBy = battleInfo.members.find(
        (unit) => unit.uuid === thisState?.addBy
      );
      if (addBy) {
        const maxDamage = addBy.status.strength.level * 3;

        damage = Math.min(damage, maxDamage);
      }

      await dealDamage(addBy ?? self, self, damage, {
        ignoreDefence: true,
        damageType: DamageType.Physical,
        battleInfo,
        dealDamageCallback,
      });
    },
  },

  venom: {
    id: "venom",
    name: "剧毒",
    description:
      "失去30%护甲，每回合开始时，自身受到(15 + 15%当前生命)点伤害。这个伤害不会超过状态来源（智力*500%)",
    duration: 3,
    consumeTurn: false,
    isDebuff: true,
    isBuff: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect: async ({ thisState, self, battleInfo, dealDamageCallback }) => {
      let damage = 15 + self.hp * 0.15;

      let addBy = battleInfo.members.find(
        (unit) => unit.uuid === thisState?.addBy
      );
      if (addBy) {
        let modify = self.maxHp * 0.06;
        damage = +(damage + modify).toFixed(0);

        const maxDamage = addBy.status.intelligence.level * 5;

        damage = Math.min(damage, maxDamage);
      } else {
        damage = 15;
      }

      let damageRes = await dealDamage(addBy ?? self, self, damage, {
        damageType: DamageType.Magical,
        battleInfo,
        dealDamageCallback,
      });

      return {
        type: "state",
        damage: { [self.uuid]: damageRes },
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
    onAttach: ({ source, target }) => {
      if (target) {
        let value = target.state?.venom?.extra?.thisStateActuralValue ?? 10;

        target.status.defencing.level = target.status.defencing.level - value;

        return {
          type: "state",
          damage: {},
          heal: {},
          targetUnitUuidList: [target.uuid],
          sourceUnitUuid: source.uuid,
        };
      }
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: source.uuid,
      };
    },
    onDetach: ({ self }) => {
      let value = self.state?.venom?.extra?.thisStateActuralValue ?? 10;

      self.status.defencing.level = self.status.defencing.level + value;
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  burn: {
    id: "burn",
    name: "灼烧",
    description: "每回合开始时，自身受到(10 + 最大生命值6%)点伤害（无视防御）。这个伤害不会超过状态来源（智力*500%)",
    duration: 4,
    consumeTurn: false,
    isDebuff: true,
    isBuff: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect: async ({ self, thisState, battleInfo, dealDamageCallback }) => {
      let damage = 10;

      let addBy = battleInfo.members.find(
        (unit) => unit.uuid === thisState?.addBy
      );
      if (addBy) {
        let modify = self.maxHp * 0.06;
        damage = +(damage + modify).toFixed(0);

        const maxDamage = addBy.status.intelligence.level * 5;

        damage = Math.min(damage, maxDamage);
      } else {
        damage = 10;
      }

      let damageRes = await dealDamage(addBy ?? self, self, damage, {
        ignoreDefence: true,
        damageType: DamageType.Magical,
        battleInfo,
        dealDamageCallback,
      });
      return {
        type: "state",
        damage: { [self.uuid]: damageRes },
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
    onAttach: () => {},
    onDetach: () => {},
  },

  selfHeal: {
    id: "selfHeal",
    name: "自我疗愈",
    description:
      "每回合开始时，自身回复(5 + 释放者智力30% + 技能等级*4)点生命值",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect: ({ self, battleInfo, callbacks }) => {
      let heal = 5;

      const addBy = self.state?.selfHeal?.addBy;
      const source = battleInfo.members.find((unit) => unit.uuid === addBy);

      if (source) {
        const sourceIntelligence = getUnitStatusInBattle(source, 'intelligence', {battleInfo, callbacks})
        let modify =
          sourceIntelligence * 0.3 +
          (source.skills.selfHeal?.level ?? 1) * 4;
        heal = +(heal + modify).toFixed(0);
      }

      // 直接修改 self.hp
      self.hp = Math.min(self.maxHp, self.hp + heal);
      return {
        type: "state",
        damage: {},
        heal: { [self.uuid]: heal },
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
    onAttach: () => {},
    onDetach: () => {},
  },

  boneShield: {
    id: "boneShield",
    name: "骨盾",
    description: "提升（8+技能等级*0.5）防御，接下来受到的3次伤害，降低至1点",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target }) => {
      // 建议在角色属性刷新时处理防御加成
      if (!target) {
        return;
      }

      let state = target.state?.boneShield;

      if (!state) {
        return;
      }

      let value = state.extra?.thisStateActuralValue ?? 8;
      target.status.defencing.level += value;

      writeStateExtraInfo(state, "remainingTimes", 3);

      let res: FullBattleAction = {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: source.uuid,
      };

      return res;
    },
    onBeforeTakeDamage: ({ reducedDamage, self, state, battleInfo, callbacks }) => {
      if (reducedDamage <= 0) {
        return reducedDamage;
      }

      let remainingDuration =
        readStateExtraInfo<number>(state, "remainingTimes") ?? 0;

      if (remainingDuration > 0) {
        remainingDuration -= 1;
        writeStateExtraInfo(state, "remainingTimes", remainingDuration);
      }

      if (remainingDuration <= 0) {
        // @ts-ignore
        detachState("boneShield", self, battleInfo, {
          callbacks
        });
      }

      return 1;
    },
    onDetach: ({ self }) => {
      // 建议在角色属性刷新时处理防御加成

      if (!self.state?.boneShield) {
        return;
      }

      writeStateExtraInfo(self.state.boneShield, "remainingTimes", 0);

      let value = self?.state?.boneShield?.extra?.thisStateActuralValue ?? 8;
      self.status.defencing.level -= value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  corrosiveBreath: {
    id: "corrosiveBreath",
    name: "腐蚀吐息",
    description: "防御-6，持续3回合",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target }) => {
      if (target) {
        target.status.defencing.level = target.status.defencing.level - 6;

        return {
          type: "state",
          damage: {},
          heal: {},
          targetUnitUuidList: [target.uuid],
          sourceUnitUuid: source.uuid,
        };
      }
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: source.uuid,
      };
    },
    onDetach: ({ self }) => {
      self.status.defencing.level = self.status.defencing.level + 6;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  frozen: {
    id: "frozen",
    name: "冻结",
    description: "该单位无法行动",
    duration: 1,
    isBuff: false,
    isDebuff: true,
    consumeTurn: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect: ({ self, battleInfo }) => {
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
    onAttach: () => {},
    onDetach: () => {},
  },

  stun: {
    id: "stun",
    name: "眩晕",
    description: "无法行动，跳过本回合",
    duration: 1,
    isBuff: false,
    isDebuff: true,
    consumeTurn: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect: ({ self }) => {
      // 眩晕时直接跳过本回合，无需额外处理
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
    onAttach: () => {},
    onDetach: () => {},
  },

  fluster: {
    id: "fluster",
    name: "慌乱",
    description: "行动不分敌我。\n慌乱状态下的单位不受嘲讽影响",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onAttach: () => {},
    onDetach: () => {},
  },

  confusion: {
    id: "confusion",
    name: "混淆",
    description: "你已经晕了，把敌人视为友军，把友军视为敌人。",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onAttach: () => {},
    onDetach: () => {},
  },

  proof: {
    id: "proof",
    name: "辟邪",
    description: "这个单位无法被敌人施加状态。",
    permanent: false,
    unremovable: true,
    duration: 999,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeGetState({source, self, battleInfo, duration, callbacks}) {
      if (!battleInfo) {
        return {
          cancel: true,
          duration,
        }
      }

      if (isAlly(source.uuid, self.uuid, battleInfo)) {
        return;
      }

      callbacks?.floatTextCallback({
        unit: self,
        text: "辟邪",
      })

      return {
        cancel: true,
        duration,
      }
    }
  },

  proof2: {
    id: "proof2",
    name: "帷幕",
    description: "这个单位无法被其他单位施加状态。",
    permanent: false,
    duration: 5,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeGetState({self, battleInfo, duration, callbacks}) {
      callbacks?.floatTextCallback({
        unit: self,
        text: "帷幕",
      })

      return {
        cancel: true,
        duration,
      }
    }
  },

  proof3: {
    id: "proof3",
    name: "幽障",
    description: "这个单位无法从其他单位处获得状态。",
    permanent: true,
    duration: 5,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onAttach: ({target, battleInfo, callbacks}) => {
      if (!target) {
        return;
      }

      const neededDetachStateList: AllBattleStateId[] = []
      for(const stateId of ObjectKeysTyped(target?.state ?? {})) {
        const state = target?.state?.[stateId]
        if (!state) {
          continue;
        }

        if (state.addBy != target.uuid) {
          neededDetachStateList.push(stateId)
        }
      }

      for(const stateId of neededDetachStateList) {
        detachState(stateId, target, battleInfo, {
          callbacks: callbacks!,
        })
      }
    },
    onBeforeGetState({source, self, battleInfo, duration, callbacks}) {
      if (source.uuid !== self.uuid) {
        callbacks?.floatTextCallback({
          unit: self,
          text: "幽障",
        })

        return {
          cancel: true,
          duration,
        }
      }
    }
  },

  taunt: {
    id: "taunt",
    name: "嘲讽",
    description: "当回合内的行动需要选择敌人作为目标时，优先选择嘲讽来源。",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    onAttach: () => {},
    onDetach: () => {},
  },

  ironWall: {
    id: "ironWall",
    name: "铁壁",
    description:
      "防御力提升(5 + 耐力*60% + 技能等级*1）”，持续3回合。期间受到的所有降低30%持续2回合",
    duration: 2,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source }) => {
      let state = source.state?.ironWall;
      if (!state) {
        return;
      }

      // 建议在角色属性刷新时处理防御加成
      source.status.defencing.level += state.extra?.thisStateActuralValue ?? 5;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [source.uuid],
        sourceUnitUuid: source.uuid,
      };
    },
    onBeforeTakeDamage({ reducedDamage }) {
      return Math.round(reducedDamage * 0.7);
    },
    onDetach: ({ self }) => {
      let state = self.state?.ironWall;
      if (!state) {
        return;
      }

      // 建议在角色属性刷新时处理防御加成
      self.status.defencing.level -= state.extra?.thisStateActuralValue ?? 5;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  dragonRoarDebuff: {
    id: "dragonRoarDebuff",
    name: "龙之咆哮",
    description: "攻击、防御-8，持续1回合",
    duration: 1,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target }) => {
      if (target) {
        let value =
          target.state?.dragonRoarDebuff?.extra?.thisStateActuralValue ?? 8;

        target.status.attacking.level = target.status.attacking.level - value;
        target.status.defencing.level = target.status.defencing.level - value;

        return {
          type: "state",
          damage: {},
          heal: {},
          targetUnitUuidList: [target.uuid],
          sourceUnitUuid: source.uuid,
        };
      }
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: source.uuid,
      };
    },
    onDetach: ({ self }) => {
      let value =
        self.state?.dragonRoarDebuff?.extra?.thisStateActuralValue ?? 8;

      self.status.attacking.level = self.status.attacking.level + value;
      self.status.defencing.level = self.status.defencing.level + value;
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  curse: {
    id: "curse",
    name: "诅咒",
    description: "攻击、防御被降低，持续3回合",
    duration: 3,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target }) => {
      if (!target) {
        return {
          type: "state",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: source.uuid,
        };
      }

      let state = target.state?.curse;
      if (!state) {
        return;
      }

      let value = state.extra?.thisStateActuralValue ?? 6;
      target.status.attacking.level = target.status.attacking.level - value;
      target.status.defencing.level = target.status.defencing.level - value;

      let res: FullBattleAction = {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: source.uuid,
      };

      return res;
    },
    onDetach: ({ self }) => {
      let state = self.state?.curse;
      if (!state) {
        return;
      }
      let value = state.extra?.thisStateActuralValue ?? 6;
      self.status.attacking.level = self.status.attacking.level + value;
      self.status.defencing.level = self.status.defencing.level + value;

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  batCurse: {
    id: "batCurse",
    name: "蝙蝠诅咒",
    description:
      "攻击、防御-10，持续2回合。受到任意伤害时，降低7点最大生命值。",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target }) => {
      if (target) {
        target.status.attacking.level = target.status.attacking.level - 10;
        target.status.defencing.level = target.status.defencing.level - 10;

        return {
          type: "state",
          damage: {},
          heal: {},
          targetUnitUuidList: [target.uuid],
          sourceUnitUuid: source.uuid,
        };
      }
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: source.uuid,
      };
    },
    onDetach: ({ self }) => {
      self.status.attacking.level = self.status.attacking.level + 10;
      self.status.defencing.level = self.status.defencing.level + 10;
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
    afterTakeDamage: (opt) => {
      const { damageSource, self } = opt;
      self.maxHp -= 7;
      self.hp -= 7;

      self.maxHp = Math.max(1, self.maxHp);
      self.hp = Math.max(0, self.hp);
    },
  },

  bless: {
    id: "bless",
    name: "祝福",
    description: "攻击与防御提升6 + 智力(20 + 技能等级*1)%，持续3回合",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      // 取技能传递的buff值
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 6;
      target!.status.attacking.level += value;
      target!.status.defencing.level += value;
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: source.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      // 取技能传递的buff值
      const state = thisState;
      const value = state!.extra!.thisStateActuralValue ?? 6;
      self.status.attacking.level -= value;
      self.status.defencing.level -= value;
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  regen: {
    id: "regen",
    name: "再生",
    description:
      "每回合开始时，回复(10 + 智力(35 + 技能等级*2.5)%)点生命值，持续3回合",
    duration: 3,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect: ({ self }) => {
      // 取技能传递的数值
      const state = self.state!.regen! as BattleStateInBattle;
      const value = state?.extra?.thisStateActuralValue ?? 10;
      const heal = Math.max(1, value);
      self.hp += heal;
      if (self.hp > self.maxHp) self.hp = self.maxHp;
      return {
        type: "state",
        damage: {},
        heal: { [self.uuid]: heal },
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: state?.addBy ?? self.uuid,
      };
    },
    onAttach: () => {},
    onDetach: () => {},
  },

  tmpUnit: {
    id: "tmpUnit",
    name: "召唤单位",
    description: "在此状态消失时，该召唤单位将会离开战斗",
    duration: 3,
    consumeTurn: false,
    isDebuff: true,
    isBuff: true,
    unremovable: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_END,
    onAttach: () => {},
    onDetach: () => {},
  },

  irrevocable: {
    id: "irrevocable",
    name: "不可复活",
    description: "这个单位无法被复活",
    duration: 99,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    forbidCastSkill: true,
    forbidRevive: true,
    unremovable: true,
    permanent: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
  },

  silence: {
    id: "silence",
    name: "沉默",
    description: "无法释放任何技能，持续2回合",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    forbidCastSkill: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ target }) => {
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self }) => {
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  silenceB: {
    id: "silenceB",
    name: "沉默",
    description: "无法释放任何技能，持续2回合",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    forbidCastSkill: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ target }) => {
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: target!.uuid,
      };
    },
    onDetach: ({ self }) => {
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },


  lastWord: {
    id: "lastWord",
    name: "遗言",
    description: "释放任意技能后被沉默，持续2回合",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    afterCastSkill: async ({ self, battleInfo, callbacks }) => {
      await addState("silence", 2, self, self, {}, {
        battleInfo,
        callbacks
      });
      detachState("lastWord", self, battleInfo, {
        callbacks
      });
    },
  },

  astralBarrier: {
    id: "astralBarrier",
    name: "星辉结界",
    description:
      "防御力提升（+10 + 智力50% + 技能等级*1），持续3回合。\n仅一次，受到超过最大生命值30%的伤害时，使此伤害降低至0",
    duration: 2,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target }) => {
      // 取技能传递的buff值
      const state = target!.state!.astralBarrier;
      const value = state!.extra!.thisStateActuralValue ?? 10;
      target!.status.defencing.level += value;

      writeStateExtraInfo(state!, "remainingTimes", 1);

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [target!.uuid],
        sourceUnitUuid: source.uuid,
      };
    },
    onBeforeTakeDamage({ self, reducedDamage }) {
      let remainingTimes =
        readStateExtraInfo<number>(
          self.state!.astralBarrier!,
          "remainingTimes"
        ) ?? 0;
      if (reducedDamage >= self.maxHp * 0.3 && remainingTimes > 0) {
        writeStateExtraInfo(self.state!.astralBarrier!, "remainingTimes", 0);

        return 0;
      }

      return reducedDamage;
    },
    onDetach: ({ self }) => {
      // 取技能传递的buff值
      const state = self!.state!.astralBarrier;
      const value = state!.extra!.thisStateActuralValue ?? 10;
      self.status.defencing.level -= value;
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  armorBreak: {
    id: "armorBreak",
    name: "破甲",
    description: "防御-30%，持续2回合",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (target) {
        target.status.defencing.level -=
          thisState?.extra?.thisStateActuralValue ?? 8;
        return {
          type: "state",
          damage: {},
          heal: {},
          targetUnitUuidList: [target.uuid],
          sourceUnitUuid: source.uuid,
        };
      }
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: source.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      self.status.defencing.level +=
        thisState?.extra?.thisStateActuralValue ?? 8;
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  demonicRage: {
    id: "demonicRage",
    name: "恶魔狂怒",
    description: "攻击力获得提升，防御力降低至0，持续4回合",
    duration: 4,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target }) => {
      if (!target) {
        return;
      }

      const attack = target.state?.demonicRage?.extra?.thisStateActuralValue ?? 0;
      const value = target.state?.demonicRage?.extra?.reduceDefence ?? 0;

      target.status.attacking.level += attack;
      target.status.defencing.level -= value;
    },
    onDetach: ({ self }) => {
      const attack = self.state?.demonicRage?.extra?.thisStateActuralValue ?? 0;
      const value = self.state?.demonicRage?.extra?.reduceDefence ?? 0;

      self.status.attacking.level -= attack;
      self.status.defencing.level += value;
    },
  },

  despair: {
    id: "despair",
    name: "绝望",
    description: "每回合开始时损失5%最大生命值，持续3回合",
    duration: 3,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect: async ({ self, battleInfo, dealDamageCallback }) => {
      if (!self || !self.hp) return;

      if (battleInfo.worldBossId) {
        return;
      }

      let addBy = self.state?.despair?.addBy;
      let addByUnit = battleInfo.members.find((unit) => unit.uuid === addBy);

      const maxHp = self.maxHp;
      const lostHp = Math.floor(maxHp * 0.05);

      await dealDamage(addByUnit ?? self, self, lostHp, {
        damageType: DamageType.Magical,
        dealDamageCallback,
        ignoreTrigger: true,
        battleInfo,
      });

      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  // todo
  painAmplified: {
    id: "painAmplified",
    name: "痛苦放大",
    description: "每次受到伤害时额外受到20%当前生命值的伤害",
    duration: 3,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.AFTER_TAKE_DAMAGE,
    // afterTakeDamage: ({ self, damageSource, }) => {
    //   const extraDamage = Math.floor(self.hp * 0.2);

    //   let addBy: string = self.state?.painAmplified?.addBy ?? self.uuid;
    //   // let addByUnit = battleInfo.members.find((unit) => unit.uuid === addBy);

    //   dealDamage(self, self, extraDamage, {
    //     damageType: DamageType.Magical,
    //     battleInfo,
    //     ignoreTrigger: true,
    //   });

    //   return {
    //     type: "state",
    //     damage: { [self.uuid]: extraDamage },
    //     heal: {},
    //     targetUnitUuidList: [self.uuid],
    //     sourceUnitUuid: addBy,
    //   };
    // },
    onAttach: () => {},
    onDetach: () => {},
  },

  echoShieldBashState: {
    id: "echoShieldBashState",
    name: "黑岩守护",
    description: "受到的伤害降低-50%，持续2回合",
    duration: 2,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onBeforeTakeDamage({reducedDamage}) {
      return Math.floor(reducedDamage * 0.5);
    }
  },

  boneBreakerState: {
    id: "boneBreakerState",
    name: "碎骨重击",
    description: "防御-50%，持续2回合",
    duration: 2,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onAttach: ({ source, target, thisState }) => {
      if (target) {
        target.status.defencing.level -=
          thisState?.extra?.thisStateActuralValue ?? 8;
        return {
          type: "state",
          damage: {},
          heal: {},
          targetUnitUuidList: [target.uuid],
          sourceUnitUuid: source.uuid,
        };
      }
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: source.uuid,
      };
    },
    onDetach: ({ self, thisState }) => {
      self.status.defencing.level +=
        thisState?.extra?.thisStateActuralValue ?? 8;
      return {
        type: "state",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  blinkshadowGirdleDamageReduce: {
    id: "blinkshadowGirdleDamageReduce",
    name: "瞬影",
    description: "瞬影期间造成的伤害降低",
    duration: 2,
    isBuff: false,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.ON_ATTACH,
    onNeedModifyOriginDamage({oriDamage, state}) {
      const reducePercent = (state.extra?.thisStateActuralValue ?? 0.5)

      return oriDamage * -reducePercent;
    }
  },

  lumenCodexLock: {
    id: "lumenCodexLock",
    name: "祝福回响",
    description: "祝福回响",
    duration: 2,
    isBuff: false,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
  },
  umbralCodexLock: {
    id: "umbralCodexLock",
    name: "诅咒回响",
    description: "诅咒回响",
    duration: 2,
    isBuff: false,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
  },

  darkingCuteSwordLock: {
    id: "darkingCuteSwordLock",
    name: "不开心",
    description: "黑化猫猫剑-不开心",
    duration: 2,
    isBuff: false,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
  },

  riposteAmuletLock: {
    id: "riposteAmuletLock",
    name: "反击护符",
    description: "反击护符生效中",
    duration: 2,
    isBuff: false,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
  },

  worldBossState: {
    id: "worldBossState",
    name: "“麻烦”",
    description: "生命值降低至50%时，降低10%受到的伤害。\n生命值降低值至20%时，降低20%受到的伤害。\n单次受到的治疗效果不会超过10000\n单次受到的伤害效果不会超过1000000\n这个单位释放技能时不会被打断",
    duration: 999,
    permanent: true,
    unremovable: true,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    forbidCancelSkillCast: true,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({ self, reducedDamage }) {
      const hpPercent = self.hp / self.maxHp;

      let res = reducedDamage;

      if (hpPercent <= 0.2) {
        res = Math.floor(reducedDamage * 0.2);
      } else if (hpPercent <= 0.5) {
        res = Math.floor(reducedDamage * 0.1);
      }

      if (res > 500000000) {
        return 500000000;
      }

      return res;
    },
    onBeforeTakeHeal({ self, finalHeal }) {
      if (finalHeal > 10000) {
        return 10000;
      }

      return finalHeal
    }
  },

  ...catDungeon002State,

  ...allFoodState,
  ...allEquipmentState,
  ...allGuildBuildingState,
  ...allBattleAreaState,
  ...allPotionState,
  ...allUnitInitState,
  ...allPactState,
  ...allWorldBossState,
} as const satisfies Record<string, BattleState>;

export const reduceStateStack = (stateId: keyof typeof allBattleState, self: BaseBattleUnit, reduceCount: number, battleInfo?: BattleInfo, opt?: {
  callbacks?: BattleCallback | null
}) => {
  if (!self || !self.state || !self.state[stateId]) {
    return
  }

  let stateInfo = allBattleState[stateId] as BattleState | undefined;

  if (!stateInfo || !stateInfo?.stackable) {
    return
  } 

  let thisState = self.state[stateId]
  let currentStack = getStateExtraStack(thisState)

  if (!currentStack) {
    return
  }

  reduceCount = Math.min(currentStack, reduceCount);

  decreaseStateExtraStack(thisState, reduceCount);

  if (stateInfo) {
    stateInfo.onReduceStack?.({
      self,
      source: self,
      target: self,
      enemies: [],
      battleInfo,
      thisState,
      callbacks: opt?.callbacks,
      reduceCount
    })
  }
}

export const detachState = (stateId: keyof typeof allBattleState, self: BaseBattleUnit, battleInfo: BattleInfo, opt: {
  callbacks: BattleCallback | null;
  invalidateUnitHookCache?: (unit: BaseBattleUnit) => void;
}) => {
  if (!self || !self.state || !self.state[stateId]) {
    return
  }

  let stateInfo = allBattleState[stateId] as BattleState | undefined;

  if (stateInfo) {
    stateInfo.onDetach?.({
      self,
      target: self,
      battleInfo,
      thisState: self.state[stateId],
      callbacks: opt.callbacks
    })
  }

  const container = self.state!;
  delete container[stateId];

  // 如果容器已空，释放引用，避免在后续战斗复用时携带空 state 占用
  if (Object.keys(container).length === 0) {
    delete self.state;
  }
  opt.invalidateUnitHookCache?.(self);
}

export const detachRandomDebuff = (self: BaseBattleUnit, battleInfo: BattleInfo, opt: {
  callbacks: BattleCallback | null;
  invalidateUnitHookCache?: (unit: BaseBattleUnit) => void;
}) => {
  if (!self || !self.state) {
    return
  }

  const negativeStates = ObjectKeys<AllBattleStateId>(
    self.state
  ).filter((sid) => {
    const state = allBattleState[sid] as BattleState;

    return (
      state.isDebuff &&
      !state.unremovable &&
      !state.permanent &&
      sid != "tmpUnit"
    );
  });

  if (negativeStates.length > 0) {
    const randomStateId = randomElementInCollection(negativeStates);
    if (randomStateId) {
      detachState(randomStateId, self, battleInfo, {
        callbacks: opt.callbacks,
        invalidateUnitHookCache: opt.invalidateUnitHookCache,
      });
    }
  }
}

export const detachRandomBuff = (self: BaseBattleUnit, battleInfo: BattleInfo, opt: {
  callbacks: BattleCallback | null;
  invalidateUnitHookCache?: (unit: BaseBattleUnit) => void;
}) => {
  if (!self || !self.state) {
    return
  }

  const negativeStates = ObjectKeys<AllBattleStateId>(
    self.state
  ).filter((sid) => {
    const state = allBattleState[sid] as BattleState;

    return (
      state.isBuff &&
      !state.unremovable &&
      !state.permanent &&
      sid != "tmpUnit"
    );
  });

  if (negativeStates.length > 0) {
    const randomStateId = randomElementInCollection(negativeStates);
    if (randomStateId) {
      detachState(randomStateId, self, battleInfo, {
        callbacks: opt.callbacks,
        invalidateUnitHookCache: opt.invalidateUnitHookCache,
      });
    }
  }
}

export const writeStateExtraInfo = (state: BattleStateInBattle, key: string, value: any) => {
  if (!state) {
    return
  }
  if (!state.extra) {
    state.extra = {};
  }

  state.extra[key] = value;
}
export const readStateExtraInfo = <T>(state: BattleStateInBattle, key: string): T | null => {
  if (!state || !state.extra) {
    return null;
  }
  return state.extra[key];
}

export const getStateExtraStack = (state?: BattleStateInBattle): number => {
  if (!state || !state.extra) {
    return 0;
  }

  if (!state.extra.stack) {
    return 0;
  }

  if (typeof state.extra.stack === "number") {
    return state.extra.stack;
  }

  return +state.extra.stack;
}

export const checkAlreadyReachMaxStateExtraStack = (stateId: AllBattleStateId, unit: BaseBattleUnit, battleInfo: BattleInfo): boolean => {
  const state = unit.state ? unit.state[stateId] : null;

  if (!state) {
    return false;
  }
  if (!state || !state.extra) {
    return false;
  }

  if (!state.extra.stack) {
    return false;
  }

  const maxStack = getUnitStateMaxExtraStack(stateId, unit, battleInfo);

  return state.extra.stack >= maxStack;
}

export const getUnitStateMaxExtraStack = (stateId: AllBattleStateId, unit: BaseBattleUnit, battleInfo: BattleInfo): number => {
  let stateConf = allBattleState[stateId] as BattleState;

  if (!stateConf.stackable) {
    return 0;
  }

  let base = stateConf.maxStack ?? 1;

  let extra = 0;

  iteratorUnitEquipment(unit, ({equipmentTrigger, equipmentId}) => {
    let res = equipmentTrigger?.onModifyStateMaxStack?.({
      targetStateId: stateId,
      equipmentId,

      self: unit,
      battleInfo,

      oriMaxStack: base,
    })

    if (res) {
      extra += res.extra
    }
  }, {requiredHook: 'onModifyStateMaxStack'})

  return base + extra;
}


export const increaseStateExtraStack = (stateId: AllBattleStateId, unit: BaseBattleUnit, stack: number, opt: {
  battleInfo: BattleInfo
}): number => {
  const state = unit.state ? unit.state[stateId] : null;

  if (!state) {
    return 0;
  }
  if (!state || !state.extra) {
    state.extra = {};
  }

  if (!state.extra.stack) {
    state.extra.stack = 0;
  }

  const maxStack = getUnitStateMaxExtraStack(stateId, unit, opt.battleInfo)

  state.extra.stack += stack;

  if (state.extra.stack > maxStack) {
    state.extra.stack = maxStack;
  }

  return state.extra.stack;
}

export const decreaseStateExtraStack = (state: BattleStateInBattle, stack: number): number => {
  if (!state) {
    return 0;
  }
  if (!state || !state.extra) {
    state.extra = {};
  }

  if (!state.extra.stack) {
    state.extra.stack = 0;
  }

  state.extra.stack -= stack;

  if (state.extra.stack < 0) {
    state.extra.stack = 0;
  }

  return state.extra.stack;
}

export const resetStateExtraStack = (state: BattleStateInBattle) => {
  if (!state || !state.extra) {
    return
  }

  state.extra.stack = 0;
}

export const allGameBattleStateIds = Object.keys(allBattleState) as (keyof typeof allBattleState)[]