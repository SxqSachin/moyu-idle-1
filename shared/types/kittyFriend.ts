
export type KittyEncounterInfo = {
    id: number;
    fromKittyUuid: string;
    toKittyUuid: string;
    encounterTime: string; // ISO 时间字符串
    location?: string;
    description?: string;
    extra?: string;
};

export type KittyFriendshipInfo = {
    id: number;
    kittyAUuid: string;
    kittyBUuid: string;
    ownerA: string;
    ownerB: string;
    becomeFriendTime: Date;
    intimacy: number;
    extra?: string;
};