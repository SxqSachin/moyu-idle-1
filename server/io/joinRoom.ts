import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { prisma } from "../utils/game/db";
import { emitEventToUser } from ".";
import { getCharacterInitData } from "../utils/game/game";
import { GameBroadcastKind, UserBasicInfoUpdateMessage } from "~/shared/types/broadcast";

export default async function(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, data: GameSocketData<void>) {
    let userUuid = data.user.uuid;

    const roomId = "room-" + userUuid
    await redisClient.set(`socket:${socket.id}`, roomId, {
        expiration: {
            type: "EX",
            value: 60 * 60 * 24,
        }
    })
    socket.leave(roomId)
    socket.join(roomId)

    await redisClient.sAdd("online-users", userUuid);

    // let user = await prisma.user.findUnique({
    //     where: {
    //         uuid: userUuid,
    //     }
    // })

    // if (user?.is_banned) {
    //     emitEventToUser(userUuid, "banned", {
    //         message: user.ban_reason || "You are banned from this server.",
    //     })
    //     return
    // }


    emitEventToUser(userUuid, "join-room:success")

    let initData = await getCharacterInitData(userUuid);

    emitEventToUser(userUuid, "characterInitData", {data: initData})


    await prisma.user.update({
        where: { uuid: userUuid },
        data: {
            last_online_date: new Date(),
        }
    })
    // join后刷新一次基础信息，用来通知各服务刷新（玩家最后在线时间，用于离线时长判断）
    await publishGameBroadcast<UserBasicInfoUpdateMessage>({
        kind: GameBroadcastKind.USER_BASIC_INFO_UPDATED,
        userUuid: userUuid,
    })
    // 触发一次队列调度
    await scheduleUserImmediate(userUuid);
}