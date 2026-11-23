import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { addSponsorPoints, getSponsorPoints, subtractSponsorPoints } from "~/server/utils/game/sponsorPoint";

const checkGmAction = async (userUuid: string, bearer: string) => {
    const required = process.env.GM_ACTION_BEARER;
    if (!required || bearer !== required) {
        return false
    }

    // 数据库查询是否为GM
    const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
    if (!gmUser || !gmUser.is_gm) {
         return false;
    }

    return true
}

export async function previewSponsorPointModifyInfo(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ targetUserName: string, value: number, reason: string, bearer: string }>
) {
    const userUuid = data.user.uuid;
    const { targetUserName, bearer, reason, value } = data.data;

    let isGm = await checkGmAction(userUuid, bearer)
    if (!isGm) {
        emitEventToUser(userUuid, "Xcsac4a31:fail", { message: "操作失败" });
        return;
    }

    const targetUser = await prisma.user.findFirst({
        select: { uuid: true, sponsor_points: true, max_sponsor_points: true },
        where: { name: targetUserName }
    });
    if (!targetUser) {
        emitEventToUser(userUuid, "Xcsac4apv:fail", { message: "目标用户不存在" });
        return;
    }

    let res: any = {
        user: targetUser,
        referrer: null,
    }

    // 检查是否存在推荐人
    const referrerInfo = await prisma.userReferral.findUnique({
        select: { referrerUuid: true },
        where: { referredUuid: targetUser.uuid, confirmedByReferred: true }
    })

    if (referrerInfo) {
        // 获取推荐人信息
        const referrer = await prisma.user.findUnique({
            select: { uuid: true, max_sponsor_points: true, sponsor_points: true },
            where: { uuid: referrerInfo.referrerUuid }
        })

        res.referrer = referrer;
    }

    // 通知GM操作成功
    emitEventToUser(userUuid, "Xcsac4apv:success", { res });
}

export async function increaseSponsorPoint(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ targetUserName: string, value: number, reason: string, bearer: string,}>
) {
    const userUuid = data.user.uuid;
    const { targetUserName, bearer, reason, value } = data.data;

    let isGm = await checkGmAction(userUuid, bearer)
    if (!isGm) {
        emitEventToUser(userUuid, "Xcsac4a31:fail", { message: "操作失败" });
        return;
    }

    const targetUser = await prisma.user.findFirst({
        where: { name: targetUserName }
    });
    if (!targetUser) {
        emitEventToUser(userUuid, "Xcsac4a31:fail", { message: "目标用户不存在" });
        return;
    }
    const targetUserUuid = targetUser.uuid;

    try {
        let res = await addSponsorPoints(targetUserUuid, value, reason + " -- GM操作")

        // 通知GM操作成功
        emitEventToUser(userUuid, "Xcsac4a31:success", { res });

        // 更新目标用户数据
        const points = res
    } catch (e: any) {
        emitEventToUser(data.user, "Xcsac4a31:fail", { message: e.message });
    }
}

export async function decreaseSponsorPoint(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{ targetUserName: string, value: number, reason: string, bearer: string,}>
) {
    const userUuid = data.user.uuid;
    const { targetUserName, bearer, reason, value } = data.data;

    let isGm = await checkGmAction(userUuid, bearer)
    if (!isGm) {
        return;
    }

    const targetUser = await prisma.user.findFirst({
        where: { name: targetUserName }
    });
    if (!targetUser) {
        emitEventToUser(data.user, "DSvuerarv:fail", { message: "目标用户不存在" });
        return;
    }
    const targetUserUuid = targetUser.uuid;

    try {
        let res = await subtractSponsorPoints(targetUserUuid, value, reason)

        // 通知GM操作成功
        emitEventToUser(userUuid, "DSvuerarv:success", { res });

        // 更新目标用户数据
        const points = await getUserSponsorPointInfo(targetUserUuid)
        emitEventToUser(targetUserUuid, "sponsorPoint:get:success", points);
    } catch (e: any) {
        emitEventToUser(data.user, "DSvuerarv:fail", { message: e.message });
    }
}
