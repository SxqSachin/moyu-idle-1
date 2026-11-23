
import { DefaultEventsMap, Socket } from "socket.io"
import { GameSocketData } from "~/shared/types/socket"
import { emitEventToUser } from "..";
import { getItemModifyInfo, getItemModifyInfoByType } from "~/server/utils/game/characterInventory";
import { ModifyItemCountType } from "~/shared/types/gameInventory";

/**
 * 获取当前 socket.io 中有效房间（room）的总数量
 * 以及有任务队列在执行的玩家数量（从 redis 读取）
 */
export default async function (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    data: GameSocketData<{type: ModifyItemCountType}>
) {
    let info = await getItemModifyInfoByType(data.user.uuid, data.data.type)
    emitEventToUser(data.user, "inventory:getModifyInfoByType:success", info);
}