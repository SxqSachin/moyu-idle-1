import { KittyEssayInfo } from "~/shared/types/kittyEssayInfo";
import { prisma } from "./db";
import { v4 } from "uuid";
import { Kitty } from "~/shared/types/kitty";

// 数据库模型转中间类型
export function toKittyEssayInfo(db: any): KittyEssayInfo{
    return {
        uuid: db.uuid,
        kittyUuid: db.kittyUuid,
        owner: db.owner,
        title: db.title ?? undefined,
        content: db.content,
        mood: db.mood ?? undefined,
        action: db.action ?? undefined,
        createdAt: db.createdAt,
        updatedAt: db.updatedAt,
        extra: db.extra ?? undefined,
    };
}

// 创建随笔
export async function createKittyEssay(data: Omit<KittyEssayInfo, 'uuid' | 'createdAt' | 'updatedAt'>): Promise<KittyEssayInfo> {
    const uuid = v4()
    const essay = await prisma.kittyEssay.create({
        data: {
            uuid,
            ...data,
        }
    });
    return toKittyEssayInfo(essay);
}

// 获取随笔
export async function getKittyEssay(uuid: string): Promise<KittyEssayInfo | null> {
    const essay = await prisma.kittyEssay.findUnique({ where: { uuid } });
    return essay ? toKittyEssayInfo(essay) : null;
}

// 获取某只猫咪的所有随笔
export async function getKittyEssaysByKitty(
    kittyUuid: string,
    opts?: { page?: number; pageSize?: number }
): Promise<KittyEssayInfo[] | { items: KittyEssayInfo[]; total: number }> {
    if (!opts || (!opts.page && !opts.pageSize)) {
        const essays = await prisma.kittyEssay.findMany({ where: { kittyUuid }, orderBy: { createdAt: 'desc' } });
        return essays.map(toKittyEssayInfo);
    }

    const page = Math.max(1, opts.page ?? 1)
    const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 20))
    const skip = (page - 1) * pageSize

    const [total, essays] = await Promise.all([
        prisma.kittyEssay.count({ where: { kittyUuid } }),
        prisma.kittyEssay.findMany({ where: { kittyUuid }, orderBy: { createdAt: 'desc' }, skip, take: pageSize })
    ])

    return { items: essays.map(toKittyEssayInfo), total }
}

// 添加日志（随笔）
export async function addKittyEssay(kitty: Kitty, content: string, options?: { title?: string; action?: string; extra?: string }): Promise<KittyEssayInfo> {
    return await createKittyEssay({
        kittyUuid: kitty.uuid,
        owner: kitty.owner,
        mood: kitty.mood,
        content,
        ...options,
    });
}