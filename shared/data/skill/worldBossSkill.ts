import { DealDamageCauseByType, HpRestoreReason, MpLossReason, MpRestoreReason } from "~/shared/types/battle";
import { dealAoeDamage, dealDamage, getRandomUnitInCollection, getRandomUnitsInCollection, healUnit, lossMp, restoreMp, summonUnit, addState, castSkill } from "~/server/utils/game/battleAction";
import { DamageType, SkillType, type GameBattleSkill } from "~/shared/types/skill";
import { generateEnemyById, generateUnitById } from "~/server/utils/game/enemy";
import { delay } from "~/shared/utils";
import { getAvailableUnitCollection, hasState, } from "~/shared/utils/game/battle";

export const allWorldBossSkill = {
  nianRendingClaws: {
    id: "nianRendingClaws",
    name: "撕裂利爪",
    target: "all_enemy",
    targetCount: 999,
    colddown: 3,
    mpCost: 10,
    effectStr:
      "用利爪横扫战场，对每个敌人各造成(260+其当前生命值15%)的物理伤害，并施加“流血”状态。",
    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],
    effect: async ({ self, enemies, allies, battleInfo, callbacks, thisSkill }) => {
      const targets = getAvailableUnitCollection(enemies);

      if (targets.length === 0) {
        return;
      }

      const damage = await dealAoeDamage(self, targets, (e) => {
        return 260 + Math.floor(e.hp * 0.15);
      }, {
        damageType: DamageType.Physical,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: "nianRendingClaws",
        },
        callbacks,
        battleInfo,
      });

      for (const target of targets) {
        await addState("bleeding", 3, self, target, {}, {
          callbacks,
          battleInfo,
        });
      }

      return {
        type: "skill",
        damage,
        heal: {},
        castSkillId: "nianRendingClaws",
        targetUnitUuidList: Object.keys(damage),
        sourceUnitUuid: self.uuid,
      };
    },
  },
  nianWorldSwallower: {
    id: "nianWorldSwallower",
    name: "吞噬天地",
    target: "single_enemy",
    targetCount: 1,
    colddown: 5,
    mpCost: 10,
    effectStr:
      "对一个当前生命值比例最低的敌人造成（400 + 已损失生命值95%）无视防御的伤害。\n被这个技能击杀的单位无法被复活。",
    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],
    effect: async ({ self, enemies, allies, battleInfo, callbacks, thisSkill }) => {
      const targets = getAvailableUnitCollection(enemies);

      if (targets.length === 0) {
        return;
      }

      const enemyWithLowestHp = targets.reduce((prev, curr) => {
        return (prev.hp / prev.maxHp) < (curr.hp / curr.maxHp) ? prev : curr;
      });

      const damageVal = Math.floor(400 + (enemyWithLowestHp.maxHp - enemyWithLowestHp.hp) * 0.95);

      const damage = await dealDamage(self, enemyWithLowestHp, damageVal, {
        damageType: DamageType.Physical,
        ignoreDefence: true,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: "nianWorldSwallower",
        },
        callbacks,
        battleInfo,
      });

      if (enemyWithLowestHp.hp <= 0) {
        await addState("irrevocable", 99, enemyWithLowestHp, self, {}, {
          callbacks,
          battleInfo,
        });
      }

      return {
        type: "skill",
        damage: {
          [enemyWithLowestHp.uuid]: damage,
        },
        heal: {},
        castSkillId: "nianWorldSwallower",
        targetUnitUuidList: [enemyWithLowestHp.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
} as const satisfies Record<string, GameBattleSkill>;