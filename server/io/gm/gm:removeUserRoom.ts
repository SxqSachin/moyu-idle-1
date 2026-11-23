import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { clearUserRoomUuid, getRoomByUserId, kickUserFromRoom } from "~/server/utils/game/room";

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ targetName: string }>
) {
    const userUuid = data.user.uuid;
    const { targetName } = data.data;

    // 数据库查询是否为GM
    const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
    if (!gmUser || !gmUser.is_gm) {
        emitEventToUser(data.user, "gm:removeUserRoom:fail", { message: "无权限" });
        return;
    }

    // 查找目标用户
    const targetUser = await prisma.user.findFirst({
        where: { name: targetName }
    });
    if (!targetUser) {
        emitEventToUser(data.user, "gm:removeUserRoom:fail", { message: "目标用户不存在" });
        return;
    }
    const targetUuid = targetUser.uuid;

    const room = await getRoomByUserId(targetUuid)

    if (!room) {
        await clearUserRoomUuid(targetUuid)
        emitEventToUser(data.user, "gm:removeUserRoom:success", { targetUuid });
        return
    }

    try {
        await kickUserFromRoom(room?.ownerId, targetUuid, room?.uuid, true)
    } catch(e: any) {
        emitEventToUser(data.user, "gm:removeUserRoom:fail", { message: e.message || "移除用户失败" });
    }

    await clearUserRoomUuid(targetUuid)
    emitEventToUser(data.user, "gm:removeUserRoom:success", { targetUuid });
}