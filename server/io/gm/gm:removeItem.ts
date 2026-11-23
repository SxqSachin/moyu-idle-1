import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { dispatchInventoryUpdatedEventToClient, dispatchResourceIncreaseToClient, decreaseItemCount, dispatchResourceDecreaseToClient } from "~/server/utils/game/characterInventory";
import { ItemCountInfo, ModifyItemCountType } from "~/shared/types/gameInventory";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";

const GM_UUID = [
    "2509432e-caea-4abd-9220-e66ff6ef6a08",
    "86227f5f-5f23-4398-9c84-f49e969b0697"
];

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ targetName: string, items: ItemCountInfo, comment: string }>
) {
    const userUuid = data.user.uuid;
    const { targetName, items, comment } = data.data;

    // 数据库查询是否为GM
    const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
    if (!gmUser || !gmUser.is_gm) {
        emitEventToUser(data.user, "gm:removeInventory:fail", { message: "无权限" });
        return;
    }

    // 查找目标用户
    // 直接用prisma查找用户
    const targetUser = await prisma.user.findFirst({
        where: { name: targetName }
    });
    if (!targetUser) {
        emitEventToUser(data.user, "gm:removeInventory:fail", { message: "目标用户不存在" });
        return;
    }
    const targetUuid = targetUser.uuid;

    try {
        // 添加物品
        await decreaseItemCount(targetUuid, items, { 
            actionName: comment,
            showModifyInfo: true,
            gmForce: true,
            type: ModifyItemCountType.Other
        });

        dispatchResourceDecreaseToClient(targetUuid, items);
        dispatchInventoryUpdatedEventToClient(targetUuid);

    // 通知GM操作成功
    emitEventToUser(data.user, "gm:removeInventory:success", { targetUuid, items });
    } catch (e: any) {
        // 处理错误
        emitEventToUser(data.user, "gm:removeInventory:fail", { message: e.message || "移除物品失败" });
    }
}