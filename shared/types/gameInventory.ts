import type { AllGameBuildingID } from "./building";
import type { AllGameResourceIDWithInternal } from "./gameResource";


export type CharacterInventoryItem = {
    count: number
}
export type CharacterInventory = {
    [key in AllGameResourceIDWithInternal]?: CharacterInventoryItem
}

export type ItemCountInfo = {
    [key in AllGameResourceIDWithInternal]?: {
        count: number
    }
} 
export type BuildingRewardInfo = {
    [key in AllGameBuildingID]?: {
        levelIncrease: number
    }
}
export type RewardInfo = ItemCountInfo & BuildingRewardInfo
export type UsedResourceInfo = ItemCountInfo


export type ItemCountModifyInfo = {
    date: number
    action: string
    type: "increase" | "decrease"
    info: ItemCountInfo
    modifyType?: ModifyItemCountType 
} 

export enum ModifyItemCountType {
    Battle = 'Battle',
    Market = 'Market',
    Equipment = 'Equipment',
    UseItem = 'UseItem',
    ActionUse = 'ActionUse',
    ActionGain = 'ActionGain',
    Alchemy = 'Alchemy',
    Kitty = 'Kitty',
    KittySpecialAction = 'KittySpecialAction',
    Enhance = 'Enhance',
    Auction = 'Auction',
    Guild = 'Guild',
    Village = 'Village',
    Other = 'Other',
}
export type ModifyItemCountOption = {
    actionName: string,
    showModifyInfo?: boolean
    gmForce?: boolean
    reason?: string
    type: ModifyItemCountType
    sendModifyEvent?: boolean
}