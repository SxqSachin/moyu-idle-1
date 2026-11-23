import type { KittyTrait } from "~/shared/types/kitty";
import type { GameActionReward, AllGameActionID } from "~/shared/types/gameAction";
import type { AllGameResourceID } from "~/shared/types/gameResource";
import { clone } from "../utils";
import { isActionInclude } from "../utils/game/game";

/**
 * Basic kitty trait definitions.
 * Each trait implements some of the optional callbacks defined in `KittyTrait`.
 * These are minimal examples you can expand later.
 */

const asReward = (id: AllGameResourceID, count: number): GameActionReward[] => [
  { id, percent: 1, count }
]

export const allKittyTraits: Record<string, KittyTrait> = {
  fast_worker: {
    id: "fast_worker",
    name: "快手",
    effectType: 'buff',
    description: ({ level = 0 } = {}) =>
      `所有任务执行耗时降低 ${Math.floor(2 + level * 1)}%。`,
    tags: ["speed"],
    extraActionDurationDecrease({ oriDuration, traitLevel }) {
      return oriDuration * (0.02 + traitLevel * 0.01);
    },
    stackable: false,
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
  },

//   slow_worker: {
//     id: "slow_worker",
//     name: "爱睡懒觉",
//     description: ({ level = 0 } = {}) =>
//       `任务执行耗时提升20%，稀有奖励（<1%）概率提升 ${0.5 + level * 0.5}%。`,
//     tags: ["speed", "negative"],
//     extraActionDurationDecrease({ oriDuration }) {
//       return -(oriDuration * 0.2);
//     },
//     stackable: false,
//     maxLevel: 5,
//     upgradeExp: (level = 0) => 50 * (level + 1),
//   },

  extra_snack_reward: {
    id: "extra_snack_reward",
    name: "贪吃小猫",
    effectType: 'buff',
    description: ({ level = 0 } = {}) =>
      `烹饪类任务执行耗时降低${2 + level}%，有 ${
        1 + level
      }% 概率额外获得一份食物。`,
    tags: ["reward"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
    extraActionDurationDecrease({ oriDuration, traitLevel, actionId }) {
      if (!isActionInclude("allCookingAction", actionId)) {
        return 0;
      }
      return oriDuration * (0.02 + traitLevel * 0.01);
    },
    actionExtraReward: ({
      kittyUuid,
      kittyName,
      traitLevel,
      actionId,
      oriReward,
    }) => {
      if (!isActionInclude("allCookingAction", actionId)) {
        return null;
      }
      return clone(oriReward).map((r) => {
        r.percent = 0.01 + traitLevel * 0.01;
        r.from = `“${kittyName}”-贪吃小猫`;
        r.ignoreLuckFactor = true;
        r.rewardWhenCompleteBySpecialKitty = kittyUuid;
        return r;
      });
    },
  },

  //   // 健谈
  //   talkative: {
  //     id: "talkative",
  //     name: "健谈",
  //     description: ({ level = 0 } = {}) => `与其他猫咪互动时，获得 ${1 + level} 点额外好感度；互动获得奖励的概率随等级略有提升。`,
  //     tags: ["social"],
  //     // Additional callbacks can be added here
  //     upgradeExp: (level = 0) => 50 * (level + 1),
  //   },

  // 孤僻
//   loner: {
//     id: "loner",
//     name: "孤僻",
//     description: ({ level = 0 } = {}) =>
//       `任务执行耗时降低 ${
//         15 + Math.floor(level / 2)
//       }%；每拥有一个玩伴，执行耗时提升 3%。心情值不再产生正面或负面影响。`,
//     tags: ["social", "negative"],
//     maxLevel: 5,
//     upgradeExp: (level = 0) => 50 * (level + 1),
//     // Additional callbacks can be added here
//   },

//   // 社牛
//   social_butterfly: {
//     id: "social_butterfly",
//     name: "社交达人",
//     description: ({ level = 0 } = {}) =>
//       `每有一个玩伴，任务执行耗时降低 ${Math.min(
//         1 + Math.floor(level / 10),
//         15
//       )}%，最多降低15%。`,
//     tags: ["social"],
//     maxLevel: 5,
//     // Additional callbacks can be added here
//     upgradeExp: (level = 0) => 50 * (level + 1),
//   },

  patient: {
    id: "patient",
    name: "耐心",
    effectType: 'buff',
    description: ({ level = 0 } = {}) =>
      `基础耗时超过80秒的任务，任务耗时降低${4 + level * 1}。`,
    tags: ["stability"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
    extraActionDurationDecrease({ oriDuration, traitLevel }) {
      if (oriDuration <= 120000) {
        return 0;
      }

      return oriDuration * (0.04 + traitLevel * 0.01);
    },
  },

  // 夜猫子
  night_vision: {
    id: "night_vision",
    name: "夜猫子",
    effectType: 'buff',
    description: ({ level = 0 } = {}) =>
      `在夜间，任务执行耗时降低${3 + level}%。`,
    tags: ["explore"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
    extraActionDurationDecrease({ oriDuration, traitLevel }) {
      const dateNowStr = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Shanghai",
      });
      const dateHour = new Date(dateNowStr).getHours();
      const isNight = dateHour >= 19 || dateHour < 6;
      if (!isNight) {
        return 0;
      }

      return oriDuration * (0.03 + traitLevel * 0.01);
    },
  },

  sunbather: {
    id: "sunbather",
    name: "晒太阳狂",
    effectType: 'buff',
    description: ({ level = 0 } = {}) =>
      `在日间，任务执行耗时降低${3 + level}%。`,
    tags: ["rest"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
    extraActionDurationDecrease({ oriDuration, traitLevel }) {
      const dateNowStr = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Shanghai",
      });
      const dateHour = new Date(dateNowStr).getHours();
      const isNight = dateHour >= 19 || dateHour < 6;
      if (isNight) {
        return 0;
      }

      return oriDuration * (0.03 + traitLevel * 0.01);
    },
  },

  gourmand: {
    id: "gourmand",
    name: "美食家",
    effectType: 'buff',
    description: ({ level = 0 } = {}) =>
      `在烹饪类行动中有额外${4 + level}%概率获得一次额外的奖励。`,
    tags: ["cooking", "reward"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
    actionExtraReward: ({
      kittyUuid,
      kittyName,
      traitLevel,
      actionId,
      oriReward,
    }) => {
      if (!isActionInclude("allCookingAction", actionId)) {
        return null;
      }
      return clone(oriReward).map((r) => {
        r.percent = 0.04 + traitLevel * 0.01;
        r.from = `“${kittyName}”-美食家`;
        r.ignoreLuckFactor = true;
        r.rewardWhenCompleteBySpecialKitty = kittyUuid;
        return r;
      });
    },
  },

  hoarder: {
    id: "hoarder",
    name: "囤货癖",
    effectType: 'buff',
    description: ({ level = 0 } = {}) =>
      `有额外${2 + level}%概率，获得一次额外的奖励。`,
    tags: ["reward", "collection"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
    actionExtraReward: ({ kittyUuid, kittyName, traitLevel, oriReward }) => {
      return clone(oriReward).map((r) => {
        r.percent = 0.02 + traitLevel * 0.01;
        r.from = `“${kittyName}”-囤货癖`;
        r.ignoreLuckFactor = true;
        r.rewardWhenCompleteBySpecialKitty = kittyUuid;
        return r;
      });
    },
  },

  // 将战斗类特性替换为生活/工作相关的特性
//   stress_resistant: {
//     id: "stress_resistant",
//     name: "抗压",
//     description: ({ level = 0 } = {}) =>
//       `工作状态下，每小时有${5 + level}%概率不下降心情值。`,
//     tags: ["stability", "work"],
//     maxLevel: 5,
//     upgradeExp: (level = 0) => 50 * (level + 1),
//   },

//   lucky: {
//     id: "lucky",
//     name: "幸运儿",
//     description: ({ level = 0 } = {}) => `稀有奖励概率提升 ${3 + level}%。`,
//     tags: ["reward", "luck"],
//     maxLevel: 5,
//     upgradeExp: (level = 0) => 50 * (level + 1),
//   },

//   clumsy: {
//     id: "clumsy",
//     name: "笨拙",
//     description: ({ level = 0 } = {}) =>
//       `任务完成后，有${8 + level}%概率额外消耗一份资源。`,
//     tags: ["quirky", "negative"],
//     maxLevel: 5,
//     upgradeExp: (level = 0) => 50 * (level + 1),
//   },

  curious: {
    id: "curious",
    name: "好奇心",
    effectType: 'buff',
    description: ({ level = 0 } = {}) =>
      `探索任务有${4 + level}%概率获得一份额外奖励%。`,
    tags: ["explore", "discovery"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),

    actionExtraReward: ({
      kittyUuid,
      kittyName,
      traitLevel,
      actionId,
      oriReward,
    }) => {
      if (!isActionInclude("allExploreAction", actionId)) {
        return null;
      }

      return clone(oriReward).map((r) => {
        r.percent = 0.04 + traitLevel * 0.01;
        r.from = `“${kittyName}”-好奇心`;
        r.ignoreLuckFactor = true;
        r.rewardWhenCompleteBySpecialKitty = kittyUuid;
        return r;
      });
    },
  },

  navigator: {
    id: "navigator",
    name: "方向感",
    effectType: 'buff',
    description: ({ level = 0 } = {}) => `探索任务执行耗时降低${4 + level}%。`,
    tags: ["explore"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),

    extraActionDurationDecrease({ actionId, oriDuration, traitLevel }) {
      if (!isActionInclude("allExploreAction", actionId)) {
        return 0;
      }

      return oriDuration * (0.04 + traitLevel * 0.01);
    },
  },

//   frugal: {
//     id: "frugal",
//     name: "节俭",
//     description: ({ level = 0 } = {}) =>
//       `{5 + level}%概率在完成动作时，返还当前动作的消耗。`,
//     tags: ["economy"],
//     maxLevel: 5,
//     upgradeExp: (level = 0) => 50 * (level + 1),
//   },

//   spender: {
//     id: "spender",
//     name: "大手大脚",
//     description: ({ level = 0 } = {}) =>
//       `任务完成后，有${5 + level}%概率额外消耗一份资源。`,
//     tags: ["quirky"],
//     maxLevel: 5,
//     upgradeExp: (level = 0) => 50 * (level + 1),
//   },

  gadgeteer: {
    id: "gadgeteer",
    name: "小发明家",
    effectType: 'buff',
    description: ({ level = 0 } = {}) =>
      `制造/锻造类行动耗时降低${3 + level}%，有${
        3 + level
      }%概率获得一份额外奖励。`,
    tags: ["manufacture", "creative"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),

    extraActionDurationDecrease({ actionId, oriDuration, traitLevel }) {
      if (
        !isActionInclude("allLevel1Manufacture", actionId) &&
        !isActionInclude("allForgingAction", actionId)
      ) {
        return 0;
      }

      return oriDuration * (0.03 + traitLevel * 0.01);
    },
    actionExtraReward: ({
      kittyUuid,
      kittyName,
      traitLevel,
      actionId,
      oriReward,
    }) => {
      if (
        !isActionInclude("allLevel1Manufacture", actionId) &&
        !isActionInclude("allForgingAction", actionId)
      ) {
        return null;
      }

      return clone(oriReward).map((r) => {
        r.percent = 0.03 + traitLevel * 0.01;
        r.from = `“${kittyName}”-小发明家`;
        r.ignoreLuckFactor = true;
        r.rewardWhenCompleteBySpecialKitty = kittyUuid;
        return r;
      });
    },
  },

  // ==== 心情类特性 === //

  comedian: {
    id: "comedian",
    name: "搞笑担当",
    effectType: 'buff',
    description: ({ level = 0 } = {}) =>
      `与其他猫咪玩耍时，提升自身与对方${1 * level}点心情值。`,
    tags: ["social", "entertain"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
    async onEncounter({
      targetKittyUuid,
      kittyUuid,
      kittyName,
      traitLevel,
      requestIncreaseMood,
    }) {
      await requestIncreaseMood?.(kittyUuid, 1 * traitLevel, "特性-“搞笑担当”");
      await requestIncreaseMood?.(targetKittyUuid, 1 * traitLevel, `[${kittyName}]的“搞笑担当”`);
    },
  },

  poet: {
    id: "poet",
    name: "诗人",
    effectType: 'buff',
    description: ({ level = 0 } = {}) =>
      `与其他猫咪玩耍时，提升对方${1 + level}点心情值。`,
    tags: ["creative"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
    async onEncounter({
      targetKittyUuid,
      kittyUuid,
      traitLevel,
      requestIncreaseMood,
    }) {
      await requestIncreaseMood?.(targetKittyUuid, 1 + traitLevel, "特性-“诗人”");
    },
  },

  tidy: {
    id: "tidy",
    name: "整洁",
    effectType: 'buff',
    description: ({ level = 0 } = {}) =>
      `与其他猫咪玩耍时，提升自身${1 + level}点心情值。`,
    tags: ["utility"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
    async onEncounter({ kittyUuid, traitLevel, requestIncreaseMood }) {
      await requestIncreaseMood?.(kittyUuid, 1 + traitLevel, "特性-“整洁”");
    },
  },

  prankster: {
    id: "prankster",
    name: "恶作剧",
    effectType: 'both',
    description: ({ level = 0 } = {}) =>
      `与其他猫咪玩耍时，降低对方${1 + level}点心情值，提升自身${
        1.5 + level
      }点心情值。`,
    tags: ["quirky"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
    async onEncounter({
      targetKittyUuid,
      kittyName,
      kittyUuid,
      requestDecreaseMood,
      requestIncreaseMood,
      traitLevel,
    }) {
      await requestIncreaseMood?.(kittyUuid, 1 + traitLevel, "特性-“恶作剧”");
      await requestDecreaseMood?.(targetKittyUuid, 1.5 + traitLevel, `[${kittyName}]的“恶作剧”`);
    },
  },

  messy: {
    id: "messy",
    name: "邋遢",
    effectType: 'debuff',
    description: ({ level = 0 } = {}) =>
      `与其他猫咪玩耍时，降低自身与对方${1 + level}点心情值。`,
    tags: ["quirky", "negative"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
    async onEncounter({
      targetKittyUuid,
      kittyUuid,
      kittyName,
      traitLevel,
      requestDecreaseMood,
    }) {
      await requestDecreaseMood?.(kittyUuid, 1 + traitLevel, "特性-“邋遢”");
      await requestDecreaseMood?.(targetKittyUuid, 1 + traitLevel, `[${kittyName}]的“邋遢”`);
    },
  },

  // 乐观
  optimist: {
    id: "optimist",
    name: "乐观",
    effectType: 'buff',
    description: ({ level = 0 } = {}) => `因任何原因恢复心情时，额外恢复${0.2 * level}点心情。`,
    tags: ["stability", "positive"],
    maxLevel: 5,
    upgradeExp: (level = 0) => 50 * (level + 1),
    onModifyMood({ old, delta, traitLevel }) {
      if (delta > 0) {
        return {
          extraDelta: 0.2 * traitLevel,
        };
      }
      return {
        extraDelta: 0,
      };
    },
  },
};

export const getKittyTrait = (id: string): KittyTrait | undefined => {
  return allKittyTraits[id];
};

export default allKittyTraits;
