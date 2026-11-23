import type { BattlePyreAltarEffect, BattlePyreAltarExtraConfig, CatVillageMonumentEffect, CatVillageMonumentExtraConfig, KittyHomeServiceCenter, VillageBuildingConfig } from "../types/village/building";
import { allGameResource } from "./allGameResources";

export const exceptPlayerCount = 500

export const allVillageBuilding = {
  catVillageMonument: {
    id: "catVillageMonument",
    name: "猫猫镇纪念碑",
    description:
      "矗立在小镇中心的巨大纪念碑，由猫猫镇上从事各行业工作的猫咪们合作建造而成，上面雕刻着猫咪日常劳作的景象。",
    icon: "resource:catVillageMonument",
    iconSize: 24,
    maxLevel: 2,
    buildCost: {
      gold: { count: exceptPlayerCount * 4550000 },
      stone: { count: exceptPlayerCount * 5000 },

      shell: { count: exceptPlayerCount * 2500 },

      berry: { count: exceptPlayerCount * 2500 },
      wood: { count: exceptPlayerCount * 2500 },

      fish: { count: exceptPlayerCount * 2000 },
      salmon: { count: exceptPlayerCount * 2000 },

      chickenEgg: { count: exceptPlayerCount * 2000 },
      milk: { count: exceptPlayerCount * 2000 },

      simpleSalad: { count: exceptPlayerCount * 1500 },
      fishSoup: { count: exceptPlayerCount * 1500 },

      axe: { count: exceptPlayerCount * 300 },
      steel: { count: exceptPlayerCount * 300 },
      catFurCoat: { count: exceptPlayerCount * 300 },

      "axe+5": { count: exceptPlayerCount * 100 },

      catHairball: { count: exceptPlayerCount * 1000 },
      catPawStamp: { count: exceptPlayerCount * 5 },
    },
    buildDuration: 3600 * 8, // 8小时

    upgradeCost: (level: number) => {
      if (level >= 1) {
        return {
          gold: { count: exceptPlayerCount * 4550000 },
          silverOre: { count: exceptPlayerCount * 2500 },

          shell: { count: exceptPlayerCount * 2500 },

          dawnBlossom: { count: exceptPlayerCount * 500 },
          bamboo: { count: exceptPlayerCount * 2500 },

          fish: { count: exceptPlayerCount * 2000 },
          tuna: { count: exceptPlayerCount * 2000 },

          animalManure: { count: exceptPlayerCount * 2000 },

          catMint: { count: exceptPlayerCount * 500 },
          custardPudding: { count: exceptPlayerCount * 500 },

          glassBottles: { count: exceptPlayerCount * 300 },
          cashmere: { count: exceptPlayerCount * 300 },

          wool: { count: exceptPlayerCount * 1000 },
          catPawStamp: { count: exceptPlayerCount * 6 },
        }
      }


      const factor = 0.4 * level;
      const base = allVillageBuilding.catVillageMonument.buildCost as Record<
        string,
        { count: number }
      >;
      const cost: Record<string, { count: number }> = {};
      for (const id in base) {
        const c = base[id]?.count ?? 0;
        cost[id] = { count: Math.floor(c * factor) };
      }
      return cost;
    },
    upgradeDuration: (level: number) => 3600 * (level + 2),

    maintenanceFee: (level: number) => ({}),
    effect: (level): CatVillageMonumentEffect => {
      return {
        expPercent: 0.16 + level * 0.01, // 每级为生活动作提供1%经验加成
        donateExpPercent: 0.08 + level * 0.01,
        extraOutputPercent: 0.005 + level * 0.005,
      };
    },
    effectStr: function (level: number) {
      let effect: CatVillageMonumentEffect =
        allVillageBuilding.catVillageMonument.effect(level);
      return [
        `生活动作经验加成: +${(effect.expPercent * 100).toFixed(2)}%`,
        `祈福期间-动作经验加成: +${(effect.donateExpPercent * 100).toFixed(2)}%`,
        `祈福期间-额外产出概率: +${(effect.extraOutputPercent * 100).toFixed(2)}%`,
      ];
    },

    extra: (level): CatVillageMonumentExtraConfig => {
      return {
        consecrateItems: {
          gold: { count: 100000 },
          sewingEssence: { count: 2 },
          craftingEssence: { count: 2 },
        },
        rewardPool: [
          {
            ids: [
              "milk",
              "chickenEgg",
              "simpleSalad",
            ],
            percent: 0.6,
            range: { min: 2, max: 3 },
          },
          {
            ids: [
              "berryWine",
              "custardPudding",
              "collectingTart",
              "fishingTart",
              "farmingAnimalTart",
              "miningTart",
              "sewingTart",
              "cookingTart",
              "manufactureAndForgingTart",
              "knowledgeTart",
              "exploreTart",
            ],
            percent: 0.20,
            range: { min: 2, max: 3 },
          },

          {
            ids: [
              "starEssence",
              "mysticalEssence",
              "catPotion",
            ],
            percent: 0.05,
            range: { min: 2, max: 3 },
          },

          {
            ids: ["luckyMint", "luckySashimiPlatter"],
            percent: 0.03,
            range: { min: 1, max: 2 },
          },
          {
            ids: ["superLuckyBerryPie", "superLuckyMushroomStew", "reconstructionCommemorative", "bell_of_2025"],
            percent: 0.02,
            range: { min: 1, max: 1 },
          },


          { ids: ["flashStone"], percent: 0.09, range: { min: 3, max: 4 } },
          {
            ids: ["hugeMushroom", "mysteriousBerry_1"],
            percent: 0.008,
            range: { min: 4, max: 5 },
          },

          {
            ids: [
              "t_title_hopeful_heart",
              "t_title_unlucky_legend",
              "t_title_meow_prophet",
              "t_title_eternal_luck",
            ],
            percent: 0.002,
            range: { min: 1, max: 1 },
          },
        ],
        extraDropRewardPerTimes: Math.floor(30 - level / 2),
      };
    }
  },

  battlePyreAltar: {
    id: "battlePyreAltar",
    name: "征战圣火纪念碑",
    description:
      "圣火熊熊燃烧，为战斗喵喵带来希望。每一次供奉，都让火焰更加炽烈。",
    icon: "resource:battlePyreAltar",
    iconSize: 24,
    maxLevel: 1,
    buildCost: {
      gold: { count: exceptPlayerCount * 4250000 },
      wood: { count: exceptPlayerCount * 1750000 },
      lavaHeart: { count: exceptPlayerCount * 1 },
      pure_monster_essence_lv1: { count: exceptPlayerCount * 100 },
      pure_monster_essence_lv2: { count: exceptPlayerCount * 50 },
      pure_monster_essence_lv3: { count: exceptPlayerCount * 25 },
    },
    buildDuration: 3600 * 8, // 8小时

    upgradeCost: (level: number) => {
      return {
        gold: { count: exceptPlayerCount * 1250000 },
        wood: { count: exceptPlayerCount * 100000 },
        lavaHeart: { count: exceptPlayerCount * 1 },
        pure_monster_essence_lv1: { count: exceptPlayerCount * 200 },
        pure_monster_essence_lv2: { count: exceptPlayerCount * 150 },
        pure_monster_essence_lv3: { count: exceptPlayerCount * 100 },
      };
    },
    upgradeDuration: (level: number) => 3600 * (level + 2),

    maintenanceFee: (level: number) => ({}),
    effect: (level): BattlePyreAltarEffect => {
      return {
        baseExpPercent: 0.03 + level * 0.01, // 每级为战斗行为提供1%经验加成

        donateExpPercent: 0.03 + level * 0.01, // 每级为战斗行为提供1%经验加成
        donateExtraDropPercent: 0.03 + level * 0.01, // 每级为战斗行为提供1%额外掉落加成

        durationSecondsEachDonate: (60 * 10) * 1000, // 每次捐献增加15分钟
      };
    },
    effectStr: function (level: number) {
      let effect: BattlePyreAltarEffect = allVillageBuilding.battlePyreAltar.effect(level);
      return [
        `基础战斗行为经验加成: +${(effect.baseExpPercent * 100).toFixed(2)}%`,

        `圣火点燃期间-战斗行为额外经验加成: +${(effect.donateExpPercent * 100).toFixed(2)}%`,
        `圣火点燃期间-战利品额外掉落概率: +${(effect.donateExtraDropPercent * 100).toFixed(2)}%`,
      ];
    },
    extra: (level): BattlePyreAltarExtraConfig => {
      return {
        consecrateItems: {
          gold: { count: 175000 },
          ironSword: { count: 1 },
          pure_monster_essence_lv1: { count: 4 },
        },
        rewardPool: [
          {
            ids: Object.values(allGameResource).filter((r) =>
                  r.alchemyTag?.includes("monster_essence_lv2")
                ).map(r => r.id),
            percent: 0.89, // - 0.2
            range: { min: 1, max: 2 },
          },
          {
            ids: Object.values(allGameResource).filter((r) =>
                  r.alchemyTag?.includes("monster_essence_lv3")
                ).map(r => r.id),
            percent: 0.064,
            range: { min: 1, max: 2 },
          },

          {
            ids: [
              'fluffyBufferPact',
              'frenziedPact',
              'clawSharpeningPact',
              'fleaHotbedPact',
              'aberrantBossSurgePact',
              'traitorsOathPact',
              'thornPact',
              'mistServitudePact',
              'shadowPact',
              'silencePact',
            ],
            percent: 0.07,
            range: { min: 1, max: 1 },
          },

          {
            ids: Object.values(allGameResource).filter((r) =>
                  r.alchemyTag?.includes("monster_essence_lv3")
                ).map(r => r.id),
            percent: 0.030,
            range: { min: 1, max: 1 },
          },

          {
            ids: [
              'fluffyBufferPactTransmutation',
              'frenziedPactTransmutation',
              'clawSharpeningPactTransmutation',
              'fleaHotbedPactTransmutation',
              'aberrantBossSurgePactTransmutation',
              'traitorsOathPactTransmutation',
              'thornPactTransmutation',
              // 'shadowPactTransmutation',
              // 'silencePactTransmutation',
            ],
            percent: 0.02,
            range: { min: 1, max: 2 },
          },

          {
            ids: Object.values(allGameResource).filter((r) =>
                  r.alchemyTag?.includes("monster_essence_lv4")
                ).map(r => r.id),
            percent: 0.004,
            range: { min: 1, max: 1 },
          },

          {
            ids: [
              "t_title_t_warrior",
              "t_title_t_mage",
              "t_title_t_berserker",
              "t_title_t_assassin",
              "t_title_t_archer",
            ],
            percent: 0.002,
            range: { min: 1, max: 1 },
          },
        ],
        extraDropRewardPerTimes: Math.floor(30 - level / 2),
      };
    }
  },

  kittyHomeServiceCenter: {
    id: "kittyHomeServiceCenter",
    name: "猫猫家政服务中心",
    description:
      "专为小镇猫咪们建立的温馨家政服务中心，当您有需求时，就会有专业的猫猫提供上门服务。",
    icon: "resource:kittyHomeServiceCenter",
    iconSize: 24,
    maxLevel: 2,
    buildCost: {
      gold: { count: exceptPlayerCount * 800000 },
      stone: { count: exceptPlayerCount * 50000 },
      iron: { count: exceptPlayerCount * 5350 },
      cashmere: { count: exceptPlayerCount * 2500 },
      ironMachinistHammer: { count: ~~(exceptPlayerCount * 0.25) },
      ironTongs: { count: ~~(exceptPlayerCount * 0.25) },
    },
    buildDuration: 3600 * 4, // 2小时

    upgradeCost: (level: number) => {
      if (level == 1) {
        return {
          gold: { count: exceptPlayerCount * 800000 },
          stone: { count: exceptPlayerCount * 50000 },
          animalManure: { count: exceptPlayerCount * 750 },
          fertBasic: { count: exceptPlayerCount * 750 },
          dawnBlossom: { count: exceptPlayerCount * 200 },
          windBellHerb: { count: exceptPlayerCount * 200 },
          nutrientEssence: { count: exceptPlayerCount * 75 },
        }
      }

      const factor = 0.5 * level;
      const base = allVillageBuilding.kittyHomeServiceCenter.buildCost as Record<
        string,
        { count: number }
      >;
      const cost: Record<string, { count: number }> = {};
      for (const id in base) {
        const c = base[id]?.count ?? 0;
        cost[id] = { count: Math.floor(c * factor) };
      }
      return cost;
    },

    upgradeDuration: (level: number) => 3600 * (level + 1),

    maintenanceFee: (level: number) => ({
      gold: { count: 200000 * level },
    }),
    effect: (level): KittyHomeServiceCenter => {
      let allDesc: string[] = [
        "上门家具维修：当猫舍中已启用的家具耐久度降低至4%，且您的库存中存在可用于维修的资源时，家政服务中心会主动派猫咪上门为您进行维修。（耐久度大于0且主动停用的家具不会进行维修）",
        "作物收获与补种：种植的作物成熟时，会自动进行收获并按原配置进行补种（相同的种子及肥料配置）。",
        "业务扩展中...",
        "业务扩展中...",
        "业务扩展中...",
        "业务扩展中...",
        "业务扩展中...",
        "业务扩展中...",
      ];

      return {
        description: allDesc.slice(0, level),
      };
    },
    effectStr: function (level: number) {
      let effect: KittyHomeServiceCenter =
        allVillageBuilding.kittyHomeServiceCenter.effect(level);
      return [...effect.description];
    },
  },
} as const satisfies Record<string, VillageBuildingConfig>;