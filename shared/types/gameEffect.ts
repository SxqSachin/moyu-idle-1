import type { allAvatarBorder, allBattleStyle, allChatBubbleStyle, allProfileStyle } from "../data/allStyle";
import type { allTitles } from "../data/allTitle";
import type { AllBattleStateId, AllGlobalActionDurationEffectStateId, AllGlobalEffectStateId } from "./BattleState";
import type { AllBaseCharacterStatusType, AllCharacterStatusType, CharacterStatusInfo, } from "./characterInfo";
import type { AllGameActionDurationDetail, AllGameActionID } from "./gameAction";
import type { AllGameResourceID, AllGameResourceIDWithInternal } from "./gameResource"
import type { AllBattleSkillId } from "./skill";
import type { SkillTreeId } from "./skillTree";

export type GameEffectSimpleValueModify =
  | { increase: number; decrease?: never }
  | { decrease: number; increase?: never };

export type GameEffectActionAboutActionRequirement = {
    actionId: AllGameActionID
    resource: AllGameResourceIDWithInternal
} & (
    | { increase: number; decrease?: never; }
    | { decrease: number; increase?: never; }
)

export type GameEffectActionAboutResource = {
    resource: AllGameResourceIDWithInternal
} & (
    | { increase: number; decrease?: never; }
    | { decrease: number; increase?: never; }
)

export type GameEffectActionAboutResourceWithPercent = {
    resource: AllGameResourceIDWithInternal
} & (
    | { increase: number; decrease?: never; percent?: number }
    | { decrease: number; increase?: never; percent?: number }
)

export type GameEffectActionAboutStatus = {
    status: AllBaseCharacterStatusType
} & (
    | { increase: number; decrease?: never; }
    | { decrease: number; increase?: never; }
)

export type GameEffectActionAboutKittyStatus = ({
    status: "maxSatiety"
} & (
    | { increase: number; decrease?: never; }
    | { decrease: number; increase?: never; }
)) | ({
    status: "maxMood"
} & (
    | { increase: number; decrease?: never; }
    | { decrease: number; increase?: never; }
)) | ({
    status: "mood"
} & (
    | { increase: number; decrease?: never; }
    | { decrease: number; increase?: never; }
))

export type GameEffectActionAboutActionDuration = {
    action: AllGameActionID
} & (
    | { increase: number; increasePercent?: number; decrease?: never; }
    | { decrease: number; decreasePercent?: number; increase?: never; }
)

export type GameEffectActionAboutActionExp = {
    action: AllBaseCharacterStatusType | 'allWorkAction' | 'allExerciseAction'
} & (
    | { increasePercent?: number; }
    | { decreasePercent?: number; }
)

export type GameEffectActionAboutBattleSkill = {
    skillId: AllBattleSkillId,
    expReward: number
}

export type GameEffectTextDetail = {
    title: string
    description: string
}

export type GameUserUniqueFlag = {
    type: 'item' | 'title' | 'skin' | 'battleStyle' | 'avatar' | 'profileStyle' | 'decorate_unlock' | 'chatBubble' | 'avatarBorder'
    key: string
}
export type GameUserUniqueFlagCheck = {
    condition: "has" | 'not_has',
    data: GameUserUniqueFlag
    conditionDescription?: string
}

export type GameEffectActionAboutGlobalState = {
    id: AllGlobalEffectStateId
    value: number
    durationMinutes: number
}

export type GameGlobalEffectActionAboutAction = {
    stateId: AllGlobalActionDurationEffectStateId 
    durationMinutes: number
}

export type GameGlobalEffectBattleState = {
    stateId: AllBattleStateId 
    inBattleDurationRound: number
    durationMinutes: number
}

export type GameEffectAboutSkillTreePoint = {
    treeId: SkillTreeId
    increase: number
}

export type GameEffectAction = {
    name: string

    isBuff?: boolean
    isDebuff?: boolean

    passTurn?: boolean
    passExtraTurnOnBattleBegin?: boolean
    hasExtraTurnOnBattleBegin?: boolean

    resourceEffect?: GameEffectActionAboutResourceWithPercent[]
    statusEffect?: GameEffectActionAboutStatus[]
    actionDurationEffect?: GameEffectActionAboutActionDuration[]
    kittyStatusEffect?: GameEffectActionAboutKittyStatus[]

    workActionExtEffect?: GameEffectActionAboutActionExp[]

    statusExpEffect?: GameEffectActionAboutStatus[]
    statusLevelEffect?: GameEffectActionAboutStatus[]

    learnBattleSkillEffect?: GameEffectActionAboutBattleSkill[]

    resourceRequirementModifyEffect?: GameEffectActionAboutActionRequirement[]

    textDetail?: GameEffectTextDetail[]

    addTitle?: (keyof typeof allTitles)[]

    addBattleCustomStyle?: (keyof typeof allBattleStyle)[]
    addProfileStyle?: (keyof typeof allProfileStyle)[]
    addChatBubbleStyle?: (keyof typeof allChatBubbleStyle)[]
    addAvatarBorder?: (keyof typeof allAvatarBorder)[]

    addUniqueFlag?: GameUserUniqueFlag[]

    hpRegen?: GameEffectSimpleValueModify
    mpRegen?: GameEffectSimpleValueModify

    addGlobalStatusState?: GameEffectActionAboutGlobalState[]
    addGlobalOtherState?: GameEffectActionAboutGlobalState[]

    addGlobalActionEffectState?: GameGlobalEffectActionAboutAction[]
    addGlobalBattleStateWhenBattleStart?: GameGlobalEffectBattleState[]

    boundSkills?: {
        id: AllBattleSkillId
        level: number
    }[]

    addSkillTreePoint?: GameEffectAboutSkillTreePoint[]

    alchemyModify?: {
        mutationPercentIncrease?: number;
    }
}

export type GameBattleActionEffect = {
    currentHpModify?: number
    currentMpModify?: number

    desc?: string

    addState?: {
        id: AllBattleStateId;
        duration: number;
    }

    hidden?: boolean
}

export type UseItemInfo = {
    itemId: AllGameResourceID
    multiple?: number
}

export type UseItemResult = {
    resourceEffectResult?: UseItemResourceEffectResult
    hasStyleChange?: boolean
    actionDurationEffectResult?: AllGameActionDurationDetail | null

    hasUniqueFlagChange?: boolean
}

export type UseItemResourceEffectResult = {
    [resourceId in AllGameResourceIDWithInternal]?: {
        modifyCount: number
    }
}

export type UseItemStatusEffectResult = {
    [status in AllCharacterStatusType]?: {
        modifyCount: number
    }
}

export type UseItemActionDirationEffectResult = {
    [action in AllGameActionID]?: {
        modifyCount: number
    }
}
// export type GameTriggerEffect = {
//     increaseSatiety?: GameEffectAction,
//     decreaseSatiety?: GameEffectAction,
// }
// export type GameResourceTriggerActionType = keyof GameTriggerEffect

