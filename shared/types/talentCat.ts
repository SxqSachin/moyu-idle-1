import type allTalentCat from "../data/allTalentCat";
import type { AllGameActionID, GameAction } from "./gameAction";
import type { CharacterStatusInfo } from "./characterInfo";

export type TalentCat = {
     id: string
    name: string
    description: string
    actionDesc: string
    icon: string
    hourlyWage:  { resourceId: string, count: number }[],
    actionOverride?: {
        [action in AllGameActionID]: Partial<GameAction>
    },
    dynamicHourlyWage?: (character: CharacterStatusInfo) => { resourceId: string, count: number }[],
    dynamicMaxHireHour?: (character: CharacterStatusInfo) => number,
    effect?: {},
}