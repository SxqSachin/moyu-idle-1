import type { MinMax } from "."
import { allGameAction, allGameActionMainType } from "../data/allGameActions"
import type { AllGameBuildingID, BuildActionID } from "./building"
import type { AllBaseCharacterStatusType, AllCharacterStatusType, CharacterStatusImprove } from "./characterInfo"
import type { AllGameResourceID, AllGameResourceIDWithInternal } from "./gameResource"

export type GameActionReward = ({
    id: AllGameResourceID
    percent: number
    range?: MinMax
    count: number

    buildingId?: never

    from?: string

    ignoreLuckFactor?: boolean
    rewardWhenCompleteBySpecialKitty?: string
} | {
    id: AllGameResourceID
    percent: number
    range: MinMax
    count?: number

    buildingId?: never

    from?: string

    ignoreLuckFactor?: boolean
    rewardWhenCompleteBySpecialKitty?: string
}) | {
    id?: never
    percent?: never
    range?: never
    count?: never

    buildingId: AllGameBuildingID

    from?: string

    ignoreLuckFactor?: boolean
    rewardWhenCompleteBySpecialKitty?: string
}

export type CharacterStatusRequirement = {
    status: AllBaseCharacterStatusType | 'workTotal'
    min: number
}

export type ResourceRequirement = {
    id: AllGameResourceIDWithInternal
    count: number
    // max?: number
}

export type BuildingRequirement = {
    id: AllGameBuildingID
    minLevel: number
}

export type ActionRequirement = {
  characterStatus?: CharacterStatusRequirement[];
  resource?: ResourceRequirement[];
  building?: BuildingRequirement[];
};

export type GameAction = {
    id: AllGameActionID | BuildActionID;
    name: string
    icon: string

    description: string

    baseDuration: number

    requirement?: ActionRequirement 
    rewards?: Readonly<GameActionReward[]>
    characterImprove?: CharacterStatusImprove[]

    banToKitty?: boolean

    __internal?: boolean

    secondaryClassification?: string

    hidden?: boolean
    ignoreDismantle?: boolean
}


export type AllGameActionMainType = keyof typeof allGameActionMainType
export type GameMainActionInfo = {
    id: AllGameActionMainType
    name: string
    icon: string
    color: string
    actions: AllGameActionID[]
}

export type AllGameActionID = keyof typeof allGameAction

export const getActionName = (actionId: AllGameActionID): string => {
    return allGameAction[actionId].name
}

export type GameActionDurationDetail = {
    base: number
    fromEquipmentModify?: number
    fromOther?: number
    final: number
}

export type AllGameActionDurationDetail = {
    [key in AllGameActionID]: GameActionDurationDetail
}

export type GameActionResourceRequirementDetail = {
    resourceId: AllGameResourceIDWithInternal
    base: number
    fromEquipmentModify?: number
    final: number
}
export type AllGameActionResourceRequirementDetail = {
    [key in AllGameActionID]: GameActionResourceRequirementDetail[]
}