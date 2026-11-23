import { allCharacterStatus } from "~/shared/data/allCharacterStatus"
import { allGameBuilding } from "~/shared/data/allGameBuilding"
import { allGameResource, allGameResourceWithInternal } from "~/shared/data/allGameResources"
import type { AllGameBuildingID } from "~/shared/types/building"
import type { AllCharacterStatusType } from "~/shared/types/characterInfo"
import type { AllGameResourceID, AllGameResourceIDWithInternal } from "~/shared/types/gameResource"

export const getCharacterStatusIcon = (status: AllCharacterStatusType) => {
    return allCharacterStatus[status].icon
}
export const getCharacterStatusName = (status: AllCharacterStatusType) => {
    return allCharacterStatus[status].name
}
export const getResourcerIconAndName = (resourceId: AllGameResourceIDWithInternal) => {
    return allGameResourceWithInternal[resourceId].icon + " " + allGameResourceWithInternal[resourceId].name
}

export const getBuildingIconAndName = (buildingId: AllGameBuildingID) => {
    return allGameBuilding[buildingId].icon + " " + allGameBuilding[buildingId].name
}