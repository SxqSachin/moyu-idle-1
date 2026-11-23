import type { ItemCountInfo } from "../types/gameInventory";
import type { AllGuildBuildingId, VitalityCatStatueEffect, GuildBuildingConfig, WarehouseEffect, WishingPoolEffect, DenseFogLighthouseEffect, BigCozyDenEffects, GuildGrandBathhouseEffect } from "../types/guild";
import { allGameResource } from "./allGameResources";

export const allGuildBuilding = {
  vitalityCatStatue: {
    id: "vitalityCatStatue",
    name: "活力猫猫雕塑",
    description:
      "矗立在公会花园中的精美猫咪雕塑，散发着神秘的活力光芒，激励着所有路过的公会成员！\n为公会成员提供战斗时的增益效果，提供额外的生命与魔法恢复。",
    icon: "resource:vitalityCatStatue",
    iconSize: 24,
    maxLevel: 5,
    buildCost: {
      gold: { count: 10000000 },
      stone: { count: 1000000 },
      iron: { count: 200000 },
      flashStone: { count: 150 },
    },
    buildDuration: 3600 * 2, // 60分钟

    upgradeCost: (level: number) => {
      let base: ItemCountInfo = {
        gold: { count: 10000000 / 2 * level },
        stone: { count: 1000000 / 2 * level },
        iron: { count: 200000 / 2 * level },
        steel: { count: 100000 / 2 * level },
        flashStone: { count: 150 / 2 * level },
      }

      if (level >= 2) {
        base.windBellHerb = { count: 20000 / 2 * level }
      }

      return base;
    },
    upgradeDuration: (level: number) => 3600 * 1 + 1800 * level,

    maintenanceFee: (level: number) => ({
      gold: { count: 200000 * level },
    }),
    effect: (level): VitalityCatStatueEffect => ({
      availableBuffs: {
        id: "catnipGardenEnergyBoost",
        name: "精力充沛",
        duration: +(4 + level * 0.5).toFixed(0),
        value: +(1.5 + 0.5 * level).toFixed(2),
        untilHours: 10 + 6 * +(level * 0.5).toFixed(1)
      },
    }),
    effectStr: function (level: number) {
      let effect: VitalityCatStatueEffect =
        allGuildBuilding.vitalityCatStatue.effect(level);
      return [
        `每场战斗开始时，获得“精力充沛”，持续${effect.availableBuffs.duration}回合`,
        `回合开始时额外生命恢复: ${effect.availableBuffs.value}`,
        `回合开始时额外魔法恢复: ${effect.availableBuffs.value}`,
        `持续时间： ${effect.availableBuffs.untilHours} 小时`,
      ];
    },
  },
  wishing_pool: {
    id: "wishing_pool",
    name: "许愿池",
    description:
      "公会成员可每日许愿，获得随机奖励以及当天幸运属性随机提升。",
    icon: "resource:wishingPool",
    iconSize: 18,
    maxLevel: 5,
    buildCost: {
      gold: { count: 5000000 },
      stone: { count: 100000 },
      fish: { count: 10 },
      rainbowFish: { count: 10 },
      flashFish: { count: 10 },
    },
    buildDuration: 3600, // 1小时

    upgradeCost: (level: number) => { 
      let base: ItemCountInfo = {
        gold: { count: 5000000 / 2 * level },
        stone: { count: 100000 / 2 * level },
        fish: { count: 10 / 2 * level },
        rainbowFish: { count: 10 / 2 * level },
        flashFish: { count: 10 / 2 * level },
      }

      if (level >= 2) {
        base.fatFish = { count: 10 * level };
      }

      if (level >= 3) {
        base.darkFish = { count: 10 * level };
      }

      return base; 
    },
    upgradeDuration: (level: number) => 3600 * 1 + 1800 * level,

    maintenanceFee: (level: number) => ({
      gold: { count: 200000 * level },
    }),
    effect: (level): WishingPoolEffect => {
      return {
        luck: {
          min: 0.4,
          max: 1.0 + 0.5 * level,
        },
        rewardPool: [
          {
            id: "gold",
            percent: 1,
            range: { min: 4000 + 1000 * level, max: 10000 + 10000 * level },
          },
          {
            id: "healingPotion",
            percent: 0.35 + level * 0.07,
            range: { min: 2 + level * 2 + level, max: 5 + level * 2 + level },
          },
          {
            id: "manaPotion",
            percent: 0.35 + level * 0.07,
            range: { min: 2 + level * 2 + level, max: 5 + level * 2 + level },
          },
          {
            id: "custardPudding",
            percent: 0.25 + level * 0.1,
            range: { min: 2 + level, max: 5 + level },
          },
          {
            id: "starEssence",
            percent: 0.15 + level * 0.01,
            range: { min: 1 + level, max: 2 + level },
          },
        ],
      };
    },
    effectStr: function (level: number) {
      let effect: WishingPoolEffect =
        allGuildBuilding.wishing_pool.effect(level);
      return [
        `幸运属性提升：${effect.luck.min.toFixed(
          1
        )} - ${effect.luck.max.toFixed(1)}`,
        `奖励池：`,
        ...effect.rewardPool.map((item) => {
          if (!item.id) {
            return "";
          }
          return `- ${allGameResource[item.id].name} (${
            (item.percent! * 100).toFixed(1)
          }%): ${item.range!.min} - ${item.range!.max}`;
        }),
      ];
    },
  },

  denseFogLighthouse: {
    id: "denseFogLighthouse",
    name: "迷雾指引图腾",
    description:
      "在公会中建造一座迷雾指引图腾，帮助公会成员在迷雾中前行。\n为公会成员提供迷雾战斗的增益效果。",
    icon: "resource:denseFogLighthouse",
    iconSize: 24,
    maxLevel: 5,
    buildCost: {
      gold: { count: 1000000 },
      wood: { count: 10000000 },
      stone: { count: 1000000 },
      iron: { count: 200000 },
      denseFogDust: { count: 5000 },
      denseFogMurkyCrystal: { count: 5000 },
    },
    buildDuration: 3600, // 1小时

    upgradeCost: (level: number) => {
      let base: ItemCountInfo = {
        gold: { count: 10000000 / 2 * level },
        wood: { count: 10000000 / 2 * level },
        stone: { count: 1000000 / 2 * level },
        iron: { count: 200000 / 2 * level },
        denseFogDust: { count: 5000 / 2 * level },
        denseFogMurkyCrystal: { count: 5000 / 2 * level },
      }

      return base; 
    },
    upgradeDuration: (level: number) => 3600 * 1 + 1800 * level,

    maintenanceFee: (level: number) => ({
      gold: { count: 200000 * level },
    }),
    effect: (level): DenseFogLighthouseEffect => ({
      effects: {
        dealDamageIncrease: +(4 + level).toFixed(2),
        takeDamageDecrease: +(4 + level).toFixed(2),
        modifyWhenAlone: +(11 + level).toFixed(2),
        duration: 10,
        untilHours: 8
      },
    }),
    effectStr: function (level: number) {
      let effect: DenseFogLighthouseEffect =
        allGuildBuilding.denseFogLighthouse.effect(level);
      return [
        `每场战斗开始时，获得“迷雾指引”，持续${effect.effects.duration}回合`,
        `持续时间： ${effect.effects.untilHours} 小时`,
        ` `,

        `效果：`,
        `- 激进前行：迷雾中造成的伤害提升${effect.effects.dealDamageIncrease}%。作为房主时，遭遇幻象的概率提升50%`,
        `- 稳健前行：迷雾中受到的伤害降低${effect.effects.takeDamageDecrease}%。作为房主时，遭遇幻象的概率降低50%`,
        `- 独自前行：当小队中只有你一个玩家时进入迷雾，造成的伤害提升${effect.effects.modifyWhenAlone}%，受到的伤害降低${effect.effects.modifyWhenAlone}%。`,
      ];
    },
  },
  bigCozyDen: {
    id: "bigCozyDen",
    name: "猫猫大屋",
    description:
      "当猫猫越来越多，就需要更大的屋子！",
    icon: "resource:bigCozyDen",
    iconSize: 22,
    maxLevel: 20,
    buildCost: {
      gold: { count: 25000000 },
      wood: { count: 5000000 },
      stone: { count: 1000000 },
      craftingEssence: { count: 10000 },
      flashStone: { count: 50 },
    },
    buildDuration: 3600 * 2, // 60分钟

    upgradeCost: (level: number) => {
      let base: ItemCountInfo = {
        gold: { count: 25000000 / 2 },
        sand: { count: 5000000 / 2 },
        wood: { count: 5000000 / 2 },
        stone: { count: 1000000 / 2 },
        craftingEssence: { count: 10000 / 2 },
        flashStone: { count: 30 },
      }

      return base;
    },
    upgradeDuration: (level: number) => 3600 * 1 + 1800 * level,

    maintenanceFee: (level: number) => ({
      gold: { count: 200000 * level },
    }),
    effect: (level): BigCozyDenEffects => ({
      maxGuildMemberIncrease: 15 * level, // 公会成员上限增加
    }),
    effectStr: function (level: number) {
      let effect: BigCozyDenEffects =
        allGuildBuilding.bigCozyDen.effect(level);
      return [
        `公会成员上限增加: ${effect.maxGuildMemberIncrease}个`,
      ];
    },
  },

  guildGrandBathhouse: {
    id: "guildGrandBathhouse",
    name: "猫猫大澡堂",
    description:
      "温润的木梁与石板围成的澡堂，包含冷水浴与温泉区。\n为公会成员提供生活或战斗增益，每个成员每8小时可以获取一次。",
    icon: "resource:guildGrandBathhouse",
    iconSize: 24,
    maxLevel: 5,
    buildCost: {
      gold: { count: 10000000 },
      wood: { count: 1000000 },
      stone: { count: 1000000 },
      flashStone: { count: 300 },

      frostEssence: { count: 5000 },
      crystalCarp: { count: 400 },
      lavaHeart: { count: 75 },
      emberEel: { count: 300 },

    },
    buildDuration: 3600 * 2, // 60分钟

    upgradeCost: (level: number) => {
      let base: ItemCountInfo = {
        gold: { count: 10000000 / 2 * level },
        wood: { count: 1000000 / 2 * level },
        stone: { count: 1000000 / 2 * level },
        flashStone: { count: 300 / 2 * level },

        frostEssence: { count: 5000 / 2 * level },
        crystalCarp: { count: 400 / 2 * level },
        lavaHeart: { count: 75 / 2 * level },
        emberEel: { count: 300 / 2 * level },
      }

      return base;
    },
    upgradeDuration: (level: number) => 3600 * 1 + 1800 * level,

    maintenanceFee: (level: number) => ({
      gold: { count: 200000 * level },
    }),
    effect: (level): GuildGrandBathhouseEffect => ({
      availableBuffs: {
        value: +(0.005 + 0.005 * level).toFixed(4),
        inBattleDuration: +(4 + level * 1).toFixed(0),
        untilHours: +(10.5 + (level * 0.5)).toFixed(1)
      },
    }),
    effectStr: function (level: number) {
      let effect: GuildGrandBathhouseEffect = allGuildBuilding.guildGrandBathhouse.effect(level);
      return [
        `生活动作所需时间降低: 3%`,
        `战斗内造成伤害提升：${effect.availableBuffs.value * 100}%`,
        `持续时间： ${effect.availableBuffs.untilHours} 小时`,
      ];
    },
  },

  // meowSpiritMirror: {
  //   id: "meowSpiritMirror",
  //   name: "喵灵之镜",
  //   description:
  //     "在喵灵之镜前，猫咪的灵魂会映出幻影，让同伴的身影伴你同行。\n虽不及真身强大，却能带来安心的陪伴。",
  //   icon: "resource:meowSpiritMirror",
  //   iconSize: 18,
  //   maxLevel: 5,
  //   buildCost: {
  //     silverIngot: { count: 100000 },
  //     flashStone: { count: 500 },
  //   },
  //   buildDuration: 3600, // 1小时

  //   upgradeCost: (level: number) => ({}),
  //   upgradeDuration: (level: number) => 1800 * level, // 每级升级时间为30分钟

  //   maintenanceFee: (level: number) => ({
  //     gold: { count: 200000 * level },
  //   }),
  //   effect: (level): MeowSpiritMirrorEffect => {
  //     return { };
  //   },
  //   effectStr: function (level: number) {
  //     let effect: MeowSpiritMirrorEffect =
  //       allGuildBuilding.meowSpiritMirror.effect(level);
  //     return [
  //       `猫咪可以在这里留下自己的幻象，公会内的其他猫咪可以使用幻象来进行战斗。`
  //     ];
  //   },
  // },
} as const satisfies Record<string, GuildBuildingConfig>;