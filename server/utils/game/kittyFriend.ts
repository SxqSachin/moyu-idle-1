import { prisma } from "./db";
import { KittyEncounterInfo, KittyFriendshipInfo } from "~/shared/types/kittyFriend";

// 数据库模型转中间类型
export function toKittyEncounterInfo(db: any): KittyEncounterInfo {
    return {
        id: db.id,
        fromKittyUuid: db.fromKittyUuid,
        toKittyUuid: db.toKittyUuid,
        encounterTime: db.encounterTime.toISOString(),
        location: db.location ?? undefined,
        description: db.description ?? undefined,
        extra: db.extra ?? undefined,
    };
}

export function toKittyFriendshipInfo(db: any): KittyFriendshipInfo {
    return {
        id: db.id,
        kittyAUuid: db.kittyAUuid,
        kittyBUuid: db.kittyBUuid,
        ownerA: db.ownerA,
        ownerB: db.ownerB,
        becomeFriendTime: db.becomeFriendTime.toISOString(),
        intimacy: db.intimacy,
        extra: db.extra ?? undefined,
    };
}

// KittyEncounter CRUD
export async function createKittyEncounter(data: Omit<KittyEncounterInfo, 'id' | 'encounterTime'>): Promise<KittyEncounterInfo> {
    const encounter = await prisma.kittyEncounter.create({
        data: {
            ...data,
            encounterTime: new Date(),
        },
    });
    return toKittyEncounterInfo(encounter);
}

export async function getKittyEncountersByKitty(kittyUuid: string): Promise<KittyEncounterInfo[]> {
    const encounters = await prisma.kittyEncounter.findMany({
        where: { fromKittyUuid: kittyUuid },
        orderBy: { encounterTime: 'desc' },
    });
    return encounters.map(toKittyEncounterInfo);
}

export async function getKittyEncounter(id: number): Promise<KittyEncounterInfo | null> {
    const encounter = await prisma.kittyEncounter.findUnique({ where: { id } });
    return encounter ? toKittyEncounterInfo(encounter) : null;
}

// KittyFriendship CRUD
export async function createKittyFriendship(data: Omit<KittyFriendshipInfo, 'id' | 'becomeFriendTime'>): Promise<KittyFriendshipInfo> {
    const friendship = await prisma.kittyFriendship.create({
        data: {
            ...data,
            becomeFriendTime: new Date(),
        },
    });
    return toKittyFriendshipInfo(friendship);
}

export async function getKittyFriendshipsByKitty(kittyUuid: string): Promise<KittyFriendshipInfo[]> {
    const friendships = await prisma.kittyFriendship.findMany({
        where: {
            OR: [
                { kittyAUuid: kittyUuid },
                { kittyBUuid: kittyUuid },
            ],
            del: false,
        },
        orderBy: { becomeFriendTime: 'desc' },
    });
    return friendships.map(toKittyFriendshipInfo);
}

export async function getKittyFriendship(id: number): Promise<KittyFriendshipInfo | null> {
    const friendship = await prisma.kittyFriendship.findUnique({ where: { id } });
    return friendship ? toKittyFriendshipInfo(friendship) : null;
}