import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { increaseItemCount, dispatchInventoryUpdatedEventToClient, dispatchResourceIncreaseToClient } from "~/server/utils/game/characterInventory";
import { ItemCountInfo } from "~/shared/types/gameInventory";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { allTitles } from "~/shared/data/allTitle";
import addTaskToQueue from "../addTaskToQueue";
import { addTitle } from "~/server/utils/game/player";

const GM_UUID = [
    "2509432e-caea-4abd-9220-e66ff6ef6a08",
    "86227f5f-5f23-4398-9c84-f49e969b0697"
];

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ targetName: string, title: keyof typeof allTitles }>
) {
    const userUuid = data.user.uuid;
    const { targetName, title } = data.data;

    // 数据库查询是否为GM
    const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
    if (!gmUser || !gmUser.is_gm) {
        emitEventToUser(data.user, "gm:batchSendNotice:fail", { message: "无权限" });
        return;
    }

    // 查找目标用户
    // 直接用prisma查找用户
    const targetUser = await prisma.user.findFirst({
        where: { name: targetName }
    });
    if (!targetUser) {
        emitEventToUser(data.user, "gm:addTitle:fail", { message: "目标用户不存在" });
        return;
    }

    try {
        await addTitle(targetUser.uuid, title);
    } catch (error) {
        emitEventToUser(data.user, "gm:addTitle:fail", { message: error instanceof Error ? error.message : "添加称号失败" });
        return;
    }
    // 通知GM操作成功
    emitEventToUser(data.user, "gm:addTitle:success", { title });
}