import { allBattleStatus, allWorkStatus } from "~/shared/data/allCharacterStatus";
import { allGameAction, allGameActionMainType } from "~/shared/data/allGameActions";
import type { AllBaseCharacterStatusType, CharacterStatusInfo } from "~/shared/types/characterInfo";
import type { AllGameActionID, AllGameActionMainType } from "~/shared/types/gameAction";


type ActionIncludeCheckType = AllGameActionMainType | AllGameActionID | 'allWorkAction' | 'allExerciseAction'

export function isActionInclude(action: ActionIncludeCheckType, checkType: AllGameActionID) {
    if (!checkType) {
        return false;
    }

    if (action == 'allWorkAction') {
        return true;
    }

    // sequential checks for alias flags
    if (action === 'allExerciseAction') {
        return allGameActionMainType.exercise.actions.includes(checkType);
    } else if (action === 'allCollectingAction') {
        return allGameActionMainType.collecting.actions.includes(checkType);
    } else if (action === 'allSewingAction') {
        return allGameActionMainType.sewing.actions.includes(checkType);
    } else if (action === 'allExploreAction') {
        return allGameActionMainType.explore.actions.includes(checkType);
    } else if (action === 'allFishingAction') {
        return allGameActionMainType.fishing.actions.includes(checkType);
    } else if (action === 'allForgingAction') {
        return allGameActionMainType.forging.actions.includes(checkType);
    } else if (action === 'allSpecialManufactureAction') {
        return allGameActionMainType.specialManufacture.actions.includes(checkType);
    } else if (action === 'allMiningAction') {
        return allGameActionMainType.mining.actions.includes(checkType);
    } else if (action === 'allLevel1Manufacture') {
        return allGameActionMainType.level1Manufacture.actions.includes(checkType);
    } else if (action === 'allFarmingAnimalAction') {
        return allGameActionMainType.farmingAnimal.actions.includes(checkType);
    } else if (action === 'allCookingAction') {
        return allGameActionMainType.cooking.actions.includes(checkType);
    } else if (action == "allMysteriousAction") {
        return allGameActionMainType.mysterious.actions.includes(checkType);;
    }

    // if action is one of the main type keys
    if (Object.keys(allGameActionMainType).includes(action)) {
        const actionMainType = action as AllGameActionMainType;
        return allGameActionMainType[actionMainType].actions.includes(checkType)
    }

    return action == checkType;
}

type StatusEqualCheckType = AllBaseCharacterStatusType | 'allWorkAction' | 'allExerciseAction'
export function isStatusEqual(thisStatus: StatusEqualCheckType, targetStatus: AllBaseCharacterStatusType) {
    if (thisStatus == 'allWorkAction') {
        return [...allWorkStatus, ...allBattleStatus].includes(targetStatus)
    }

    if (thisStatus == 'allExerciseAction') {
        return getAllStatusImproveAboutMainType('exercise').includes(targetStatus)
    }

    return thisStatus == targetStatus
}

export function getAllStatusImproveAboutMainType(mainActionType: AllGameActionMainType): AllBaseCharacterStatusType[] {
    let actionsAboutMainType = allGameActionMainType[mainActionType].actions

    if (!actionsAboutMainType?.length) {
        return[]
    }

    let res: AllBaseCharacterStatusType[] = []


    for(const actionId of actionsAboutMainType) {
        const action = allGameAction[actionId]

        for(const improve of action.characterImprove ?? []) {
            res.push(improve.status)
        }
    }

    return [...new Set(res)]
}