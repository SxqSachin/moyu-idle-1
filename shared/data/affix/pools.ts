import type { AffixPool } from '@/shared/types/affix'
import { generatePoolEntriesForSeries } from './generators'

// 示例：一个通用的角色随机池，抽取 1~3 条，默认允许重复
export const defaultCharacterAffixPool: AffixPool = {
  poolId: "default_character_pool",
  name: "默认",
  rules: {
    count: { min: 1, max: 3 },
    // 默认消耗（每抽取1条消耗），可自行调整
    costPerRoll: {
      gold: {
        count: 20000,
      },
      moonPearl: {
        count: 5,
      },
    },
    // 目标：稀有度全局占比约为 66% / 20% / 10% / 3% / 1%
    // 使用 B 方案：保留每稀有度条目基础权重（由生成器设定），通过稀有度权重进行补偿，
    // 使 P[r] ≈ 目标占比；其中 P[r] ∝ rarityWeight[r] * Σ(entryWeight[r])。
    // 该组数值基于当前 entries 与默认 per-rarity 基础权重计算得到：
    // COMMON:94, UNCOMMON:56, RARE:41, EPIC:21, LEGENDARY:21
    rarityWeight: {
      COMMON: 94,
      UNCOMMON: 56,
      RARE: 41,
      EPIC: 21,
      LEGENDARY: 21,
    },
    // 重抽消耗（低=COMMON/UNCOMMON；中=RARE；高=EPIC/LEGENDARY）
    rerollCostPerRarity: {
      COMMON: { gold: { count: 50000 }, moonPearl: { count: 5 } },
      UNCOMMON: {
        gold: { count: 50000 },
        moonPearl: { count: 8 },
        pure_monster_essence_lv1: { count: 10 },
      },
      RARE: {
        gold: { count: 100000 },
        moonPearl: { count: 10 },
        pure_monster_essence_lv2: { count: 8 },
      },
      EPIC: {
        gold: { count: 100000 },
        blackPearl: { count: 3 },
        pure_monster_essence_lv3: { count: 6 },
      },
      LEGENDARY: {
        gold: { count: 200000 },
        blackPearl: { count: 5 },
        pure_monster_essence_lv4: { count: 4 },
      },
    },
    // 稀有度升级（当前稀有度 -> 下一稀有度）的消耗
    rarityUpgradeCostPerRarity: {
      COMMON: {
        gold: { count: 10000000 },
        moonPearl: { count: 50 },
        genesisEssence: { count: 5 },
        pure_monster_essence_lv2: { count: 50 },
      },
      UNCOMMON: {
        gold: { count: 20000000 },
        blackPearl: { count: 25 },
        genesisEssence: { count: 10 },
        hb_null_signature: { count: 10 },
        pure_monster_essence_lv3: { count: 50 },
      },
      RARE: {
        gold: { count: 30000000 },
        blackPearl: { count: 50 },
        genesisEssence: { count: 20 },
        hb_null_signature: { count: 25 },
        pure_monster_essence_lv3: { count: 100 },
      },
      EPIC: {
        gold: { count: 50000000 },
        blackPearl: { count: 80 },
        genesisEssence: { count: 50 },
        hb_null_signature: { count: 50 },
        pure_monster_essence_lv4: { count: 50 },
      },
      // LEGENDARY 无下一档
    },
    // 进阶重随消耗（默认与重抽一致，可独立调整）
    rerollUpCostPerRarity: {
      COMMON: {
        gold: { count: 100000 },
        moonPearl: { count: 10 },
        pure_monster_essence_lv1: { count: 15 },
      },
      UNCOMMON: {
        gold: { count: 100000 },
        moonPearl: { count: 15 },
        pure_monster_essence_lv2: { count: 15 },
      },
      RARE: {
        gold: { count: 200000 },
        blackPearl: { count: 5 },
        pure_monster_essence_lv3: { count: 10 },
      },
      EPIC: {
        gold: { count: 200000 },
        blackPearl: { count: 10 },
        pure_monster_essence_lv4: { count: 5 },
      },
      LEGENDARY: {
        gold: { count: 500000 },
        blackPearl: { count: 20 },
        pure_monster_essence_lv4: { count: 8 },
      },
    },
  },
  entries: [
    ...generatePoolEntriesForSeries({
      baseId: "char_attr_minor_boost",
      tags: ["attribute"],
    }),
    ...generatePoolEntriesForSeries({
      baseId: "battle_attacking_boost",
      tags: ["battle", "attacking"],
    }),
    ...generatePoolEntriesForSeries({
      baseId: "battle_defencing_boost",
      tags: ["battle"],
    }),
    ...generatePoolEntriesForSeries({
      baseId: "battle_stamina_boost",
      tags: ["battle"],
    }),
    ...generatePoolEntriesForSeries({
      baseId: "battle_battle_boost",
      tags: ["battle"],
    }),
    ...generatePoolEntriesForSeries({
      baseId: "physical_ignore_defence_boost",
      tags: ["battle"],
    }),
    ...generatePoolEntriesForSeries({
      baseId: "maxhp_boost",
      tags: ["battle", "state"],
    }),
    {
      affixId: "blessing_of_cookie",
      // 为了在 EPIC 稀有度内“均分”，将该单项的 entry 权重与同稀有度系列条目保持一致（默认 18）
      weight: 18,
    },
  ],
};

// 攻击专属池
export const attackingOnlyAffixPool: AffixPool = {
  poolId: 'attacking_only_pool',
  name: '战斗',
  rules: {
    count: { min: 1, max: 3 },
    costPerRoll: { 
      gold: {
        count: 1000,
      },
      pearl: {
        count: 10,
      },
    },

    rarityWeight: {
      COMMON: 94,
      UNCOMMON: 56,
      RARE: 41,
      EPIC: 21,
      LEGENDARY: 21,
    },
    rerollCostPerRarity: {
      COMMON: { gold: {count: 5000}, pearl: { count: 10 } },
      UNCOMMON: { gold: {count: 5000},pearl: { count: 10 } },
      RARE: { gold: {count: 10000},moonPearl: { count: 10 } },
      EPIC: { gold: {count: 10000},moonPearl: { count: 5 } },
      LEGENDARY: {gold: {count: 20000}, blackPearl: { count: 5 } },
    },
    rerollUpCostPerRarity: {
      COMMON: { gold: {count: 5000}, pearl: { count: 10 } },
      UNCOMMON: { gold: {count: 5000},pearl: { count: 10 } },
      RARE: { gold: {count: 10000},moonPearl: { count: 10 } },
      EPIC: { gold: {count: 10000},moonPearl: { count: 5 } },
      LEGENDARY: {gold: {count: 20000}, blackPearl: { count: 5 } },
    },
  },
  entries: [
    ...generatePoolEntriesForSeries({ baseId: 'char_attr_minor_boost', tags: ['attribute'], includeRarities: ['COMMON', 'UNCOMMON', 'RARE', 'EPIC'] }),
    ...generatePoolEntriesForSeries({ baseId: 'battle_attacking_boost', tags: ['battle','attacking'] }),
    ...generatePoolEntriesForSeries({ baseId: 'battle_defencing_boost', tags: ['battle'] }),
    ...generatePoolEntriesForSeries({ baseId: 'battle_stamina_boost', tags: ['battle'] }),
    ...generatePoolEntriesForSeries({ baseId: 'battle_battle_boost', tags: ['battle'] }),
    ...generatePoolEntriesForSeries({ baseId: 'maxhp_boost', tags: ['battle','state'] }),
    {
      affixId: "blessing_of_cookie",
      weight: 18,
    }
  ],
}

export const workOnlyAffixPool: AffixPool = {
  poolId: 'work_only_pool',
  name: '生活',
  rules: {
    count: { min: 1, max: 3 },
    costPerRoll: { gold: { count: 300 } },
    rarityWeight: {
      COMMON: 66,
      UNCOMMON: 20,
      RARE: 10,
      EPIC: 3,
      LEGENDARY: 1,
    },
    rerollCostPerRarity: {
      COMMON: { pearl: { count: 10 } },
      UNCOMMON: { pearl: { count: 10 } },
      RARE: { moonPearl: { count: 10 } },
      EPIC: { blackPearl: { count: 5 } },
      LEGENDARY: { blackPearl: { count: 5 } },
    },
    rerollUpCostPerRarity: {
      COMMON: { pearl: { count: 10 } },
      UNCOMMON: { pearl: { count: 10 } },
      RARE: { moonPearl: { count: 10 } },
      EPIC: { blackPearl: { count: 5 } },
      LEGENDARY: { blackPearl: { count: 5 } },
    },
  },
  entries: [
    { affixId: 'battle_bud_common_1', weight: 100, tags: ['battle'] },
    { affixId: 'battle_polish_uncommon_1', weight: 60, tags: ['battle'] },
    { affixId: 'battle_ascend_rare_1', weight: 35, tags: ['battle'] },
    { affixId: 'battle_fervor_rare_2', weight: 35, tags: ['battle'] },
    { affixId: 'battle_zeal_epic_1', weight: 18, tags: ['battle'] },
    { affixId: 'battle_fury_epic_2', weight: 18, tags: ['battle'] },
    { affixId: 'battle_legend_legendary_1', weight: 8, tags: ['battle'] },
    { affixId: 'battle_myth_legendary_2', weight: 8, tags: ['battle'] },
  ],
}

export const allAffixPools = [
  defaultCharacterAffixPool,
  // attackingOnlyAffixPool,
  // defencingOnlyAffixPool,
  // battleOnlyAffixPool,
  // workOnlyAffixPool,
] as const
