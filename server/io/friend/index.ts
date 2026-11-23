import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import * as friendService from "~/shared/types/friend";
import { prisma } from "~/server/utils/game/db";

// 发送好友请求
export async function handleSendFriendRequest(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ toUserName: string }>
) {
    const fromUserUuid = data.user.uuid;
    const { toUserName} = data.data;

    let toUser = await prisma.user.findFirst({
        where: { name: toUserName }
    });

    if (!toUser) {
        emitEventToUser(fromUserUuid, "friend:request:send:fail", { message: "用户不存在" });
        return;
    }

    try {
        await friendService.sendFriendRequest(fromUserUuid, toUser.uuid);
        emitEventToUser(fromUserUuid, "friend:request:send:success", { toUserUuid: toUser.uuid });
        emitEventToUser(toUser.uuid, "friend:request:received", { fromUserUuid });
    } catch (e: any) {
        emitEventToUser(fromUserUuid, "friend:request:send:fail", { message: e.message || "发送失败" });
    }
}

// 接受好友请求
export async function handleAcceptFriendRequest(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ requestId: number }>
) {
    const userUuid = data.user.uuid;
    const { requestId } = data.data;
    try {
        let req = await friendService.acceptFriendRequest(requestId);
        emitEventToUser(userUuid, "friend:request:accept:success", { requestId });

        emitEventToUser(req.fromUserUuid, "friend:request:accepted", { toUserUuid: req.toUserUuid });
        emitEventToUser(req.toUserUuid, "friend:request:accepted", { fromUserUuid: req.fromUserUuid });
    } catch (e: any) {
        emitEventToUser(userUuid, "friend:request:accept:fail", { message: e.message || "操作失败" });
    }
}

// 拒绝好友请求
export async function handleRejectFriendRequest(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ requestId: number }>
) {
    const userUuid = data.user.uuid;
    const { requestId } = data.data;
    try {
        let req = await friendService.rejectFriendRequest(requestId);
        emitEventToUser(userUuid, "friend:request:reject:success", { requestId });

        emitEventToUser(req.fromUserUuid, "friend:request:rejected", { toUserUuid: req.toUserUuid });
    } catch (e: any) {
        emitEventToUser(userUuid, "friend:request:reject:fail", { message: e.message || "操作失败" });
    }
}

// 删除好友
export async function handleRemoveFriend(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ friendUuid: string }>
) {
    const userUuid = data.user.uuid;
    const { friendUuid } = data.data;
    try {
        await friendService.removeFriend(userUuid, friendUuid);
        emitEventToUser(userUuid, "friend:remove:success", { friendUuid });

        // emitEventToUser(friendUuid, "friend:removed", { userUuid });
    } catch (e: any) {
        emitEventToUser(userUuid, "friend:remove:fail", { message: e.message || "操作失败" });
    }
}

// 获取好友列表
export async function handleGetFriendList(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<void>
) {
    const userUuid = data.user.uuid;
    try {
        const list = await friendService.getFriendList(userUuid);

        // 转换成用户名与uuid {name: xxx, uuid: xxx}
        const userList = await prisma.user.findMany({
            where: {
                uuid: { in: list }
            },
            select: {
                uuid: true,
                name: true
            }
        });

        // 只返回用户名和uuid
        const formattedList = userList.map(user => ({
            name: user.name,
            uuid: user.uuid
        }));

        emitEventToUser(userUuid, "friend:list", { list: formattedList });
    } catch (e: any) {
        emitEventToUser(userUuid, "friend:list:fail", { message: e.message || "获取失败" });
    }
}

// 获取好友请求列表
export async function handleGetFriendRequests(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<void>
) {
    const userUuid = data.user.uuid;
    try {
        const requests = await friendService.getFriendRequests(userUuid);

        // 转换成用户名与uuid {name: xxx, uuid: xxx, status: xxx}
        const formattedRequests = await Promise.all(requests.map(async (req) => {
            const user = await prisma.user.findUnique({
                where: { uuid: req.fromUserUuid },
                select: { uuid: true, name: true }
            });
            return {
                id: req.id,
                fromUserUuid: user?.uuid || "",
                fromUserName: user?.name || "",
                status: req.status
            };
        }));

        emitEventToUser(userUuid, "friend:requests", { requests: formattedRequests });
    } catch (e: any) {
        emitEventToUser(userUuid, "friend:requests:fail", { message: e.message || "获取失败" });
    }
}