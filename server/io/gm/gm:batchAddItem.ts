import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { increaseItemCount, dispatchInventoryUpdatedEventToClient, dispatchResourceIncreaseToClient } from "~/server/utils/game/characterInventory";
import { ItemCountInfo, ModifyItemCountType } from "~/shared/types/gameInventory";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";

const GM_UUID = [
    "2509432e-caea-4abd-9220-e66ff6ef6a08",
    "86227f5f-5f23-4398-9c84-f49e969b0697"
];

const DELAY_MS = 50; // 每次发放间隔，单位毫秒

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ items: ItemCountInfo, comment: string, filter?: {
        uuidList?: string[]
        lastOnlineAfter: Date | null
    } }>
) {
    const userUuid = data.user.uuid;
    const { items, comment, filter } = data.data;

    // 只允许GM操作
    // 数据库查询是否为GM
    const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
    if (!gmUser || !gmUser.is_gm) {
        emitEventToUser(data.user, "gm:batchSendNotice:fail", { message: "无权限" });
        return;
    }

    const whereCondition: any = {
        is_banned: false,
        last_online_date: {
            gte: filter?.lastOnlineAfter || new Date(0) // 如果有过滤条件，则查询最近在线的用户
        }
    };

    if (filter?.uuidList && filter.uuidList.length > 0) {
        whereCondition.uuid = {
            in: filter.uuidList
        };
    }

    // 查询所有玩家
    const allUsers = await prisma.user.findMany({
        where: whereCondition,
        select: {
            uuid: true,
            name: true,
        }
    });

    const total = allUsers.length;
    let current = 0;
    const success: string[] = [];
    const fail: { name: string, reason: string }[] = [];

    for (const user of allUsers) {
        try {
            await enqueueToHarvestBox(user.uuid, items, {
                title: comment,
                source: "GM",
                "sourceId": gmUser.uuid,
            })

            // await increaseItemCount(user.uuid, items, {
            //     actionName: comment,
            //     showModifyInfo: true,
            //     type: ModifyItemCountType.Other
            // });
            // await dispatchResourceIncreaseToClient(user.uuid, items);
            // await dispatchInventoryUpdatedEventToClient(user.uuid);
            success.push(user.name);
        } catch (e) {
            fail.push({ name: user.name, reason: "添加物品失败" });
        }
        current++;
        // 实时推送进度
        emitEventToUser(data.user, "gm:batchAddInventory:progress", {
            current,
            total,
            user: user.name
        });
        // 延迟
        await new Promise(res => setTimeout(res, DELAY_MS));
    }

    emitEventToUser(data.user, "gm:batchAddInventory:result", { success, fail });
}