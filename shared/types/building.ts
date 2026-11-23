import { allGameBuilding } from "../data/allGameBuilding"
import type { ActionRequirement, BuildingRequirement, CharacterStatusRequirement, ResourceRequirement } from "./gameAction"

export type GameBuildingInfo = {
    id: AllGameBuildingID
    name: string
    icon: string
    description: string
    buildDuration: number

    hidden?: boolean

    maxLevel: number

    buildRequirement?: ActionRequirement

    upgradeRequirement?: ActionRequirement

    upgradeRequirementMultiple?: number
}

export type AllGameBuildingID = keyof typeof allGameBuilding


export type CharacterBuildingDetail = {
    level: number
    status?: "BUILDING" | "BUILT"
}

export type CharacterBuildingInfo = {
    [key in AllGameBuildingID]?: CharacterBuildingDetail
}

export type BuildActionID = `build_${AllGameBuildingID}`;