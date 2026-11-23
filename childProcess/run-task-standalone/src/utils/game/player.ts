import { prisma } from "../prisma"
import { leaveBattle } from "./battle";
import { getRoomByUserId, getUserRoomKey, kickUserFromRoom } from "./room";
import type { BattleRoom } from "~/shared/types/battleRoom";
import { removeFirstTask } from "./taskQueue";
import { getAllKittyByOwner, removeFirstKittyTask } from "./kitty";
import { redisClient } from "../redis"
import { delay } from "~/shared/utils";

export async function banUser(userUuid: string, reason: string) {
    let targetUser = await prisma.user.findUnique({
        where: { uuid: userUuid }
    });
    if (!targetUser) {
        throw new Error("目标用户不存在");
    }

    // 先将账号关闭
    let res = await prisma.user.update({
        where: { uuid: userUuid },
        data: {
            is_banned: true,
            ban_reason: reason,
            current_title: 'banned',
        }
    });

    // 关闭该用户的所有交易
    await prisma.market.updateMany({
        where: {
            seller: userUuid,
        },
        data: {
            is_closed: true
        }
    });
    await prisma.buyerMarket.updateMany({
        where: {
            buyer: userUuid,
        },
        data: {
            is_closed: true
        }
    });

    // 关闭该用户的所有 PlayerShop（店铺）
    // 将店铺状态设为 CLOSED，且将其上架项隐藏，保证下线/封禁期间不再对外展示
    await prisma.playerShop.updateMany({
        where: {
            owner: userUuid,
            // 仅对尚未关闭的店铺执行更新，避免重复写入 updatedAt
            state: { not: 'CLOSED' }
        },
        data: {
            state: 'CLOSED',
            updatedAt: new Date()
        }
    });

    // 隐藏该用户店铺下的所有上架项（冗余字段 sellerUuid 可直接匹配）
    await prisma.playerShopItem.updateMany({
        where: {
            sellerUuid: userUuid,
            state: { not: 'HIDDEN' }
        },
        data: {
            state: 'HIDDEN'
        }
    });

    // 关闭该用户的所有种植地块并禁止自动重种，防止封禁后仍被自动化进程使用
    await prisma.userFarmPlot.updateMany({
        where: {
            userUuid: userUuid,
            // 仅针对非已锁定的田地进行写入
            state: { not: 'LOCKED' }
        },
        data: {
            state: 'LOCKED',
            autoReplant: false,
            updatedAt: new Date()
        }
    });

    // 取消/标记该用户的所有待处理或进行中的自动强化请求为已取消，避免后台进程继续执行
    await prisma.enhanceRequire.updateMany({
        where: {
            userUuid: userUuid,
            // status: { in: ['PENDING', 'PROCESSING'] }
        },
        data: {
            status: 'CANCELLED',
            updatedAt: new Date()
        }
    });

    // 停用该用户的所有自动炼金任务，并将其标记为取消，后台任务会忽略已取消/非激活项
    await prisma.autoAlchemy.updateMany({
        where: {
            userUuid: userUuid,
            OR: [
                { isActive: true },
                // { status: { in: ['PENDING', 'PROCESSING'] } }
            ]
        },
        data: {
            isActive: false,
            status: 'CANCELLED',
            updatedAt: new Date()
        }
    });

    // 关闭所有房间
    let room = await getRoomByUserId<BattleRoom>(userUuid);
    if (room) {
        if (room?.battleUuid) {
            await leaveBattle(userUuid, room.uuid)
            await delay(1000);
            await leaveBattle(userUuid, room.uuid)
        }

        await redisClient.del(getUserRoomKey(userUuid))
        await kickUserFromRoom(room?.ownerId, userUuid, room?.uuid, true)
        await redisClient.del(getUserRoomKey(userUuid))
    }

    // 终止所有队列
    while (true) {
        let res = await removeFirstTask(userUuid)
        if (!res) break
    }

    let kitties = await getAllKittyByOwner(userUuid)
    for(const kitty of kitties) {
        while(true) {
            let res = await removeFirstKittyTask(kitty.uuid)
            if (!res) break;
        }
    }

    return res;
}