import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { broadcastEvent, emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";

const GM_UUID = [
    "2509432e-caea-4abd-9220-e66ff6ef6a08",
    "86227f5f-5f23-4398-9c84-f49e969b0697"
];

const DELAY_MS = 100;

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ title: string, content: string, type: string, duration: number }>
) {
    const userUuid = data.user.uuid;
    const { title, content, type, duration } = data.data;


    // 数据库查询是否为GM
    const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
    if (!gmUser || !gmUser.is_gm) {
        emitEventToUser(data.user, "gm:batchSendNotice:fail", { message: "无权限" });
        return;
    }

    // const allUsers = await prisma.user.findMany();
    // const total = allUsers.length;
    // let current = 0;
    // const success: string[] = [];
    // const fail: { name: string, reason: string }[] = [];

    // for (const user of allUsers) {
    //     try {
    //         emitEventToUser(user.uuid, "gm:notice:receive", { title, content, type, duration });
    //         success.push(user.name);
    //     } catch (e) {
    //         fail.push({ name: user.name, reason: "发送失败" });
    //     }
    //     current++;
    //     emitEventToUser(data.user, 
    // "gm:batchSendNotice:progress", {
    //         current,
    //         total,
    //         user: user.name
    //     });
    //     await new Promise(res => setTimeout(res, DELAY_MS));
    // }

    broadcastEvent("gm:notice:receive", { title, content, type, duration });

    emitEventToUser(data.user, "gm:batchSendNotice:result");
}