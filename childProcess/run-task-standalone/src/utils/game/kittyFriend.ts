import type { KittyEncounterInfo, KittyFriendshipInfo } from "~/shared/types/kittyFriend";
import { prisma } from "../prisma";

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
export async function createKittyFriendship(a: string, b: string): Promise<KittyFriendshipInfo | null> {
    if (!a || !b || a === b) {
        return null;
    }

    const exist = await prisma.kittyFriendship.findFirst({
        where: {
            OR: [
                { kittyAUuid: a, kittyBUuid: b },
                { kittyAUuid: b, kittyBUuid: a },
            ]
        }
    });
    if (exist) {
        return toKittyFriendshipInfo(exist);
    }

    // 获取双方主人信息（可选，如果需要 ownerA/ownerB 字段）
    const kittyA = await prisma.kitty.findUnique({ where: { uuid: a } });
    const kittyB = await prisma.kitty.findUnique({ where: { uuid: b } });

    const data = {
        kittyAUuid: a,
        kittyBUuid: b,
        ownerA: kittyA?.owner ?? '',
        ownerB: kittyB?.owner ?? '',
        intimacy: 1,
        extra: "",
    };

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

export async function getAllKittyFriendship(): Promise<KittyFriendshipInfo[]> {
    const friendships = await prisma.kittyFriendship.findMany({
        where: {
            del: false
        }
    });
    return friendships.map(toKittyFriendshipInfo);
}