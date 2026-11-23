import type { GameUserUniqueFlagCheck } from "~/shared/types/gameEffect";

export const avatarCheck = {
  "avatar_1.png": [],
  "avatar_2.png": [],
  "avatar_3.png": [],
  "avatar_4.png": [],
  "avatar_5.png": [],
  "avatar_6.png": [],
  "avatar_7.png": [],
  "avatar_8.png": [],
  "avatar_9.png": [],
  "avatar_10.png": [],
  "avatar_11.png": [],
  "avatar_12.png": [],
  "avatar_13.png": [],
  "avatar_14.png": [],
  "avatar_15.png": [],
  "avatar_16.png": [],
  "avatar_17.png": [],

  "avatarAlchemist.gif": [
    {
        condition: 'has',
        data: {
            type: 'avatar',
            key: 'avatarAlchemist',
        },
        conditionDescription: "拥有“头像-炼金术师喵”"
    }
  ],


  "avatarBattleUnitCard_Warrior.png": [
    {
        condition: 'has',
        data: {
            type: 'battleStyle',
            key: 'battleStyleWarrior',
        },
        conditionDescription: "拥有“战斗面板样式-战士喵”"
    }
  ],
  "avatarBattleUnitCard_WarriorAnim.gif": [
    {
        condition: 'has',
        data: {
            type: 'battleStyle',
            key: 'battleStyleWarrior',
        },
        conditionDescription: "拥有“战斗面板样式-战士喵”"
    }
  ],
  "avatarBattleUnitCard_Magical.png": [
    {
        condition: 'has',
        data: {
            type: 'battleStyle',
            key: 'battleStyleMagical',
        },
        conditionDescription: "拥有“战斗面板样式-魔法师喵”"
    }
  ],
  "avatarBattleUnitCard_MagicalAnim.gif": [
    {
        condition: 'has',
        data: {
            type: 'battleStyle',
            key: 'battleStyleMagical',
        },
        conditionDescription: "拥有“战斗面板样式-魔法师喵”"
    }
  ],
  "avatarBattleUnitCard_Cleric.png": [
    {
        condition: 'has',
        data: {
            type: 'battleStyle',
            key: 'battleStyleCleric',
        },
        conditionDescription: "拥有“战斗面板样式-牧师喵”"
    }
  ],
  "avatarBattleUnitCard_ClericAnim.gif": [
    {
      condition: "has",
      data: {
        type: "battleStyle",
        key: "battleStyleCleric",
      },
      conditionDescription: "拥有“战斗面板样式-牧师喵”",
    },
  ],

  "avatarBattleUnitCard_Ninja.png": [
    {
        condition: 'has',
        data: {
            type: 'battleStyle',
            key: 'battleStyleNinja',
        },
        conditionDescription: "拥有“战斗面板样式-杀手喵”"
    }
  ],
} as const satisfies Record<string, GameUserUniqueFlagCheck[]>;