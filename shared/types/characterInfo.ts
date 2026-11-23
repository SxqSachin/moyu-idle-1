import type { allTitles } from "../data/allTitle"
import type { AllBattleStateId, AllGlobalActionDurationEffectStateId, AllGlobalStatusEffectStateId, BattleStateInBattleExtraInfo } from "./BattleState"
import type { AllGameActionID } from "./gameAction"
import type { AllGameResourceID } from "./gameResource"
import type { GameBattleLogic, GameCharacterBattleSkillInfo, GameFullBattleLogic } from "./skill"
import type { GameUserCustomStyle } from "./style"
import type { UnitStatusDetail } from "./unit"

export type UnitStatusDesc = {
    id: AllCharacterStatusType
    name: string
    description: string
    icon: string
    levelDesc?: string

    calc?: (info: CharacterStatusDetail) => {
      [key: string]: number | string
    }
}

export type CharacterStatusDetail = {
  currentExp: number

  fromEquipment?: number
  fromWorkEquipment?: number

  fromSkillTreeNode?: number

  fromAffix?: number

  fromTitle?: {
    [key: string]: number
  }

  fromInactiveTitle?: {
    [key: string]: number
  }

  fromOther?: {
    [key: string]: number
  }

  final?: number

} & UnitStatusDetail

export type CharacterStatusInfo = {
  collecting: CharacterStatusDetail  // 收集
  mining: CharacterStatusDetail          // 采矿
  fishing: CharacterStatusDetail          // 钓鱼
  farmingAnimal: CharacterStatusDetail   // 畜牧
  farmingPlant: CharacterStatusDetail    // 种植
  cooking: CharacterStatusDetail         // 烹饪
  manufacturing: CharacterStatusDetail   // 制造
  forging: CharacterStatusDetail   // 锻造
  sewing: CharacterStatusDetail   // 缝制
  trading: CharacterStatusDetail         // 交易
  knowledge: CharacterStatusDetail       // 学识
  exploring: CharacterStatusDetail       // 探索

  mysterious: CharacterStatusDetail       // 神秘

  enhance: CharacterStatusDetail       // 强化

  luck: CharacterStatusDetail       // 幸运

  battle: CharacterStatusDetail       // 战斗

  strength: CharacterStatusDetail       // 力量

  dexterity: CharacterStatusDetail      // 敏捷
  intelligence: CharacterStatusDetail   // 智力
  stamina: CharacterStatusDetail        // 耐力

  attacking: CharacterStatusDetail      // 攻击
  defencing: CharacterStatusDetail      // 防御
}

export type AllCharacterStatusType = keyof CharacterStatusInfo | "hp" | "mp";
export type AllBaseCharacterStatusType = keyof CharacterStatusInfo

export type CharacterStatusInfoDB = {[key in AllCharacterStatusType]: string}

export type CharacterStatusImprove = {
    status: AllBaseCharacterStatusType
    increaseExp: number

    from?: string
}

export type CharacterStatusLevelImprove = {
    status: AllBaseCharacterStatusType
    increaseLevel: number

    from?: string
}

export type CharacterStatusLevelModify = {
    status: AllBaseCharacterStatusType
    modify: number

    from?: string
}

// 玩家基础信息
export type PlayerProfileInfo = {
  name: string;
  avatar: string;
  createDate: Date | string;
  lastOnlineDate?: Date | string;
  title?: keyof typeof allTitles;
  availableTitle?: (keyof typeof allTitles)[];
  guild?: string;
  guildTitle?: string;

  ironcat?: boolean

  userState?: PlayerState;

  option?: {
    hideGuildTitleInChat?: boolean; // 是否在聊天中隐藏公会头衔
    hideInRankingList?: boolean; // 是否在排行榜中隐藏角色
    disableEmailVerificationOnLogin?: boolean;
  };

  effect?: {
    profileCard?: string;
  };

  hName?: string[]

  style: GameUserCustomStyle

  canUseCustomAvatar?: {
    normal: boolean,
    gif: boolean,
  }
};

export type PlayerState = {
  global?: {
    statusEffect?: {
      id: AllGlobalStatusEffectStateId,
      value: number,
      until: Date, // 持续到什么时候
    }[],
    actionEffect?: {
      stateId: AllGlobalActionDurationEffectStateId,
      until: Date, // 持续到什么时候
    }[],
    otherEffect?: {
      id: AllGlobalStatusEffectStateId,
      until: Date, // 持续到什么时候
    }[],
  },
  battle: {
    stateWhenStartEachBattle?: {
      id: AllBattleStateId;
      duration: number; // 持续回合数
      value: number;
      extra?: BattleStateInBattleExtraInfo
      until: Date; // 持续到什么时候
      onlyDensefog?: boolean;
    }[];
  };
};

// 玩家完整信息（可扩展）
export type PlayerInfo = {
  base: PlayerProfileInfo
  status: CharacterStatusInfo
  skills: GameCharacterBattleSkillInfo[]
  // 可扩展更多字段，如背包、建筑等
}

export type CharacterEquipmentInfo = {
    [key in CharacterEquipmentPart]?: AllGameResourceID
}

export enum CharacterEquipmentPart {
    head = 'head',
    body = 'body',
    arm = 'arm',
    leg = 'leg',
    foot = 'foot',

    leftHand = 'leftHand',
    leftHand2 = 'leftHand2',

    rightHand = 'rightHand',
    rightHand2 = 'rightHand2',

    cloak = 'cloak', // 新增披风装备

    decorate1 = 'decorate1',
    decorate2 = 'decorate2',
    decorate3 = 'decorate3',
    decorate4 = 'decorate4',
    decorate5 = 'decorate5',
    decorate6 = 'decorate6',
    decorate7 = 'decorate7',
    decorate8 = 'decorate8',

    decorate9 = 'decorate9',
}

export const allCharacterDefaultEquipmentPart = [
    CharacterEquipmentPart.body,
    CharacterEquipmentPart.leg,
    CharacterEquipmentPart.foot,

    CharacterEquipmentPart.leftHand,

    CharacterEquipmentPart.rightHand,

    CharacterEquipmentPart.arm,
    CharacterEquipmentPart.head,
    CharacterEquipmentPart.cloak, // 新增披风装备
    CharacterEquipmentPart.decorate1,
    CharacterEquipmentPart.decorate2,
    CharacterEquipmentPart.decorate3,
    CharacterEquipmentPart.decorate4,
    CharacterEquipmentPart.decorate5,
    CharacterEquipmentPart.decorate6,
    CharacterEquipmentPart.decorate7,
    CharacterEquipmentPart.decorate8,

    // CharacterEquipmentPart.decorate9,
] as const

export const allCharacterEquipmentPart = [
    CharacterEquipmentPart.body,
    CharacterEquipmentPart.leg,
    CharacterEquipmentPart.foot,

    CharacterEquipmentPart.leftHand,
    CharacterEquipmentPart.leftHand2,

    CharacterEquipmentPart.rightHand,
    CharacterEquipmentPart.rightHand2,

    CharacterEquipmentPart.arm,
    CharacterEquipmentPart.head,
    CharacterEquipmentPart.cloak, // 新增披风装备
    CharacterEquipmentPart.decorate1,
    CharacterEquipmentPart.decorate2,
    CharacterEquipmentPart.decorate3,
    CharacterEquipmentPart.decorate4,
    CharacterEquipmentPart.decorate5,
    CharacterEquipmentPart.decorate6,
    CharacterEquipmentPart.decorate7,
    CharacterEquipmentPart.decorate8,

    CharacterEquipmentPart.decorate9,
] as const

export const allDecorateSlots = [
  CharacterEquipmentPart.decorate1,
  CharacterEquipmentPart.decorate2,
  CharacterEquipmentPart.decorate3,
  CharacterEquipmentPart.decorate4,
  CharacterEquipmentPart.decorate5,
  CharacterEquipmentPart.decorate6,
  CharacterEquipmentPart.decorate7,
  CharacterEquipmentPart.decorate8,
  CharacterEquipmentPart.decorate9,
] as const;

export type CharacterEquipmentType = 'work' | 'battle'
export type CharacterEquipActionInfo = {
  resourceId: AllGameResourceID
  type: CharacterEquipmentType
}

export type CharacterUnequipActionInfo = {
  part: CharacterEquipmentPart
  type: CharacterEquipmentType
}

export type CharacterEquipmentOutfitInGame = {
  uuid: string;
  user_uuid: string;
  name: string;
  type: 'work' | 'battle';
  head?: string;
  body?: string;
  arm?: string;
  leg?: string;
  foot?: string;
  cloak?: string;

  leftHand?: string;
  leftHand2?: string;

  rightHand?: string;
  rightHand2?: string;

  decorate1?: string;
  decorate2?: string;
  decorate3?: string;
  decorate4?: string;
  decorate5?: string;
  decorate6?: string;
  decorate7?: string;
  decorate8?: string;

  decorate9?: string;

  actionType?: string[];
}

export type CharacterSkillOutFitInGame = {
  uuid: string;
  name: string;
  data: {
    skillId: string;
    order: number;
    enabled: boolean;
    logic: GameFullBattleLogic;
    extra?: Record<string, any>
  }[]
}