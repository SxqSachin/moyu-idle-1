import { emitEventToUser } from "~/server/io";
import { prisma } from "~/server/utils/game/db";

export async function sendFriendRequest(fromUserUuid: string, toUserUuid: string) {
    if (fromUserUuid === toUserUuid) throw new Error("不能添加自己为好友");
    // 检查是否已是好友
    const exist = await prisma.friendship.findFirst({
        where: {
            OR: [
                { userA: fromUserUuid, userB: toUserUuid },
                { userA: toUserUuid, userB: fromUserUuid }
            ]
        }
    });
    if (exist) throw new Error("你们已经是好友了");

    // 检查是否有未处理的请求
    const pending = await prisma.friendRequest.findFirst({
        where: {
            fromUserUuid,
            toUserUuid,
            status: "PENDING"
        }
    });
    if (pending) throw new Error("已发送过请求，请等待对方处理");

    // u如果已经有rejected的请求，则更新状态
    const existingRejected = await prisma.friendRequest.findFirst({
        where: {
            fromUserUuid,
            toUserUuid,
            status: "REJECTED"
        }
    });
    if (existingRejected) {
        return await prisma.friendRequest.update({
            where: { id: existingRejected.id },
            data: { status: "PENDING" }
        });
    }

    await prisma.friendRequest.create({
        data: { fromUserUuid, toUserUuid }
    });
}

export async function acceptFriendRequest(requestId: number) {
    const req = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!req || req.status !== "PENDING") throw new Error("请求不存在或已处理");

    // 建立好友关系（保证唯一性，userA < userB）
    const [userA, userB] = [req.fromUserUuid, req.toUserUuid].sort();
    await prisma.friendship.create({
        data: { userA, userB }
    });

    let res = await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" }
    });

    // 删除request
    await prisma.friendRequest.delete({ where: { id: requestId } });

    return res
}

export async function rejectFriendRequest(requestId: number) {
    const req = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!req || req.status !== "PENDING") throw new Error("请求不存在或已处理");

    return await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED" }
    });
}

export async function removeFriend(userUuid: string, friendUuid: string) {
    // userA < userB
    const [userA, userB] = [userUuid, friendUuid].sort();
    await prisma.friendship.deleteMany({
        where: { userA, userB }
    });
}

export async function getFriendList(userUuid: string) {
    // 查询所有与自己有关的好友关系
    const friends = await prisma.friendship.findMany({
        where: {
            OR: [
                { userA: userUuid },
                { userB: userUuid }
            ]
        }
    });
    // 返回好友uuid列表
    return friends.map(f =>
        f.userA === userUuid ? f.userB : f.userA
    );
}

export async function getFriendRequests(userUuid: string) {
    // 查询所有与自己有关的请求
    return prisma.friendRequest.findMany({
      where: {
        toUserUuid: userUuid,
      },
      orderBy: { createdAt: "desc" },
    });
}