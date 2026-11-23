import { DealDamageCauseByType, HpRestoreReason, MpLossReason, MpRestoreReason, type FullBattleAction } from "../types/battle";
import type { AllBattleStateId, BattleState } from "../types/BattleState";
import { DamageType, SkillType, type AllBattleSkillId, type ChefSkillCombinationInfo, type GameBattleSkill } from "../types/skill";
import type { BaseBattleUnit, BattleSkillInfo } from "../types/unit";
import { clone, delay, ObjectKeys, randomElementInCollection, randomNumberInFullColseRange } from "../utils";
import { dealAoeDamage, dealDamage, getRandomUnitInCollection, getRandomUnitsInCollection, healUnit, restoreMp, summonUnit, addState, castSkill, getUnitStatusInBattle, lossMp, getRandomPercentAboutUnit, checkRandomPercentAboutUnit, hasStateCauseForbidCastSkill, hasStateCauseForbidRevive } from "~/server/utils/game/battleAction";
import { allBattleState, detachState, getStateExtraStack, writeStateExtraInfo } from "./allBattleState";
import { allGameEnemies } from "./allGameEnemy";
import { generateEnemyById, generateUnitById } from "~/server/utils/game/enemy";
import { getEquipmentLevel, getUnitEquipmentLevel, hasEquipment } from "../utils/game/equipment";
import { v4 } from "uuid";
import { allCharacterStatus } from "./allCharacterStatus";
import {getAvailableUnitCollection, pushUnitTurnOrder, moveUnitTurnOrder, getBaseInfoFromBattleInfo, } from "~/shared/utils/game/battle"
import {iteratorUnitState} from "~/server/utils/game/battleAction"
import { findUnitInBattle, hasState } from "../utils/game/battle";
import { catDungeon002SkillData } from "./skill/cat_dungeon_002";
import { allWorldBossSkill } from "./skill/worldBossSkill";


// 单体技能 技能等级效果至少为4
// 群体技能 技能等级效果至少为1.5

// 单体技能 冷却时间最少为2
// 群体技能 冷却时间至少为6，除非有强烈的对玩家的负面效果

// 单体技能，魔法消耗至少为10，智力系的技能魔法消耗至少为60
// 群体技能，魔法消耗至少为30，智力系的技能魔法消耗至少为60

export const allEquipmentBoundSkills = {
  knowledgeCrownSkill: {
    id: "knowledgeCrownSkill",
    name: "集智",
    target: "all",
    targetCount: 99,
    colddown: 6,
    mpCost: 0,
    effectStr: "你可以将你已学习且已启用的魔法技能作为“集智”的组成部分\n在战斗中释放此技能时，将转而依次释放被组合的技能\n\n释放此技能将使被组合的技能进入冷却\n被组合的技能必须携带且启用\n组合技能释放顺序参照配置时的顺序",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Special],

    effect: async ({ self, enemies, battleInfo, callbacks, thisSkill }) => {
      const extra = self.skills['knowledgeCrownSkill']?.extra;

      const skillLevel = thisSkill?.level ?? 1;

      let combinedSkills = extra?.knowledgeCrownSkills;
      if (!Array.isArray(combinedSkills) || !combinedSkills.length) {
        return;
      }

      // 根据skillLevel，决定最多释放几个技能
      combinedSkills = combinedSkills.slice(0, skillLevel);

      for(const skillId of combinedSkills) {
        await delay(100);

        const info = getBaseInfoFromBattleInfo(self, battleInfo);

        if (!info) {
          continue;
        }

        const skillInfo = allGameBattleSkills[skillId as AllBattleSkillId] as GameBattleSkill;
        if (!skillInfo) {
          continue;
        }

        if (skillInfo.passive) {
          continue;
        }

        if (self.mp < skillInfo.mpCost) {
          callbacks?.floatTextCallback?.({
            unit: self,
            text: `集智-魔法不足，无法释放${skillInfo.name}`,
            hidePopover: true,
          })
          continue;
        }

        await lossMp(self, self, skillInfo.mpCost, {
          reason: MpLossReason.CAST_SKILL,
          callbacks,
          battleInfo
        });

        await castSkill(self, skillId, {
          battleInfo,
          callbacks,
          ...info,
        }, {
          ignoreAfterCastSkillTrigger: true,
          ignoreAfterSimpleAttackTrigger: true,
          ignoreCastColddown: true,
          // ignoreColddown: true,
          ignoreMpCost: true,
        })
      }

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      return results;
    },
  },
  dominationSealSkill: {
    id: "dominationSealSkill",
    name: "统御",
    target: "all",
    targetCount: 99,
    colddown: 0,
    mpCost: 0,
    effectStr: "你可以选择技能进行“统御”，当除你以外的任何单位释放被“统御”的技能时，你将消耗15%最大魔法值与生命值，使此技能失效",

    passive: true,

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff, SkillType.Passive],

    preCheck: () => {
      return false;
    },
    effect: async () => {
      return undefined;
    }
  },
  blinkshadowGirdleSkill: {
    id: "blinkshadowGirdleSkill",
    name: "瞬影",
    target: "all",
    targetCount: 99,
    colddown: 0,
    mpCost: 0,
    effectStr: "当你进入潜行状态后，自动释放你选择的非普通攻击、非群体伤害的技能。",

    passive: true,

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Passive],

    effect: async ({ self, enemies, battleInfo, callbacks }) => {
      return undefined;
    },
  },

  intertwinedCatEyeGenesisEssenceStaffSkill: {
    id: "intertwinedCatEyeGenesisEssenceStaffSkill",
    name: "交织",
    target: "all",
    targetCount: 99,
    colddown: 0,
    mpCost: 0,
    effectStr: "在每个单位行动后，你会交替释放你通过“交织”选择的非普通攻击的技能。",

    passive: true,

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Passive],

    effect: async ({ self, enemies, battleInfo, callbacks }) => {
      return undefined;
    },
  },
} as const satisfies Record<string, GameBattleSkill>;

export const allSingleSkills = {
  
} as const satisfies Record<string, GameBattleSkill>;

export const allSummonUnitSkills = {
  meowColossusLaser: {
    id: "meowColossusLaser",
    name: "巨像激光",
    target: "all_enemy",
    targetCount: 99,
    colddown: 3,
    mpCost: 0,
    effectStr:
      "对所有敌人造成(10 + 攻击力230% + 目标当前生命值10%)点伤害, 这次伤害拥有50%防御穿透\n拥有50层“巨像充能”时, 将造成2次伤害\n巨像激光造成的伤害不会超过自身攻击力的1000%",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage],

    preCheck: ({self}) => {
      return getStateExtraStack(self.state?.forgeSkillCraftMeowColossusState) >= 20
    },
    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      let targets = getAvailableUnitCollection(enemies)

      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      let baseDamage = 10 + attack * 2.3;

      const maxDamage = attack * 10;

      results.damage = await dealAoeDamage(
        self,
        targets,
        (target) => {
          let hpDamage = target.hp * 0.1;

          let damage = Math.floor(baseDamage + hpDamage);

          if (damage > maxDamage) {
            damage = maxDamage;
          }

          return damage;
        },
        {
          ignoreDefencePercent: 50,
          damageType: DamageType.Magical,
          battleInfo,
          dealDamageCallback,
        }
      );
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      if (getStateExtraStack(self.state?.forgeSkillCraftMeowColossusState) >= 50) {
        let thisTimeDamage = await dealAoeDamage(
          self,
          targets,
          (target) => {
            let hpDamage = target.hp * 0.1;

            let damage = Math.floor(baseDamage + hpDamage);

            return damage;
          },
          {
            ignoreDefencePercent: 50,
            damageType: DamageType.Magical,
            battleInfo,
            dealDamageCallback,
          }
        );

        Object.keys(thisTimeDamage).forEach(uuid => {
          if (!results.damage![uuid]) {
            results.damage![uuid] = { damage: 0, damageType: thisTimeDamage[uuid].damageType };
          }
          results.damage![uuid].damage += thisTimeDamage[uuid].damage;
        })
      }

      return results;
    },
  },

  denseFogSpriteAttack: {
    id: "denseFogSpriteAttack",
    name: "迷雾幽灵攻击",
    target: "all",
    targetCount: 99,
    colddown: 0,
    mpCost: 0,
    effectStr:
      "所有单位流失当前生命值5%的生命值。\n该效果不会使受影响单位的生命值低于1点",

    damageType: DamageType.True,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      battleInfo.members.forEach(unit => {
        let lostHp = unit.hp * 0.05;
        unit.hp -= lostHp;

        unit.hp = Math.max(unit.hp, 1);

        results.targetUnitUuidList.push(unit.uuid);
      })

      return results;
    }
  },

  denseFogSpriteAttackBoss: {
    id: "denseFogSpriteAttackBoss",
    name: "迷雾幽灵攻击",
    target: "all",
    targetCount: 99,
    colddown: 0,
    mpCost: 0,
    effectStr:
      "所有单位流失最大生命值25%的生命值。\n该效果不会使受影响单位的生命值低于1点",

    damageType: DamageType.True,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      battleInfo.members.forEach(unit => {
        let lostHp = unit.maxHp * 0.25;
        unit.hp -= lostHp;

        unit.hp = Math.max(unit.hp, 1);

        results.targetUnitUuidList.push(unit.uuid);
      })

      return results;
    }
  }
} as const satisfies Record<string, GameBattleSkill>;


export const allWorkStatusBattleSkills = {
  "beastpackRoar": {
    id: 'beastpackRoar',
    name: "兽群咆哮",
    target: "all",
    targetCount: 99,

    effectStr: "对所有敌人造成(10 + 畜牧等级(850 + 技能等级*50)% + 防御力(250 + 技能等级*50)%)点伤害。\n友方每存在一个召唤物，总伤害额外提升(畜牧等级 * 0.75)%。",

    tire: 4,

    colddown: 5,
    mpCost: 30,

    damageType: DamageType.Physical,
    skillType: [SkillType.Buff, SkillType.Damage, SkillType.Debuff],

    async effect({self, thisSkill, allies, enemies, battleInfo, callbacks}) {
      const farmingAnimalLevel = self.status.otherStatus?.farmingAnimal?.level ?? 1;
      const skillLevel = thisSkill?.level ?? 1;
      const defence = getUnitStatusInBattle(self, 'defencing', { battleInfo, callbacks });

      const summonedUnitCount = allies.filter(u => u.isSummoned).length;

      let damage = 10 + (farmingAnimalLevel * (8.5 + skillLevel * 0.5)) + (defence * (2.5 + skillLevel * 0.5));

      // Description: 每存在一个召唤物，总伤害额外提升 (畜牧等级 * 0.75)%
      // 在原实现中直接使用了 `farmingAnimalLevel * 0.75 * summonedUnitCount` 作为乘数，
      // 这会将百分比当作倍数使用（放大 100 倍）。正确做法是先把百分比除以 100。
      const perSummonPercent = farmingAnimalLevel * 0.75; // e.g. farmingAnimalLevel=10 -> 7.5 (% per summon)
      const perSummonMultiplier = perSummonPercent / 100; // convert percent to multiplier (0.075)
      damage = damage * (1 + perSummonMultiplier * summonedUnitCount);

      damage = Math.floor(damage);

      const damageRes = await dealAoeDamage(self, enemies, () => damage, {
        damageType: DamageType.Physical,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId:'beastpackRoar',
        },
        battleInfo,
        callbacks,
      });

      return {
        type: "skill",
        sourceUnitUuid: self.uuid,
        targetUnitUuidList: Object.keys(damageRes),
        damage: damageRes,
        heal: {},
      };
    }
  },
  "chefSkill": {
    name: "爆炒",
    id: "chefSkill",
    target: "self",
    targetCount: 1,

    tire: 4,

    colddown: 4,
    mpCost: 40,

    effectStr: "根据你调配的风味，产生不同影响",

    damageType: DamageType.Magical,
    skillType: [SkillType.Buff, SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, thisSkill, allies, enemies, battleInfo, callbacks }) => {
      const chefSkillConf = thisSkill?.extra?.chefSkill as ChefSkillCombinationInfo;

      if (!chefSkillConf) {
        callbacks?.floatTextCallback?.({
          text: "忘记菜谱了",
          unit: self,
        })
        return;
      }

      const allyCount = chefSkillConf.targets.find(t => t.key == 'ally')?.count ?? 0
      const enemyCount = chefSkillConf.targets.find(t => t.key == 'enemy')?.count ?? 0

      const randomAllies = getRandomUnitsInCollection(allies, allyCount)
      const randomEnemies = getRandomUnitsInCollection(enemies, enemyCount)

      if (!randomAllies?.length && !randomEnemies?.length) {
        callbacks?.floatTextCallback?.({
          text: "做的饭没人吃！",
          unit: self,
        })
        return;
      }

      const allTargets = [...randomAllies, ...randomEnemies];

      const saltyCount = chefSkillConf.flavors.find(t => t.key == 'salty')?.count ?? 0

      const saltExtraStateTurn = ~~(saltyCount / 4)

      const chefLevel = self.status.otherStatus.cooking?.level ?? 1

      const sourCount = chefSkillConf.flavors.find(t => t.key == 'sour')?.count ?? 0
      if (sourCount > 0) {
        const buffValue = +(sourCount * (0.01 + saltyCount * 0.001)).toFixed(4)

        for(const target of allTargets) {
         await addState('chefSkillSour', 2 + saltExtraStateTurn, self, target, {
            thisStateActuralValue: buffValue,
            thisStateActuralValueUnit: 'percent'
          }, {
            battleInfo,
            callbacks
          })
        }
      }

      const sweetCount = chefSkillConf.flavors.find(t => t.key == 'sweet')?.count ?? 0
      if (sweetCount > 0) {
        for(const target of allTargets) {
          const healValue = Math.floor((target.maxHp - target.hp) * (0.05 + saltyCount * 0.005))
          await healUnit(self, target, healValue, {
            reason: HpRestoreReason.SKILL_EFFECT,
            triggerBy: {
              type: 'skill',
              id: 'chefSkill',
            },
            battleInfo,
            callbacks,
          })
        }
      }

      const bitterCount = chefSkillConf.flavors.find(t => t.key == 'bitter')?.count ?? 0
      if (bitterCount > 0) {
        const debuffValue = +(bitterCount * (0.015 + saltyCount * 0.0015)).toFixed(4)

        for(const target of allTargets) {
         await addState('chefSkillBitter', 2 + saltExtraStateTurn, self, target, {
            thisStateActuralValue: debuffValue,
            thisStateActuralValueUnit: 'percent'
          }, {
            battleInfo,
            callbacks
          })
        }
      }

      const spicyCount = chefSkillConf.flavors.find(t => t.key == 'spicy')?.count ?? 0
      if (spicyCount > 0) {
        const damage = Math.floor((chefLevel * (2 + saltyCount * 0.2)) * spicyCount);

        await dealAoeDamage(self, allTargets, () => {
          return damage
        }, {
          damageType: DamageType.Magical,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'chefSkill'
          },
          callbacks,
          battleInfo
        })
      }

      if (!sweetCount && !sourCount && !bitterCount && !spicyCount) {
        if (saltyCount) {
          for(const target of allTargets) {
           await addState('fluster', 2 + saltyCount + saltExtraStateTurn, self, target, {
            }, {
              battleInfo,
              callbacks
            })
          }
        }
      }

      return undefined;
    }
  },

  "forgeSkillCraftMeowColossus": {
    name: "制造喵喵巨像",
    id: "forgeSkillCraftMeowColossus",
    target: "self",
    targetCount: 1,

    tire: 4,

    colddown: 1,
    mpCost: 12,

    effectStr: "使用此技能将为场上的“喵喵巨像”提供(1+锻造等级10%, 向下取整)层充能。\n如果“喵喵巨像”不存在, 则制造一个喵喵巨像来协助作战, 喵喵巨像初始拥有100最大生命值, 30攻击, 10防御。你的队伍中每拥有1级“锻造”等级, 将额外提供8生命、1攻击、1防御。\n喵喵巨像不视为任何人的召唤物，喵喵巨像可跨战斗存在",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Summon],

    effect: async ({ self, allAllies, battleInfo, addStateCallback, callbacks }) => {
      const results: FullBattleAction = {
        type: "skill",
        targetUnitUuidList: [],
        damage: {},
        heal: {},
        sourceUnitUuid: self.uuid,
      };

      const colossusUuid = "meowColossus";

      let existColossus = findUnitInBattle(battleInfo, colossusUuid);

      let forgeLevel = self.status.otherStatus?.forging?.level ?? 1;

      let totalForgeLevel = 0
      for(const ally of allAllies) {
        totalForgeLevel += ally.status.otherStatus?.forging?.level ?? 0;
      }

      if (!existColossus) {
        let colossus = generateUnitById('forgeSkillMeowColossus')!
        colossus.name = '喵喵巨像'

        let baseHp = 100 + totalForgeLevel * 8;
        let baseAttack = 30 + totalForgeLevel * 1;
        let baseDefence = 30 + totalForgeLevel * 1;

        colossus.status.attacking.level = baseAttack;
        colossus.status.defencing.level = baseDefence;
        colossus.maxHp = baseHp;
        colossus.hp = baseHp;

        colossus.uuid = colossusUuid;

        existColossus = summonUnit(battleInfo, self, colossus, 999, {
          permanent: true,
          uuid: colossusUuid
        })

        existColossus.isSummoned = false;
        existColossus.summonedBy = undefined;
      }

     await addState('forgeSkillCraftMeowColossusState', 999, self, existColossus, {}, {
        extraStack: Math.floor(1 + forgeLevel * 0.1),
        addStateCallback,
        callbacks,
        battleInfo
      })

      results.targetUnitUuidList.push(existColossus.uuid);

      return results
    }
  },
  "forgeSkillCraftTurret": {
    name: "制造炮台",
    id: "forgeSkillCraftTurret",
    target: "self",
    targetCount: 1,

    tire: 4,

    colddown: 1,
    mpCost: 5,

    effectStr: "召唤一个不占用回合的自动炮台，炮台将在你的回合开始时，对一个随机目标发射炮弹，造成炮台攻击力100%的伤害。\n炮台拥有(20 + 锻造等级400%)的攻击力，(10 + 锻造等级100%)的防御，(50 + 锻造等级200%)的生命值，且能够跨战斗存在\n你只能拥有1个炮台，当你释放此技能时，如果场上已有属于你的炮台，则会对现有的炮台进行升级，为其恢复全部生命值，移除1个负面状态，并额外为其增加(锻造等级200%)攻击力、(锻造等级50%)防御与(锻造等级100%)生命值，最多升级10次。",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Summon],

    effect: async ({ self, battleInfo, addStateCallback, callbacks }) => {
      const results: FullBattleAction = {
        type: "skill",
        targetUnitUuidList: [],
        damage: {},
        heal: {},
        sourceUnitUuid: self.uuid,
      };

      let ownerUuid = self.uuid;
      if (self.isSummoned) {
        ownerUuid = self.summonedBy ?? self.uuid
      }
      const turretId = "turret_" + ownerUuid;

      let existTruuet = findUnitInBattle(battleInfo, turretId);

      let forgeLevel = self.status.otherStatus?.forging?.level ?? 1;

      if (!existTruuet) {
        let turret = generateUnitById('forge_skill_auto_turret')!
        turret.name = self.name + '的' + turret.name

        let baseAttack = 20 + forgeLevel * 4;
        let baseDefence = 10 + forgeLevel * 1;
        let baseHp = 50 + forgeLevel * 2;

        turret.status.attacking.level = baseAttack;
        turret.status.defencing.level = baseDefence;
        turret.maxHp = baseHp;
        turret.hp = baseHp;

        turret.uuid = turretId;

        existTruuet = summonUnit(battleInfo, self, turret, 999, {
          permanent: true,
          ignoreTurn: true,
          uuid: turretId
        })
      }

     await addState('forgeSkillCraftTurretUpgrade', 999, self, existTruuet, {
        attackPerStack: Math.floor(forgeLevel * 2),
        hpPerStack: Math.floor(forgeLevel * 1),
        defencePerStack: Math.floor(forgeLevel * 0.5),
      }, {
        extraStack: 1,
        addStateCallback,
        callbacks,
        battleInfo
      })

      iteratorUnitState(existTruuet, ({stateInfo, stateId}) => {
        if (stateInfo.isDebuff && !stateInfo.unremovable) {
          detachState(stateId, existTruuet, battleInfo, {
            callbacks
          })

          return true;
        }
      })

      results.targetUnitUuidList.push(existTruuet.uuid);

      return results
    }
  },
  "natureGift": {
    name: "自然馈赠",
    id: "natureGift",
    target: "all_ally",
    targetCount: 999,

    tire: 4,

    colddown: 15,
    mpCost: 20,

    effectStr: "为全体友军回复(10 + 智力40% + 采集等级(100% + 技能等级*2)%)生命，并附加“自然时运”效果，持续10回合。\n自然时运提升(采集等级 * 0.08)%战利品掉落率（例：释放者有30采集等级，则提升2.4%掉落率[*102.4%]）",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Heal, SkillType.Buff],

    effect: async ({ self, allies, enemies, thisSkill, battleInfo, callbacks, healCallback, addStateCallback }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const collecting = getUnitStatusInBattle(self, 'collecting', { battleInfo, callbacks });
      const skillLevel = thisSkill?.level ?? 1;
      const healValue = Math.floor(
        10 + intelligence * 0.4 + collecting * (1 + skillLevel * 0.02)
      );

      const results: FullBattleAction = {
        type: "skill",
        targetUnitUuidList: [],
        damage: {},
        heal: {},
        sourceUnitUuid: self.uuid,
      };

      for (const ally of allies) {
        await healUnit(self, ally, healValue, {
          battleInfo,
          callbacks,
          reason: HpRestoreReason.SKILL_EFFECT,
          callback: healCallback
        });

        results.targetUnitUuidList.push(ally.uuid);

       await addState("natureGift", 10, self, ally, {
          thisStateActuralValue: (self.baseStatus?.otherStatus?.collecting?.level ?? self.status?.otherStatus?.collecting?.level ?? 1) * 0.0008,
          thisStateActuralValueUnit: 'percent'
        }, {
          callbacks,
          battleInfo,
          addStateCallback
        })
      }

      return results
    }
  },
  "threadingNeedle": {
    name: "穿针引线",
    id: "threadingNeedle",
    target: "single_random_enemy",
    targetCount: 1,

    tire: 4,

    colddown: 6,
    mpCost: 25,

    effectStr: "根据敌人的行动顺序，对所有敌人依次造成伤害，伤害为（10 + 攻击力(60 + 技能等级*2)% + 缝纫等级(350 + 技能等级*2)%)点伤害，无视防御。\n每伤害一个敌人，伤害降低5%。",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, allies, enemies, thisSkill, battleInfo, dealDamageCallback, callbacks }) => {
      if (!enemies) {
        // 如果没有找到目标，返回一个空的BattleAction
        return {
          type: "attack",
          targetType: "none",
          damage: {},
          heal: {},

          targetUnitUuidList: [],
          castSkillId: "baseAttack",
          sourceUnitUuid: self.uuid,
        };
      }

      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const sewing = self.status.otherStatus?.sewing?.level ?? 1;
      const skillLevel = thisSkill?.level ?? 1;

      let oriDamage = Math.floor(10 + attack * (0.6 + skillLevel * 0.02) + sewing * (3.5 + skillLevel * 0.02));
      let reducePerUnit = Math.floor(oriDamage * 0.05);

      let order = battleInfo.turnOrder

      let res: FullBattleAction = {
        type: "skill",
        damage: {},
        // heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      let damageResult = await dealAoeDamage(self, order.map(unitUuid => {
        const target = enemies.find(e => e.uuid === unitUuid);
        return target ? target : null;
      }).filter(target => target !== null), target => {

        let thisDamage = oriDamage

        oriDamage = Math.max(1, oriDamage - reducePerUnit);

        return thisDamage;
      }, {
          ignoreDefence: true,
          damageType: DamageType.Physical,
          battleInfo,
          dealDamageCallback
      });

      res.damage = damageResult
      res.targetUnitUuidList = ObjectKeys<string>(damageResult)

      return res;
    },
  },

  "knowledgeInspiration": {
    name: "知识启迪",
    id: "knowledgeInspiration",
    target: "all_ally",
    targetCount: 9999,

    tire: 4,

    colddown: 10,
    mpCost: 30,

    effectStr: "减少所有友方单位的技能冷却时间(0 + 学识等级3.4%)回合，恢复所有友方单位(10 + 学识等级(40 + 技能等级*1)%)点魔法。\n每个单位在4回合内只会受到1次来自此技能的冷却缩减效果。\n冷却缩减效果不会影响“知识启迪”。",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.MpRegen],

    effect: async ({ self, allies, thisSkill, callbacks, battleInfo, restoreMpCallback, addStateCallback}) => {
      const knowledge = self.status.otherStatus?.knowledge?.level ?? 1;
      const skillLevel = thisSkill?.level ?? 1;

      const mpRegen = Math.floor(
        10 + knowledge * (0.4 + skillLevel * 0.01)
      );

      const colddown = 1 + Math.floor(knowledge * 0.034);

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      for (const ally of allies) {
        restoreMp(self, ally, mpRegen, {
          reason: MpRestoreReason.SKILL_EFFECT,
          callback: restoreMpCallback
        });

        results.targetUnitUuidList.push(ally.uuid);

        if (colddown <= 0 || hasState(ally, "knowledgeInspirationState")) {
          continue;
        }

        if (ally.skillColddown && Object.keys(ally.skillColddown).length > 0) {
          for (const skillId of ObjectKeys<AllBattleSkillId>(ally.skillColddown)) {
            let currentColddown = ally.skillColddown[skillId] 
            if (skillId == 'knowledgeInspiration' || !currentColddown) {
              continue;
            }
            ally.skillColddown[skillId] = Math.max(0, currentColddown - colddown);
          }

         await addState("knowledgeInspirationState", 4, self, ally, {
            thisStateActuralValue: colddown,
          }, {
            callbacks,
            battleInfo,
            addStateCallback
          })
        }
      }

      return results
    }
  },

  "sowMelonsReapMelons": {
    name: "种瓜得瓜",
    id: "sowMelonsReapMelons",
    target: "single_random_ally",
    targetCount: 1,

    tire: 4,

    colddown: 3,
    mpCost: 0,

    effectStr: "为随机(0 + 种植等级10%)个不处于“种瓜得瓜“状态的友方单位添加”种瓜得瓜“状态，持续4回合。\n如果至少为一个友军施加了“种瓜得瓜”，自身获得随机(1 + 技能等级5%)点生活技能经验值（采集、采矿、钓鱼、畜牧、种植）,每额外施加一个，额外获得1经验。",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff],

    preCheck: ({ self, allies }) => {
      return allies.some((a) => {
        return !hasState(a, 'sowMelonsReapMelonsRegen') && !hasState(a, 'sowMelonsReapMelonsColddown') && !hasState(a, 'sowMelonsReapMelonsLuck')
      })
    },

    effect: async ({ self, allies, thisSkill, battleInfo, callbacks, statusModifyCallback, floatTextCallback, addStateCallback }) => {
      let planting = self.status.otherStatus?.farmingPlant?.level ?? 1;
      let count = Math.floor(1 + planting * 0.1);

      let skillLevel = thisSkill?.level ?? 1

      let randomAlly = getRandomUnitsInCollection(allies, count, {
        includeSneak: true,
      });

      let stateList = ['sowMelonsReapMelonsRegen', 'sowMelonsReapMelonsColddown', 'sowMelonsReapMelonsLuck'] as const

      randomAlly = randomAlly.filter(a => {
        return !hasState(a, 'sowMelonsReapMelonsRegen') && !hasState(a, 'sowMelonsReapMelonsColddown') && !hasState(a, 'sowMelonsReapMelonsLuck')
      });

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      for(const ally of randomAlly) {
        let randomState = randomElementInCollection(stateList);

        if (randomState && randomAlly) {
         await addState(randomState, 4, self, ally, {}, {
            battleInfo,
            callbacks,
            addStateCallback
          })
          results.targetUnitUuidList.push(ally.uuid);
        }
      }

      if (randomAlly.length > 0) {
        let availableStatus = ['collecting', 'mining', 'fishing', 'farmingAnimal', 'farmingPlant'] as const;
        let randomStatus = randomElementInCollection(availableStatus);

        let increase = (1 + skillLevel * 0.05)

        increase += randomAlly.length - 1;

        if (randomStatus && statusModifyCallback) {
          statusModifyCallback?.({
            [self.uuid]: [
              {
                status: randomStatus,
                increaseExp: increase,
              },
            ],
          });
          floatTextCallback?.({
            unit: self,
            text: `+${increase} ${allCharacterStatus[randomStatus].name} 经验`
          })
        }
      }

      return results
    },
  
  },

  enhanceEmpower: {
    name: "强化赋能",
    id: "enhanceEmpower",
    tire: 4,
    target: "single_random_ally",
    targetCount: 1,
    colddown: 11,
    mpCost: 40,
    effectStr: "为当前不处于“强化赋能“状态的友军中，装备强化总等级最高的友军施加“强化赋能”效果，持续5回合。\n强化赋能给予其(释放者强化等级20% + 技能等级30%)点属性，附加至其当前最高的属性(力量、敏捷、智力)上。对于其穿戴的每件强化过的装备，每1强化等级都额外提供(0.1 + 释放者强化等级0.8%)点属性。",
    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff],
    preCheck: ({allies}) => {
      return allies.some(a => !hasState(a, 'enhanceEmpowerState') && !a.isSummoned)
    },
    effect: async ({ self, allies, thisSkill, battleInfo, callbacks, addStateCallback }) => {
      let targets = allies.filter(a => !hasState(a, 'enhanceEmpowerState') && !a.isSummoned);

      let finalTarget: BaseBattleUnit | null = null
      let curMaxEnhanceLevel = 0

      let res: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: allies.map(a => a.uuid),
        sourceUnitUuid: self.uuid,
      };

      for(const target of targets) {
        let thisUnitTotalEnhanceLevel = 0
        for(const equipmentId of Object.values(target.equipment ?? {})) {
          if (!equipmentId) {
            continue;
          }
          let thisEquipmentLevel = getEquipmentLevel(equipmentId)

          thisUnitTotalEnhanceLevel += thisEquipmentLevel
        }

        if (thisUnitTotalEnhanceLevel > curMaxEnhanceLevel) {
          curMaxEnhanceLevel = thisUnitTotalEnhanceLevel;
          finalTarget = target;
        }
      }

      if (!finalTarget || hasState(finalTarget, 'enhanceEmpowerState')) {
        return res
      }

      let selfEnhanceLevel = self.status.otherStatus?.enhance?.level ?? 1;
      let skillLevel = thisSkill?.level ?? 1;

      let finalExtraValue = Math.floor(
        selfEnhanceLevel * 0.2 + skillLevel * 0.3 + (curMaxEnhanceLevel * (0.1 + selfEnhanceLevel * 0.008))
      );

      let mainStatus: 'strength' | 'dexterity' | 'intelligence' = 'strength';

      let targetStrength = getUnitStatusInBattle(finalTarget, 'strength', { battleInfo, callbacks });
      let targetDexterity = getUnitStatusInBattle(finalTarget, 'dexterity', { battleInfo, callbacks });
      let targetIntelligence = getUnitStatusInBattle(finalTarget, 'intelligence', { battleInfo, callbacks });

      // 判断目标当前最高属性
      if (targetStrength >= targetDexterity && targetStrength >= targetIntelligence) {
        mainStatus = 'strength';
      } else if (targetDexterity >= targetStrength && targetDexterity >= targetIntelligence) {
        mainStatus = 'dexterity';
      } else {
        mainStatus = 'intelligence';
      }

     await addState("enhanceEmpowerState", 5, self, finalTarget, { 
        thisStateActuralValue: finalExtraValue,
        mainStatus: mainStatus,
        readableDesc: {
          '主属性': allCharacterStatus[mainStatus].name
        }
      }, {
        battleInfo,
        callbacks,
        addStateCallback
      });

      res.targetUnitUuidList.push(finalTarget.uuid);

      return res
    },
  },

  enhanceStrike: {
    name: "强化冲击",
    id: "enhanceStrike",
    tire: 4,
    target: "all_enemy",
    targetCount: 99,
    colddown: 6,
    mpCost: 30,
    effectStr: "对所有敌人造成伤害，数值相当于((攻击力或智力)60% + 强化等级(200 + 技能等级*2)%)点伤害。自身穿戴的装备，每1级强化等级都会使最终伤害额外提升2.5%。\n伤害类型及取值取决于角色属性，智力属性比力量、敏捷高时，造成魔法伤害，否则造成物理伤害。",

    damageType: [DamageType.Physical, DamageType.Magical],
    skillType: [SkillType.Damage],
    effect: async ({ self, enemies, thisSkill, battleInfo, dealDamageCallback, callbacks }) => {
      let targets = enemies

      let attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      let intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });

      let targetStrength = getUnitStatusInBattle(self, 'strength', { battleInfo, callbacks });
      let targetDexterity =  getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      let targetIntelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });

      let enhanceLevel = self.status.otherStatus?.enhance?.level ?? 1;
      let skillLevel = thisSkill?.level ?? 1;

      let thisUnitTotalEnhanceLevel = 0
      for (const equipmentId of Object.values(self.equipment ?? {})) {
        if (!equipmentId) {
          continue;
        }
        let thisEquipmentLevel = getEquipmentLevel(equipmentId)

        thisUnitTotalEnhanceLevel += thisEquipmentLevel
      }

      // 判断目标当前最高属性
      let damageBaseVal = intelligence;
      let damageType = DamageType.Magical;
      if (targetIntelligence < targetStrength || targetIntelligence < targetDexterity) {
        damageBaseVal = attack;
        damageType = DamageType.Physical;
      }

      let damage = enhanceLevel * (2.0 + skillLevel * 0.02);
      damage += (damageBaseVal * 0.6)
      damage = damage * (1 + thisUnitTotalEnhanceLevel * 0.025);
      damage = Math.floor(damage)

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      results.damage = await dealAoeDamage(self, targets, () => damage, {
        damageType: damageType,
        battleInfo,
        dealDamageCallback
      })
      results.targetUnitUuidList = ObjectKeys<string>(results.damage)

      return results
    },
  },
  fishmanSkill: {
    name: "fishmanSkill",
    id: "fishmanSkill",
    tire: 4,
    target: "self",
    targetCount: 1,

    colddown: 1,
    mpCost: 20,

    effectStr: "向随机一名没有受到“上钩了”影响的敌人甩出鱼竿，使自身与目标无法行动2回合。\n2回合后，对目标造成(钓鱼等级*1000% + 技能等级*5)点伤害。\n如果目标因此伤害阵亡，你有(钓鱼等级*0.5)%的概率立即触发一次此敌人的掉落检测。\n如果目标提前阵亡，你有(钓鱼等级*0.25)%的概率立即触发一次此敌人的掉落检测。\n因此技能获得的掉落物仅对你生效\n此技能触发的掉落概率受幸运及其他来源的掉落率变动影响，但不受“战场后勤猫猫”的影响",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Heal, SkillType.Buff],
    effect: () => {
      return undefined
    }

    // preCheck: ({enemies}) => {
    //   return !!getAvailableUnitCollection(enemies).filter(e => !hasState(e, 'fishmanSkillTarget')).length
    // },
    // effect: async ({ self, enemies, battleInfo, callbacks, }) => {
    //   let targets = getAvailableUnitCollection(enemies).filter(e => !hasState(e, 'fishmanSkillTarget'))
    //   let target = getRandomUnitInCollection(targets)

    //   if (!target) {
    //     return
    //   }

    //  await addState('fishmanSkillSource', 2, self, self, {
    //   }, {
    //     battleInfo,
    //     callbacks
    //   })
    //  await addState('fishmanSkillTarget', 2, self, target, {
    //   }, {
    //     battleInfo,
    //     callbacks
    //   })

    //   return {
    //     type: "skill",
    //     targetType: "self",
    //     damage: {},
    //     heal: {},

    //     targetUnitUuidList: [target.uuid],
    //     sourceUnitUuid: self.uuid,
    //   };
    // }
  },

} as const satisfies Record<string, GameBattleSkill>;


export const allGameBattleSkills = {
  baseAttack: {
    id: "baseAttack",
    name: "普通攻击",
    target: "single_random_enemy",
    targetCount: 1,

    colddown: 0,
    mpCost: 0,

    effectStr: "对随机敌人进行普通攻击，基于你的攻击力与对方防御力，造成伤害",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, allies, enemies, battleInfo, callbacks, skillExtraParam}) => {
      let target = getRandomUnitInCollection(enemies);

      if (skillExtraParam?.specificTarget) {
        target = getRandomUnitInCollection(skillExtraParam.specificTarget);
      }

      if (!target) {
        // 如果没有找到目标，返回一个空的BattleAction
        return {
          type: "attack",
          targetType: "none",
          damage: {},
          heal: {},

          targetUnitUuidList: [],
          castSkillId: "baseAttack",
          sourceUnitUuid: self.uuid,
        };
      }

      let attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });

      if (skillExtraParam?.damageParam?.extraDamage) {
        attack += +skillExtraParam.damageParam.extraDamage;
        delete skillExtraParam.damageParam.extraDamage
      }

      let damageType = DamageType.Physical;
      if (skillExtraParam?.damageParam?.damageType) {
        damageType = skillExtraParam.damageParam.damageType
        delete skillExtraParam.damageParam.damageType
      }

      let damage = await dealDamage(self, target, attack, {
        damageType,
        dealDamageCallback: callbacks.dealDamageCallback,
        battleInfo,
        causeBy: {
          type: DealDamageCauseByType.Attack,
          skillId: "baseAttack",
        },
        callbacks,
        ...(skillExtraParam?.damageParam ?? {})
      });

      let res: FullBattleAction = {
        type: "attack",
        damage: {
          [target.uuid]: damage,
        },
        heal: {},
        castSkillId: "baseAttack",
        targetUnitUuidList: [target?.uuid ?? ""],
        sourceUnitUuid: self.uuid,
      };
      return res;
    },
  },

  boneShield: {
    id: "boneShield",
    name: "骨盾",
    target: "self",
    targetCount: 1,
    colddown: 5,
    mpCost: 5,
    effectStr: "提升（8+技能等级*0.5）防御，持续3回合。\n接下来受到的3次伤害，降低至1点，触发3次后结束骨盾效果。",

    tire: 1,

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff],

    effect: async (opt) => {
      const { self, battleInfo, callbacks } = opt;

      let value = 8 + (self.skills.boneShield?.level ?? 1) * 0.5;
     await addState("boneShield", 3, self, self, {
        thisStateActuralValue: value,
      }, {
        battleInfo,
        callbacks,
      });

      return {
        type: "skill",
        damage: {},
        heal: {},
        castSkillId: "boneShield",
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  // todo
  corrosiveBreath: {
    id: "corrosiveBreath",
    name: "腐蚀吐息",
    tire: 2,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 4,
    mpCost: 10,
    effectStr:
      "向生命值最高的敌人喷吐腐蚀液体，造成(6 + 目标最大生命值5% + 攻击80% + 技能等级*0.25)点无视防御的伤害，使其防御-6，持续3回合。\n伤害不会超过自身攻击力的500%。",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async (obj) => {
      const { self, enemies, battleInfo, callbacks } = obj;
      let availableEnemies = getAvailableUnitCollection(enemies);
      const skillLevel = self.skills.corrosiveBreath?.level ?? 1;
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const candidates = availableEnemies;
      // 选择生命值最高的敌人
      const target = candidates.reduce(
        (max, curr) => (curr.hp > max.hp ? curr : max),
        candidates[0]
      );

      if (!target) return;

      // 计算伤害
      let damage = Math.max(1, Math.floor(6 + skillLevel * 0.25 + target.maxHp * 0.05 + attack * 0.8));
      const maxDamage = Math.floor(attack * 5);
      if (damage > maxDamage) {
        damage = maxDamage;
      }

      let d = await dealDamage(self, target, damage, {
        damageType: DamageType.Physical,
        ignoreDefence: true,
        battleInfo,
        dealDamageCallback: obj.dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: "corrosiveBreath"
        }
      });

      // 附加防御-6的debuff

     await addState("corrosiveBreath", 3, self, target, {}, {
        battleInfo, callbacks,
      });

      return {
        type: "skill",
        damage: { [target.uuid]: d },
        heal: {},
        castSkillId: "corrosiveBreath",
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  summonBerryBird: {
    id: "summonBerryBird",
    name: "召唤浆果鸟",
    tire: 2,
    target: "self",
    targetCount: 1,
    colddown: 5,
    mpCost: 15,
    effectStr:
      "召唤浆果鸟为你战斗，其攻击为（5+攻击10%+技能等级*0.2），持续3回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Summon],

    effect: async ({ self, allies, enemies, battleInfo, callbacks }) => {
      // 1. 生成浆果鸟基础数据
      const berryBird = generateEnemyById("berry_bird_001");
      if (!berryBird) return;

      // 3. 计算攻击力
      const skillLevel = self.skills.summonBerryBird?.level ?? 1;
      const selfAttack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const attack = Math.floor(
        5 + selfAttack * 0.1 + skillLevel * 0.2
      );

      berryBird.status.attacking.level = attack;
      berryBird.name = '浆果鸟（召唤）';
      berryBird.skills = {
        baseAttack: {level: 1, order: 0}
      }

      summonUnit(battleInfo, self, berryBird, 3)

      // 6. 返回技能动作
      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  baseHeal: {
    id: "baseHeal",
    name: "基础治疗",
    tire: 1,
    target: "single_random_ally",
    targetCount: 1,
    colddown: 4,
    mpCost: 15,
    effectStr:
      "治疗生命值最低的受伤友方单位，回复(10 + 智力*100% + 技能等级*4)点生命值",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Heal],

    preCheck: ({ self, allies }) => {
      // 只有存在受伤的友军（不包括自己）时才可释放
      return allies.some((a) => a.hp > 0 && a.hp < a.maxHp);
    },
    effect: async ({ self, allies, battleInfo, healCallback, callbacks }) => {
      // 只考虑受伤的友军（hp < maxHp 且存活且不是自己）
      const injuredAllies = allies.filter((a) => a.hp > 0 && a.hp < a.maxHp);
      if (injuredAllies.length === 0) {
        // 没有受伤友军则不释放
        return {
          type: "skill",
          targetType: "none",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      // 找到生命值最低的受伤友军
      const target = injuredAllies.reduce(
        (min, curr) => (curr.hp < min.hp ? curr : min),
        injuredAllies[0]
      );
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const healValue =
        10 +
        intelligence +
        (self.skills.baseHeal!.level ?? 1) * 4;
      let res: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {
          [target.uuid]: healValue,
        },
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };

      await healUnit(self, target, healValue, {
          battleInfo,
          callbacks,
          reason: HpRestoreReason.SKILL_EFFECT,
          callback: healCallback,
      });

      return res;
    },
  },

  poison: {
    id: "poison",
    name: "中毒",
    tire: 1,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 3,
    mpCost: 5,
    effectStr:
      "为一个随机未中毒的敌人附加中毒状态（每回合开始时受到(15 + 智力(30 + 技能等级*3)%)点伤害，持续6回合）",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],

    preCheck: ({ enemies }) => {
      // 只有存在未中毒且存活的敌人时才可释放
      return enemies.some((e) => e.hp > 0 && (!e.state || !e.state.poison));
    },
    effect: async ({ self, enemies, battleInfo, callbacks }) => {
      // 只选取没有中毒状态的存活敌人
      const candidates = enemies.filter(
        (e) => e.hp > 0 && (!e.state || !e.state.poison)
      );
      const target = getRandomUnitInCollection(candidates);

      if (!target) {
        return undefined;
      }

      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      let value = 15 + intelligence * (0.3 + (self.skills.poison?.level ?? 1) * 0.03);

     await addState("poison", 6, self, target, {
        thisStateActuralValue: value
      }, {
        battleInfo, callbacks,
      });

      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  selfHeal: {
    id: "selfHeal",
    name: "自我疗愈",
    tire: 2,
    target: "single_random_ally",
    targetCount: 1,
    colddown: 5,
    mpCost: 18,
    effectStr:
      "为一个随机未拥有自愈状态的友方附加自我疗愈状态\n每回合开始时回复(5 + 释放者智力30% + 技能等级*4)点生命，持续3回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Heal],

    preCheck: ({ allies }) => {
      // 只有存在未拥有自愈状态且存活的友军时才可释放
      return allies.some((e) => e.hp > 0 && (!e.state || !e.state.selfHeal));
    },
    effect: async ({ self, allies, battleInfo, callbacks }) => {
      // 只选取没有自愈状态的存活友军
      const candidates = allies.filter(
        (e) => e.hp > 0 && (!e.state || !e.state.selfHeal)
      );
      const target = getRandomUnitInCollection(candidates, {
        includeSneak: true
      });

      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }

     await addState("selfHeal", 3, self, target, {}, {
        battleInfo, callbacks
      });

      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  sweep: {
    id: "sweep",
    name: "横扫",
    tire: 2,
    target: "all_enemy",
    targetCount: 99,
    colddown: 4,
    mpCost: 10,
    effectStr: "对所有敌人造成(10 + 攻击力(80 + 技能等级*1)% + 力量(50 + 技能等级*1)%)点伤害",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const strength = getUnitStatusInBattle(self, 'strength', { battleInfo, callbacks });
      let skillLevel = (self.skills.sweep?.level ?? 1);
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      let baseDamage = Math.floor(
        10 + Math.floor(attack * (0.8 + skillLevel * 0.01) + strength * (0.5 + skillLevel * 0.01))
      );

      results.damage = await dealAoeDamage(self, enemies, () => baseDamage, {
          damageType: DamageType.Physical,
          battleInfo,
          dealDamageCallback,
      })
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      return results;
    },
  },

  baseGroupHeal: {
    id: "baseGroupHeal",
    name: "基础群体治疗",
    tire: 2,
    target: "all_ally",
    targetCount: 99,
    colddown: 6,
    mpCost: 25,
    effectStr: "为所有友方单位回复(10 + 智力60% + 技能等级*2)点生命值",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Heal],

    effect: async ({ self, allies, battleInfo, healCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const healValue =
        +(
          10 +
          (intelligence * 0.6) +
          +((self.skills.baseGroupHeal?.level ?? 1) * 2)
        ).toFixed(0);
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      for (const ally of allies.filter((a) => a.hp > 0)) {
        await healUnit(self, ally, healValue, {
          battleInfo,
          callbacks,
          reason: HpRestoreReason.SKILL_EFFECT,
          callback: healCallback,
        });

        results.heal![ally.uuid] = healValue;
        results.targetUnitUuidList.push(ally.uuid);
      }

      return results;
    },
  },

  powerStrike: {
    id: "powerStrike",
    name: "重击",
    tire: 2,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 3,
    mpCost: 10,
    effectStr:
      "对行动顺序最前方的敌人造成(10 + 力量120% + 攻击力150% + 技能等级*2)点伤害，忽略50%防御。",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const aliveEnemies = getAvailableUnitCollection(enemies);
      if (aliveEnemies.length === 0) return undefined;

      let target: BaseBattleUnit | null = null
      for(const uuid of battleInfo.turnOrder) {
        if (!uuid) continue;
        const unit = aliveEnemies.find(e => e.uuid === uuid);

        if (!!unit && unit.hp > 0) {
          target = unit;
          break;
        }
      }

      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const strength = getUnitStatusInBattle(self, 'strength', { battleInfo, callbacks });
      const skillLevel = self.skills.powerStrike?.level ?? 1;
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const damage = Math.floor(10 + strength * 1.2 + skillLevel * 2 + attack * 1.5);

      let d = await dealDamage(self, target, damage, {
        ignoreDefencePercent: 50,
        damageType: DamageType.Physical,
        battleInfo,
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: "powerStrike"
        }
      });

      return {
        type: "skill",
        damage: { [target.uuid]: d },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  // todo
  guardianLaser: {
    id: "guardianLaser",
    name: "守护者激光",
    tire: 3,
    target: "all_enemy",
    targetCount: 99,
    colddown: 11,
    mpCost: 60,
    effectStr:
      "对所有敌人造成(10 + 目标当前生命值(15 + 技能等级*0.15)% + 技能等级*2)点伤害，忽略30%防御值，并对其施加“激光抵抗”\n该伤害不会使目标生命值低于1点。\n该伤害中，对当前生命值进行计算的部分，伤害不会超过自身攻击力500%",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const skillLevel = self.skills.guardianLaser?.level ?? 1;
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      let targets = getAvailableUnitCollection(enemies)

      results.damage = await dealAoeDamage(self, targets, (target) => {
        let baseDamage = Math.floor(10 + skillLevel * 2);
        let targetHpPercentDamage = Math.floor(target.hp * (0.15 + skillLevel * 0.0015))

        if (hasEquipment(self, "overloadGuardianCore")) {
          let itemLevel = getUnitEquipmentLevel(self, "overloadGuardianCore")
          let levelDamagePercent = 0 + (itemLevel > 0 ? 0.005 + itemLevel * 0.005 : 0)

          targetHpPercentDamage = Math.floor(target.maxHp * (0.15 + levelDamagePercent + skillLevel * 0.0015))
        }

        const selfAttack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
        targetHpPercentDamage = Math.min(selfAttack * 5, targetHpPercentDamage);

        let finalDamage = Math.floor(baseDamage + targetHpPercentDamage);

        if (target.state?.guardianLaserResist?.remainingDuration) {
          finalDamage = Math.floor(finalDamage * 0.5);
        }

        return finalDamage;
      }, {
        ignoreDefencePercent: 30,
        damageType: DamageType.Magical,
        battleInfo,
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: "guardianLaser"
        }
      });
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      for (const target of targets) {
        if (!hasEquipment(self, "overloadGuardianCore") || getUnitEquipmentLevel(self, "overloadGuardianCore") < 3) {
          if (target.hp < 1) target.hp = 1;
        }

       await addState("guardianLaserResist", 2, self, target, {
        }, {
          battleInfo, callbacks,
        });
      }

      return results;
    },
  },

  // todo
  lavaBreath: {
    id: "lavaBreath",
    name: "熔岩吐息",
    tire: 3,
    target: "all_enemy",
    targetCount: 99,
    colddown: 6,
    mpCost: 35,
    effectStr:
      "对所有敌人造成(18 + 攻击力(110 + 技能等级*2)%)点伤害\n并有40%概率使目标灼烧，持续4回合）",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const skillLevel = self.skills.lavaBreath?.level ?? 1;
      const baseDamage = Math.floor(18 + attack * (1.1 + skillLevel * 0.02));

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      results.damage = await dealAoeDamage(self, enemies, () => baseDamage, {
          damageType: DamageType.Magical,
          dealDamageCallback,
          battleInfo,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: "lavaBreath"
          }
      });
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      for (const target of enemies.filter((e) => e.hp > 0)) {
        // 40%概率灼烧
        if (await checkRandomPercentAboutUnit(self, 0.4, {battleInfo, callbacks})) {
         await addState("burn", 4, self, target, {}, {
            battleInfo, callbacks
          });
        }
      }

      return results;
    },
  },

  dragonRoar: {
    id: "dragonRoar",
    name: "龙之咆哮",
    tire: 3,
    target: "all_enemy",
    targetCount: 99,
    colddown: 6,
    mpCost: 25,
    effectStr: "震慑所有敌人，造成（自身最大生命值40% + 耐力130%）的伤害，并使其攻击、防御降低(8 + 技能等级*1)，持续1回合",

    damageType: DamageType.Physical,
    skillType: [SkillType.Debuff, SkillType.Damage],

    effect: async (obj) => {
      const { self, enemies, battleInfo, dealDamageCallback, callbacks, skillExtraParam } = obj;
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      const stamina = getUnitStatusInBattle(self, 'stamina', { battleInfo, callbacks });
      let damage = Math.round(self.maxHp * 0.4 + stamina * 1.3);

      if (!!skillExtraParam?.damageModifyPercent) {
        damage = damage * (1 + skillExtraParam?.damageModifyPercent)
      }

      results.damage = await dealAoeDamage(self, enemies, () => damage, {
        damageType: DamageType.Physical,
        dealDamageCallback,
        battleInfo,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: "dragonRoar"
        }
      })
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      for (const target of enemies.filter((e) => e.hp > 0)) {
        let debuffValue = Math.floor(8 + (self.skills.dragonRoar?.level ?? 1) * 1);

       await addState("dragonRoarDebuff", 1, self, target, {
          thisStateActuralValue: debuffValue,
        }, {
          battleInfo, callbacks
        });
        results.targetUnitUuidList.push(target.uuid);
      }

      return results;
    },
  },

  doubleStrike: {
    id: "doubleStrike",
    name: "双重打击",
    tire: 1,
    target: "multi_random_enemy",
    targetCount: 2,
    colddown: 4,
    mpCost: 10,
    effectStr:
      "对随机两个敌人各造成(15 + 敏捷140% + 攻击力(140 + 技能等级*2)%)点伤害",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const skillLevel = self.skills.doubleStrike?.level ?? 1;
      const dexterity = getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      const baseDamage = Math.floor(
        15 + attack * 1.4 + dexterity * (1.4 + skillLevel * 0.02)
      );

      // 随机选出两个不同的存活敌人
      const aliveEnemies = enemies.filter((e) => e.hp > 0);
      const selected = getRandomUnitsInCollection(aliveEnemies, 2)

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      results.damage = await dealAoeDamage(self, selected, () => baseDamage, {
          damageType: DamageType.Physical,
          battleInfo,
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'doubleStrike'
          }
      })
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      return results;
    },
  },

  lowestHpStrike: {
    id: "lowestHpStrike",
    name: "弱点打击",
    tire: 2,
    target: "single_enemy",
    targetCount: 1,
    colddown: 4,
    mpCost: 10,
    effectStr:
      "对生命值最低的敌人造成(15 + 攻击力100% + 敏捷(120 + 技能等级*3)%)点伤害，目标每失去10%生命值，伤害增加（攻击力20%）点",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      // 找到生命值最低且存活的敌人
      const aliveEnemies = enemies.filter((e) => e.hp > 0);
      if (aliveEnemies.length === 0) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const target = aliveEnemies.reduce(
        (min, curr) => (curr.hp < min.hp ? curr : min),
        aliveEnemies[0]
      );
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const dex =  getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      const skillLevel = self.skills.lowestHpStrike?.level ?? 1;
      let damage = Math.max(
        1,
        Math.floor(15 + attack * 1 + dex * (1.2 + skillLevel * 0.03))
      );

      damage += Math.floor(
        ((target.maxHp - target.hp) / target.maxHp) * 10 * (attack * 0.2)
      );

      const damageRes = await dealDamage(self, target, damage, {
        damageType: DamageType.Physical,
        battleInfo,
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'lowestHpStrike'
        }
      });

      return {
        type: "skill",
        damage: { [target.uuid]: damageRes },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  explosiveShot: {
    id: "explosiveShot",
    name: "爆炸射击",
    tire: 2,
    target: "multi_random_enemy",
    targetCount: 3,
    colddown: 6,
    mpCost: 20,
    effectStr:
      "对随机一个主要目标造成(10 + 攻击力(150 + 技能等级*8)%点伤害\n对另外两个敌人各造成(10 + 攻击力(80 + 技能等级*4)%)点伤害",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const aliveEnemies = getAvailableUnitCollection(enemies)
      if (aliveEnemies.length === 0) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }

      // 随机选出最多3个不同的敌人
      const selected = getRandomUnitsInCollection(aliveEnemies, 3)

      const dex =  getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const skillLevel = self.skills.explosiveShot?.level ?? 1;

      const mainTarget = selected[0];
      const splashTargets = selected.slice(1);

      const mainDamage = Math.max(
        1,
        Math.floor(10 + attack * (1.5 + skillLevel * 0.08))
      );

      const splashDamage = Math.max(
        1,
        Math.floor(10 + attack * (0.8 + skillLevel * 0.04))
      );

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      if (mainTarget) {
        let realDamage = await dealDamage(self, mainTarget, mainDamage, {
          damageType: DamageType.Physical,
          battleInfo,
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'lowestHpStrike'
          }
        });

        results.damage![mainTarget.uuid] = realDamage;
        results.targetUnitUuidList.push(mainTarget.uuid);
      }

      for (const target of splashTargets) {
        let realDamage = await dealDamage(self, target, splashDamage, {
          damageType: DamageType.Physical,
          battleInfo, 
          dealDamageCallback
        });

        results.damage![target.uuid] = realDamage;
        results.targetUnitUuidList.push(target.uuid);
      }

      return results;
    },
  },

  freeze: {
    id: "freeze",
    name: "冻结",
    tire: 1,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 3,
    mpCost: 25,
    effectStr:
      "对随机敌人造成(6 + 智力110% + 技能等级*4)点伤害，并有(30% + 技能等级*1)概率使其冻结（跳过下回合）",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks, }) => {
      const target = getRandomUnitInCollection(enemies);
      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });

      let damage = Math.max(
        1,
        Math.floor(6 + intelligence * 1.1 + self.skills.freeze!.level * 4)
      );

      const damageRes = await dealDamage(self, target, damage, {
        damageType: DamageType.Magical,
        battleInfo,
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'freeze'
        }
      });

      // 30%概率冻结
      const percent = 0.3 + self.skills.freeze!.level * 1;
      if (await checkRandomPercentAboutUnit(self, percent, {battleInfo, callbacks})) {
       await addState("frozen", 1, self, target, {}, {
          battleInfo,
          callbacks
        });
      }

      return {
        type: "skill",
        damage: { [target.uuid]: damageRes },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  iceBomb: {
    id: "iceBomb",
    name: "冰弹",
    tire: 1,
    target: "multi_random_enemy",
    targetCount: 2,
    colddown: 3,
    mpCost: 15,
    effectStr: "对随机两个敌人各造成(8 + 攻击力150% + 技能等级*4)点伤害，并有40%概率造成2回合冻结",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const baseDamage = Math.floor(
        8 + attack * 1.5 + self.skills.iceBomb!.level * 4
      );

      const aliveEnemies = getAvailableUnitCollection(enemies)
      const selected = getRandomUnitsInCollection(aliveEnemies, 2)

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      results.damage = await dealAoeDamage(self, selected, () => baseDamage, {
          damageType: DamageType.Physical,
          battleInfo,
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'iceBomb'
          }
      });
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      for (const target of selected) {
        // 30%概率冻结
        if (await checkRandomPercentAboutUnit(self, 0.4, {battleInfo, callbacks})) {
         await addState("frozen", 2, self, target, {}, {
            battleInfo,
            callbacks,
          });
        }
      }

      return results;
    },
  },
  lifeDrain: {
    id: "lifeDrain",
    name: "吸血",
    tire: 2,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 5,
    mpCost: 40,
    effectStr:
      "对随机敌人造成(5 + 智力(80 + 技能等级*1)%)点伤害，无视防御，并为自身回复与最终伤害等量的生命值",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo,healCallback, dealDamageCallback, callbacks }) => {
      const target = getRandomUnitInCollection(enemies);
      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      let damage = Math.max(
        1,
        Math.floor(5 + intelligence * (0.6 + self.skills.lifeDrain!.level * 0.01))
      );

      const damageRes = await dealDamage(self, target, damage, {
        ignoreDefence: true,
        damageType: DamageType.Magical,
        battleInfo,
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'lifeDrain'
        }
      })

      await healUnit(self, self, damage, {
          battleInfo,
          callbacks,
          reason: HpRestoreReason.SKILL_EFFECT,
          callback: healCallback,
      });

      return {
        type: "skill",
        damage: { [target.uuid]: damageRes },
        heal: { [self.uuid]: damage },
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  roar: {
    id: "roar",
    name: "咆哮",
    tire: 2,
    target: "all_enemy",
    targetCount: 99,
    colddown: 6,
    mpCost: 20,
    effectStr:
      "对所有敌人造成(10 + 力量80% + 耐力(120 + 技能等级*2)%)点伤害，忽视50%防御",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks, skillExtraParam }) => {
      const strength = getUnitStatusInBattle(self, 'strength', { battleInfo, callbacks });
      const satmina = getUnitStatusInBattle(self, 'stamina', { battleInfo, callbacks });
      let skillLevel = (self.skills.roar?.level ?? 1)
      // (10 + 力量25% + 体质25% + 技能等级*0.2)
      let baseDamage = Math.floor(
        10 +
          strength * 0.8 +
          satmina * (1.2 + skillLevel * 0.02)
      );

      if (!!skillExtraParam?.damageModifyPercent) {
        baseDamage = baseDamage * (1 + skillExtraParam?.damageModifyPercent)
      }

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      results.damage = await dealAoeDamage(self, enemies, () => baseDamage, {
        ignoreDefencePercent: 50,
        damageType: DamageType.Physical,
        battleInfo,
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'roar'
        }
      });
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      return results;
    },
  },
  blizzard: {
    id: "blizzard",
    name: "暴风雪",
    tire: 3,
    target: "all_enemy",
    targetCount: 99,
    colddown: 7,
    mpCost: 30,
    effectStr:
      "对所有敌人造成(6 + 智力(80 + 技能等级*4)%)点伤害，并有(30 + 技能等级*0.8)%概率冻结目标",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {

      let level = self.skills.blizzard!.level ?? 1;

      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const baseDamage = Math.floor(
        6 + intelligence * (0.8 + level * 0.04)
      );

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      results.damage = await dealAoeDamage(self, enemies, () => baseDamage, {
          damageType: DamageType.Magical,
          battleInfo,
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'blizzard'
          }
      });
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      for (const target of enemies.filter((e) => e.hp > 0)) {
        // 30%概率冻结
        if (await checkRandomPercentAboutUnit(self, 0.3 + level * 0.008, {battleInfo, callbacks})) {
         await addState("frozen", 1, self, target, {}, {
            battleInfo,
            callbacks,
          });
        }
      }

      return results;
    },
  },

  ironWall: {
    id: "ironWall",
    name: "铁壁",
    tire: 1,
    target: "self",
    targetCount: 1,
    colddown: 5,
    mpCost: 5,
    effectStr: "提升防御，数值相当于(5 + 耐力*60% + 技能等级*1）”，持续3回合。期间受到的所有降低30%",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff],

    effect: async (obj) => {
      const { self } = obj;
      if (!self.state) self.state = {};

      const stamina = getUnitStatusInBattle(self, 'stamina', { battleInfo: obj.battleInfo, callbacks: obj.callbacks }); 

      let value = 5 + Math.floor(stamina * 0.6) + (self.skills.ironWall?.level ?? 1);

     await addState("ironWall", 3, self, self, {
        thisStateActuralValue: value,
      }, {
        battleInfo: obj.battleInfo, callbacks: obj.callbacks
      });

      return {
        type: "skill",
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
    tire: 1,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 3,
    mpCost: 10,
    effectStr: "使随机目标虚弱，攻击、防御降低（6 + 技能等级*1），持续3回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],

    effect: async (obj) => {
      const { self, enemies, battleInfo, callbacks } = obj;
      const target = getRandomUnitInCollection(enemies);

      if (!target)
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };

        let value = 6 + (self.skills.curse?.level ?? 1);

     await addState("curse", 3, self, target, {
        thisStateActuralValue: value,
      }, {
        battleInfo,
        callbacks,
        addStateCallback: obj.addStateCallback
      });

      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  shadowBurst: {
    id: "shadowBurst",
    name: "暗影爆发",
    tire: 3,
    target: "all_enemy",
    targetCount: 99,
    mpCost: 45,
    colddown: 6,
    effectStr: "对所有敌人造成(18 + 智力90% + 技能等级*3)点伤害，对生命值高于70%的单位造成额外智力50%伤害",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const skillLevel = self.skills.shadowBurst?.level ?? 1;
      const baseDamage = Math.floor(18 + intelligence * 0.9 + skillLevel * 3);
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      const hasAncestorCrown = hasEquipment(self, "ancestorCrown");
      const ancestorCrownEnhanceLevel = getUnitEquipmentLevel(self, "ancestorCrown");

      const enhancedLowHpThresholdPercent = [
        { percent: 0.3, extra: 0.5, },
        { percent: 0.33, extra: 0.53, },
        { percent: 0.36, extra: 0.56, },
        { percent: 0.4, extra: 0.6, },
        { percent: 0.5, extra: 0.7, },
      ]

      results.damage = await dealAoeDamage(self, enemies, (target) => {
        let finalDamage = baseDamage

        if (target.hp > target.maxHp * 0.7) {
          finalDamage += Math.floor(intelligence * 0.5);
        }

        if (hasAncestorCrown && ancestorCrownEnhanceLevel > 0) {
          let percent = enhancedLowHpThresholdPercent[ancestorCrownEnhanceLevel - 1].percent;
          let extra = enhancedLowHpThresholdPercent[ancestorCrownEnhanceLevel - 1].extra;
          if (target.hp < (target.maxHp * percent)) {
            finalDamage += Math.floor(intelligence * extra);
          }
        }

        return finalDamage
      }, {
          damageType: DamageType.Magical,
        battleInfo, 
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'shadowBurst'
          }
      });
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      for (const target of enemies) {
        if (target.hp <= 0 && ancestorCrownEnhanceLevel == 5) {
         await addState("ancestorCrownRefreshSkill", 2, self, self, {}, {
            battleInfo, callbacks
          });
        }
      }
      return results;
    },
  },

  groupCurse: {
    id: "groupCurse",
    name: "群体诅咒",
    tire: 2,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 5,
    mpCost: 20,
    effectStr: "诅咒敌方全体，使其虚弱，攻击、防御降低（6 + 技能等级*1），持续3回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],

    effect: async (obj) => {
      const { self, enemies, battleInfo, callbacks } = obj;

      for (const enemy of enemies) {
        if (!enemy.state) {
          enemy.state = {};
        }

        let value = 6 + (self.skills.groupCurse?.level ?? 1);

       await addState("curse", 3, self, enemy, {
          thisStateActuralValue: value,
        }, {
          battleInfo,
          callbacks,
          addStateCallback: obj.addStateCallback
        });
      }

      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: enemies.map((e) => e.uuid),
        sourceUnitUuid: self.uuid,
      };
    },
  },

  holyLight: {
    id: "holyLight",
    name: "神圣之光",
    tire: 2,
    target: "single_random_ally",
    targetCount: 1,
    colddown: 6,
    mpCost: 35,
    effectStr:
      "为一名生命值最低的友方单位回复(30 + 智力(110 + 技能等级*2)%)点生命，为其余友军恢复(10 + 智力(65 + 技能等级*1)%)点生命。",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Heal],

    preCheck: ({ allies }) => {
      // 只有存在存活的友军时，且血量不全时才可释放
      return allies.some((a) => a.hp > 0 && a.hp < a.maxHp);
    },
    effect: async ({ self, allies, battleInfo, healCallback, callbacks }) => {
      // 找到生命值最低的存活友军
      const aliveAllies = allies.filter((a) => a.hp > 0);
      if (aliveAllies.length === 0) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const target = aliveAllies.reduce(
        (min, curr) => (curr.hp < min.hp ? curr : min),
        aliveAllies[0]
      );

      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const skillLevel = self.skills.holyLight?.level ?? 1;
      const mainHeal = Math.floor(30 + intelligence * (1.1 + skillLevel * 0.02));
      const otherHeal = Math.floor(10 + intelligence * (0.65 + skillLevel * 0.01));

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      await healUnit(self, target, mainHeal, {
        battleInfo,
        callbacks,
        reason: HpRestoreReason.SKILL_EFFECT,
        callback: healCallback,
      });

      results.heal![target.uuid] = mainHeal;
      results.targetUnitUuidList.push(target.uuid);

      // 其余友军治疗
      for (const ally of aliveAllies) {
        if (ally.uuid === target.uuid) continue;

        await healUnit(self, ally, otherHeal, {
          battleInfo,
          callbacks,
          reason: HpRestoreReason.SKILL_EFFECT,
          callback: healCallback,
        });

        results.heal![ally.uuid] = otherHeal;
        results.targetUnitUuidList.push(ally.uuid);
      }

      return results;
    },
  },

  bless: {
    id: "bless",
    name: "祝福",
    tire: 2,
    target: "all_ally",
    targetCount: 99,
    colddown: 10,
    mpCost: 25,
    effectStr:
      "为所有友方单位提升攻击与防御(6 + 智力(20 + 技能等级*1)%)，持续3回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff],

    effect: async ({ self, allies, addStateCallback, battleInfo, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const skillLevel = self.skills.bless?.level ?? 1;
      const buffValue = Math.floor(6 + intelligence * (0.2 + skillLevel * 0.01));

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };
      for (const ally of allies.filter((a) => a.hp > 0)) {
       await addState("bless", 3, self, ally, { thisStateActuralValue: buffValue }, {
          battleInfo,
          callbacks,
          addStateCallback
        });
        results.targetUnitUuidList.push(ally.uuid);
      }
      return results;
    },
  },

  revive: {
    id: "revive",
    name: "复活",
    tire: 3,
    target: "single_random_ally",
    targetCount: 1,
    colddown: 20,
    mpCost: 40,
    effectStr:
      "随机复活一名阵亡友方单位，并回复其(40 + 智力60% + 技能等级*1)点生命，30%的魔法值，复活后清除所有状态。",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Revive],

    preCheck: ({ allAllies }) => {
      // 只有存在已阵亡的友军时才可释放
      let has = allAllies.some((a) => {
        // 不可复活的单位不能作为复活目标
        if (hasStateCauseForbidRevive(a)) {
          return false;
        }
        return a.hp <= 0 && !a.isSummoned && !a.state?.tmpUnit;
      });
      return has;
    },
    effect: async ({ self, allAllies, battleInfo, callbacks }) => {
      // 只找已阵亡的友军
      const candidates = allAllies.filter((a) => a.hp <= 0 && !a.isSummoned && !a.state?.tmpUnit && !hasStateCauseForbidRevive(a));
      const target = getRandomUnitInCollection(candidates, {
        includeDead: true,
        includeSneak: true,
      });
      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const skillLevel = self.skills.revive?.level ?? 1;
      const healValue = Math.floor(40 + intelligence * 0.6 + skillLevel * 2);

      target.hp = Math.floor(Math.min(healValue, target.maxHp));
      target.mp = Math.floor(Math.min(Math.floor(target.maxMp * 0.3), target.maxMp));

      // 清除所有buff和死亡相关状态
      if (target.state) {
        for (const stateId of ObjectKeys<AllBattleStateId>(target.state)) {
          let stateInfo = allBattleState[stateId] as BattleState
          if (!stateInfo.unremovable && !stateInfo.keepOnDeath) {
            detachState(stateId, target, battleInfo, {
              callbacks
            })
          }
        }
      }

      return {
        type: "skill",
        damage: {},
        heal: { [target.uuid]: target.hp },
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  groupRegen: {
    id: "groupRegen",
    name: "群体再生",
    tire: 2,
    target: "all_ally",
    targetCount: 99,
    mpCost: 30,
    colddown: 7,
    effectStr:
      "为所有友方单位附加再生状态(每回合回复10 + 智力(35 + 技能等级*2.5)%)点生命，持续3回合）",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Heal, SkillType.Buff],

    effect: async ({ self, allies, addStateCallback, battleInfo, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const skillLevel = self.skills.groupRegen?.level ?? 1;
      const regenValue = Math.floor(10 + intelligence * (0.3 + skillLevel * 0.025));
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };
      for (const ally of allies.filter((a) => a.hp > 0)) {
       await addState("regen", 3, self, ally, { thisStateActuralValue: regenValue }, {
          addStateCallback,
          battleInfo,
          callbacks,
        });
        results.targetUnitUuidList.push(ally.uuid);
      }
      return results;
    },
  },

  astralBarrier: {
    id: "astralBarrier",
    name: "星辉结界",
    tire: 2,
    target: "all_ally",
    targetCount: 99,
    mpCost: 25,
    colddown: 7,
    effectStr: "为所有友方单位提升防御（10 + 智力50% + 技能等级*1）,并使他们受到的第一次超过最大生命值30%的伤害降低至0，持续3回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff],

    effect: async ({ self, allies, battleInfo, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const skillLevel = self.skills.astralBarrier?.level ?? 1;
      const buffValue = Math.floor(10 + intelligence * 0.5 + skillLevel * 1);
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };
      for (const ally of allies.filter((a) => a.hp > 0)) {
        if (ally.state?.astralBarrier) {
          writeStateExtraInfo(ally.state?.astralBarrier, "remainingTimes", 1);
        }
       await addState("astralBarrier", 3, self, ally, {
          thisStateActuralValue: buffValue,
        }, {
          battleInfo, callbacks
        });
        results.targetUnitUuidList.push(ally.uuid);
      }
      return results;
    },
  },

  astralBlast: {
    id: "astralBlast",
    name: "星辉冲击",
    tire: 2,
    target: "all_enemy",
    targetCount: 99,
    mpCost: 40,
    colddown: 8,
    effectStr:
      "对所有敌人造成(8 + 智力(70 + 技能等级*1.5)%)点魔法伤害，并有(30 + 技能等级*1)%概率使目标沉默（2回合，无法释放技能）",

      damageType: DamageType.Magical,
      skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const skillLevel = self.skills.astralBlast?.level ?? 1;
      const baseDamage = Math.floor(16 + intelligence * (0.7 + skillLevel * 0.01));

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      let allTargets = getAvailableUnitCollection(enemies, {
        includeSneak: true,
      })

      let extraDamagePerUnit = 0;
      if (hasEquipment(self, "starDustMagicBook")) {
        let itemLevel = getUnitEquipmentLevel(self, "starDustMagicBook")
        if (itemLevel >= 3) {
          extraDamagePerUnit = Math.floor(Math.max(intelligence * 0.20, 200 / allTargets.length))
        }
      }

      let addDebuff = false;
      let hasCrown = hasEquipment(self, "starCrown")
      let crownEnhanceLevel = getUnitEquipmentLevel(self, "starCrown")
      if (hasCrown) {
        if (crownEnhanceLevel > 4) {
          addDebuff = true;
          for (const target of allTargets) {
            // 30%概率沉默2回合
            if (await checkRandomPercentAboutUnit(self, 0.3 + skillLevel * 0.01, {battleInfo, callbacks})) {
             await addState("silence", 2, self, target, {}, {
                battleInfo,
                callbacks
              });
            }
          }
        }
      }

      results.damage = await dealAoeDamage(self, allTargets, (target) => {
        let thisUnitDamage = baseDamage + extraDamagePerUnit

        if (hasCrown) {
          if (hasStateCauseForbidCastSkill(target) || hasState(target, 'stun')) {
            thisUnitDamage = thisUnitDamage * (1 + (0.55 + crownEnhanceLevel * 0.05))
          }
        }

        return thisUnitDamage
      }, {
          damageType: DamageType.Magical,
          battleInfo,
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'astralBlast'
          }
      });
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      for (const target of allTargets) {
        // 30%概率沉默2回合
        if (!addDebuff) {
          if (await checkRandomPercentAboutUnit(self, 0.3 + skillLevel * 0.01, {battleInfo, callbacks})) {
           await addState("silence", 2, self, target, {} ,{
              battleInfo,
              callbacks
            });
          }
        }
      }

      return results;
    },
  },

  groupSilence: {
    id: "groupSilence",
    name: "群体沉默",
    tire: 3,
    target: "all_enemy",
    targetCount: 99,
    colddown: 12,
    mpCost: 60,
    effectStr: "使所有敌人有(40% + 智力50% + 技能等级*1)概率沉默，持续2回合\n未被沉默的敌人获得“遗言”，持续3回合。",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],

    effect: async ({ self, enemies, addStateCallback, battleInfo, callbacks }) => {
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      for (const target of enemies.filter((e) => e.hp > 0)) {
        let percent = 0.4 + intelligence * 0.5 + (self.skills.groupSilence?.level ?? 1) * 0.01;

        if (await checkRandomPercentAboutUnit(self, percent, {battleInfo, callbacks})) {
          // 70%概率沉默2回合
         await addState("silence", 2, self, target, {}, {
            battleInfo, callbacks,
            addStateCallback
          });
        } else {
          // 没有被沉默的敌人获得遗言状态
         await addState("lastWord", 3, self, target, {}, {
            battleInfo, callbacks,
            addStateCallback
          });
        }
        //await addState("silence", 2, self, target);
        results.targetUnitUuidList.push(target.uuid);
      }
      return results;
    },
  },

  selfRepair: {
    id: "selfRepair",
    name: "自我修复",
    tire: 2,
    target: "self",
    targetCount: 1,
    colddown: 5,
    mpCost: 10,
    effectStr:
      "为自身回复(20 + 耐力(100% + 技能等级*2)%)点生命，并移除一个随机的负面状态",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Heal],

    effect: async ({ self, battleInfo, healCallback, callbacks }) => {
      const stamina = getUnitStatusInBattle(self, 'stamina', { battleInfo, callbacks });
      const skillLevel = self.skills.selfRepair?.level ?? 1;
      const healValue = Math.floor(20 + stamina * (1 + skillLevel * 0.02));

      await healUnit(self, self, healValue, {
        battleInfo,
        callbacks,
        reason: HpRestoreReason.SKILL_EFFECT,
        callback: healCallback,
      });

      // 移除一个随机的负面状态
      const debuffStates = ObjectKeys<AllBattleStateId>(
        self.state ?? {}
      ).filter((stateId: AllBattleStateId) => {
        const state = self.state?.[stateId];
        // 只移除debuff且剩余回合大于0
        return (
          state &&
          state.remainingDuration > 0 &&
          !!allBattleState[stateId]?.isDebuff
        );
      });
      let removedStateId: AllBattleStateId | undefined = undefined;
      if (debuffStates.length > 0) {
        removedStateId = randomElementInCollection(debuffStates);
        if (removedStateId && self.state) {
          delete self.state[removedStateId];
        }
      }

      return {
        type: "skill",
        damage: {},
        heal: { [self.uuid]: healValue },
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
        removedStateId,
      };
    },
  },

  cleanse: {
    id: "cleanse",
    name: "驱散",
    tire: 2,
    target: "single_random_ally",
    targetCount: 1,
    colddown: 4,
    mpCost: 5,
    effectStr: "为随机一名有负面状态的友方单位移除所有负面状态",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff],

    preCheck: ({ allies }) => {
      // 只有存在有debuff的存活友军时才可释放
      return allies.some(
        (a) =>
          a.hp > 0 &&
          a.state &&
          ObjectKeys<AllBattleStateId>(a.state).some(
            (stateId) =>
              !!allBattleState[stateId]?.isDebuff &&
              // @ts-ignore
              !allBattleState[stateId]?.unremovable &&
              (a.state?.[stateId]?.remainingDuration ?? 0) > 0
          )
      );
    },
    effect: async ({ self, allies }) => {
      // 只选择有debuff且存活的友方
      const candidates = allies.filter(
        (a) =>
          a.hp > 0 &&
          a.state &&
          ObjectKeys<AllBattleStateId>(a.state).some(
            (stateId) =>
              !!allBattleState[stateId]?.isDebuff &&
              // @ts-ignore
              !allBattleState[stateId]?.unremovable &&
              (a.state?.[stateId]?.remainingDuration ?? 0) > 0
          )
      );
      const target = getRandomUnitInCollection(candidates, {
        includeSneak: true,
      });

      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }

      // 移除所有debuff
      const removedStates: AllBattleStateId[] = [];
      if (target.state) {
        for (const stateId of ObjectKeys<AllBattleStateId>(target.state)) {
          if (allBattleState[stateId]?.isDebuff &&
              // @ts-ignore
              !allBattleState[stateId]?.unremovable
          ) {
            delete target.state[stateId];
            removedStates.push(stateId);
          }
        }
      }

      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
        removedStates,
      };
    },
  },

  cometStrike: {
    id: "cometStrike",
    name: "彗星打击",
    tire: 2,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 3,
    mpCost: 20,
    effectStr:
      "对随机敌人造成(10 + 智力(130 + 技能等级*4)%)点伤害，并有40%概率使目标沉默2回合",

    damageType: DamageType.Magical,
    skillType: [SkillType.Debuff, SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const skillLevel = self.skills.cometStrike?.level ?? 1;
      const baseDamage = Math.floor(10 + intelligence * (1.5 + skillLevel * 0.04));

      let res: FullBattleAction = {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
      }

      let targets: BaseBattleUnit[] = []

      if (hasEquipment(self, "starDustMagicBook")) {
        for(let i =0 ; i < 2; i++) {
          let sTarget = getRandomUnitInCollection(enemies)
          if (sTarget) {
            targets.push(sTarget);
          }
        }
      } else {
        let sTarget = getRandomUnitInCollection(enemies)
        if (sTarget) {
          targets = [sTarget];
        }
      }

      if (!targets.length) {
        return res;
      }

      for(const target of targets) {
        const damage = await dealDamage(self, target, baseDamage, {
          damageType: DamageType.Magical,
          battleInfo,
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'cometStrike'
          }
        });

        // 40%概率沉默2回合
        if (await checkRandomPercentAboutUnit(self, 0.4, {battleInfo, callbacks})) {
         await addState("silence", 2, self, target, {}, {
            battleInfo, callbacks,
          });
        }

        res.damage![target.uuid] = damage;
        res.targetUnitUuidList.push(target.uuid);
      }
      return res
    },
  },

  armorBreak: {
    id: "armorBreak",
    name: "破甲",
    tire: 2,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 4,
    mpCost: 10,
    effectStr:
      "对防御最高的敌人造成(12 + 攻击力100% + 敏捷(160 + 技能等级*3)%)点伤害，忽略50%防御，然后使其防御-30%，持续2回合",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const attack =  getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const skillLevel = self.skills.armorBreak?.level ?? 1;
      const dex = getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      const baseDamage = Math.floor(
        8 + attack * 1 + dex * (1.6 + skillLevel * 0.03)
      );

      // 找到防御最低且存活的敌人
      const aliveEnemies = getAvailableUnitCollection(enemies)
      if (aliveEnemies.length === 0) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      // 选择防御最高的敌人
      const target = aliveEnemies.reduce((max, curr) =>
        curr.status.defencing.level > max.status.defencing.level ? curr : max,
        aliveEnemies[0]
      );

      // 伤害忽略50%防御
      const damage = await dealDamage(self, target, baseDamage, {
        ignoreDefencePercent: 50,
        damageType: DamageType.Physical,
        battleInfo,
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'armorBreak'
        }
      });

      // 添加防御-20%的debuff，持续2回合
      const targetDefence = getUnitStatusInBattle(target, 'defencing', { battleInfo, callbacks });
      let decreaseDefence = Math.floor(targetDefence * 0.30)
     await addState("armorBreak", 2, self, target, { thisStateActuralValue: decreaseDefence }, {
        battleInfo,
        callbacks
      });

      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  starTrap: {
    id: "starTrap",
    name: "星辰陷阱",
    tire: 2,
    target: "multi_random_enemy",
    targetCount: 2,
    colddown: 4,
    mpCost: 15,
    effectStr:
      "对随机两个敌人造成(10 + 智力(100% + 技能等级*3)%)点伤害，并有50%概率使其眩晕2回合",

    damageType: DamageType.Magical,
    skillType: [SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const skillLevel = self.skills.starTrap?.level ?? 1;
      const baseDamage = Math.floor(10 + intelligence * (1 + skillLevel * 0.03));

      // 随机选出两个不同的存活敌人
      const aliveEnemies = getAvailableUnitCollection(enemies)
      const selected: typeof aliveEnemies = getRandomUnitsInCollection(aliveEnemies, 2);

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      if (selected.length === 0) {
        return results;
      }

      results.damage = await dealAoeDamage(self, selected, () => baseDamage, {
          damageType: DamageType.Magical,
          battleInfo, 
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'starTrap'
          }
      });
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      for (const target of selected) {
        // 50%概率眩晕2回合
        if (await checkRandomPercentAboutUnit(self, 0.5, {battleInfo, callbacks})) {
         await addState("stun", 2, self, target, {}, {
            battleInfo,
            callbacks
          });
        }
      }

      return results;
    },
  },

  emperorCatFinale_forAstralEmpressBoss: {
    id: "emperorCatFinale_forAstralEmpressBoss",
    name: "星辉终极裁决",
    target: "all_enemy",
    targetCount: 99,
    colddown: 14,
    mpCost: 50,
    effectStr:
      "对所有敌人造成500 + (30 + 智力120% + 技能等级*2)点魔法伤害，此伤害将均摊给所有敌人，每个目标都有40%几率因此被沉默、眩晕，持续2回合",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const skillLevel =
        self.skills.emperorCatFinale_forAstralEmpressBoss?.level ?? 1;
      const aliveEnemies = enemies.filter((e) => e.hp > 0);
      const count = aliveEnemies.length;
      if (count === 0) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }

      // 总伤害
      const totalDamage =
        500 + Math.floor(30 + intelligence * 1.2 + skillLevel * 2);
      // 均摊到每个目标
      const splitDamage = Math.floor(totalDamage / count);

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      for (const target of aliveEnemies) {
        const damage = await dealDamage(self, target, splitDamage, {
          damageType: DamageType.Magical,
          battleInfo, 
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'emperorCatFinale_forAstralEmpressBoss'
          }
        });
        results.damage![target.uuid] = damage;
        results.targetUnitUuidList.push(target.uuid);

        // 60%概率沉默2回合
        if (await checkRandomPercentAboutUnit(self, 0.4, {battleInfo, callbacks})) {
         await addState("silence", 2, self, target, {}, {
            battleInfo, callbacks
          });
        }
        // 60%概率眩晕2回合
        if (await checkRandomPercentAboutUnit(self, 0.4, {battleInfo, callbacks})) {
         await addState("stun", 2, self, target, {}, {
            battleInfo, callbacks
          });
        }
      }

      return results;
    },
  },

  astralStorm: {
    id: "astralStorm",
    name: "星辉风暴",
    tire: 3,
    target: "all_enemy",
    targetCount: 99,
    colddown: 10,
    mpCost: 35,
    effectStr:
      "对所有敌人造成(40 + 智力(160 + 技能等级*2)%)点魔法伤害，并有(50 + 技能等级*2)%概率使目标沉默和眩晕各2回合",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const skillLevel = self.skills.astralStorm?.level ?? 1;
      const baseDamage = Math.floor(8 + intelligence * (1.8 + skillLevel * 0.02));

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      let allTargets = getAvailableUnitCollection(enemies, {
        includeSneak: true,
      })

      let extraDamagePerUnit = 0;
      if (hasEquipment(self, "starDustMagicBook")) {
        let itemLevel = getUnitEquipmentLevel(self, "starDustMagicBook")
        if (itemLevel >= 5) {
          extraDamagePerUnit = Math.floor(Math.max(intelligence * 0.25, 400 / allTargets.length))
        }
      }

      let addDebuff = false;
      let hasCrown = hasEquipment(self, "starCrown")
      let crownEnhanceLevel = getUnitEquipmentLevel(self, "starCrown")
      if (hasCrown) {
        if (crownEnhanceLevel > 4) {
          addDebuff = true;
          for (const target of allTargets) {
            // 30%概率沉默2回合
            if (await checkRandomPercentAboutUnit(self, 0.5 + skillLevel * 0.02, {battleInfo, callbacks})) {
             await addState("silence", 2, self, target, {}, {
                battleInfo, callbacks
              });
            }
            if (await checkRandomPercentAboutUnit(self, 0.5 + skillLevel * 0.02, {battleInfo, callbacks})) {
             await addState("stun", 2, self, target, {}, {
                battleInfo, callbacks
              });
            }
          }
        }
      }

      results.damage = await dealAoeDamage(self, allTargets, (target) => {
        let thisUnitDamage = baseDamage + extraDamagePerUnit

        if (hasCrown) {
          if (hasStateCauseForbidCastSkill(target) || hasState(target, 'stun')) {
            thisUnitDamage = thisUnitDamage * (1 + (0.55 + crownEnhanceLevel * 0.05))
          }
        }

        return thisUnitDamage
      }, {
          damageType: DamageType.Magical,
          battleInfo,
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'astralStorm'
          }
      });
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      for (const target of allTargets) {

        if (!addDebuff) {
          if (await checkRandomPercentAboutUnit(self, 0.5 + skillLevel * 0.02, {battleInfo, callbacks})) {
           await addState("silence", 2, self, target, {}, {
              battleInfo, callbacks
            });
          }
          if (await checkRandomPercentAboutUnit(self, 0.5 + skillLevel * 0.02, {battleInfo, callbacks})) {
           await addState("stun", 2, self, target, {}, {
              battleInfo, callbacks
            });
          }
        }
      }

      return results;
    },
  },

  groupShield: {
    id: "groupShield",
    name: "群体护盾",
    tire: 3,
    target: "all_ally",
    targetCount: 99,
    colddown: 6,
    mpCost: 15,
    effectStr:
      "为所有友方单位添加一个可吸收伤害的护盾（护盾值=40+智力30%+技能等级*2），持续2回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Shield],

    effect: async ({ self, allies, addStateCallback, battleInfo, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const skillLevel = self.skills.groupShield?.level ?? 1;
      const shieldValue = Math.floor(40 + intelligence * 0.3 + skillLevel * 2);

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      for (const ally of allies.filter((a) => a.hp > 0)) {
       await addState("shield", 2, self, ally, {
          thisStateActuralValue: shieldValue,
        }, {
          battleInfo,
          callbacks,
          addStateCallback
        });
        results.targetUnitUuidList.push(ally.uuid);
      }

      return results;
    },
  },

  sneak: {
    id: "sneak",
    name: "潜行",
    target: "self",
    targetCount: 1,
    colddown: 6,
    mpCost: 5,
    effectStr: "进入潜行状态，3回合内无法被敌人选为目标（群体技能不受影响）。",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff],

    effect: async ({ self, battleInfo, callbacks }) => {
      // 添加潜行状态
     await addState("sneak", 3, self, self, {}, {
        battleInfo, callbacks
      });

      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  ambush: {
    id: "ambush",
    name: "偷袭",
    tire: 2,
    target: "single_enemy",
    targetCount: 1,
    colddown: 2,
    mpCost: 10,
    effectStr: "对生命值最低的敌人造成(10 + 攻击力120% + 敏捷(120 + 技能等级*3)%)点伤害\n若目标生命值低于50%则此伤害额外提升50%\n若自身处于潜行状态下，则此伤害还将额外提升50%。",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      // 找到生命值最低且存活的敌人
      const aliveEnemies = getAvailableUnitCollection(enemies)
      if (aliveEnemies.length === 0) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const target = aliveEnemies.reduce(
        (min, curr) => (curr.hp < min.hp ? curr : min),
        aliveEnemies[0]
      );

      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const dex = getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      const skillLevel = self.skills.ambush?.level ?? 1;
      let baseDamage = Math.floor(10 + attack * 1.2 + dex * (1.2 + skillLevel * 0.03));

      // 若目标生命值低于50%，伤害提升50%
      if (target.hp / target.maxHp < 0.5) {
        baseDamage = Math.floor(baseDamage * 1.5);
      }

      // 若自身处于潜行状态，伤害再提升50%，并移除潜行
      if (self.state?.sneak) {
        baseDamage = Math.floor(baseDamage * 1.5);
      }

      const damage = await dealDamage(self, target, baseDamage, {
        damageType: DamageType.Physical,
        battleInfo,
        dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'ambush'
          }
      });

      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  poisonClaw: {
    id: "poisonClaw",
    name: "毒爪",
    tire: 2,
    target: "single_enemy",
    targetCount: 1,
    colddown: 3,
    mpCost: 10,
    effectStr: "对生命值最低的敌人造成(25 + 攻击力95% + 敏捷(95 + 技能等级*3)%)点伤害\n并使目标获得剧毒（失去15%护甲，每回合受到(15+15%当前生命)点伤害，持续3回合）。",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      // 找到生命值最低且存活的敌人
      const aliveEnemies = getAvailableUnitCollection(enemies)
      if (aliveEnemies.length === 0) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const target = aliveEnemies.reduce(
        (min, curr) => (curr.hp < min.hp ? curr : min),
        aliveEnemies[0]
      );

      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const dex = getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      const skillLevel = self.skills.poisonClaw?.level ?? 1;
      let baseDamage = Math.floor(25 + attack * 0.95 + dex * (0.95 + skillLevel * 0.03));

      const damage = await dealDamage(self, target, baseDamage, {
        damageType: DamageType.Physical,
        battleInfo,
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'poisonClaw'
        }
      });

      const targetDefence = getUnitStatusInBattle(target, 'defencing', { battleInfo, callbacks });
      let decreaseDefence = Math.ceil(targetDefence * 0.15);
      await addState("venom", 3, self, target, {
        thisStateActuralValue: decreaseDefence
      }, {
        battleInfo, callbacks
      });

      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  shadowStep: {
    id: "shadowStep",
    name: "暗影步",
    tire: 2,
    target: "self",
    targetCount: 1,
    colddown: 5,
    mpCost: 15,
    effectStr: "立即进入潜行状态（2回合），并回复(8 + 敏捷(50 + 技能等级*5)%)点生命值。",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Heal, SkillType.Buff],

    effect: async ({ self, battleInfo, callbacks }) => {
      // 进入潜行状态
     await addState("sneak", 2, self, self, {}, {
        battleInfo, callbacks
      });

      // 计算回复量
      const dex = getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      const skillLevel = self.skills.shadowStep?.level ?? 1;
      const healValue = Math.floor(8 + dex * 0.5 + skillLevel * 0.5);

      // 回复生命
      self.hp = Math.min(self.maxHp, self.hp + healValue);

      return {
        type: "skill",
        damage: {},
        heal: { [self.uuid]: healValue },
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  silenceStrike: {
    id: "silenceStrike",
    name: "沉默打击",
    tire: 2,
    target: "single_enemy",
    targetCount: 1,
    colddown: 5,
    mpCost: 10,
    effectStr: "对技能最多的敌人造成(15 + 攻击力100% + (敏捷100% + 技能等级*4)%)点伤害，并沉默2回合（无法释放技能）。",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      // 找到技能最多且存活的敌人
      const aliveEnemies = getAvailableUnitCollection(enemies)
      if (aliveEnemies.length === 0) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const target = aliveEnemies.reduce(
        (max, curr) => {
          const currSkillsCount = Object.keys(curr.skills).length as number;
          const maxSkillsCount = Object.keys(max.skills).length as number;
          return currSkillsCount > maxSkillsCount ? curr : max;
        },
        aliveEnemies[0]
      );

      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const dex = getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      const skillLevel = self.skills.silenceStrike?.level ?? 1;
      let baseDamage = Math.floor(15 + attack * 1 + dex * (1 + skillLevel * 0.04));

      const damage = await dealDamage(self, target, baseDamage, {
        damageType: DamageType.Physical,
        battleInfo,
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'silenceStrike'
        }
      });

      // 沉默1回合
     await addState("silence", 2, self, target, {}, {
        battleInfo, callbacks
      });

      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },


  slientSmokeScreen: {
    id: "slientSmokeScreen",
    name: "静默烟雾弹",
    tire: 2,
    target: "all_enemy",
    targetCount: 99,
    colddown: 7,
    mpCost: 5,
    effectStr: "所有敌人一个随机技能进入3回合冷却，自身进入潜行状态（2回合）。",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff, SkillType.Buff],

    effect: async ({ self, enemies, battleInfo, callbacks }) => {
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      // 所有敌人下一个技能冷却+1
      for (const target of enemies) {
        const randomSkillId = randomElementInCollection(
          ObjectKeys<AllBattleSkillId>(target.skills).filter(id => id != 'baseAttack')
        );

        if (!randomSkillId) {
          continue; // 如果没有技能，跳过
        }

        if (!target.skillColddown) {
          target.skillColddown = {};
        }
        target.skillColddown[randomSkillId] =
          (target.skillColddown[randomSkillId] ?? 0) + 3;
      }

      // 自身进入潜行状态
     await addState("sneak", 2, self, self, {}, {
        battleInfo, callbacks
      });

      return results;
    },
  },

  mirrorImage: {
    id: "mirrorImage",
    name: "镜像影分身",
    tire: 3,
    target: "self",
    targetCount: 1,
    colddown: 7,
    mpCost: 10,
    effectStr: "制造一个基础自身完整属性的，且拥有1回合隐匿的影分身\n分身只有1点生命值，持续4回合。",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Summon],

    effect: async ({ self, battleInfo, callbacks }) => {
      // 生成分身唯一uuid
      const uuid = `${self.uuid}_mirror_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      const selfClone = clone(self)

      // 复制自身属性
      const mirror: BaseBattleUnit = {
        ...selfClone,
        uuid,
        name: self.name + "·分身",
        maxHp: 1,
        hp: 1,
        maxMp: selfClone.maxMp,
        mp: selfClone.mp,
        isPlayer: false,
        tmpShield: 0,
        skills: {
          ...selfClone.skills
        },
        ai: {
          ...selfClone.ai
        },
        status: {
          ...selfClone.status,
        },
        state: {
        },
      };

      if (mirror.skills?.mirrorImage) {
        delete mirror.skills.mirrorImage
      }
      mirror.skillColddown = {}

      delete mirror.triggerMark
      delete mirror.tmpOncePreBattleExtraTurnIndexList
      delete mirror.inventory

     await addState("sneak", 2, self, mirror, {}, {
        battleInfo, callbacks
      })
      summonUnit(battleInfo, self, mirror, 5)

      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  shadowAssassinUlt: {
    id: "shadowAssassinUlt",
    name: "绝影连杀",
    tire: 3,
    target: "multi_random_enemy",
    targetCount: 4,
    colddown: 8,
    mpCost: 35,
    effectStr:
      "在敌阵中高速穿梭，对敌人进行(5 + (敏捷*0.02，向下取整))次标记（优先选择不同目标）\n，每被标记1次，都将受到(攻击120% + 敏捷(120 + 技能等级*4)%)点伤害\n若目标生命值低于50%，则本次攻击伤害翻倍。\n若自身处于潜行状态，则结束潜行。\n若自身不处于潜行，则进入潜行状态，持续2回合。",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const dex = getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const skillLevel = self.skills.shadowAssassinUlt?.level ?? 1;
      const aliveEnemies = getAvailableUnitCollection(enemies)
      const selected: typeof aliveEnemies = [];
      // 优先选择不同目标，若不足则可重复
      let pool = [...aliveEnemies];

      let times = 5 + Math.floor(dex * 0.02);

      for (let i = 0; i < times; i++) {
        if (pool.length === 0) pool = [...aliveEnemies];
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool.splice(idx, 1)[0]);
      }

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      for (const target of selected) {
        if (!target) continue; // 如果没有目标，跳过
        if (target?.hp <= 0) continue; // 跳过已死亡目标
        let baseDamage = Math.floor(attack * 1.2 + dex * (1.2 + skillLevel * 0.04));
        // 生命值低于50%必定暴击
        if (target.hp / target.maxHp < 0.5) {
          baseDamage *= 2;
        }
        const damageRes = await dealDamage(self, target, baseDamage, {
          damageType: DamageType.Physical,
          battleInfo,
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'shadowAssassinUlt'
          }
        });

        if (!results.damage![target.uuid]) {
          results.damage![target.uuid] = {
            damage: 0,
            damageType: DamageType.Physical,
          };
        }

        results.damage![target.uuid].damage += damageRes.damage;
        results.targetUnitUuidList.push(target.uuid);
      }

      // 潜行状态处理
      if (self.state?.sneak) {
        delete self.state.sneak;
      } else {
       await addState("sneak", 2, self, self, {}, {
          battleInfo, callbacks
        });
      }

      return results;
    },
  },


  stardustMouseSwap: {
    id: "stardustMouseSwap",
    name: "偷天换日",
    tire: 2,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 8,
    mpCost: 10,
    effectStr: "从（1+智力10%）名敌人身上各偷取(1+智力10%)个可移除的随机增益状态并转移给自己，该敌有100%几率进入慌乱状态（所有的行为将不分敌我），持续2回合。\n目标每点智力降低2%被慌乱的几率。",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],

    preCheck: ({ enemies }) => {
      return false;
      // 只有存在有增益状态的敌人时才可释放
      return getAvailableUnitCollection(enemies).some(e => e.hp > 0 
        && e.state 
        && ObjectKeys<AllBattleStateId>(e.state).some(sid => allBattleState[sid]?.isBuff 
        && !allBattleState[sid].isDebuff 
        // @ts-ignore
        && !allBattleState[sid]?.unremovable
      ));
    },
    effect: async ({ self, enemies, battleInfo, callbacks }) => {
      return
      const selfInt = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const stealCount = Math.max(1, Math.floor(1 + selfInt * 0.1));
      const stealBuffCount = Math.max(1, Math.floor(1 + selfInt * 0.1));
      // 随机选取stealCount个目标
      const candidates = getAvailableUnitCollection(enemies).filter(e => e.hp > 0 
        && e.state && ObjectKeys<AllBattleStateId>(e.state).some(sid => allBattleState[sid]?.isBuff 
        && !allBattleState[sid].isDebuff 
        // @ts-ignore
        && !allBattleState[sid]?.unremovable
        ));
      const selected: typeof candidates = getRandomUnitsInCollection(candidates, stealCount);

      for (const target of selected) {
        // 偷取buff
        const buffs = ObjectKeys<AllBattleStateId>(target.state).filter(sid => 
          allBattleState[sid]?.isBuff
          && !allBattleState[sid].isDebuff 
          // @ts-ignore
          && !allBattleState[sid]?.unremovable
        );
        for (let i = 0; i < stealBuffCount && buffs.length > 0; i++) {
          const buffId = randomElementInCollection(buffs);
          const buff = target.state![buffId!];
          if (buffId && buff) {
            detachState(buffId as AllBattleStateId, target, battleInfo, {
              callbacks
            });
           await addState(buffId as AllBattleStateId, buff.duration, self, self, buff.extra, {
              battleInfo, callbacks
            });
            // 移除已偷的buff，避免重复
            const idx = buffs.indexOf(buffId);
            if (idx >= 0) buffs.splice(idx, 1);
          }
        }
        // 计算慌乱概率
        const targetInt = getUnitStatusInBattle(target, 'intelligence', { battleInfo, callbacks });
        const baseChance = 1.0;
        const reduce = targetInt * 0.02;
        const chance = Math.max(0, baseChance - reduce);
        if (await checkRandomPercentAboutUnit(self, chance, {battleInfo, callbacks})) {
         await addState("fluster", 2, self, target, {}, {
            battleInfo, callbacks
          });
        }
      }
      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: selected.map(t => t.uuid),
        sourceUnitUuid: self.uuid,
      };
    },
  },

  dizzySpin: {
    id: "dizzySpin",
    name: "眩晕旋转",
    tire: 2,
    target: "all_enemy",
    targetCount: 99,
    colddown: 5,
    mpCost: 15,
    effectStr: "对所有敌人造成(12 + 攻击力60% + 力量(60 + 技能等级*2)% + 此敌人耐力120%)伤害，并有(40%+技能等级*1)概率眩晕1回合",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const selfStrength = getUnitStatusInBattle(self, 'strength', { battleInfo, callbacks });
      const skillLevel = self.skills.dizzySpin?.level ?? 1;
      const baseDamage = Math.floor(12 + attack * 0.6 + selfStrength * (0.6 + skillLevel * 0.02));
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      results.damage = await dealAoeDamage(self, enemies, (target) => {
        const targetStamina = getUnitStatusInBattle(target, 'stamina', { battleInfo, callbacks });
        return Math.floor(baseDamage + targetStamina * 1.2);
      }, {
          damageType: DamageType.Physical,
          battleInfo,
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'dizzySpin'
          }
      });
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      for (const target of enemies.filter(e => e.hp > 0)) {
        if (await checkRandomPercentAboutUnit(self, 0.4 + (skillLevel) * 0.01, {battleInfo, callbacks})) {
         await addState("stun", 1, self, target, {}, {
            battleInfo, callbacks
          });
        }
      }
      return results;
    },
  },
  carouselOverdrive: {
    id: "carouselOverdrive",
    name: "失控加速",
    tire: 2,
    target: "self",
    targetCount: 1,
    colddown: 1,
    mpCost: 10,
    effectStr: "对随机单位（不分敌我）造成(攻击力150% + 耐力(250 + 技能等级*5)%)的伤害\n如果此次攻击的是友军，额外对一个随机敌人造成(攻击力200% + 耐力(300 + 技能等级*5)% + 自身最大生命值30%)伤害",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, allies, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      // 组合所有单位（不分敌我，排除自己且存活）
      const allUnits = getAvailableUnitCollection([...allies, ...enemies]).filter(u => u.hp > 0 && u.uuid !== self.uuid);
      if (allUnits.length === 0) return;
      const target = getRandomUnitInCollection(allUnits)

      if (!target) {
        return
      }

      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const stamina = getUnitStatusInBattle(self, 'stamina', { battleInfo, callbacks });
      const skillLevel = self.skills.carouselOverdrive?.level ?? 1;

      const baseDamage = Math.floor(attack * 1.5 + stamina * (2.5 + skillLevel * 0.05));
      const result: FullBattleAction = {
        type: "skill",
        damage: {
          [target.uuid]: await dealDamage(self, target, baseDamage, {
            damageType: DamageType.Physical,
          battleInfo,
            dealDamageCallback
          }),
        },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };

      // 如果打到友军，再额外攻击一个随机敌人
      if (allies.some(a => a.uuid === target.uuid)) {
        const aliveEnemies = getAvailableUnitCollection(enemies)
        if (aliveEnemies.length > 0) {
          const enemyTarget = getRandomUnitInCollection(aliveEnemies)!;
          const extraDamage = Math.floor(attack * 2.0 + stamina * (3.0 + skillLevel * 0.05) + self.maxHp * 0.3);
          result.damage![enemyTarget.uuid] = await dealDamage(self, enemyTarget, extraDamage, {
            damageType: DamageType.Physical,
            battleInfo,
            dealDamageCallback,
            callbacks,
            causeBy: {
              type: DealDamageCauseByType.Skill,
              skillId: 'carouselOverdrive'
            }
          });
          result.targetUnitUuidList.push(enemyTarget.uuid);
        }
      }
      return result;
    },
  },
  candyBomb: {
    id: "candyBomb",
    name: "糖果爆裂",
    tire: 2,
    target: "multi_random_enemy",
    targetCount: 2,
    colddown: 5,
    mpCost: 15,
    effectStr: "随机两名敌人各造成(14 + 攻击力(60 + 技能等级*2)% + (智力60 + 技能等级*2)%)点伤害，并有（40%+技能等级*1）概率使目标获得一个随机负面状态（剧毒、眩晕、沉默、灼烧），持续2回合",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const skillLevel = self.skills.candyBomb?.level ?? 1;
      const baseDamage = Math.floor(14 + attack * (0.6 + skillLevel * 0.02) + intelligence * (0.6 + skillLevel * 0.02));

      // 随机选出两名不同的存活敌人
      const aliveEnemies = getAvailableUnitCollection(enemies)
      const selected: typeof aliveEnemies = getRandomUnitsInCollection(aliveEnemies, 2);

      const debuffList = ["venom", "stun", "silence", "burn"] as const;
      const debuffChance = 0.4 + (self.skills.candyBomb!.level ?? 0) * 0.01;

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      results.damage = await dealAoeDamage(self, selected, () => baseDamage, {
        damageType: DamageType.Physical,
          battleInfo,
        dealDamageCallback,
            callbacks,
            causeBy: {
              type: DealDamageCauseByType.Skill,
              skillId: 'candyBomb'
            }
      });
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);
      for (const target of selected) {
        if (await checkRandomPercentAboutUnit(self, debuffChance, {battleInfo, callbacks})) {
         const debuff = randomElementInCollection(debuffList)!;
         await addState(debuff, 2, self, target, {}, {
            battleInfo, callbacks,
          });
        }
      }
      return results;
    },
  },

  prankSmoke: {
    id: "prankSmoke",
    name: "恶作剧烟雾",
    tire: 2,
    target: "all_enemy",
    targetCount: 99,
    colddown: 6,
    mpCost: 8,
    effectStr: "使所有敌人进入恐慌状态（行动目标随机，持续2回合）\n敌人每有1点智力，恐慌几率降低2%",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],

    effect: async ({ self, enemies, addStateCallback, battleInfo, callbacks }) => {
      for (const target of enemies) {
        const targetInt = getUnitStatusInBattle(target, 'intelligence', { battleInfo, callbacks });
        const chance = Math.max(0, 1 - targetInt * 0.02);
        if (await checkRandomPercentAboutUnit(self, chance, {battleInfo, callbacks})) {
         await addState("fluster", 2, self, target, {}, {
            battleInfo, callbacks,
            addStateCallback
          });
        }
      }
      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: enemies.map(e => e.uuid),
        sourceUnitUuid: self.uuid,
      };
    },
  },

  mercenaryTaunt: {
    id: "mercenaryTaunt",
    name: "嘲讽",
    tire: 3,
    target: "all_enemy",
    targetCount: 99,
    colddown: 5,
    mpCost: 12,
    effectStr: "嘲讽所有敌人，持续3回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],

    effect: async ({ self, enemies, addStateCallback, battleInfo, callbacks }) => {
      for (const target of enemies.filter(e => e.hp > 0)) {
       await addState("taunt", 3, self, target, {}, {
          battleInfo, callbacks,
          addStateCallback
        });
      }
      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },
  plushTaunt: {
    id: "plushTaunt",
    name: "毛绒嘲讽",
    tire: 3,
    target: "all_enemy",
    targetCount: 99,
    colddown: 8,
    mpCost: 12,
    effectStr: "嘲讽所有敌人（选择敌人作为目标时，优先选择嘲讽来源），持续3回合，并提升自身防御(15+技能等级*1)，持续2回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff, SkillType.Debuff],

    effect: async ({ self, enemies, addStateCallback, battleInfo, callbacks }) => {
      for (const target of enemies.filter(e => e.hp > 0)) {
       await addState("taunt", 3, self, target, {}, {
          addStateCallback,
          battleInfo,
          callbacks
        });
      }
     await addState("defUp", 3, self, self, { thisStateActuralValue: 15 + (self.skills.plushTaunt?.level ?? 0) * 1 }, {
        battleInfo, callbacks
      });
      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  starlightSanctuary: {
    id: "starlightSanctuary",
    name: "星光治愈",
    tire: 2,
    target: "all_ally",
    targetCount: 99,
    colddown: 6,
    mpCost: 16,
    effectStr: "为所有友军回复(智力80% + (15 + 技能等级*0.5)%已损失生命)点生命，并驱散一个随机负面效果",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Heal],

    effect: async ({ self, allies, battleInfo, healCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      let skillLevel = self.skills.starlightSanctuary?.level ?? 1;
      for (const ally of allies.filter(a => a.hp > 0)) {
        const lostHp = (ally.maxHp ?? ally.hp) - ally.hp;
        const healValue = Math.floor(
          intelligence * 0.8 + lostHp * ((0.15 + skillLevel * 0.005))
        );

        // 驱散负面效果
        const negativeStates = ObjectKeys<AllBattleStateId>(ally.state).filter(
          sid => 
            allBattleState[sid]?.isDebuff 
          && !allBattleState[sid].isBuff 
              // @ts-ignore
          && !allBattleState[sid]?.unremovable
          && sid != 'tmpUnit'
        );

        if (negativeStates.length > 0) {
          const randomStateId = randomElementInCollection(negativeStates);
          if (randomStateId) {
            detachState(randomStateId, ally, battleInfo, {
              callbacks
            });
          }
        }

        await healUnit(self, ally, healValue, {
          battleInfo,
          callbacks,
          reason: HpRestoreReason.SKILL_EFFECT,
          callback: healCallback,
        });
      }
      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: allies.map(a => a.uuid),
        sourceUnitUuid: self.uuid,
      };
    },
  },

  ghostlyStrike: {
    id: "ghostlyStrike",
    name: "鬼影冲锋",
    tire: 3,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 2,
    mpCost: 10,
    effectStr: "对一名当前生命值最低敌人造成(攻击力60%+敏捷(80 + 技能等级*3)%)伤害，忽略20%护甲\n对最大生命值最低的敌人造成(攻击力60%+敏捷(80 + 技能等级*3)%)伤害，有20%概率造成1回合眩晕\n如果选中了同一目标，则额外造成(攻击力60%+敏捷(80 + 技能等级*3)%)伤害",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const dexterity =  getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      const skillLevel =  self.skills.ghostlyStrike?.level ?? 1;
      const baseDamage = Math.floor(attack * 0.6 + dexterity * (0.8 + skillLevel * 0.03));

      // 当前生命值最低的敌人
      const alive = getAvailableUnitCollection(enemies)
      if (alive.length === 0) return;
      const minHpTarget = alive.reduce((a, b) => (a.hp < b.hp ? a : b));
      // 最大生命值最低的敌人
      const minMaxHpTarget = alive.reduce((a, b) => ((a.maxHp ?? a.hp) < (b.maxHp ?? b.hp) ? a : b));

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      // 对当前生命值最低的敌人，忽略20%护甲
      const damage1 = await dealDamage(self, minHpTarget, baseDamage, {
        ignoreDefencePercent: 20,
          battleInfo,
        damageType: DamageType.Physical,
        dealDamageCallback,
            callbacks,
            causeBy: {
              type: DealDamageCauseByType.Skill,
              skillId: 'ghostlyStrike'
            }
      });
      if (!results.damage![minHpTarget.uuid]) {
        results.damage![minHpTarget.uuid] = {
          damage: 0,
          damageType: DamageType.Physical,
        };
      }
      results.damage![minHpTarget.uuid].damage += damage1.damage;
      results.targetUnitUuidList.push(minHpTarget.uuid);

      // 对最大生命值最低的敌人，有20%概率造成眩晕
      const damage2 = await dealDamage(self, minMaxHpTarget, baseDamage, {
        ignoreDefencePercent: 20,
          battleInfo,
        damageType: DamageType.Physical,
        dealDamageCallback,
            callbacks,
            causeBy: {
              type: DealDamageCauseByType.Skill,
              skillId: 'ghostlyStrike'
            }
      });
      if (!results.damage![minMaxHpTarget.uuid]) {
        results.damage![minMaxHpTarget.uuid] = {
          damage: 0,
          damageType: DamageType.Physical,
        };
      }
      results.damage![minMaxHpTarget.uuid].damage += damage2.damage;

      results.targetUnitUuidList.push(minMaxHpTarget.uuid);
      if (await checkRandomPercentAboutUnit(self, 0.2, {battleInfo, callbacks})) {
       await addState("stun", 1, self, minMaxHpTarget, {}, {
          battleInfo, callbacks
        });
      }

      // 如果是同一目标，额外再打一次
      if (minHpTarget.uuid === minMaxHpTarget.uuid) {
        const damage3 = await dealDamage(self, minHpTarget, baseDamage, {
          ignoreDefencePercent: 20,
          damageType: DamageType.Physical,
          battleInfo,
          dealDamageCallback,
            callbacks,
            causeBy: {
              type: DealDamageCauseByType.Skill,
              skillId: 'ghostlyStrike'
            }
        });
        if (!results.damage![minHpTarget.uuid]) {
          results.damage![minHpTarget.uuid] = {
            damage: 0,
            damageType: DamageType.Physical,
          };
        }
        results.damage![minHpTarget.uuid].damage += damage3.damage;
      }

      // 去重
      results.targetUnitUuidList = Array.from(new Set(results.targetUnitUuidList));

      return results;
    },
  },

  paradeHorn: {
    id: "paradeHorn",
    name: "狂欢号角",
    tire: 3,
    target: "all_ally",
    targetCount: 99,
    colddown: 6,
    mpCost: 20,
    effectStr: "为所有友军提升攻击（20 + 技能等级*1），持续4回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff],

    effect: async ({ self, allies, addStateCallback, battleInfo, callbacks }) => {
      for (const ally of allies.filter(a => a.hp > 0)) {
        let skillLevel = self.skills.paradeHorn?.level ?? 1;
        // 添加攻击提升状态
       await addState("atkUp", 4, self, ally, { thisStateActuralValue: 20 + skillLevel }, {
          addStateCallback,
          battleInfo, 
          callbacks,
        });
      }
      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: allies.map(a => a.uuid),
        sourceUnitUuid: self.uuid,
      };
    },
  },

  clownSummon: {
    id: "clownSummon",
    name: "小丑召集令",
    tire: 3,
    target: "none",
    targetCount: 0,
    colddown: 8,
    mpCost: 22,
    effectStr: "召唤(1+技能等级*0.4)只糖果小丑猫助战，持续10回合，若己方已存在小丑猫，则为所有小丑猫回复(最大生命值30%)生命",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Summon, SkillType.Heal],

    effect: async ({ self, allies, battleInfo, healCallback, callbacks }) => {
      // 查找场上所有糖果小丑猫
      const clownIds = allies.filter(
        m => m.id === "candy_clown_001" && m.hp > 0
      );
      if (clownIds.length > 0) {
        for (const clown of clownIds) {
          const healValue = Math.floor((clown.maxHp ?? clown.hp) * 0.4);
          await healUnit(self, clown, healValue, {
            reason: HpRestoreReason.SKILL_EFFECT,
            callback: healCallback,
            battleInfo,
            callbacks,
          });
        }
      } else {
        let count = 1 + (self.skills.clownSummon?.level ?? 0) * 0.4;
        for (let i = 0; i < count; i++) {
          const uuid = `${self.uuid}_clown_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
          const template = generateEnemyById("candy_clown_001")
          if (!template) continue;
          template.uuid = uuid;
          template.name = "被召集的糖果小丑猫";
          template.isPlayer = false

          summonUnit(battleInfo, self, template, 10)
        }
      }
      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  kingAegis: {
    id: "kingAegis",
    name: "猫王庇护",
    tire: 3,
    target: "self",
    targetCount: 1,
    colddown: 7,
    mpCost: 16,
    effectStr: "为所有友军添加护盾，数额等于目标最大生命值(15 + 技能等级*0.5)%，持续3回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Shield],

    effect: async ({ self, allies, addStateCallback, battleInfo, callbacks }) => {
      let res: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };
      for (const ally of allies) {
        const value = Math.floor((ally.maxHp ?? ally.hp) * (0.15 + (ally.skills.kingAegis?.level ?? 0) * 0.005));
        res.targetUnitUuidList.push(ally.uuid);
       await addState("shield", 2, self, ally, { thisStateActuralValue: value }, {
          battleInfo, 
          callbacks,
          addStateCallback
        });
      }

      return res
    },
  },

  sealMagic: {
    id: "sealMagic",
    name: "封印魔法",
    tire: 2,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 4,
    mpCost: 15,
    effectStr: "对一名技能最多的敌人造成(12 + 智力(140 + 技能等级*5)% + 此敌人技能数量*45）伤害\n对所有拥有正在冷却中技能的敌人，对其施加技能封印（技能冷却暂停，持续4回合）",
    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks, addStateCallback }) => {
      // 选择技能最多的敌人
      if (enemies.length === 0) {
          return {
            type: "skill",
            damage: {},
            heal: {},
            targetUnitUuidList: [],
            sourceUnitUuid: self.uuid,
          };
      }
      // 按技能数量降序排序
      enemies = enemies.toSorted((a, b) => ObjectKeys(a.skills).length - ObjectKeys(b.skills).length);
      // 选择技能最多的敌人
      let target = enemies[enemies.length - 1];

      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const skillLevel = (self.skills.sealMagic?.level ?? 0);
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const skillCountDamage = ObjectKeys<AllBattleSkillId>(target.skills).length * 45;
      const damage = await dealDamage(self, target, Math.floor(12 + intelligence * (1.4 + skillLevel * 0.05) + skillCountDamage), {
        damageType: DamageType.Magical,
        battleInfo,
        dealDamageCallback,
            callbacks,
            causeBy: {
              type: DealDamageCauseByType.Skill,
              skillId: 'sealMagic'
            }
      });

      for(const enemy of enemies) {
        // 对所有拥有正在冷却中的技能的敌人，施加技能封印
        if (enemy.skillColddown && ObjectKeys<AllBattleSkillId>(enemy.skillColddown).length > 0) {
         await addState("skillSeal", 4, self, enemy, {}, {
            battleInfo, 
            callbacks,
            addStateCallback
          });
        }
      }

      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  banish: {
    id: "banish",
    name: "驱逐",
    tire: 2,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 6,
    mpCost: 18,
    effectStr: "对一名随机敌人造成(18 + 智力200% + 技能等级*8)无视防御的伤害，并有50%概率为其附加“驱逐”，持续3回合",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const target = getRandomUnitInCollection(enemies);
      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const slDamage = self.skills.banish?.level ?? 1;
      const damage = await dealDamage(self, target, Math.floor(18 + intelligence * 2.0 + slDamage * 8), {
        ignoreDefence: true,
        battleInfo,
        damageType: DamageType.Magical,
        dealDamageCallback,
            callbacks,
            causeBy: {
              type: DealDamageCauseByType.Skill,
              skillId: 'banish'
            }
      });
      // 50%概率驱逐（可在 allBattleState.ts 实现 banished 状态，移出战斗2回合）
      if (await checkRandomPercentAboutUnit(self, 0.5, {battleInfo, callbacks})) {
       await addState("banished", 3, self, target, {}, { battleInfo, callbacks });
      }
      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  bind: {
    id: "bind",
    name: "束缚",
    tire: 1,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 4,
    mpCost: 10,
    effectStr: "对一名敌人造成(10 + 攻击力60%)伤害，并使其无法行动（1回合）",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const target = getRandomUnitInCollection(enemies);
      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const damage = await dealDamage(self, target, Math.floor(10 + attack * 0.6), {
        damageType: DamageType.Magical,
        battleInfo,
        dealDamageCallback,
            callbacks,
            causeBy: {
              type: DealDamageCauseByType.Skill,
              skillId: 'bind'
            }
      });
     await addState("frozen", 1, self, target, {}, { battleInfo, callbacks });
      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  detectMagic: {
    id: "detectMagic",
    name: "识破魔法",
    tire: 3,
    target: "all_enemy",
    targetCount: 99,
    colddown: 5,
    mpCost: 10,
    effectStr: "移除所有敌人1个随机增益状态，并对每个敌人造成(8 + 智力60% + 共驱散状态数量 * 10 + 技能等级 * 5)伤害，无视50%防御",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      let removedBuffCount = 0;
      for (const target of enemies.filter(e => e.hp > 0)) {
        // 找到一个随机增益状态
        const buffs = ObjectKeys<AllBattleStateId>(target.state).filter(
          sid => {
            const state = allBattleState[sid] as BattleState;

            return state?.isBuff && !state.isDebuff && !state.unremovable && !state.permanent;
          }
        );
        if (buffs.length > 0) {
          const randomBuffId = randomElementInCollection(buffs);
          if (randomBuffId) {
            detachState(randomBuffId, target, battleInfo, {
              callbacks
            });
            removedBuffCount++;
          }
        }
      }

      // 计算伤害
      const baseDamage = Math.floor(8 + intelligence * 0.6 + removedBuffCount * 10 + (self.skills.detectMagic?.level ?? 0) * 5);
      for (const target of enemies.filter(e => e.hp > 0)) {
        const damage = await dealDamage(self, target, baseDamage, {
          ignoreDefencePercent: 50,
          damageType: DamageType.Magical,
          battleInfo,
          dealDamageCallback,
            callbacks,
            causeBy: {
              type: DealDamageCauseByType.Skill,
              skillId: 'detectMagic'
            }
        });  
        if (!results.damage![target.uuid]) {
          results.damage![target.uuid] = {
            damage: 0,
            damageType: DamageType.Magical,
          };
        }
        results.damage![target.uuid].damage += damage.damage;
        results.targetUnitUuidList.push(target.uuid);
      }

      return results;
    },
  },

  punish: {
    id: "punish",
    name: "惩戒",
    tire: 3,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 4,
    mpCost: 12,
    effectStr: "对一名随机敌人造成(14 + 智力70% + 目标智力130%)伤害。\n若其拥有增益状态则额外造成(智力50% + 目标智力70%)伤害，且使此技能的伤害无视防御",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const target = getRandomUnitInCollection(enemies);
      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const targetIntelligence = getUnitStatusInBattle(target, 'intelligence', { battleInfo, callbacks });
      let damage = 14 + intelligence * 0.7 + targetIntelligence * 1.3;
      // 若目标有buff，额外伤害
      const hasBuff = ObjectKeys<AllBattleStateId>(target.state ?? {}).some(
        sid => allBattleState[sid]?.isBuff && !allBattleState[sid]?.isDebuff
      );
      if (hasBuff) {
        damage += intelligence * 0.5 + targetIntelligence * 0.7;
      }
      const realDamage = await dealDamage(self, target, Math.floor(damage), {
        ignoreDefence: hasBuff, // 如果有buff，则无视防御
          battleInfo,
        damageType: DamageType.Magical,
        dealDamageCallback,
            callbacks,
            causeBy: {
              type: DealDamageCauseByType.Skill,
              skillId: 'punish'
            }
      });
      return {
        type: "skill",
        damage: { [target.uuid]: realDamage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  confuse: {
    id: "confuse",
    name: "扰乱",
    tire: 1,
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 3,
    mpCost: 8,
    effectStr: "使一名敌人进入‘慌乱’状态，持续4回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],

    effect: async ({ self, enemies, addStateCallback, battleInfo, callbacks }) => {
      const target = getRandomUnitInCollection(enemies);
      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
     await addState("fluster", 4, self, target, {}, {
        battleInfo,
        callbacks,
        addStateCallback
      });
      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  forbiddenMagic: {
    id: "forbiddenMagic",
    name: "禁忌魔法",
    tire: 3,
    target: "all_enemy",
    targetCount: 99,
    colddown: 1,
    mpCost: 35,
    effectStr: "失去(10 + 当前生命值的10%)点生命值，对所有敌人造成(40 + 智力140% + 技能等级*8)伤害，并有30%概率沉默2回合\n自身被扰乱3回合",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const baseDamage = Math.floor(40 + intelligence * 1.4);
      const slDamage = (self.skills.forbiddenMagic?.level ?? 1) * 8;

      // 自身失去生命值
      const lostHp = Math.floor(self.hp * 0.10 + 10);

      if (self.hp == 1) {
        self.hp = 0
      } else {
        self.hp = Math.max(1, (self.hp ?? 0) - lostHp);
      }

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      results.damage = await dealAoeDamage(self, enemies, () => baseDamage + slDamage, {
        damageType: DamageType.Magical,
          battleInfo,
        dealDamageCallback,
            callbacks,
            causeBy: {
              type: DealDamageCauseByType.Skill,
              skillId: 'forbiddenMagic'
            }
      });
      results.targetUnitUuidList = ObjectKeys<string>(results.damage);

      for (const target of enemies.filter(e => e.hp > 0)) {
        // 30%概率沉默2回合
        if (await checkRandomPercentAboutUnit(self, 0.3, {battleInfo, callbacks})) {
         await addState("silence", 2, self, target, {}, {
            battleInfo, callbacks
          });
        }
      }

      // 自身被扰乱3回合
     await addState("fluster", 3, self, self, {}, {
        battleInfo, callbacks
      });

      return results;
    },
  },

  ultimateLibraryJudgement: {
    id: "ultimateLibraryJudgement",
    name: "禁魔审判",
    target: "all_enemy",
    targetCount: 99,
    colddown: 15,
    mpCost: 80,
    effectStr:
      "对所有敌人造成(120 + 智力200% + 技能等级*20)点真实伤害，移除所有增益状态，并有60%概率沉默、50%概率封印技能、40%概率驱逐，持续3回合。",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const skillLevel = self.skills.ultimateLibraryJudgement?.level ?? 1;
      const baseDamage = Math.floor(120 + intelligence * 2.0 + skillLevel * 20);

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      for (const target of enemies.filter(e => e.hp > 0)) {
        // 真实伤害（无视防御）
        const damage = await dealDamage(self, target, baseDamage, {
          ignoreDefence: true,
          battleInfo,
          damageType: DamageType.Magical,
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'ultimateLibraryJudgement'
          },
        });
        results.damage![target.uuid] = damage;
        results.targetUnitUuidList.push(target.uuid);

        // 移除所有增益状态
        const buffs = ObjectKeys<AllBattleStateId>(target.state ?? {}).filter(
          sid => allBattleState[sid]?.isBuff 
          && !allBattleState[sid]?.isDebuff 
          // @ts-ignore
          && !allBattleState[sid]?.unremovable
        );
        for (const buffId of buffs) {
          detachState(buffId, target, battleInfo, {
            callbacks
          });
        }

        // 60%概率沉默3回合
        if (await checkRandomPercentAboutUnit(self, 0.6, {battleInfo, callbacks})) await addState("silence", 3, self, target, {}, { battleInfo, callbacks });
        // 50%概率封印技能3回合
        if (await checkRandomPercentAboutUnit(self, 0.5, {battleInfo, callbacks})) await addState("skillSeal", 3, self, target, {}, { battleInfo, callbacks });
        // 40%概率驱逐3回合
        if (await checkRandomPercentAboutUnit(self, 0.4, {battleInfo, callbacks})) {
         await addState("banished", 3, self, target, {}, { battleInfo, callbacks });
        }
      }

      return results;
    },
  },


  chainWhip: {
    id: "chainWhip",
    name: "锁链鞭打",
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 3,
    mpCost: 8,
    effectStr: "用锁链鞭打行动顺序最前的敌人，造成(15 + 攻击力80% + 技能等级*2)点伤害，并有50%概率将其行动顺序向后移动1轮",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      // 找到行动顺序最前的敌人
      const aliveEnemies = getAvailableUnitCollection(enemies);
      if (aliveEnemies.length === 0) return undefined;

      let target: BaseBattleUnit | null = null
      for(const uuid of battleInfo.turnOrder) {
        if (!uuid) continue;
        const unit = aliveEnemies.find(e => e.uuid === uuid);

        if (!!unit && unit.hp > 0) {
          target = unit;
          break;
        }
      }

      if (!target) {
        return undefined
      }

      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const skillLevel = self.skills.chainWhip?.level ?? 1;
      const damage = await dealDamage(self, target, Math.floor(15 + attack * 0.8 + skillLevel * 2), {
        damageType: DamageType.Physical,
        battleInfo, 
        dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId:'chainWhip' 
          },
      });

      if (await checkRandomPercentAboutUnit(self, 0.5, {battleInfo, callbacks})) {
        pushUnitTurnOrder(battleInfo, target.uuid, 1); // 将目标的行动顺序向后移动1轮
      }

      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  fearInduction: {
    id: "fearInduction",
    name: "恐惧",
    target: "all_enemy",
    targetCount: 99,
    colddown: 5,
    mpCost: 12,
    effectStr: "恐吓直面自己的敌人，对行动顺序最前的敌人施加慌乱状态，持续3回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, callbacks, addStateCallback }) => {
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      const aliveEnemies = getAvailableUnitCollection(enemies);
      if (aliveEnemies.length === 0) return undefined;

      let target: BaseBattleUnit | null = null
      for(const uuid of battleInfo.turnOrder) {
        if (!uuid) continue;
        const unit = aliveEnemies.find(e => e.uuid === uuid);

        if (!!unit && unit.hp > 0) {
          target = unit;
          break;
        }
      }

      if (!target) {
        return undefined
      }

     await addState("fluster", 3, self, target, {}, {
        battleInfo, callbacks,
        addStateCallback
      });
      results.targetUnitUuidList.push(target.uuid);

      return results;
    },
  },


  soulDrain: {
    id: "soulDrain",
    name: "灵魂吸取",
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 10,
    mpCost: 15,
    effectStr: "吸取敌人的灵魂，造成(20 + 智力120% + 技能等级*3)点无视防御伤害，并回复等量生命值",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Heal],

    effect: async ({ self, enemies, battleInfo, healCallback, dealDamageCallback, callbacks, }) => {
      const target = getRandomUnitInCollection(enemies);
      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const skillLevel = self.skills.soulDrain?.level ?? 1;
      const damage = Math.floor(20 + intelligence * 1.2 + skillLevel * 3);

      // 真实伤害
      let d = await dealDamage(self, target, damage, {
        ignoreDefence: true,
        battleInfo,
        damageType: DamageType.Magical,
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: "soulDrain",
        },
      });
      await healUnit(self, self, damage, {
        battleInfo,
        callbacks,
        reason: HpRestoreReason.SKILL_EFFECT,
        callback: healCallback,
      }); // 回复等量生命

      let res: FullBattleAction = {
        type: "skill",
        damage: { [target.uuid]: d },
        heal: { [self.uuid]: d.damage },
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };

      return res;
    },
  },

  demonicRage: {
    id: "demonicRage",
    name: "恶魔狂怒",
    target: "self",
    targetCount: 1,
    colddown: 6,
    mpCost: 20,
    effectStr: "进入狂怒状态，提升自身(100 + 技能等级)点攻击力，但防御力变为0，持续4回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff],

    effect: async ({ self, battleInfo, callbacks }) => {
      const currentDefence = getUnitStatusInBattle(self, 'defencing', { battleInfo, callbacks, ignoreTriggers: true });

     await addState("demonicRage", 4, self, self, {
        thisStateActuralValue: 100 + (self.skills.demonicRage?.level ?? 1),
        reduceDefence: currentDefence
      }, {
        battleInfo,
        callbacks
      });

      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [self.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  spectralClaw: {
    id: "spectralClaw",
    name: "幽灵利爪",
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 2,
    mpCost: 6,
    effectStr: "用幽灵化的利爪快速攻击目标，造成(24 + 敏捷100% + 技能等级*2)点伤害，忽略30%防御",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const target = getRandomUnitInCollection(enemies);
      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const dexterity = getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      const skillLevel = self.skills.spectralClaw?.level ?? 1;
      const damage = await dealDamage(self, target, Math.floor(24 + dexterity * 1.0 + skillLevel * 2), {
        ignoreDefencePercent: 30,
          battleInfo, 
        damageType: DamageType.Physical,
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'spectralClaw',
        },
      });

      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  hauntingWail: {
    id: "hauntingWail",
    name: "哀嚎怨声",
    target: "all_enemy",
    targetCount: 99,
    colddown: 4,
    mpCost: 15,
    effectStr: "发出怨恨的哀嚎，对所有敌人造成(10 + 智力80%)点伤害，并有70%概率使其沉默2回合",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const baseDamage = Math.floor(10 + intelligence * 0.8);

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      for (const target of enemies.filter(e => e.hp > 0)) {
        const damage = await dealDamage(self, target, baseDamage, {
          damageType: DamageType.Magical,
          battleInfo, 
          dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'hauntingWail',
        },
        });
        results.damage![target.uuid] = damage;
        results.targetUnitUuidList.push(target.uuid);

        // 50%概率沉默
        if (await checkRandomPercentAboutUnit(self, 0.7, {battleInfo, callbacks})) {
         await addState("silence", 2, self, target, {}, {
            battleInfo, callbacks
          });
        }
      }

      return results;
    },
  },

  vengeanceStrike: {
    id: "vengeanceStrike",
    name: "复仇一击",
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 5,
    mpCost: 18,
    effectStr: "释放复仇之力，造成(30 + 攻击力150% + 自身已损失生命值80%)点伤害",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const target = getRandomUnitInCollection(enemies);
      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const lostHp = self.maxHp - self.hp;
      const damage = await dealDamage(self, target, Math.floor(30 + attack * 1.5 + lostHp * 0.8), {
        damageType: DamageType.Physical,
          battleInfo, 
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'vengeanceStrike',
        },
      });

      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  despairAura: {
    id: "despairAura",
    name: "绝望光环",
    target: "all_enemy",
    targetCount: 99,
    colddown: 6,
    mpCost: 20,
    effectStr: "散发绝望的气息，使所有敌人陷入绝望状态（每回合开始时损失5%最大生命值），持续3回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],

    effect: async ({ self, enemies, addStateCallback, battleInfo, callbacks }) => {
      if (battleInfo.worldBossId) {
        return;
      }

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      for (const target of enemies.filter(e => e.hp > 0)) {
       await addState("despair", 3, self, target, {}, {
          battleInfo, callbacks,
          addStateCallback
        });
        results.targetUnitUuidList.push(target.uuid);
      }

      return results;
    },
  },

  phantomStrike: {
    id: "phantomStrike",
    name: "幽灵突击",
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 3,
    mpCost: 12,
    effectStr: "如幽灵般突然出现攻击行动顺序最后的敌人，造成(25 + 敏捷150% + 技能等级*3)点伤害，忽略50%防御，并使其移动至行动顺序第一位",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const target = getRandomUnitInCollection(enemies);
      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }

      const dexterity = getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks });
      const skillLevel = self.skills.phantomStrike?.level ?? 1;
      const damage = await dealDamage(self, target, Math.floor(25 + dexterity * 1.5 + skillLevel * 3), {
        ignoreDefencePercent: 50,
          battleInfo, 
        damageType: DamageType.Physical,
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'phantomStrike',
        },
      });

      // 将目标移动至行动顺序第一位
      moveUnitTurnOrder(battleInfo, target.uuid, 0);

      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  mentalBreak: {
    id: "mentalBreak",
    name: "精神崩溃",
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 8,
    mpCost: 25,
    effectStr: "对随机3个敌人施加精神攻击，造成(15 + 目标智力150%)点精神伤害，并有60%概率使其陷入慌乱状态，持续2回合",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage,SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });;
      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      // 随机选择3个敌人
      const targets = getRandomUnitsInCollection(enemies, 3);
      for (const target of targets) {
        if (!target) continue;

        const targetIntelligence = getUnitStatusInBattle(target, 'intelligence', { battleInfo, callbacks });
        const damage = await dealDamage(self, target, Math.floor(15 + intelligence * 1.8 + targetIntelligence * 0.5), {
          damageType: DamageType.Magical,
          battleInfo, 
          dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'mentalBreak',
        },
        });
        results.damage![target.uuid] = damage;
        results.targetUnitUuidList.push(target.uuid);

        // 60%概率慌乱
        if (await checkRandomPercentAboutUnit(self, 0.6, {battleInfo, callbacks})) {
         await addState("fluster", 2, self, target, {}, {
            battleInfo, callbacks
          });
        }
      }

      return results;
    },
  },

  painAmplifier: {
    id: "painAmplifier",
    name: "痛苦放大",
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 4,
    mpCost: 10,
    effectStr: "对随机敌人施加痛苦放大状态，使其每次受到伤害时额外受到10%当前生命值的伤害，持续3回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, callbacks }) => {
      const target = getRandomUnitInCollection(enemies);
      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }

     await addState("painAmplified", 3, self, target, {}, {
        battleInfo, callbacks
      });

      return {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  tortureProtocol: {
    id: "tortureProtocol",
    name: "酷刑程序",
    target: "all_enemy",
    targetCount: 99,
    colddown: 2,
    mpCost: 18,
    effectStr: "对所有敌人造成(8 + 攻击力80% + 技能等级 * 2)点伤害",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const skillLevel = self.skills.tortureProtocol?.level ?? 1;
      const baseDamage = Math.floor(8 + attack * 0.8 + skillLevel * 2);

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      results.damage = await dealAoeDamage(self, enemies, () => baseDamage, {
          damageType: DamageType.Physical,
          battleInfo, 
          dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'tortureProtocol',
        },
      });
      results.targetUnitUuidList = ObjectKeys(results.damage);

      // for (const target of enemies.filter(e => e.hp > 0)) {
      //   const damage = await dealDamage(self, target, baseDamage, {
      //   });
      //   results.damage![target.uuid] = damage;
      //   results.targetUnitUuidList.push(target.uuid);
      // }

      return results;
    },
  },

  mechanicalGrip: {
    id: "mechanicalGrip",
    name: "机械钳制",
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 5,
    mpCost: 12,
    effectStr: "用机械臂钳制敏捷最低的敌人，造成(18 + 攻击力120% + 技能等级*2)点伤害，并使其眩晕3回合",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const targets = getAvailableUnitCollection(enemies);

      let target = targets.reduce((a, b) => {
        const aDexterity = getUnitStatusInBattle(a, 'dexterity', { battleInfo, callbacks, onlyBaseStatus: true });
        const bDexterity = getUnitStatusInBattle(b, 'dexterity', { battleInfo, callbacks, onlyBaseStatus: true, });
        return aDexterity < bDexterity ? a : b;
      }, targets[0]);

      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }

      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const skillLevel = self.skills.mechanicalGrip?.level ?? 1;
      const damage = await dealDamage(self, target, Math.floor(18 + attack * 1.2 + skillLevel * 2), {
        damageType: DamageType.Physical,
          battleInfo, 
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'mechanicalGrip',
        },
      });

      // 使目标无法行动3回合
     await addState("stun", 3, self, target, {}, {
        battleInfo, callbacks
      });

      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  shadowCorruption: {
    id: "shadowCorruption",
    name: "暗影腐蚀",
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 6,
    mpCost: 20,
    effectStr: "用暗影力量腐蚀行动顺序最后的敌人，造成(35 + 攻击力100%)点伤害。\n其行动顺序前每有一个单位，额外造成(目标已损失生命值15%)点伤害，这部分伤害不会超过自身智力的800%\n",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const targets = getAvailableUnitCollection(enemies);

      if (targets.length === 0) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }

      let target: BaseBattleUnit | null = null
      for(const uuid of battleInfo.turnOrder.toReversed()) {
        if (!uuid) continue;
        const unit = targets.find(e => e.uuid === uuid);

        if (!!unit && unit.hp > 0) {
          target = unit;
          break;
        }
      }

      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }

      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const intelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });
      const baseDamage = Math.floor(35 + attack * 1.0);
      const extraDamagePerUnit = Math.floor((target.maxHp - target.hp) * 0.15);
      let extraDamage = extraDamagePerUnit * (battleInfo.turnOrder.length - battleInfo.turnOrder.indexOf(target.uuid));

      const maxExtraDamage = Math.floor(intelligence * 8);

      if (extraDamage > maxExtraDamage) {
        extraDamage = maxExtraDamage;
      }

      const totalDamage = await dealDamage(self, target, baseDamage + extraDamage, {
        damageType: DamageType.Magical,
          battleInfo, 
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'shadowCorruption',
        },
      });

      return {
        type: "skill",
        damage: { [target.uuid]: totalDamage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
     
    },
  },

  nightmareSlam: {
    id: "nightmareSlam",
    name: "噩梦重击",
    target: "single_random_enemy",
    targetCount: 1,
    colddown: 2,
    mpCost: 15,
    effectStr: "用噩梦之力重击行动顺序最前方的敌人，造成(45 + 攻击力180% + 力量100%)点伤害，并将其行动顺序向后移动1轮",

    damageType: DamageType.Magical,
    skillType: [SkillType.Damage, SkillType.Debuff],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const aliveEnemies = getAvailableUnitCollection(enemies);
      if (aliveEnemies.length === 0) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }

      let target: BaseBattleUnit | null = null
      for(const uuid of battleInfo.turnOrder) {
        if (!uuid) continue;
        const unit = aliveEnemies.find(e => e.uuid === uuid);

        if (!!unit && unit.hp > 0) {
          target = unit;
          break;
        }
      }

      if (!target) {
        return {
          type: "skill",
          damage: {},
          heal: {},
          targetUnitUuidList: [],
          sourceUnitUuid: self.uuid,
        };
      }

      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const strength = getUnitStatusInBattle(self, 'strength', { battleInfo, callbacks });
      const damage = await dealDamage(self, target, Math.floor(45 + attack * 1.8 + strength * 1.0), {
        damageType: DamageType.Magical,
          battleInfo, 
        dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'nightmareSlam',
        },
      });

      // 将目标的行动顺序向后移动1轮
      pushUnitTurnOrder(battleInfo, target.uuid, 1);

      return {
        type: "skill",
        damage: { [target.uuid]: damage },
        heal: {},
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  apocalypticRoar: {
    id: "apocalypticRoar",
    name: "末日咆哮",
    target: "all_enemy",
    targetCount: 99,
    colddown: 5,
    mpCost: 20,
    effectStr: "发出震撼灵魂的末日咆哮，对所有敌人造成(20 + 攻击力200% + 自身已损失生命值50%)点伤害",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks, skillExtraParam }) => {
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const lostHp = self.maxHp - self.hp;
      let baseDamage = Math.floor(20 + attack * 2.0 + lostHp * 0.8);

      if (!!skillExtraParam?.damageModifyPercent) {
        baseDamage = baseDamage * (1 + skillExtraParam?.damageModifyPercent)
      }

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      for (const target of enemies.filter(e => e.hp > 0)) {
        // 真实伤害
        const damage = await dealDamage(self, target, baseDamage, {
          damageType: DamageType.Physical,
          battleInfo, 
          dealDamageCallback,
          callbacks,
          causeBy: {
            type: DealDamageCauseByType.Skill,
            skillId: 'apocalypticRoar',
          },
        });
        results.damage![target.uuid] = damage;
        results.targetUnitUuidList.push(target.uuid);
      }

      return results;
    },
  },

  prisonDomination: {
    id: "prisonDomination",
    name: "监狱统治",
    target: "all_enemy",
    targetCount: 99,
    colddown: 2,
    mpCost: 40,
    effectStr: "展现霸主威严，对所有敌人造成(35 + 攻击力150% + 技能等级*8)点伤害",

    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],

    effect: async ({ self, enemies, battleInfo, dealDamageCallback, callbacks }) => {
      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      const skillLevel = self.skills.prisonDomination?.level ?? 1;
      const baseDamage = Math.floor(35 + attack * 1.5 + skillLevel * 8);

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: {},
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      for (const target of enemies.filter(e => e.hp > 0)) {
        const damage = await dealDamage(self, target, baseDamage, {
          ignoreDefencePercent: 25,
          battleInfo, 
          damageType: DamageType.Physical,
          dealDamageCallback,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: 'prisonDomination',
        },
        });
        results.damage![target.uuid] = damage;
        results.targetUnitUuidList.push(target.uuid);

        // 80%概率束缚
        if (await checkRandomPercentAboutUnit(self, 0.8, {battleInfo, callbacks})) {
         await addState("stun", 2, self, target, {}, {
            battleInfo, callbacks
          });
        }
      }

      return results;
    },
  },

  darkRitual: {
    id: "darkRitual",
    name: "黑暗仪式",
    target: "self",
    targetCount: 1,
    colddown: 10,
    mpCost: 60,
    effectStr: "进行黑暗仪式，己方每阵亡一个单位，回复自身(最大生命值15%)点生命值，并永久提升10点攻击力。\n每一个阵亡的友军还将额外召唤一个绝望幻影，持续5回合",

    damageType: DamageType.NoDamage,
    skillType: [SkillType.Buff, SkillType.Heal, SkillType.Summon],

    effect: async ({ self, allAllies, enemies, battleInfo, healCallback, callbacks }) => {
      const deadAlliesCount = allAllies.filter(a => a.hp <= 0).length;
      const healAmount = Math.floor(self.maxHp * 0.15 * deadAlliesCount);
      await healUnit(self, self, healAmount, {
        battleInfo,
        callbacks,
        reason: HpRestoreReason.SKILL_EFFECT,
        callback: healCallback,
      });

      // 永久提升攻击力
      const currentAttack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });
      self.status.attacking.level = currentAttack + 10;

      const results: FullBattleAction = {
        type: "skill",
        damage: {},
        heal: { [self.uuid]: healAmount },
        targetUnitUuidList: [],
        sourceUnitUuid: self.uuid,
      };

      for (let i = 0; i < deadAlliesCount; i++) {
        const uuid = v4()
        // 召唤一个绝望幻影
        const phantom = generateEnemyById('despair_phantom_001')

        if (!phantom) {
          continue
        }

        phantom.uuid = uuid;
        phantom.hp = phantom.maxHp; // 恢复满血

        summonUnit(battleInfo, self, phantom, 5)
      }

      return results;
    },
  },

  // ===== 23号宿舍 (dorm_023) 怪物技能 =====
  strengthInKittyNumbers: {
    id: "strengthInKittyNumbers",
    name: "喵多势众",
    target: "single_enemy",
    targetCount: 1,
    colddown: 4,
    mpCost: 0,
    effectStr: "对一个随机敌人造成攻击力100%的伤害\n己方阵营每存在1个非召唤物的单位，此伤害提高50%。",
    damageType: DamageType.Physical,
    skillType: [SkillType.Damage],
    effect: async ({ self, enemies, allies, battleInfo, callbacks }) => {
      const target = getRandomUnitInCollection(getAvailableUnitCollection(enemies));
      if (!target) return;

      const attack = getUnitStatusInBattle(self, 'attacking', { battleInfo, callbacks });

      const allyCount = allies.filter(u => !u.isSummoned && u.hp > 0).length;
    
      const damage = attack * (1 + allyCount * 0.5);

      const damageRes = await dealDamage(self, target, damage, {
        damageType: DamageType.Physical,
        battleInfo,
        callbacks,
        causeBy: {
          type: DealDamageCauseByType.Skill,
          skillId: "strengthInKittyNumbers",
        },
      });

      return {
        type: "skill",
        damage: { [target.uuid]: damageRes },
        heal: {},
        castSkillId: "strengthInKittyNumbers",
        targetUnitUuidList: [target.uuid],
        sourceUnitUuid: self.uuid,
      };
    },
  },

  lightsOut: {
    id: "lightsOut",
    name: "熄灯",
    target: "all_enemy",
    targetCount: 99,
    colddown: 3,
    mpCost: 25,
    effectStr: "为所有单位施加“扰乱”，持续1回合",
    damageType: DamageType.Magical,
    skillType: [SkillType.Damage],
    effect: async ({ self, enemies, allies, battleInfo, callbacks }) => {
      for (const target of enemies) {
       await addState("fluster", 2, self, target, {}, {
          battleInfo,
          callbacks
        });
      }

      for (const target of allies) {
       await addState("fluster", 2, self, target, {}, {
          battleInfo,
          callbacks
        });
      }

      return {
        type: "skill",
        damage: {},
        heal: {},
        castSkillId: "ringPulse",
        targetUnitUuidList: [...enemies, ...allies].map((u) => u.uuid),
        sourceUnitUuid: self.uuid,
      };
    },
  },
  ...catDungeon002SkillData,

  ...allWorkStatusBattleSkills,
  ...allSummonUnitSkills,
  ...allEquipmentBoundSkills,
  ...allSingleSkills,
  ...allWorldBossSkill,

} as const satisfies Record<string, GameBattleSkill>;

export const allGameBattleSkillIds = Object.keys(allGameBattleSkills) as AllBattleSkillId[]

function calcSkillValue(
  skill: GameBattleSkill,
  baseDamage: number,
  rarity?: string
) {
  // 冷却修正：每多1回合+20%
  const cooldownFix = 1 + 0.2 * Math.max(0, skill.colddown - 1);
  // MP修正：每点MP+3%
  const mpFix = 1 + 0.03 * skill.mpCost;
  // 群体修正：全体0.6，3人0.7，2人0.8，单体1
  let groupFix = 1;
  if (skill.targetCount >= 99) groupFix = 0.6;
  else if (skill.targetCount === 3) groupFix = 0.7;
  else if (skill.targetCount === 2) groupFix = 0.8;
  // 特效修正
  let effectFix = 1;
  if (skill.skillType.includes(SkillType.Debuff)) effectFix = 0.8;
  if (skill.skillType.includes(SkillType.Buff) || skill.skillType.includes(SkillType.Heal) || skill.skillType.includes(SkillType.Shield)) effectFix = 0.9;
  // 控制类优先最低
  // if (skill.skillType.includes("control)) effectFix = 0.7;

  // 技能强度系数
  const value = baseDamage / (cooldownFix * mpFix * groupFix * effectFix);

  return {
    value, // 技能强度系数
    rarity // 稀有度，仅返回
  };
}
// globalThis.calcSkillValue = calcSkillValue
// globalThis.allGameBattleSkills = allGameBattleSkills