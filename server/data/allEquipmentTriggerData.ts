import { DealDamageCauseByType, EquipmentTriggerInfo, FullBattleAction, HpRestoreReason, MpLossReason, MpRestoreReason } from "~/shared/types/battle";
import { AllGameResourceID } from "~/shared/types/gameResource";
import { castSkill, dealAoeDamage, dealDamage, getEachSelfTurnTriggerMark, getOncePerBattleTriggerMark, getRandomUnitInCollection, getRandomUnitsInCollection, healUnit, isEnemy, isUnitSelectable, lossMp, restoreMp, setEachSelfTurnTriggerMark, setOncePerBattleTriggerMark, summonUnit, addState, isAlly, reduceUnitSkillColddown, getUnitStatusInBattle, oriGetStatusInBattle, getRandomPercentAboutUnit, checkRandomPercentAboutUnit, hasStateCauseForbidRevive, hasStateCauseForbidCancelSkillCast } from "../utils/game/battleAction";
import { allGameEnemies } from "~/shared/data/allGameEnemy";
import { generateEnemyById } from "../utils/game/enemy";
import { allBattleState, detachState, getStateExtraStack, getUnitStateMaxExtraStack, readStateExtraInfo, writeStateExtraInfo, } from "~/shared/data/allBattleState";
import { clone, delay, ObjectKeys, ObjectKeysTyped, randomElementInCollection, } from "~/shared/utils";
import { AllBattleStateId, BattleState } from "~/shared/types/BattleState";
import { getEquipmentLevel, getUnitEquipmentLevel, hasEquipment } from "~/shared/utils/game/equipment";
import { allGameBattleSkills } from "~/shared/data/allGameBattleSkill";
import { AllBattleSkillId, DamageType, damageTypeMap, GameBattleSkill } from "~/shared/types/skill";
import { BaseBattleUnit, BattleSkillInfo } from "~/shared/types/unit";
import { findUnitInBattle, getAllyUnits, getAllyUnitsByUnit, getBaseInfoFromBattleInfo, getEnemyUnits, getEnemyUnitsByUnit, getInfoFromBattleInfo, getMainStatusInfo, getUnitGroupId, hasState, isDamageType } from "~/shared/utils/game/battle";
import { AllGameEnemyID, Enemy } from "~/shared/types/emeny";
import { allCharacterStatus } from "~/shared/data/allCharacterStatus";
import { getAvailableUnitCollection, moveUnitTurnOrder, getUnitTurnOrder, } from '~/shared/utils/game/battle'
import { allGameResource } from "~/shared/data/allGameResources";
import { AllResourceAlchemyTagId } from "~/shared/types/gameAlchemy";
import { findSkillNodeInfo } from "~/shared/utils/skillTreeEffects";
import { AllBaseCharacterStatusType, AllCharacterStatusType } from "~/shared/types/characterInfo";

// Cache for enemy spoil checks keyed by `${pTag}:${enemyId}` -> boolean with TTL to avoid unbounded growth
type EnemySpoilCacheEntry = { value: boolean; ts: number };
const enemySpoilTagCache = new Map<string, EnemySpoilCacheEntry>();
const ENEMY_SPOIL_CACHE_TTL_MS = 10 * 60 * 1000; // 10min

const getEnemySpoilCached = (key: string): boolean | undefined => {
  const entry = enemySpoilTagCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > ENEMY_SPOIL_CACHE_TTL_MS) {
    enemySpoilTagCache.delete(key);
    return undefined;
  }
  return entry.value;
};

const setEnemySpoilCached = (key: string, value: boolean): void => {
  enemySpoilTagCache.set(key, { value, ts: Date.now() });
};

if (typeof setInterval === 'function') {
  const t = setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of enemySpoilTagCache.entries()) {
      if (now - entry.ts > ENEMY_SPOIL_CACHE_TTL_MS) {
        enemySpoilTagCache.delete(k);
      }
    }
  }, ENEMY_SPOIL_CACHE_TTL_MS);
  t.unref?.();
}
const enemySpoilCollectorGenerator = (pTag: AllResourceAlchemyTagId): {
  onNeedModifyOriginDamage: EquipmentTriggerInfo["onNeedModifyOriginDamage"],
  calcBattleWinRewardExtraDropRate: EquipmentTriggerInfo["calcBattleWinRewardExtraDropRate"]
} => {
  return {
    onNeedModifyOriginDamage({target, oriDamage, equipmentId}) {
      const enemyId = target.id as AllGameEnemyID
      const enemy = allGameEnemies[enemyId];
      if (!enemy || !enemy.drops?.length) {
        return 0
      }

      const cacheKey = `${pTag}:${enemyId}`;
      const cached = getEnemySpoilCached(cacheKey);
      if (cached === false) return 0;
      if (cached === true) {
        const equipmentLevel = getEquipmentLevel(equipmentId)
        return oriDamage * (0.04 + equipmentLevel * 0.01);
      }

      // not cached: check quickly using `some` and cache the boolean result
      const hasMatched = enemy.drops.some(d => {
        const resource = allGameResource[d.id]
        return !!resource && !!resource.alchemyTag && resource.alchemyTag.includes(pTag)
      })

      setEnemySpoilCached(cacheKey, !!hasMatched);

      if (!hasMatched) {
        return 0
      }

      const equipmentLevel = getEquipmentLevel(equipmentId)
      return oriDamage * (0.04 + equipmentLevel * 0.01);
    },
    calcBattleWinRewardExtraDropRate: ({equipmentId, drop}) => {
      const resource = allGameResource[drop.id]
      if (!resource || resource.alchemyTag?.includes(pTag)) {
        return 0;
      }

      const equipmentLevel = getEquipmentLevel(equipmentId)

      return drop.percent * (0.05 + equipmentLevel * 0.01);
    }
  }
}

export const allEquipmentTriggerData: Record<string, EquipmentTriggerInfo> = {
  wardenIronWhip: {
    async afterEachOtherUnitAction({
      self,
      currentTurnUnit,
      battleInfo,
      equipmentId,
      callbacks,
    }) {
      if (!currentTurnUnit || self.uuid == currentTurnUnit?.uuid) {
        return;
      }

      if (currentTurnUnit.hp <= 0) {
        return;
      }

      const attacking =
        getUnitStatusInBattle(self, "attacking", { battleInfo, callbacks }) ??
        1;
      // const dexterity = getUnitStatusInBattle(self, 'dexterity', { battleInfo, callbacks }) ?? 1;
      const strength =
        getUnitStatusInBattle(self, "strength", { battleInfo, callbacks }) ?? 1;

      let damage = Math.floor(attacking + strength * 1.5);

      const isAllyAboutTarget = isAlly(
        self.uuid,
        currentTurnUnit.uuid,
        battleInfo
      );
      if (isAllyAboutTarget) {
        damage = Math.floor(damage * 0.1);
      }

      callbacks?.floatTextCallback({
        unit: self,
        text: "狱卒的催促",
      });

      await dealDamage(self, currentTurnUnit, damage, {
        damageType: DamageType.Physical,
        causeBy: { type: DealDamageCauseByType.Equipment, equipmentId },
        callbacks,
        battleInfo,
        ignoreDefencePercent: isAllyAboutTarget ? 0 : 30,
      });

      if (isAllyAboutTarget) {
        if (currentTurnUnit.hp <= 0) {
          currentTurnUnit.hp = 1;
        }
      }

      if (isAllyAboutTarget) {
        await addState(
          "wardenIronWhipAllyState",
          2,
          self,
          currentTurnUnit,
          {},
          {
            callbacks,
            battleInfo,
          }
        );
      }
    },
  },

  safeJourneyToken: {
    calcBattleWinRewardExtraExpPercent({ equipmentId }) {
      return 0.01
    },
  },
  lv1BattleExpCollector: {
    calcBattleWinRewardExtraExpPercent({ equipmentId }) {
      const equipmentLevel = getEquipmentLevel(equipmentId);

      return 0.005 + equipmentLevel * 0.001;
    },
  },

  lv1EnemySpoilCollector: enemySpoilCollectorGenerator("monster_essence_lv1"),
  lv2EnemySpoilCollector: enemySpoilCollectorGenerator("monster_essence_lv2"),
  lv3EnemySpoilCollector: enemySpoilCollectorGenerator("monster_essence_lv3"),
  lv4EnemySpoilCollector: enemySpoilCollectorGenerator("monster_essence_lv4"),

  cursedSilkSachet: {
    calcBattleWinRewardExtraDropRate: ({ self, battleInfo, enemy, drop }) =>
      (drop.percent ?? 0) * 0.08,
  },

  murkyCrystalDagger: {
    async afterDealDamage({
      self,
      target,
      equipmentId,
      allTargets,
      reducedDamage,
      causeBy,
      damageType,
      battleInfo,
      callbacks,
    }) {
      if (damageType != DamageType.Physical) {
        return;
      }

      if (
        causeBy.type == DealDamageCauseByType.Equipment &&
        causeBy.equipmentId == equipmentId
      ) {
        return;
      }

      if (causeBy.type != DealDamageCauseByType.Skill) {
        return;
      }

      if (allTargets.length != 1) {
        return;
      }

      const info = getBaseInfoFromBattleInfo(self, battleInfo);

      if (!info) {
        return;
      }

      let allSameNameTargets = info.enemies.filter(
        (e) => e.hp > 0 && e.uuid != target.uuid && e.name == target.name
      );

      if (!allSameNameTargets.length) {
        return;
      }

      const percentList = [
        0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2,
      ]; // 0.7 ~ 1.2
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const percent = percentList[equipmentLevel] ?? 0.7;

      callbacks?.floatTextCallback({
        unit: self,
        text: "折返",
      });

      const damage = Math.floor(reducedDamage * percent);
      await dealAoeDamage(self, allSameNameTargets, () => damage, {
        damageType: DamageType.Physical,
        causeBy: {
          type: DealDamageCauseByType.Equipment,
          equipmentId: equipmentId,
        },
        callbacks,
        battleInfo,
      });
    },
  },
  murkyCrystalStaff: {
    onNeedModifyOriginDamage({
      self,
      oriDamage,
      equipmentId,
      causeBy,
      damageType,
      callbacks,
    }) {
      if (damageType != DamageType.Magical) {
        return 0;
      }

      // 非技能来源的魔法伤害，降低30%
      if (causeBy.type != DealDamageCauseByType.Skill) {
        return -(oriDamage * 0.3);
      }

      if (!causeBy.skillId) {
        return 0;
      }

      let totalColddownVal = 0;

      ObjectKeysTyped(self.skillColddown ?? {}).forEach((skillId) => {
        let colddownInfo = self.skillColddown?.[skillId];

        totalColddownVal += colddownInfo ?? 0;
      });

      if (!totalColddownVal) {
        return 0;
      }

      const extraDamagePercentPerColddownValList = [
        0.03, 0.032, 0.034, 0.036, 0.038, 0.04, 0.042, 0.044, 0.046, 0.048,
        0.05,
      ];
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const extraDamagePercentPerColddownVal =
        extraDamagePercentPerColddownValList[equipmentLevel] ?? 0.03;

      let extraDamagePercent =
        totalColddownVal * extraDamagePercentPerColddownVal;

      callbacks?.floatTextCallback?.({
        unit: self,
        text: `浊影(${totalColddownVal}-${(extraDamagePercent * 100).toFixed(
          1
        )}%)`,
      });

      return Math.floor(oriDamage * extraDamagePercent);
    },
  },

  amberGazeOddSignStaff: {
    onNeedModifyOriginDamage({ self, equipmentId, battleInfo, oriDamage }) {
      const info = getBaseInfoFromBattleInfo(self, battleInfo);

      if (!info) {
        return 0;
      }

      let aliveEnemiesCount = info.enemies.filter((e) => e.hp > 0).length;

      if (aliveEnemiesCount % 2 == 1) {
        const extraValList = [
          0.08, 0.085, 0.09, 0.095, 0.1, 0.15, 0.11, 0.115, 0.12, 0.125, 0.13,
        ];
        const equipmentLevel = getEquipmentLevel(equipmentId);
        const extraVal = extraValList[equipmentLevel] ?? 0.08;

        return Math.floor(extraVal * oriDamage);
      }

      return 0;
    },
  },

  cashmereSingleCloak: {
    extraHpRegenWhenTurnStart: ({ equipmentId, self, battleInfo }) => {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return 0;
      }
      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        const extraValList = [2, 3, 4, 5, 6, 7];
        const equipmentLevel = getEquipmentLevel(equipmentId);
        const extraVal = extraValList[equipmentLevel] ?? 2;

        return extraVal;
      }

      return 0;
    },
    extraMpRegenWhenTurnStart: ({ equipmentId, self, battleInfo }) => {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return 0;
      }
      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        const extraValList = [2, 3, 4, 5, 6, 7];
        const equipmentLevel = getEquipmentLevel(equipmentId);
        const extraVal = extraValList[equipmentLevel] ?? 2;

        return extraVal;
      }

      return 0;
    },
    onNeedModifyOriginDamage({
      self,
      battleInfo,
      oriDamage,
      equipmentId,
      callbacks,
    }) {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return 0;
      }

      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      const extraDamagePercentList = [0.3, 0.33, 0.36, 0.39, 0.42, 0.45];
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const maxPercent = extraDamagePercentList[equipmentLevel] ?? 0.3;
      const lvl = Math.max(0, Math.min(80, Number(self.level ?? 0)));
      const t = lvl / 80;
      const extraDamagePercent = 0.1 + t * (maxPercent - 0.1);

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        return Math.floor(oriDamage * extraDamagePercent);
      }

      return 0;
    },
    beforeTakeDamage({
      self,
      reducedDamage,
      battleInfo,
      equipmentId,
      callbacks,
    }) {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return reducedDamage;
      }

      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      const reduceDamagePercentList = [0.3, 0.33, 0.36, 0.39, 0.42, 0.45];
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const reduceDamagePercent =
        reduceDamagePercentList[equipmentLevel] ?? 0.3;

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        return Math.floor(reducedDamage * (1 - reduceDamagePercent));
      }

      return reducedDamage;
    },
  },

  cashmereSingleDexCloak: {
    extraHpRegenWhenTurnStart: ({ equipmentId, self, battleInfo }) => {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return 0;
      }
      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        const extraValList = [2, 3, 4, 5, 6, 7];
        const equipmentLevel = getEquipmentLevel(equipmentId);
        const extraVal = extraValList[equipmentLevel] ?? 2;

        return extraVal;
      }

      return 0;
    },
    extraMpRegenWhenTurnStart: ({ equipmentId, self, battleInfo }) => {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return 0;
      }
      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        const extraValList = [2, 3, 4, 5, 6, 7];
        const equipmentLevel = getEquipmentLevel(equipmentId);
        const extraVal = extraValList[equipmentLevel] ?? 2;

        return extraVal;
      }

      return 0;
    },
    onNeedModifyOriginDamage({
      self,
      battleInfo,
      oriDamage,
      equipmentId,
      callbacks,
    }) {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return 0;
      }

      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      const extraDamagePercentList = [0.3, 0.33, 0.36, 0.39, 0.42, 0.45];
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const maxPercent = extraDamagePercentList[equipmentLevel] ?? 0.3;
      const lvl = Math.max(0, Math.min(80, Number(self.level ?? 0)));
      const t = lvl / 80;
      const extraDamagePercent = 0.1 + t * (maxPercent - 0.1);

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        return Math.floor(oriDamage * extraDamagePercent);
      }

      return 0;
    },
    beforeTakeDamage({
      self,
      reducedDamage,
      battleInfo,
      equipmentId,
      callbacks,
    }) {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return reducedDamage;
      }

      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      const reduceDamagePercentList = [0.3, 0.33, 0.36, 0.39, 0.42, 0.45];
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const reduceDamagePercent =
        reduceDamagePercentList[equipmentLevel] ?? 0.3;

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        return Math.floor(reducedDamage * (1 - reduceDamagePercent));
      }

      return reducedDamage;
    },
    async onBattleStart({ self, enemies, battleInfo, callbacks, equipmentId }) {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return;
      }

      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        callbacks?.floatTextCallback({
          unit: self,
          text: "孤胆利刃",
        });

        const attacking =
          getUnitStatusInBattle(self, "attacking", { battleInfo, callbacks }) ??
          1;
        await await dealAoeDamage(
          self,
          enemies,
          (target) => {
            return Math.floor(Math.min(target.maxHp * 0.3, attacking * 20));
          },
          {
            damageType: DamageType.Physical,
            callbacks,
            battleInfo,
            causeBy: {
              type: DealDamageCauseByType.Equipment,
              equipmentId: equipmentId,
            },
            maxDamage: (target) =>
              Math.floor(Math.min(target.maxHp * 0.3, attacking * 20)),
          }
        );
      }
    },
  },

  cashmereSingleCloakPlus: {
    extraEnemyCount({ self, battleInfo }) {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);

      if (battleInfo.isDenseFogMode) {
        return 0;
      }

      if (!selfGroup) {
        return 0;
      }
      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        return 3;
      }

      return 0;
    },
    extraHpRegenWhenTurnStart: ({ equipmentId, self, battleInfo }) => {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return 0;
      }
      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        const extraValList = [2, 3, 4, 5, 6, 7];
        const equipmentLevel = getEquipmentLevel(equipmentId);
        const extraVal = extraValList[equipmentLevel] ?? 2;

        return extraVal;
      }

      return 0;
    },
    extraMpRegenWhenTurnStart: ({ equipmentId, self, battleInfo }) => {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return 0;
      }
      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        const extraValList = [2, 3, 4, 5, 6, 7];
        const equipmentLevel = getEquipmentLevel(equipmentId);
        const extraVal = extraValList[equipmentLevel] ?? 2;

        return extraVal;
      }

      return 0;
    },
    onNeedModifyOriginDamage({
      self,
      battleInfo,
      oriDamage,
      equipmentId,
      callbacks,
    }) {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return 0;
      }

      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      const extraDamagePercentList = [0.5, 0.53, 0.56, 0.59, 0.62, 0.65];
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const maxPercent = extraDamagePercentList[equipmentLevel] ?? 0.5;
      const lvl = Math.max(0, Math.min(80, Number(self.level ?? 0)));
      const t = lvl / 80;
      const extraDamagePercent = 0.1 + t * (maxPercent - 0.1);

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        return Math.floor(oriDamage * extraDamagePercent);
      }

      return 0;
    },
    beforeTakeDamage({
      self,
      reducedDamage,
      battleInfo,
      equipmentId,
      callbacks,
    }) {
      const selfGroup = getUnitGroupId(battleInfo.groups, self.uuid);
      if (!selfGroup) {
        return reducedDamage;
      }

      const groupUnits = battleInfo.groups[selfGroup];
      const playerMemberUuids = groupUnits.filter((uuid) => {
        const unit = findUnitInBattle(battleInfo, uuid);

        return unit?.isPlayerUnit && !unit?.isSummoned;
      });

      const reduceDamagePercentList = [0.3, 0.33, 0.36, 0.39, 0.42, 0.45];
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const reduceDamagePercent =
        reduceDamagePercentList[equipmentLevel] ?? 0.3;

      if (playerMemberUuids.length == 1 && playerMemberUuids[0] == self.uuid) {
        return Math.floor(reducedDamage * (1 - reduceDamagePercent));
      }

      return reducedDamage;
    },
  },

  starforgedAlloyHat: {
    async onBattleStart({ self, allies, enemies, battleInfo, callbacks }) {
      const selfStrength =
        getUnitStatusInBattle(self, "strength", { battleInfo, callbacks }) ?? 0;

      callbacks?.floatTextCallback({
        unit: self,
        text: "裁决之眼",
      });

      for (const enemy of enemies) {
        const enemyStrength =
          getUnitStatusInBattle(enemy, "strength", { battleInfo, callbacks }) ??
          0;

        if (enemyStrength < selfStrength) {
          await addState(
            "starforgedAlloyHatStellarJudgment",
            2,
            self,
            enemy,
            {},
            {
              battleInfo,
              callbacks,
            }
          );
        }
      }

      // 获得力量最高的友军
      let maxAllyStrength = 0;
      let strongestAlly = null;

      for (const ally of allies) {
        if (ally.uuid == self.uuid) {
          continue;
        }

        const allyStrength =
          getUnitStatusInBattle(ally, "strength", { battleInfo, callbacks }) ??
          0;

        if (allyStrength > maxAllyStrength) {
          maxAllyStrength = allyStrength;
          strongestAlly = ally;
        }
      }

      if (strongestAlly) {
        callbacks?.floatTextCallback({
          unit: strongestAlly,
          text: "星辰启示",
        });
        await addState(
          "starforgedAlloyHatCelestialInsight",
          2,
          self,
          strongestAlly,
          {},
          {
            battleInfo,
            callbacks,
          }
        );
      }
    },
  },
  starforgedAlloylCoat: {
    async afterTakeDamage({
      reducedDamage,
      self,
      equipmentId,
      battleInfo,
      callbacks,
    }) {
      const info = getInfoFromBattleInfo(self, battleInfo);

      if (!info) {
        return;
      }

      const allies = info.allyUnits;
      for (const ally of allies) {
        if (ally.uuid == self.uuid) {
          continue;
        }

        if (hasEquipment(ally, "starforgedAlloylCoat")) {
          return;
        }
      }

      const healPercentList = [
        0.3, 0.31, 0.32, 0.33, 0.34, 0.35, 0.36, 0.37, 0.38, 0.39, 0.4,
      ];
      const equipmentLevel = getEquipmentLevel(equipmentId);

      const healPercent = healPercentList[equipmentLevel] || 0.3;

      const healValue = Math.floor(reducedDamage * healPercent);

      if (healValue <= 0) {
        return;
      }

      if (allies.length <= 1) {
        return;
      }

      callbacks?.floatTextCallback?.({
        unit: self,
        text: "星辰奉献",
      });

      for (const ally of allies) {
        if (ally.uuid == self.uuid) {
          continue;
        }

        // await healUnit(self, ally, healValue, {
        healUnit(self, ally, healValue, {
          reason: HpRestoreReason.EQUIPMENT_EFFECT,
          callbacks,
          battleInfo,
          callback: callbacks.healCallback,
          ignoreHook: true,
        });
      }
    },
    async afterTakeHeal({
      self,
      source,
      target,
      battleInfo,
      equipmentId,
      actualHealValue,
      oriHealValue,
      callbacks,
      reason,
    }) {
      return;
      // // todo
      if (hasState(self, "starforgedAlloylCoatKeeping")) {
        return;
      }

      if (reason == HpRestoreReason.TURN_START_RESTORE) {
        return;
      }

      const info = getInfoFromBattleInfo(self, battleInfo);

      if (!info) {
        return;
      }

      await addState(
        "starforgedAlloylCoatKeeping",
        2,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
        }
      );

      const enemies = info.enemyUnits;

      const healDamagePercentList = [
        1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5,
      ];
      const equipmentLevel = getEquipmentLevel(equipmentId);

      const healDamagePercent =
        (healDamagePercentList[equipmentLevel] || 1) + 1;

      let damage = actualHealValue * healDamagePercent;
      if (actualHealValue != oriHealValue) {
        damage += (oriHealValue - actualHealValue) * (healDamagePercent - 1);
      }

      if (source.uuid == target.uuid) {
        damage = Math.floor(damage * 0.5);
      }

      // const maxDamageMultipleList = [6, 6.2, 6.4, 6.6, 6.8, 7, 7.2, 7.4, 7.6, 7.8, 8];
      // const maxDamageMultiple = maxDamageMultipleList[equipmentLevel] || 6;

      // const maxDamage = self.maxHp * maxDamageMultiple;

      // damage = Math.min(damage, maxDamage);

      callbacks?.floatTextCallback?.({
        unit: self,
        text: "星辉奔涌",
      });

      await dealAoeDamage(
        self,
        enemies,
        (target) => {
          if (!target.isPlayerUnit) {
            return damage * 2;
          }
          return damage;
        },
        {
          ignoreDefencePercent: 30,
          damageType: DamageType.Magical,
          battleInfo,
          callbacks,
          // ignoreTrigger: true,
          // triggerWhiteList: {
          //   equipment: ['eternalGuardianAmulet']
          // }
        }
      );

      detachState("starforgedAlloylCoatKeeping", self, battleInfo, {
        callbacks,
      });
    },
    async beforeOtherUnitTakeDamage({
      self,
      target,
      reducedDamage,
      battleInfo,
      callbacks,
      equipmentId,
    }) {
      const info = getInfoFromBattleInfo(self, battleInfo);

      if (!info) {
        return reducedDamage;
      }

      const allies = info.allyUnits;
      for (const ally of allies) {
        if (ally.uuid == self.uuid) {
          continue;
        }

        if (hasEquipment(ally, "starforgedAlloylCoat")) {
          return reducedDamage;
        }
      }

      if (target.uuid == self.uuid) {
        return reducedDamage;
      }

      let isAllyAboutTarget = isAlly(self.uuid, target.uuid, battleInfo);

      if (!isAllyAboutTarget) {
        return reducedDamage;
      }

      callbacks?.drawLineCallback?.({
        source: target,
        target: self,
        color: "rgba(255, 242, 0, 1)",
      });

      const damageTransferPercentList = [
        0.4, 0.42, 0.44, 0.46, 0.48, 0.5, 0.52, 0.54, 0.56, 0.58, 0.6,
      ];
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const damageTransferPercent =
        damageTransferPercentList[equipmentLevel] || 0.4;

      let halfDamage = Math.floor(reducedDamage * damageTransferPercent);

      await addState(
        "starforgedAlloylCoatDamageTransfer",
        10,
        self,
        self,
        {},
        {
          extraStack: halfDamage,
          battleInfo,
          callbacks,
          ignoreHook: true,
        }
      );
      // self.hp -= halfDamage;

      // self.hp = Math.max(1, self.hp);

      return halfDamage;
    },
  },
  starforgedAlloyGloves: {
    async afterCastSkill(param) {
      const { self, battleInfo, skillId, callbacks } = param;

      if (skillId === "baseAttack") {
        return;
      }

      if (self.hp != self.maxHp) {
        return;
      }

      const info = getBaseInfoFromBattleInfo(self, battleInfo);

      if (!info) {
        return;
      }

      if (!info?.allEnemies.some((e) => e.hp > 0)) {
        return;
      }

      // await delay(100);

      callbacks.floatTextCallback?.({
        unit: self,
        text: "星辰律动",
      });

      await castSkill(
        self,
        "baseAttack",
        {
          battleInfo,
          callbacks,
          ...info,
        },
        {
          hideSkillCastText: true,
          ignoreAfterSimpleAttackTrigger: true,
        }
      );
    },
    async afterHealUnit(param) {
      const { self, target, battleInfo, callbacks, equipmentId, oriHealValue } =
        param;

      if (!oriHealValue) {
        return;
      }

      const healPercentList = [
        0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1,
      ];
      const equipmentLevel = getEquipmentLevel(equipmentId);

      const healPercent = healPercentList[equipmentLevel] || 0.5;

      const heal = Math.floor(healPercent * oriHealValue);

      let duration = 3;
      if (self.uuid == target.uuid) {
        duration = 4;
      }

      // callbacks?.floatTextCallback({
      //   unit: self,
      //   text: '星辉灌注'
      // })

      await addState(
        "starforgedAlloyGlovesInfusion",
        duration,
        self,
        target,
        {
          thisStateActuralValue: heal,
        },
        {
          battleInfo,
          callbacks,
        }
      );
    },
  },

  murkyCrystalGuardianCoreAmulet: {
    onNeedModifyOriginDamage({ battleInfo, oriDamage }) {
      if (battleInfo.isDenseFogMode) {
        return Math.floor(oriDamage * 0.05);
      }

      return 0;
    },
    beforeTakeDamage({ battleInfo, reducedDamage }) {
      if (battleInfo.isDenseFogMode) {
        return Math.floor(reducedDamage * 0.9);
      }

      return reducedDamage;
    },
  },

  cuteHammer: {
    async afterDealDamage({ self, target, battleInfo, callbacks, causeBy }) {
      if (causeBy.skillId != "baseAttack") {
        return;
      }

      if (
        !(await checkRandomPercentAboutUnit(self, 0.25, {
          battleInfo,
          callbacks,
        }))
      ) {
        return;
      }

      callbacks.floatTextCallback?.({
        unit: target,
        text:
          randomElementInCollection(["好痛！", "啊呀~", "哎呀~", "呜哇！"]) ??
          "啊呀~",
      });

      await addState(
        "confusion",
        1,
        self,
        target,
        {},
        {
          callbacks,
          battleInfo,
        }
      );
    },
  },

  cuteIronBracelet: {
    async onBattleStart({ self, callbacks, battleInfo }) {
      const dateNowStr = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Shanghai",
      });
      const dateHour = new Date(dateNowStr).getHours();
      const isNight = dateHour >= 19 || dateHour < 6;
      if (!isNight) {
        return;
      }

      callbacks?.floatTextCallback?.({
        unit: self,
        text:
          randomElementInCollection([
            "喵呜~",
            "喵喵~",
            "喵~",
            "喵喵喵?",
            "喵!",
          ]) ?? "喵呜~",
      });

      await addState(
        "cuteIronBraceletState",
        4,
        self,
        self,
        {},
        {
          callbacks,
          battleInfo,
        }
      );
    },
  },
  starDustMagicBook: {
    async onAfterSimpleAttack({ self, equipmentId, battleInfo, callbacks }) {
      let equipmentLevel = getEquipmentLevel(equipmentId);

      if (equipmentLevel < 2) {
        return;
      }

      let info = getBaseInfoFromBattleInfo(self, battleInfo);
      if (!info) {
        return;
      }

      await castSkill(
        self,
        "cometStrike",
        {
          battleInfo,
          callbacks,
          ...info,
        },
        {
          ignoreAfterCastSkillTrigger: true,
          ignoreAfterSimpleAttackTrigger: true,
          ignoreColddown: true,
          ignoreMpCost: true,
        }
      );
    },
  },
  bookOfUnwriting: {
    async afterCastSkill({ self, battleInfo, skillId, callbacks }) {
      if (hasState(self, "bookOfUnwritingColddown")) {
        return;
      }

      if (!self.skillColddown?.[skillId]) {
        return;
      }

      self.skillColddown[skillId] = 0;

      callbacks.floatTextCallback?.({
        unit: self,
        text: "回溯手稿",
      });

      let mpCost = allGameBattleSkills[skillId].mpCost * 0.5;

      await lossMp(self, self, mpCost, {
        reason: MpLossReason.EQUIPMENT,
        callback: callbacks.lossMpCallback,
        callbacks,
        battleInfo,
      });

      await addState(
        "bookOfUnwritingColddown",
        4,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
        }
      );
    },
  },
  echoBellCharm: {
    afterCastSkill({ self, battleInfo, skillId }) {
      const uuid = `${self.uuid}_echoBellCharm_${Date.now()}_${Math.floor(
        Math.random() * 10000
      )}`;

      if (skillId == "mirrorImage") {
        return;
      }

      if (skillId == "knowledgeCrownSkill") {
        return;
      }

      const selfClone = clone(self);

      const echoTmp: BaseBattleUnit = {
        ...selfClone,
        uuid,
        name: self.name + "的回响",
        maxHp: self.maxHp,
        hp: self.maxHp,
        maxMp: selfClone.maxMp,
        mp: selfClone.mp,
        isPlayer: false,
        tmpShield: 0,
        skills: {
          [skillId]: selfClone.skills[skillId],
        },
        ai: {
          [skillId]: selfClone.ai[skillId],
        },
        status: {
          ...selfClone.status,
        },
        baseStatus: {
          ...selfClone.baseStatus,
        },
        skillColddown: {},
        inventory: {},
      };

      delete echoTmp.equipment;
      delete echoTmp.triggerMark;
      delete echoTmp.tmpOncePreBattleExtraTurnIndexList;
      delete echoTmp.inventory;

      let echo = summonUnit(battleInfo, self, echoTmp, 1, {
        uuid,
      });

      let selfTurnOrder = getUnitTurnOrder(battleInfo, self.uuid);
      moveUnitTurnOrder(battleInfo, echo.uuid, selfTurnOrder + 3);
    },
  },

  otherworldCrystalPendant: {
    beforeTakeDamage({ self, damageType, reducedDamage, callbacks }) {
      if (damageType == DamageType.Physical) {
        // callbacks?.floatTextCallback({
        //   unit: self,
        //   text: '物理崩解'
        // })

        return reducedDamage * 0.5;
      }

      return reducedDamage;
    },
    onNeedModifyOriginDamage({
      self,
      source,
      battleInfo,
      callbacks,
      oriDamage,
      damageType,
    }) {
      if (source.uuid != self.uuid) {
        return 0;
      }

      let extra = 0;

      if (battleInfo.extraTurnOnBattleBegin) {
        let currentExtraTurnUnitUuid =
          battleInfo.extraTurnOnBattleBegin[battleInfo.extraTurnIndex];
        if (
          currentExtraTurnUnitUuid == self.uuid &&
          damageType == DamageType.Magical
        ) {
          callbacks?.floatTextCallback({
            unit: self,
            text: "超临",
          });

          extra = oriDamage * 0.15;
        }
      }

      if (damageType == DamageType.Physical) {
        extra -= oriDamage * 0.5;
      }

      return extra;
    },
    // async afterDealDamage({self, source, target, battleInfo, callbacks, damageType, reducedDamage}) {
    //   let currentTurnUnitUuid = battleInfo.turnOrder[battleInfo.currentTurnIndex];

    //   if (source.uuid != self.uuid) {
    //     return;
    //   }

    //   if (currentTurnUnitUuid == self.uuid) {
    //     return;
    //   }

    //   if (damageType != DamageType.Magical) {
    //     return;
    //   }

    //   // 限制：在自身回合开始前，最多触发20次
    //   let remainingCount = getEachSelfTurnTriggerMark<number>(self, "otherworldCrystalPendantRemainingCount", 20) ?? 20;
    //   if (!remainingCount || remainingCount <= 0) {
    //     return;
    //   }

    //   let selfIntelligence = self.baseStatus.intelligence.level ?? 0;

    //   let baseDamage = Math.floor(target.hp * 0.08)

    //   let minDamage = Math.floor(selfIntelligence * 0.5);
    //   let maxDamage = Math.floor(selfIntelligence * 5);

    //   let finalDamage = Math.min(maxDamage, Math.max(minDamage, baseDamage));

    //   // callbacks?.floatTextCallback?.({
    //   //   unit: self,
    //   //   text: '噬界'
    //   // });

    //   await dealDamage(self, target, finalDamage, {
    //     damageType: DamageType.Magical,
    //     ignoreDefence: true,
    //     battleInfo,
    //     callbacks,
    //     ignoreDealDamageCallback: true,
    //     ignoreTrigger: true,
    //   })

    //   // 递减并记录剩余触发次数
    //   remainingCount = Math.max(0, remainingCount - 1);
    //   setEachSelfTurnTriggerMark(self, "otherworldCrystalPendantRemainingCount", remainingCount);
    // },
    // 自身回合开始时重置计数
    onTurnStart({ self }) {
      setEachSelfTurnTriggerMark(
        self,
        "otherworldCrystalPendantRemainingCount",
        20
      );
    },
    // 战斗开始时初始化，以便在第一次轮到自己前也能正确生效
    onBattleStart({ self }) {
      setEachSelfTurnTriggerMark(
        self,
        "otherworldCrystalPendantRemainingCount",
        20
      );
    },
  },
  empressCloak: {
    async onBattleStart({ self, allies, battleInfo, callbacks }) {
      for (const ally of allies) {
        if (ally.uuid == self.uuid) {
          continue;
        }

        if (hasEquipment(ally, "empressCloak")) {
          return;
        }
      }

      let mainStatus: "strength" | "dexterity" | "intelligence" = "strength";
      let finalExtraValue = 0;

      let selfStrength =
        getUnitStatusInBattle(self, "strength", { battleInfo, callbacks }) ?? 0;
      let selfDexterity =
        getUnitStatusInBattle(self, "dexterity", { battleInfo, callbacks }) ??
        0;
      let selfIntelligence =
        getUnitStatusInBattle(self, "intelligence", {
          battleInfo,
          callbacks,
        }) ?? 0;

      // 判断目标当前最高属性
      if (selfStrength >= selfDexterity && selfStrength >= selfIntelligence) {
        mainStatus = "strength";
        finalExtraValue = selfStrength;
      } else if (
        selfDexterity >= selfStrength &&
        selfDexterity >= selfIntelligence
      ) {
        mainStatus = "dexterity";
        finalExtraValue = selfDexterity;
      } else {
        mainStatus = "intelligence";
        finalExtraValue = selfIntelligence;
      }

      finalExtraValue = Math.floor(finalExtraValue * 0.5);

      for (const ally of allies) {
        await addState(
          "empressCloakStatusUp",
          4,
          self,
          ally,
          {
            thisStateActuralValue: finalExtraValue,
            mainStatus: mainStatus,
            readableDesc: {
              主属性: allCharacterStatus[mainStatus].name,
            },
          },
          {
            battleInfo,
            callbacks,
          }
        );
      }
    },
  },
  trollClubPlus: {
    beforeDamageSourceCalcDamage({
      self,
      damageType,
      allTargets,
      equipmentId,
      reducedDamage,
      causeBy,
    }) {
      if (causeBy.skillId != "baseAttack") {
        return reducedDamage;
      }

      let equipmentLevel = getEquipmentLevel(equipmentId);
      let extraDamageList = [50, 60, 70, 80, 90, 100];
      let extraDamage = extraDamageList[equipmentLevel] || 50;

      return reducedDamage + extraDamage;
    },
    async afterDealDamage({
      self,
      equipmentId,
      causeBy,
      reducedDamage,
      battleInfo,
      callbacks,
    }) {
      if (causeBy.skillId != "baseAttack") {
        return;
      }

      if (
        !(await checkRandomPercentAboutUnit(self, 0.33, {
          battleInfo,
          callbacks,
        }))
      ) {
        return;
      }

      let info = getInfoFromBattleInfo(self, battleInfo);
      if (!info) {
        return;
      }

      let randomRange = [...info.enemyUnits, ...info.allyUnits];
      randomRange = randomRange.filter((u) => u.hp > 0 && u.uuid != self.uuid);
      const randomTarget = randomElementInCollection(randomRange);

      if (!randomTarget) {
        return;
      }

      callbacks?.floatTextCallback?.({
        unit: self,
        text: "狂力乱击",
      });

      await dealDamage(self, randomTarget, reducedDamage, {
        ignoreDefence: true,
        damageType: DamageType.Physical,
        battleInfo,
        callbacks,
      });
    },
  },
  riposteAmulet: {
    async afterTakeDamage({
      self,
      damageSource,
      reducedDamage,
      damageType,
      battleInfo,
      callbacks,
    }) {
      if (self.hp <= 0) {
        return;
      }

      if (self.uuid == damageSource.uuid) {
        return;
      }

      if (isAlly(self.uuid, damageSource.uuid, battleInfo)) {
        return;
      }

      if (hasState(self, 'riposteAmuletLock')) {
        return;
      }

      let ripostePercent = 0.5;

      // 调整：反击护符对来自玩家单位的伤害，触发概率降低至20%
      if (damageSource.isPlayerUnit) {
        ripostePercent = 0.2;
      }

      if (
        !(await checkRandomPercentAboutUnit(self, ripostePercent, {
          battleInfo,
          callbacks,
        }))
      ) {
        return;
      }

      let info = getInfoFromBattleInfo(self, battleInfo);
      if (!info) {
        return;
      }

      await addState(
        "riposteAmuletLock",
        2,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
        }
      );


      callbacks?.floatTextCallback?.({
        unit: self,
        text: "反击",
      });

      await castSkill(
        self,
        "baseAttack",
        {
          battleInfo,
          allies: info.allyUnits,
          enemies: info.enemyUnits,
          allAllies: info.allAllyUnit,
          allEnemies: info.allEnemies,
          callbacks,
          ...callbacks,
        },
        {
          hideSkillCastText: true,
          specificTarget: [damageSource],
        }
      );

      detachState("riposteAmuletLock", self, battleInfo, {
        callbacks,
      });
    },
  },

  shadowSteelHammer: {
    skillOverride: {
      baseAttack: {
        effect: async ({
          self,
          allies,
          enemies,
          battleInfo,
          callbacks,
          skillExtraParam,
        }) => {
          // if (!battleInfo.turnOrder.includes(self.uuid)) {
          //   return;
          // }

          if (!self.equipment?.rightHand?.includes("shadowSteelHammer")) {
            return undefined;
          }

          let targets = getAvailableUnitCollection(enemies).filter(
            (enemy) => enemy.hp > 0
          );

          // 优先选取行动顺序中“自己之后”的最近敌人；若没有，则选“自己之前”的最近敌人
          const order = battleInfo.turnOrder;
          const selfIdx = order.findIndex((uuid) => uuid === self.uuid);
          const targetUuidSet = new Set(targets.map((t) => t.uuid));

          let closestTarget: BaseBattleUnit | undefined = undefined;

          if (selfIdx !== -1 && targets.length) {
            const len = order.length;
            for (let step = 1; step < len; step++) {
              // 先看后方
              const nextIdx = (selfIdx + step) % len;
              const nextUnit = findUnitInBattle(battleInfo, order[nextIdx]);
              if (
                nextUnit &&
                nextUnit.hp > 0 &&
                targetUuidSet.has(nextUnit.uuid)
              ) {
                closestTarget = nextUnit;
                break;
              }
              // 再看前方
              const prevIdx = (selfIdx - step + len) % len;
              const prevUnit = findUnitInBattle(battleInfo, order[prevIdx]);
              if (
                prevUnit &&
                prevUnit.hp > 0 &&
                targetUuidSet.has(prevUnit.uuid)
              ) {
                closestTarget = prevUnit;
                break;
              }
            }
          }

          if (skillExtraParam?.specificTarget) {
            closestTarget = skillExtraParam.specificTarget.at(0);
          }

          // 自身不在行动顺序中，直接选第一个
          if (!battleInfo.turnOrder.includes(self.uuid)) {
            closestTarget = targets[0];
          }

          let res: FullBattleAction = {
            type: "attack",
            damage: {},
            heal: {},

            targetUnitUuidList: [],
            castSkillId: "baseAttack",
            sourceUnitUuid: self.uuid,
          };

          if (!closestTarget) {
            // 如果没有找到目标，返回一个空的BattleAction
            return res;
          }

          self.hp = Math.max(1, self.hp - Math.floor(self.maxHp * 0.25));

          const attack =
            getUnitStatusInBattle(self, "attacking", {
              battleInfo,
              callbacks,
            }) ?? 1;
          const strength =
            getUnitStatusInBattle(self, "strength", {
              battleInfo,
              callbacks,
            }) ?? 1;
          const stamina =
            getUnitStatusInBattle(self, "stamina", { battleInfo, callbacks }) ??
            1;

          const equipmentLevel = getEquipmentLevel(self.equipment?.rightHand);
          const multiple = 3.5 + equipmentLevel * 0.1;

          const extraDamage = Math.floor(
            strength * multiple + stamina * multiple
          );

          callbacks?.floatTextCallback?.({
            unit: self,
            text: "崩裂",
          });

          await dealDamage(self, closestTarget, attack + extraDamage, {
            damageType: DamageType.Physical,
            dealDamageCallback: callbacks.dealDamageCallback,
            battleInfo,
            causeBy: {
              equipmentId: self.equipment?.rightHand,
              type: DealDamageCauseByType.Attack,
              skillId: "baseAttack",
            },
            ignoreDefencePercent: 30,
          });

          res.damage = await dealAoeDamage(
            self,
            targets.filter((target) => target.uuid !== closestTarget.uuid),
            () => {
              return Math.floor((attack + extraDamage) * 0.3);
            },
            {
              damageType: DamageType.Physical,
              dealDamageCallback: callbacks.dealDamageCallback,
              battleInfo,
              causeBy: {
                equipmentId: self.equipment?.rightHand,
                type: DealDamageCauseByType.Attack,
                skillId: "baseAttack",
              },
              hideAnimEffect_Line: true,
              ignoreDefencePercent: 40,
            }
          );
          res.targetUnitUuidList.push(...Object.keys(res.damage));

          for (const uuid of res.targetUnitUuidList) {
            if (uuid == closestTarget.uuid) {
              continue;
            }

            callbacks?.drawLineCallback({
              source: closestTarget,
              target: findUnitInBattle(battleInfo, uuid)!,
              color: "rgba(223, 136, 136, 0.79)",
            });
          }

          if (closestTarget.hp <= 0) {
            await addState(
              "shadowSteelHammerBloodFrenzy",
              2,
              self,
              self,
              {},
              {
                callbacks,
                battleInfo,
              }
            );
          }

          return res;
        },
        hideSkillCastText: true,
      },
    },
  },

  shadowSteelScythe: {
    skillOverride: {
      baseAttack: {
        effect: async ({
          self,
          allies,
          enemies,
          battleInfo,
          callbacks,
          skillExtraParam,
        }) => {
          // if (!battleInfo.turnOrder.includes(self.uuid)) {
          //   return;
          // }

          if (!self.equipment?.rightHand?.includes("shadowSteelScythe")) {
            return undefined;
          }

          let targets = getAvailableUnitCollection(enemies).filter(
            (enemy) => enemy.hp > 0
          );

          if (skillExtraParam?.specificTarget) {
            targets = skillExtraParam.specificTarget;
          }

          let lowestHpTarget = null;
          let lowestHp = Number.MAX_SAFE_INTEGER;
          for (const enemy of targets) {
            if (enemy.hp < lowestHp) {
              lowestHp = enemy.hp;
              lowestHpTarget = enemy;
            }
          }

          let res: FullBattleAction = {
            type: "attack",
            damage: {},
            heal: {},

            targetUnitUuidList: [],
            castSkillId: "baseAttack",
            sourceUnitUuid: self.uuid,
          };

          if (!lowestHpTarget) {
            // 如果没有找到目标，返回一个空的BattleAction
            return res;
          }

          let mainTargetOrder = battleInfo.turnOrder.findIndex(
            (uuid) => uuid === lowestHpTarget.uuid
          );

          // 找到行动顺序前的第一个敌人
          let prevTargetUuid = battleInfo.turnOrder
            .slice(0, mainTargetOrder)
            .reverse()
            .find((uuid) => targets.some((enemy) => enemy.uuid === uuid));
          let prevTarget = targets.find(
            (enemy) => enemy.uuid === prevTargetUuid
          );
          // 找到行动顺序后的第一个敌人
          let nextTargetUuid = battleInfo.turnOrder
            .slice(mainTargetOrder + 1)
            .find((uuid) => targets.some((enemy) => enemy.uuid === uuid));
          let nextTarget = targets.find(
            (enemy) => enemy.uuid === nextTargetUuid
          );

          const attack = getUnitStatusInBattle(self, "attacking", {
            battleInfo,
            callbacks,
          });

          let mainTargetDamage = await dealDamage(
            self,
            lowestHpTarget,
            attack,
            {
              damageType: DamageType.Physical,
              dealDamageCallback: callbacks.dealDamageCallback,
              battleInfo,
              causeBy: {
                type: DealDamageCauseByType.Attack,
                skillId: "baseAttack",
              },
              ignoreDefence: true,
            }
          );
          res.damage![lowestHpTarget.uuid] = mainTargetDamage;
          res.targetUnitUuidList.push(lowestHpTarget.uuid);

          let extraTargets: BaseBattleUnit[] = [];
          if (prevTarget) extraTargets.push(prevTarget);
          if (nextTarget) extraTargets.push(nextTarget);
          if (extraTargets.length) {
            callbacks.floatTextCallback({
              unit: self,
              text: "月割",
            });
            let extraTargetDamage = await dealAoeDamage(
              self,
              extraTargets,
              () => attack,
              {
                damageType: DamageType.Physical,
                dealDamageCallback: callbacks.dealDamageCallback,
                battleInfo,
                causeBy: {
                  type: DealDamageCauseByType.Attack,
                  skillId: "baseAttack",
                },
              }
            );

            res.damage = {
              ...res.damage,
              ...extraTargetDamage,
            };
            res.targetUnitUuidList.push(...Object.keys(extraTargetDamage));
          }

          return res;
        },
        hideSkillCastText: true,
      },
    },
    async afterDealDamage({
      self,
      target,
      equipmentId,
      causeBy,
      battleInfo,
      callbacks,
    }) {
      let equipmentLevel = getEquipmentLevel(equipmentId);
      let attackPerStackList = [5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7];
      let attackPerStack = attackPerStackList[equipmentLevel] || 5;

      if (target.hp <= 0) {
        await addState(
          "shadowSteelScytheDeathPact",
          4,
          self,
          self,
          {
            attackPerStack: attackPerStack,
          },
          {
            battleInfo,
            callbacks,
            extraStack: 1,
          }
        );
      }
    },
  },

  fluffDexGloves: {
    skillOverride: {
      baseAttack: {
        effect: async ({
          self,
          allies,
          enemies,
          battleInfo,
          callbacks,
          skillExtraParam,
        }) => {
          // if (!battleInfo.turnOrder.includes(self.uuid)) {
          //   return;
          // }

          if (!self.equipment?.arm?.includes("fluffDexGloves")) {
            return undefined;
          }

          let targets = getAvailableUnitCollection(enemies).filter(
            (enemy) => enemy.hp > 0
          );

          let equipmentLevel = getEquipmentLevel(self.equipment.arm);
          let extraTargetCountList = [0, 1, 1, 2, 2, 3];

          let lowestHpTarget = null;
          let lowestHp = Number.MAX_SAFE_INTEGER;
          for (const enemy of targets) {
            if (enemy.hp < lowestHp) {
              lowestHp = enemy.hp;
              lowestHpTarget = enemy;
            }
          }

          if (skillExtraParam?.specificTarget) {
            lowestHpTarget = getRandomUnitInCollection(
              skillExtraParam.specificTarget
            );
          }

          let res: FullBattleAction = {
            type: "attack",
            damage: {},
            heal: {},

            targetUnitUuidList: [],
            castSkillId: "baseAttack",
            sourceUnitUuid: self.uuid,
          };

          if (!lowestHpTarget) {
            // 如果没有找到目标，返回一个空的BattleAction
            return res;
          }

          let extraTarget = getRandomUnitsInCollection(
            targets.filter((t) => t.uuid != lowestHpTarget?.uuid),
            extraTargetCountList[equipmentLevel] || 3
          );

          const selfDexterity =
            getUnitStatusInBattle(self, "dexterity", {
              battleInfo,
              callbacks,
            }) ?? 1;
          const attacking =
            getUnitStatusInBattle(self, "attacking", {
              battleInfo,
              callbacks,
            }) ?? 1;
          let attack = Math.floor(attacking * 1 + selfDexterity * 3);

          let mainTargetDamage = await dealDamage(
            self,
            lowestHpTarget,
            attack,
            {
              damageType: DamageType.Physical,
              dealDamageCallback: callbacks.dealDamageCallback,
              battleInfo,
              causeBy: {
                type: DealDamageCauseByType.Attack,
                skillId: "baseAttack",
              },
              ignoreDefencePercent: 20,
            }
          );

          // await delay(100);

          callbacks.floatTextCallback({
            unit: self,
            text: "连袭",
          });
          let extraTargetDamage = await dealAoeDamage(
            self,
            extraTarget,
            () => attack,
            {
              damageType: DamageType.Physical,
              callbacks,
              dealDamageCallback: callbacks.dealDamageCallback,
              battleInfo,
              // causeBy: {
              //   skillId: "baseAttack",
              // },
              ignoreDefencePercent: 20,
            }
          );

          res.damage = {
            ...extraTargetDamage,
            ...{ [lowestHpTarget.uuid]: mainTargetDamage },
          };
          res.targetUnitUuidList = [
            ...Object.keys(extraTargetDamage),
            lowestHpTarget.uuid,
          ];
          return res;
        },
        hideSkillCastText: true,
      },
    },
  },
  fluffDexScarf: {
    async afterEachOtherUnitAction({
      self,
      currentTurnUnit,
      battleInfo,
      callbacks,
    }) {
      if (!isAlly(self.uuid, currentTurnUnit?.uuid ?? "", battleInfo)) {
        return;
      }

      await addState(
        "fluffConcentration",
        2,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
          addStateCallback: callbacks.addStateCallback,
          extraStack: 1,
        }
      );
    },
    onNeedModifyOriginDamage({
      self,
      oriDamage,
      damageType,
      allTargets,
      equipmentId,
      battleInfo,
      callbacks,
    }) {
      let equipmentLevel = getEquipmentLevel(equipmentId);

      let extraDamagePercentPerStackList = [0.8, 0.85, 0.9, 0.95, 1, 1.1];
      let extraDamagePercentPerStack =
        extraDamagePercentPerStackList[equipmentLevel] || 0.8;

      let stack = getStateExtraStack(self.state?.fluffConcentration) || 0;

      if (
        stack > 0 &&
        allTargets.length == 1 &&
        isDamageType(damageType, DamageType.Physical)
      ) {
        detachState("fluffConcentration", self, battleInfo, {
          callbacks,
        });
        return oriDamage * (extraDamagePercentPerStack * stack);
      }

      return 0;
    },
    beforeTakeDamage({
      self,
      reducedDamage,
      damageType,
      equipmentId,
      battleInfo,
      callbacks,
    }) {
      let order = battleInfo.turnOrder.toReversed();
      let orderIndex = 0;
      for (let j = 0; j < order.length; j++) {
        let thisUnitUuid = order[j];
        if (thisUnitUuid == self.uuid) {
          break;
        }
        let thisUnit = battleInfo.members.find((u) => u.uuid == thisUnitUuid);
        if (!thisUnit || thisUnit.hp <= 0) {
          continue;
        }
        if (isAlly(self.uuid, thisUnitUuid, battleInfo)) {
          orderIndex++;
        }
      }

      if (!orderIndex) {
        return reducedDamage;
      }

      callbacks?.floatTextCallback?.({
        unit: self,
        text: `雾幕残身(${orderIndex * 15}%)`,
      });

      reducedDamage = reducedDamage * (1 - 0.15 * orderIndex);
      if (reducedDamage < 1) {
        reducedDamage = 1;
      }

      return reducedDamage;
    },
  },
  fluffDexCloth: {
    async afterDealDamage({
      self,
      target,
      damageType,
      equipmentId,
      battleInfo,
      callbacks,
    }) {
      let equipmentLevel = getEquipmentLevel(equipmentId);

      let executePercentList = [0.15, 0.16, 0.17, 0.18, 0.19, 0.2];
      let executePercent = executePercentList[equipmentLevel] || 0.15;

      let dexExecutePercentList = [4, 4.3, 4.6, 4.9, 5.2, 5.5];
      let dexExecutePercent = dexExecutePercentList[equipmentLevel] || 4;
      let selfDex =
        getUnitStatusInBattle(self, "dexterity", { battleInfo, callbacks }) ??
        1;

      // 孤刺
      const allAllias = getAllyUnitsByUnit(battleInfo, self);
      if (damageType == DamageType.Physical) {
        let aliveAllies = allAllias.filter((u) => u.hp > 0);
        if (aliveAllies.length == 1 && aliveAllies[0].uuid == self.uuid) {
          if (
            target.hp > 0 &&
            target.hp <= target.maxHp * executePercent &&
            target.hp <= dexExecutePercent * selfDex
          ) {
            await dealDamage(self, target, target.hp, {
              damageType: DamageType.True,
              battleInfo,
              ignoreDefence: true,
              callbacks,
              ignoreDealDamageCallback: true,
              ignoreTrigger: true,
            });
            callbacks?.floatTextCallback?.({
              unit: target,
              text: "孤刺",
            });
          }
        }
      }

      // 断续
      if ((target as Enemy).isBoss && target.hp <= 0) {
        let allDeadAllies = allAllias.filter((u) => u.hp <= 0 && !hasStateCauseForbidRevive(u));

        if (allDeadAllies.length) {
          let target = getRandomUnitInCollection(allDeadAllies, {
            includeDead: true,
          });

          if (target) {
            target.hp = 1;

            callbacks?.floatTextCallback?.({
              unit: target,
              text: "断续!",
            });

            if (target.state) {
              for (const stateId of ObjectKeys<AllBattleStateId>(
                target.state
              )) {
                let stateInfo = allBattleState[stateId] as BattleState;
                if (!stateInfo.unremovable && !stateInfo.keepOnDeath) {
                  detachState(stateId, target, battleInfo, {
                    callbacks,
                  });
                }
              }
            }
          }
        }
      }
    },
  },
  fluffDexPants: {
    async onAfterSimpleAttack({ self, equipmentId, battleInfo, callbacks }) {
      let info = getInfoFromBattleInfo(self, battleInfo);

      let level = getEquipmentLevel(equipmentId);
      let extraAttackPercentList = [0.4, 0.43, 0.46, 0.49, 0.52, 0.55];
      let extraAttackPercent = extraAttackPercentList[level] || 0.4;

      if (!info?.allEnemies.some((e) => e.hp > 0)) {
        return;
      }

      if (!info) {
        return;
      }

      // 参考弓类物品：为每回合的追击添加剩余触发次数，避免无限触发
      let remainingChase = getEachSelfTurnTriggerMark<number>(
        self,
        "fluffDexPantsChaseRemaining",
        0
      );
      if (!remainingChase || remainingChase <= 0) {
        return;
      }

      if (
        !(await checkRandomPercentAboutUnit(self, extraAttackPercent, {
          ignoreTrigger: true,
          battleInfo,
          callbacks,
        }))
      ) {
        return;
      }

      // await delay(100);

      callbacks.floatTextCallback?.({
        unit: self,
        text: "追击",
      });

      await castSkill(
        self,
        "baseAttack",
        {
          battleInfo,
          allies: info.allyUnits,
          enemies: info.enemyUnits,
          allAllies: info.allAllyUnit,
          allEnemies: info.allEnemies,
          callbacks,
          ...callbacks,
        },
        {
          hideSkillCastText: true,
        }
      );

      // 消耗一次追击机会
      remainingChase = Math.max(0, remainingChase - 1);
      setEachSelfTurnTriggerMark(
        self,
        "fluffDexPantsChaseRemaining",
        remainingChase
      );
    },
    onTurnEnd({ self }) {
      // 每回合最多触发一次追击（可按后续需求按等级扩展）
      setEachSelfTurnTriggerMark(self, "fluffDexPantsChaseRemaining", 4);
    },
    onBattleStart({ self }) {
      // 每回合最多触发一次追击（可按后续需求按等级扩展）
      setEachSelfTurnTriggerMark(self, "fluffDexPantsChaseRemaining", 4);
    },
    afterEachOtherUnitAction({ self }) {
      // 回合结束重置下一回合的追击次数
      setEachSelfTurnTriggerMark(self, "fluffDexPantsChaseRemaining", 4);
    },
  },

  fluffMageCloak: {
    beforeApplyStateToUnit({
      self,
      target,
      stateId,
      equipmentId,
      duration,
      restoreMpCallback,
    }) {
      if (stateId == "furryStaticElectricity" && self.uuid == target.uuid) {
        let equipmentLevel = getEquipmentLevel(equipmentId);

        let mpRestoreList = [1, 1, 1.5, 1.5, 2, 2];

        let mpRestore = mpRestoreList[equipmentLevel] || 1;

        restoreMp(self, self, mpRestore, {
          reason: MpRestoreReason.EQUIPMENT_EFFECT,
          callback: restoreMpCallback,
        });
      }

      if (
        stateId == "furryStaticElectricityOverload" &&
        self.uuid == target.uuid
      ) {
        let equipmentLevel = getEquipmentLevel(equipmentId);

        let mpRestoreList = [3, 4, 4, 5, 5, 6];

        let mpRestore = mpRestoreList[equipmentLevel] || 3;

        restoreMp(self, self, mpRestore, {
          reason: MpRestoreReason.EQUIPMENT_EFFECT,
          callback: restoreMpCallback,
        });
      }

      return {
        duration,
      };
    },
  },
  fluffMageGloves: {
    async onTurnStart({
      self,
      battleInfo,
      equipmentId,
      dealDamageCallback,
      floatTextCallback,
      restoreMpCallback,
      callbacks,
    }) {
      let extraStackCountList = [2, 3, 3, 4, 4, 5];

      let level = getEquipmentLevel(equipmentId);

      let extraStackCount = extraStackCountList[level] || 2;

      const currentStack = getStateExtraStack(
        self.state?.furryStaticElectricity
      );

      const maxStack = getUnitStateMaxExtraStack(
        "furryStaticElectricity",
        self, battleInfo
      );

      if (level >= 3) {
        if (currentStack + extraStackCount > (maxStack - 2)) {
          extraStackCount = Math.max(0, maxStack - 2 - (currentStack || 0));
        }
      }

      await addState(
        "furryStaticElectricity",
        6,
        self,
        self,
        {},
        {
          extraStack: extraStackCount,
          battleInfo,
          callbacks,
          dealDamageCallback,
          floatTextCallback,
          restoreMpCallback,
        }
      );
    },
  },
  fluffMagePants: {
    async afterEachOtherUnitAction({
      self,
      currentTurnUnit,
      equipmentId,
      battleInfo,
      callbacks,
    }) {
      if (currentTurnUnit?.uuid == self.uuid) {
        return;
      }

      let percentList = [0.3, 0.32, 0.34, 0.36, 0.38, 0.4];

      let level = getEquipmentLevel(equipmentId);

      let percent = percentList[level] || 0.3;

      if (
        !(await checkRandomPercentAboutUnit(self, percent, {
          battleInfo,
          callbacks,
        }))
      ) {
        return;
      }
      await addState(
        "furryStaticElectricity",
        6,
        self,
        self,
        {},
        {
          extraStack: 1,
          battleInfo,
          callbacks,
        }
      );
    },
  },
  fluffMageHat: {
    beforeDamageSourceCalcDefenceIgnore({
      self,
      damageType,
      equipmentId,
      latestDefenceIgnore,
    }) {
      if (
        damageType != DamageType.Magical ||
        !self.state?.furryStaticElectricity
      ) {
        return latestDefenceIgnore;
      }

      let level = getEquipmentLevel(equipmentId);
      const defenceIgnorePreFurryStaticElectricityStackList = [
        1, 2, 2, 3, 3, 4,
      ];

      let ignoreDefencePercentPerStack =
        defenceIgnorePreFurryStaticElectricityStackList[level] || 5;

      let stack = getStateExtraStack(self.state.furryStaticElectricity);

      return latestDefenceIgnore + ignoreDefencePercentPerStack * stack;
    },
    beforeDecideDamageType({ self, latestDamageType }) {
      let state = self.state?.furryStaticElectricity;

      if (getStateExtraStack(state) >= 7) {
        latestDamageType = DamageType.Magical;
      }

      return latestDamageType;
    },
  },
  fluffMageBurqa: {
    onNeedModifyOriginDamage({
      self,
      damageType,
      battleInfo,
      equipmentId,
      oriDamage,
    }) {
      if (damageType != DamageType.Magical) {
        return 0;
      }

      let level = getEquipmentLevel(equipmentId);
      const damageIncreasePercentPerSelfStackList = [
        0.035, 0.038, 0.041, 0.044, 0.047, 0.05,
      ];
      const damageIncreasePercentPerAllyStackList = [
        0.01, 0.011, 0.012, 0.013, 0.014, 0.015,
      ];

      let damageIncreasePercentPerSelfStack =
        damageIncreasePercentPerSelfStackList[level] || 0.035;
      let damageIncreasePercentPerAllyStack =
        damageIncreasePercentPerAllyStackList[level] || 0.01;

      let selfStack =
        getStateExtraStack(self.state?.furryStaticElectricity) || 0;

      let allAllies = getAllyUnitsByUnit(battleInfo, self);

      let allyStack = 0;
      for (const ally of allAllies) {
        if (ally.uuid == self.uuid) {
          continue;
        }
        allyStack +=
          getStateExtraStack(ally.state?.furryStaticElectricity) || 0;
      }

      let totalExtraPercent =
        selfStack * damageIncreasePercentPerSelfStack +
        allyStack * damageIncreasePercentPerAllyStack;

      return oriDamage * totalExtraPercent;
    },
  },
  solitudeStaff: {
    async onBattleStart({ self, addStateCallback, battleInfo, callbacks }) {
      await addState(
        "solitude",
        3,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
          addStateCallback,
        }
      );
    },
    onNeedModifyOriginDamage({ damageType, oriDamage }) {
      if (damageType == DamageType.Magical) {
        return oriDamage * 0.08;
      }

      return 0;
    },
  },

  cuteIronShield: {
    beforeTakeDamage({ reducedDamage, damageType }) {
      if (damageType == DamageType.Physical) {
        reducedDamage *= 0.8;
      }

      return reducedDamage;
    },
  },

  bambooBow: {
    async afterEachOtherUnitAction({
      callbacks,
      self,
      currentTurnUnit,
      battleInfo,
    }) {
      if (!currentTurnUnit) {
        return;
      }

      if (self.uuid === currentTurnUnit.uuid) {
        return;
      }

      if (!isEnemy(self.uuid, currentTurnUnit.uuid, battleInfo)) {
        return;
      }

      if (!isUnitSelectable(currentTurnUnit)) {
        return;
      }

      let remainingCount = getEachSelfTurnTriggerMark<number>(
        self,
        "bambooBowRemainingCount",
        0
      );

      if (!remainingCount) {
        return;
      }

      let triggerChance = 0.5;
      const bowExpertSkillNode = findSkillNodeInfo(
        self.skillTreeNodes,
        "b_dexterity_bow_expert"
      );
      if (bowExpertSkillNode?.level ?? 0 > 0) {
        triggerChance = 1;
      }

      if (
        !(await checkRandomPercentAboutUnit(self, triggerChance, {
          battleInfo,
          callbacks,
        }))
      ) {
        return;
      }


      let extraDefenceIgnoreList = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40];
      let level = getEquipmentLevel("bambooBow");
      let ignoreDefencePercent = extraDefenceIgnoreList[level] || 30;

      let info = getInfoFromBattleInfo(self, battleInfo);
      if (!info) {
        return;
      }

      // await delay(100);

      callbacks.floatTextCallback?.({
        unit: self,
        text: "射击",
      });

      await castSkill(
        self,
        "baseAttack",
        {
          battleInfo,
          allies: info.allyUnits,
          enemies: info.enemyUnits,
          allAllies: info.allAllyUnit,
          allEnemies: info.allEnemies,
          callbacks,
          ...callbacks,
        },
        {
          damageParam: {
            ignoreDefencePercent,
          },
          hideSkillCastText: true,
        }
      );

      remainingCount = Math.max(0, remainingCount - 1);
      setEachSelfTurnTriggerMark(
        self,
        "bambooBowRemainingCount",
        remainingCount
      );
    },

    onBattleStart({ self }) {
      let arrowCount = 6;
      const bowExpertSkillNode = findSkillNodeInfo(
        self.skillTreeNodes,
        "b_dexterity_bow_expert"
      );

      if (bowExpertSkillNode) {
        arrowCount += 5 * bowExpertSkillNode.level;
      }

      setEachSelfTurnTriggerMark(self, "bambooBowRemainingCount", arrowCount);
    },
    onTurnEnd({ self }) {
      let arrowCount = 6;
      const bowExpertSkillNode = findSkillNodeInfo(
        self.skillTreeNodes,
        "b_dexterity_bow_expert"
      );

      if (bowExpertSkillNode?.level) {
        arrowCount += 5 * bowExpertSkillNode.level;
      }

      setEachSelfTurnTriggerMark(self, "bambooBowRemainingCount", arrowCount);
    },
  },

  bambooCrossbow: {
    async afterEachOtherUnitAction({
      callbacks,
      self,
      currentTurnUnit,
      battleInfo,
    }) {
      if (!currentTurnUnit) {
        return;
      }

      if (self.uuid === currentTurnUnit.uuid) {
        return;
      }

      if (!isAlly(self.uuid, currentTurnUnit.uuid, battleInfo)) {
        return;
      }

      let remainingCount = getEachSelfTurnTriggerMark<number>(
        self,
        "bambooCrossbowRemainingCount",
        0
      );

      if (!remainingCount) {
        return;
      }

      if (
        !(await checkRandomPercentAboutUnit(self, 0.5, {
          battleInfo,
          callbacks,
        }))
      ) {
        return;
      }

      let selfGroup = getUnitGroupId(battleInfo.groups, self.uuid)!;
      let enemies = getEnemyUnits(battleInfo, selfGroup);

      let extraDefenceIgnoreList = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40];
      let level = getEquipmentLevel("bambooCrossbow");
      let ignoreDefencePercent = extraDefenceIgnoreList[level] || 30;

      let randomEnemy = getRandomUnitInCollection(enemies);

      if (!randomEnemy) {
        return;
      }

      let info = getInfoFromBattleInfo(self, battleInfo);
      if (!info) {
        return;
      }

      // await delay(100);

      callbacks.floatTextCallback?.({
        unit: self,
        text: "协同射击",
      });

      await castSkill(
        self,
        "baseAttack",
        {
          battleInfo,
          allies: info.allyUnits,
          enemies: info.enemyUnits,
          allAllies: info.allAllyUnit,
          allEnemies: info.allEnemies,
          callbacks,
          ...callbacks,
        },
        {
          damageParam: {
            ignoreDefencePercent,
          },
          hideSkillCastText: true,
        }
      );

      remainingCount = Math.max(0, remainingCount - 1);
      setEachSelfTurnTriggerMark(
        self,
        "bambooCrossbowRemainingCount",
        remainingCount
      );
    },
    onBattleStart({ self }) {
      setEachSelfTurnTriggerMark(self, "bambooCrossbowRemainingCount", 4);
    },
    onTurnEnd({ self }) {
      setEachSelfTurnTriggerMark(self, "bambooCrossbowRemainingCount", 4);
    },
  },

  cuteGun: {
    async afterEachOtherUnitAction({
      callbacks,
      self,
      currentTurnUnit,
      battleInfo,
    }) {
      if (!currentTurnUnit) {
        return;
      }

      if (self.uuid === currentTurnUnit.uuid) {
        return;
      }

      if (!isAlly(self.uuid, currentTurnUnit.uuid, battleInfo)) {
        return;
      }

      let remainingCount = getEachSelfTurnTriggerMark<number>(
        self,
        "cuteGunRemainingCount",
        0
      );

      if (!remainingCount) {
        return;
      }

      if (
        !(await checkRandomPercentAboutUnit(self, 0.65, {
          battleInfo,
          callbacks,
        }))
      ) {
        return;
      }

      let selfGroup = getUnitGroupId(battleInfo.groups, self.uuid)!;
      let enemies = getEnemyUnits(battleInfo, selfGroup);
      let randomEnemy = getRandomUnitInCollection(enemies);

      if (!randomEnemy) {
        return;
      }

      let info = getInfoFromBattleInfo(self, battleInfo);
      if (!info) {
        return;
      }

      // await delay(100);

      callbacks.floatTextCallback?.({
        unit: self,
        text: "精准射击",
      });

      await castSkill(
        self,
        "baseAttack",
        {
          battleInfo,
          allies: info.allyUnits,
          enemies: enemies, // cute gun 准确索敌
          allAllies: info.allAllyUnit,
          allEnemies: enemies,
          callbacks,
          ...callbacks,
        },
        {
          damageParam: {
            extraDamage: 25,
          },
          hideSkillCastText: true,
        }
      );

      remainingCount = Math.max(0, remainingCount - 1);
      setEachSelfTurnTriggerMark(self, "cuteGunRemainingCount", remainingCount);
    },
    onBattleStart({ self }) {
      setEachSelfTurnTriggerMark(self, "cuteGunRemainingCount", 5);
    },
    onTurnEnd({ self }) {
      setEachSelfTurnTriggerMark(self, "cuteGunRemainingCount", 5);
    },
  },

  cuteSword: {
    async onNeedModifyOriginDamage({ self, battleInfo, equipmentId, callbacks, damageType, oriDamage }) {
      if (damageType != DamageType.Physical) {
        return 0;
      }

      const passCheck = await checkRandomPercentAboutUnit(self, 0.08, { battleInfo, callbacks: callbacks! });

      if (!passCheck) {
        return 0;
      }

      const extraDamagePercentList = [3, 3.5, 4, 4.5, 5, 5.5];
      const level = getEquipmentLevel(equipmentId);
      const extraDamagePercent = extraDamagePercentList[level] || extraDamagePercentList[0];

      callbacks?.floatTextCallback?.({
        unit: self,
        text: "幸运一击!",
      });

      const allAllies = getAllyUnitsByUnit(battleInfo, self);

      for(const ally of allAllies) {
        await addState('cuteSwordLuckyState', 2, self, ally, {}, {
          battleInfo,
          callbacks,
        })
      }

      return extraDamagePercent * oriDamage;
    }
  },
  darkingCuteSword: {
    // initialize per-battle per-turn remaining trigger count
    onBattleStart({ self }) {
      // allow 5 triggers per turn
      setEachSelfTurnTriggerMark(self, "darkingCuteSwordRemainingCount", 5);
    },
    async onRandomPercentPassCheckFailed({ self, battleInfo, equipmentId, callbacks }) {
      const info = getInfoFromBattleInfo(self, battleInfo);
      if (!info?.allEnemies.some((e) => e.hp > 0)) {
        return;
      }

      // check remaining triggers for this turn
      let remaining = getEachSelfTurnTriggerMark<number>(self, "darkingCuteSwordRemainingCount", 0);
      if (!remaining) {
        return;
      }

      const damagePercentList = [1, 1.1 , 1.2, 1.3, 1.4, 1.5];
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const damagePercent = damagePercentList[equipmentLevel] || damagePercentList[0];

      const targets = battleInfo.members.filter(u => u.hp > 0 && u.uuid !== self.uuid);

      const damage = self.status.attacking.level * damagePercent;

      callbacks?.floatTextCallback?.({
        unit: self,
        text: "不开心！",
      });

      // decrement remaining count
      remaining = Math.max(0, remaining - 1);
      setEachSelfTurnTriggerMark(self, "darkingCuteSwordRemainingCount", remaining);

      await dealAoeDamage(self, targets, () => damage, {
        damageType: DamageType.Magical,
        causeBy: {
          type: DealDamageCauseByType.Equipment,
          equipmentId: equipmentId,
        },
        battleInfo,
        callbacks,
      });

    },
    afterEachOtherUnitAction({ self }) {
      setEachSelfTurnTriggerMark(self, "darkingCuteSwordRemainingCount", 5);
    },
    // reset remaining triggers at turn end
    onTurnEnd({ self }) {
      setEachSelfTurnTriggerMark(self, "darkingCuteSwordRemainingCount", 5);
    }
  },
  

  shadowSteelDagger: {
    onDamageSourceNeedModifyDefenceIgnorePercent({ equipmentId, damageType }) {
      if (damageType != DamageType.Physical) {
        return 0;
      }

      let extraDefenceIgnoreList = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
      let level = getEquipmentLevel(equipmentId);

      return extraDefenceIgnoreList[level] || 0;
    },
    onNeedModifyOriginDamage({ target, allTargets, damageType, oriDamage }) {
      if (
        damageType != DamageType.Physical ||
        allTargets?.length > 1 ||
        target.hp != target.maxHp
      ) {
        return 0;
      }

      let extraDamageList = [
        0.2, 0.21, 0.22, 0.23, 0.24, 0.25, 0.26, 0.27, 0.28, 0.29, 0.3,
      ];

      let level = getEquipmentLevel("shadowSteelDagger");

      return oriDamage * (extraDamageList[level] || 0);
    },
  },

  timeflowCatEyeStaff: {
    beforeApplyStateToUnit({ equipmentId, target, stateId, duration }) {
      let state = allBattleState[stateId];

      if (!state) {
        return { duration };
      }

      let level = getEquipmentLevel(equipmentId);

      let buffExtraDuration = [1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5];
      let debuffExtraDuration = [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3];

      if (state.isBuff) {
        return {
          duration:
            duration + (buffExtraDuration[level] || buffExtraDuration[0]),
        };
      }

      if (state.isDebuff) {
        return {
          duration:
            duration + (debuffExtraDuration[level] || debuffExtraDuration[0]),
        };
      }

      return {
        duration,
      };
    },
  },

  timeflowCatEyeGenesisEssenceStaff: {
    beforeApplyStateToUnit({ equipmentId, target, stateId, duration }) {
      let state = allBattleState[stateId];

      if (!state) {
        return { duration };
      }

      let level = getEquipmentLevel(equipmentId);

      let buffExtraDuration = 5;
      let debuffExtraDuration = 3;

      if (state.isBuff) {
        return {
          duration: duration + buffExtraDuration,
        };
      }

      if (state.isDebuff) {
        return {
          duration: duration + debuffExtraDuration,
        };
      }

      return {
        duration,
      };
    },
    async onBattleStart({ self, equipmentId, battleInfo, callbacks }) {
      if (hasState(self, "timeflowCatEyeGenesisEssenceStaffCountDownState")) {
        return;
      }

      await addState(
        "timeflowCatEyeGenesisEssenceStaffCountDownState",
        10,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
        }
      );

      const countDownList = [8, 7, 7, 6, 6, 5];
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const countDown = countDownList[equipmentLevel] || countDownList[0];

      writeStateExtraInfo(
        self.state?.timeflowCatEyeGenesisEssenceStaffCountDownState!,
        "timeflowCatEyeGenesisEssenceStaffCountDownMax",
        countDown
      );
      writeStateExtraInfo(
        self.state?.timeflowCatEyeGenesisEssenceStaffCountDownState!,
        "timeflowCatEyeGenesisEssenceStaffCountDown",
        countDown
      );
    },
    afterEachOtherUnitAction({ currentTurnUnit, self, callbacks }) {
      if (currentTurnUnit?.uuid == self.uuid) {
        return;
      }

      let state = self.state?.timeflowCatEyeGenesisEssenceStaffCountDownState;
      if (!state) {
        return;
      }

      let countDown =
        readStateExtraInfo<number>(
          self.state?.timeflowCatEyeGenesisEssenceStaffCountDownState!,
          "timeflowCatEyeGenesisEssenceStaffCountDown"
        ) ?? 8;

      if (countDown <= 0) {
        reduceUnitSkillColddown(self);

        callbacks?.floatTextCallback?.({
          unit: self,
          text: "时流涌动",
        });

        const max =
          readStateExtraInfo<number>(
            self.state?.timeflowCatEyeGenesisEssenceStaffCountDownState!,
            "timeflowCatEyeGenesisEssenceStaffCountDownMax"
          ) ?? 8;

        writeStateExtraInfo(
          self.state?.timeflowCatEyeGenesisEssenceStaffCountDownState!,
          "timeflowCatEyeGenesisEssenceStaffCountDown",
          max
        );

        state.extra!.readableDesc = {
          剩余轮次: max + "",
        };

        return;
      }

      countDown = Math.max(0, countDown - 1);

      state.extra!.readableDesc = {
        剩余轮次: countDown + "",
      };

      writeStateExtraInfo(
        self.state?.timeflowCatEyeGenesisEssenceStaffCountDownState!,
        "timeflowCatEyeGenesisEssenceStaffCountDown",
        countDown
      );
    },
  },

  intertwinedCatEyeStaff: {
    async onTurnStart({
      equipmentId,
      self,
      addStateCallback,
      battleInfo,
      callbacks,
    }) {
      let level = getEquipmentLevel(equipmentId);
      let extraDamagePercentList = [
        0.06, 0.06, 0.06, 0.07, 0.07, 0.07, 0.08, 0.08, 0.08, 0.09, 0.1,
      ];

      let extraDamagePercent =
        extraDamagePercentList[level] || extraDamagePercentList[0];

      if (hasState(self, "intertwinedCatEyeStaffPhysical")) {
        detachState("intertwinedCatEyeStaffPhysical", self, battleInfo, {
          callbacks,
        });
        await addState(
          "intertwinedCatEyeStaffMagical",
          2,
          self,
          self,
          {
            thisStateActuralValue: extraDamagePercent,
            thisStateActuralValueUnit: "percent",
          },
          {
            battleInfo,
            callbacks,
            addStateCallback,
          }
        );
      } else if (hasState(self, "intertwinedCatEyeStaffMagical")) {
        detachState("intertwinedCatEyeStaffMagical", self, battleInfo, {
          callbacks,
        });
        await addState(
          "intertwinedCatEyeStaffPhysical",
          2,
          self,
          self,
          {
            thisStateActuralValue: extraDamagePercent,
            thisStateActuralValueUnit: "percent",
          },
          {
            callbacks,
            battleInfo,
            addStateCallback,
          }
        );
      } else {
        await addState(
          "intertwinedCatEyeStaffMagical",
          2,
          self,
          self,
          {
            thisStateActuralValue: extraDamagePercent,
            thisStateActuralValueUnit: "percent",
          },
          {
            callbacks,
            battleInfo,
            addStateCallback,
          }
        );
      }
    },
  },

  intertwinedCatEyeGenesisEssenceStaff: {
    async afterCastSkill({ equipmentId, self, battleInfo, callbacks }) {
      let level = getEquipmentLevel(equipmentId);
      let extraDamagePercentList = [0.15, 0.16, 0.17, 0.18, 0.19, 0.2];

      let extraDamagePercent =
        extraDamagePercentList[level] || extraDamagePercentList[0];

      if (hasState(self, "intertwinedCatEyeGenesisEssenceStaffPhysical")) {
        detachState(
          "intertwinedCatEyeGenesisEssenceStaffPhysical",
          self,
          battleInfo,
          {
            callbacks,
          }
        );
        await addState(
          "intertwinedCatEyeGenesisEssenceStaffMagical",
          2,
          self,
          self,
          {
            thisStateActuralValue: extraDamagePercent,
            thisStateActuralValueUnit: "percent",
          },
          {
            battleInfo,
            callbacks,
          }
        );
      } else if (
        hasState(self, "intertwinedCatEyeGenesisEssenceStaffMagical")
      ) {
        detachState(
          "intertwinedCatEyeGenesisEssenceStaffMagical",
          self,
          battleInfo,
          {
            callbacks,
          }
        );
        await addState(
          "intertwinedCatEyeGenesisEssenceStaffPhysical",
          2,
          self,
          self,
          {
            thisStateActuralValue: extraDamagePercent,
            thisStateActuralValueUnit: "percent",
          },
          {
            battleInfo,
            callbacks,
          }
        );
      } else {
        await addState(
          "intertwinedCatEyeGenesisEssenceStaffMagical",
          2,
          self,
          self,
          {
            thisStateActuralValue: extraDamagePercent,
            thisStateActuralValueUnit: "percent",
          },
          {
            battleInfo,
            callbacks,
          }
        );
      }
    },

    async afterEachOtherUnitAction({
      currentTurnUnit,
      self,
      thisRoundInfo,
      battleInfo,
      callbacks,
    }) {
      if (currentTurnUnit?.uuid == self.uuid) {
        return;
      }

      const skillInfo = self.skills.intertwinedCatEyeGenesisEssenceStaffSkill;
      if (!skillInfo) {
        return;
      }

      const skillConfInfo: AllBattleSkillId[] =
        skillInfo.extra?.intertwinedCatEyeGenesisEssenceStaffSkills;
      if (!skillConfInfo || !Array.isArray(skillConfInfo)) {
        return;
      }

      const info = getBaseInfoFromBattleInfo(self, battleInfo);

      if (!info) {
        return;
      }

      const isTurnIndexOdd = battleInfo.currentTurnIndex % 2 == 1;
      const thisSkillId = isTurnIndexOdd ? skillConfInfo[0] : skillConfInfo[1];
      const castSkillConf = allGameBattleSkills[thisSkillId];

      if (!thisSkillId) {
        return;
      }

      // 需要消耗1%最大魔法值，魔法值不够不触发
      let mpCostPercent = 0.01;

      // 如果技能的冷却时间超过6回合，每多1回合，额外增加0.005%魔法值消耗
      let colddown: number = castSkillConf.colddown || 5;

      // if (thisSkillId == 'knowledgeCrownSkill') {
      //   const knowledgeCrownSkillConf = self.skills.knowledgeCrownSkill?.extra
      //   const skills: AllBattleSkillId[] = knowledgeCrownSkillConf?.knowledgeCrownSkills;

      //   if (skills && Array.isArray(skills)) {
      //     colddown = 0;
      //     for (const subSkillId of skills) {
      //       const subskillConf = allGameBattleSkills[subSkillId];

      //       colddown += subskillConf.colddown;
      //     }
      //   }
      // }
      // mpCostPercent = colddown * 0.003;

      if (colddown > 5) {
        mpCostPercent += (colddown - 5) * 0.005;
      }

      const needMp =
        Math.ceil(self.maxMp * mpCostPercent) + castSkillConf.mpCost;
      if (self.mp < needMp) {
        return;
      }

      await lossMp(self, self, needMp, {
        reason: MpLossReason.EQUIPMENT,
        callbacks,
        battleInfo,
      });

      if (!castSkillConf) {
        callbacks.floatTextCallback({
          unit: self,
          text: "交织-未知技能",
        });
        return;
      }

      callbacks.floatTextCallback({
        unit: self,
        text: `交织-${castSkillConf.name}`,
      });
      await castSkill(
        self,
        thisSkillId,
        {
          battleInfo,
          ...info,
          callbacks,
          ...callbacks,
        },
        {
          hideSkillCastText: true,
          ignoreCastColddown: true,
          ignoreColddown: true,
          ignoreAfterCastSkillTrigger: true,
        }
      );
    },
  },

  shadowSteelHat: {
    async afterDealDamage({
      self,
      target,
      damageType,
      equipmentId,
      addStateCallback,
      battleInfo,
      callbacks,
    }) {
      if (!target || damageType != DamageType.Physical) {
        return;
      }

      await addState(
        "shadowIntimidate",
        2,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
        }
      );

      await addState(
        "tremble",
        2,
        self,
        target,
        {},
        {
          battleInfo,
          callbacks,
        }
      );
    },
  },

  shadowSteelCoat: {
    onTurnStart({ self }) {
      self.hp = self.hp * (1 - 0.13);
    },
  },
  shadowSteelPants: {
    onTurnStart({ self }) {
      self.hp = self.hp * (1 - 0.13);
    },
  },
  shadowSteelGloves: {
    onNeedModifyOriginDamage({ self, damageType, oriDamage, equipmentId }) {
      let level = getEquipmentLevel(equipmentId);

      let extraDamageList = [
        0.8, 0.8, 0.8, 0.9, 0.9, 0.9, 1.0, 1.0, 1.1, 1.1, 1.2,
      ];

      if (isDamageType(damageType, DamageType.Physical)) {
        let lossHpPercent = (self.maxHp - self.hp) / self.maxHp;
        let extraDamagePercent =
          lossHpPercent * (extraDamageList[level] ?? extraDamageList[0]); // 生命值损失越多，造成的物理伤害越高
        return oriDamage * extraDamagePercent; // 生命值损失越多，造成的物理伤害越高
      }
      return 0;
    },
    onTurnStart({ self }) {
      self.hp = self.hp * (1 - 0.08);
    },
  },

  paradeCape: {
    async onTurnStart({
      self,
      allies,
      addStateCallback,
      battleInfo,
      callbacks,
    }) {
      let stateList = {
        paradeCapeAddAttack: {
          result: (unit: BaseBattleUnit) => {
            return Math.ceil(unit.baseStatus?.attacking?.level * 0.05);
          },
        },
        paradeCapeAddDefence: {
          result: (unit: BaseBattleUnit) => {
            return Math.ceil(unit.baseStatus?.defencing?.level * 0.05);
          },
        },
        paradeCapeAddStatus: {
          result: () => {
            return 10;
          },
        },
      } as const;

      let thisTimeState = randomElementInCollection(
        ObjectKeys<keyof typeof stateList>(stateList)
      );

      if (!thisTimeState) {
        return;
      }

      callbacks?.floatTextCallback({
        unit: self,
        text: "欢乐游行！",
      });

      for (const ally of allies) {
        if (ally.uuid == self.uuid) {
          continue;
        }
        // 提升属性
        await addState(
          thisTimeState,
          1,
          self,
          ally,
          {
            thisStateActuralValue: stateList[thisTimeState].result(ally),
          },
          {
            battleInfo,
            callbacks,
            addStateCallback,
          }
        );
      }
    },
  },

  abyssalCloak: {
    beforeTakeDamage(param) {
      if (param.self.hp < param.self.maxHp * 0.3) {
        // 如果生命值低于30%，则减少伤害
        return param.reducedDamage * 0.7; // 减少30%伤害
      }

      return param.reducedDamage;
    },
    onNeedModifyOriginDamage(param) {
      if (param.self.hp < param.self.maxHp * 0.3) {
        // 如果生命值低于30%，则减少伤害
        return param.oriDamage * 0.1; // 增加10%伤害
      }

      return 0;
    },
  },

  loadOfamusementPark: {
    async onBattleStart(param) {
      let level = getEquipmentLevel(param.equipmentId);

      if (level < 1) {
        return;
      }

      let damageIncreasePercent = 0.04;
      damageIncreasePercent += level * 0.01; // 每级增加1%

      param.callbacks?.floatTextCallback({
        unit: param.self,
        text: "狂欢！",
      });

      for (const alias of param.allies) {
        await addState(
          "loadOfamusementParkIncreaseDamage",
          level > 2 ? 3 : 2,
          param.self,
          alias,
          {
            thisStateActuralValue: damageIncreasePercent,
            thisStateActuralValueUnit: "percent",
          },
          {
            battleInfo: param.battleInfo,
            callbacks: param.callbacks,
            addStateCallback: param.addStateCallback,
          }
        );

        if (level >= 5) {
          await addState(
            "loadOfamusementParkDecreaseDamage",
            level > 2 ? 3 : 2,
            param.self,
            alias,
            {
              thisStateActuralValue: damageIncreasePercent,
              thisStateActuralValueUnit: "percent",
            },
            {
              battleInfo: param.battleInfo,
              callbacks: param.callbacks,
              addStateCallback: param.addStateCallback,
            }
          );
        }
      }
    },
  },

  infusedGuardianCoreAmulet: {
    async onTurnStart({
      self,
      equipmentId,
      battleInfo,
      lossMpCallback,
      addStateCallback,
      callbacks,
    }) {
      let currentMp = self.mp;

      if (currentMp < 10) {
        return;
      }

      await lossMp(self, self, 10, {
        reason: MpLossReason.EQUIPMENT,
        battleInfo,
        callbacks,
        callback: lossMpCallback,
      });

      const intelligence = getUnitStatusInBattle(self, "intelligence", {
        battleInfo,
        callbacks: callbacks!,
      });
      let shieldValue = 10 + Math.floor(intelligence * 0.1);

      await addState(
        "infusedGuardianCoreAmuletShield",
        2,
        self,
        self,
        {
          thisStateActuralValue: shieldValue,
        },
        {
          battleInfo,
          callbacks,
          addStateCallback: addStateCallback,
        }
      );
    },
  },

  infusedShadowBlade: {
    onNeedModifyOriginDamage({
      self,
      damageType,
      oriDamage,
      battleInfo,
      callbacks,
    }) {
      if (damageType != DamageType.Magical) {
        return 0;
      }

      const intelligence = getUnitStatusInBattle(self, "intelligence", {
        battleInfo,
        callbacks: callbacks!,
      });
      return intelligence * 0.05;
    },
    async afterDealDamage({
      self,
      target,
      damageType,
      battleInfo,
      callbacks,
      dealDamageCallback,
      addStateCallback,
    }) {
      if (damageType != DamageType.Magical) {
        return;
      }

      await addState(
        "infusedShadowBladeHauntingDreams",
        3,
        self,
        target,
        {},
        {
          battleInfo,
          callbacks,
        }
      );
    },
  },

  shadowSteelSword: {
    async afterDealDamage({
      self,
      equipmentId,
      damageType,
      reducedDamage,
      healCallback,
      callbacks,
      battleInfo,
    }) {
      if (damageType != DamageType.Physical) {
        return;
      }

      if (battleInfo.currentTurnUnitUuid != self.uuid) {
        return;
      }

      if (reducedDamage > 0) {
        await healUnit(self, self, reducedDamage * 0.3, {
          reason: HpRestoreReason.EQUIPMENT_LIFE_STEAL,
          callbacks,
          battleInfo,
          triggerBy: {
            type: "equipment",
            id: equipmentId,
          },
          callback: healCallback,
        });
      }
    },
  },

  genesisEssenceShadowSteelSword: {
    async afterDealDamage({
      self,
      equipmentId,
      damageType,
      reducedDamage,
      healCallback,
      callbacks,
      battleInfo,
    }) {
      if (damageType != DamageType.Physical) {
        return;
      }

      if (battleInfo.currentTurnUnitUuid != self.uuid) {
        return;
      }

      if (reducedDamage <= 0) {
        return;
      }

      const heal = reducedDamage * 0.3;
      const actHeal = await healUnit(self, self, heal, {
        reason: HpRestoreReason.EQUIPMENT_LIFE_STEAL,
        callbacks,
        battleInfo,
        triggerBy: {
          type: "equipment",
          id: equipmentId,
        },
        callback: healCallback,
      });

      const overflowHealValue = Math.floor(heal - actHeal);

      if (overflowHealValue <= 0) {
        return;
      }

      // 确保存在追踪最大生命值提升的状态；首次触发时，将参考基线记录为“触发时的最大生命值”
      let thisState = self.state?.genesisEssenceShadowSteelSwordMaxHpState!;
      if (!hasState(self, "genesisEssenceShadowSteelSwordMaxHpState")) {
        await addState(
          "genesisEssenceShadowSteelSwordMaxHpState",
          1000,
          self,
          self,
          {},
          {
            battleInfo,
            callbacks,
          }
        );
        thisState = self.state?.genesisEssenceShadowSteelSwordMaxHpState!;
        // 用于参考的最大生命值：首次触发时的最大生命值
        writeStateExtraInfo(
          thisState,
          "genesisEssenceShadowSteelSwordMax",
          self.maxHp
        );
      }

      const level = getEquipmentLevel(equipmentId);
      const maxIncreaseCapPercentList = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      const maxIncreaseCapPercent =
        maxIncreaseCapPercentList[level] || maxIncreaseCapPercentList[0];

      const baseMaxHp = readStateExtraInfo<number>(
        thisState,
        "genesisEssenceShadowSteelSwordMax"
      );

      if (!baseMaxHp) {
        return;
      }

      const maxIncreaseCap = Math.floor(baseMaxHp * maxIncreaseCapPercent);

      // 当前已获得的最大生命值提升
      let currentMaxHpIncrease =
        readStateExtraInfo<number>(
          thisState,
          "genesisEssenceShadowSteelSwordMaxHpIncrease"
        ) || 0;

      // 早退：已达上限则不再执行后续逻辑
      if (currentMaxHpIncrease >= maxIncreaseCap) {
        thisState.extra!.readableDesc = {
          最大生命值提升: currentMaxHpIncrease + "/" + maxIncreaseCap,
        };
        return;
      }

      // 本次可转化的最大生命值提升
      const addIncrease = Math.floor(overflowHealValue * 0.5);
      if (addIncrease <= 0) {
        return;
      }

      const newIncrease = Math.min(
        currentMaxHpIncrease + addIncrease,
        maxIncreaseCap
      );
      const delta = newIncrease - currentMaxHpIncrease;

      // 若无增量，直接返回
      if (delta <= 0) {
        thisState.extra!.readableDesc = {
          最大生命值提升: currentMaxHpIncrease + "/" + maxIncreaseCap,
        };
        return;
      }

      // 增量式更新最大生命值与当前生命值
      self.maxHp += delta;
      self.hp += delta; // 直接加满对应增量

      writeStateExtraInfo(
        thisState,
        "genesisEssenceShadowSteelSwordMaxHpIncrease",
        newIncrease
      );
      thisState.extra!.readableDesc = {
        最大生命值提升: newIncrease + "/" + maxIncreaseCap,
      };
    },
  },

  manacrystalStaff: {
    async afterCastSkill({
      self,
      equipmentId,
      thisRoundInfo,
      battleInfo,
      callbacks,
    }) {
      if (!thisRoundInfo) {
        return;
      }

      let level = getEquipmentLevel(equipmentId);

      let damageToShieldPercent = 0.35 + level * 0.02;
      let healToShieldPercent = 0.35 + level * 0.02;

      let maxShieldPercent = [
        2.0, 2.0, 2.0, 2.0, 2.0, 2.1, 2.1, 2.1, 2.1, 2.2, 2.2,
      ];

      let shieldValue = 0;
      if (Object.keys(thisRoundInfo.damage ?? {}).length) {
        let totalDamage = 0;
        for (const damage of Object.values(thisRoundInfo.damage ?? {})) {
          totalDamage += damage.damage;
        }

        shieldValue = Math.floor(totalDamage * damageToShieldPercent);
      } else if (Object.keys(thisRoundInfo.heal ?? {}).length) {
        let totalHeal = 0;
        for (const heal of Object.values(thisRoundInfo.heal ?? {})) {
          totalHeal += heal;
        }

        shieldValue = Math.floor(totalHeal * healToShieldPercent);
      }

      const selfIntelligence = getUnitStatusInBattle(self, "intelligence", {
        battleInfo,
        callbacks: callbacks!,
      });
      shieldValue = Math.min(
        shieldValue,
        Math.floor(selfIntelligence * (maxShieldPercent[level] || 2.0))
      );

      if (!shieldValue) {
        return;
      }
      await addState(
        "manacrystalStaffShield",
        2,
        self,
        self,
        {
          thisStateActuralValue: shieldValue,
        },
        {
          battleInfo,
          callbacks,
          addStateCallback: callbacks.addStateCallback,
        }
      );
    },
  },

  fangNecklace: {
    async onBattleStart({
      self,
      equipmentId,
      addStateCallback,
      battleInfo,
      callbacks,
    }) {
      let level = getEquipmentLevel(equipmentId);
      const attacking = getUnitStatusInBattle(self, "attacking", {
        battleInfo,
        callbacks: callbacks!,
        ignoreTriggers: true,
      });
      let atkUpPercent = 0.1 + level * 0.01;

      await addState(
        "fangNecklaceAtkUp",
        3,
        self,
        self,
        {
          thisStateActuralValue: Math.floor(attacking * atkUpPercent),
        },
        {
          battleInfo,
          callbacks,
          addStateCallback,
        }
      );
    },
  },

  genesisEssenceFangNecklace: {
    async onBattleStart({
      self,
      equipmentId,
      addStateCallback,
      battleInfo,
      callbacks,
    }) {
      let level = getEquipmentLevel(equipmentId);
      const attacking = getUnitStatusInBattle(self, "attacking", {
        battleInfo,
        callbacks: callbacks!,
        ignoreTriggers: true,
      });
      let atkUpPercent = 0.16 + level * 0.01;

      await addState(
        "fangNecklaceAtkUp",
        3,
        self,
        self,
        {
          thisStateActuralValue: Math.floor(attacking * atkUpPercent),
        },
        {
          battleInfo,
          callbacks,
          addStateCallback,
        }
      );
    },
    onGetStatusModify({ self, equipmentId, oriGetStatusKey }) {
      if (oriGetStatusKey != 'attacking') {
        return 0;
      }

      const strToAtk = [0, 0.4, 0.45, 0.5, 0.55, 0.6];
      const equipmentLevel = getEquipmentLevel(equipmentId);

      let strToAtkPercent =
        strToAtk[equipmentLevel] || strToAtk[0];

      return oriGetStatusInBattle(self, 'strength') * strToAtkPercent;
    },
  },

  fishscaleMineralHat: {
    async onTurnStart({
      self,
      equipmentId,
      healCallback,
      callbacks,
      battleInfo,
    }) {
      let level = getEquipmentLevel(equipmentId);

      let baseHeal = 4;
      let basePercentHeal = 0.03;

      let finalPercentHeal = basePercentHeal + level * 0.005; // 每级增加1%

      let healValue =
        baseHeal + Math.floor((self.maxHp - self.hp) * finalPercentHeal);

      await healUnit(self, self, healValue, {
        callbacks,
        battleInfo,
        reason: HpRestoreReason.EQUIPMENT_EFFECT,
        callback: healCallback,
      });
    },
  },
  fishscaleMineralCoat: {
    async onBattleStart({
      self,
      enemies,
      equipmentId,
      healCallback,
      addStateCallback,
      callbacks,
      battleInfo,
    }) {
      let level = getEquipmentLevel(equipmentId);

      let baseHeal = 4;
      let basePercentHeal = 0.03;

      let finalPercentHeal = basePercentHeal + level * 0.005; // 每级增加1%

      let tauntCountList = [5, 5, 5, 5, 5, 6, 6, 6, 7, 7, 99999];

      let healValue =
        baseHeal + Math.floor((self.maxHp - self.hp) * finalPercentHeal);

      await healUnit(self, self, healValue, {
        callbacks,
        battleInfo,
        reason: HpRestoreReason.EQUIPMENT_EFFECT,
        callback: healCallback,
      });

      let tauntCount = tauntCountList[level] || tauntCountList[0];
      tauntCount = Math.min(tauntCount, enemies.length);
      let avaEnemies = enemies.filter((enemy) => !hasState(enemy, "taunt"));
      let selectedEnemies = getRandomUnitsInCollection(avaEnemies, tauntCount);

      const promiseList: Promise<any>[] = [];
      for (const enemy of selectedEnemies) {
        promiseList.push(
          addState(
            "taunt",
            2,
            self,
            enemy,
            {},
            {
              battleInfo,
              callbacks,
              addStateCallback,
            }
          )
        );
      }
      await Promise.all(promiseList);
    },
  },
  fishscaleMineralGloves: {
    async onTurnStart({
      self,
      equipmentId,
      healCallback,
      callbacks,
      battleInfo,
    }) {
      let level = getEquipmentLevel(equipmentId);

      let baseHeal = 4;
      let basePercentHeal = 0.03;

      let finalPercentHeal = basePercentHeal + level * 0.005; // 每级增加1%

      let healValue =
        baseHeal + Math.floor((self.maxHp - self.hp) * finalPercentHeal);

      await healUnit(self, self, healValue, {
        callbacks,
        battleInfo,
        reason: HpRestoreReason.EQUIPMENT_EFFECT,
        callback: healCallback,
      });
    },
  },
  fishscaleMineralPants: {
    async onTurnStart({
      self,
      equipmentId,
      healCallback,
      callbacks,
      battleInfo,
    }) {
      let level = getEquipmentLevel(equipmentId);

      let baseHeal = 4;
      let basePercentHeal = 0.03;

      let finalPercentHeal = basePercentHeal + level * 0.005; // 每级增加1%

      let healValue =
        baseHeal + Math.floor((self.maxHp - self.hp) * finalPercentHeal);

      await healUnit(self, self, healValue, {
        callbacks,
        battleInfo,
        reason: HpRestoreReason.EQUIPMENT_EFFECT,
        callback: healCallback,
      });
    },
  },

  cloudwalkerCloak: {
    async onBattleStart(param) {
      let level = getEquipmentLevel(param.equipmentId);

      let atkUpPercent = 0.18;
      atkUpPercent += level * 0.01; // 每级增加1%

      const selfDexterity = getUnitStatusInBattle(param.self, "dexterity", {
        battleInfo: param.battleInfo,
        callbacks: param.callbacks,
      });
      await addState(
        "litheFromCloudwalkerCloak",
        3,
        param.self,
        param.self,
        {
          thisStateActuralValue: Math.floor(selfDexterity * atkUpPercent),
        },
        {
          battleInfo: param.battleInfo,
          callbacks: param.callbacks,
          addStateCallback: param.addStateCallback,
        }
      );
    },
  },

  cloudwalkerBoots: {
    async onBattleStart(param) {
      let level = getEquipmentLevel(param.equipmentId);

      let atkUpPercent = 0.18;
      atkUpPercent += level * 0.01; // 每级增加1%

      const selfDexterity = getUnitStatusInBattle(param.self, "dexterity", {
        battleInfo: param.battleInfo,
        callbacks: param.callbacks,
      });
      await addState(
        "litheFromCloudwalkerBoots",
        3,
        param.self,
        param.self,
        {
          thisStateActuralValue: Math.floor(selfDexterity * atkUpPercent),
        },
        {
          battleInfo: param.battleInfo,
          callbacks: param.callbacks,
          addStateCallback: param.addStateCallback,
        }
      );
    },
  },

  phantomWalkerBoots: {
    async onBattleStart(param) {
      let level = getEquipmentLevel(param.equipmentId);

      let atkUpPercent = 0.24;
      atkUpPercent += level * 0.005; // 每级增加0.5%

      const selfDexterity = getUnitStatusInBattle(param.self, "dexterity", {
        battleInfo: param.battleInfo,
        callbacks: param.callbacks,
      });
      await addState(
        "litheFromPhantomWalkerBoots",
        3,
        param.self,
        param.self,
        {
          thisStateActuralValue: Math.floor(selfDexterity * atkUpPercent),
        },
        {
          battleInfo: param.battleInfo,
          callbacks: param.callbacks,
          addStateCallback: param.addStateCallback,
        }
      );
    },
    async beforeTakeDamage({
      self,
      equipmentId,
      reducedDamage,
      damageType,
      battleInfo,
      callbacks,
    }) {
      if (damageType != DamageType.Physical) {
        return reducedDamage;
      }

      const level = getEquipmentLevel(equipmentId);
      const damageReductionPercentList = [0.5, 0.47, 0.44, 0.41, 0.38, 0.35];

      const damageReductionPercent =
        damageReductionPercentList[level] || damageReductionPercentList[0];

      // 每点敏捷0.00125概率减免伤害
      const dexterity = getUnitStatusInBattle(self, "dexterity", {
        battleInfo,
        callbacks: callbacks!,
      });
      const reduceChance = dexterity * 0.00125;

      if (
        !(await checkRandomPercentAboutUnit(self, reduceChance, {
          battleInfo,
          callbacks: callbacks!,
        }))
      ) {
        return reducedDamage;
      }

      callbacks?.floatTextCallback?.({
        unit: self,
        text: "幽径之履-虚影",
      });

      const thisEffectReducedDamage =
        reducedDamage * (1 - damageReductionPercent);

      callbacks?.floatTextCallback?.({
        unit: self,
        text: `降低${Math.floor(
          thisEffectReducedDamage
        )}点伤害（${reducedDamage}*${Math.floor(
          (1 - damageReductionPercent) * 100
        )}%）`,
        hidePopover: true,
      });

      return reducedDamage * damageReductionPercent;
    },
  },

  steelHammer: {
    async onAfterSimpleAttack({
      self,
      enemies,
      battleInfo,
      thisRoundInfo,
      callbacks,
    }) {
      let targetUuid = thisRoundInfo?.targetUnitUuidList[0];
      let target = battleInfo.members.find((unit) => unit.uuid === targetUuid);

      if (!target || !targetUuid) {
        return;
      }

      let stunPercent = 0.3;

      const selfStrength = getUnitStatusInBattle(self, "strength", {
        battleInfo,
        callbacks,
      });
      const targetStrength = getUnitStatusInBattle(target, "strength", {
        battleInfo,
        callbacks,
      });

      if (selfStrength > targetStrength * 2) {
        stunPercent = 0.6;
      }

      if (
        await checkRandomPercentAboutUnit(self, stunPercent, {
          battleInfo,
          callbacks,
        })
      ) {
        // 触发概率成功，添加眩晕状态
        await addState(
          "stun",
          2,
          self,
          target,
          {},
          {
            battleInfo,
            callbacks,
            addStateCallback: callbacks.addStateCallback,
          }
        );
      }

      let targetOrder = battleInfo.turnOrder.findIndex((uuid) => {
        return uuid === targetUuid;
      });

      let enemyUuids = enemies.filter((e) => e.hp > 0).map((unit) => unit.uuid);
      let nextEnemyUuid = battleInfo.turnOrder.find((uuid, index) => {
        return index > targetOrder && enemyUuids.includes(uuid);
      });
      let nextEnemy = battleInfo.members.find(
        (unit) => unit.uuid === nextEnemyUuid
      );

      if (nextEnemy) {
        let thisAttackDamage = thisRoundInfo?.damage?.[targetUuid].damage;
        if (thisAttackDamage) {
          // 对下一个敌人施加效果
          await dealDamage(self, nextEnemy, thisAttackDamage, {
            damageType: DamageType.Physical,
            battleInfo,
            dealDamageCallback: callbacks.dealDamageCallback,
          });
        }
      }
    },
  },

  initiativeAmulet: {
    onBattleStart({ self, battleInfo }) {
      // 将自身的order移动到turnOrder最前
      if (!battleInfo.turnOrder.includes(self.uuid)) {
        return;
      }

      let currentTurnOrder = getUnitTurnOrder(battleInfo, self.uuid);
      moveUnitTurnOrder(battleInfo, self.uuid, currentTurnOrder - 2);
    },
  },
  stealthAmulet: {
    onBattleStart({ self, battleInfo }) {
      // 将自身的order移动到turnOrder最后
      if (!battleInfo.turnOrder.includes(self.uuid)) {
        return;
      }

      let currentTurnOrder = getUnitTurnOrder(battleInfo, self.uuid);
      moveUnitTurnOrder(battleInfo, self.uuid, currentTurnOrder + 3);
    },
  },

  emberAegis: {
    async afterDealDamage({
      self,
      target,
      equipmentId,
      causeBy,
      battleInfo,
      callbacks,
    }) {
      if ((self.state?.emberAegisCooldown?.remainingDuration ?? 0) > 0) {
        return;
      }

      if (causeBy.skillId == "baseAttack") {
        return;
      }

      let level = getEquipmentLevel(equipmentId);

      let chance = 0.1 + level * 0.2; // 基础10% + 每级10%

      if (
        await checkRandomPercentAboutUnit(self, chance, {
          battleInfo,
          callbacks,
        })
      ) {
        // 触发概率成功，添加火焰状态
        await addState(
          "burn",
          2,
          self,
          target,
          {},
          {
            battleInfo,
            callbacks,
          }
        );
      }
    },
    async afterTakeDamage({
      self,
      equipmentId,
      callbacks,
      battleInfo,
      healCallback,
      addStateCallback,
    }) {
      return;
      if ((self.state?.emberAegisCooldown?.remainingDuration ?? 0) > 0) {
        return;
      }

      let level = getEquipmentLevel(equipmentId);

      let triggerPercent = 0.3 + level * 0.02; // 基础30% + 每级1%

      if (self.hp > self.maxHp * triggerPercent) {
        return;
      }

      let baseHeal = 10 + level * 2; // 基础10 + 每级2
      let basePercentHeal = 0.2 + level * 0.01; // 基础20% + 每级1%

      let cooldown = 35 - level;

      let healValue = baseHeal + Math.floor(self.maxHp * basePercentHeal);

      await healUnit(self, self, healValue, {
        callbacks,
        battleInfo,
        reason: HpRestoreReason.EQUIPMENT_EFFECT,
        callback: healCallback,
      });

      await addState(
        "emberAegisCooldown",
        cooldown,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
          addStateCallback,
        }
      );
    },
  },

  catPotionSilverBracelet: {
    onTurnStart({ self, battleInfo, equipmentId, callbacks }) {
      if (self?.triggerMark?.oncePreBattle?.catPotionSilverBracelet) {
        return;
      }

      if (!self.state) {
        return;
      }

      // 检查是否有负面状态
      const hasDebuff = ObjectKeys<AllBattleStateId>(self.state).some(
        (stateId) => {
          const state = self.state?.[stateId];
          return (
            state &&
            allBattleState[stateId]?.isDebuff &&
            state.remainingDuration > 0
          );
        }
      );

      if (!hasDebuff) {
        return; // 没有负面状态则不触发
      }

      let level = getEquipmentLevel(equipmentId);

      // 1、2级移除1个负面效果，3、4级移除2个负面效果，5级移除3个负面效果
      let removeCount = (() => {
        if (level <= 1) return 1;
        if (level <= 3) return 2;
        return 3;
      })();

      for (const stateId of ObjectKeys<AllBattleStateId>(self.state ?? {})) {
        const state = self.state[stateId];

        if (!state) {
          continue;
        }

        if (allBattleState[stateId]?.isDebuff && state.remainingDuration > 0) {
          detachState(stateId, self, battleInfo, {
            callbacks,
          });

          removeCount--;
          // 如果已经移除足够数量的负面效果，则退出循环
          if (removeCount <= 0) break;
        }
      }

      // 初始化 triggerMark 和 oncePreBattle
      if (!self.triggerMark) self.triggerMark = {};
      if (!self.triggerMark.oncePreBattle) self.triggerMark.oncePreBattle = {};
      self.triggerMark.oncePreBattle.catPotionSilverBracelet = true;
    },
  },

  venomDagger: {
    async onAfterSimpleAttack({
      self,
      battleInfo,
      thisRoundInfo,
      callbacks,
      addStateCallback,
    }) {
      if (!thisRoundInfo) return;
      const targets = thisRoundInfo.targetUnitUuidList.map((uuid) =>
        battleInfo.members.find((unit) => unit.uuid === uuid)
      );
      if (!targets) return;
      for (const target of targets) {
        if (target)
          await addState(
            "venom",
            3,
            self,
            target,
            {},
            {
              battleInfo,
              callbacks,
              addStateCallback,
            }
          );
      }
    },
  },

  forestDagger: {
    async onAfterSimpleAttack({
      equipmentId,
      self,
      battleInfo,
      callbacks,
      thisRoundInfo,
      addStateCallback,
    }) {
      if (!thisRoundInfo) return;

      let level = getEquipmentLevel(equipmentId);
      const targets = thisRoundInfo.targetUnitUuidList.map((uuid) =>
        battleInfo.members.find((unit) => unit.uuid === uuid)
      );
      if (!targets) return;
      for (const target of targets) {
        if (target) {
          let chance = 0.3 + (level || 1) * 0.03; // 基础30% + 每级3%

          if (
            await checkRandomPercentAboutUnit(self, chance, {
              battleInfo,
              callbacks,
            })
          ) {
            await addState(
              "frozen",
              2,
              self,
              target,
              {},
              {
                battleInfo,
                callbacks,
                addStateCallback,
              }
            );
          }
        }
      }
    },
  },

  batShadownCape: {
    async onBattleStart(param) {
      await addState(
        "sneak",
        2,
        param.self,
        param.self,
        {},
        {
          battleInfo: param.battleInfo,
          callbacks: param.callbacks,
          addStateCallback: param.addStateCallback,
        }
      );
    },

    async afterTakeDamage({
      self,
      damageSource,
      battleInfo,
      callbacks,
      addStateCallback,
    }) {
      return;
      if (!hasState(self, "sneak")) {
        await addState(
          "sneak",
          1,
          self,
          self,
          {},
          {
            battleInfo,
            callbacks,
            addStateCallback,
          }
        );
      }
      if (damageSource) {
        await addState(
          "batCurse",
          2,
          self,
          damageSource,
          {},
          {
            battleInfo: battleInfo,
            callbacks: callbacks,
            addStateCallback,
          }
        );
      }
    },
  },

  frostCrown: {
    async afterDealDamage({
      self,
      target,
      equipmentId,
      battleInfo,
      callbacks,
    }) {
      let level = getEquipmentLevel(equipmentId);

      let chance = (level - 1) * 0.02; // 基础10% + 每级10%
      if (level >= 1) {
        chance += 0.2;
      }

      if (
        await checkRandomPercentAboutUnit(self, chance, {
          battleInfo,
          callbacks,
        })
      ) {
        // 触发概率成功，添加火焰状态
        await addState(
          "frozen",
          2,
          self,
          target,
          {},
          {
            battleInfo,
            callbacks,
          }
        );
      }
    },

    async afterTakeDamage({
      self,
      damageSource,
      equipmentId,
      battleInfo,
      callbacks,
      addStateCallback,
    }) {
      let level = getEquipmentLevel(equipmentId);

      if (level < 5 || !damageSource) {
        return;
      }

      if (
        await checkRandomPercentAboutUnit(self, 0.28, { battleInfo, callbacks })
      ) {
        // 触发概率成功，添加火焰状态
        await addState(
          "frozen",
          2,
          self,
          damageSource,
          {},
          {
            battleInfo,
            callbacks,
            addStateCallback,
          }
        );
      }
    },
  },

  shadowBlade: {
    async afterDealDamage({
      self,
      target,
      allTargets,
      causeBy,
      battleInfo,
      callbacks,
    }) {
      if (!hasState(self, "sneak")) {
        return;
      }

      if (causeBy?.skillId == "baseAttack") {
        await addState(
          "fluster",
          2,
          self,
          target,
          {},
          {
            battleInfo,
            callbacks,
          }
        );
        return;
      }

      if (allTargets?.length == 1) {
        await addState(
          "shadowStrike",
          2,
          self,
          target,
          {},
          {
            battleInfo,
            callbacks,
          }
        );
        await addState(
          "sneak",
          2,
          self,
          self,
          {},
          {
            battleInfo,
            callbacks,
          }
        );
      }
    },
  },

  mewShadowStaff: {
    onBattleStart(param) {
      const baseUnit = generateEnemyById("shadow_mew_cat");

      if (!baseUnit) {
        return;
      }

      let level = getEquipmentLevel(param.equipmentId);

      baseUnit.level = level || 1;
      baseUnit.maxHp += baseUnit.level * 10;
      baseUnit.hp += baseUnit.level * 10;
      // baseUnit.attack += baseUnit.level * 5;
      baseUnit.status.attacking.level += baseUnit.level * 5;

      baseUnit.name = param.self.name + "的喵影";

      summonUnit(param.battleInfo, param.self, baseUnit, 5);
    },
  },

  silkMageBurqa: {
    async onBattleStart(param) {
      let level = getEquipmentLevel(param.equipmentId);
      let valMap = [8, 9, 10, 12, 14, 16];

      await addState(
        "silkMageBurqaBuff",
        2,
        param.self,
        param.self,
        {
          thisStateActuralValue: valMap[level] || 8,
        },
        {
          battleInfo: param.battleInfo,
          callbacks: param.callbacks,
          addStateCallback: param.addStateCallback,
        }
      );
    },
  },

  silkTightsCloth: {
    async onBattleStart(param) {
      let level = getEquipmentLevel(param.equipmentId);

      let valMap = [8, 9, 10, 12, 14, 16];

      await addState(
        "silkTightsClothBuff",
        2,
        param.self,
        param.self,
        {
          thisStateActuralValue: valMap[level] || 8,
        },
        {
          battleInfo: param.battleInfo,
          callbacks: param.callbacks,
          addStateCallback: param.addStateCallback,
        }
      );
    },
  },

  moonlightGuardianCoreAmulet: {
    async onBattleStart({ self, addStateCallback, battleInfo, callbacks }) {
      const intelligence = getUnitStatusInBattle(self, "intelligence", {
        battleInfo,
        callbacks: callbacks!,
      });
      const shieldValue = Math.floor(25 + intelligence * 0.25);

      await addState(
        "shield",
        3,
        self,
        self,
        {
          thisStateActuralValue: shieldValue,
        },
        {
          battleInfo,
          callbacks,
          addStateCallback: addStateCallback,
        }
      );
    },
  },

  twilightFeatherCloak: {
    async onBattleStart({ self, battleInfo, callbacks }) {
      await addState(
        "twilightFeatherCloakState",
        4,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
        }
      );
    },
    async afterOtherUnitCastSkill({ self, battleInfo, callbacks }) {
      await healUnit(self, self, 5, {
        reason: HpRestoreReason.EQUIPMENT_EFFECT,
        triggerBy: {
          type: "equipment",
          id: "twilightFeatherCloak",
        },
        battleInfo,
        callbacks,
      });
      restoreMp(self, self, 1, {
        reason: MpRestoreReason.EQUIPMENT_EFFECT,
        callback: callbacks.restoreMpCallback,
      });
    },
  },
  spiritfeatherBow: {
    async afterOtherUnitLossMp({
      self,
      value,
      target,
      equipmentId,
      battleInfo,
      callbacks,
    }) {
      const percentList = [0.55, 0.57, 0.59, 0.61, 0.63, 0.65];
      const equipmentLevel = getEquipmentLevel(equipmentId);
      let percent = percentList[equipmentLevel] || percentList[0];

      // if (value >= 25) {
      //   percent += 0.1;
      // }

      if (!self.uuid || !target.uuid) {
        return;
      }
      if (isAlly(self.uuid, target.uuid, battleInfo)) {
        return;
      }

      const r = await checkRandomPercentAboutUnit(self, percent, {
        battleInfo,
        callbacks,
      });

      const bowExpertSkillNode = findSkillNodeInfo(
        self.skillTreeNodes,
        "b_dexterity_bow_expert"
      );
      if (bowExpertSkillNode?.level ?? 0 > 0) {
        percent = 1;
      }

      if (!r) {
        return;
      }

      let remainingCount = getEachSelfTurnTriggerMark<number>(
        self,
        "spiritfeatherBowRemainingCount",
        0
      );

      if (!remainingCount) {
        return;
      }

      const ignoreDefencePercent = 30;

      let info = getInfoFromBattleInfo(self, battleInfo);
      if (!info) {
        return;
      }

      callbacks.floatTextCallback?.({
        unit: self,
        text: "灵羽射击",
      });

      const intelligence = getUnitStatusInBattle(self, "intelligence", {
        battleInfo,
        callbacks: callbacks!,
      });

      await castSkill(
        self,
        "baseAttack",
        {
          battleInfo,
          allies: info.allyUnits,
          enemies: info.enemyUnits,
          allAllies: info.allAllyUnit,
          allEnemies: info.allEnemies,
          callbacks,
          ...callbacks,
        },
        {
          damageParam: {
            ignoreDefencePercent,
            damageType: DamageType.Magical,
            extraDamage: Math.floor(intelligence),
          },
          specificTarget: [target],
          hideSkillCastText: true,
        }
      );

      remainingCount = Math.max(0, remainingCount - 1);
      setEachSelfTurnTriggerMark(
        self,
        "spiritfeatherBowRemainingCount",
        remainingCount
      );
    },

    onBattleStart({ self }) {
      let arrowCount = 6;
      const bowExpertSkillNode = findSkillNodeInfo(
        self.skillTreeNodes,
        "b_dexterity_bow_expert"
      );

      if (bowExpertSkillNode) {
        arrowCount += 5 * bowExpertSkillNode.level;
      }

      setEachSelfTurnTriggerMark(
        self,
        "spiritfeatherBowRemainingCount",
        arrowCount
      );
    },
    onTurnEnd({ self }) {
      let arrowCount = 6;
      const bowExpertSkillNode = findSkillNodeInfo(
        self.skillTreeNodes,
        "b_dexterity_bow_expert"
      );

      if (bowExpertSkillNode) {
        arrowCount += 5 * bowExpertSkillNode.level;
      }

      setEachSelfTurnTriggerMark(
        self,
        "spiritfeatherBowRemainingCount",
        arrowCount
      );
    },
  },
  traitorsChains: {
    onNeedModifyOriginDamage({ self, battleInfo, oriDamage }) {
      const info = getInfoFromBattleInfo(self, battleInfo);

      const deadAlliesCount =
        info?.allyUnits.filter(
          (u) => u.hp <= 0 && (u.isPlayerUnit || u.isPlayer)
        ).length || 0;

      return oriDamage * deadAlliesCount * 0.08;
    },
    calcBattleWinRewardExtraDropRate({ self, battleInfo }) {
      const info = getInfoFromBattleInfo(self, battleInfo);

      const deadAlliesCount =
        info?.allyUnits.filter(
          (u) => u.hp <= 0 && (u.isPlayerUnit || u.isPlayer)
        ).length || 0;

      return deadAlliesCount * 0.01;
    },
  },
  clawFallenRadiance: {
    onNeedModifyOriginDamage({ self, oriDamage, equipmentId, damageType }) {
      if (damageType != DamageType.Physical) {
        return 0;
      }

      const equipmentLevel = getEquipmentLevel(equipmentId);

      const baseIncreasePercentList = [0.05, 0.055, 0.06, 0.065, 0.07, 0.08];
      const baseIncreasePercent =
        baseIncreasePercentList[equipmentLevel] || baseIncreasePercentList[0];

      // 自身每拥有一个负面效果，造成的物理伤害提升8%
      const debuffCount = ObjectKeys<AllBattleStateId>(self.state ?? {}).filter(
        (stateId) => {
          const state = self.state?.[stateId];
          return (
            state &&
            allBattleState[stateId]?.isDebuff &&
            state.remainingDuration > 0
          );
        }
      ).length;

      return oriDamage * debuffCount * baseIncreasePercent;
    },
  },
  clawVowedRadiance: {
    onNeedModifyOriginDamage({ self, oriDamage, equipmentId, damageType }) {
      if (damageType != DamageType.Physical) {
        return 0;
      }
      const equipmentLevel = getEquipmentLevel(equipmentId);
      // 0.007~0.01
      const baseIncreasePercentList = [
        0.007, 0.0075, 0.008, 0.0085, 0.009, 0.01,
      ];
      const baseIncreasePercent =
        baseIncreasePercentList[equipmentLevel] || baseIncreasePercentList[0];

      // 自身每拥有一个正面效果，造成的物理伤害提升0.5%
      const debuffCount = ObjectKeys<AllBattleStateId>(self.state ?? {}).filter(
        (stateId) => {
          const state = self.state?.[stateId];
          return (
            state &&
            allBattleState[stateId]?.isBuff &&
            state.remainingDuration > 0
          );
        }
      ).length;

      return oriDamage * debuffCount * baseIncreasePercent;
    },
  },
  overloadCrown: {
    async onBattleStart({ equipmentId, allies, self, battleInfo, callbacks }) {
      let level = getEquipmentLevel(equipmentId);

      if (level < 2) {
        return;
      }

      const otherUnitHasOverloadCrownList: BaseBattleUnit[] = [];
      for (const ally of allies) {
        if (ally.uuid == self.uuid) {
          continue;
        }

        if (hasEquipment(ally, "overloadCrown")) {
          otherUnitHasOverloadCrownList.push(ally);
        }
      }

      // 移除自身的状态
      // 移除其他单位的状态
      for (const unit of battleInfo.members) {
        detachState("overloadCrownIncreaseAttack", unit, battleInfo, {
          callbacks,
        });
        detachState("overloadCrownDecreaseAttack", unit, battleInfo, {
          callbacks,
        });
      }

      if (otherUnitHasOverloadCrownList.length > 0) {
        // if (level >= 4) {
        //   callbacks?.floatTextCallback?.({
        //     unit: self,
        //     text: '唯一统治!',
        //   })
        //   await await  dealAoeDamage(self, otherUnitHasOverloadCrownList, () => {
        //     return self.status.attacking.level
        //   }, {
        //     damageType: DamageType.Physical,
        //     callbacks,
        //     battleInfo,
        //   })
        // }
        return;
      }

      const reduceAttackPercentList = [0, 0, 0.1, 0.1, 0.1, 0.15];
      const absorbAttackPercentList = [0, 0, 0.6, 0.8, 0.8, 1];
      const maxAttackPercentList = [0, 0, 1, 1, 1.5, 2];

      const reduceAttackPercent = reduceAttackPercentList[level] || 0;
      const absorbAttackPercent = absorbAttackPercentList[level] || 0;
      const maxAttackPercent = maxAttackPercentList[level] || 0;

      if (
        reduceAttackPercent <= 0 ||
        absorbAttackPercent <= 0 ||
        maxAttackPercent <= 0
      ) {
        return;
      }

      let collection = level >= 4 ? battleInfo.members : allies;
      collection = collection.filter((u) => {
        if (u.uuid == self.uuid) {
          return false;
        }

        if (u.hp <= 0) {
          return false;
        }

        if (u.isSummoned) {
          return false;
        }

        return true;
      });

      let totalReduceAttack = 0;
      for (const unit of collection) {
        const reduceAttack = Math.floor(
          unit.baseStatus.attacking.level * reduceAttackPercent
        );

        if (reduceAttack <= 0) {
          continue;
        }

        totalReduceAttack += reduceAttack;

        await addState(
          "overloadCrownDecreaseAttack",
          3,
          self,
          unit,
          {
            thisStateActuralValue: reduceAttack,
          },
          {
            battleInfo,
            callbacks,
          }
        );
      }

      const baseAttacking = getUnitStatusInBattle(self, "attacking", {
        battleInfo,
        callbacks: callbacks!,
        onlyBaseStatus: true,
        ignoreTriggers: true,
      });
      const increaseAttack = Math.min(
        Math.floor(baseAttacking * maxAttackPercent),
        Math.floor(totalReduceAttack * absorbAttackPercent)
      );

      if (increaseAttack <= 0) {
        return;
      }

      await addState(
        "overloadCrownIncreaseAttack",
        3,
        self,
        self,
        {
          thisStateActuralValue: increaseAttack,
        },
        {
          battleInfo,
          callbacks,
        }
      );
    },
  },
  domination_seal: {
    beforeOtherUnitCastSkill({
      source,
      self,
      skillId,
      battleInfo,
      callbacks,
      equipmentId,
    }) {
      let sealedSkills: AllBattleSkillId[] =
        self.skills.dominationSealSkill?.extra?.dominationSealSkills ?? [];

      // sealedSkills 只取第一个值
      sealedSkills = sealedSkills.slice(0, 1);

      if (sealedSkills.length <= 0) {
        return {};
      }

      if (source.uuid == self.uuid) {
        return {};
      }

      if (!sealedSkills.includes(skillId)) {
        return {};
      }

      const equipmentLevel = getEquipmentLevel(equipmentId);
      if (equipmentLevel >= 5 && isAlly(source.uuid, self.uuid, battleInfo)) {
        return {};
      }

      // 需要扣除自身10%的最大生命值与魔法值，如果不够，不触发效果
      const selfMaxHp = self.maxHp;
      const selfMaxMp = self.maxMp;

      const needHp = Math.floor(selfMaxHp * 0.15);
      const needMp = Math.floor(selfMaxMp * 0.15);

      if (self.hp <= needHp || self.mp < needMp) {
        return {};
      }

      // 扣除生命值与魔法值
      self.hp = Math.max(1, self.hp - needHp);
      self.mp = Math.max(0, self.mp - needMp);

      callbacks?.floatTextCallback?.({
        unit: self,
        text: "统御",
      });

      callbacks.drawLineCallback({
        source: self,
        target: source,
        color: "purple",
      });

      return {
        cancelCast: true,
        cancelReason: `技能 ${allGameBattleSkills[skillId].name} 被 ${self.name} 的统御印记封印`,
      };
    },
    beforeTakeDamage({
      self,
      source,
      reducedDamage,
      battleInfo,
      callbacks,
      equipmentId,
    }) {
      if (battleInfo.currentTurnUnitUuid == source.uuid) {
        return reducedDamage;
      }

      const equipmentLevel = getEquipmentLevel(equipmentId);
      if (equipmentLevel < 1) {
        return reducedDamage;
      }

      // 以双方“主属性”比较，主属性每高对方1%，最终伤害降低4%，最多降低90%
      const mainStatusInfo = getMainStatusInfo(self);
      const status = mainStatusInfo.status;

      const selfMainStatus = Math.max(
        0,
        Number(self.status[status].level ?? 0)
      );
      const sourceMainStatus = Math.max(
        0,
        Number(source.status[status].level ?? 0)
      );

      // 若我方不高于对方，则不减伤
      if (selfMainStatus <= sourceMainStatus) {
        return reducedDamage;
      }

      // 百分比差：我方主属性比来源高多少百分比
      // 例1：200 vs 100 => 高100% => 100 * 4% = 400% => 上限90%
      // 例2：40 vs 10  => 高300% => 300 * 4% = 1200% => 上限90%

      const reducePercentList = [0, 1, 1.5, 2, 2.5, 3]; // 每1%对应的减伤百分比
      const reducePercent =
        reducePercentList[equipmentLevel] || reducePercentList[0];

      const percentHigher =
        (selfMainStatus - sourceMainStatus) / sourceMainStatus; // 1.0 = 高100%
      const rawReducePercent = percentHigher * reducePercent;
      // const finalReducePercent = Math.min(90, Math.max(0, rawReducePercent));

      let finalReducePercent = 0;
      if (sourceMainStatus <= 0) {
        // 来源主属性为0而己方更高：直接按上限处理
        finalReducePercent = 90;
      } else {
        const percentHigherPct =
          ((selfMainStatus - sourceMainStatus) * 100) / sourceMainStatus; // 百分点
        finalReducePercent = Math.min(
          90,
          Math.max(0, percentHigherPct * reducePercent)
        );
      }

      callbacks?.floatTextCallback({
        unit: self,
        text: `统御印记-禁区`,
      });

      callbacks?.floatTextCallback({
        unit: self,
        text: `禁区: 伤害降低${finalReducePercent}%（${selfMainStatus} vs ${sourceMainStatus}）`,
        hidePopover: true,
      });

      let final = Math.floor(reducedDamage * (1 - finalReducePercent / 100));

      if (final < 1) {
        final = 1;
      }

      return final;
    },
  },
  eternalGuardianAmulet: {
    async onBattleStart({ self, addStateCallback, battleInfo, callbacks }) {
      if (hasState(self, "eternalGuardianAmuletCooldown")) {
        return;
      }

      let currentMp = self.mp;

      let reduceMp = Math.floor(self.maxMp * 0.05);

      if (currentMp < reduceMp) {
        return;
      }

      await lossMp(self, self, reduceMp, {
        reason: MpLossReason.EQUIPMENT,
        battleInfo,
        callbacks,
        callback: callbacks.lossMpCallback,
      });

      let shieldValue = Math.floor(self.maxHp * 0.05);

      shieldValue = Math.max(shieldValue, 50);

      await addState(
        "eternalGuardianAmuletShield",
        2,
        self,
        self,
        {
          thisStateActuralValue: shieldValue,
        },
        {
          callbacks,
          battleInfo,
          addStateCallback: addStateCallback,
        }
      );
    },
    onNeedModifyOriginDamage({ self, battleInfo, oriDamage }) {
      if (hasState(self, "eternalGuardianAmuletCooldown")) {
        return oriDamage;
      }

      return Math.floor(oriDamage * 0.05);
    },
    async beforeTakeDamage({
      reducedDamage,
      self,
      equipmentId,
      battleInfo,
      callbacks,
    }) {
      if (hasState(self, "eternalGuardianAmuletCooldown")) {
        return reducedDamage;
      }

      if (hasEquipment(self, "eternalGuardianAmulet")) {
        return reducedDamage;
      }

      if (hasEquipment(self, "otherworldCrystalPendant")) {
        return reducedDamage;
      }

      if (!battleInfo.turnOrder.includes(self.uuid)) {
        return reducedDamage;
      }

      if (reducedDamage < self.hp) {
        return Math.floor(reducedDamage * 0.9);
      }

      let level = getEquipmentLevel(equipmentId);

      const lossedHp = self.maxHp - self.hp;

      const regenHp = Math.floor(lossedHp * 0.5);

      await healUnit(self, self, regenHp, {
        reason: HpRestoreReason.EQUIPMENT_EFFECT,
        triggerBy: {
          type: "equipment",
          id: "eternalGuardianAmulet",
        },
        callbacks: callbacks!,
        battleInfo,
      });

      await addState(
        "eternalGuardianAmuletState",
        1,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
        }
      );

      await addState(
        "eternalGuardianAmuletCooldown",
        50,
        self,
        self,
        {},
        {
          callbacks,
          battleInfo,
        }
      );

      return 0;
    },
  },
  // shinyIronSword: {
  //   onDamageSourceNeedModifyDefenceIgnorePercent({equipmentId, damageType}) {
  //     if (damageType != DamageType.Physical) {
  //       return 0;
  //     }

  //     let level = getEquipmentLevel(equipmentId);

  //     let ignorePercent = 15 + level * 0.5;

  //     if (level == 50) {
  //       ignorePercent = 50;
  //     }

  //     return ignorePercent;
  //   }
  // },
  hexstring_bowstring_bow: {
    async afterEachOtherUnitAction({
      callbacks,
      equipmentId,
      self,
      currentTurnUnit,
      battleInfo,
    }) {
      if (!currentTurnUnit) {
        return;
      }

      if (self.uuid === currentTurnUnit.uuid) {
        return;
      }

      if (!isEnemy(self.uuid, currentTurnUnit.uuid, battleInfo)) {
        return;
      }

      if (!isUnitSelectable(currentTurnUnit)) {
        return;
      }

      let extraDefenceIgnoreList = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40];
      let level = getEquipmentLevel(equipmentId);
      let ignoreDefencePercent = extraDefenceIgnoreList[level] || 30;

      if (self.mp < 25) {
        return;
      }

      let info = getInfoFromBattleInfo(self, battleInfo);
      if (!info) {
        return;
      }

      // await delay(100);

      await lossMp(self, self, 25, {
        reason: MpLossReason.EQUIPMENT,
        battleInfo,
        callbacks,
      });

      callbacks.floatTextCallback?.({
        unit: self,
        text: "咒力射击",
      });

      await addState(
        "hexstringBowState",
        2,
        self,
        currentTurnUnit,
        {},
        {
          battleInfo,
          callbacks,
        }
      );

      const selfIntelligence = getUnitStatusInBattle(self, "intelligence", {
        battleInfo,
        callbacks,
      });
      const selfDexterity = getUnitStatusInBattle(self, "dexterity", {
        battleInfo,
        callbacks,
      });

      await castSkill(
        self,
        "baseAttack",
        {
          battleInfo,
          allies: info.allyUnits,
          enemies: info.enemyUnits,
          allAllies: info.allAllyUnit,
          allEnemies: info.allEnemies,
          callbacks,
          ...callbacks,
        },
        {
          damageParam: {
            ignoreDefencePercent,
            damageType: DamageType.Magical,
            extraDamage: Math.floor(
              selfIntelligence * 0.6 + selfDexterity * 0.6
            ),
          },
          specificTarget: [currentTurnUnit],
          hideSkillCastText: true,
        }
      );
    },
  },
  onyx_shield: {
    beforeTakeDamage({
      self,
      reducedDamage,
      equipmentId,
      damageType,
      callbacks,
    }) {
      if (damageType != DamageType.Physical) {
        return reducedDamage;
      }

      const maxDamageToMaxHpList = [0.3, 0.28, 0.26, 0.24, 0.22, 0.2];
      const level = getEquipmentLevel(equipmentId);
      const maxDamageToMaxHpPercent =
        maxDamageToMaxHpList[level] || maxDamageToMaxHpList[0];

      const maxDamage = Math.ceil(self.maxHp * maxDamageToMaxHpPercent);

      callbacks?.floatTextCallback?.({
        unit: self,
        text: `玄壁`,
      });

      return Math.min(reducedDamage, maxDamage);
    },
  },

  dragonScaleArmor: {
    onNeedModifyOriginDamage({ self, oriDamage, equipmentId, damageType }) {
      const magicalDamageReducePercentList = [0, 0.1, 0.13, 0.16, 0.19, 0.22];
      const level = getEquipmentLevel(equipmentId);
      const magicalDamageReducePercent =
        magicalDamageReducePercentList[level] ??
        magicalDamageReducePercentList[0];

      if (damageType == DamageType.Magical) {
        return oriDamage * (1 - magicalDamageReducePercent);
      }

      return oriDamage;
    },
  },
  dragonScaleGenesisEssencArmor: {
    onNeedModifyOriginDamage({ oriDamage, damageType }) {
      if (damageType == DamageType.Magical) {
        return oriDamage * 0.75;
      }

      return oriDamage;
    },
    async onBattleStart({ self, battleInfo, callbacks, equipmentId }) {
      const skillList = [
        "dragonRoar",
        "roar",
        "apocalypticRoar",
        "beastpackRoar",
      ];

      const selfHasRoarLikeSkillList = ObjectKeysTyped(self.skills).filter(
        (skillId) => {
          if (!skillList.includes(skillId)) {
            return false;
          }

          if (!!self.skillColddown?.[skillId]) {
            return false;
          }

          return true;
        }
      );

      if (!selfHasRoarLikeSkillList.length) {
        return;
      }

      const info = getBaseInfoFromBattleInfo(self, battleInfo);

      if (!info) {
        return;
      }

      const randomRoarLikeSkillId = randomElementInCollection(
        selfHasRoarLikeSkillList
      )!;
      const randomSkillName = allGameBattleSkills[randomRoarLikeSkillId].name;

      const skillDamageReducePercentList = [-0.3, -0.2, -0.1, 0, 0.1, 0.2];
      const level = getEquipmentLevel(equipmentId);
      const skillDamageReducePercent =
        skillDamageReducePercentList[level] ?? skillDamageReducePercentList[0];

      callbacks.floatTextCallback?.({
        unit: self,
        text: "龙之咆哮-" + randomSkillName,
      });

      await castSkill(
        self,
        randomRoarLikeSkillId,
        {
          battleInfo,
          callbacks,
          ...info,
        },
        {
          hideSkillCastText: true,
          ignoreMpCost: true,
          ignoreCastColddown: true,
          damageModifyPercent: skillDamageReducePercent,
        }
      );
    },
  },
  lumenCodex: {
    async afterApplyStateToUnit({
      applier,
      target,
      self,
      equipmentId,
      stateId,
      duration,
      battleInfo,
      callbacks,
    }) {
      if (!allBattleState[stateId]?.isBuff) {
        return;
      }

      if (applier?.uuid == target.uuid) {
        return;
      }

      if (!battleInfo) {
        return;
      }

      if (!isAlly(self.uuid, target.uuid, battleInfo)) {
        return;
      }

      const info = getBaseInfoFromBattleInfo(self, battleInfo);
      if (!info) {
        return;
      }

      if (!info?.allEnemies.some((e) => e.hp > 0)) {
        return;
      }

      if (hasState(self, "lumenCodexLock")) {
        return;
      }

      await addState(
        "lumenCodexLock",
        1,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
        }
      );

      const baseIntelligenceDamagePercent = 0.6;
      const extraIntelligenceDamagePercentList = [
        0.3, 0.33, 0.36, 0.39, 0.42, 0.45,
      ];
      const damageEnemyCountList = [1, 1, 1, 2, 2, 3];
      const level = getEquipmentLevel(equipmentId);
      const damageEnemyCount =
        damageEnemyCountList[level] || damageEnemyCountList[0];

      const extraIntelligenceDamagePercent =
        extraIntelligenceDamagePercentList[level] ||
        extraIntelligenceDamagePercentList[0];
      const totalIntelligenceDamagePercent =
        baseIntelligenceDamagePercent +
        extraIntelligenceDamagePercent * duration;

      const enemies = info?.enemies;

      const targets = getRandomUnitsInCollection(enemies, damageEnemyCount);

      callbacks?.floatTextCallback?.({
        unit: self,
        text: `光明法典-祝福回响`,
      });

      const intelligence = getUnitStatusInBattle(self, "intelligence", {
        battleInfo,
        callbacks: callbacks!,
      });
      await dealAoeDamage(
        self,
        targets,
        () => {
          return Math.floor(intelligence * totalIntelligenceDamagePercent);
        },
        {
          damageType: DamageType.Magical,
          causeBy: {
            type: DealDamageCauseByType.Equipment,
            equipmentId: equipmentId,
          },
          battleInfo,
          callbacks: callbacks!,
        }
      );

      detachState("lumenCodexLock", self, battleInfo, {
        callbacks: callbacks!,
      });
    },
  },
  umbralCodex: {
    async afterApplyStateToUnit({
      applier,
      target,
      self,
      equipmentId,
      stateId,
      duration,
      battleInfo,
      callbacks,
    }) {
      if (!allBattleState[stateId]?.isDebuff) {
        return;
      }

      if (!battleInfo) {
        return;
      }

      if (!isEnemy(self.uuid, target.uuid, battleInfo)) {
        return;
      }

      const info = getBaseInfoFromBattleInfo(self, battleInfo);
      if (!info) {
        return;
      }

      if (!info?.allEnemies.some((e) => e.hp > 0)) {
        return;
      }

      if (hasState(self, "umbralCodexLock")) {
        return;
      }

      await addState(
        "umbralCodexLock",
        1,
        self,
        self,
        {},
        {
          battleInfo,
          callbacks,
        }
      );

      const baseIntelligenceDamagePercent = 0.6;
      const extraIntelligenceDamagePercentList = [
        0.3, 0.33, 0.36, 0.39, 0.42, 0.45,
      ];
      const damageEnemyCountList = [1, 1, 1, 2, 2, 3];
      const level = getEquipmentLevel(equipmentId);

      const damageEnemyCount =
        damageEnemyCountList[level] || damageEnemyCountList[0];

      const extraIntelligenceDamagePercent =
        extraIntelligenceDamagePercentList[level] ||
        extraIntelligenceDamagePercentList[0];
      const totalIntelligenceDamagePercent =
        baseIntelligenceDamagePercent +
        extraIntelligenceDamagePercent * duration;

      const enemies = info?.enemies;

      const targets = getRandomUnitsInCollection(enemies, damageEnemyCount);

      callbacks?.floatTextCallback?.({
        unit: self,
        text: `黑暗法典-诅咒回响`,
      });

      const intelligence = getUnitStatusInBattle(self, "intelligence", {
        battleInfo,
        callbacks: callbacks!,
      });
      await dealAoeDamage(
        self,
        targets,
        () => {
          return Math.floor(intelligence * totalIntelligenceDamagePercent);
        },
        {
          damageType: DamageType.Magical,
          causeBy: {
            type: DealDamageCauseByType.Equipment,
            equipmentId: equipmentId,
          },
          battleInfo,
          callbacks: callbacks!,
        }
      );

      detachState("umbralCodexLock", self, battleInfo, {
        callbacks: callbacks!,
      });
    },
  },
  blinkshadowGirdle: {
    async afterGetState({ self, battleInfo, equipmentId, callbacks, stateId }) {
      if (stateId != "sneak" || !battleInfo) {
        return;
      }

      if (hasState(self, "blinkshadowGirdleDamageReduce")) {
        return;
      }

      const thisSkillConf = self.skills.blinkshadowGirdleSkill?.extra
        ?.blinkshadowGirdleSkills as AllBattleSkillId[];

      if (!Array.isArray(thisSkillConf)) {
        return;
      }

      const info = getBaseInfoFromBattleInfo(self, battleInfo);

      if (!info) {
        return;
      }

      const targetSkillId = thisSkillConf[0];
      const targetSkillConf = allGameBattleSkills[
        targetSkillId
      ] as GameBattleSkill;
      if (!targetSkillId || !targetSkillConf || targetSkillConf.passive) {
        return;
      }

      if (
        targetSkillConf.target == "all_enemy" ||
        targetSkillConf.targetCount > 10
      ) {
        return;
      }

      detachState("sneak", self, battleInfo, {
        callbacks: callbacks!,
      });

      const damageReducePercentList = [0.5, 0.48, 0.46, 0.44, 0.42, 0.4];
      const damageReducePercentListIfMainStatusIsDexterity = [
        0.3, 0.25, 0.2, 0.15, 0.1, 0.05,
      ];
      const equipmentLevel = getEquipmentLevel(equipmentId);

      let damageReducePercent =
        damageReducePercentList[equipmentLevel] || damageReducePercentList[0];

      if (getMainStatusInfo(self, true).status == "dexterity") {
        damageReducePercent =
          damageReducePercentListIfMainStatusIsDexterity[equipmentLevel] ||
          damageReducePercentListIfMainStatusIsDexterity[0];
      }

      await addState(
        "blinkshadowGirdleDamageReduce",
        2,
        self,
        self,
        {
          thisStateActuralValue: damageReducePercent,
          thisStateActuralValueUnit: "percent",
        },
        {
          battleInfo,
          callbacks,
        }
      );

      callbacks?.floatTextCallback?.({
        unit: self,
        text: "瞬影-" + targetSkillConf.name,
      });

      await castSkill(
        self,
        targetSkillId,
        {
          battleInfo,
          callbacks: callbacks!,
          ...info,
        },
        {
          hideSkillCastText: true,
          ignoreColddown: true,
          ignoreCastColddown: true,
        }
      );

      detachState("blinkshadowGirdleDamageReduce", self, battleInfo, {
        callbacks: callbacks!,
      });
    },
  },

  arcaneResonanceBracers: {
    onGetStatusModify({ self, equipmentId, oriGetStatusKey }) {
      if (oriGetStatusKey != "intelligence") {
        return 0;
      }

      const atkToIntPercentList = [0.15, 0.17, 0.19, 0.21, 0.23, 0.25];
      const equipmentLevel = getEquipmentLevel(equipmentId);

      let atkToIntPercent =
        atkToIntPercentList[equipmentLevel] || atkToIntPercentList[0];

      return oriGetStatusInBattle(self, "attacking") * atkToIntPercent;
    },
  },
  patchworkHideGarb: {
    onGetRandomPercentModify({
      self,
      equipmentId,
      oriPercent,
      battleInfo,
      callbacks,
    }) {
      const extraPercentList = [0.05, 0.07, 0.09, 0.11, 0.13, 0.15];
      const equipmentLevel = getEquipmentLevel(equipmentId);

      let extraPercent =
        extraPercentList[equipmentLevel] || extraPercentList[0];

      let selfBattle =
        getUnitStatusInBattle(self, "battle", {
          battleInfo,
          callbacks,
        });

      const extraPercentPerBattleList = [0.001, 0.0012, 0.0014, 0.0016, 0.0018, 0.002];
      const extraPercentPerBattle = extraPercentPerBattleList[equipmentLevel] || extraPercentPerBattleList[0];

      let extraPercentFromBattle = selfBattle * extraPercentPerBattle;
      extraPercentFromBattle = Math.min(extraPercentFromBattle, 0.1);

      return extraPercent + extraPercentFromBattle;
    },
    calcBattleWinRewardExtraDropRate({ self, equipmentId, battleInfo, callbacks, }) {
      const extraPercentList = [0.03, 0.035, 0.04, 0.045, 0.05, 0.055];
      const equipmentLevel = getEquipmentLevel(equipmentId);

      let extraPercent =
        extraPercentList[equipmentLevel] || extraPercentList[0];

      let selfBattle =
        getUnitStatusInBattle(self, "battle", {
          battleInfo,
          callbacks,
        });

      const extraPercentPerBattleList = [0.001, 0.0012, 0.0014, 0.0016, 0.0018, 0.002];
      const extraPercentPerBattle = extraPercentPerBattleList[equipmentLevel] || extraPercentPerBattleList[0];

      let extraPercentFromBattle = selfBattle * extraPercentPerBattle;
      extraPercentFromBattle = Math.min(extraPercentFromBattle, 0.05);

      return extraPercent + extraPercentFromBattle;
    }
  },
  patchworkHideShoes: {
    onCalcMaxHpModify: ({ status, equipmentId, }) => {
      const extraMaxHpPerStrengthList = [1, 1.25, 1.5, 1.75, 2, 2.25];
      const extraMaxHpPerDexterityList = [1, 1.1, 1.2, 1.3, 1.4, 1.5];
      const extraMaxHpPerIntelligenceList = [1, 1.1, 1.2, 1.3, 1.4, 1.5];
      const extraMaxHpPerStaminaList = [1, 1.5, 2, 2.5, 3, 3.5];
      const equipmentLevel = getEquipmentLevel(equipmentId);

      const extraMaxHpPerStrength = extraMaxHpPerStrengthList[equipmentLevel] || extraMaxHpPerStrengthList[0];
      const extraMaxHpPerDexterity = extraMaxHpPerDexterityList[equipmentLevel] || extraMaxHpPerDexterityList[0];
      const extraMaxHpPerIntelligence = extraMaxHpPerIntelligenceList[equipmentLevel] || extraMaxHpPerIntelligenceList[0];
      const extraMaxHpPerStamina = extraMaxHpPerStaminaList[equipmentLevel] || extraMaxHpPerStaminaList[0];

      const strength = status.strength.level
      const dexterity = status.dexterity.level
      const intelligence = status.intelligence.level
      const stamina = status.stamina.level

      const extraMaxHpFromStrength = strength * extraMaxHpPerStrength;
      const extraMaxHpFromDexterity = dexterity * extraMaxHpPerDexterity;
      const extraMaxHpFromIntelligence = intelligence * extraMaxHpPerIntelligence;
      const extraMaxHpFromStamina = stamina * extraMaxHpPerStamina;

      return Math.floor(extraMaxHpFromStrength + extraMaxHpFromDexterity + extraMaxHpFromIntelligence + extraMaxHpFromStamina);
    }
  },

  patchworkHideCloak: {
    async onBattleStart({ self, battleInfo, callbacks, equipmentId }) {
      const mainStatus = getMainStatusInfo(self).status;

      if (hasState(self, 'patchworkHideCloakState')) {
        detachState('patchworkHideCloakState', self, battleInfo, { callbacks })
      }

      const calcWorkLevelCountList = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3];
      const percentList = [0.3, 0.31, 0.32, 0.33, 0.34, 0.35, 0.36, 0.37, 0.38, 0.39, 0.4];
      const equipmentLevel = getEquipmentLevel(equipmentId);

      const calcWorkLevelCount = calcWorkLevelCountList[equipmentLevel] || calcWorkLevelCountList[0];
      const percent = percentList[equipmentLevel] || percentList[0];

      const allStatusList: {status: AllBaseCharacterStatusType, val: number}[] = []
      for(const tStatus in self.baseStatus.otherStatus) {
        const status = tStatus as AllBaseCharacterStatusType;
        if (status == 'trading') {
          continue;
        }

        // @ts-ignore
        const val = self.baseStatus.otherStatus[status]?.level || 0;
        allStatusList.push({status, val});
      }

      // sort by val desc
      allStatusList.sort((a, b) => {
        return b.val - a.val;
      });

      let extraTotalWorkStatus = 0;
      for(let i = 0; i < calcWorkLevelCount; i++) {
        extraTotalWorkStatus += allStatusList[i]?.val || 0;
      }

      await addState('patchworkHideCloakState', 10, self, self, {
        mainStatus: mainStatus,
        increment: +(extraTotalWorkStatus * percent).toFixed(0),
      }, {
        battleInfo, callbacks,
      })
    },
  },

  fallenStarAmulet: {
    async onBattleStart({ self, battleInfo, callbacks, equipmentId }) {
      if (hasState(self, 'fallenStarAmuletState')) {
        detachState('fallenStarAmuletState', self, battleInfo, { callbacks })
      }

      const selfBaseLuck = self.baseStatus.otherStatus.luck?.level || 0;

      if (!selfBaseLuck || selfBaseLuck <= 0) {
        return;
      }

      const extraStatusPerLuckList = [2, 2.25, 2.5, 2.75, 3, 3.25];
      const extraShieldPerLuckList = [0.01, 0.011, 0.012, 0.013, 0.014, 0.015];
      const extraDamagePercentLuckList = [0.01, 0.011, 0.012, 0.013, 0.014, 0.015];

      const equipmentLevel = getEquipmentLevel(equipmentId);

      const extraStatusPerLuck = extraStatusPerLuckList[equipmentLevel] || extraStatusPerLuckList[0];
      const extraShieldPerLuck = extraShieldPerLuckList[equipmentLevel] || extraShieldPerLuckList[0];
      const extraDamagePercentLuck = extraDamagePercentLuckList[equipmentLevel] || extraDamagePercentLuckList[0];

      await addState('fallenStarAmuletState', 10, self, self, {
        extraStatus: Math.floor(extraStatusPerLuck * selfBaseLuck),
        extraDamagePercent: extraDamagePercentLuck * selfBaseLuck,
        reducedLuck: selfBaseLuck,
      }, {
        battleInfo, callbacks,
      })

      const shieldValue = Math.floor(self.maxHp * extraShieldPerLuck * selfBaseLuck);

      await addState(
        "shield",
        3,
        self,
        self,
        {
          thisStateActuralValue: shieldValue,
        },
        {
          battleInfo,
          callbacks,
        }
      );
    },
  },

  darkingHeart: {
    onGetRandomPercentModify({}) {
      return -1000;
    },
    async onRandomPercentPassCheckFailed({self, equipmentId, battleInfo, callbacks}) {
      const statusPerStackList = [1, 1.2, 1.4, 1.6, 1.8, 2];
      const damageReducePercentPerStackList = [0.01, 0.011, 0.012, 0.013, 0.014, 0.015];

      const equipmentLevel = getEquipmentLevel(equipmentId);
      
      const statusPerStack = statusPerStackList[equipmentLevel] || statusPerStackList[0];
      const damageReducePercentPerStack = damageReducePercentPerStackList[equipmentLevel] || damageReducePercentPerStackList[0];

      await addState('darkingHeartState', 10, self, self, {
        statusPerStack,
        damageReducePercentPerStack,
      }, {
        extraStack: 1,
        battleInfo, callbacks
      });
    }
  },

  dreadVisor: {
    async onBattleStart({self, battleInfo, callbacks}) {
      await addState('fluster', 10, self, self, {
      }, {
        battleInfo, callbacks
      })
    },

    beforeTakeDamage({self, reducedDamage, battleInfo, callbacks}) {
      if (hasState(self, 'fluster')) {
        return reducedDamage * 0.2;
      }

      return reducedDamage;
    },

    onNeedModifyOriginDamage({self, oriDamage, equipmentId}) {
      if (!hasState(self, 'fluster')) {
        return 0
      }

      const extraDamagePercentList = [0.25, 0.28, 0.31, 0.34, 0.37, 0.4];
      const level = getEquipmentLevel(equipmentId);
      const extraDamagePercent = extraDamagePercentList[level] || extraDamagePercentList[0];

      return oriDamage * extraDamagePercent;
    },
    async afterTakeDamage({source, self, battleInfo, callbacks}) {
      const chanceToAddFlushterToSourcePercentList = [0.3, 0.33, 0.36, 0.39, 0.42, 0.45];
      const level = getEquipmentLevel('dreadVisor');
      let chanceToAddFlushterToSourcePercent = chanceToAddFlushterToSourcePercentList[level] || chanceToAddFlushterToSourcePercentList[0];

      if (hasState(self, 'fluster')) {
        chanceToAddFlushterToSourcePercent *= 2;
      }
      

      const check = await checkRandomPercentAboutUnit(source, chanceToAddFlushterToSourcePercent, {
        battleInfo,
        callbacks,
      });

      callbacks?.floatTextCallback?.({
        unit: self,
        text: `惶恐面具-惶恐`,
      });

      if (check) {
        await addState('fluster', 3, self, source, {}, {
          battleInfo, callbacks
        })
      }
    }
  },
  leftoverPendant: {
    onModifyStateMaxStack({ targetStateId, oriMaxStack, equipmentId }) {
      const stateConf = allBattleState[targetStateId];
      if (!stateConf) {
        return;
      }

      const extraStackPercentList = [0.1, 0.14, 0.18, 0.22, 0.26, 0.3, 0.34, 0.38, 0.42, 0.46, 0.55];
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const extraStackPercent = extraStackPercentList[equipmentLevel] || extraStackPercentList[0];

      const extraStack = Math.floor(oriMaxStack * extraStackPercent);

      return {
        extra: extraStack,
      }
    }
  },
  shadowTalonFang: {
    afterGetState: async ({ self, battleInfo, equipmentId, callbacks, stateId }) => {
      if (stateId != 'sneak') {
        return;
      }

      const attackPerStackList = [1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5];
      const dexterityPerStackList = [1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4];
      const defenceIgnorePerStackList = [0.5, 0.5, 0.6, 0.6, 0.7, 0.7, 0.8, 0.8, 0.9, 0.9, 1];

      const equipmentLevel = getEquipmentLevel(equipmentId);
      
      const attackPerStack = attackPerStackList[equipmentLevel] || attackPerStackList[0];
      const dexterityPerStack = dexterityPerStackList[equipmentLevel] || dexterityPerStackList[0];
      const defenceIgnorePerStack = defenceIgnorePerStackList[equipmentLevel] || defenceIgnorePerStackList[0];
      const selfDefenceReducePerStack = 1;

      await addState('shadowTalonFangState', 4, self, self, {
        attackPerStack,
        dexterityPerStack,
        defenceIgnorePerStack,
        selfDefenceReducePerStack,
      }, {
        extraStack: 1,
        battleInfo, callbacks
      });
    }
  },
  eternalNightStaff: {
    onBattleStart_selfDead: async ({ self, allies, battleInfo, callbacks, equipmentId }) => {
      const equipmentLevel = getEquipmentLevel(equipmentId);
      const getSneakPercentList = [0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.48, 0.51, 0.54, 0.57, 0.6];
      const getSneakPercent = getSneakPercentList[equipmentLevel] || getSneakPercentList[0];

      for(const ally of allies) {
        if (ally.hp > 0 && ally.uuid !== self.uuid) {
          const check = await checkRandomPercentAboutUnit(ally, getSneakPercent, {
            battleInfo,
            callbacks,
          });

          if (!check) {
            continue;
          }

          await addState('sneak', 2, self, ally, {}, {
            battleInfo, callbacks
          })
        }
      }
    },
    onBattleStart: async ({ self, allies, battleInfo, callbacks, equipmentId }) => {
      await addState('proof3', 100, self, self, {}, {
        battleInfo, callbacks
      })

      const equipmentLevel = getEquipmentLevel(equipmentId);
      const getSneakPercentList = [0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.48, 0.51, 0.54, 0.57, 0.6];
      const getSneakPercent = getSneakPercentList[equipmentLevel] || getSneakPercentList[0];

      for(const ally of allies) {
        if (ally.hp > 0 && ally.uuid !== self.uuid) {
          const check = await checkRandomPercentAboutUnit(ally, getSneakPercent, {
            battleInfo,
            callbacks,
          });

          if (!check) {
            continue;
          }

          await addState('sneak', 2, self, ally, {}, {
            battleInfo, callbacks
          })
        }
      }
    },
    async afterEachOtherUnitAction_selfDead({equipmentId, self, currentTurnUnit, battleInfo, callbacks}) {
      if (self.hp > 0) {
        return;
      }
      if (!currentTurnUnit) {
        return;
      }
      
      if (isAlly(self.uuid, currentTurnUnit.uuid, battleInfo)) {
        await addState('sneak', 2, self, currentTurnUnit, {}, {
          battleInfo, callbacks
        })
      } else {
        const info = getBaseInfoFromBattleInfo(self, battleInfo);
        if (!info) {
          return;
        }

        const allAllyDexterity = info.allAllies.reduce((sum, unit) => {
          return sum + getUnitStatusInBattle(unit, 'dexterity', { battleInfo, callbacks });
        }, 0)

        const selfIntelligence = getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks });

        const equipmentLevel = getEquipmentLevel(equipmentId);
        const dexterityDamagePercentList = [1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.6, 1.8];
        const maxDamagePercentList = [3, 3.2, 3.4, 3.6, 3.8, 4, 4.2, 4.4, 4.6, 5, 5.5];

        const dexterityDamagePercent = dexterityDamagePercentList[equipmentLevel] || dexterityDamagePercentList[0];
        const maxDamagePercent = maxDamagePercentList[equipmentLevel] || maxDamagePercentList[0];

        const damageFromDexterity = allAllyDexterity * dexterityDamagePercent;
        const maxDamage = selfIntelligence * maxDamagePercent;

        const finalDamage = Math.min(damageFromDexterity, maxDamage);

        await dealDamage(
          self,
          currentTurnUnit,
          finalDamage, {
            damageType: DamageType.Magical,
            causeBy: {
              type: DealDamageCauseByType.Equipment,
              equipmentId: equipmentId,
            },
            battleInfo,
            callbacks: callbacks!,
          }
        );
      }
    },
  }
};
