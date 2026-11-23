import { DealDamageCauseByType, HpRestoreReason, MpLossReason, MpRestoreReason } from "~/shared/types/battle";
import { dealAoeDamage, dealDamage, getRandomUnitInCollection, getRandomUnitsInCollection, healUnit, lossMp, restoreMp, summonUnit, addState, castSkill } from "~/server/utils/game/battleAction";
import { DamageType, SkillType, type GameBattleSkill } from "~/shared/types/skill";
import { generateEnemyById, generateUnitById } from "~/server/utils/game/enemy";
import { delay } from "~/shared/utils";
import { getAvailableUnitCollection, hasState, } from "~/shared/utils/game/battle";

export const catDungeon002SkillData = {
  echoShieldBash: {
    id: "echoShieldBash",
    name: "黑岩盾击",
    target: "single_enemy",
    targetCount: 1,
    colddown: 2,
    mpCost: 10,
    effectStr:
      "对一个当前攻击力最高的敌人造成自身防御(300 + 技能等级*10)%的伤害，并嘲讽其2回合。\n你获得“黑岩守护”，持续2回合。",
    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],
    effect: async ({ self, enemies, allies, battleInfo, callbacks, thisSkill }) => {
      const targets = getAvailableUnitCollection(enemies);

      if (targets.length === 0) {
        return;
      }

      const enemyWithHighestATK = targets.reduce((prev, curr) => {
        return curr.status.attacking.level > prev.status.attacking.level
          ? curr
          : prev;
      });

      const damageVal =
        self.status.defencing.level * (3 + thisSkill!.level * 0.1);

      const damage = await dealDamage(self, enemyWithHighestATK, damageVal, {
        damageType: DamageType.Physical,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: "echoShieldBash",
        },
        callbacks,
        battleInfo,
      });

     await addState(
        "taunt",
        2,
        self,
        enemyWithHighestATK,
        {},
        {
          battleInfo,
          callbacks,
        }
      );

     await addState(
        "echoShieldBashState",
        2,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
        }
      );

      return {
        type: "skill",
        damage: {
          [enemyWithHighestATK.uuid]: damage,
        },
        heal: {},
        castSkillId: "echoShieldBash",
        targetUnitUuidList: [enemyWithHighestATK.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  // 碎骨重击
  boneBreaker: {
    id: "boneBreaker",
    name: "碎骨重击",
    target: "single_enemy",
    targetCount: 1,
    colddown: 4,
    mpCost: 18,
    effectStr:
      "对防御力最高的敌人造成力量(300 + 技能等级*10)%的伤害，并使其防御力降低50%，持续2回合。",
    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],
    effect: async ({ self, enemies, allies, battleInfo, callbacks, thisSkill }) => {
      const targets = getAvailableUnitCollection(enemies);

      if (targets.length === 0) {
        return;
      }

      const target = targets.reduce((prev, curr) => {
        return curr.status.defencing.level > prev.status.defencing.level
          ? curr
          : prev;
      });

      const damageVal =
        self.status.strength.level * (3 + thisSkill!.level * 0.1);

      const damage = await dealDamage(self, target, damageVal, {
        damageType: DamageType.Physical,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: "boneBreaker",
        },
        callbacks,
        battleInfo,
      });

     await addState(
        "boneBreakerState",
        2,
        self,
        target,
        {
          thisStateActuralValue: Math.floor(
            target.status.defencing.level * 0.5
          ),
        },
        {
          battleInfo,
          callbacks,
        }
      );

      return {
        type: "skill",
        damage: {
          [target.uuid]: damage,
        },
        heal: {},
        castSkillId: "echoShieldBash",
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  quakeSlam: {
    id: "quakeSlam",
    name: "震地猛击",
    target: "multi_random_enemy",
    targetCount: 1,
    colddown: 2,
    mpCost: 30,
    effectStr: "对至多6个敌人造成力量(300 + 技能等级*10)%的伤害。",
    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],
    effect: async ({ self, enemies, allies, battleInfo, callbacks, thisSkill }) => {
      const targets = getAvailableUnitCollection(enemies).slice(0, 6);

      if (targets.length === 0) {
        return;
      }

      const damageVal =
        self.status.strength.level * (3 + thisSkill!.level * 0.1);

      const res = await dealAoeDamage(self, targets, () => damageVal, {
        battleInfo,
        callbacks,
        damageType: DamageType.Physical,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: "quakeSlam",
        },
      });

      return {
        type: "skill",
        damage: res,
        heal: {},
        castSkillId: "quakeSlam",
        targetUnitUuidList: Object.keys(res),
        sourceUnitUuid: self.uuid,
      };
    },
  },
  voidSpawn: {
    id: "voidSpawn",
    name: "渊裔唤生",
    target: "none",
    targetCount: 1,
    colddown: 5,
    mpCost: 30,
    effectStr: "召唤两个“渊裔仆从”，持续3回合。",
    damageType: DamageType.NoDamage,
    skillType: [SkillType.Summon],
    effect: async ({ self, enemies, allies, battleInfo, callbacks, thisSkill }) => {
      return {
        type: "skill",
        damage: {},
        heal: {},
        castSkillId: "quakeSlam",
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  siphonPulse: {
    id: "siphonPulse",
    name: "魔力汲取",
    target: "all_enemy",
    targetCount: 999,
    colddown: 6,
    mpCost: 50,
    effectStr: "从所有敌人身上汲取(25 + 技能等级*5)点魔法值，并为自己恢复等量的魔法值。\n溢出的部分转换为对自身的治疗效果。",
    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],
    effect: async ({ self, enemies, allies, battleInfo, callbacks, thisSkill }) => {

      const mpDrain = 25 + thisSkill!.level * 5;
      let total = 0;
      for(const enemy of getAvailableUnitCollection(enemies)) {
        await lossMp(self, enemy, mpDrain, {
          battleInfo,
          callbacks,
          reason: MpLossReason.FROM_ENEMY_LOSS
        })
      }

      restoreMp(self, self, total, {
        reason: MpRestoreReason.SKILL_EFFECT,
        callback: callbacks.restoreMpCallback
      });

      const overflow = total - (self.maxMp - self.mp);
      if (overflow > 0) {
        await healUnit(self, self, overflow, {
          reason: HpRestoreReason.SKILL_EFFECT,
          battleInfo,
          callbacks,
        })
      }

      return {
        type: "skill",
        damage: {},
        heal: {},
        castSkillId: "quakeSlam",
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  cdhbFormShiftSkill: {
    id: "cdhbFormShiftSkill",
    name: "深渊之触",
    target: "none",
    targetCount: 1,
    colddown: 1,
    mpCost: 100,
    effectStr: "使一个随机友军获得“无相形态”",
    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff],
    preCheck: ({ self, enemies, allies, battleInfo, }) => {
      const targets = getAvailableUnitCollection(allies.filter(unit => !hasState(unit, "cdhbFormShift")));

      return targets.length > 0;
    },
    effect: async ({ self, enemies, allies, battleInfo, callbacks, thisSkill }) => {
      const targets = getAvailableUnitCollection(allies.filter(unit => !hasState(unit, "cdhbFormShift")));

      if (targets.length === 0) {
        return;
      }

      const randomTarget = getRandomUnitInCollection(targets)!;

      if (!randomTarget) {
        return;
      }

     await addState(
        "cdhbFormShift",
        999,
        self,
        randomTarget,
        {},
        {
          battleInfo,
          callbacks,
        }
      );

      return {
        type: "skill",
        damage: {},
        heal: {},
        castSkillId: "cdhbFormShiftSkill",
        targetUnitUuidList: [randomTarget.uuid],
        sourceUnitUuid: self.uuid,
      }
    }
  },
  abyssalTideForCdHb: {
    id: "abyssalTideForCdHb",
    name: "深渊洪流",
    target: "none",
    targetCount: 1,
    colddown: 3,
    mpCost: 200,
    effectStr: "对所有敌人造成5次(1 + 智力(50 + 技能等级*5)%)的魔法伤害。\n自身生命值每降低10%都会使此效果额外触发1次。",
    damageType: DamageType.Magical,
    skillType: [SkillType.Damage],
    effect: async ({ self, enemies, allies, battleInfo, callbacks, thisSkill }) => {
      const damage = (1 + self.status.intelligence.level * (0.5 + thisSkill!.level * 0.05));
      const targets = getAvailableUnitCollection(enemies);

      let times = 5;
      const hpPercentLost = 1 - self.hp / self.maxHp;
      times += Math.floor(hpPercentLost / 0.1);

      let totalDamageRes: {
        [target: string]: {
          damage: number;
          damageType: DamageType;
        };
      } = {};
      for(let i = 0; i < times; i++) {
        let res = await dealAoeDamage(self, targets, () => damage, {
          damageType: DamageType.Magical,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: "abyssalTideForCdHb",
          },
          callbacks,
          battleInfo,
        });

        Object.keys(res).forEach((targetUuid) => {
          if (!totalDamageRes[targetUuid]) {
            totalDamageRes[targetUuid] = {
              damage: 0,
              damageType: DamageType.Magical,
            };
          }

          totalDamageRes[targetUuid].damage += res[targetUuid].damage;
        });

        await delay(100);
      }

      return {
        type: "skill",
        damage: totalDamageRes,
        heal: {},
        castSkillId: "quakeSlam",
        targetUnitUuidList: Object.keys(totalDamageRes),
        sourceUnitUuid: self.uuid,
      };
    },
  },

  brainwashing: {
    id: "brainwashing",
    name: "洗脑",
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 5,
    mpCost: 20,
    effectStr: "使一个随机敌人获得“混淆”，持续3回合。",
    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],
    effect: async ({ self, enemies, battleInfo, callbacks, thisSkill }) => {
      const targets = getAvailableUnitCollection(enemies.filter(unit => !hasState(unit, "confusion")));

      if (targets.length === 0) {
        return;
      }

      const randomTarget = getRandomUnitInCollection(targets)!;

      if (!randomTarget) {
        return;
      }

     await addState(
        "confusion",
        3,
        self,
        randomTarget,
        {},
        {
          battleInfo,
          callbacks,
        }
      );

      return {
        type: "skill",
        damage: {},
        heal: {},
        castSkillId: "brainwashing",
        targetUnitUuidList: [randomTarget.uuid],
        sourceUnitUuid: self.uuid,
      }
    }
  },
  qeDirgeCataclysm: {
    id: "qeDirgeCataclysm",
    name: "寂鸣灾谣",
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 5,
    mpCost: 80,
    effectStr: "对随机3个敌人造成智力(200 + 技能等级*20)%的伤害，并施加“寂鸣灾谣”状态，持续3回合。",
    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],
    effect: async ({ self, enemies, battleInfo, callbacks, thisSkill }) => {
      const targets = getAvailableUnitCollection(enemies);
      const randomTargets = getRandomUnitsInCollection(targets, 3);

      if (!randomTargets.length) {
        return;
      }

      const dealDamageRes = await dealAoeDamage(
        self,
        randomTargets,
        () =>
          self.status.intelligence.level *
          (2 + 0.2 * thisSkill!.level),
        {
          damageType: DamageType.Magical,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: "qeDirgeCataclysm",
          },
          callbacks,
          battleInfo,
        }
      );

      for (const target of randomTargets) {
       await addState(
          "qeDirgeCataclysmState",
          3,
          self,
          target,
          {},
          {
            battleInfo,
            callbacks,
          }
        );
      }

      return {
        type: "skill",
        damage: dealDamageRes,
        heal: {},
        castSkillId: "brainwashing",
        targetUnitUuidList: randomTargets.map(target => target.uuid),
        sourceUnitUuid: self.uuid,
      }
    }
  },
  bcScepterOfNight: {
    id: "bcScepterOfNigh",
    name: "问罪",
    target: "all_enemy",
    targetCount: 999,
    colddown: 0,
    mpCost: 100,
    effectStr: "对所有拥有“罪印”状态的敌方单位，造成攻击力(200 + 技能等级*10)%的伤害。",
    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],
    preCheck: ({ self, enemies, battleInfo, }) => {
      const targets = getAvailableUnitCollection(enemies.filter(unit => hasState(unit, "bcCourtTitheDamageState")));

      return targets.length > 0;
    },
    effect: async ({ self, enemies, battleInfo, callbacks, thisSkill }) => {
      const targets = getAvailableUnitCollection(enemies.filter(unit => hasState(unit, "bcCourtTitheDamageState")));

      if (targets.length === 0) {
        return;
      }

      const damageRes = await dealAoeDamage(
        self,
        targets,
        () =>
          self.status.attacking.level *
          (2 + 0.1 * thisSkill!.level),
        {
          damageType: DamageType.Physical,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: "bcScepterOfNight",
          },
          callbacks,
          battleInfo,
        }
      );

      return {
        type: "skill",
        damage: damageRes,
        heal: {},
        castSkillId: "brainwashing",
        targetUnitUuidList: targets.map(target => target.uuid),
        sourceUnitUuid: self.uuid,
      }
    }
  },
  bcCrowningMidnight: {
    id: "bcCrowningMidnight",
    name: "临御",
    target: "all_enemy",
    targetCount: 999,
    colddown: 3,
    mpCost: 0,
    effectStr: "召唤2个“黑岩执盾者”、2个“回声巨像”。\n获得“辟邪”，持续5回合。",
    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],
    effect: async ({ self, battleInfo, callbacks, }) => {
      let count = 2;
      for (let i = 0; i < count; i++) {
        const template = generateEnemyById("cd_br1")
        if (!template) continue;

        summonUnit(battleInfo, self, template, 10)
      }

      for (let i = 0; i < count; i++) {
        const template = generateEnemyById("cd_ec1")
        if (!template) continue;

        summonUnit(battleInfo, self, template, 10)
      }

     await addState(
        "proof",
        5,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
        }
      );

      return {
        type: "skill",
        damage: {},
        heal: {},
        castSkillId: "brainwashing",
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      }
    }
  }
} as const satisfies Record<string, GameBattleSkill>;