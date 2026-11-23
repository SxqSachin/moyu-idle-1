import type { GameActionReward } from "./gameAction";
import type { ItemCountInfo, ItemCountModifyInfo } from "./gameInventory";
import type { AllGameResourceID } from "./gameResource";

export type KittyEssayInfo = {
    uuid: string;
    kittyUuid: string;
    owner: string;
    title?: string;
    content: string;
    mood?: number;
    action?: string;
    createdAt: Date;
    updatedAt: Date;
    extra?: string;
};

export type KittyEssayType = {
    content: string,
    reward: GameActionReward[]
}