import type { AffixDefinition, AffixEffectResolved } from "@/shared/types/affix";
import type { CharacterStatusInfo } from "@/shared/types/characterInfo";
import { generateBasicStatusAffixSeries, generateCustomEffectSeries } from "./generators";

// 约定的 key（示例）：
// - add_state_on_battle_start: 在战斗开始时为自身添加一个状态（来自 allBattleState 等）
//   payload: { stateId: string; duration?: number }
// - bonus_magic_damage_percent: 魔法伤害额外百分比
//   payload: { percent: RangeOrFixed }
// - extra_hp_regen_per_turn: 回合开始时额外回复生命（与 extraHpRegenWhenTurnStart 对齐）
//   payload: { amount: RangeOrFixed }
// - on_kill_restore_mp_percent: 击杀后按最大法力百分比回复
//   payload: { percent: RangeOrFixed }
// - char_attribute_bonus: （非战斗时）基础属性加成，供角色面板/计算流程读取
//   payload: { strength?: RangeOrFixed; dexterity?: RangeOrFixed; intelligence?: RangeOrFixed; stamina?: RangeOrFixed }

// 移除类型辅助函数 t，直接在对象级别通过 satisfies 进行类型校验

export const affixDefinitions = [
  ...generateBasicStatusAffixSeries({
    statuses: ["strength", "dexterity", "intelligence"],
    baseId: "char_attr_minor_boost",
    baseName: "属性提升",
    ranges: {
      COMMON: { min: 1, max: 8 },
      UNCOMMON: { min: 5, max: 15 },
      RARE: { min: 10, max: 25 },
      EPIC: { min: 20, max: 40 },
      LEGENDARY: { min: 30, max: 50 },
    },
  }),

  ...generateBasicStatusAffixSeries({
    statuses: ["attacking"],
    baseId: "battle_attacking_boost",
    baseName: "攻击提升",
    ranges: {
      COMMON: { min: 5, max: 10 },
      UNCOMMON: { min: 10, max: 20 },
      RARE: { min: 15, max: 30 },
      EPIC: { min: 20, max: 40 },
      LEGENDARY: { min: 35, max: 70 },
    },
  }),

  ...generateBasicStatusAffixSeries({
    statuses: ["defencing"],
    baseId: "battle_defencing_boost",
    baseName: "防御提升",
    ranges: {
      COMMON: { min: 10, max: 20 },
      UNCOMMON: { min: 15, max: 30 },
      RARE: { min: 20, max: 40 },
      EPIC: { min: 25, max: 50 },
      LEGENDARY: { min: 40, max: 80 },
    },
  }),

  ...generateBasicStatusAffixSeries({
    statuses: ["stamina"],
    baseId: "battle_stamina_boost",
    baseName: "体力提升",
    ranges: {
      COMMON: { min: 10, max: 15 },
      UNCOMMON: { min: 15, max: 25 },
      RARE: { min: 20, max: 35 },
      EPIC: { min: 25, max: 45 },
      LEGENDARY: { min: 40, max: 75 },
    },
  }),

  ...generateBasicStatusAffixSeries({
    statuses: ["battle"],
    baseId: "battle_battle_boost",
    baseName: "战斗提升",
    ranges: {
      COMMON: { min: 1, max: 15 },
      UNCOMMON: { min: 10, max: 25 },
      RARE: { min: 20, max: 35 },
      EPIC: { min: 30, max: 45 },
      LEGENDARY: { min: 40, max: 55 },
    },
  }),

  {
    affixId: "blessing_of_cookie",
    name: "曲奇的战斗祝福",
    rarity: "EPIC",
    effect: {
      // 固定成员 custom：每点幸运转化为其他属性的系数（ratio）
      // 例如 0.3~1.0，表示每点幸运提供 0.3~1.0 点其他属性
      // 带 name 便于前端展示友好名称
      custom: {
        perLuck: {
          value: { min: 0.5, max: 1.5 },
          name: "每点幸运提供的攻击与防御",
        },
      },
      onCalcStatus({ characterStatus, effect }) {
        const luck: number = Number(characterStatus.luck.final ?? 0);
        const ratio: number =
          typeof effect.custom === "number"
            ? effect.custom
            : Number((effect.custom as any)?.perLuck ?? 0);
        const gain = Math.ceil(luck * ratio);
        return {
          attacking: gain,
          defencing: gain,
        };
      },
    },
    description: "每点幸运提供额外的战斗属性",
    tags: ["battle", "state", "lucky"],
  },

  // 最大生命上限提升（各稀有度显式范围配置于 rangePresets.ts）
  ...generateCustomEffectSeries({
    baseId: "maxhp_boost",
    baseName: "活力祝福",
    tags: ["battle", "state"],
    ranges: {
      COMMON: { min: 100, max: 200 },
      UNCOMMON: { min: 160, max: 280 },
      RARE: { min: 220, max: 380 },
      EPIC: { min: 300, max: 550 },
      LEGENDARY: { min: 500, max: 700 },
    },
    effectFor(rarity, range) {
      return {
        custom: {
          hpIncrease: { value: range, name: "额外最大生命值" },
        },
        onModifyMaxHp({
          effect,
        }: {
          characterStatus: CharacterStatusInfo;
          effect: AffixEffectResolved;
        }) {
          const increase: number =
            typeof effect.custom === "number"
              ? effect.custom
              : Number((effect.custom as any)?.hpIncrease ?? 0);
          return { maxHp: increase };
        },
      };
    },
  }),

  ...generateCustomEffectSeries({
    baseId: "physical_ignore_defence_boost",
    baseName: "防御穿透-物理",
    tags: ["battle", "state"],
    ranges: {
      COMMON: { min: 5, max: 10 },
      UNCOMMON: { min: 10, max: 15 },
      RARE: { min: 15, max: 20 },
      EPIC: { min: 20, max: 25 },
      LEGENDARY: { min: 25, max: 30 },
    },
    effectFor(rarity, range) {
      return {
        custom: {
          ignoreDefence: { value: range, name: "额外防御穿透(%)" },
        },
        onDamageSourceNeedModifyDefenceIgnorePercent({effect, damageType}) {
          if (damageType !== "physical") return 0;

          const percent: number =
            typeof effect.custom === "number"
              ? effect.custom
              : Number((effect.custom as any)?.ignoreDefence ?? 0);

          return percent;
        }
      };
    },
  }),

] as const satisfies AffixDefinition[];

// 便捷 Map：key 为 affixId，value 为对应的定义对象
// export type AffixDefinitionItem = typeof affixDefinitions[number]
// export type AffixId = AffixDefinitionItem['affixId']

export const affixDefinitionsById: Record<string, AffixDefinition> =
  affixDefinitions.reduce((acc, def) => {
    acc[def.affixId] = def;
    return acc;
  }, {} as Record<string, AffixDefinition>);
