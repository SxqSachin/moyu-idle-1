import { DealDamageCauseByType } from "~/shared/types/battle";
import { StateEffectTriggerWhen, type AllBattleStateId, type BattleState } from "~/shared/types/BattleState";
import { dealAoeDamage, dealDamage, getRandomUnitInCollection, getRandomUnitsInCollection, isEnemy, isAlly, healUnit, restoreMp, summonUnit, addState, castSkill } from "~/server/utils/game/battleAction";
import { DamageType } from "~/shared/types/skill";
import { findUnitInBattle, getEnemyUnitsByUnit, pushUnitTurnOrder } from "~/shared/utils/game/battle";
import { ObjectKeys, randomElementInCollection } from "~/shared/utils";
import { allBattleState, detachRandomBuff, detachRandomDebuff, detachState } from "../allBattleState";

export const catDungeon002State = {
  echoResonanceState: {
    id: "echoResonanceState",
    name: "回响共振",
    description:
      "任意敌人消耗魔法时，你对其造成消耗魔法值200%无视防御的魔法伤害",
    duration: 80,
    permanent: true,
    unremovable: true,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    async afterOtherUnitLossMp({ self, target, value, battleInfo, callbacks }) {
      if (!isEnemy(self.uuid, target.uuid, battleInfo)) {
        return;
      }

      const damage = Math.floor(value * 2);

      callbacks.floatTextCallback({
        unit: self,
        text: "回响共振",
      });

      await dealDamage(self, target, damage, {
        damageType: DamageType.Magical,
        causeBy: {
          type: DealDamageCauseByType.State,
          state: "echoResonanceState",
        },
        ignoreDefence: true,
        battleInfo,
        callbacks,
      });
    },
  },
  resonancePassive: {
    id: "resonancePassive",
    name: "物理共振",
    description:
      "受到的物理伤害降低60%。\n并对伤害来源造成原伤害10%的物理伤害，此伤害不触发被动效果。",
    duration: 80,
    permanent: true,
    unremovable: true,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onBeforeTakeDamage({ damageType, reducedDamage }) {
      if (damageType === DamageType.Physical) {
        return Math.floor(reducedDamage * 0.4);
      }
      return reducedDamage;
    },
    async afterTakeDamage({
      self,
      damageSource,
      oriDamage,
      damageType,
      battleInfo,
      callbacks,
    }) {
      if (damageType != DamageType.Physical || !battleInfo || !callbacks) {
        return;
      }

      if (isAlly(self.uuid, damageSource.uuid, battleInfo)) {
        return;
      }

      const reflectDamage = Math.floor(oriDamage * 0.1);

      callbacks.floatTextCallback({
        unit: self,
        text: "物理共振",
      });

      await dealDamage(self, damageSource, reflectDamage, {
        causeBy: {
          type: DealDamageCauseByType.State,
          state: "resonancePassive",
        },
        damageType: DamageType.Physical,
        callbacks: callbacks,
        battleInfo,
        ignoreTrigger: true,
      });
    },
  },
  chargeRendState: {
    id: "chargeRendState",
    name: "破阵冲锋",
    description:
      "战斗开始时，对一个随机敌人造成攻击力125%的伤害，并使此敌人的行动顺序向后移动一轮",
    duration: 80,
    permanent: true,
    unremovable: true,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    async onBattleStart({ self, battleInfo, callbacks }) {
      const enemies = getEnemyUnitsByUnit(battleInfo, self).filter(
        (enemy) => enemy.hp > 0
      );

      const randomEnemies = getRandomUnitInCollection(enemies);

      if (!randomEnemies) {
        return;
      }

      callbacks.floatTextCallback({
        unit: self,
        text: "破阵冲锋",
      });

      await dealDamage(
        self,
        randomEnemies,
        Math.floor(self.status.attacking.level * 1.25),
        {
          damageType: DamageType.Physical,
          causeBy: {
            type: DealDamageCauseByType.State,
            state: "chargeRendState",
          },
          callbacks: callbacks,
          battleInfo,
        }
      );

     await addState(
        "bleeding",
        5,
        self,
        randomEnemies,
        {},
        {
          extraStack: 5,
          battleInfo,
          callbacks,
        }
      );

      pushUnitTurnOrder(battleInfo, randomEnemies.uuid, 1); // 将目标的行动顺序向后移动1轮
    },
  },

  cdhbFormShift: {
    id: "cdhbFormShift",
    name: "无相形态",
    description:
      "造成的伤害降低30%\n当你受到物理伤害时，你后续受到的物理伤害降低为0，直到受到一次魔法伤害为止。\n当你受到魔法伤害时，你后续受到的魔法伤害降低为0，直到受到一次物理伤害为止。\n因此效果使伤害降低为0时，驱散1个自身的负面状态。",
    duration: 80,
    permanent: true,
    unremovable: true,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onNeedModifyOriginDamage({ oriDamage, }) {
      return Math.floor(oriDamage * 0.7);
    },
    async onBeforeTakeDamage({ self, damageType, reducedDamage, battleInfo, callbacks }) {
      // Toggle-style immunity:
      // - After you take Physical damage once, subsequent Physical damage becomes 0 until you take one Magical hit.
      // - After you take Magical damage once, subsequent Magical damage becomes 0 until you take one Physical hit.
      // State is stored in triggerMark.cleanWhenBattleStart so it resets each battle automatically.
      if (!self.triggerMark) self.triggerMark = {};
      if (!self.triggerMark.cleanWhenBattleStart)
        self.triggerMark.cleanWhenBattleStart = {};

      const physKey = "cdhbFormShift_PhysicalLock";
      const magKey = "cdhbFormShift_MagicalLock";
      const physLock = !!self.triggerMark.cleanWhenBattleStart[physKey];
      const magLock = !!self.triggerMark.cleanWhenBattleStart[magKey];

      if (damageType === DamageType.Physical) {
        // If already locking Physical, nullify this damage; else enable Physical lock and disable Magical lock.
        if (physLock) {
          detachRandomDebuff(self, battleInfo, {
            callbacks
          })

          callbacks.floatTextCallback({
            unit: self,
            text: "无相形态（物理免疫）",
          });

          return 0;
        }
        self.triggerMark.cleanWhenBattleStart[physKey] = true;
        self.triggerMark.cleanWhenBattleStart[magKey] = false;

       await addState("cdhbFormShift_P", 80, self, self, {}, {
          battleInfo,
          callbacks
        });
        detachState("cdhbFormShift_M", self, battleInfo, {
          callbacks
        });

        return reducedDamage;
      }

      if (damageType === DamageType.Magical) {
        if (magLock) {
          detachRandomDebuff(self, battleInfo, {
            callbacks
          })

          callbacks.floatTextCallback({
            unit: self,
            text: "无相形态（魔法免疫）",
          });

          return 0;
        }
        self.triggerMark.cleanWhenBattleStart[magKey] = true;
        self.triggerMark.cleanWhenBattleStart[physKey] = false;

       await addState("cdhbFormShift_M", 80, self, self, {}, {
          battleInfo,
          callbacks
        });
        detachState("cdhbFormShift_P", self, battleInfo, {
          callbacks
        });

        return reducedDamage;
      }

      // Other damage types are not affected.
      return reducedDamage;
    },
  },

  cdhbFormShift_P: {
    id: "cdhbFormShift_P",
    name: "无相形态（物理免疫）",
    description:
      "受到的物理伤害降低为0，直到受到一次魔法伤害为止。\n因此效果使伤害降低为0时，驱散1个自身的负面状态。",
    duration: 80,
    permanent: true,
    unremovable: true,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
  },
  cdhbFormShift_M: {
    id: "cdhbFormShift_M",
    name: "无相形态（魔法免疫）",
    description:
      "受到的魔法伤害降低为0，直到受到一次物理伤害为止。\n因此效果使伤害降低为0时，驱散1个自身的负面状态。",
    duration: 80,
    permanent: true,
    unremovable: true,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
  },

  qeDirgeCataclysmState: {
    id: "qeDirgeCataclysmState",
    name: "寂鸣灾谣",
    description:
      "回合结束时，此单位的生命值变为1。\n造成魔法伤害后解除此效果。",
    duration: 80,
    permanent: false,
    unremovable: true,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_END,
    effect({self, battleInfo, callbacks}) {
      self.hp = Math.min(self.hp, 1);

      detachState("qeDirgeCataclysmState", self, battleInfo, {
        callbacks
      })
    },
    afterDealDamage({self, damageType, battleInfo, callbacks}) {
      if (damageType === DamageType.Magical) {
        detachState("qeDirgeCataclysmState", self, battleInfo, {
          callbacks
        })
      }
    }
  },
  bcCourtTithe: {
    id: "bcCourtTithe",
    name: "影廷徵税",
    description:
      "你的回合开始时，驱散每个敌人身上的1个可被移除的正面状态。\n对你造成伤害的单位获得“罪印”，持续5回合。",
    duration: 80,
    permanent: true,
    unremovable: true,
    isBuff: true,
    isDebuff: false,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.TURN_START,
    effect({self, enemies, battleInfo, callbacks}) {
      callbacks.floatTextCallback({
        unit: self,
        text: "无相形态",
      });
      for (const enemy of enemies) {
        detachRandomBuff(enemy, battleInfo, {
          callbacks
        })
      }
    },
    async onBeforeTakeDamage({self, damageSource, reducedDamage, battleInfo, callbacks}) {
      await addState("bcCourtTitheDamageState", 5, self, damageSource, {}, {
        battleInfo,
        callbacks
      })

      return reducedDamage
    }
  },
  bcCourtTitheDamageState: {
    id: "bcCourtTitheDamageState",
    name: "罪印",
    description:
      "回合开始时，受到状态来源100%攻击力的伤害。\n造成的伤害增加50%，对状态来源造成的伤害降低70%。\n自身流失造成伤害100%的生命值（不会使生命值低于1点）。\n受到任意其他角色的治疗效果后，解除此状态。",
    duration: 5,
    permanent: false,
    unremovable: false,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    onNeedModifyOriginDamage({ oriDamage, target, state }) {
      if (target.uuid === state?.addBy) {
        return -Math.floor(oriDamage * 0.7);
      }
      return Math.floor(oriDamage * 0.5);
    },
    afterDealDamage({ self, reducedDamage, }) {
      const hpLoss = Math.floor(reducedDamage);
      self.hp = Math.max(self.hp - hpLoss, 1);
    },
    async effect({ self, thisState, battleInfo, callbacks }) {
      if (!thisState?.addBy) {
        return;
      }

      const damageSource = findUnitInBattle(battleInfo, thisState.addBy);

      if (!damageSource) {
        return;
      }

      callbacks.floatTextCallback({
        unit: self,
        text: "罪印",
      });

      await dealDamage(damageSource, self, Math.floor(damageSource.status.attacking.level), {
        damageType: DamageType.Physical,
        causeBy: {
          type: DealDamageCauseByType.State,
          state: "bcCourtTitheDamageState",
        },
        battleInfo,
        callbacks,
      })
    },
    afterTakeHeal({ self, source, battleInfo, callbacks }) {
      if (source.uuid && self.uuid && source.uuid === self.uuid) {
        return;
      }

      detachState("bcCourtTitheDamageState", self, battleInfo, {
        callbacks
      })
    }
  },
  hexstringBowState: {
    id: "hexstringBowState",
    name: "咒缚",
    description:
      "释放技能后，自身受到已损失魔法值100%的魔法伤害，无视防御。",
    duration: 5,
    permanent: false,
    unremovable: false,
    isBuff: false,
    isDebuff: true,
    consumeTurn: false,
    StateEffectTriggerWhen: StateEffectTriggerWhen.MANUAL,
    async afterCastSkill({ self, battleInfo, callbacks }) {
      const mpLoss = self.maxMp - self.mp;

      if (mpLoss <= 0) {
        return;
      }

      callbacks.floatTextCallback({
        unit: self,
        text: "咒缚",
      });

      await dealDamage(self, self, mpLoss, {
        damageType: DamageType.Magical,
        causeBy: {
          type: DealDamageCauseByType.State,
          state: "hexstringBowState",
        },
        ignoreDefence: true,
        battleInfo,
        callbacks,
      });
    }
  }
} as const satisfies Record<string, BattleState>;