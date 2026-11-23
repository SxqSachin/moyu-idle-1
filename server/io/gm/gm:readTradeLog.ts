import { DefaultEventsMap, Socket } from "socket.io";
import { GameSocketData } from "~/shared/types/socket";
import { emitEventToUser } from "..";
import { prisma } from "~/server/utils/game/db";
import { resolve } from "node:path";
import { promises as fs } from "node:fs";

export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<void>
) {
    const userUuid = data.user.uuid;

    // 数据库查询是否为GM
    const gmUser = await prisma.user.findUnique({ where: { uuid: userUuid } });
    if (!gmUser || !gmUser.is_gm) {
        emitEventToUser(data.user, "gm:readTradeLog:fail", { message: "无权限" });
        return;
    }

    // 读取交易日志内容
    try {
        const logPath = resolve(process.cwd(), "logs/app/trade.log");
        const logContent = await fs.readFile(logPath, "utf-8");
        // 只返回最新的部分内容（如最后1000字符），可根据需要调整
        const result = logContent; //.length > 1000 ? logContent.slice(-1000) : logContent;
        emitEventToUser(data.user, "gm:readTradeLog:success", { log: result });
    } catch (err) {
        emitEventToUser(data.user, "gm:readTradeLog:fail", { message: "日志读取失败" });
    }
}