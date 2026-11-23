import { prisma } from '../prisma'

export const batchGetBasicUserInfo = async (userUuids: string[]) => {
    const res: Map<string, { uuid: string, is_banned: boolean, last_online_date: Date | null }> = new Map()
    let users = await prisma.user.findMany({
        where: {
            uuid: {
                in: userUuids
            }
        },
        select: {
            uuid: true,
            is_banned: true,
            last_online_date: true,
        }
    })

    users.forEach(user => {
        res.set(user.uuid, user)
    })

    return res;
}