
import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from "..";
import { getItemModifyInfo } from "~/server/utils/game/characterInventory";

/**
 * 获取当前 socket.io 中有效房间（room）的总数量
 * 以及有任务队列在执行的玩家数量（从 redis 读取）
 */
export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<null>
) {
    let info = await getItemModifyInfo(data.user.uuid)
    emitEventToUser(data.user, "inventory:getModifyInfo:success", info);
}