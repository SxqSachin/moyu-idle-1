// =======================
// Skill Trees (Rewritten)
// =======================
// This file was heavily corrupted by earlier incremental merges. It is now fully
// rewritten with a clean battle tree (三系属性 T1~T3) and the previously stable
// life tree (efficiency & 专精线) restored. Keep definitions data‑driven.

import type {
  SkillTreeNode,
  SkillTreeDef,
  SkillTreeId,
} from "~/shared/types/skillTree";
import { DamageType } from "../types/skill";
import { getBaseInfoFromBattleInfo } from "../utils/game/battle";
import { castSkill, getUnitStatusInBattle, checkRandomPercentAboutUnit, dealAoeDamage, dealDamage, getEachSelfTurnTriggerMark, getOncePerBattleTriggerMark, getRandomUnitInCollection, getRandomUnitsInCollection, healUnit, isEnemy, isUnitSelectable, lossMp, restoreMp, setEachSelfTurnTriggerMark, setOncePerBattleTriggerMark, summonUnit, addState, isAlly, reduceUnitSkillColddown } from "../../server/utils/game/battleAction";
import { MpLossReason } from "../types/battle";
import { findSkillNodeInfo } from "../utils/skillTreeEffects";
import { CharacterEquipmentPart } from "../types/characterInfo";

// ---------------- Battle Tree ----------------
const battleNodesRaw: SkillTreeNode[] = [
  // -------------------------------- 战斗 --------------------------------
  // #region
  {
    id: "b_battle_zone_base",
    name: "战场专精",
    tier: 1,
    maxLevel: 20,
    ui: { branch: "core_battle_zone" },
    getLevelDef(level: number) {
      const per = 3;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `战斗等级 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => {
        return [{ status: "battle", modifyNumber: level * 3 }];
      },
    },
  },
  {
    id: "b_battle_zone_spoil_count",
    name: "战利品收集-数量",
    tier: 1,
    maxLevel: 5,
    ui: { branch: "core_battle_zone" },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_battle_zone_base", level: 5 }];
    },
    getLevelDef(level: number) {
      const per = 0.3;
      const total = (per * level).toFixed(2);
      return {
        cost: 5,
        effects: { desc: `战利品掉落数量 +${total}%` },
      };
    },
    // 数量增加：影响数量倍率（count）
    businessBattleEffects: {
      calcBattleWinRewardExtraDropCount: ({ level }) => {
        // 0.3% 数量增幅 / 级
        return 0.003 * level;
      }
    }
  },
  {
    id: "b_battle_zone_spoil_percent",
    name: "战利品收集-概率",
    tier: 1,
    maxLevel: 5,
    ui: { branch: "core_battle_zone" },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_battle_zone_base", level: 5 }];
    },
    getLevelDef(level: number) {
      const per = 1;
      const total = per * level;
      const totalStr = total.toFixed(2)
      return {
        cost: 5,
        effects: { desc: `战利品掉落率 +${totalStr}% (*${(100 + total).toFixed(2)}%)` },
      };
    },
    // 掉率增加：影响概率（rate）
    businessBattleEffects: {
      calcBattleWinRewardExtraDropRate: ({ level }) => {
        // 1% 掉率增幅 / 级 （相对基础概率）
        return 0.01 * level;
      }
    }
  },
  // #endregion
  // -------------------------------- 战斗 --------------------------------

  // -------------------------------- 耐力 --------------------------------
  // #region
  {
    id: "b_stamina_increase",
    name: "体质强化",
    description: "基础体魄强化，每级 +4 耐力",
    tier: 1,
    maxLevel: 10,
    ui: { branch: "core_stamina" },
    getLevelDef(level: number) {
      const per = 4;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `总额外耐力 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "stamina", modifyNumber: level * 4 },
      ],
    },
  },
  {
    id: "b_stamina_hp_regen",
    name: "活力",
    description: "基础体魄强化，每级 +5 生命恢复",
    tier: 1,
    maxLevel: 10,
    ui: { branch: "core_stamina" },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_stamina_increase", level: 3 }];
    },
    getLevelDef(level: number) {
      const per = 5;
      const total = per * level;
      return {
        cost: 2,
        effects: { desc: `回合开始前生命恢复 +${total}` },
      };
    },
    businessBattleEffects: {
      extraHpRegenWhenTurnStart: ({ level }) => {
        const per = 5;
        return per * level;
      },
    },
  },
  {
    id: "b_stamina_defence_increase",
    name: "防御强化 I",
    description: "每级 +5 防御",
    tier: 1,
    maxLevel: 10,
    ui: { branch: "core_stamina" },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_stamina_increase", level: 3 }];
    },
    getLevelDef(level: number) {
      const per = 5;
      const total = per * level;
      return {
        cost: 2,
        effects: { desc: `防御 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "defencing", modifyNumber: level * 5 },
      ],
    },
  },
  {
    id: "b_stamina_defence_increase_2",
    name: "防御强化 II",
    description: "每级 +10 防御",
    tier: 2,
    maxLevel: 10,
    ui: { branch: "core_stamina" },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_stamina_defence_increase", level: 6 }];
    },
    getLevelDef(level: number) {
      const per = 10;
      const total = per * level;
      return {
        cost: 3,
        effects: { desc: `防御 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "defencing", modifyNumber: level * 10 },
      ],
    },
  },
  {
    id: "b_stamina_hp_increase",
    name: "生命强化 I",
    description: "每级 +30 生命上限",
    tier: 1,
    maxLevel: 10,
    ui: { branch: "core_stamina" },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_stamina_increase", level: 3 }];
    },
    getLevelDef(level: number) {
      const per = 30;
      const total = per * level;
      return {
        cost: 2,
        effects: { desc: `生命上限 +${total}` },
      };
    },
    businessBattleEffects: {
      hpModifyEffect: (level: number) => {
        return {
          modifyNumber: level * 30,
        }
      }
    },
  },
  {
    id: "b_stamina_hp_increase_2",
    name: "生命强化 II",
    description: "每级 +50 生命上限",
    tier: 2,
    maxLevel: 10,
    ui: { branch: "core_stamina" },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_stamina_hp_increase", level: 6 }];
    },
    getLevelDef(level: number) {
      const per = 50;
      const total = per * level;
      return {
        cost: 3,
        effects: { desc: `生命上限 +${total}` },
      };
    },
    businessBattleEffects: {
      hpModifyEffect: (level: number) => {
        return {
          modifyNumber: level * 50,
        }
      }
    },
  },
  // #endregion
  // -------------------------------- 耐力 --------------------------------

  // -------------------------------- 攻击 --------------------------------
  // #region
  {
    id: "b_attack_tire1",
    name: "攻击专精",
    tier: 1,
    maxLevel: 20,
    ui: { branch: "core_attack" },
    getLevelDef(level: number) {
      const per = 2;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `+${total}攻击力` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => {
        return [{ status: "attacking", modifyNumber: level * 2 }];
      },
    },
  },
  {
    id: "b_attack_multi_player_buff",
    name: "合群",
    tier: 2,
    maxLevel: 3,
    ui: { branch: "core_attack" },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_attack_tire1", level: 5 }];
    },
    getLevelDef(level: number) {
      const per = 2;
      const total = per * level;
      return {
        cost: 3,
        effects: {
          desc: `小队中至少有3个玩家拥有“合群”专精时，额外造成${total}%伤害`,
        },
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({ self, battleInfo, damageType, originDamage, level, callbacks }) => {
        const info = getBaseInfoFromBattleInfo(self, battleInfo);

        if (!info) {
          return 0;
        }

        let thisSkillNodeCount = 0
        for(const unit of info?.allAllies) {
          if ((findSkillNodeInfo(unit.skillTreeNodes, "b_attack_multi_player_buff")?.level ?? 0) > 0) {
            thisSkillNodeCount += 1;
          }
        }

        if (thisSkillNodeCount < 3) {
          return 0;
        }

        callbacks?.floatTextCallback({
          unit: self,
          text: "专精-合群",
          hidePopover: true,
        })

        return originDamage * (0.02 * level);
      }
    },
  },
  {
    id: "b_attack_single_player_buff",
    name: "孤狼",
    tier: 2,
    maxLevel: 3,
    ui: { branch: "core_stamina" },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_attack_tire1", level: 5 }];
    },
    getLevelDef(level: number) {
      const per = 3;
      const total = per * level;
      return {
        cost: 3,
        effects: {
          desc: `小队中只有你拥有“孤狼”专精时，额外造成${total}%伤害`,
        }
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({ self, battleInfo, damageType, originDamage, level, callbacks }) => {
        const info = getBaseInfoFromBattleInfo(self, battleInfo);
        if (!info) {
          return 0;
        }
        let thisSkillNodeCount = 0
        for(const unit of info?.allAllies) {
          if ((findSkillNodeInfo(unit.skillTreeNodes, "b_attack_single_player_buff")?.level ?? 0) > 0) {
            thisSkillNodeCount += 1;
          }
        }
        if (thisSkillNodeCount > 1) {
          return 0;
        }

        callbacks?.floatTextCallback({
          unit: self,
          text: '专精-孤狼',
          hidePopover: true,
        })

        return originDamage * (0.03 * level);
      }
    },
  },
  {
    id: "b_attack_tire2_b",
    name: "进攻强化",
    tier: 2,
    maxLevel: 20,
    ui: { branch: "core_attack" },
    getLevelDef(level: number) {
      const per = 0.2;
      const total = per * level;
      return {
        cost: 1 + Math.floor(level / 4),
        effects: { desc: `+${total.toFixed(2)}% 造成的伤害` },
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({ originDamage, level }) => {
        const increase = level * 0.002;

        return Math.floor(increase * originDamage);
      },
    },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_attack_tire1", level: 10 }];
    },
  },
  {
    id: "b_attack_tire3_b_m",
    name: "魔法进攻强化",
    tier: 3,
    maxLevel: 20,
    ui: { branch: "core_attack" },
    getLevelDef(level: number) {
      const per = 0.3;
      const total = per * level;
      return {
        cost: 1 + Math.floor(level / 3),
        effects: { desc: `+${total.toFixed(2)}% 造成的魔法伤害` },
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({ originDamage, damageType, level }) => {
        if (damageType != DamageType.Magical) {
          return 0;
        }

        const increase = level * 0.003;

        return Math.floor(increase * originDamage);
      },
    },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_attack_tire2_b", level: 5 }];
    },
  },
  {
    id: "b_attack_tire3_b_p",
    name: "物理进攻强化",
    tier: 3,
    maxLevel: 20,
    ui: { branch: "core_attack" },
    getLevelDef(level: number) {
      const per = 0.25;
      const total = per * level;
      return {
        cost: 1 + Math.floor(level / 3),
        effects: { desc: `+${total.toFixed(2)}% 造成的物理伤害` },
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({ originDamage, damageType, level }) => {
        if (damageType != DamageType.Physical) {
          return 0;
        }

        const increase = level * 0.0025;

        return Math.floor(increase * originDamage);
      },
    },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_attack_tire2_b", level: 5 }];
    },
  },
  {
    id: "sp_extra_attack",
    name: "舍身进攻",
    tier: 4,
    maxLevel: 20,
    ui: { branch: "core_attack" },
    getLevelDef(level: number) {
      const per = 0.35;
      const total = per * level;
      return {
        cost: 1 + Math.floor(level / 3),
        effects: { desc: `+${total.toFixed(2)}%造成的伤害\n受到额外10%伤害` },
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({ originDamage, level }) => {
        const increase = level * 0.0035;

        return Math.floor(increase * originDamage);
      },
      onBeforeTakeDamage: ({ reducedDamage }) => {
        return Math.floor(reducedDamage * 1.1);
      }
    },
    getRequires(_nextLevel) {
      return [
        { type: "nodeLevel", nodeId: "b_attack_tire2_b", level: 7 },
        // { type: "status", key: 'battle', value: 60 },
      ];
    },
  },
  {
    id: "sp_extra_attack_rightHand_1",
    name: "弃臂聚势",
    description: "",
    tier: 4,
    maxLevel: 1,
    ui: { branch: "core_attack" },
    getRequires(_nextLevel: number) {
      return [
        { type: "nodeLevel", nodeId: "sp_extra_attack", level: 5 },
        { type: "notWith", nodeId: "sp_extra_attack_rightHand_2" },
        { type: "notWith", nodeId: "sp_extra_attack_rightHand_3" },
      ];
    },
    getLevelDef(level: number) {
      return {
        cost: 12,
        effects: {
          desc: `禁用你的左手装备槽位。\n禁用你的手臂装备槽位。\n获得一个额外的右手装备槽位。\n\n与“弃身聚势”、“舍辅聚势”冲突`
        },
      };
    },
    enableBattleEquipSlot: [CharacterEquipmentPart.rightHand2],
    disableBattleEquipSlot: [CharacterEquipmentPart.leftHand, CharacterEquipmentPart.leftHand2, CharacterEquipmentPart.arm],
    mutuallyExclusiveWith: ['sp_extra_attack_rightHand_2', 'sp_extra_attack_rightHand_3']
  },
  {
    id: "sp_extra_attack_rightHand_2",
    name: "弃身聚势",
    description: "",
    tier: 4,
    maxLevel: 1,
    ui: { branch: "core_attack" },
    getRequires(_nextLevel: number) {
      return [
        { type: "nodeLevel", nodeId: "sp_extra_attack", level: 5 },
        { type: "notWith", nodeId: "sp_extra_attack_rightHand_1" },
        { type: "notWith", nodeId: "sp_extra_attack_rightHand_3" },
      ];
    },
    getLevelDef(level: number) {
      return {
        cost: 12,
        effects: {
          desc: `禁用你的左手装备槽位。\n禁用你的身体装备槽位。\n获得一个额外的右手装备槽位。\n\n与“弃臂聚势”、“舍辅聚势”冲突`
        },
      };
    },
    enableBattleEquipSlot: [CharacterEquipmentPart.rightHand2],
    disableBattleEquipSlot: [CharacterEquipmentPart.leftHand, CharacterEquipmentPart.leftHand2, CharacterEquipmentPart.body],
    mutuallyExclusiveWith: ['sp_extra_attack_rightHand_1', 'sp_extra_attack_rightHand_3']
  },
  {
    id: "sp_extra_attack_rightHand_3",
    name: "舍辅聚势",
    description: "",
    tier: 4,
    maxLevel: 1,
    ui: { branch: "core_attack" },
    getRequires(_nextLevel: number) {
      return [
        { type: "nodeLevel", nodeId: "sp_extra_attack", level: 5 },
        { type: "notWith", nodeId: "sp_extra_attack_rightHand_1" },
        { type: "notWith", nodeId: "sp_extra_attack_rightHand_2" },
      ];
    },
    getLevelDef(level: number) {
      return {
        cost: 12,
        effects: {
          desc: `禁用你的身体装备槽位。\n禁用你的手臂装备槽位。\n禁用你的腿部装备槽位。\n获得一个额外的右手装备槽位。\n\n与“弃身聚势”、“弃臂聚势”冲突`
        },
      };
    },
    enableBattleEquipSlot: [CharacterEquipmentPart.rightHand2],
    disableBattleEquipSlot: [CharacterEquipmentPart.arm, CharacterEquipmentPart.body, CharacterEquipmentPart.leg],
    mutuallyExclusiveWith: ['sp_extra_attack_rightHand_1', 'sp_extra_attack_rightHand_2']
  },
  // #endregion
  // -------------------------------- 攻击 --------------------------------

  // -------------------------------- 力量 --------------------------------
  // #region
  {
    id: "b_strength_focus",
    name: "力量专注",
    description: "基础体魄强化，每级 +2 力量",
    tier: 1,
    maxLevel: 10,
    ui: { branch: "strength_main" },
    getLevelDef(level: number) {
      const per = 2;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `总额外力量 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "strength", modifyNumber: level * 2 },
      ],
    },
  },
  // 力量 T2
  {
    id: "b_strength_advanced",
    name: "力量进阶",
    description: "深度肌纤维适应，每级 +3 力量",
    tier: 2,
    maxLevel: 10,
    ui: { branch: "strength_main" },
    getRequires(_nextLevel: number) {
      return [{ type: "nodeLevel", nodeId: "b_strength_focus", level: 4 }];
    },
    getLevelDef(level: number) {
      const per = 3;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `当前总额外力量 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "strength", modifyNumber: level * 3 },
      ],
    },
  },
  // 力量 T3
  {
    id: "b_strength_supreme",
    name: "力量极意",
    description: "力量调动趋于本能，每级 +4 力量",
    tier: 3,
    maxLevel: 10,
    ui: { branch: "strength_main" },
    getRequires(_nextLevel: number) {
      return [
        // { type: "nodeLevel", nodeId: "b_strength_focus", level: 8 },
        { type: "nodeLevel", nodeId: "b_strength_advanced", level: 5 },
      ];
    },
    getLevelDef(level: number) {
      const per = 4;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `终阶额外力量 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "strength", modifyNumber: level * 4 },
      ],
    },
  },
  {
    id: "b_strength_powerSurge",
    name: "爆发强化",
    description: "短时间内调动更高的力量潜能，每级提升物理伤害",
    tier: 2,
    maxLevel: 5,
    ui: { branch: "strength_main" },
    getRequires(_nextLevel) {
      return [{ type: "nodeLevel", nodeId: "b_strength_focus", level: 6 }];
    },
    getLevelDef(level: number) {
      const per = 0.005; // +0.5% 物理伤害/级 (乘算前额外加成的方式: 返回额外伤害值, 这里用 battleEffect 钩子实现)
      const total = (per * level * 100).toFixed(1);
      return {
        cost: 2,
        effects: {
          desc: `物理伤害提升 +${total}%`,
        },
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({ damageType, originDamage, level }) => {
        if (damageType !== DamageType.Physical) return 0;
        const per = 0.005; // 与 getLevelDef 保持一致
        return originDamage * per * level; // 直接视为额外伤害
      },
    },
  },
  {
    id: "b_strength_heavyTraining",
    name: "负重训练",
    description: "强化基础肌肉耐力，使力量成长更加稳定",
    tier: 2,
    maxLevel: 5,
    ui: { branch: "strength_main" },
    getRequires() {
      return [
        // { type: "nodeLevel", nodeId: "b_stamina_increase", level: 1 },
        { type: "nodeLevel", nodeId: "b_strength_focus", level: 5 },
      ];
    },
    getLevelDef(level: number) {
      // 让每级再提供 +2 力量 (与基础线叠加，偏性价比节点)
      const per = 2;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `额外力量与耐力 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "stamina", modifyNumber: level * 2 },
        { status: "strength", modifyNumber: level * 2 },
      ],
    },
  },
  // 新增：血锋 (低血放大) Strength Tier2
  {
    id: "b_strength_bloodEdge",
    name: "血锋",
    description: "生命值较低时造成更高物理伤害",
    tier: 2,
    maxLevel: 5,
    ui: { branch: "strength_main" },
    getRequires() {
      return [{ type: "nodeLevel", nodeId: "b_strength_advanced", level: 5 }];
    },
    getLevelDef(level: number) {
      return {
        cost: 2,
        effects: {
          desc: `生命 ≤${50 + 5 * level}% 时，物理伤害 +${5 * level}%`,
        },
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({ self, damageType, originDamage, level }) => {
        if (damageType !== DamageType.Physical) return 0;
        const hpPercent = self.hp / self.maxHp;
        const threshold = (50 + 5 * level) / 100;
        if (hpPercent > threshold) return 0;
        return originDamage * (0.05 * level);
      },
    },
  },
  {
    id: "b_strength_tire_3_1",
    name: "遇强则强",
    description: "对生命值较高的敌人造成额外伤害",
    tier: 3,
    maxLevel: 5,
    ui: { branch: "strength_main" },
    getRequires() {
      return [{ type: "nodeLevel", nodeId: "b_strength_advanced", level: 5 }];
    },
    getLevelDef(level: number) {
      const per = 0.06; // 每级对低血量目标额外 +6% (40%以下)
      const total = (per * level * 100).toFixed(1);
      return {
        cost: 3,
        effects: { desc: `对生命大于 80% 目标伤害 +${total}%` },
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({
        target,
        originDamage,
        level,
        damageType,
      }) => {
        if (!target || damageType !== DamageType.Physical) return 0;
        const hpPercent = target.hp / target.maxHp;
        if (hpPercent < 0.8) return 0;
        const per = 0.06;
        return originDamage * per * level;
      },
    },
  },
  {
    id: "b_strength_overlord",
    name: "霸者之力",
    description: "终极力量象征，大幅提升力量",
    tier: 4,
    maxLevel: 5,
    ui: { branch: "strength_main" },
    getRequires() {
      return [
        { type: "nodeLevel", nodeId: "b_strength_supreme", level: 5 },
        { type: "nodeLevel", nodeId: "b_strength_tire_3_1", level: 1 },
      ];
    },
    getLevelDef(level) {
      return {
        cost: 5,
        effects: {
          desc: `力量 +${15 * level}，物理伤害 +${10 + (level - 1) * 2}%`,
        },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "strength", modifyNumber: level * 15 },
      ],
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({ damageType, level, originDamage }) => {
        if (damageType !== DamageType.Physical) return 0;
        return originDamage * (0.1 + (level - 1) * 0.02);
      },
    },
  },
  // #endregion
  // -------------------------------- 力量 --------------------------------

  // -------------------------------- 敏捷 --------------------------------
  // #region
  {
    id: "b_dexterity_focus",
    name: "敏捷专注",
    description: "基础神经与动作协调强化，每级 +2 敏捷",
    tier: 1,
    maxLevel: 10,
    ui: { branch: "dex_main" },
    getLevelDef(level: number) {
      const per = 2;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `总额外敏捷 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "dexterity", modifyNumber: level * 2 },
      ],
    },
  },
  // 敏捷 T2
  {
    id: "b_dexterity_advanced",
    name: "敏捷进阶",
    description: "反射链路强化，每级 +3 敏捷",
    tier: 2,
    maxLevel: 10,
    ui: { branch: "dex_main" },
    getRequires(_nextLevel: number) {
      return [{ type: "nodeLevel", nodeId: "b_dexterity_focus", level: 4 }];
    },
    getLevelDef(level: number) {
      const per = 3;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `当前总额外敏捷 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "dexterity", modifyNumber: level * 3 },
      ],
    },
  },
  {
    id: "b_dexterity_bj",
    name: "致命一击",
    description: "造成伤害时，有一定几率造成250%伤害",
    tier: 2,
    maxLevel: 5,
    ui: { branch: "dex_crit" },
    getRequires(_nextLevel: number) {
      return [{ type: "nodeLevel", nodeId: "b_dexterity_focus", level: 4 }];
    },
    getLevelDef(level: number) {
      const percent = level * 7;
      return {
        cost: 3,
        effects: { desc: `造成物理伤害时，有${percent}%几率造成250%伤害` },
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: async ({
        self,
        damageType,
        originDamage,
        level,
        battleInfo,
        callbacks,
      }) => {
        if (damageType !== DamageType.Physical) return 0;

        const chance = level * 0.07;

        if (!(await checkRandomPercentAboutUnit(self, chance, { battleInfo, callbacks }))) {
          return 0;
        }

        callbacks?.floatTextCallback({
          unit: self,
          text: "致命一击！",
        });

        let multiple = 1.5;

        const precisionNode = self.skillTreeNodes?.find(
          (n) => n.nodeId === "b_dexterity_precision"
        );
        let b_dexterity_precisionLevel = precisionNode?.level || 0;

        const shadowDanceNode = self.skillTreeNodes?.find(
          (n) => n.nodeId === "b_dexterity_shadowDance"
        );
        let b_dexterity_shadowDanceLevel = shadowDanceNode?.level || 0;

        multiple +=
          b_dexterity_shadowDanceLevel * 0.3 + b_dexterity_precisionLevel * 0.2;

        return originDamage * multiple; // 直接返回额外伤害值
      },
    },
  },
  // 敏捷 T3
  {
    id: "b_dexterity_supreme",
    name: "敏捷极意",
    description: "身形与意念合一，每级 +4 敏捷",
    tier: 3,
    maxLevel: 10,
    ui: { branch: "dex_main" },
    getRequires(_nextLevel: number) {
      return [
        // { type: "nodeLevel", nodeId: "b_dexterity_focus", level: 8 },
        { type: "nodeLevel", nodeId: "b_dexterity_advanced", level: 5 },
      ];
    },
    getLevelDef(level: number) {
      const per = 4;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `终阶额外敏捷 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "dexterity", modifyNumber: level * 4 },
      ],
    },
  },
  {
    id: "b_dexterity_precision",
    name: "精准调校",
    description: "提升攻击动作的精密度，增加致命一击伤害",
    tier: 2,
    maxLevel: 5,
    ui: { branch: "dex_main" },
    getRequires() {
      return [
        // { type: "nodeLevel", nodeId: "b_dexterity_focus", level: 5 },
        { type: "nodeLevel", nodeId: "b_dexterity_bj", level: 3 },
      ];
    },
    getLevelDef(level: number) {
      const per = 20; // +2% 暴击概率
      const total = per * level;
      return {
        cost: 2,
        effects: { desc: `致命一击额外造成 +${total}% 伤害（本级 +${per}%）` },
      };
    },
  },
  // 新增：身法流 (首击增伤) Dex Tier2
  {
    id: "b_dexterity_bow_expert",
    name: "射手天赋",
    description: "你的弓类武器获得额外效果",
    tier: 2,
    maxLevel: 2,
    ui: { branch: "dex_main" },
    getRequires() {
      return [{ type: "nodeLevel", nodeId: "b_dexterity_advanced", level: 2 }];
    },
    getLevelDef(level: number) {
      return {
        cost: 2,
        effects: { desc: `弓类武器触发概率提高至100%，弹药数量+${5 * level}` },
      };
    },
  },
  {
    id: "b_dexterity_dodge",
    name: "闪避",
    description: "受到物理伤害时，有一定几率化解此次攻击",
    tier: 3,
    maxLevel: 5,
    ui: { branch: "dex_main" },
    getRequires() {
      return [{ type: "nodeLevel", nodeId: "b_dexterity_advanced", level: 5 }];
    },
    getLevelDef(level: number) {
      const chance = level * 10; // 每级 +6% 闪避几率
      return {
        cost: 3,
        effects: { desc: `受到物理伤害时有 ${chance}% 几率仅受到1点伤害` },
      };
    },
    businessBattleEffects: {
      onBeforeTakeDamage: async ({
        self,
        level,
        damageType,
        reducedDamage,
        battleInfo,
        callbacks,
      }) => {
        if (damageType !== DamageType.Physical) return reducedDamage;

        const chance = level * 0.1;

        if (!(await checkRandomPercentAboutUnit(self, chance, { battleInfo, callbacks }))) return reducedDamage;

        callbacks?.floatTextCallback?.({ text: "闪避！", unit: self });

        return 1;
      },
    },
    tags: ["needs_follow_up_hook"],
  },
  {
    id: "b_dexterity_shadowDance",
    name: "影舞",
    description: "终极敏捷技巧，全面提升敏捷与致命一击表现",
    tier: 4,
    maxLevel: 5,
    ui: { branch: "dex_main" },
    getRequires() {
      return [
        { type: "nodeLevel", nodeId: "b_dexterity_supreme", level: 5 },
        { type: "nodeLevel", nodeId: "b_dexterity_precision", level: 3 },
      ];
    },
    getLevelDef(level) {
      return {
        cost: 5,
        effects: {
          desc: `敏捷 +${15 * level}，致命一击额外伤害倍率 +${30 * level}%`,
        },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "dexterity", modifyNumber: level * 15 },
      ],
    },
  },
  // #endregion
  // -------------------------------- 敏捷 --------------------------------

  // -------------------------------- 智力 --------------------------------
  // #region
  {
    id: "b_intelligence_focus",
    name: "智力专注",
    description: "基础认知与记忆结构强化，每级 +2 智力",
    tier: 1,
    maxLevel: 10,
    ui: { branch: "int_main" },
    getLevelDef(level: number) {
      const per = 2;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `总额外智力 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "intelligence", modifyNumber: level * 2 },
      ],
    },
  },
  // 智力 T2
  {
    id: "b_intelligence_advanced",
    name: "智力进阶",
    description: "深化认知结构，每级 +3 智力",
    tier: 2,
    maxLevel: 10,
    ui: { branch: "int_main" },
    getRequires(_nextLevel: number) {
      return [{ type: "nodeLevel", nodeId: "b_intelligence_focus", level: 4 }];
    },
    getLevelDef(level: number) {
      const per = 3;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `当前总额外智力 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "intelligence", modifyNumber: level * 3 },
      ],
    },
  },
  // 智力 T3
  {
    id: "b_intelligence_supreme",
    name: "智力极意",
    description: "思维与能量流动高度契合，每级 +4 智力",
    tier: 3,
    maxLevel: 10,
    ui: { branch: "int_main" },
    getRequires(_nextLevel: number) {
      return [
        // { type: "nodeLevel", nodeId: "b_intelligence_focus", level: 8 },
        { type: "nodeLevel", nodeId: "b_intelligence_advanced", level: 5 },
      ];
    },
    getLevelDef(level: number) {
      const per = 4;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `终阶额外智力 +${total}` },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "intelligence", modifyNumber: level * 4 },
      ],
    },
  },
  {
    id: "b_intelligence_damageIncrease",
    name: "魔力增幅",
    description: "你的智力能够提升你造成的魔法伤害",
    tier: 3,
    maxLevel: 2,
    ui: { branch: "int_main" },
    getRequires(_nextLevel: number) {
      return [
        // { type: "nodeLevel", nodeId: "b_intelligence_focus", level: 4 },
        { type: "nodeLevel", nodeId: "b_intelligence_advanced", level: 4 },
      ];
    },
    getLevelDef(level: number) {
      const per = 0.04;
      const total = per * level;
      return {
        cost: 4,
        effects: { desc: `每点智力提升 +${total}% 的魔法伤害` },
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({ self, damageType, originDamage, level, battleInfo, callbacks }) => {
        if (damageType !== DamageType.Magical) return 0;

        const increase = level * 0.0004 * getUnitStatusInBattle(self, 'intelligence', { battleInfo, callbacks} );

        return increase * originDamage;
      },
    },
  },
  {
    id: "b_intelligence_focusMind",
    name: "心灵聚焦",
    description: "专注心灵，提升法术基础伤害",
    tier: 2,
    maxLevel: 5,
    ui: { branch: "int_main" },
    getRequires() {
      return [{ type: "nodeLevel", nodeId: "b_intelligence_focus", level: 5 }];
    },
    getLevelDef(level: number) {
      const per = 0.01; // +2% 魔法伤害/级
      const total = (per * level * 100).toFixed(1);
      return {
        cost: 2,
        effects: {
          desc: `魔法伤害 +${total}%（本级 +${(per * 100).toFixed(1)}%）`,
        },
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({ damageType, originDamage, level }) => {
        if (damageType !== DamageType.Magical) return 0;
        const per = 0.01;
        return originDamage * per * level;
      },
    },
  },
  {
    id: "b_intelligence_arcaneCircuit",
    name: "秘能回路",
    description: "改善法力流动效率，获得魔法恢复",
    tier: 2,
    maxLevel: 5,
    ui: { branch: "int_main" },
    getRequires() {
      return [{ type: "nodeLevel", nodeId: "b_intelligence_focus", level: 5 }];
    },
    getLevelDef(level: number) {
      // 给予额外智力 +1/级
      const per = 1;
      const total = per * level;
      return {
        cost: 1,
        effects: { desc: `回合开始时额外魔法恢复 +${total}` },
      };
    },
    businessBattleEffects: {
      extraMpRegenWhenTurnStart: ({ level }) => {
        const per = 1;
        return per * level;
      },
    },
  },
  {
    id: "b_intelligence_arcaneOverload",
    name: "奥能溢流",
    description: "当你的法术造成魔法伤害时，有概率造成额外伤害",
    tier: 3,
    maxLevel: 5,
    ui: { branch: "int_main" },
    getRequires() {
      return [
        { type: "nodeLevel", nodeId: "b_intelligence_advanced", level: 5 },
      ];
    },
    getLevelDef(level: number) {
      const chance = level * 8; // 每级 +8% 触发
      return {
        cost: 3,
        effects: { desc: `魔法技能有 ${chance}% 几率额外造成 10% 伤害` },
      };
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: async ({
        damageType,
        originDamage,
        level,
        battleInfo,
        callbacks,
        self,
      }) => {
        if (damageType !== DamageType.Magical) return 0;
        const chance = level * 0.08;
        if (!(await checkRandomPercentAboutUnit(self, chance, { battleInfo, callbacks }))) return 0;
        callbacks?.floatTextCallback?.({ text: "溢流", unit: self });
        return originDamage * 0.1;
      },
    },
  },
  {
    id: "b_intelligence_archmage",
    name: "大法师",
    description: "终极魔法境界，显著提升智力与魔法伤害",
    tier: 4,
    maxLevel: 5,
    ui: { branch: "int_main" },
    getRequires() {
      return [
        { type: "nodeLevel", nodeId: "b_intelligence_supreme", level: 6 },
        {
          type: "nodeLevel",
          nodeId: "b_intelligence_arcaneOverload",
          level: 3,
        },
      ];
    },
    getLevelDef(level) {
      return {
        cost: 5,
        effects: {
          desc: `智力 +${10 * level}，魔法伤害 +${
            (0.1 + (level - 1) * 0.02) * 100
          }%，法力回复 +${1 * level}`,
        },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "intelligence", modifyNumber: level * 10 },
      ],
    },
    businessBattleEffects: {
      onNeedModifyOriginDamage: ({ level, damageType, originDamage }) => {
        if (damageType !== DamageType.Magical) return 0;
        return originDamage * (0.1 + (level - 1) * 0.02);
      },
      extraMpRegenWhenTurnStart: ({ level }) => {
        const per = 1;
        return per * level;
      },
    },
  },
  // #endregion
  // -------------------------------- 智力 --------------------------------

  // -------------------------------- 力量+智力 --------------------------------
  // {
  //   id: "b_strength_intelligence_focus",
  //   name: "力量智力专注",
  //   description: "基础体魄强化，每级 +2 力量",
  //   tier: 1,
  //   maxLevel: 10,
  //   ui: { branch: 'hybrid_str_int' },
  //   getRequires(_nextLevel: number) {
  //     return [
  //       { type: "nodeLevel", nodeId: "b_strength_heavyTraining", level: 1 },
  //       { type: "nodeLevel", nodeId: "b_intelligence_arcaneCircuit", level: 1 },
  //     ];
  //   },
  //   getLevelDef(level: number) {
  //     const per = 2;
  //     const total = per * level;
  //     return {
  //       cost: 1,
  //       effects: { desc: `总额外力量 +${total}` },
  //     };
  //   },
  //   businessEffects: (level: number) => ({
  //     statusModifyEffect: [{ status: "strength", modifyNumber: level * 2 }],
  //   }),
  // },
  // -------------------------------- 力量+智力 --------------------------------

  // -------------------------------- 力量+敏捷 --------------------------------
  {
    id: "b_strength_dexterity_execution",
    name: "快速打击",
    description: "快准狠的一击",
    tier: 1,
    maxLevel: 2,
    ui: { branch: "hybrid_str_dex" },
    getRequires(_nextLevel: number) {
      return [
        { type: "nodeLevel", nodeId: "b_strength_powerSurge", level: 3 },
        { type: "nodeLevel", nodeId: "b_dexterity_advanced", level: 5 },
      ];
    },
    getLevelDef(level: number) {
      return {
        cost: 3,
        effects: {
          desc: `战斗开始时，${
            10 + level * 10
          }%几率 触发一次随机目标的普通攻击`,
        },
      };
    },
    businessBattleEffects: {
      onBattleStart: async ({ self, level, battleInfo, callbacks }) => {
        const percent = 0.1 + level * 0.1;

        if (!(await checkRandomPercentAboutUnit(self, percent, { battleInfo, callbacks }))) return;

        const info = getBaseInfoFromBattleInfo(self, battleInfo);

        if (!info) {
          return;
        }

        callbacks?.floatTextCallback({
          unit: self,
          text: "快速打击！",
        });

        await castSkill(
          self,
          "baseAttack",
          {
            battleInfo,
            callbacks,
            ...info,
            ...callbacks,
          },
          {
            hideSkillCastText: true,
          }
        );
      },
    },
  },
  // -------------------------------- 力量+敏捷 --------------------------------

  // -------------------------------- 耐力+智力 --------------------------------
  {
    id: "b_dexterity_intelligence_focus",
    name: "随机应变",
    description: "",
    tier: 1,
    maxLevel: 3,
    ui: { branch: "hybrid_sta_int" },
    getRequires(_nextLevel: number) {
      return [
        { type: "nodeLevel", nodeId: "b_intelligence_arcaneCircuit", level: 5 },
        { type: "nodeLevel", nodeId: "b_stamina_hp_regen", level: 5 },
      ];
    },
    getLevelDef(level: number) {
      return {
        cost: 1,
        effects: {
          desc: `当受到致命伤害时，你将消耗你的的法力值来吸收伤害。\n每1点法力值吸收${
            0.5 + 0.5 * level
          }点伤害。`,
        },
      };
    },
    businessBattleEffects: {
      onBeforeTakeDamage: ({
        level,
        self,
        damageSource,
        target,
        reducedDamage,
        callbacks,
        battleInfo,
      }) => {
        if (reducedDamage < self.hp) return reducedDamage;
        if (self.mp <= 0) return reducedDamage;

        // 计算本次伤害需要消耗的魔法值
        const needMp = Math.ceil(reducedDamage / (0.5 + 0.5 * level));
        const costMp = Math.ceil(Math.min(needMp, self.mp));
        const canAbsorbDamage = Math.ceil(costMp * (0.5 + 0.5 * level));

        lossMp(self, self, costMp, {
          reason: MpLossReason.SkillNode,
          callbacks,
          battleInfo,
        });

        callbacks?.floatTextCallback?.({ text: "随机应变", unit: self });
        callbacks?.floatTextCallback?.({
          text: `消耗 ${costMp} 点法力值，吸收 ${canAbsorbDamage} 点伤害`,
          unit: self,
          hidePopover: true,
        });

        // 吸收全部伤害
        if (canAbsorbDamage >= reducedDamage) {
          return 0;
        }

        return reducedDamage - canAbsorbDamage;
      },
    },
  },
  // -------------------------------- 耐力+智力 --------------------------------

];
const battleNodes: Readonly<SkillTreeNode[]> = Object.freeze(
  battleNodesRaw
) as Readonly<SkillTreeNode[]>;

export const battleSkillTree: SkillTreeDef = {
  id: "battle",
  name: "战斗技能树",
  nodes: battleNodes,
};

// ---------------- Life Tree ----------------

const generateTier2BasicWorkingNode = (
  id: string,
  actionName: string,
  actionId: string
): SkillTreeNode => {
  return {
    id,
    name: `${actionName}专精`,
    description: `提升${actionName}速度`,
    tier: 2,
    maxLevel: 10,
    getRequires(_nextLevel: number) {
      return [{ type: "nodeLevel", nodeId: "l_efficiency_basics", level: 2 }];
    },
    getLevelDef(level: number) {
      const percent = (0.01 + 0.005 * level) * 100;
      return {
        cost: 1 + Math.floor(level / 2),
        effects: { desc: `${actionName}耗时降低 ${percent.toFixed(2)}%` },
      };
    },
    businessEffects: {
      actionDurationEffect: (level) => {
        const l = level
        const modify = 0.01 + 0.005 * l;
        return [
          { actionId, modifyPercent: -modify },
        ]
      }
    },
  };
};

const generateTier3ExtraRewardWorkingNode = (
  id: string,
  parent: string,
  actionName: string,
  actionId: string,
): SkillTreeNode => {
  return {
    id,
    name: `${actionName}-额外产出`,
    description: `提升${actionName}效率`,
    tier: 3,
    maxLevel: 10,
    getRequires(_nextLevel: number) {
      return [{ type: "nodeLevel", nodeId: parent, level: 7 }];
    },
    getLevelDef(level: number) {
      const percent = (0.008 + 0.002 * level) * 100;
      return {
        cost: 4 + Math.floor(level / 2),
        effects: { desc: `${actionName}行动 ${percent.toFixed(2)}% 概率获得1份额外产出` },
      };
    },
    businessEffects: {
      actionExtraRewardEffect: (level) => {
        const l = level
        const modify = 0.008 + 0.002 * l;
        return [
          { actionId, modifyPercent: modify, desc: `${actionName}专精-额外产出` },
        ]
      }
    }
  };
};
const generateTier3ReturnResourceWorkingNode = (
  id: string,
  parent: string,
  actionName: string,
  actionId: string,
): SkillTreeNode => {
  return {
    id,
    name: `${actionName}-返还消耗`,
    description: `提升${actionName}效率`,
    tier: 3,
    maxLevel: 10,
    getRequires(_nextLevel: number) {
      return [{ type: "nodeLevel", nodeId: parent, level: 7 }];
    },
    getLevelDef(level: number) {
      const percent = (0.008 + 0.002 * level) * 100;
      return {
        cost: 4 + Math.floor(level / 2),
        effects: { desc: `${actionName}行动 ${percent.toFixed(2)}% 概率返还66%物资消耗（向上取整）` },
      };
    },
    businessEffects: {
      actionReturnDeductEffect: (level) => {
        const l = level
        const modify = 0.008 + 0.002 * l;
        return [
          { actionId, modifyPercent: modify, deductResourceReturnPercent: 0.66, desc: `${actionName}专精-返还66%消耗` },
        ]
      }
    }
  };
};

const generateTier3ExtraExpNode = (
  id: string,
  parent: string,
  actionName: string,
  actionId: string,
): SkillTreeNode => {
  return {
    id,
    name: `${actionName}-额外经验`,
    description: `提升${actionName}获取的经验`,
    tier: 3,
    maxLevel: 10,
    getRequires(_nextLevel: number) {
      return [{ type: "nodeLevel", nodeId: parent, level: 8 }];
    },
    getLevelDef(level: number) {
      const percent = (0.01 + 0.003 * level) * 100;
      return {
        cost: 4 + Math.floor(level / 2),
        effects: { desc: `${actionName}行动 额外提供 ${percent.toFixed(2)}% 经验` },
      };
    },
    businessEffects: {
      actionExpRewardEffect: (level) => {
        const l = level
        const modify = 0.01 + 0.003 * l;
        return [
          { actionId, modifyPercent: modify },
        ]
      }
    }
  };
};

// 生活动作专精参数配置（统一在此添加/修改）
interface LifeActionSpec { key: string; actionName: string; actionId: string }
const lifeActionSpecs: LifeActionSpec[] = [
  { key: 'farmingAnimal', actionName: '养殖', actionId: 'allFarmingAnimalAction' },
  { key: 'collecting', actionName: '采集', actionId: 'allCollectingAction' },
  { key: 'mining', actionName: '采矿', actionId: 'allMiningAction' },
  { key: 'fishing', actionName: '钓鱼', actionId: 'allFishingAction' },
  { key: 'farmingPlant', actionName: '种植', actionId: 'allFarmingPlantAction' },
  { key: 'cooking', actionName: '烹饪', actionId: 'allCookingAction' },
  { key: 'mysterious', actionName: '炼金', actionId: 'allMysteriousAction' },
  { key: 'manufacturing', actionName: '制造', actionId: 'allLevel1Manufacture' },
  { key: 'forging', actionName: '锻造', actionId: 'allForgingAction' },
  { key: 'specialManufacture', actionName: '特殊制造', actionId: 'allSpecialManufactureAction' },

  { key: 'sewing', actionName: '缝纫', actionId: 'allSewingAction' },
  { key: 'knowledge', actionName: '自我提升', actionId: 'allExerciseAction' },
  { key: 'exploring', actionName: '探索', actionId: 'allExploreAction' },
]

// 生成 Tier2 专精节点 & Tier3 两条分支（额外奖励 / 返还资源）
const lifeTier2Nodes: SkillTreeNode[] = lifeActionSpecs.map(spec =>
  generateTier2BasicWorkingNode(`l_${spec.key}_focus`, spec.actionName, spec.actionId)
)
const lifeTier3ExtraRewardNodes: SkillTreeNode[] = lifeActionSpecs.map(spec =>
  generateTier3ExtraRewardWorkingNode(
    `l_${spec.key}_extraReward`,
    `l_${spec.key}_focus`,
    spec.actionName,
    spec.actionId,
  )
)
const lifeTier3ReturnResourceNodes: SkillTreeNode[] = lifeActionSpecs.map(spec =>
  generateTier3ReturnResourceWorkingNode(
    `l_${spec.key}_returnResource`,
    `l_${spec.key}_focus`,
    spec.actionName,
    spec.actionId,
  )
)
const lifeTier3ExtraExpNodes: SkillTreeNode[] = lifeActionSpecs.map(spec =>
  generateTier3ExtraExpNode(
    `l_${spec.key}_extraExp`,
    `l_${spec.key}_focus`,
    spec.actionName,
    spec.actionId,
  )
)

// 核心 Tier1 + 动态生成节点合并
const lifeNodes: Readonly<SkillTreeNode[]> = Object.freeze<SkillTreeNode[]>([
  {
    id: "l_lucky_basics",
    name: "幸运",
    description: "获得额外幸运",
    tier: 1,
    maxLevel: 10,
    getLevelDef(level: number) {
      return {
        cost: 15,
        effects: {
          desc: `幸运 +${level}`,
        },
      };
    },
    businessEffects: {
      statusModifyEffect: (level: number) => [
        { status: "luck", modifyNumber: level },
      ],
    },
  },
  {
    id: "l_efficiency_basics",
    name: "效率基础",
    description: "工作效率提升",
    tier: 1,
    maxLevel: 20,
    getLevelDef(level: number) {
      return {
        cost: 1 + Math.floor(level / 4),
        effects: {
          desc: `所有生活动作耗时降低 ${((0.003 + level * 0.003) * 100).toFixed(2)}%`,
        },
      };
    },
    businessEffects: {
      actionDurationEffect: (level) => {
        const l = level
        const modify = 0.03 + 0.003 * l;
        return [
          { actionId: "allAction", modifyPercent: -modify },
        ]
      }
    },
  },
  ...lifeTier2Nodes,
  ...lifeTier3ExtraRewardNodes,
  ...lifeTier3ReturnResourceNodes,
  ...lifeTier3ExtraExpNodes
])

export const lifeSkillTree: SkillTreeDef = {
  id: "life",
  name: "生活技能树",
  nodes: lifeNodes,
};

// ---------------- Aggregation ----------------
export const allSkillTrees: Record<SkillTreeId, SkillTreeDef> = {
  battle: battleSkillTree,
  life: lifeSkillTree,
};
export const allSkillTreeNodes = [
  ...battleSkillTree.nodes,
  ...lifeSkillTree.nodes,
];

export const allSkillTreeNodeMap: Record<string, SkillTreeNode> = {};
for (const node of allSkillTreeNodes) {
  allSkillTreeNodeMap[node.id] = node;
}

export const allWorkSkillTreeNodesMap = lifeSkillTree.nodes.reduce((map, node) => {
  map[node.id] = node;
  return map;
}, {} as Record<string, SkillTreeNode>);

export const allBattleSkillTreeNodesMap = battleSkillTree.nodes.reduce((map, node) => {
  map[node.id] = node;
  return map;
}, {} as Record<string, SkillTreeNode>);