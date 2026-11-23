import { CharacterStatus } from "~/generated/prisma";
import { allEquipmentTriggerData } from "~/server/data/allEquipmentTriggerData";
import { affixDefinitionsById } from "~/shared/data/affix/definitions";
import { allBattleState, allFoodState } from "~/shared/data/allBattleState";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";
import { allGameResource } from "~/shared/data/allGameResources";
import { allBattleRoomOffering } from "~/shared/data/allBattleRoomOffering";
import { ATTACK_EXP_PER_DEAL_DAMAGE, DEX_EXP_PER_DEAL_DAMAGE, STRENGTH_EXP_PER_DEAL_DAMAGE } from "~/shared/data/constant";
import { allBattleSkillTreeNodesMap, allSkillTreeNodeMap, allSkillTreeNodes } from "~/shared/data/skillTrees";
import { FuncAction } from "~/shared/types";
import { AffixDefinition, AffixEffectResolved, AffixKeyTemplate, CharacterAffixInstance, AffixKeyHooks } from "~/shared/types/affix";
import { BattleCallback, BattleRoundStage, CastSkillExtraParam, DealDamageCauseByType, DealDamageOption, EquipmentAfterOtherUnitCastSkillTriggerParam, EquipmentAfterOtherUnitLossMpTriggerParam, EquipmentBeforeOtherUnitCastSkillTriggerParam, EquipmentCastSkillTriggerParam, EquipmentTriggerInfo, EquipmentTriggerParam, HealTriggerBy, HpRestoreReason, MpLossReason, MpRestoreReason, SimpleBattleHpRestoreCallback, SimpleBattleMpRestoreCallback, SimpleBattleTargetActionCallback, SimpleBattleTargetAddStateActionCallback, SimpleBattleTargetDamageActionCallback, SimpleCastSkillActionCallback, SimpleFloatTextActionCallback, type BattleInfo } from "~/shared/types/battle";
import { BattleStateInBattle, BattleStateInBattleExtraInfo, type AllBattleStateId, type BattleState } from "~/shared/types/BattleState";
import { AllBaseCharacterStatusType, allCharacterEquipmentPart, CharacterEquipmentPart, CharacterStatusImprove, CharacterStatusInfo } from "~/shared/types/characterInfo";
import { GameResource } from "~/shared/types/gameResource";
import type { BattleRoom } from "~/shared/types/battleRoom";
import type { BattleRoomOfferingEffectTrigger, BattleRoomOfferingSpec, BattleRoomOfferingStack } from "~/shared/types/battleRoomOffering";
import { MsgQueuePayload } from "~/shared/types/msgQueue";
import { AllBattleSkillId, DamageType, GameBattleSkill } from "~/shared/types/skill";
import { SkillTreeNode } from "~/shared/types/skillTree";
import type { BaseBattleUnit, BaseUnitStatusInfo, BattleLifeStatus, UnitStatisticInfoInSingleBattle, } from "~/shared/types/unit";
import { clone, delay, ObjectKeys, ObjectKeysTyped, randomElementInCollection, randomElementsInCollection, randomNumberInFullColseRange, safeJsonParse } from "~/shared/utils";
import { getUnitGroupId, hasState, getAvailableUnitCollection, } from "~/shared/utils/game/battle";
import { getEquipmentActuralId, getEquipmentLevel, hasEquipment } from "~/shared/utils/game/equipment";

const unitStatistic = new Map<string, UnitStatisticInfoInSingleBattle>()
const unitStatisticTouchedAt = new Map<string, number>();
const UNIT_STAT_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5min
const UNIT_STAT_MAX_AGE_MS = 10 * 60 * 1000; // 10min idle => drop

let lastUnitStatSweepAt = Date.now();
const sweepUnitStatistic = () => {
  const now = Date.now();
  lastUnitStatSweepAt = now;
  for (const [unitId, ts] of unitStatisticTouchedAt.entries()) {
    if (now - ts > UNIT_STAT_MAX_AGE_MS) {
      unitStatisticTouchedAt.delete(unitId);
      unitStatistic.delete(unitId);
    }
  }
};

if (typeof setInterval === 'function') {
  const t = setInterval(sweepUnitStatistic, UNIT_STAT_SWEEP_INTERVAL_MS);
  t.unref?.();
}
export const modifyUnitStatistic = (unit: BaseBattleUnit, type: keyof UnitStatisticInfoInSingleBattle, modify: UnitStatisticInfoInSingleBattle[typeof type]): void => {
  // Fallback sweep in case setInterval is unavailable/disabled in the runtime
  if (Date.now() - lastUnitStatSweepAt > UNIT_STAT_SWEEP_INTERVAL_MS) {
    sweepUnitStatistic();
  }

  if (type == 'takeHeal' || type == 'giveHeal' || type == 'lossMp' || type == 'restoreMp') {
    return;
  }

  let ori = unitStatistic.get(unit.uuid);
  if (!ori) {
    ori = {
      dealDamage: {},
      takeDamage: {},

      giveHeal: {},
      takeHeal: {},

      lossMp: {},
      restoreMp: {},

      addState: {},

      castSkill: {}
    }
  }

  if (type == 'addState') {
    if (!ori.addState) {
      ori.addState = {}
    }

    for(const target of Object.keys(modify)) {
      if (!ori.addState[target]) {
        ori.addState[target] = [];
      }

      let thisModify = modify as UnitStatisticInfoInSingleBattle["addState"];

      let thisTimeModify = thisModify[target];
      // Optimize: avoid creating a new array; push in-place
      if (Array.isArray(thisTimeModify) && thisTimeModify.length > 0) {
        Array.prototype.push.apply(ori.addState[target], thisTimeModify);
      }
    }

    unitStatistic.set(unit.uuid, ori);
    unitStatisticTouchedAt.set(unit.uuid, Date.now());

    return;
  }

  if (type == 'castSkill') {
    if (!ori.castSkill) {
      ori.castSkill = {}
    }

    for(const skillId of Object.keys(modify)) {
      if (!ori.castSkill) {
        ori.castSkill = {};
      }

      const thisSkillId = skillId as AllBattleSkillId
      const thisModify = modify as UnitStatisticInfoInSingleBattle["castSkill"];

      if (!ori.castSkill[thisSkillId]) {
        ori.castSkill[thisSkillId] = 0;
      }

      ori.castSkill[thisSkillId] = ori.castSkill[thisSkillId] + thisModify[thisSkillId]!;
    }

    unitStatisticTouchedAt.set(unit.uuid, Date.now());
    return;
  }

  if (!ori[type]) {
    ori[type] = {};
  }

  for(const target of Object.keys(modify)) {
    let thisModify = modify as UnitStatisticInfoInSingleBattle[typeof type];
    let thisModifyValue = thisModify[target] as number;

    if (!ori[type][target]) {
      ori[type][target] = 0;
    }

    ori[type][target] += thisModifyValue;
  }

  unitStatistic.set(unit.uuid, ori);
  unitStatisticTouchedAt.set(unit.uuid, Date.now());
}
export const getAndClearUnitStatistic = (unit: BaseBattleUnit): Readonly<UnitStatisticInfoInSingleBattle> | null => {
  if (!unitStatistic.has(unit.uuid)) {
    return null
  }

  const ref = unitStatistic.get(unit.uuid)!;
  unitStatistic.delete(unit.uuid);
  unitStatisticTouchedAt.delete(unit.uuid);
  return ref;
}

export const saveUnitStatisticIntoRedis = async (group: number = 0, redisClient: any) => {
  let key = `battleUnitStatistic:group:${group}`;
  let obj: Record<string, UnitStatisticInfoInSingleBattle> = {};
  for (const [unitId, stat] of unitStatistic.entries()) {
    obj[unitId] = stat;
  }
  await redisClient.set(key, JSON.stringify(obj));
}
export const loadUnitStatisticFromRedis = async (group: number = 0, redisClient: any)  => {
  let key = `battleUnitStatistic:group:${group}`;

  let res = await redisClient.get(key);

  // 将res反序列化为unitStatistic
  const savedUnitStatistic = safeJsonParse(res, {});
  if (savedUnitStatistic && typeof savedUnitStatistic === 'object') {
    for (const [unitId, stat] of Object.entries(savedUnitStatistic)) {
      unitStatistic.set(unitId, stat as UnitStatisticInfoInSingleBattle);
      unitStatisticTouchedAt.set(unitId, Date.now());
    }
  }
}

export const getAllUnitStatusticInBattle = (battleInfo: BattleInfo): Record<string, Readonly<UnitStatisticInfoInSingleBattle>> => {
  let result: Record<string, Readonly<UnitStatisticInfoInSingleBattle>> = {};

  for (const unit of battleInfo.members) {
    const stat = getAndClearUnitStatistic(unit);
    if (stat) {
      result[unit.uuid] = stat;
    }
  }

  return result;
}

// Utility: lightweight promise detector. Cheap check used to avoid
// unnecessary `await` and microtask creation when callback is sync.
function isPromise(v: any): v is Promise<any> {
  return !!v && (typeof v === 'object' || typeof v === 'function') && typeof (v as any).then === 'function';
}

export const isUnitSelectable = (unit: BaseBattleUnit, opt?: {
  includeSneak?: boolean;
  includeDead?: boolean;
}) => {
  if (unit.state?.sneak && !opt?.includeSneak) {
    return false;
  }

  if (unit.hp <= 0 && !opt?.includeDead) {
    return false;
  }

  if (unit.state?.banished) {
    return false;
  }

  return true;
}
export const getRandomUnitInCollection = (unitCollection: BaseBattleUnit[], opt?: {
  includeSneak?: boolean;
  includeDead?: boolean;
}): BaseBattleUnit | undefined => {
  const availableUnits = getAvailableUnitCollection(unitCollection, opt);
  if (availableUnits.length === 0) return;

  return randomElementInCollection(availableUnits);
}

export const getRandomUnitsInCollection = (unitCollection: BaseBattleUnit[], count: number, opt?: {
  includeSneak?: boolean;
  includeDead?: boolean;
}): BaseBattleUnit[]=> {
  const availableUnits = getAvailableUnitCollection(unitCollection, opt);
  if (availableUnits.length === 0) return [];

  return randomElementsInCollection(availableUnits, count, {
    allowDuplicates: false
  })
}


let globalCallbackGenerator: (battleInfo: BattleInfo) => BattleCallback | null = () => null 
export const setGlobalBattleCallbackGenerator = (generator: (battleInfo: BattleInfo) => BattleCallback | null) => {
  globalCallbackGenerator = generator;
}

export async function dealDamage(source: BaseBattleUnit, target: BaseBattleUnit, damage: number, option: DealDamageOption): Promise<{
  damage: number,
  fDamage: number,
  damageType: DamageType
}> {
  // if (source.isPlayer && !target.isPlayer) {
  //   damage = 4000
  // }
  // if (!source.isPlayer && target.isPlayer) {
  //   damage = 1
  // }

  let allTargets = option?.allTargets ?? [target]
  // 伤害默认为物理
  let damageType = option?.damageType ?? DamageType.Physical;

  let callbacks = option.callbacks || globalCallbackGenerator(option.battleInfo)!

  let oriDamageType = damageType;
  let oriDamage = damage;

  let oriIgnoreDefencePercent = option?.ignoreDefencePercent ?? 0;
  let baseIgnoreDefencePercent = option?.ignoreDefencePercent ?? 0;
  let baseIngoreDefenceValue = option?.ignoreDefenceValue ?? 0;

  const callback = option?.callbacks?.dealDamageCallback || option?.dealDamageCallback;

  const callEquipmentHook = async (
    unit: BaseBattleUnit,
    hook: AsyncIteratorUnitEquipmentBreakCallback,
    requiredHook?: keyof EquipmentTriggerInfo
  ) => {
    if (option.ignoreTrigger && !option.triggerWhiteList?.equipment?.length) {
      return;
    }

    if (!unit.equipment || !Object.keys(unit.equipment).length) {
      return;
    }

    await iteratorUnitEquipmentAsync(unit, async (arg) => {
      if (!option.ignoreTrigger) {
        return hook(arg)
      }

      if (arg.rawEquipmentId && option.triggerWhiteList?.equipment?.includes(arg.equipmentId)) {
        return hook(arg)
      }

      return;
    }, requiredHook ? { requiredHook } : undefined)
  }

  const callStateHook = async (
    unit: BaseBattleUnit,
    hook: AsyncIteratorUnitStateBreakCallback,
    requiredHook?: keyof BattleState
  ) => {
    if (option.ignoreTrigger) {
      return;
    }

    if (!unit.state || !Object.keys(unit.state).length) {
      return;
    }

    return iteratorUnitStateAsync(unit, hook, requiredHook ? { requiredHook } : undefined)
  }

  const callAffixHook = (unit: BaseBattleUnit, hook: IteratorUnitAffixBreakCallback, requiredHook?: keyof AffixKeyHooks) => {
    if (option.ignoreTrigger) {
      return;
    }

    if (!unit.affix?.length) {
      return;
    }

    return iteratorUnitAffix(unit, hook, requiredHook ? { requiredHook } : undefined)
  }

  const callSkillNodeHook = (unit: BaseBattleUnit, hook: (node: SkillTreeNode, level: number) => void, requiredHook?: keyof NonNullable<SkillTreeNode['businessBattleEffects']>) => {
    if (option.ignoreTrigger) {
      return;
    }

    if (!unit.skillTreeNodes?.length) {
      return;
    }

    return iteratorUnitSkillNodeAsync(unit, hook, requiredHook ? { requiredHook } : undefined)
  }

  await callEquipmentHook(
    source,
    ({ equipmentId, equipmentTrigger }) => {
      damageType =
        equipmentTrigger?.beforeDecideDamageType?.({
          self: source,
          equipmentId,
          source,
          target,
          oriDamageType,
          latestDamageType: damageType,
          battleInfo: option.battleInfo,
          allTargets,
          causeBy: option?.causeBy ?? {},
        }) ?? damageType;
    },
    'beforeDecideDamageType'
  );

  if (target.hp <= 0) return { damage: 0, fDamage: 0, damageType }; // 如果目标已经死亡，直接返回

  // ==========税前伤害计算=========
  await callEquipmentHook(source, async ({ equipmentId, equipmentTrigger }) => {
    damage =
      await equipmentTrigger?.beforeDamageSourceCalcDamage?.({
        self: source,
        equipmentId,
        battleInfo: option.battleInfo,
        source,
        target,
        oriDamage,
        reducedDamage: damage,
        damageType,
        allTargets,
        causeBy: option?.causeBy ?? {},
        callbacks,
      }) ?? damage; // 如果有beforeDealDamage钩子，使用其返回值，否则使用原始伤害
  }, 'beforeDamageSourceCalcDamage');

  await callStateHook(source, async ({ stateInfo, stateInBattle }) => {
    damage =
      await stateInfo.onBeforeDamageSourceCalcDamage?.({
        self: source,
        state: stateInBattle,
        damageSource: source,
        target: target,
        oriDamage,
        reducedDamage: damage,
        battleInfo: option.battleInfo,
        callbacks,
        damageType,
        allTargets,
        causeBy: option.causeBy,
      }) ?? damage; // 如果有onBeforeDealDamage钩子，使用其返回值，否则使用原始伤害
  }, 'onBeforeDamageSourceCalcDamage');

  // 所有额外伤害增加的数值
  let totalExtraDamageBeforeCalcDefence = 0
  await callEquipmentHook(source, async ({ equipmentTrigger, equipmentId }) => {
    totalExtraDamageBeforeCalcDefence +=
      await equipmentTrigger?.onNeedModifyOriginDamage?.({
        self: source,
        equipmentId,
        battleInfo: option.battleInfo,
        source,
        target,
        oriDamage,
        totalExtraDamageBeforeCalcDefence,
        damageType,
        allTargets,
        causeBy: option?.causeBy ?? { type: DealDamageCauseByType.Other },
        callbacks,
      }) ?? 0;
  }, 'onNeedModifyOriginDamage');
  await callStateHook(source, async ({stateInfo, stateInBattle}) => {
      totalExtraDamageBeforeCalcDefence += await stateInfo.onNeedModifyOriginDamage?.({
        self: source,
        state: stateInBattle,
        damageSource: source,
        target: target,
        oriDamage,
        totalExtraDamageBeforeCalcDefence,
        callbacks,
        battleInfo: option.battleInfo,
        damageType,
        allTargets,
        causeBy: option.causeBy
      }) ?? 0; // 如果有onBeforeDealDamage钩子，使用其返回值，否则使用原始伤害
  }, 'onNeedModifyOriginDamage')

  let extraDamageModifyFromSkillNode = 0;
  await callSkillNodeHook(source, async (node, level) => {
    const thisExtraDamageModifyFromSkillNode = await node.businessBattleEffects?.onNeedModifyOriginDamage?.({
      self: source,
      target: target,
      level,
      damageType,
      battleInfo: option.battleInfo,
      totalExtraDamageBeforeCalcDefence,
      originDamage: oriDamage,
      callbacks
    }) ?? 0

    extraDamageModifyFromSkillNode += thisExtraDamageModifyFromSkillNode;
  }, 'onNeedModifyOriginDamage')

  damage += (totalExtraDamageBeforeCalcDefence + extraDamageModifyFromSkillNode);
  // 增量伤害计算结束

  // ==========税前伤害计算=========

  await callEquipmentHook(source, async ({ equipmentId, equipmentTrigger }) => {
    baseIgnoreDefencePercent =
      await equipmentTrigger?.beforeDamageSourceCalcDefenceIgnore?.({
        self: source,
        equipmentId,
        battleInfo: option.battleInfo,
        source,
        target,
        oriDefenceIgnore: option?.ignoreDefencePercent ?? 0,
        latestDefenceIgnore: baseIgnoreDefencePercent,
        allTargets,
        damageType,
        causeBy: option?.causeBy ?? {}
      }) ?? baseIgnoreDefencePercent; // 如果有beforeDealDamage钩子，使用其返回值，否则使用原始伤害
  }, 'beforeDamageSourceCalcDefenceIgnore');

  let extraDefenceIgnorePercent = 0;
  await callStateHook(source, async ({ stateInfo, stateInBattle }) => {
    extraDefenceIgnorePercent +=
      await stateInfo.onDamageSourceNeedModifyDefenceIgnorePercent?.({
        self: source,
        state: stateInBattle,
        battleInfo: option.battleInfo,
        callbacks,

        source,
        target,
        damageSource: source,

        oriDamage: oriDamage,
        oriDefenceIgnorePercent: oriIgnoreDefencePercent,

        allTargets,
        damageType,
        causeBy: option?.causeBy ?? {}
      }) ?? 0;
  }, 'onDamageSourceNeedModifyDefenceIgnorePercent');

  callAffixHook(source, ({ affixConf, affixInstance }) => {
    extraDefenceIgnorePercent +=
      affixConf.effect?.onDamageSourceNeedModifyDefenceIgnorePercent?.({
        self: source,
        target,

        battleInfo: option.battleInfo,
        callbacks,

        oriDamage: oriDamage,
        oriDefenceIgnorePercent: oriIgnoreDefencePercent,

        damageType,

        effect: affixInstance
      }) ?? 0;
  }, 'onDamageSourceNeedModifyDefenceIgnorePercent');

  // 有效防御 = (防御 - 固定防御穿透) * (1 - 百分比防御穿透)
  let originDefence = target.status.defencing?.level ?? 0

  const percentIgnore = (baseIgnoreDefencePercent + extraDefenceIgnorePercent);

  if (option.ignoreDefence) { // 如果完全忽视护甲，则视为防御为0
    originDefence = 0
  }

  // 先计算百分比穿透
  let effectiveDefence = originDefence * (1 - percentIgnore / 100);

  // 计算百分比后，处理固定穿透
  effectiveDefence -= baseIngoreDefenceValue;


  // 伤害减免比例 = (0.0065 * 有效防御) / (1 + 0.0065 * 有效防御)
  let damageReductionRatio = (0.0065 * effectiveDefence) / (1 + 0.0065 * effectiveDefence);

  // 有效防御 < 0 时，伤害增幅 = 1 - |(0.0065 * 有效防御) / (1 - 0.0065 * 有效防御}|
  if (effectiveDefence < 0) {
    damageReductionRatio =  -Math.abs((0.0065 * effectiveDefence) / (1 - 0.0065 * effectiveDefence));
  }

  damage = damage * (1 - damageReductionRatio);

  damage = Math.trunc(damage)

  let shieldDamage = 0
  if (target.tmpShield > 0) {
    // 如果目标有临时护盾，先扣除护盾
    shieldDamage = Math.min(target.tmpShield, damage);
    target.tmpShield -= shieldDamage;
    damage -= shieldDamage;
    if (target.tmpShield < 0) target.tmpShield = 0; // 确保护盾不会低于0
    if (damage <= 0) {

      if (!option?.ignoreDealDamageCallback) {
        callback?.({
          source,
          target: [
            {
              unit: target,
              shieldDamage: shieldDamage,
              damageType: damageType,
              value: 0,
              fDamage: 0,
              causeBy: {},
              remainingHp: target.hp,
            },
          ],

          hideAnimEffect_Line: option.hideAnimEffect_Line
        });
      }

      return { damage: 0, fDamage: 0, damageType }; // 如果伤害已经被护盾吸收完，直接返回
    }
  }

  // ==========造成伤害阶段==========
  await callEquipmentHook(target, async ({ equipmentId, equipmentTrigger }) => {
    damage = await equipmentTrigger?.beforeTakeDamage?.({
      self: target,
      equipmentId,
      battleInfo: option.battleInfo,
      source,
      target,
      allTargets,
      oriDamage,
      reducedDamage: damage,
      damageType,
      causeBy: option?.causeBy ?? {},
      callbacks,
    }) ?? damage;
  }, 'beforeTakeDamage');
  await callStateHook(target, async ({ stateInBattle, stateInfo }) => {
    damage =
      await stateInfo.onBeforeTakeDamage?.({
        self: target,
        state: stateInBattle,
        damageSource: source,
        target: target,
        allTargets,
        oriDamage,
        reducedDamage: damage,
        battleInfo: option.battleInfo,
        callbacks,
        damageType,
      }) ?? damage; // 如果有onBeforeDealDamage钩子，使用其返回值，否则使用原始伤害
  }, 'onBeforeTakeDamage');

  await callSkillNodeHook(target, async (node, level) => {
    damage = await node.businessBattleEffects?.onBeforeTakeDamage?.({
      self: target,
      damageSource: source,
      target,
      level,
      damageType,
      reducedDamage: damage,
      callbacks,
      battleInfo: option.battleInfo,
    }) ?? damage
  }, 'onBeforeTakeDamage')

  for(const unit of option.battleInfo.members) {
    if (unit.hp <= 0) continue; // 死亡单位不触发
    if (unit.uuid === target.uuid) continue;

    // 快速跳过：如果单位既没有装备也没有状态，则不需要调用装备/状态钩子
    // 如果 unit.equipment 是空对象，也跳过（减少 iteratorUnitEquipment 调用）
    if (!unit.equipment || !Object.keys(unit.equipment).length) continue;

    await callEquipmentHook(unit, async ({ equipmentId, equipmentTrigger }) => {
      damage = await equipmentTrigger?.beforeOtherUnitTakeDamage?.({
        self: unit,
        equipmentId,
        battleInfo: option.battleInfo,
        source,
        target,
        allTargets,
        oriDamage,
        reducedDamage: damage,
        damageType,
        causeBy: option?.causeBy ?? {},
        callbacks,
      }) ?? damage;
    }, 'beforeOtherUnitTakeDamage');
  }
  // ==========造成伤害阶段End==========

  damage = Math.trunc(damage)

  // 如果处理完成后，damage已经小于等于0，则不造成伤害
  if (damage <= 0) {
    callback?.({
      source,
      target: [
        {
          unit: target,
          shieldDamage,
          damageType: damageType,
          value: damage,
          fDamage: 0,
          causeBy: {},
          remainingHp: target.hp,
        }
      ],
      hideAnimEffect_Line: option.hideAnimEffect_Line
    })

    return { damage: 0, fDamage: 0, damageType };
  }

  // damage最小为1
  damage = Math.max(damage, 1);


  // 如果限制了最大伤害
  if (typeof option.maxDamage == 'function') {
    damage = Math.min(damage, option.maxDamage(target))
  }

  const finalDamage = damage;

  // 处理过量伤害，damage不会超过目标当前生命值
  damage = Math.min(damage, target.hp);

  const hpBeforeTakeDamage = target.hp;

  target.hp -= damage;

  // hp取整
  target.hp = Math.trunc(target.hp)
  if (target.hp < 0) {
    target.hp = 0; // 确保不会低于0
  }

  if (!option?.ignoreDealDamageCallback) {
    callback?.({
      source,
      target: [
        {
          unit: target,
          shieldDamage,
          damageType: damageType,
          value: damage,
          fDamage: finalDamage,
          causeBy: {},
          remainingHp: target.hp,
        }
      ],
      hideAnimEffect_Line: option.hideAnimEffect_Line
    })
  }

  // ==========造成伤害后阶段==========

  await callEquipmentHook(source, async ({ equipmentTrigger, equipmentId }) => {
    return equipmentTrigger?.afterDealDamage?.({
        self: source,
        equipmentId,
        battleInfo: option.battleInfo,
        damageSource: source,
        source,
        hpBeforeTakeDamage,
        target,
        oriDamage,
        reducedDamage: damage,
        damageType,
        allTargets,
        causeBy: option?.causeBy ?? { type: DealDamageCauseByType.Other },
        callbacks,
      })
  }, 'afterDealDamage')

  await callStateHook(source, async ({ stateInfo, stateInBattle }) => {
    return stateInfo?.afterDealDamage?.({
        state: stateInBattle,
        self: source,
        damageSource: source,
        target,
        oriDamage,
        reducedDamage: damage,
        damageType,
        allTargets,
        callbacks,
        battleInfo: option.battleInfo,
        causeBy: option.causeBy ?? { type: DealDamageCauseByType.Other },
      })
  }, 'afterDealDamage')

  await callEquipmentHook(target, async ({ equipmentTrigger, equipmentId }) => {
    return equipmentTrigger?.afterTakeDamage?.({
        self: target,
        damageSource: source,
        battleInfo: option.battleInfo,
        equipmentId,
        source,
        target,
        hpBeforeTakeDamage,
        allTargets,
        oriDamage,
        reducedDamage: damage,
        damageType,
        causeBy: option.causeBy ?? { type: DealDamageCauseByType.Other },
        callbacks,
      })
  }, 'afterTakeDamage')

  await callStateHook(target, async ({stateInfo, stateInBattle}) => {
    return stateInfo?.afterTakeDamage?.({
        self: target,
        state: stateInBattle,
        damageSource: source,
        target: target,
        allTargets,
        oriDamage,
        reducedDamage: damage,
        damageType,
        hpBeforeTakeDamage,
        battleInfo: option.battleInfo,
        causeBy: option.causeBy ?? { type: DealDamageCauseByType.Other },
        callbacks,
      })
  }, 'afterTakeDamage');

  // ==========承受伤害后阶段==========

  modifyUnitStatistic(source, "dealDamage", {
    [target.uuid]: damage
  });
  modifyUnitStatistic(target, "takeDamage", {
    [source.uuid]: damage
  });

  return { damage, fDamage: finalDamage, damageType };
}

export async function dealAoeDamage(source: BaseBattleUnit, targets: BaseBattleUnit[], damageCalc: (target: BaseBattleUnit) => number, option: DealDamageOption): Promise<Record<string, {
    damage: number,
    fDamage: number,
    damageType: DamageType
}>> {
  let individualDamages: Record<string, {
    damage: number,
    fDamage: number,
    damageType: DamageType
  }> = {};

  // let results = [];
  for(const target of targets) {
    if (target.hp <= 0) continue;

      const res = await dealDamage(source, target, damageCalc(target), {
        ...option,
        damageType: option?.damageType ?? DamageType.Physical,
        ignoreDealDamageCallback: true,
        allTargets: targets,
        battleInfo: option.battleInfo,
      })

      // results.push(res);
      individualDamages[target.uuid] = res;
  }
  // const results = await Promise.all(
  //   targets.map((t) =>
  //   )
  // );

  // for (let i = 0; i < targets.length; i++) {
  //   const t = targets[i];
  //   individualDamages[t.uuid] = results[i];
  // }

  let callback = option?.callbacks?.dealDamageCallback || option?.dealDamageCallback;

  callback?.({
    source,
    target: (() => {
      const uuidToUnit = new Map<string, BaseBattleUnit>();
      for (const t of targets) {
        uuidToUnit.set(t.uuid, t);
      }
      return ObjectKeys<string>(individualDamages).map((uuid) => {
        const target = uuidToUnit.get(uuid);
        return {
          unit: target as BaseBattleUnit,
          damageType: individualDamages[uuid].damageType,
          causeBy: {},
          value: individualDamages[uuid].damage,
          fDamage: individualDamages[uuid].fDamage,
          remainingHp: target!.hp,
        };
      });
    })(),

    hideAnimEffect_Line: option.hideAnimEffect_Line
  });

  return individualDamages;
}

type HealUnitOption = {
  reason: HpRestoreReason
  triggerBy?: HealTriggerBy
  callback?: SimpleBattleHpRestoreCallback
  battleInfo: BattleInfo
  callbacks: BattleCallback
  ignoreHook?: boolean
}
export async function healUnit(
  source: BaseBattleUnit,
  target: BaseBattleUnit,
  healAmount: number,
  option: HealUnitOption
): Promise<number> {
  if (target.hp <= 0) return 0; // 如果目标已经死亡，直接返回

  const oriHealAmount = healAmount;

  healAmount = Math.min(healAmount, target.maxHp - target.hp); // 确保治疗不超过已损失生命值

  if (!option.ignoreHook) {
    await iteratorUnitStateAsync(
      target,
      async ({ stateInfo, stateInBattle }) => {
        if (typeof stateInfo.onBeforeTakeHeal !== "function") return;
        let res = await stateInfo.onBeforeTakeHeal({
          self: target,
          state: stateInBattle,

          source: source,
          target,

          callbacks: option.callbacks,
          battleInfo: option.battleInfo,

          oriHeal: oriHealAmount,
          finalHeal: healAmount,
        });

        if (res && typeof res === "number") {
          healAmount = res;
        }
      },
      { requiredHook: "onBeforeTakeHeal" }
    );
  }

  // 0治疗不触发
  if (healAmount <= 0) {
    return 0;
  }

  healAmount = Math.trunc(healAmount);

  target.hp += healAmount;
  if (target.hp > target.maxHp) target.hp = target.maxHp; // 确保不会超过最大生命值

  let callback = option.callbacks?.healCallback || option.callback;
  callback?.({
    source,
    target,
    value: healAmount,
    reason: option.reason,
  });

  if (!option.ignoreHook) {
    await iteratorUnitEquipmentAsync(
      source,
      ({ equipmentTrigger, equipmentId }) => {
        if (!equipmentTrigger?.afterHealUnit) return;
        return equipmentTrigger.afterHealUnit({
          self: source,
          source: source,
          target,
          callbacks: option.callbacks,
          battleInfo: option.battleInfo,
          reason: option.reason,
          triggerBy: option.triggerBy,
          equipmentId,
          oriHealValue: oriHealAmount,
          actualHealValue: healAmount,
        });
      },
      { requiredHook: "afterHealUnit" }
    );

    await iteratorUnitEquipmentAsync(
      target,
      ({ equipmentTrigger, equipmentId }) => {
        if (!equipmentTrigger?.afterTakeHeal) return;
        return equipmentTrigger.afterTakeHeal({
          self: target,
          source: source,
          target,
          callbacks: option.callbacks,
          battleInfo: option.battleInfo,
          reason: option.reason,
          triggerBy: option.triggerBy,
          equipmentId,
          oriHealValue: oriHealAmount,
          actualHealValue: healAmount,
        });
      },
      { requiredHook: "afterTakeHeal" }
    );

    await iteratorUnitStateAsync(
      target,
      ({ stateInfo, stateInBattle }) => {
        if (typeof stateInfo.afterTakeHeal !== "function") return;
        return stateInfo.afterTakeHeal({
          self: target,
          thisState: stateInBattle,
          source: source,
          target,
          callbacks: option.callbacks,
          battleInfo: option.battleInfo,
          reason: option.reason,
          triggerBy: option.triggerBy,
          oriHealValue: oriHealAmount,
          actualHealValue: healAmount,
        });
      },
      { requiredHook: "afterTakeHeal" }
    );
  }

  modifyUnitStatistic(source, "giveHeal", {
    [target.uuid]: healAmount,
  });
  modifyUnitStatistic(target, "takeHeal", {
    [source.uuid]: healAmount,
  });

  return healAmount;
}

export function checkCanLossMp(source: BaseBattleUnit, target: BaseBattleUnit, mpLoss: number, reason: MpLossReason): boolean {
  if (target.mp <= 0) return false; // 如果目标没有魔法值

  let oriMpLoss = mpLoss;

  for (const slot of ObjectKeys<CharacterEquipmentPart>(source.equipment ?? {})) {
    let equipmentId = source.equipment?.[slot];
    if (!equipmentId) continue;
    let rawEquipmentId = getEquipmentActuralId(equipmentId);
    let equipmentTrigger = allEquipmentTriggerData[rawEquipmentId]

    if (!equipmentTrigger) continue;

    mpLoss = equipmentTrigger.beforeLossMp?.({
      self: source,
      equipmentId,
      source,
      target,
      oriLoss: oriMpLoss,
      mpLoss,
      reason,
      preCheck: true,
    }) ?? mpLoss; // 如果有beforeDealDamage钩子，使用其返回值，否则使用原始伤害
  }

  ObjectKeys<AllBattleStateId>(source.state ?? {}).forEach(stateId => {
    let stateInfo = allBattleState[stateId] as BattleState;
    if (!stateInfo) {
      return
    }
    let state = source.state?.[stateId];

    if (!state) {
      return
    }

    mpLoss = stateInfo.onBeforeLossMp?.({
      self: source,
      state,
      damageSource: source,
      target: target,
      oriLoss: oriMpLoss,
      mpLoss: mpLoss,
      reason,
      preCheck: true,
    }) ?? mpLoss; // 如果有onBeforeDealDamage钩子，使用其返回值，否则使用原始伤害
  })

  if (mpLoss > target.mp) {
    return false;
  }

  return true;
}

export async function lossMp(source: BaseBattleUnit, target: BaseBattleUnit, mpLoss: number, opt: {
  reason: MpLossReason,
  callbacks: BattleCallback,
  battleInfo: BattleInfo,
  callback?: SimpleBattleTargetActionCallback,
  perCheck?: boolean
}): Promise<boolean> {
  const {reason, callback, battleInfo, callbacks, perCheck} = opt
  if (target.mp <= 0) return false; // 如果目标没有魔法值

  let oriMpLoss = mpLoss;

  for (const slot of ObjectKeys<CharacterEquipmentPart>(source.equipment ?? {})) {
    let equipmentId = source.equipment?.[slot];
    if (!equipmentId) continue;
    let rawEquipmentId = getEquipmentActuralId(equipmentId);
    let equipmentTrigger = allEquipmentTriggerData[rawEquipmentId]

    if (!equipmentTrigger) continue;

    mpLoss = equipmentTrigger.beforeLossMp?.({
      self: source,
      equipmentId,
      source,
      target,
      oriLoss: oriMpLoss,
      mpLoss,
      reason, 
      preCheck: false,
    }) ?? mpLoss; // 如果有beforeDealDamage钩子，使用其返回值，否则使用原始伤害
  }

  ObjectKeys<AllBattleStateId>(source.state ?? {}).forEach(stateId => {
    let stateInfo = allBattleState[stateId] as BattleState;
    if (!stateInfo) {
      return
    }
    let state = source.state?.[stateId];

    if (!state) {
      return
    }

    mpLoss = stateInfo.onBeforeLossMp?.({
      self: source,
      state,
      damageSource: source,
      target: target,
      oriLoss: oriMpLoss,
      mpLoss: mpLoss,
      reason,
      preCheck: false,
    }) ?? mpLoss; // 如果有onBeforeDealDamage钩子，使用其返回值，否则使用原始伤害
  })

  if (mpLoss > target.mp) {
    return false;
  }

  mpLoss = Math.min(mpLoss, target.mp); // 确保不会超过目标的当前魔法值

  mpLoss = Math.trunc(mpLoss)

  target.mp -= mpLoss;
  if (target.mp < 0) target.mp = 0; // 确保不会低于0

  callback?.({
    source, target, value: mpLoss
  })

  modifyUnitStatistic(target, "lossMp", {
    [source.uuid]: mpLoss
  });

  for (const member of battleInfo.members) {
    if (member.hp > 0 && member.uuid != target.uuid) {
      const equipTasks: Promise<any>[] = [];
      iteratorUnitEquipment(
        member,
        ({ equipmentTrigger, equipmentId }) => {
          if (!equipmentTrigger?.afterOtherUnitLossMp) return;
          const param: EquipmentAfterOtherUnitLossMpTriggerParam = {
            equipmentId,
            self: member,
            target,
            value: mpLoss,
            battleInfo,
            callbacks,
            ...callbacks,
          };
          equipTasks.push(Promise.resolve(equipmentTrigger.afterOtherUnitLossMp(param)));
        },
        { requiredHook: 'afterOtherUnitLossMp' }
      );
      await Promise.all(equipTasks);

      const stateTasks: Promise<any>[] = [];
      iteratorUnitState(
        member,
        ({ stateInfo, stateInBattle }) => {
          if (typeof stateInfo.afterOtherUnitLossMp !== 'function') return;
          stateTasks.push(
            Promise.resolve(
              stateInfo.afterOtherUnitLossMp({
                self: member,
                thisState: stateInBattle,
                target,
                value: mpLoss,
                battleInfo,
                callbacks,
                ...callbacks,
              })
            )
          );
        },
        { requiredHook: 'afterOtherUnitLossMp' }
      );
      await Promise.all(stateTasks);
    }
  }

  return true;
}

type RestoreMpOption = {
  reason: MpRestoreReason
  callback?: SimpleBattleMpRestoreCallback
}
export function restoreMp(source: BaseBattleUnit, target: BaseBattleUnit, value: number,
  option: RestoreMpOption
): void {
  if (target.maxHp <= 0) return; // 如果目标没有魔法值

  value = Math.min(value, target.maxMp - target.mp);

  value = Math.trunc(value);

  if (value <= 0) return; // 如果恢复值小于等于0，直接返回

  target.mp += value;
  if (target.mp > target.maxMp) target.mp = target.maxMp;

  option.callback?.({
    source, target, value, reason: option.reason
  })

  modifyUnitStatistic(target, "restoreMp", {
    [source.uuid]: value
  });
}

export type SummonUnitOption = {
  permanent?: boolean
  groupId?: string
  uuid?: string

  ignoreTurn?: boolean
}
export function summonUnit(
  battleInfo: BattleInfo,
  trigger: BaseBattleUnit,
  summonUnit: BaseBattleUnit,
  duration: number,
  option?: SummonUnitOption
  // 永久的
): BaseBattleUnit {
  const uuid = option?.uuid ??  `${trigger.uuid}_summon_${Date.now()}_${Math.floor(
    Math.random() * 10000
  )}`;

  summonUnit.uuid = uuid;
  // random suffix

  if (!summonUnit.state) {
    summonUnit.state = {};
  }

  summonUnit.isSummoned = true
  summonUnit.summonedBy = trigger.uuid
  if (!option?.permanent) {
    summonUnit.state.tmpUnit = {
      id: "tmpUnit",
      addBy: trigger.uuid,
      duration,
      remainingDuration: duration,
      triggered: false,
    };
  } else {
    summonUnit.isPermanentSummoned = true
  }

  summonUnit.isPlayer = false;
  summonUnit.canGetDropReward = false;
  summonUnit.canGetExpReward = false;

  summonUnit.isPlayerUnit = false;
  summonUnit.isEnvironmentUnit = true;

  // console.log("Summon Unit:", summonUnit.name, "by", trigger.name, '|battleUuid:', battleInfo.uuid);

  if (!summonUnit.status.otherStatus) {
    summonUnit.status.otherStatus = {}
  }

  // @ts-expect-error
  if (summonUnit.drops) {
    // @ts-expect-error
    delete summonUnit.drops
  }


  if (!option?.permanent) {
    // 如果召唤者装备了分裂核心，添加状态
    if (hasEquipment(trigger, "slimeDivideCore")) {
      // todo 去掉分裂核心的逻辑
      // addState("slimeDivideCoreState", 1, trigger, summonUnit, {}, {
      //   battleInfo,
      //   callbacks: globalCallbackGenerator(battleInfo)
      // })
    }
  }

  // 5. 加入到战斗成员和分组
  battleInfo.members.push(summonUnit);

  
  if (!option?.ignoreTurn) {
    battleInfo.turnOrder.push(summonUnit.uuid);
  } else {
    summonUnit.ignoreTurn = true;
  }

  // 判断自己属于哪个组
  const group = option?.groupId 
    ? option.groupId // 如果提供了分组信息，则直接设置
    : getUnitGroupId(battleInfo.groups, trigger.uuid)

  if (group) {
    battleInfo.groups[group].push(summonUnit.uuid);
  }

  return summonUnit
}


export function isAlly(unitAUuid: string, unitBUuid: string, battleInfo: BattleInfo): boolean {
  let unitAGroup = "";
  let unitBGroup = "";

  let unitA = battleInfo.members.find(u => u.uuid === unitAUuid);

  if (unitA && hasState(unitA, 'fluster')) {
    return true
  }

  Object.keys(battleInfo.groups).forEach(groupId => {
    if (!unitAGroup && battleInfo.groups[groupId].includes(unitAUuid)) {
      unitAGroup = groupId;
    }
    if (!unitBGroup && battleInfo.groups[groupId].includes(unitBUuid)) {
      unitBGroup = groupId;
    }
  });

  if (unitA && hasState(unitA, 'confusion')) {
    return unitAGroup != unitBGroup
  }

  return !!unitAGroup && unitAGroup === unitBGroup;
}
export function isEnemy(unitAUuid: string, unitBUuid: string, battleInfo: BattleInfo): boolean {
  let unitA = battleInfo.members.find(u => u.uuid === unitAUuid);
  if (unitA && hasState(unitA, 'fluster')) {
    return true
  }

  return !isAlly(unitAUuid, unitBUuid, battleInfo);
}

export async function castSkill(source: BaseBattleUnit, skillId: AllBattleSkillId,
  opt: {
    battleInfo: BattleInfo,
    allies: BaseBattleUnit[],
    enemies: BaseBattleUnit[],
    allAllies: BaseBattleUnit[],
    allEnemies: BaseBattleUnit[],
    callbacks: BattleCallback,
    statusModifyCallback?: (obj: {
        [key: string]: CharacterStatusImprove[]
    }) => void
  },
  extraOption?: CastSkillExtraParam
) {
  if (skillId == 'fishmanSkill') {
    skillId = 'baseAttack' as keyof typeof allGameBattleSkills
  }

  if (!extraOption?.ignoreColddown && !extraOption?.ignoreCastColddown) {
    if (source.skillColddown?.[skillId] && (source.skillColddown?.[skillId] ?? 0) > 0) {
      return
    }
  }

  if (!source.skills?.[skillId]) {
    return
  }

  // 沉默状态无法释放技能
  if (hasStateCauseForbidCastSkill(source) && skillId != 'baseAttack') {
    return
  }

  let hasControlled = false;
  for(const stateId in source.state) {
    if (allBattleState[stateId as AllBattleStateId]?.consumeTurn) {
      hasControlled = true;
      break;
    }
  }

  // 无法行动
  if (!extraOption?.ignoreControl) {
    if (hasControlled) {
      return
    }
  }

  const { callbacks, battleInfo, allies, enemies, allAllies, allEnemies, statusModifyCallback } = opt;

  let skill = allGameBattleSkills[skillId] as GameBattleSkill
  let skillEffect = skill.effect;

  // 被动技能不能释放
  if (skill.passive) {
    return;
  }

  let hideSkillCastText = extraOption?.hideSkillCastText ?? false;

  // 检查是否存在override
  for (const part of allCharacterEquipmentPart) {
    const rawEquipmentId = source.equipment?.[part];
    if (!rawEquipmentId) continue;

    // 移除 +x的后缀
    let equipmentId = rawEquipmentId.split("+")[0];

    let equipment = allEquipmentTriggerData[equipmentId];

    if (equipment && equipment.skillOverride?.[skillId]) {
      const override = equipment.skillOverride[skillId];
      if (override?.effect) {
        let conditionCheckRes = override.condition
          ? override.condition({
              equipmentId,
              self: source,
            })
          : true;

        if (conditionCheckRes) {
          skillEffect = override.effect;
          hideSkillCastText = !!override.hideSkillCastText;
        }
      }
    }
  }

  // 释放技能前的检查，检查是否有其他动作干扰此技能的释放
  let cancelCast = false;
  let cancelReason = "";
  for(const member of battleInfo.members) {
    if (member.hp > 0 && member.uuid != source.uuid) {
      await iteratorUnitEquipmentAsync(member, async ({equipmentTrigger, equipmentId}) => {
        const param: EquipmentBeforeOtherUnitCastSkillTriggerParam = {
          equipmentId: equipmentId,
          self: member,

          source,

          skillId: skillId,
          battleInfo,
          callbacks: callbacks,
          ...callbacks,
        }

        const hookResult =  await equipmentTrigger?.beforeOtherUnitCastSkill?.(param)
        
        if (hookResult?.cancelCast) {
          cancelCast = true
          cancelReason = hookResult?.cancelReason || ""

          return true
        }
      }, { requiredHook: 'beforeOtherUnitCastSkill' })
    }
  }

  if (cancelCast) {
    if (!hasStateCauseForbidCancelSkillCast(source)) {
      callbacks?.floatTextCallback?.({
        unit: source,
        text: skill.name + "-技能被打断",
      })
      if (cancelReason) {
        callbacks?.floatTextCallback?.({
          unit: source,
          text: `技能被打断: ${cancelReason}`,
          hidePopover: true,
        })
      }
      return
    }
  }


  if (!hideSkillCastText) {
    callbacks.castSkillCallback({
      source,
      skillId,
    });
  }

  let actionResult = await skillEffect({
    self: source,
    allies,
    enemies,
    allAllies,
    allEnemies,
    battleInfo,
    thisSkill: source.skills?.[skillId],
    skillExtraParam: extraOption,

    callbacks,
    healCallback: callbacks.healCallback,
    dealDamageCallback: callbacks.dealDamageCallback,
    lossMpCallback: callbacks.lossMpCallback,
    restoreMpCallback: callbacks.restoreMpCallback,
    floatTextCallback: callbacks.floatTextCallback,
    addStateCallback: callbacks.addStateCallback,
    statusModifyCallback,
  });

  if (!extraOption?.ignoreColddown) {
    if (skill.colddown > 0) {
      if (!source.skillColddown) {
        source.skillColddown = {};
      }
      // 因为本回合结束就会-1，所以这里要+1
      source.skillColddown[skillId] = skill.colddown + 1;
    }
  }

  modifyUnitStatistic(source, "castSkill", {
    [skillId]: 1
  })

  if (skillId == 'baseAttack') {
    if (!extraOption?.ignoreAfterSimpleAttackTrigger) {
      await iteratorUnitEquipmentAsync(source, (async ({rawEquipmentId, equipmentId, equipmentTrigger}) => {
        const param: EquipmentTriggerParam = {
          equipmentId: equipmentId,
          self: source,
          currentTurnUnit: source,
          allies,
          allAllies,
          enemies,
          thisRoundInfo: actionResult,
          allEnemies,
          battleInfo,
          callbacks,
          ...callbacks,
        }

        return equipmentTrigger?.onAfterSimpleAttack?.(param)
      }), { requiredHook: 'onAfterSimpleAttack' });

      await iteratorUnitStateAsync(source, (async ({stateInfo, stateInBattle}) => {
        await stateInfo?.afterSimpleAttack?.({
          thisState: stateInBattle,
          self: source,
          callbacks,
          battleInfo,
          thisRoundInfo: actionResult,
          dealDamageCallback: callbacks.dealDamageCallback
        });
      }), { requiredHook: 'afterSimpleAttack' })
    }
  } else { // 触发释放技能
    if (!extraOption?.ignoreAfterCastSkillTrigger) {
      {
        const sourceTasks: Promise<any>[] = [];
        // Source equipment afterCastSkill
        iteratorUnitEquipment(
          source,
          ({ equipmentTrigger, equipmentId }) => {
            if (!equipmentTrigger?.afterCastSkill) return;
            const param: EquipmentCastSkillTriggerParam = {
              equipmentId,
              self: source,
              skillId,
              battleInfo,
              thisRoundInfo: actionResult,
              callbacks,
              ...callbacks,
            };
            sourceTasks.push(Promise.resolve(equipmentTrigger.afterCastSkill(param)));
          },
          { requiredHook: 'afterCastSkill' }
        );
        await Promise.all(sourceTasks);
      }

      {
        const stateTasks: Promise<any>[] = [];
        // Source states afterCastSkill
        iteratorUnitState(
          source,
          ({ stateInfo, stateInBattle }) => {
            if (typeof stateInfo.afterCastSkill !== 'function') return;
            stateTasks.push(
              Promise.resolve(
                stateInfo.afterCastSkill({
                  thisState: stateInBattle,
                  self: source,
                  battleInfo,
                  callbacks,
                  thisRoundInfo: actionResult,
                  skillId,
                })
              )
            );
          },
          { requiredHook: 'afterCastSkill' }
        );
        await Promise.all(stateTasks);
      }

      {
        const memberTasks: Promise<any>[] = [];
        for (const member of battleInfo.members) {
          if (member.hp > 0 && member.uuid !== source.uuid) {
            memberTasks.push((async () => {
              const equipTasks: Promise<any>[] = [];
              iteratorUnitEquipment(
                member,
                ({ equipmentTrigger, equipmentId }) => {
                  if (!equipmentTrigger?.afterOtherUnitCastSkill) return;
                  const param: EquipmentAfterOtherUnitCastSkillTriggerParam = {
                    equipmentId,
                    self: member,
                    source,
                    skillId,
                    battleInfo,
                    thisRoundInfo: actionResult,
                    callbacks,
                    ...callbacks,
                  };
                  equipTasks.push(Promise.resolve(equipmentTrigger.afterOtherUnitCastSkill(param)));
                },
                { requiredHook: 'afterOtherUnitCastSkill' }
              );
              await Promise.all(equipTasks);

              const memStateTasks: Promise<any>[] = [];
              iteratorUnitState(
                member,
                ({ stateInfo, stateInBattle }) => {
                  if (typeof stateInfo.afterOtherUnitCastSkill !== 'function') return;
                  memStateTasks.push(
                    Promise.resolve(
                      stateInfo.afterOtherUnitCastSkill({
                        thisState: stateInBattle,
                        self: member,
                        source,
                        skillId,
                        battleInfo,
                        callbacks,
                      })
                    )
                  );
                },
                { requiredHook: 'afterOtherUnitCastSkill' }
              );
              await Promise.all(memStateTasks);
            })());
          }
        }
        await Promise.all(memberTasks);
      }
    }
  }

  if (!!actionResult && !actionResult.castSkillId && skillId != 'baseAttack') {
    actionResult.castSkillId = skillId;
  }

  return actionResult
}

export function setEachSelfTurnTriggerMark<T>(unit: BaseBattleUnit, key: string, value: T){
  if (!unit.triggerMark) {
    unit.triggerMark = {};
  }
  if (!unit.triggerMark?.eachSelfTurn) {
    unit.triggerMark.eachSelfTurn = {};
  }

  unit.triggerMark.eachSelfTurn[key] = value;
}
export function getEachSelfTurnTriggerMark<T>(unit: BaseBattleUnit, key: string, def: T): T | undefined {
  if (!unit.triggerMark?.eachSelfTurn) {
    return def;
  }

  return unit.triggerMark.eachSelfTurn[key] as T;
}


export function setOncePerBattleTriggerMark(unit: BaseBattleUnit, key: string, value: boolean){
  if (!unit.triggerMark) {
    unit.triggerMark = {};
  }
  if (!unit.triggerMark?.oncePreBattle) {
    unit.triggerMark.oncePreBattle = {};
  }

  unit.triggerMark.oncePreBattle[key] = value;
}
export function getOncePerBattleTriggerMark(unit: BaseBattleUnit, key: string): boolean {
  if (!unit.triggerMark?.oncePreBattle) {
    return false;
  }

  return unit.triggerMark.oncePreBattle[key];
}

export function increaseTimesPerBattleTriggerMark(unit: BaseBattleUnit, key: string, val: number): number {
  if (!unit.triggerMark) {
    unit.triggerMark = {};
  }

  if (!unit.triggerMark?.timesPerBattle) {
    unit.triggerMark.timesPerBattle = {};
  }

  if (!unit.triggerMark.timesPerBattle[key]) {
    unit.triggerMark.timesPerBattle[key] = 0
  }
  unit.triggerMark.timesPerBattle[key] += val

  return unit.triggerMark.timesPerBattle[key];
}

export function decreaseTimesPerBattleTriggerMark(unit: BaseBattleUnit, key: string, val: number): number {
  if (!unit.triggerMark) {
    unit.triggerMark = {};
  }

  if (!unit.triggerMark?.timesPerBattle) {
    unit.triggerMark.timesPerBattle = {};
  }

  if (!unit.triggerMark.timesPerBattle[key]) {
    unit.triggerMark.timesPerBattle[key] = 0
  }
  unit.triggerMark.timesPerBattle[key] -= val

  if (unit.triggerMark.timesPerBattle[key] <= 0) {
    unit.triggerMark.timesPerBattle[key] = 0
  }

  return unit.triggerMark.timesPerBattle[key];
}

export function getTimesPerBattleTriggerMark(unit: BaseBattleUnit, key: string): number {
  if (!unit.triggerMark?.timesPerBattle) {
    return 0;
  }

  return unit.triggerMark.timesPerBattle[key] ?? 0;
}

// Timing/log helper used by iterator functions.
// Instead of printing on every call, we aggregate statistics in-memory and
// emit a concise summary every AGGREGATE_INTERVAL_MS.
const __TIMING_DEFAULT_THRESHOLD = 10; // kept for possible immediate logging
const __TIMING_DEFAULT_SAMPLE_RATE = 0.01; // not used for aggregation but kept for compatibility
const PERF_TIMING_ENABLED = false;// process.env.BATTLE_PERF_TIMING === '1';

type PerDetailStat = { count: number; totalMs: number; maxMs: number };
type EventStat = {
  totalCount: number;
  totalMs: number;
  maxMs: number;
  perDetails: Map<string, PerDetailStat>;
};

const AGGREGATE_INTERVAL_MS = 10_000; // 10s
// Filtering thresholds: skip printing events whose average < MIN_AVG_MS OR max < MIN_MAX_MS
const AGGREGATE_MIN_AVG_MS = 1; // ms
const AGGREGATE_MIN_MAX_MS = 5; // ms
const __timingAggregator: Map<string, EventStat> = new Map();

function __recordTiming(
  key: string,
  duration: number,
  perDetails?: Record<string, number>
) {
  if (!PERF_TIMING_ENABLED) return;
  let s = __timingAggregator.get(key);
  if (!s) {
    s = { totalCount: 0, totalMs: 0, maxMs: 0, perDetails: new Map() };
    __timingAggregator.set(key, s);
  }
  s.totalCount += 1;
  s.totalMs += duration;
  if (duration > s.maxMs) s.maxMs = duration;

  if (perDetails) {
    for (const [id, ms] of Object.entries(perDetails)) {
      let pd = s.perDetails.get(id);
      if (!pd) {
        pd = { count: 0, totalMs: 0, maxMs: 0 };
        s.perDetails.set(id, pd);
      }
      pd.count += 1;
      pd.totalMs += ms;
      if (ms > pd.maxMs) pd.maxMs = ms;
    }
  }
}

function __flushTimingAggregate() {
  if (!PERF_TIMING_ENABLED) return;
  if (__timingAggregator.size === 0) return;
  const ts = new Date().toISOString();
  const lines: string[] = [];
  let printedCount = 0;
  for (const [key, stat] of __timingAggregator.entries()) {
    const avg = stat.totalCount ? (stat.totalMs / stat.totalCount) : 0;
    // Skip event if average below MIN_AVG or max below MIN_MAX
    if (avg < AGGREGATE_MIN_AVG_MS || stat.maxMs < AGGREGATE_MIN_MAX_MS) {
      continue;
    }

    printedCount++;
    lines.push(`- ${key}: count=${stat.totalCount}, avg=${avg.toFixed(2)}ms, max=${stat.maxMs}ms`);
    if (stat.perDetails.size) {
      for (const [id, pd] of stat.perDetails.entries()) {
        const pdAvg = pd.count ? (pd.totalMs / pd.count) : 0;
        // Skip per-detail if both average and max are small
        if (pdAvg < AGGREGATE_MIN_AVG_MS && pd.maxMs < AGGREGATE_MIN_MAX_MS) continue;
        lines.push(`    • ${id}: count=${pd.count}, avg=${pdAvg.toFixed(2)}ms, max=${pd.maxMs}ms`);
      }
    }
  }

  if (printedCount === 0) {
    // Nothing worth printing this round
    __timingAggregator.clear();
    return;
  }

  lines.unshift(`[TimingAggregate] ${ts} - printed=${printedCount}`);
  // console.log(lines.join('\n'));
  __timingAggregator.clear();
}

// Schedule periodic flush
if (typeof setInterval === 'function') {
  setInterval(__flushTimingAggregate, AGGREGATE_INTERVAL_MS).unref?.();
}

function __logIteratorTiming(
  tKeyStart: string,
  tKeyEnd: string,
  duration: number,
  opts?: { perDetails?: Record<string, number>; unitUuid?: string; hookKey?: string }
) {
  if (!PERF_TIMING_ENABLED) return;
  const key = tKeyStart; // keep existing key form for compatibility

  // Record into aggregator for periodic reporting
  __recordTiming(key, duration, opts?.perDetails);

  // For extremely slow events, still print immediately to avoid missing critical issues
  // Apply light sampling to reduce noise for medium-slow paths while keeping very slow ones always logged
  // const sampleRate = 0.05; // 5% sampling for non-critical events
  const shouldLog = duration >= 500; // || Math.random() < sampleRate;
  if (shouldLog) {
    const items = opts?.perDetails
      ? Object.entries(opts.perDetails)
          .sort((a, b) => b[1] - a[1])
          .map(([id, ms]) => `${id}:${ms}ms`)
          .join(', ')
      : '';
    console.log(`[Timing:IMMEDIATE] ${tKeyStart} -> ${tKeyEnd}: total ${duration}ms; unit:${opts?.unitUuid ?? 'unknown'}, hook:${opts?.hookKey ?? 'all'}; per-equip: ${items}`);
  }
}


// ---------------- Hook presence cache (equipment/state/affix/skillNode) ----------------
// 目标：在 iterator* 前快速判定某单位是否可能拥有指定钩子，避免热路径无谓遍历。
// 签名由状态键集合 + 装备资源ID集合 + 词条ID集合 + 技能节点ID集合组成，变化即失效。

type HookPresenceMap = Record<string, boolean>;
type UnitHookCacheEntry = {
  signature: string;
  equipmentHooks: HookPresenceMap;
  stateHooks: HookPresenceMap;
  affixHooks: HookPresenceMap;
  skillNodeHooks: HookPresenceMap;
};

// 使用 uuid 作为缓存 key，避免同 uuid 不同对象实例导致的重复构建
const unitHookCache = new Map<string, UnitHookCacheEntry>();
const unitHookCacheDirty = new Set<string>();
// 调试开关：仅在需要时统计并打印构建次数，避免常态开销
const HOOK_CACHE_DEBUG = process.env.HOOK_CACHE_DEBUG === '1';
const unitHookBuildCount = HOOK_CACHE_DEBUG ? new Map<string, number>() : null;
const unitHookCacheTouchedAt = new Map<string, number>();
const HOOK_CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10min 空闲清理
const HOOK_CACHE_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5min 扫描

const getUnitUuid = (unit: BaseBattleUnit): string => unit?.uuid ?? '__missing_uuid__';

const buildUnitHookSignature = (unit: BaseBattleUnit): string => {
  const stateKeyPart = unit.state ? ObjectKeys(unit.state).sort().join(',') : '';
  const equipmentKeyPart = unit.equipment
    ? ObjectKeysTyped(unit.equipment)
        .map((part) => unit.equipment?.[part] ?? '')
        .filter(Boolean)
        .sort()
        .join(',')
    : '';
  const affixKeyPart = unit.affix?.length ? unit.affix.map((a) => a.affixId).sort().join(',') : '';
  const skillNodeKeyPart = unit.skillTreeNodes?.length ? unit.skillTreeNodes.map((n) => n.nodeId).sort().join(',') : '';
  return `${stateKeyPart}|${equipmentKeyPart}|${affixKeyPart}|${skillNodeKeyPart}`;
};

const collectUnitHookEntry = (unit: BaseBattleUnit, signature: string): UnitHookCacheEntry => {
  const uuid = getUnitUuid(unit);
  const count = unitHookBuildCount ? (unitHookBuildCount.get(uuid) ?? 0) + 1 : 0;
  if (unitHookBuildCount) {
    unitHookBuildCount.set(uuid, count);
  }

  const equipmentHooks: HookPresenceMap = {};
  const stateHooks: HookPresenceMap = {};
  const affixHooks: HookPresenceMap = {};
  const skillNodeHooks: HookPresenceMap = {};

  for (const part of ObjectKeysTyped(unit.equipment ?? {})) {
    const equipmentId = unit.equipment?.[part];
    if (!equipmentId) continue;
    const rawEquipmentId = getEquipmentActuralId(equipmentId);
    const trigger = allEquipmentTriggerData[rawEquipmentId];
    if (!trigger) continue;

    for (const key of ObjectKeysTyped(trigger)) {
      if (typeof trigger[key] === 'function') {
        equipmentHooks[key as string] = true;
      }
    }
  }

  if (unit.state) {
    for (const stateId of ObjectKeysTyped(unit.state)) {
      const stMeta = allBattleState[stateId];
      if (!stMeta) continue;
      for (const key of ObjectKeysTyped(stMeta)) {
        if (typeof stMeta[key] === 'function') {
          stateHooks[key as string] = true;
        }
      }
    }
  }

  if (unit.affix) {
    for (const affix of unit.affix) {
      const conf = affixDefinitionsById[affix.affixId];
      const eff = conf?.effect;
      if (!eff) continue;
      for (const key of ObjectKeysTyped(eff)) {
        if (typeof eff[key] === 'function') {
          affixHooks[key as string] = true;
        }
      }
    }
  }

  if (unit.skillTreeNodes) {
    for (const nodeInfo of unit.skillTreeNodes) {
      const node = allBattleSkillTreeNodesMap[nodeInfo.nodeId];
      const effects = node?.businessBattleEffects;
      if (!effects) continue;
      for (const key of ObjectKeysTyped(effects)) {
        if (typeof effects[key] === 'function') {
          skillNodeHooks[key as string] = true;
        }
      }
    }
  }

  if (HOOK_CACHE_DEBUG && (count <= 5 || count % 10 === 0)) {
    // console.log(`[HookCache][build] unit=${uuid} count=${count} signature=${signature}`);
  }

  return { signature, equipmentHooks, stateHooks, affixHooks, skillNodeHooks };
};

const getUnitHookEntry = (unit: BaseBattleUnit): UnitHookCacheEntry => {
  const uuid = getUnitUuid(unit);
  // Always compute current signature to detect silent state/equipment/affix/skillNode changes
  const signature = buildUnitHookSignature(unit);

  const cached = unitHookCache.get(uuid);
  if (cached && !unitHookCacheDirty.has(uuid) && cached.signature === signature) {
    unitHookCacheTouchedAt.set(uuid, Date.now());
    return cached;
  }

  const computed = collectUnitHookEntry(unit, signature);
  unitHookCacheDirty.delete(uuid);
  unitHookCache.set(uuid, computed);
  unitHookCacheTouchedAt.set(uuid, Date.now());
  return computed;
};

export function unitHasHook(
  unit: BaseBattleUnit,
  hookKey: keyof EquipmentTriggerInfo | keyof BattleState | keyof AffixKeyHooks | keyof NonNullable<SkillTreeNode['businessBattleEffects']>,
  opt?: { scope?: 'equipment' | 'state' | 'affix' | 'skillNode' | 'both' | 'all' }
): boolean {
  return true;
  const scope = opt?.scope ?? 'both';
  const entry = getUnitHookEntry(unit);
  if (scope === 'equipment') {
    return !!entry.equipmentHooks[hookKey as string];
  }
  if (scope === 'state') {
    return !!entry.stateHooks[hookKey as string];
  }
  if (scope === 'affix') {
    return !!entry.affixHooks[hookKey as string];
  }
  if (scope === 'skillNode') {
    return !!entry.skillNodeHooks[hookKey as string];
  }
  if (scope === 'all') {
    return (
      !!entry.equipmentHooks[hookKey as string] ||
      !!entry.stateHooks[hookKey as string] ||
      !!entry.affixHooks[hookKey as string] ||
      !!entry.skillNodeHooks[hookKey as string]
    );
  }
  // default 'both' (equipment + state)
  return !!entry.equipmentHooks[hookKey as string] || !!entry.stateHooks[hookKey as string];
}

// 显式标记单位的钩子缓存失效（装备/状态/词条/技能节点变更时调用）
export const invalidateUnitHookCache = (unit: BaseBattleUnit): void => {
  return;
  const uuid = getUnitUuid(unit);
  unitHookCacheDirty.add(uuid);
  unitHookCache.delete(uuid);
  unitHookCacheTouchedAt.delete(uuid);
};

// 批量失效，便于在多单位场景下调用
export const invalidateUnitsHookCache = (units: BaseBattleUnit[] | Iterable<BaseBattleUnit>): void => {
  for (const u of units) {
    const uuid = getUnitUuid(u);
    unitHookCacheDirty.add(uuid);
    unitHookCache.delete(uuid);
    unitHookCacheTouchedAt.delete(uuid);
  }
};

// 周期清理长时间未访问的缓存，避免 uuid Map 持续增长
if (typeof setInterval === 'function') {
  setInterval(() => {
    const now = Date.now();
    for (const [uuid, ts] of unitHookCacheTouchedAt.entries()) {
      if (now - ts > HOOK_CACHE_MAX_AGE_MS) {
        unitHookCache.delete(uuid);
        unitHookCacheDirty.delete(uuid);
        unitHookCacheTouchedAt.delete(uuid);
        if (unitHookBuildCount) {
          unitHookBuildCount.delete(uuid);
        }
      }
    }
  }, HOOK_CACHE_SWEEP_INTERVAL_MS).unref?.();
}


type IteratorUnitEquipmentBreakCallback = (opt: {
    equipmentInfo: GameResource;
    equipmentId: string;
    rawEquipmentId: string;
    equipmentLevel: number;
    equipmentTrigger?: EquipmentTriggerInfo
  }) => boolean | undefined | void
export function iteratorUnitEquipment(
  unit: BaseBattleUnit,
  breakCallback: IteratorUnitEquipmentBreakCallback,
  opt?: { requiredHook?: keyof EquipmentTriggerInfo }
): void {
  const hookKey = opt?.requiredHook ? String(opt.requiredHook) : 'all';
  const shouldProfile = PERF_TIMING_ENABLED && opt?.requiredHook !== 'onAfterSimpleAttack';
  const tKeyStart = shouldProfile ? `iteratorUnitEquipment:${hookKey}:start` : '';
  const tKeyEnd = shouldProfile ? `iteratorUnitEquipment:${hookKey}:end` : '';
  const tStart = shouldProfile ? Date.now() : 0;
  const perEquipDurations: Record<string, number> | undefined = shouldProfile ? {} : undefined;
  if (!unit?.equipment || !Object.keys(unit.equipment).length) {
    return;
  }

   // 快速跳过无对应钩子的单位
  if (opt?.requiredHook && !unitHasHook(unit, opt.requiredHook, { scope: 'equipment' })) {
    return;
  }

  if (
    // opt?.requiredHook == 'afterTakeHeal' ||
    opt?.requiredHook == 'afterHealUnit' 
    // || opt?.requiredHook == 'afterTakeDamage'
  ) {
    return;
  }

  for (const part in unit.equipment ?? {}) {
    let equipmentId = unit.equipment?.[part as CharacterEquipmentPart];
    if (!equipmentId) {
      continue;
    }

    let equipmentInfo = allGameResource[equipmentId];
    if (!equipmentInfo) {
      continue;
    }

    const rawEquipmentId = getEquipmentActuralId(equipmentId);

    const equipmentTrigger = allEquipmentTriggerData[rawEquipmentId];

    // 前置过滤：如果指定了 requiredHook，但该装备未实现该钩子，则跳过
    if (opt?.requiredHook && (!equipmentTrigger || typeof equipmentTrigger[opt.requiredHook] !== 'function')) {
      continue;
    }

    const perStart = shouldProfile ? Date.now() : 0;
    const equipmentLevel = getEquipmentLevel(equipmentId);

    let cRes = breakCallback({ equipmentInfo, equipmentId, rawEquipmentId, equipmentLevel, equipmentTrigger });
    if (shouldProfile && perEquipDurations) {
      const perEnd = Date.now();
      const perDuration = perEnd - perStart;
      perEquipDurations[equipmentId] = (perEquipDurations[equipmentId] || 0) + perDuration;
    }

    if (cRes && typeof cRes === "boolean") {
      break;
    }
  }
  if (shouldProfile && perEquipDurations) {
    const tEnd = Date.now();
    const duration = tEnd - tStart;
    __logIteratorTiming(tKeyStart, tKeyEnd, duration, { perDetails: perEquipDurations, unitUuid: unit.uuid, hookKey });
  }
}
type AsyncIteratorUnitEquipmentBreakCallback = (opt: {
    equipmentInfo: GameResource;
    equipmentId: string;
    rawEquipmentId: string;
    equipmentLevel: number;
    equipmentTrigger?: EquipmentTriggerInfo
  }) => Promise<boolean | undefined | void> | boolean | undefined | void
export async function iteratorUnitEquipmentAsync(
  unit: BaseBattleUnit,
  breakCallback: AsyncIteratorUnitEquipmentBreakCallback,
  opt?: { requiredHook?: keyof EquipmentTriggerInfo }
): Promise<void> {
  if (!unit?.equipment || !Object.keys(unit.equipment).length) {
    return;
  }

  if (opt?.requiredHook && !unitHasHook(unit, opt.requiredHook, { scope: 'equipment' })) {
    return;
  }

  if (
    // opt?.requiredHook == 'afterTakeHeal' ||
    opt?.requiredHook == 'afterHealUnit' 
    // || opt?.requiredHook == 'afterTakeDamage'
  ) {
    return;
  }

  const hookKey = opt?.requiredHook ? String(opt.requiredHook) : 'all';
  const shouldProfile = PERF_TIMING_ENABLED && opt?.requiredHook !== 'onAfterSimpleAttack';
  const tKeyStart = shouldProfile ? `iteratorUnitEquipmentAsync:${hookKey}:start` : '';
  const tKeyEnd = shouldProfile ? `iteratorUnitEquipmentAsync:${hookKey}:end` : '';
  const tStart = shouldProfile ? Date.now() : 0;
  const perEquipDurations: Record<string, number> | undefined = shouldProfile ? {} : undefined;

  for (const part in unit.equipment ?? {}) {
    let equipmentId = unit.equipment?.[part as CharacterEquipmentPart];
    if (!equipmentId) {
      continue;
    }

    let equipmentInfo = allGameResource[equipmentId];
    if (!equipmentInfo) {
      continue;
    }

    const rawEquipmentId = getEquipmentActuralId(equipmentId);

    const equipmentTrigger = allEquipmentTriggerData[rawEquipmentId];

    // 前置过滤：如果指定了 requiredHook，但该装备未实现该钩子，则跳过
    if (opt?.requiredHook && (!equipmentTrigger || typeof equipmentTrigger[opt.requiredHook] !== 'function')) {
      continue;
    }

    const equipmentLevel = getEquipmentLevel(equipmentId);

    const perStart = shouldProfile ? Date.now() : 0;
    const maybe = breakCallback({ equipmentInfo, equipmentId, equipmentLevel, rawEquipmentId, equipmentTrigger });
    const cRes = isPromise(maybe) ? await maybe : maybe;
    if (shouldProfile && perEquipDurations) {
      const perEnd = Date.now();
      perEquipDurations[equipmentId] = (perEquipDurations[equipmentId] || 0) + (perEnd - perStart);
    }

    if (cRes && typeof cRes === "boolean") {
      break;
    }
  }

  if (shouldProfile && perEquipDurations) {
    const tEnd = Date.now();
    const duration = tEnd - tStart;
    __logIteratorTiming(tKeyStart, tKeyEnd, duration, { perDetails: perEquipDurations, unitUuid: unit.uuid, hookKey });
  }
}

type IteratorUnitStateBreakCallback = (opt: {
  stateInfo: BattleState;
  stateInBattle: BattleStateInBattle;
  stateId: AllBattleStateId
}) => boolean | undefined | void;
export function iteratorUnitState(
  unit: BaseBattleUnit,
  breakCallback: IteratorUnitStateBreakCallback,
  opt?: { requiredHook?: keyof BattleState }
): void {
  if (!unit?.state || !Object.keys(unit.state).length) {
    return;
  }

  if (opt?.requiredHook && !unitHasHook(unit, opt.requiredHook, { scope: 'state' })) {
    return;
  }

  const hookKey = opt?.requiredHook ? String(opt.requiredHook) : 'all';
  const shouldProfile = PERF_TIMING_ENABLED;
  const tKeyStart = shouldProfile ? `iteratorUnitState:${hookKey}:start` : '';
  const tKeyEnd = shouldProfile ? `iteratorUnitState:${hookKey}:end` : '';
  const tStart = shouldProfile ? Date.now() : 0;
  const perStateDurations: Record<string, number> | undefined = shouldProfile ? {} : undefined;

  for (const tStateId in unit.state ?? {}) {
    const stateId = tStateId as AllBattleStateId;
    const perStart = shouldProfile ? Date.now() : 0;
    let stateInfo: BattleState = allBattleState[stateId];
    if (!stateInfo) {
      continue;
    }

    let stateInBattle = unit.state?.[stateId];
    if (!stateInBattle) {
      continue;
    }

    if (stateInBattle.remainingDuration <= 0) {
      continue;
    }

    // 前置过滤：如果指定了 requiredHook，但该状态未实现该钩子，则跳过
    if (opt?.requiredHook && typeof stateInfo[opt.requiredHook] !== 'function') {
      continue;
    }

    let cRes = breakCallback({stateInfo, stateInBattle, stateId});
    if (shouldProfile && perStateDurations) {
      const perEnd = Date.now();
      perStateDurations[stateId] = (perStateDurations[stateId] || 0) + (perEnd - perStart);
    }

    if (cRes && typeof cRes === "boolean") {
      break;
    }
  }

  if (shouldProfile && perStateDurations) {
    const tEnd = Date.now();
    const duration = tEnd - tStart;
    __logIteratorTiming(tKeyStart, tKeyEnd, duration, { perDetails: perStateDurations, unitUuid: unit.uuid, hookKey });
  }
}

type AsyncIteratorUnitStateBreakCallback = (opt: {
  stateInfo: BattleState;
  stateInBattle: BattleStateInBattle;
}) => Promise<boolean | undefined | void> | boolean | undefined | void;
export async function iteratorUnitStateAsync(
  unit: BaseBattleUnit,
  breakCallback: AsyncIteratorUnitStateBreakCallback,
  opt?: { requiredHook?: keyof BattleState }
): Promise<void> {
  if (!unit?.state || !Object.keys(unit.state).length) {
    return;
  }

  if (opt?.requiredHook && !unitHasHook(unit, opt.requiredHook, { scope: 'state' })) {
    return;
  }

  const hookKey = opt?.requiredHook ? String(opt.requiredHook) : 'all';
  const shouldProfile = PERF_TIMING_ENABLED;
  const tKeyStart = shouldProfile ? `iteratorUnitStateAsync:${hookKey}:start` : '';
  const tKeyEnd = shouldProfile ? `iteratorUnitStateAsync:${hookKey}:end` : '';
  const tStart = shouldProfile ? Date.now() : 0;
  const perStateDurations: Record<string, number> | undefined = shouldProfile ? {} : undefined;

  for (const tStateId in unit.state ?? {}) {
    const stateId = tStateId as AllBattleStateId;
    let stateInfo: BattleState = allBattleState[stateId];
    if (!stateInfo) {
      continue;
    }

    let stateInBattle = unit.state?.[stateId];
    if (!stateInBattle) {
      continue;
    }

    if (stateInBattle.remainingDuration <= 0) {
      continue;
    }

    // 前置过滤：如果指定了 requiredHook，但该状态未实现该钩子，则跳过
    if (opt?.requiredHook && typeof stateInfo[opt.requiredHook] !== 'function') {
      continue;
    }

    const perStart = shouldProfile ? Date.now() : 0;
    const maybe = breakCallback({stateInfo, stateInBattle});
    const cRes = isPromise(maybe) ? await maybe : maybe;
    if (shouldProfile && perStateDurations) {
      const perEnd = Date.now();
      perStateDurations[stateId] = (perStateDurations[stateId] || 0) + (perEnd - perStart);
    }

    if (cRes && typeof cRes === "boolean") {
      break;
    }
  }

  if (shouldProfile && perStateDurations) {
    const tEnd = Date.now();
    const duration = tEnd - tStart;
    __logIteratorTiming(tKeyStart, tKeyEnd, duration, { perDetails: perStateDurations, unitUuid: unit.uuid, hookKey });
  }
}

type IteratorUnitAffixBreakCallback = (opt: {
  affixInstance: AffixEffectResolved;
  affixConf: AffixDefinition;
}) => boolean | undefined | void;
export function iteratorUnitAffix(
  unit: BaseBattleUnit,
  breakCallback: IteratorUnitAffixBreakCallback,
  opt?: { requiredHook?: keyof AffixKeyHooks }
): void {
  if (!unit?.affix?.length) {
    return;
  }

  if (opt?.requiredHook && !unitHasHook(unit, opt.requiredHook, { scope: 'affix' })) {
    return;
  }

  const hookKey = opt?.requiredHook ? String(opt.requiredHook) : 'all';
  const shouldProfile = PERF_TIMING_ENABLED;
  const tKeyStart = shouldProfile ? `iteratorUnitAffix:${hookKey}:start` : '';
  const tKeyEnd = shouldProfile ? `iteratorUnitAffix:${hookKey}:end` : '';
  const tStart = shouldProfile ? Date.now() : 0;
  const perAffixDurations: Record<string, number> | undefined = shouldProfile ? {} : undefined;

  for (const affix of unit.affix) {
    const perStart = shouldProfile ? Date.now() : 0;
    const affixConf = affixDefinitionsById[affix.affixId];
    if (!affixConf) {
      continue;
    }

    let affixEffect = affix.effect;
    if (!affixEffect) {
      continue;
    }

    // 前置过滤：如果指定了 requiredHook，但该词条未实现该钩子，则跳过
    if (opt?.requiredHook && typeof affixConf.effect?.[opt.requiredHook] !== 'function') {
      continue;
    }

    let cRes = breakCallback({affixInstance: affix.effect, affixConf});
    if (shouldProfile && perAffixDurations) {
      const perEnd = Date.now();
      perAffixDurations[affix.affixId] = (perAffixDurations[affix.affixId] || 0) + (perEnd - perStart);
    }

    if (cRes && typeof cRes === "boolean") {
      break;
    }
  }

  if (shouldProfile && perAffixDurations) {
    const tEnd = Date.now();
    const duration = tEnd - tStart;
    __logIteratorTiming(tKeyStart, tKeyEnd, duration, { perDetails: perAffixDurations, unitUuid: unit.uuid, hookKey });
  }
}

// Skill Node iterator: iterates skill nodes on a unit with optional hook-based prefilter
type IteratorUnitSkillNodeBreakCallback = (node: SkillTreeNode, level: number) => boolean | undefined | void;
export function iteratorUnitSkillNode(
  unit: BaseBattleUnit,
  breakCallback: IteratorUnitSkillNodeBreakCallback,
  opt?: { requiredHook?: keyof NonNullable<SkillTreeNode['businessBattleEffects']> }
): void {
  if (!unit?.skillTreeNodes?.length) {
    return;
  }

  if (opt?.requiredHook && !unitHasHook(unit, opt.requiredHook, { scope: 'skillNode' })) {
    return;
  }

  const hookKey = opt?.requiredHook ? String(opt.requiredHook) : 'all';
  const shouldProfile = PERF_TIMING_ENABLED;
  const tKeyStart = shouldProfile ? `iteratorUnitSkillNode:${hookKey}:start` : '';
  const tKeyEnd = shouldProfile ? `iteratorUnitSkillNode:${hookKey}:end` : '';
  const tStart = shouldProfile ? Date.now() : 0;
  const perNodeDurations: Record<string, number> | undefined = shouldProfile ? {} : undefined;

  for (const nodeInfo of unit.skillTreeNodes ?? []) {
    const perStart = shouldProfile ? Date.now() : 0;
    const node = allBattleSkillTreeNodesMap[nodeInfo.nodeId];
    if (!node) {
      continue;
    }

    // 前置过滤：如果指定了 requiredHook，但该技能节点未实现该钩子，则跳过
    const effects = node.businessBattleEffects;
    if (opt?.requiredHook && (typeof effects?.[opt.requiredHook] !== 'function')) {
      continue;
    }

    const res = breakCallback(node, nodeInfo.level);
    if (shouldProfile && perNodeDurations) {
      const perEnd = Date.now();
      perNodeDurations[nodeInfo.nodeId] = (perNodeDurations[nodeInfo.nodeId] || 0) + (perEnd - perStart);
    }
    if (res && typeof res === 'boolean') {
      break;
    }
  }

  if (shouldProfile && perNodeDurations) {
    const tEnd = Date.now();
    const duration = tEnd - tStart;
    __logIteratorTiming(tKeyStart, tKeyEnd, duration, { perDetails: perNodeDurations, unitUuid: unit.uuid, hookKey });
  }
}

type AsyncIteratorUnitSkillNodeBreakCallback = (node: SkillTreeNode, level: number) => Promise<boolean | undefined | void> | boolean | undefined | void;
export async function iteratorUnitSkillNodeAsync(
  unit: BaseBattleUnit,
  breakCallback: AsyncIteratorUnitSkillNodeBreakCallback,
  opt?: { requiredHook?: keyof NonNullable<SkillTreeNode['businessBattleEffects']> }
): Promise<void> {
  if (!unit?.skillTreeNodes?.length) {
    return;
  }

  if (opt?.requiredHook && !unitHasHook(unit, opt.requiredHook, { scope: 'skillNode' })) {
    return;
  }

  const hookKey = opt?.requiredHook ? String(opt.requiredHook) : 'all';
  const shouldProfile = PERF_TIMING_ENABLED;
  const tKeyStart = shouldProfile ? `iteratorUnitSkillNodeAsync:${hookKey}:start` : '';
  const tKeyEnd = shouldProfile ? `iteratorUnitSkillNodeAsync:${hookKey}:end` : '';
  const tStart = shouldProfile ? Date.now() : 0;
  const perNodeDurations: Record<string, number> | undefined = shouldProfile ? {} : undefined;

  for (const nodeInfo of unit.skillTreeNodes ?? []) {
    const node = allBattleSkillTreeNodesMap[nodeInfo.nodeId];
    if (!node) {
      continue;
    }

    const effects = node.businessBattleEffects;
    if (opt?.requiredHook && (typeof effects?.[opt.requiredHook] !== 'function')) {
      continue;
    }

    const perStart = shouldProfile ? Date.now() : 0;
    const maybe = breakCallback(node, nodeInfo.level);
    const res = isPromise(maybe) ? await maybe : maybe;
    if (shouldProfile && perNodeDurations) {
      const perEnd = Date.now();
      perNodeDurations[nodeInfo.nodeId] = (perNodeDurations[nodeInfo.nodeId] || 0) + (perEnd - perStart);
    }

    if (res && typeof res === 'boolean') {
      break;
    }
  }

  if (shouldProfile && perNodeDurations) {
    const tEnd = Date.now();
    const duration = tEnd - tStart;
    __logIteratorTiming(tKeyStart, tKeyEnd, duration, { perDetails: perNodeDurations, unitUuid: unit.uuid, hookKey });
  }
}

export const addState = async (
  stateId: keyof typeof allBattleState,
  duration: number,
  source: BaseBattleUnit,
  target: BaseBattleUnit,
  extra: BattleStateInBattleExtraInfo = {},
  opt: {
    battleInfo: BattleInfo;
    callbacks?: BattleCallback | null
    addStateCallback?: SimpleBattleTargetAddStateActionCallback;
    dealDamageCallback?: SimpleBattleTargetDamageActionCallback;
    floatTextCallback?: SimpleFloatTextActionCallback,
    restoreMpCallback?: SimpleBattleTargetActionCallback;
    extraStack?: number;

    ignoreHook?: boolean;
    ignoreAddStateCallback?: boolean;
  }
): Promise<void> => {
  if (!opt) {
    console.error("addState missing opt", stateId, source.name);
  }
  if (!opt?.battleInfo) {
    console.error("addState missing battleInfo", stateId, source.name);
  }
  if (!opt?.callbacks) {
    console.error("addState missing callbacks", stateId, source.name);
  }

  let stateInfo = allBattleState[stateId] as BattleState | undefined;
  if (!stateInfo) {
    return;
  }

  // 拥有潜行时，无法为别人施加嘲讽
  if (stateId == "taunt" && hasState(source, 'sneak')) {
    return;
  }

  // 如果目标没有回合，则无法被施加放逐
  if (stateId == 'banished') {
    if (!opt?.battleInfo?.turnOrder.includes(target.uuid)) {
      return;
    }
  }

  // if (stateId == "sneak" && hasState(source, '') source.state?.taunt?.remainingDuration) {
  //   return;
  // }

  if (opt?.battleInfo && !opt.callbacks) {
    opt.callbacks = globalCallbackGenerator(opt.battleInfo)
  }

  let cancel = false;

  if (!opt?.ignoreHook) {
    iteratorUnitEquipment(
      source,
      ({ equipmentTrigger, equipmentId }) => {
        duration =
          equipmentTrigger?.beforeApplyStateToUnit?.({
            self: source,
            equipmentId,
            battleInfo: opt?.battleInfo,
            applier: source,
            target,
            stateId,
            duration,
            restoreMpCallback: opt?.restoreMpCallback,
            callbacks: opt?.callbacks,
          })?.duration ?? duration; // 如果有beforeDealDamage钩子，使用其返回值，否则使用原始伤害
      },
      { requiredHook: "beforeApplyStateToUnit" }
    );

    iteratorUnitState(
      source,
      ({ stateInfo, stateInBattle }) => {
        let state = source.state?.[stateId];

        if (!state) {
          return;
        }

        duration =
          stateInfo.onBeforeApplyStateToUnit?.({
            self: source,
            thisState: state,
            applier: source,
            target,
            stateId,
            duration,
          })?.duration ?? duration;
      },
      { requiredHook: "onBeforeApplyStateToUnit" }
    );

    iteratorUnitState(target, ({ stateInfo, stateInBattle }) => {
      if (typeof stateInfo.onBeforeGetState != "function") {
        return;
      }

      const res = stateInfo.onBeforeGetState({
        self: target,
        thisState: stateInBattle,
        source,
        stateId,
        duration,
        battleInfo: opt?.battleInfo,
        callbacks: opt?.callbacks ?? undefined,
      });

      if (!res) {
        return;
      }

      if (res.cancel) {
        cancel = true;
      }

      duration = res.duration ?? duration;
    });
  }

  // 中途被取消
  if (cancel) {
    return;
  }

  if (!target.state) {
    target.state = {};
  }

  if (!target.state[stateId]) {
    target.state[stateId] = {
      id: stateId,
      addBy: source.uuid,
      duration,
      remainingDuration: duration,
      triggered: false,
      extra,
    };
    await stateInfo.onAttach?.({
      source,
      target,
      thisState: target.state[stateId],
      battleInfo: opt.battleInfo,

      extraAttachStack: opt?.extraStack,

      callbacks: opt?.callbacks,
      dealDamageCallback: opt?.dealDamageCallback,
      floatTextCallback: opt?.floatTextCallback
    });
  } else if (stateInfo.stackable) {
    // 可叠加的状态，重复触发
    // target.state[stateId].duration = duration;
    // target.state[stateId].remainingDuration = duration;
    const prevDuration = target.state[stateId].duration;

    // 状态不再直接覆盖，而是延长持续时间
    target.state[stateId].remainingDuration += duration;

    if (target.state[stateId].remainingDuration > prevDuration) {
      target.state[stateId].remainingDuration = prevDuration;
    }


    target.state[stateId].extra = {
      ...target.state[stateId].extra,
      ...extra,
    };

    await stateInfo.onAttach?.({
      source,
      target,
      thisState: target.state[stateId],
      battleInfo: opt.battleInfo,

      callbacks: opt?.callbacks,
      extraAttachStack: opt?.extraStack,

      dealDamageCallback: opt?.dealDamageCallback,
      floatTextCallback: opt?.floatTextCallback
    });
  } else {
    const prevDuration = target.state[stateId].duration;

    // 状态不再直接覆盖，而是延长持续时间
    target.state[stateId].remainingDuration += duration;

    if (target.state[stateId].remainingDuration > prevDuration) {
      target.state[stateId].remainingDuration = prevDuration;
    }

    // target.state[stateId].duration = duration;
    // target.state[stateId].remainingDuration = duration;
    // target.state[stateId].extra = extra
  }

  // 状态增减会影响钩子签名，显式失效缓存
  invalidateUnitHookCache(target);

  // await iteratorUnitEquipmentAsync(source, async ({equipmentTrigger, equipmentId}) => {
  //   // migrated to batched execution below
  // }, {requiredHook: 'afterApplyStateToUnit'})

  if (!opt?.ignoreHook) {
    await iteratorUnitEquipmentAsync(
      source,
      ({ equipmentTrigger, equipmentId }) => {
        if (!equipmentTrigger?.afterApplyStateToUnit) return;
        return equipmentTrigger.afterApplyStateToUnit({
          self: source,
          equipmentId,
          battleInfo: opt?.battleInfo,
          applier: source,
          target,
          stateId,
          duration,
          callbacks: opt?.callbacks ?? undefined,
        });
      },
      { requiredHook: "afterApplyStateToUnit" }
    );
  }

  if (opt && !opt.ignoreAddStateCallback) {
    if (opt.callbacks?.addStateCallback) {
      opt.callbacks?.addStateCallback?.({
        source,
        target,
        value: duration,
        stateId: stateId,
      });
    } else if (opt.addStateCallback) {
      opt.addStateCallback?.({
        source,
        target,
        value: duration,
        stateId: stateId,
      });
    }
  }

  if (!opt?.ignoreHook) {
    await iteratorUnitEquipmentAsync(
      target,
      ({ equipmentTrigger, equipmentId }) => {
        if (!equipmentTrigger?.afterGetState) return;
        return equipmentTrigger.afterGetState({
          self: source,
          equipmentId,
          battleInfo: opt.battleInfo,
          applier: source,
          target,
          stateId,
          duration,
          callbacks: opt?.callbacks ?? undefined,
        });
      },
      { requiredHook: "afterGetState" }
    );
  }
};


export const reduceUnitSkillColddown = (unit: BaseBattleUnit, value: number = 1) => {
  const currentTurnUnit = unit;

  if (!currentTurnUnit.skillColddown) {
    currentTurnUnit.skillColddown = {};
  }

  ObjectKeys<AllBattleSkillId>(currentTurnUnit.skillColddown).forEach(
    (skillId) => {
      if (!currentTurnUnit.skillColddown![skillId]) {
        currentTurnUnit.skillColddown![skillId] = 0;
      }

      if (currentTurnUnit.skillColddown![skillId] > 0) {
        currentTurnUnit.skillColddown![skillId] -= value;
      }

      if (currentTurnUnit.skillColddown![skillId] < 0) {
        currentTurnUnit.skillColddown![skillId] = 0; // 确保不小于0
      }
    }
  );
}

export function oriGetStatusInBattle(unit: BaseBattleUnit, pStatusKey: AllBaseCharacterStatusType, opt?: {
  onlyBaseStatus?: boolean
}): number {
  let statusKey = pStatusKey;

  let value = 0;

  const statusInfo = opt?.onlyBaseStatus ? unit.baseStatus : unit.status;

  if (pStatusKey == "battle") {
    value = unit.level;
  } else {
    const battleStatus: AllBaseCharacterStatusType[] = [
      "attacking",
      "defencing",

      "stamina",
      "strength",
      "dexterity",
      "intelligence",
    ] as const;

    // 防护：确保 statusInfo 存在，caller 可能直接调用 oriGetStatusInBattle
    if (!statusInfo) {
      return 0;
    }

    if (battleStatus.includes(statusKey)) {
      const actStatusKey:
        | "attacking"
        | "defencing"
        | "stamina"
        | "strength"
        | "dexterity"
        | "intelligence" = statusKey as any;
      value = statusInfo[actStatusKey]?.level ?? 0;
    } else {
      const actStatuskey: keyof BattleLifeStatus = statusKey as any;
      value = statusInfo.otherStatus?.[actStatuskey]?.level ?? 0;
    }
  }

  return value;
}
export function getUnitStatusInBattle(
  unit: BaseBattleUnit,
  pStatusKey: AllBaseCharacterStatusType,
  opt: {
    battleInfo: BattleInfo;
    callbacks: BattleCallback;

    ignoreTriggers?: boolean;
    onlyBaseStatus?: boolean;
  }
): number {
  if (!pStatusKey) {
    return 0;
  }

  const statusInfo = opt?.onlyBaseStatus ? unit.baseStatus : unit.status;

  if (!statusInfo) {
    return 0;
  }

  if (opt?.ignoreTriggers) {
    return oriGetStatusInBattle(unit, pStatusKey, {
      onlyBaseStatus: !!opt.onlyBaseStatus,
    });
  }

  let statusKey = pStatusKey;
  let firstGetStatusValue = oriGetStatusInBattle(unit, pStatusKey, {
    onlyBaseStatus: !!opt.onlyBaseStatus,
  });

  iteratorUnitEquipment(
    unit,
    ({ equipmentTrigger, equipmentId }) => {
      // 安全地读取 onGetStatus 的返回值（可能为 undefined、object、Promise 或其他类型）
      const res = equipmentTrigger?.onGetStatus?.({
        equipmentId,
        self: unit,

        oriGetStatusKey: pStatusKey,
        currentGetStatusKey: statusKey,

        statusValue: firstGetStatusValue,

        battleInfo: opt.battleInfo,
        callbacks: opt.callbacks,

        onlyBaseStatus: !!opt.onlyBaseStatus,
      });

      // 如果插件返回 Promise（异步实现），res?.modifyToStatusKey 会是 undefined，保留原 statusKey（避免抛异常）
      statusKey = res?.modifyToStatusKey || statusKey;
    },
    { requiredHook: "onGetStatus" }
  );

  const finalGetStatusValue = oriGetStatusInBattle(unit, statusKey, {
    onlyBaseStatus: !!opt.onlyBaseStatus,
  });

  let extra = 0;

  iteratorUnitEquipment(
    unit,
    ({ equipmentTrigger, equipmentId }) => {
      // 强制将修改量转换为数字，避免插件返回非数值导致累加出错
      let mod = equipmentTrigger?.onGetStatusModify?.({
        equipmentId,
        self: unit,

        oriGetStatusKey: pStatusKey,
        currentGetStatusKey: statusKey,

        statusValue: firstGetStatusValue,

        battleInfo: opt.battleInfo,
        callbacks: opt.callbacks,

        onlyBaseStatus: !!opt.onlyBaseStatus,
      });

      if (!mod) {
        mod = 0
      }

      mod = Math.trunc(mod);
      if (mod < 0) {
        mod = 0;
      }

      extra += mod;
    },
    { requiredHook: "onGetStatusModify" }
  );

  return finalGetStatusValue + extra;
}

export function getRandomPercentAboutUnit(unit: BaseBattleUnit, opt: {
  battleInfo: BattleInfo,
  callbacks: BattleCallback,
  ignoreTrigger?: boolean
}): number {
  let base = randomNumberInFullColseRange(0, 1);

  if (opt.ignoreTrigger) {
    return base;
  }

  let extra = 0;
  iteratorUnitEquipment(
    unit,
    ({ equipmentTrigger, equipmentId }) => {
      // 强制将修改量转换为数字，避免插件返回非数值导致累加出错
      const mod = equipmentTrigger?.onGetRandomPercentModify?.({
        equipmentId,
        self: unit,


        oriPercent: base,

        battleInfo: opt.battleInfo,
        callbacks: opt.callbacks,
      });

      extra += Number(mod ?? 0);
    },
    { requiredHook: "onGetRandomPercentModify" }
  );

  // 比较反直觉，但是这里是要减去 extra，因为 extra 是对 base 的修正值
  // 比如 base 是 0.6，extra 是 0.1，表示要把 base 提高 10%，那么最终结果就是 0.5（更容易通过检测）
  return base - extra;
}

export async function checkRandomPercentAboutUnit(unit: BaseBattleUnit, passPercent: number, opt: {
  battleInfo: BattleInfo,
  callbacks: BattleCallback,
  ignoreTrigger?: boolean
}): Promise<boolean> {
  const percent = getRandomPercentAboutUnit(unit, opt);
  const passCheck = percent <= passPercent

  if (!opt.callbacks) {
    let callbacks = globalCallbackGenerator(opt.battleInfo)
    if (callbacks) {
      opt.callbacks = callbacks;
    }
  }

  if (!opt.ignoreTrigger) {
    if (passCheck) {
      await iteratorUnitEquipmentAsync(unit, async ({ equipmentTrigger, equipmentId }) => {
        return equipmentTrigger?.onRandomPercentPassCheckSuccess?.({
          equipmentId,
          self: unit,
          
          finalGetPercent: percent,
          passNeedPercent: passPercent,

          battleInfo: opt.battleInfo,
          callbacks: opt.callbacks,
        })

      }, { requiredHook: "onRandomPercentPassCheckSuccess" });

      await iteratorUnitStateAsync(unit, async ({ stateInfo, stateInBattle }) => {
        return stateInfo.onRandomPercentPassCheckSuccess?.({
          thisState: stateInBattle,
          self: unit,
          
          finalGetPercent: percent,
          passNeedPercent: passPercent,

          battleInfo: opt.battleInfo,
          callbacks: opt.callbacks,
        })
      }, {requiredHook: 'onRandomPercentPassCheckSuccess'});

    } else {
      await iteratorUnitEquipmentAsync(unit, async ({ equipmentTrigger, equipmentId }) => {
        return equipmentTrigger?.onRandomPercentPassCheckFailed?.({
          equipmentId,
          self: unit,
          
          finalGetPercent: percent,
          passNeedPercent: passPercent,

          battleInfo: opt.battleInfo,
          callbacks: opt.callbacks,
        })
      }, { requiredHook: "onRandomPercentPassCheckFailed" });
      await iteratorUnitStateAsync(unit, async ({ stateInfo, stateInBattle }) => {
        return stateInfo.onRandomPercentPassCheckFailed?.({
          thisState: stateInBattle,
          self: unit,
          
          finalGetPercent: percent,
          passNeedPercent: passPercent,

          battleInfo: opt.battleInfo,
          callbacks: opt.callbacks,
        })
      }, {requiredHook: 'onRandomPercentPassCheckFailed'});
    }
  }

  return passCheck;
}

export function hasStateCauseForbidCastSkill(
  unit: BaseBattleUnit
): boolean {

  if (!unit.state) {
    return false;
  }

  for (const tStateId in unit.state) {
    const stateId = tStateId as keyof typeof allBattleState;
    const stateData = allBattleState[stateId] as BattleState;
    if (
      unit.state[stateId] &&
      unit.state[stateId].remainingDuration > 0 &&
      stateData.forbidCastSkill
    ) {
      return true;
    }
  }

  return false;
}

export function hasStateCauseForbidRevive(
  unit: BaseBattleUnit
): boolean {

  if (!unit.state) {
    return false;
  }

  for (const tStateId in unit.state) {
    const stateId = tStateId as keyof typeof allBattleState;
    const stateData = allBattleState[stateId] as BattleState;
    if (
      unit.state[stateId] &&
      unit.state[stateId].remainingDuration > 0 &&
      stateData.forbidRevive
    ) {
      return true;
    }
  }

  return false;
}

export function hasStateCauseForbidCancelSkillCast (
  unit: BaseBattleUnit
): boolean {

  if (!unit.state) {
    return false;
  }

  for (const tStateId in unit.state) {
    const stateId = tStateId as keyof typeof allBattleState;
    const stateData = allBattleState[stateId] as BattleState;
    if (
      unit.state[stateId] &&
      unit.state[stateId].remainingDuration > 0 &&
      stateData.forbidCancelSkillCast
    ) {
      return true;
    }
  }

  return false;
}

// 遍历房间的所有战斗契约；返回 true 可中断
export async function iteratorAllOfferingAsync(
  room: Pick<BattleRoom, "offerings"> | BattleRoom | null | undefined,
  cb: (opt: {
    stack: BattleRoomOfferingStack;
    spec: BattleRoomOfferingSpec;
  }) => Promise<void> | void,
  opt?: { requiredTrigger?: BattleRoomOfferingEffectTrigger }
): Promise<void> {
  const stacks = room?.offerings;
  if (!stacks?.length) return;

  for (const stack of stacks) {
    if (!stack.count && !stack.nextConsumeInTurns) {
      continue;
    }

    const spec = allBattleRoomOffering[stack.specId];
    if (!spec) {
      continue;
    }

    if (opt?.requiredTrigger) {
      const triggers = spec.effects?.map((e) => e.trigger) ?? [];
      if (!triggers.includes(opt.requiredTrigger)) continue;
    }
    const shouldBreak = cb({ stack, spec, });
    if (isPromise(shouldBreak)) {
      await shouldBreak;
    }
  }
}