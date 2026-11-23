import type { CharacterStatusInfo } from "../types/characterInfo";
import type { TalentCat } from "../types/talentCat";
import { clone } from "../utils";
import { allGameAction } from "./allGameActions";

// 猫咪专家定义：可影响某类动作的效率、奖励、成功率等
export const allTalentCat = [
  {
    id: "farmingAnimalExpert",
    name: "畜牧专家猫猫",
    description: "猫国大学动物饲养专业毕业的高材生，他能帮助你科学畜牧。",
    actionDesc: "畜牧提供额外产出",
    icon: "🐮",
    hourlyWage: [
      { resourceId: "gold", count: 3000 },
      { resourceId: "custardPudding", count: 2 }
    ],
    actionOverride: {
      "farmingChicken": {
        baseDuration: 12000,
        rewards: [
          {
            from: "畜牧专家",
            id: "chickenEgg",
            percent: 1,
            "range": {
              "min": 2,
              "max": 3,
            },
          },
        ]
      },
      "farmingCow": {
        baseDuration: 12000,
        rewards: [
          {
            from: "畜牧专家",
            id: "milk",
            percent: 1,
            "range": {
              "min": 2,
              "max": 3,
            },
          },
        ]
      },
      "farmingSheep": {
        baseDuration: 12000,
        rewards: [
          {
            from: "畜牧专家",
            id: "wool",
            percent: 1,
            "range": {
              "min": 2,
              "max": 3,
            },
          },
        ]
      },
      "sericulture": {
        baseDuration: 27000,
        rewards: [
          {
            from: "畜牧专家",
            id: 'silk',
            percent: 1,
            "range": {
              "min": 2,
              "max": 3,
            },
          },
        ]
      },
      "pearlCultivation": {
        baseDuration: 120000,
        rewards: [
          {
            "id": "pearl",
            from: "畜牧专家",
            "percent": 0.65,
            "count": 1
          },
          {
            "id": "moonPearl",
            from: "畜牧专家",
            "percent": 0.03,
            "range": {
              "min": 1,
              "max": 2,
            },
          },
          {
            "id": "blackPearl",
            from: "畜牧专家",
            "percent": 0.01,
            count: 1,
          }
        ]
      },
    }
  },
  {
    id: "fishingExpert",
    name: "钓鱼专家猫猫",
    description: "经验丰富的渔夫猫，知道哪里有最肥美的鱼儿，绝不空军。",
    actionDesc: "钓鱼提供额外产出",
    icon: "🎣",
    hourlyWage: [
      { resourceId: "gold", count: 5000 },
      { resourceId: "custardPudding", count: 1 },
      { resourceId: "berryWine", count: 1 },
    ],
    actionOverride: {
      "fishing": {
        rewards: [
          {
            "id": "moonlightShrimp",
            "from": "钓鱼专家",
            "percent": 0.08 * (1 + 0.25),
            "count": 1
          },
          {
            "id": "crystalCarp",
            "from": "钓鱼专家",
            "percent": 0.08 * (1 + 0.25),
            "count": 1
          },
          {
            "id": "mysticalKoi",
            "from": "钓鱼专家",
            "percent": +(0.02 * (1 + 0.25)).toFixed(2),
            "count": 1
          },
        ]
      },
      "deepSeaFishing": {
        "id": "deepSeaFishing",
        "rewards": [
          {
            "id": "tuna",
            "from": "钓鱼专家",
            "percent": 0.6 * (1 + 0.25),
            "range": {
              "min": 1,
              "max": 3
            }
          },
          {
            "id": "jadeTuna",
            "from": "钓鱼专家",
            "percent": 0.05 * (1 + 0.25),
            "range": {
              "min": 1,
              "max": 2
            }
          }
        ],
      },
      "mysticalFishing": {
        "rewards": [
          {
            "id": "rareCatfish",
            "from": "钓鱼专家",
            "percent": 0.2,
            "range": {
              "min": 1,
              "max": 2
            }
          },
          {
            "id": "mysticalKoi",
            "from": "钓鱼专家",
            "percent": 0.2,
            "count": 1
          },
          {
            "id": "rainbowFish",
            "from": "钓鱼专家",
            "percent": 0.003,
            "range": {
              "min": 1,
              "max": 1
            }
          },
          {
            "id": "fatFish",
            "from": "钓鱼专家",
            "percent": 0.003,
            "range": {
              "min": 1,
              "max": 1
            }
          }
        ],
      },
    }
  },
  {
    id: "enhanceExpert",
    name: "强化专家猫猫",
    description: "祖传老铁匠，能帮助你提升装备强化成功率。",
    actionDesc: "强化概率提升20%（️x120%）",
    icon: "✨",
    hourlyWage: [
      { resourceId: "gold", count: 12000 },
      { resourceId: "berryPie", count: 1 },
      { resourceId: "berryWine", count: 1 }
    ],
    effect: {},
    actionOverride: null
  },
  {
    id: "teacherExpert",
    name: "老师猫猫",
    description: "猫国大学博士高材生猫猫，力量和智力双修，会监督你好好学习。",
    actionDesc: "阅读与复习效率提升",
    icon: "🧑‍🏫",
    hourlyWage: [
      { resourceId: "gold", count: 12000 },
      { resourceId: "fishSoup", count: 2 },
      { resourceId: "custardPudding", count: 2 }
    ],
    actionOverride: {
      "reading": {
        "baseDuration": 80000,
        "characterImprove": [
          {
            "status": "intelligence",
            "increaseExp": 6,
            from: "猫猫老师"
          },
          {
            "status": "knowledge",
            "increaseExp": 6,
            from: "猫猫老师"
          }
        ]
      },
      "combatExercise": {
        "baseDuration": 80000,
        "characterImprove": [
          {
            "status": "attacking",
            "increaseExp": 4,
            from: "猫猫老师"
          },
          {
            "status": "defencing",
            "increaseExp": 4,
            from: "猫猫老师"
          }
        ]
      },
      "compileStrengthBook": {
        "characterImprove": [
          {
            "status": "strength",
            "increaseExp": 3,
            from: "猫猫老师"
          },
        ]
      },
      "compileDexterityBook": {
        "characterImprove": [
          {
            "status": "dexterity",
            "increaseExp": 3,
            from: "猫猫老师"
          },
        ]
      },
      "compileIntelligenceBook": {
        "characterImprove": [
          {
            "status": "intelligence",
            "increaseExp": 3,
            from: "猫猫老师"
          },
        ]
      },
    },
    effect: { }
  },
  {
    id: "fitnessCoachCat",
    name: "健身教练猫猫",
    description: "强壮的肌肉猫猫，他会使用更科学的训练方法帮助你获得更好的锻炼成果。",
    actionDesc: "锻炼行动给予的经验更多",
    icon: "🏋️",
    hourlyWage: [
      { resourceId: "gold", count: 10000 },
      { resourceId: "ryeBread", count: 5 },
      { resourceId: "milkManaShake", count: 2 },
      { resourceId: "windBellMilkShake", count: 1 },
    ],
    actionOverride: {
      "combatExercise": {
        "characterImprove": [
          {
            "status": "attacking",
            "increaseExp": 6,
            from: "健身教练猫猫"
          },
          {
            "status": "defencing",
            "increaseExp": 6,
            from: "健身教练猫猫"
          }
        ]
      },
      "combatExerciseAttack": {
        "characterImprove": [
          {
            "status": "attacking",
            "increaseExp": 10,
            from: "健身教练猫猫"
          },
        ]
      },
      "combatExerciseDefence": {
        "characterImprove": [
          {
            "status": "defencing",
            "increaseExp": 10,
            from: "健身教练猫猫"
          }
        ]
      },
      "running": {
        "characterImprove": [
          {
            "status": "dexterity",
            "increaseExp": 6,
            from: "健身教练猫猫"
          },
          {
            "status": "stamina",
            "increaseExp": 6,
            from: "健身教练猫猫"
          }
        ]
      },
      "weightlifting": {
        "characterImprove": [
          {
            "status": "stamina",
            "increaseExp": 6,
            from: "健身教练猫猫"
          },
          {
            "status": "strength",
            "increaseExp": 6,
            from: "健身教练猫猫"
          }
        ]
      },
      "swim": {
        "characterImprove": [
          {
            "status": "stamina",
            "increaseExp": 12,
            from: "健身教练猫猫"
          },
          {
            "status": "dexterity",
            "increaseExp": 6,
            from: "健身教练猫猫"
          }
        ]
      },
      "boxing": {
        "characterImprove": [
          {
            "status": "stamina",
            "increaseExp": 4,
            from: "健身教练猫猫"
          },
          {
            "status": "strength",
            "increaseExp": 4,
            from: "健身教练猫猫"
          },
          {
            "status": "attacking",
            "increaseExp": 6,
            from: "健身教练猫猫"
          },
          {
            "status": "defencing",
            "increaseExp": 6,
            from: "健身教练猫猫"
          },
        ]
      },
      "toughnessTraining": {
        "characterImprove": [
          {
            "status": "stamina",
            "increaseExp": 10,
            from: "健身教练猫猫"
          },
          {
            "status": "defencing",
            "increaseExp": 10,
            from: "健身教练猫猫"
          }
        ]
      },
      "yoga": {
        "characterImprove": [
          {
            "status": "stamina",
            "increaseExp": 6,
            from: "健身教练猫猫"
          },
          {
            "status": "dexterity",
            "increaseExp": 12,
            from: "健身教练猫猫"
          }
        ]
      },
    },
    effect: { }
  },
  {
    id: "sewingExpert",
    name: "缝纫专家猫猫",
    description: "手超快的缝纫猫猫，能让你有几率一次获得两份收获。",
    actionDesc: "基础缝纫产出翻倍",
    icon: "🧵",
    hourlyWage: [
      { resourceId: "gold", count: 8000 },
      { resourceId: "fishSoup", count: 1 },
      { resourceId: "sashimiPlatter", count: 1 }
    ],
    actionOverride: {
      "sewCashmere": {
        rewards: [
          {
            from: "缝纫专家",
            id: "cashmere",
            percent: 0.3,
            range: {
              min: 1,
              max: 2
            }
          }
        ]
      },
      "sewSilkFabric": {
        rewards: [
          {
            from: "缝纫专家",
            id: "silkFabric",
            percent: 0.3,
            range: {
              min: 1,
              max: 2
            }
          }
        ]
      },
      "sewSilkMageBurqa": {
        rewards: [
          {
            from: "缝纫专家",
            id: "silkMageBurqa",
            percent: 0.05,
            range: {
              min: 1,
              max: 1
            }
          }
        ]
      },
      "sewSilkTightsCloth": {
        rewards: [
          {
            from: "缝纫专家",
            id: "silkTightsCloth",
            percent: 0.05,
            range: {
              min: 1,
              max: 1
            }
          }
        ]
      },
      "sewFluffFabric": {
        rewards: [
          {
            from: "缝纫专家",
            id: "fluffFabric",
            percent: 0.05,
            range: {
              min: 1,
              max: 1
            }
          }
        ]
      },
      "separateFluffstone": {
        rewards: [
          {
            from: "缝纫专家",
            id: "fluff",
            percent: 0.05,
            range: {
              min: 1,
              max: 1
            }
          }
        ]
      }
    },
    effect: { }
  },
  {
    id: "battleLogisticsExpert",
    name: "战场后勤猫猫",
    description: "从猫国军事学院毕业的专业战场清理员（简历上这么写的），能把战场翻个底朝天，陪你出生入死。",
    actionDesc: "战斗物品掉落概率提升25%（x125%）",
    icon: "⚔️",
    hourlyWage: [
      { resourceId: "gold", count: 16000 },
      { resourceId: "berryWine", count: 3 },
      { resourceId: "simpleSalad", count: 1 }
    ],
    effect: {},
    actionOverride: null
  },

  {
    id: "baseMercenary",
    name: "见习雇佣兵猫猫",
    description: "一伙看起来还挺专业的雇佣兵猫，可以协助初学者战斗。",
    actionDesc: "单人作战时，会有一支见习雇佣兵队伍协助你战斗",
    icon: "🪖",
    hourlyWage: [
      { resourceId: "gold", count: 4000 },
      { resourceId: "mushroomStew", count: 6 },
      { resourceId: "berryWine", count: 1 }
    ],
    dynamicHourlyWage: (character: CharacterStatusInfo) => {
      if (character.battle.level < 25) {
        return [
          { resourceId: "mushroomStew", count: 1 },
        ]
      }

      if (character.battle.level < 45) {
        return [
          { resourceId: "mushroomStew", count: 2 },
        { resourceId: "gold", count: 100 },
        ]
      }

      return [
        { resourceId: "gold", count: 4000 },
        { resourceId: "mushroomStew", count: 6 },
        { resourceId: "berryWine", count: 1 }
      ]
    },
    dynamicMaxHireHour: (character: CharacterStatusInfo) => {
      if (character.battle.level < 45) {
        return 48;
      }

      return -1
    },
    effect: {},
    actionOverride: null
  },
  {
    id: "extraExpExpert",
    name: "卷王助教喵",
    description: "一位卷王，24x7不停歇的工作，帮助你在日常行动中更好的总结经验。你要你愿意包他一日三餐(含甜点)，他就能帮你提升所有动作的经验获取。",
    actionDesc: "所有队列动作经验+25%（x125%），并提供6点额外经验",
    icon: "🐟",
    hourlyWage: [
      { resourceId: "gold", count: 350000 },
      { resourceId: "ryeBread", count: 6 },
      { resourceId: "cloudFluffCandy", count: 2 },
      { resourceId: "dawnBlossomWine", count: 1 },
      { resourceId: "windBellWine", count: 1 }
    ],
    actionOverride: (() => {
      const res: { [actionId: string]: { characterImprove: { status: any; increaseExp: number; from: string }[] } } = {};
      Object.values(allGameAction).forEach((action) => {

        const isDismentleAction = action.id.startsWith('dismantle_')
        if (isDismentleAction) {
          return;
        }

        // clone to ensure we never mutate original objects
        const cis = action.characterImprove ? clone(action.characterImprove) : undefined;
        if (cis && cis.length > 0) {
          const bonus = cis.map((ci) => ({
            status: ci.status,
            increaseExp: 6 + (+(ci.increaseExp * 0.25).toFixed(2)),
            from: "卷王助教喵",
          }));
          res[action.id] = {
            characterImprove: bonus,
          };
        }
      });
      return res;
    })()
  },
  // {
  //   id: "battleHelpExpert",
  //   name: "战斗后勤猫猫",
  //   description: "后勤猫猫专门负责打扫战场，帮助你从战场找到更多战利品。",
  //   actionDesc: "战利品掉落率提升30%（乘法）",
  //   icon: "⚔️",
  //   hourlyWage: [
  //     { resourceId: "gold", count: 8000 },
  //     { resourceId: "berryWine", count: 2 },
  //     { resourceId: "custardPudding", count: 2 }
  //   ],
  //   actionOverride: null,
  //   effect: { }
  // }
] as const as Readonly<TalentCat[]>;

export default allTalentCat;